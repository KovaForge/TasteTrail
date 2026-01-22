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

    // Definition updates (Only allowed if Owner/Editor)
    const defUpdates: string[] = [];
    const defValues: unknown[] = [];

    if (canEditDefinition) {
      if (body.name !== undefined) { defUpdates.push('name'); defValues.push(body.name.trim()); }
      if (body.category !== undefined) { defUpdates.push('category'); defValues.push(body.category.trim()); }
      if (body.price !== undefined) { defUpdates.push('price'); defValues.push(body.price); }
      if (body.description !== undefined) { defUpdates.push('description'); defValues.push(body.description.trim()); }
    }

    // Personal State updates (Allowed for everyone)
    const stateUpdates: string[] = [];
    const stateValues: unknown[] = [];
    const stateColumns = ['tried', 'last_tried_date', 'rating', 'notes', 'tags'];

    if (body.tried !== undefined) { stateUpdates.push('tried'); stateValues.push(body.tried); }
    if (body.lastTriedDate !== undefined) { stateUpdates.push('last_tried_date'); stateValues.push(body.lastTriedDate); }
    if (body.rating !== undefined) { stateUpdates.push('rating'); stateValues.push(body.rating); }
    if (body.notes !== undefined) { stateUpdates.push('notes'); stateValues.push(body.notes.trim()); }
    if (body.tags !== undefined) { stateUpdates.push('tags'); stateValues.push(JSON.stringify(body.tags)); }

    if (defUpdates.length === 0 && stateUpdates.length === 0) {
      return errorResponse(400, 'No allowed updates provided', auth.correlationId);
    }

    await sql.transaction(async (tx) => {
      // 1. Update Definition
      if (defUpdates.length > 0) {
         await tx`
          UPDATE menu_items 
          SET ${sql(defUpdates.map((u, i) => [u, defValues[i]]))}
          WHERE id = ${id}
        `;
      }

      // 2. Upsert Personal State
      if (stateUpdates.length > 0) {
        // We need to check if row exists first or use upsert. 
        // Postgres ON CONFLICT requires a constraint unique index.
        // Primary key (user_id, menu_item_id) exists.
        
        // Construct SET clause for update part of upsert
        // Excluded table usage
        
        // Dynamic construction for INSERT ... ON CONFLICT
        // It's easier to just do explicit INSERT ... ON CONFLICT DO UPDATE
        // But we need to handle partial updates. 
        // If row doesn't exist, we need to provide all columns? No, separate table allows defaults.
        // But we need to preserve existing values if we don't send them?
        // Wait, if I send ONLY { rating: 5 }, and row doesn't exist, other fields (tried) will be default (false).
        // This is correct behavior for a new interaction.
        // BUT if row EXISTS, we should update only rating.
        
        // The safest way with the `neon` driver helper and dynamic columns is messy.
        // Let's rely on standard SQL upsert with specific logic.
        
        // Actually, simplest is to check existence.
        const existingState = await tx`SELECT 1 FROM user_menu_item_state WHERE user_id=${auth.user.id} AND menu_item_id=${id}`;
        
        if (existingState.length > 0) {
            // Update
             await tx`
                UPDATE user_menu_item_state
                SET ${sql(stateUpdates.map((u, i) => [u, stateValues[i]]))}
                WHERE user_id=${auth.user.id} AND menu_item_id=${id}
             `;
        } else {
            // Insert with defaults for missing fields
            // We need to map incoming updates to a full insert object or use defaults.
            // Map arrays to named checks
            const insertObj: any = {
                user_id: auth.user.id,
                menu_item_id: id,
                updated_at: now()
            };
            
            if (body.tried !== undefined) insertObj.tried = body.tried;
            if (body.lastTriedDate !== undefined) insertObj.last_tried_date = body.lastTriedDate;
            if (body.rating !== undefined) insertObj.rating = body.rating;
            if (body.notes !== undefined) insertObj.notes = body.notes;
            if (body.tags !== undefined) insertObj.tags = JSON.stringify(body.tags);

            // Using helper to verify columns
            const keys = Object.keys(insertObj);
            const vals = Object.values(insertObj);
            
            await tx`INSERT INTO user_menu_item_state (${sql(keys)}) VALUES (${sql(vals)})`;
        }
      }
    });

    // Fetch updated
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
