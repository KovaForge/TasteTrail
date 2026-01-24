import { app } from '@azure/functions';
import { sql, generateId, now } from '../db';
import { withAuth, jsonResponse, errorResponse } from '../middleware/auth';

// POST /api/restaurants/{id}/share - Generate specific share token
app.http('createShareLink', {
  methods: ['POST'],
  route: 'restaurants/{id}/share',
  handler: withAuth(async (request, context, auth) => {
    const restaurantId = request.params.id;

    // Check ownership/permissions
    const existing = await sql`
        SELECT workspace_id, name FROM restaurants WHERE id = ${restaurantId}
    `;

    if (existing.length === 0) {
        return errorResponse(404, 'Restaurant not found', auth.correlationId);
    }

    const { workspace_id, name } = existing[0];

    // Verify membership in workspace (Owner/Editor only?)
    const membership = await sql`
        SELECT role FROM workspace_members 
        WHERE user_id = ${auth.user.id} AND workspace_id = ${workspace_id}
    `;

    if (membership.length === 0) {
        return errorResponse(403, 'No access to restaurant', auth.correlationId);
    }
    
    // Create or retrieve existing active token
    // For simplicity, let's create a new one or return existing valid one
    const existingToken = await sql`
        SELECT id FROM share_tokens 
        WHERE restaurant_id = ${restaurantId} AND created_by = ${auth.user.id}
    `;

    let tokenId;
    if (existingToken.length > 0) {
        tokenId = existingToken[0].id;
    } else {
        tokenId = generateId();
        await sql`
            INSERT INTO share_tokens (id, restaurant_id, created_by, created_at)
            VALUES (${tokenId}, ${restaurantId}, ${auth.user.id}, ${now()})
        `;
    }

    return jsonResponse({
        token: tokenId,
        restaurantName: name
    }, auth.correlationId);

  }, { requireWorkspace: false }), // Can share from anywhere
});

// POST /api/shares/claim - Claim a share token
app.http('claimShare', {
  methods: ['POST'],
  route: 'shares/claim',
  handler: withAuth(async (request, context, auth) => {
    const body = await request.json() as { token: string };

    if (!body.token) {
        return errorResponse(400, 'Token is required', auth.correlationId);
    }

    // Validate token
    const tokenInfo = await sql`
        SELECT st.id, st.restaurant_id, r.name, r.cuisine, st.created_by
        FROM share_tokens st
        JOIN restaurants r ON st.restaurant_id = r.id
        WHERE st.id = ${body.token}
    `;

    if (tokenInfo.length === 0) {
        return errorResponse(404, 'Invalid or expired token', auth.correlationId);
    }

    const info = tokenInfo[0];
    const restaurantId = info.restaurant_id;

    // Don't allow sharing with self (optional check, but good for cleanliness)
    if (info.created_by === auth.user.id) {
         // Return success anyway, just redirect
         return jsonResponse({ 
            restaurantId, 
            name: info.name, 
            message: 'You already own this restaurant' 
         }, auth.correlationId);
    }

    // Add to shared_restaurants
    // Use upsert to be safe
    await sql`
        INSERT INTO shared_restaurants (restaurant_id, user_id, shared_by, shared_at)
        VALUES (${restaurantId}, ${auth.user.id}, ${info.created_by}, ${now()})
        ON CONFLICT (restaurant_id, user_id) DO UPDATE SET shared_at = ${now()}
    `;

    return jsonResponse({
        success: true,
        restaurantId,
        name: info.name,
        cuisine: info.cuisine
    }, auth.correlationId);
  }, { requireWorkspace: false }),
});
