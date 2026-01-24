import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { sql } from '../db';
import { withAuth, jsonResponse, errorResponse, AuthenticatedRequest } from '../middleware/auth';

// GET /api/search - Search restaurants and menu items
app.http('search', {
  methods: ['GET'],
  route: 'search',
  handler: withAuth(async (request, context, auth) => {
    if (!auth.workspaceId) {
      return errorResponse(400, 'Workspace ID is required', auth.correlationId);
    }

    const query = request.query.get('q') || '';
    const tried = request.query.get('tried');
    const minRating = request.query.get('minRating');
    const tagsParam = request.query.get('tags');

    if (!query.trim()) {
      return jsonResponse({ restaurants: [], menuItems: [] }, auth.correlationId);
    }

    const searchTerm = `%${query.toLowerCase()}%`;

    // Search restaurants
    const restaurants = await sql`
      SELECT id, workspace_id, name, cuisine, address_suburb, notes, last_visited_date, created_at
      FROM restaurants
      WHERE workspace_id = ${auth.workspaceId}
        AND (LOWER(name) LIKE ${searchTerm} OR LOWER(cuisine) LIKE ${searchTerm})
      ORDER BY name ASC
      LIMIT 20
    `;

    // Build menu items query with per-user state
    let menuItems;
    const minRatingVal = minRating ? parseInt(minRating) : 0;

    if (tried === 'true' && minRatingVal > 0) {
      menuItems = await sql`
        SELECT
          mi.id, mi.restaurant_id, mi.workspace_id, mi.name, mi.category, mi.price, mi.description, mi.created_at,
          COALESCE(us.tried, false) as tried, us.last_tried_date, us.rating, us.notes,
          COALESCE(us.tags, '[]'::jsonb) as tags
        FROM menu_items mi
        LEFT JOIN user_menu_item_state us ON mi.id = us.menu_item_id AND us.user_id = ${auth.user.id}
        WHERE mi.workspace_id = ${auth.workspaceId}
          AND LOWER(mi.name) LIKE ${searchTerm}
          AND us.tried = true
          AND us.rating >= ${minRatingVal}
        ORDER BY mi.name ASC
        LIMIT 50
      `;
    } else if (tried === 'true') {
      menuItems = await sql`
        SELECT
          mi.id, mi.restaurant_id, mi.workspace_id, mi.name, mi.category, mi.price, mi.description, mi.created_at,
          COALESCE(us.tried, false) as tried, us.last_tried_date, us.rating, us.notes,
          COALESCE(us.tags, '[]'::jsonb) as tags
        FROM menu_items mi
        LEFT JOIN user_menu_item_state us ON mi.id = us.menu_item_id AND us.user_id = ${auth.user.id}
        WHERE mi.workspace_id = ${auth.workspaceId}
          AND LOWER(mi.name) LIKE ${searchTerm}
          AND us.tried = true
        ORDER BY mi.name ASC
        LIMIT 50
      `;
    } else if (tried === 'false') {
      menuItems = await sql`
        SELECT
          mi.id, mi.restaurant_id, mi.workspace_id, mi.name, mi.category, mi.price, mi.description, mi.created_at,
          COALESCE(us.tried, false) as tried, us.last_tried_date, us.rating, us.notes,
          COALESCE(us.tags, '[]'::jsonb) as tags
        FROM menu_items mi
        LEFT JOIN user_menu_item_state us ON mi.id = us.menu_item_id AND us.user_id = ${auth.user.id}
        WHERE mi.workspace_id = ${auth.workspaceId}
          AND LOWER(mi.name) LIKE ${searchTerm}
          AND (us.tried IS NULL OR us.tried = false)
        ORDER BY mi.name ASC
        LIMIT 50
      `;
    } else if (minRatingVal > 0) {
      menuItems = await sql`
        SELECT
          mi.id, mi.restaurant_id, mi.workspace_id, mi.name, mi.category, mi.price, mi.description, mi.created_at,
          COALESCE(us.tried, false) as tried, us.last_tried_date, us.rating, us.notes,
          COALESCE(us.tags, '[]'::jsonb) as tags
        FROM menu_items mi
        LEFT JOIN user_menu_item_state us ON mi.id = us.menu_item_id AND us.user_id = ${auth.user.id}
        WHERE mi.workspace_id = ${auth.workspaceId}
          AND LOWER(mi.name) LIKE ${searchTerm}
          AND us.rating >= ${minRatingVal}
        ORDER BY mi.name ASC
        LIMIT 50
      `;
    } else {
      menuItems = await sql`
        SELECT
          mi.id, mi.restaurant_id, mi.workspace_id, mi.name, mi.category, mi.price, mi.description, mi.created_at,
          COALESCE(us.tried, false) as tried, us.last_tried_date, us.rating, us.notes,
          COALESCE(us.tags, '[]'::jsonb) as tags
        FROM menu_items mi
        LEFT JOIN user_menu_item_state us ON mi.id = us.menu_item_id AND us.user_id = ${auth.user.id}
        WHERE mi.workspace_id = ${auth.workspaceId}
          AND LOWER(mi.name) LIKE ${searchTerm}
        ORDER BY mi.name ASC
        LIMIT 50
      `;
    }

    return jsonResponse({ restaurants, menuItems }, auth.correlationId);
  }, { requireWorkspace: true }),
});

