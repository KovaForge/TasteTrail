import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { sql, generateId, now } from '../db';
import { withAuth, jsonResponse, errorResponse, AuthenticatedRequest } from '../middleware/auth';

// POST /api/imports - Create an import draft
app.http('createImport', {
  methods: ['POST'],
  route: 'imports',
  handler: withAuth(async (request, context, auth) => {
    if (!auth.workspaceId) {
      return errorResponse(400, 'Workspace ID is required', auth.correlationId);
    }

    const body = await request.json() as {
      sourceType: 'text' | 'url' | 'image';
      sourceValue: string;
    };

    if (!body.sourceType || !body.sourceValue) {
      return errorResponse(400, 'Source type and value are required', auth.correlationId);
    }

    const id = generateId();
    const importedAt = now();

    // Save import record
    await sql`
      INSERT INTO menu_imports (id, workspace_id, source_type, source_value, imported_at, status)
      VALUES (${id}, ${auth.workspaceId}, ${body.sourceType}, ${body.sourceValue}, ${importedAt}, 'draft')
    `;

    // Mock AI parsing - in production this would call Azure OpenAI
    // For now, let's do simple text parsing
    const draft = parseMenuText(body.sourceValue, body.sourceType);

    return jsonResponse({
      import: {
        id,
        workspaceId: auth.workspaceId,
        sourceType: body.sourceType,
        sourceValue: body.sourceValue.substring(0, 100) + '...',
        importedAt,
        status: 'draft',
      },
      draft,
    }, auth.correlationId, 201);
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

    const restaurantId = generateId();
    const createdAt = now();

    // Create restaurant
    await sql`
      INSERT INTO restaurants (id, workspace_id, name, cuisine, created_at)
      VALUES (${restaurantId}, ${auth.workspaceId}, ${body.restaurantName.trim()}, ${body.cuisine.trim()}, ${createdAt})
    `;

    // Create menu items
    const items = [];
    for (const item of selectedItems) {
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

/**
 * Simple text parser for menu items
 * In production, this would use Azure OpenAI for better parsing
 */
function parseMenuText(text: string, sourceType: string): {
  restaurantName: string;
  cuisine: string;
  items: Array<{
    name: string;
    category?: string;
    price?: number;
    description?: string;
    selected: boolean;
  }>;
} {
  const lines = text.split('\n').filter(l => l.trim());
  const items: Array<{
    name: string;
    category?: string;
    price?: number;
    description?: string;
    selected: boolean;
  }> = [];

  let currentCategory: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) continue;

    // Try to extract price
    const priceMatch = trimmed.match(/\$?(\d+(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]!) : undefined;

    // Remove price from name
    let name = trimmed.replace(/\$?\d+(?:\.\d{2})?/g, '').trim();
    
    // Clean up common separators
    name = name.replace(/[-–—]+$/, '').trim();
    name = name.replace(/^[-–—]+/, '').trim();

    // Skip if too short (likely a header or category)
    if (name.length < 3) continue;

    // Check if this looks like a category header (all caps, no price)
    if (name === name.toUpperCase() && !price && name.length < 30) {
      currentCategory = name.charAt(0) + name.slice(1).toLowerCase();
      continue;
    }

    items.push({
      name,
      category: currentCategory,
      price,
      description: undefined,
      selected: true,
    });
  }

  return {
    restaurantName: 'New Restaurant',
    cuisine: 'Other',
    items: items.slice(0, 50), // Limit to 50 items
  };
}
