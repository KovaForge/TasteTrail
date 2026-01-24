import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { sql, generateId, now } from '../db';
import { withAuth, jsonResponse, errorResponse, AuthenticatedRequest } from '../middleware/auth';
import { decrypt, toBuffer } from '../utils/encryption';
import { createProvider } from '../services/aiProviders';
import { extractFromUrl, extractFromImage, extractFromText } from '../services/contentExtractors';

import type { ParsedMenu } from '../services/aiProviders';

/**
 * Try to parse content as a valid menu JSON matching the expected schema.
 * Returns the parsed menu if valid, or null to fall through to AI parsing.
 */
function tryParseMenuJson(content: string): ParsedMenu | null {
  try {
    const data = JSON.parse(content);

    if (!data.restaurant?.name || !data.restaurant?.cuisine) return null;
    if (!Array.isArray(data.items) || data.items.length === 0) return null;

    // Validate at least the first item has a name
    if (!data.items[0].name) return null;

    return {
      restaurant: {
        name: data.restaurant.name,
        cuisine: data.restaurant.cuisine,
        addressSuburb: data.restaurant.addressSuburb,
        notes: data.restaurant.notes,
      },
      items: data.items.map((item: any) => ({
        name: item.name || 'Unknown Item',
        category: item.category,
        price: typeof item.price === 'number' ? item.price : undefined,
        description: item.description,
        tags: Array.isArray(item.tags) ? item.tags : [],
        tried: false,
        notes: '',
      })),
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
    };
  } catch {
    return null;
  }
}

// POST /api/imports/parse - Parse menu from source with AI
app.http('parseImport', {
  methods: ['POST'],
  route: 'imports/parse',
  handler: withAuth(async (request, context, auth) => {
    const startTime = Date.now();
    
    if (!auth.workspaceId) {
      return errorResponse(400, 'Workspace ID is required', auth.correlationId);
    }

    const body = await request.json() as {
      sourceType: 'text' | 'url' | 'image';
      sourceValue: string;
      restaurantHint?: string;
      provider?: string;
    };

    if (!body.sourceType || !body.sourceValue) {
      return errorResponse(400, 'Source type and value are required', auth.correlationId);
    }

    try {
      // 1. Fetch user's AI settings, filtered by selected provider if specified
      const settings = body.provider
        ? await sql`
            SELECT provider, model, encrypted_api_key, nonce
            FROM user_ai_settings
            WHERE user_id = ${auth.user.id} AND provider = ${body.provider}
          `
        : await sql`
            SELECT provider, model, encrypted_api_key, nonce
            FROM user_ai_settings
            WHERE user_id = ${auth.user.id}
          `;

      if (settings.length === 0) {
        return errorResponse(
          400,
          body.provider
            ? `AI provider "${body.provider}" not configured. Please add your API key in Settings.`
            : 'AI provider not configured. Please add your API key in Settings.',
          auth.correlationId
        );
      }

      const setting = settings[0];

      // 2. Extract content based on source type
      let content: string;
      
      context.log(`Extracting content from ${body.sourceType}...`);
      
      if (body.sourceType === 'url') {
        content = await extractFromUrl(body.sourceValue);
      } else if (body.sourceType === 'image') {
        // Expect base64-encoded image
        const imageBuffer = Buffer.from(body.sourceValue, 'base64');
        content = await extractFromImage(imageBuffer);
      } else {
        content = extractFromText(body.sourceValue);
      }

      context.log(`Extracted ${content.length} characters`);

      // 3. Create Import Record (Draft)
      const importId = generateId();
      await sql`
        INSERT INTO menu_imports (id, workspace_id, source_type, source_value, imported_at, status)
        VALUES (
          ${importId}, 
          ${auth.workspaceId}, 
          ${body.sourceType}, 
          ${body.sourceValue.substring(0, 10000)}, -- Truncate if too long (esp. base64) for safety/storage? Actually TEXT can hold 1GB. But let's simple store it.
          ${now()}, 
          'draft'
        )
      `;
      // Note: Truncating source_value might be bad if we need to re-process. 
      // But for 'text' and 'url' it's fine. For 'image' base64, it's huge.
      // The schema says TEXT. Postgres can handle it. Let's just store it or empty string if image?
      // "source_value TEXT NOT NULL". 
      // Let's store full value for now.

      // 4. Check if content is already valid menu JSON (skip AI call)
      const directParsed = tryParseMenuJson(content);
      if (directParsed) {
        context.log('Direct JSON import detected, skipping AI call');
        const duration = Date.now() - startTime;
        return jsonResponse({
          id: importId, // Return real DB ID
          restaurant: directParsed.restaurant,
          items: directParsed.items,
          warnings: directParsed.warnings,
          meta: {
            provider: 'direct',
            model: 'json-import',
            sourceType: body.sourceType,
            itemCount: directParsed.items.length,
            durationMs: duration,
          },
        }, auth.correlationId, 200);
      }

      // 5. Decrypt API key and parse with AI
      const encryptedBuffer = toBuffer(setting.encrypted_api_key);
      const nonceBuffer = toBuffer(setting.nonce);
      const apiKey = decrypt(encryptedBuffer, nonceBuffer);
      const provider = createProvider(setting.provider, apiKey, setting.model);

      context.log(`Parsing with ${setting.provider} (${setting.model})...`);

      const parsed = await provider.parseMenu(content, body.restaurantHint);

      const duration = Date.now() - startTime;

      // 6. Return parsed menu
      return jsonResponse({
        id: importId, // Return real DB ID
        restaurant: parsed.restaurant,
        items: parsed.items,
        warnings: parsed.warnings,
        meta: {
          provider: setting.provider,
          model: setting.model,
          sourceType: body.sourceType,
          itemCount: parsed.items.length,
          durationMs: duration,
        },
      }, auth.correlationId, 200);
      
    } catch (error) {
      context.error('Import parsing error:', error);
      
      return errorResponse(
        500,
        `Failed to parse menu: ${error instanceof Error ? error.message : String(error)}`,
        auth.correlationId,
        {
          stack: error instanceof Error ? error.stack : undefined,
          sourceType: body.sourceType,
        }
      );
    }
  }, { requireWorkspace: true }),
});

