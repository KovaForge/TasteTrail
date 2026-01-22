import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { sql, generateId, now } from '../db';
import { withAuth, jsonResponse, errorResponse, AuthenticatedRequest } from '../middleware/auth';

// GET /api/restaurants - Get all restaurants in workspace
app.http('getRestaurants', {
  methods: ['GET'],
  route: 'restaurants',
  handler: withAuth(async (request, context, auth) => {
    if (!auth.workspaceId) {
      return errorResponse(400, 'Workspace ID is required', auth.correlationId);
    }

    const restaurants = await sql`
      SELECT 
        r.id, r.workspace_id, r.name, r.cuisine, r.address_suburb, 
        r.notes, r.last_visited_date, r.created_at,
        COUNT(mi.id) as menu_item_count,
        COUNT(CASE WHEN mi.tried = true THEN 1 END) as tried_count
      FROM restaurants r
      LEFT JOIN menu_items mi ON r.id = mi.restaurant_id
      WHERE r.workspace_id = ${auth.workspaceId}
      GROUP BY r.id
      ORDER BY r.name ASC
    `;
    
    return jsonResponse({ 
      restaurants: restaurants.map(r => ({
        ...r,
        menuItemCount: Number(r.menu_item_count),
        triedCount: Number(r.tried_count),
      }))
    }, auth.correlationId);
  }, { requireWorkspace: true }),
});

// POST /api/restaurants - Create a restaurant
app.http('createRestaurant', {
  methods: ['POST'],
  route: 'restaurants',
  handler: withAuth(async (request, context, auth) => {
    if (!auth.workspaceId) {
      return errorResponse(400, 'Workspace ID is required', auth.correlationId);
    }

    const body = await request.json() as {
      name: string;
      cuisine: string;
      addressSuburb?: string;
      notes?: string;
    };

    if (!body.name?.trim()) {
      return errorResponse(400, 'Restaurant name is required', auth.correlationId);
    }
    if (!body.cuisine?.trim()) {
      return errorResponse(400, 'Cuisine is required', auth.correlationId);
    }

    const id = generateId();
    const createdAt = now();

    await sql`
      INSERT INTO restaurants (id, workspace_id, name, cuisine, address_suburb, notes, created_at)
      VALUES (
        ${id}, 
        ${auth.workspaceId}, 
        ${body.name.trim()}, 
        ${body.cuisine.trim()}, 
        ${body.addressSuburb?.trim() || null},
        ${body.notes?.trim() || null},
        ${createdAt}
      )
    `;

    return jsonResponse({
      id,
      workspaceId: auth.workspaceId,
      name: body.name.trim(),
      cuisine: body.cuisine.trim(),
      addressSuburb: body.addressSuburb?.trim() || null,
      notes: body.notes?.trim() || null,
      createdAt,
    }, auth.correlationId, 201);
  }, { requireWorkspace: true }),
});

// GET /api/restaurants/{id} - Get a single restaurant
app.http('getRestaurant', {
  methods: ['GET'],
  route: 'restaurants/{id}',
  handler: withAuth(async (request, context, auth) => {
    const id = request.params.id;

    const restaurants = await sql`
      SELECT id, workspace_id, name, cuisine, address_suburb, notes, last_visited_date, created_at
      FROM restaurants
      WHERE id = ${id}
    `;

    if (restaurants.length === 0) {
      return errorResponse(404, 'Restaurant not found', auth.correlationId);
    }

    return jsonResponse(restaurants[0], auth.correlationId);
  }),
});

// PUT /api/restaurants/{id} - Update a restaurant
app.http('updateRestaurant', {
  methods: ['PUT'],
  route: 'restaurants/{id}',
  handler: withAuth(async (request, context, auth) => {
    const id = request.params.id;
    const body = await request.json() as Partial<{
      name: string;
      cuisine: string;
      addressSuburb: string;
      notes: string;
      lastVisitedDate: string;
    }>;

    // Build update
    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) {
      updates.push('name');
      values.push(body.name.trim());
    }
    if (body.cuisine !== undefined) {
      updates.push('cuisine');
      values.push(body.cuisine.trim());
    }
    if (body.addressSuburb !== undefined) {
      updates.push('address_suburb');
      values.push(body.addressSuburb.trim() || null);
    }
    if (body.notes !== undefined) {
      updates.push('notes');
      values.push(body.notes.trim() || null);
    }
    if (body.lastVisitedDate !== undefined) {
      updates.push('last_visited_date');
      values.push(body.lastVisitedDate || null);
    }

    if (updates.length === 0) {
      return errorResponse(400, 'No updates provided', auth.correlationId);
    }

    // Execute update using raw SQL
    const setClause = updates.map((u, i) => `${u} = $${i + 2}`).join(', ');
    await sql.transaction([
      sql`UPDATE restaurants SET ${sql(updates.map((u, i) => [u, values[i]]))} WHERE id = ${id}`
    ]);

    // Fetch updated
    const restaurants = await sql`
      SELECT id, workspace_id, name, cuisine, address_suburb, notes, last_visited_date, created_at
      FROM restaurants WHERE id = ${id}
    `;

    return jsonResponse(restaurants[0], auth.correlationId);
  }),
});

// DELETE /api/restaurants/{id} - Delete a restaurant
app.http('deleteRestaurant', {
  methods: ['DELETE'],
  route: 'restaurants/{id}',
  handler: withAuth(async (request, context, auth) => {
    const id = request.params.id;

    // Delete menu items first
    await sql`DELETE FROM menu_items WHERE restaurant_id = ${id}`;
    await sql`DELETE FROM restaurants WHERE id = ${id}`;

    return jsonResponse({ success: true }, auth.correlationId);
  }),
});
