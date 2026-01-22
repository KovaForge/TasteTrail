import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { sql, generateId, now } from '../db';
import { withAuth, jsonResponse, errorResponse, AuthenticatedRequest } from '../middleware/auth';

// GET /api/restaurants/{restaurantId}/menu-items - Get menu items for a restaurant
app.http('getMenuItems', {
  methods: ['GET'],
  route: 'restaurants/{restaurantId}/menu-items',
  handler: withAuth(async (request, context, auth) => {
    const restaurantId = request.params.restaurantId;

    const items = await sql`
      SELECT 
        id, restaurant_id, workspace_id, name, category, price, description,
        tried, last_tried_date, rating, notes, tags, created_at
      FROM menu_items
      WHERE restaurant_id = ${restaurantId}
      ORDER BY category NULLS LAST, name ASC
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

    await sql`
      INSERT INTO menu_items (
        id, restaurant_id, workspace_id, name, category, price, description,
        tried, last_tried_date, rating, notes, tags, created_at
      ) VALUES (
        ${id},
        ${restaurantId},
        ${workspaceId},
        ${body.name.trim()},
        ${body.category?.trim() || null},
        ${body.price || null},
        ${body.description?.trim() || null},
        ${body.tried || false},
        ${body.tried ? createdAt : null},
        ${body.rating || null},
        ${body.notes?.trim() || null},
        ${JSON.stringify(body.tags || [])},
        ${createdAt}
      )
    `;

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
        id, restaurant_id, workspace_id, name, category, price, description,
        tried, last_tried_date, rating, notes, tags, created_at
      FROM menu_items
      WHERE id = ${id}
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

    // Simple update - in production would build dynamic query
    await sql`
      UPDATE menu_items SET
        name = COALESCE(${body.name?.trim()}, name),
        category = COALESCE(${body.category?.trim()}, category),
        price = COALESCE(${body.price}, price),
        description = COALESCE(${body.description?.trim()}, description),
        tried = COALESCE(${body.tried}, tried),
        last_tried_date = COALESCE(${body.lastTriedDate}, last_tried_date),
        rating = COALESCE(${body.rating}, rating),
        notes = COALESCE(${body.notes?.trim()}, notes),
        tags = COALESCE(${body.tags ? JSON.stringify(body.tags) : null}, tags)
      WHERE id = ${id}
    `;

    // Fetch updated
    const items = await sql`
      SELECT 
        id, restaurant_id, workspace_id, name, category, price, description,
        tried, last_tried_date, rating, notes, tags, created_at
      FROM menu_items WHERE id = ${id}
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

    await sql`DELETE FROM menu_items WHERE id = ${id}`;

    return jsonResponse({ success: true }, auth.correlationId);
  }),
});