// POST /api/imports/{id}/commit - Commit an import
app.http('commitImport', {
  methods: ['POST'],
  route: 'imports/{id}/commit',
  handler: withAuth(async (request, context, auth) => {
    const importId = request.params.id;
    
    if (!auth.workspaceId) {
      return errorResponse(400, 'Workspace ID is required', auth.correlationId);
    }

    const body = await request.json() as {
      restaurantName: string;
      cuisine: string;
      items: Array<{
        name: string;
        category?: string;
        price?: number;
        description?: string;
        selected: boolean;
      }>;
    };

    // Validate
    if (!body.restaurantName?.trim()) {
      return errorResponse(400, 'Restaurant name is required', auth.correlationId);
    }
    if (!body.cuisine?.trim()) {
      return errorResponse(400, 'Cuisine is required', auth.correlationId);
    }

    const selectedItems = body.items.filter(i => i.selected);
    if (selectedItems.length === 0) {
      return errorResponse(400, 'At least one item must be selected', auth.correlationId);
    }

    const restaurantName = body.restaurantName.trim();
    const cuisine = body.cuisine.trim();
    const createdAt = now();

    // 1. Check for existing restaurant by name and workspace
    const existingRestaurants = await sql`
      SELECT id, name, cuisine, created_at FROM restaurants 
      WHERE workspace_id = ${auth.workspaceId} AND LOWER(name) = LOWER(${restaurantName})
    `;

    let restaurantId: string;
    let isNewRestaurant = false;

    if (existingRestaurants.length > 0) {
      // Reuse existing
      restaurantId = existingRestaurants[0].id;
      context.log(`Using existing restaurant: ${restaurantName} (${restaurantId})`);
    } else {
      // Create new
      restaurantId = generateId();
      isNewRestaurant = true;
      await sql`
        INSERT INTO restaurants (id, workspace_id, name, cuisine, created_at)
        VALUES (${restaurantId}, ${auth.workspaceId}, ${restaurantName}, ${cuisine}, ${createdAt})
      `;
      context.log(`Created new restaurant: ${restaurantName} (${restaurantId})`);
    }

    // 2. Fetch existing items to check for duplicates
    // Only need this if restaurant existed
    const existingItems = isNewRestaurant ? [] : await sql`
      SELECT name, price FROM menu_items WHERE restaurant_id = ${restaurantId}
    `;

    // Helper to check for duplicate
    const isDuplicate = (name: string, price?: number) => {
      const normalizedName = name.toLowerCase().trim();
      return existingItems.some(existing => 
        existing.name.toLowerCase().trim() === normalizedName && 
        // Price match: if both exist, they must be equal. If one is null/undefined, it's fuzzy.
        // Requirement: "same item name and same price"
        // Let's assume strict equality on price if both present. If one missing, maybe not duplicate?
        // Let's go with strict: price must match.
        // If stored price is numeric string, cast it.
        Number(existing.price) === Number(price)
      );
    };

    // 3. Create menu items (Skipping duplicates)
    const items = [];
    let skippedCount = 0;

    for (const item of selectedItems) {
      if (isDuplicate(item.name, item.price)) {
        skippedCount++;
        continue;
      }

      const itemId = generateId();
      await sql`
        INSERT INTO menu_items (
          id, restaurant_id, workspace_id, name, category, price, description,
          tried, tags, created_at
        ) VALUES (
          ${itemId},
          ${restaurantId},
          ${auth.workspaceId},
          ${item.name.trim()},
          ${item.category?.trim() || null},
          ${item.price || null},
          ${item.description?.trim() || null},
          false,
          '[]',
          ${createdAt}
        )
      `;
      items.push({
        id: itemId,
        restaurantId,
        workspaceId: auth.workspaceId,
        name: item.name.trim(),
        category: item.category?.trim() || null,
        price: item.price || null,
        description: item.description?.trim() || null,
        tried: false,
        tags: [],
        createdAt,
      });
    }
    
    context.log(`Committed ${items.length} items to ${restaurantName} (Skipped ${skippedCount} duplicates)`);

    // Update import status
    await sql`
      UPDATE menu_imports SET status = 'committed' WHERE id = ${importId}
    `;

    return jsonResponse({
      restaurant: {
        id: restaurantId,
        workspaceId: auth.workspaceId,
        name: restaurantName,
        cuisine,
        createdAt: isNewRestaurant ? createdAt : existingRestaurants[0].created_at,
      },
      items,
      meta: {
        skippedCount,
        isNewRestaurant
      }
    }, auth.correlationId);

    // Update import status
    await sql`
      UPDATE menu_imports SET status = 'committed' WHERE id = ${importId}
    `;

    return jsonResponse({
      restaurant: {
        id: restaurantId,
        workspaceId: auth.workspaceId,
        name: body.restaurantName.trim(),
        cuisine: body.cuisine.trim(),
        createdAt,
      },
      items,
    }, auth.correlationId);
  }, { requireWorkspace: true }),
});