// GET /api/stats/cuisines - Get cuisine statistics
app.http('getCuisineStats', {
  methods: ['GET'],
  route: 'stats/cuisines',
  handler: withAuth(async (request, context, auth) => {
    if (!auth.workspaceId) {
      return errorResponse(400, 'Workspace ID is required', auth.correlationId);
    }

    const scope = request.query.get('scope') || 'tried';
    const countBy = request.query.get('countBy') || 'restaurants';

    let rows;
    let totalCount = 0;

    if (countBy === 'restaurants') {
      if (scope === 'tried') {
        // Restaurants with at least one tried item (per-user state)
        rows = await sql`
          SELECT r.cuisine, COUNT(DISTINCT r.id) as count
          FROM restaurants r
          INNER JOIN menu_items mi ON r.id = mi.restaurant_id
          INNER JOIN user_menu_item_state us ON mi.id = us.menu_item_id AND us.user_id = ${auth.user.id}
          WHERE r.workspace_id = ${auth.workspaceId} AND us.tried = true
          GROUP BY r.cuisine
          ORDER BY count DESC
        `;
      } else {
        // All restaurants
        rows = await sql`
          SELECT cuisine, COUNT(*) as count
          FROM restaurants
          WHERE workspace_id = ${auth.workspaceId}
          GROUP BY cuisine
          ORDER BY count DESC
        `;
      }
    } else {
      // Count by menu items
      if (scope === 'tried') {
        rows = await sql`
          SELECT r.cuisine, COUNT(mi.id) as count
          FROM menu_items mi
          INNER JOIN restaurants r ON mi.restaurant_id = r.id
          INNER JOIN user_menu_item_state us ON mi.id = us.menu_item_id AND us.user_id = ${auth.user.id}
          WHERE mi.workspace_id = ${auth.workspaceId} AND us.tried = true
          GROUP BY r.cuisine
          ORDER BY count DESC
        `;
      } else {
        rows = await sql`
          SELECT r.cuisine, COUNT(mi.id) as count
          FROM menu_items mi
          INNER JOIN restaurants r ON mi.restaurant_id = r.id
          WHERE mi.workspace_id = ${auth.workspaceId}
          GROUP BY r.cuisine
          ORDER BY count DESC
        `;
      }
    }

    // Calculate total and percentages
    totalCount = rows.reduce((sum, row) => sum + Number(row.count), 0);
    
    const statsRows = rows.map(row => ({
      cuisine: row.cuisine,
      count: Number(row.count),
      percent: totalCount > 0 ? (Number(row.count) / totalCount) * 100 : 0,
    }));

    return jsonResponse({ totalCount, rows: statsRows }, auth.correlationId);
  }, { requireWorkspace: true }),
});
