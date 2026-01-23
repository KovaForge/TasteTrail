import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { sql, generateId, now } from '../db';
import { withAuth, jsonResponse, errorResponse, AuthenticatedRequest } from '../middleware/auth';

// GET /api/restaurants/{restaurantId}/menu-items - Get menu items for a restaurant
app.http('getMenuItems', {
  methods: ['GET'],
  route: 'restaurants/{restaurantId}/menu-items',
  handler: withAuth(async (request, context, auth) => {
    const restaurantId = request.params.restaurantId;

    // Join with user_menu_item_state to get personal progress
    const items = await sql`
      SELECT 
        mi.id, 
        mi.restaurant_id, 
        mi.workspace_id, 
        mi.name, 
        mi.category, 
        mi.price, 
        mi.description,
        mi.created_at,
        -- Personal state (coalesce to defaults)
        COALESCE(us.tried, false) as tried,
        us.last_tried_date,
        us.rating,
        us.notes,
        COALESCE(us.tags, '[]'::jsonb) as tags
      FROM menu_items mi
      LEFT JOIN user_menu_item_state us ON mi.id = us.menu_item_id AND us.user_id = ${auth.user.id}
      WHERE mi.restaurant_id = ${restaurantId}
      ORDER BY mi.category NULLS LAST, mi.name ASC
    `;
    
    return jsonResponse({ items }, auth.correlationId);
  }),
});

// POST /api/restaurants/{restaurantId}/menu-items - Create a menu item
app.http('createMenuItem', {
  methods: ['POST'],
  route: 'restaurants/{restaurantId}/menu-items',
  handler: withAuth(async (request, context, auth) => {
    const restaurantId = request.params.restaurantId;

    // Verify restaurant exists and get workspace
    const restaurants = await sql`
      SELECT workspace_id FROM restaurants WHERE id = ${restaurantId}
    `;
    
    if (restaurants.length === 0) {
      return errorResponse(404, 'Restaurant not found', auth.correlationId);
    }

    const workspaceId = restaurants[0]?.workspace_id;

    // Verify membership in the restaurant's workspace (Anyone can add items)
    const membership = await sql`
      SELECT role FROM workspace_members 
      WHERE user_id = ${auth.user.id} AND workspace_id = ${workspaceId}
    `;

    if (membership.length === 0) {
      return errorResponse(403, 'You do not have permission to add items to this restaurant', auth.correlationId);
    }

    const body = await request.json() as {
      name: string;
      category?: string;
      price?: number;
      description?: string;
      tried?: boolean;
      rating?: number;
      notes?: string;
      tags?: string[];
    };

    if (!body.name?.trim()) {
      return errorResponse(400, 'Item name is required', auth.correlationId);
    }

    const id = generateId();
    const createdAt = now();

    await sql.transaction(async (tx) => {
      // 1. Insert Definition
      await tx`
        INSERT INTO menu_items (
          id, restaurant_id, workspace_id, name, category, price, description, created_at
        ) VALUES (
          ${id},
          ${restaurantId},
          ${workspaceId},
          ${body.name.trim()},
          ${body.category?.trim() || null},
          ${body.price || null},
          ${body.description?.trim() || null},
          ${createdAt}
        )
      `;

      // 2. Insert Personal State (if any)
      if (body.tried || body.rating || body.notes || (body.tags && body.tags.length > 0)) {
        await tx`
          INSERT INTO user_menu_item_state (
            user_id, menu_item_id, tried, last_tried_date, rating, notes, tags
          ) VALUES (
            ${auth.user.id},
            ${id},
            ${body.tried || false},
            ${body.tried ? createdAt : null},
            ${body.rating || null},
            ${body.notes?.trim() || null},
            ${JSON.stringify(body.tags || [])}
          )
        `;
      }
    });

    return jsonResponse({
      id,
      restaurantId,
      workspaceId,
      name: body.name.trim(),
      category: body.category?.trim() || null,
      price: body.price || null,
      description: body.description?.trim() || null,
      tried: body.tried || false,
      lastTriedDate: body.tried ? createdAt : null,
      rating: body.rating || null,
      notes: body.notes?.trim() || null,
      tags: body.tags || [],
      createdAt,
    }, auth.correlationId, 201);
  }),
});

// GET /api/menu-items/{id} - Get a single menu item
app.http('getMenuItem', {
  methods: ['GET'],
  route: 'menu-items/{id}',
  handler: withAuth(async (request, context, auth) => {
    const id = request.params.id;

    const items = await sql`
      SELECT 
        mi.id, mi.restaurant_id, mi.workspace_id, mi.name, mi.category, mi.price, mi.description, mi.created_at,
        COALESCE(us.tried, false) as tried,
        us.last_tried_date,
        us.rating,
        us.notes,
        COALESCE(us.tags, '[]'::jsonb) as tags
      FROM menu_items mi
      LEFT JOIN user_menu_item_state us ON mi.id = us.menu_item_id AND us.user_id = ${auth.user.id}
      WHERE mi.id = ${id}
    `;

    if (items.length === 0) {
      return errorResponse(404, 'Menu item not found', auth.correlationId);
    }

    return jsonResponse(items[0], auth.correlationId);
  }),
});

