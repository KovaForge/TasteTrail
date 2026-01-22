import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { sql, generateId, now } from '../db';
import { withAuth, jsonResponse, errorResponse, AuthenticatedRequest } from '../middleware/auth';

// GET /api/workspaces - Get user's workspaces
app.http('getWorkspaces', {
  methods: ['GET'],
  route: 'workspaces',
  handler: withAuth(async (request, context, auth) => {
    const workspaces = await sql`
      SELECT w.id, w.name, w.created_at 
      FROM workspaces w
      INNER JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = ${auth.user.id} AND wm.pending = false
      ORDER BY w.created_at DESC
    `;
    
    return jsonResponse({ workspaces }, auth.correlationId);
  }),
});

// POST /api/workspaces - Create a new workspace
app.http('createWorkspace', {
  methods: ['POST'],
  route: 'workspaces',
  handler: withAuth(async (request, context, auth) => {
    const body = await request.json() as { name: string };
    
    if (!body.name?.trim()) {
      return errorResponse(400, 'Workspace name is required', auth.correlationId);
    }

    const id = generateId();
    const createdAt = now();

    // Create workspace
    await sql`
      INSERT INTO workspaces (id, name, created_at)
      VALUES (${id}, ${body.name.trim()}, ${createdAt})
    `;

    // Add user as owner
    await sql`
      INSERT INTO workspace_members (user_id, workspace_id, role, email, pending, added_at, added_by_user_id)
      VALUES (${auth.user.id}, ${id}, 'Owner', ${auth.user.email}, false, ${createdAt}, ${auth.user.id})
    `;

    return jsonResponse({ id, name: body.name.trim(), createdAt }, auth.correlationId, 201);
  }),
});

// GET /api/workspaces/{id}/members - Get workspace members
app.http('getWorkspaceMembers', {
  methods: ['GET'],
  route: 'workspaces/{id}/members',
  handler: withAuth(async (request, context, auth) => {
    const workspaceId = request.params.id;
    
    const members = await sql`
      SELECT user_id, workspace_id, role, email, pending, added_at, added_by_user_id
      FROM workspace_members
      WHERE workspace_id = ${workspaceId}
      ORDER BY added_at ASC
    `;
    
    return jsonResponse({ members }, auth.correlationId);
  }),
});

// POST /api/workspaces/{id}/invites - Invite a member
app.http('inviteMember', {
  methods: ['POST'],
  route: 'workspaces/{id}/invites',
  handler: withAuth(async (request, context, auth) => {
    const workspaceId = request.params.id;
    const body = await request.json() as { email: string; role: string };

    // Verify user is owner
    const membership = await sql`
      SELECT role FROM workspace_members 
      WHERE workspace_id = ${workspaceId} AND user_id = ${auth.user.id}
    `;
    
    if (membership[0]?.role !== 'Owner') {
      return errorResponse(403, 'Only owners can invite members', auth.correlationId);
    }

    // Check if already a member
    const existing = await sql`
      SELECT email FROM workspace_members 
      WHERE workspace_id = ${workspaceId} AND email = ${body.email.toLowerCase()}
    `;
    
    if (existing.length > 0) {
      return errorResponse(400, 'User is already a member or has a pending invite', auth.correlationId);
    }

    const addedAt = now();
    
    await sql`
      INSERT INTO workspace_members (user_id, workspace_id, role, email, pending, added_at, added_by_user_id)
      VALUES (${generateId()}, ${workspaceId}, ${body.role}, ${body.email.toLowerCase()}, true, ${addedAt}, ${auth.user.id})
    `;

    return jsonResponse({ 
      email: body.email.toLowerCase(), 
      role: body.role, 
      pending: true, 
      addedAt 
    }, auth.correlationId, 201);
  }),
});

// DELETE /api/workspaces/{id}/members/{userId} - Remove a member
app.http('removeMember', {
  methods: ['DELETE'],
  route: 'workspaces/{id}/members/{userId}',
  handler: withAuth(async (request, context, auth) => {
    const workspaceId = request.params.id;
    const targetUserId = request.params.userId;

    // Verify user is owner
    const membership = await sql`
      SELECT role FROM workspace_members 
      WHERE workspace_id = ${workspaceId} AND user_id = ${auth.user.id}
    `;
    
    if (membership[0]?.role !== 'Owner') {
      return errorResponse(403, 'Only owners can remove members', auth.correlationId);
    }

    // Can't remove yourself if you're the owner
    if (targetUserId === auth.user.id) {
      return errorResponse(400, 'Cannot remove yourself as owner', auth.correlationId);
    }

    await sql`
      DELETE FROM workspace_members 
      WHERE workspace_id = ${workspaceId} AND user_id = ${targetUserId}
    `;

    return jsonResponse({ success: true }, auth.correlationId);
  }),
});