// PUT /api/menu-items/{id} - Update a menu item
app.http('updateMenuItem', {
  methods: ['PUT'],
  route: 'menu-items/{id}',
  handler: withAuth(async (request, context, auth) => {
    const id = request.params.id;
    const body = await request.json() as Partial<{
      name: string;
      category: string;
      price: number;
      description: string;
      tried: boolean;
      lastTriedDate: string;
      rating: number;
      notes: string;
      tags: string[];
    }>;

    // Fetch existing item to check workspace ownership
    const existing = await sql`
      SELECT workspace_id FROM menu_items WHERE id = ${id}
    `;

    if (existing.length === 0) {
      return errorResponse(404, 'Menu item not found', auth.correlationId);
    }

    const itemWorkspaceId = existing[0].workspace_id;
    
    // Check membership
    const membership = await sql`
      SELECT role FROM workspace_members 
      WHERE user_id = ${auth.user.id} AND workspace_id = ${itemWorkspaceId}
    `;
    
    if (membership.length === 0) {
       return errorResponse(403, 'No access to this workspace', auth.correlationId);
    }

    const role = membership[0].role;
    const canEditDefinition = role === 'Owner' || role === 'Editor';

    // Check if there's anything to update
    const hasDefinitionUpdates = body.name !== undefined || body.category !== undefined || 
                                  body.price !== undefined || body.description !== undefined;
    const hasStateUpdates = body.tried !== undefined || body.lastTriedDate !== undefined ||
                            body.rating !== undefined || body.notes !== undefined || body.tags !== undefined;

    if (!hasDefinitionUpdates && !hasStateUpdates) {
      return errorResponse(400, 'No updates provided', auth.correlationId);
    }

    // 1. Update Definition (if allowed and has updates)
    if (canEditDefinition && hasDefinitionUpdates) {
      await sql`
        UPDATE menu_items 
        SET 
          name = COALESCE(${body.name?.trim() ?? null}, name),
          category = COALESCE(${body.category?.trim() ?? null}, category),
          price = COALESCE(${body.price ?? null}, price),
          description = COALESCE(${body.description?.trim() ?? null}, description)
        WHERE id = ${id}
      `;
    }

    // 2. Upsert Personal State (if has state updates)
    if (hasStateUpdates) {
      const updatedAt = now();
      const triedValue = body.tried ?? null;
      const lastTriedDateValue = body.lastTriedDate ?? null;
      const ratingValue = body.rating ?? null;
      const notesValue = body.notes?.trim() ?? null;
      const tagsValue = body.tags ? JSON.stringify(body.tags) : null;

      // Use INSERT ... ON CONFLICT for upsert
      await sql`
        INSERT INTO user_menu_item_state (user_id, menu_item_id, tried, last_tried_date, rating, notes, tags, updated_at)
        VALUES (
          ${auth.user.id}, 
          ${id}, 
          COALESCE(${triedValue}, false),
          ${lastTriedDateValue},
          ${ratingValue},
          ${notesValue},
          COALESCE(${tagsValue}::jsonb, '[]'::jsonb),
          ${updatedAt}
        )
        ON CONFLICT (user_id, menu_item_id) DO UPDATE SET
          tried = COALESCE(${triedValue}, user_menu_item_state.tried),
          last_tried_date = COALESCE(${lastTriedDateValue}, user_menu_item_state.last_tried_date),
          rating = COALESCE(${ratingValue}, user_menu_item_state.rating),
          notes = COALESCE(${notesValue}, user_menu_item_state.notes),
          tags = COALESCE(${tagsValue}::jsonb, user_menu_item_state.tags),
          updated_at = ${updatedAt}
      `;
    }

    // Fetch updated item with personal state
    const items = await sql`
      SELECT 
        mi.id, mi.restaurant_id, mi.workspace_id, mi.name, mi.category, mi.price, mi.description, mi.created_at,
        COALESCE(us.tried, false) as tried,
        us.last_tried_date,
        us.rating,
        us.notes,
        COALESCE(us.tags, '[]'::jsonb) as tags
      FROM menu_items mi
      LEFT JOIN user_menu_item_state us ON mi.id = us.menu_item_id AND us.user_id = ${auth.user.id}
      WHERE mi.id = ${id}
    `;

    return jsonResponse(items[0], auth.correlationId);
  }),
});

// DELETE /api/menu-items/{id} - Delete a menu item
app.http('deleteMenuItem', {
  methods: ['DELETE'],
  route: 'menu-items/{id}',
  handler: withAuth(async (request, context, auth) => {
    const id = request.params.id;

    // Check ownership
    const existing = await sql`SELECT workspace_id FROM menu_items WHERE id = ${id}`;
    if (existing.length === 0) return jsonResponse({ success: true }, auth.correlationId);
    
    const membership = await sql`
       SELECT role FROM workspace_members 
       WHERE user_id = ${auth.user.id} AND workspace_id = ${existing[0].workspace_id}
    `;
    
    if (membership.length === 0 || (membership[0].role !== 'Owner' && membership[0].role !== 'Editor')) {
        return errorResponse(403, 'Only Owners and Editors can delete menu items', auth.correlationId);
    }

    await sql`DELETE FROM menu_items WHERE id = ${id}`;

    return jsonResponse({ success: true }, auth.correlationId);
  }),
});
