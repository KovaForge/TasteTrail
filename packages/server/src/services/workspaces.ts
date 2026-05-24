import type { Workspace, WorkspaceMember, WorkspaceRole } from "@tastetrail/shared";
import { query } from "../db/pool";
import { generateId } from "../utils/ids";
import { nowIso } from "../utils/time";
import { ApiRouteError, assert } from "../utils/errors";

export async function listUserWorkspaces(userId: string): Promise<Workspace[]> {
  const result = await query<{ id: string; name: string; created_at: string }>(
    `select w.id, w.name, w.created_at
     from workspaces w
     inner join workspace_members wm on wm.workspace_id = w.id
     where wm.user_id = $1 and wm.pending = false
     order by w.created_at desc`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  }));
}

export async function createWorkspaceForUser(user: { id: string; email: string }, name: string): Promise<Workspace> {
  assert(name.trim(), 400, "Workspace name is required");
  const id = generateId();
  const createdAt = nowIso();
  await query(`insert into workspaces (id, name, created_at) values ($1, $2, $3)`, [id, name.trim(), createdAt]);
  await query(
    `insert into workspace_members (user_id, workspace_id, role, email, pending, added_at, added_by_user_id)
     values ($1,$2,'Owner',$3,false,$4,$1)`,
    [user.id, id, user.email.toLowerCase(), createdAt],
  );
  return { id, name: name.trim(), createdAt };
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const result = await query<{
    user_id: string;
    workspace_id: string;
    role: WorkspaceRole;
    email: string;
    pending: boolean;
    added_at: string;
    added_by_user_id: string;
  }>(
    `select user_id, workspace_id, role, email, pending, added_at, added_by_user_id
     from workspace_members
     where workspace_id = $1
     order by added_at asc`,
    [workspaceId],
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    workspaceId: row.workspace_id,
    role: row.role,
    email: row.email,
    pending: row.pending,
    addedAt: row.added_at,
    addedByUserId: row.added_by_user_id,
  }));
}

export async function inviteWorkspaceMember(currentUserId: string, workspaceId: string, email: string, role: WorkspaceRole) {
  const membership = await query<{ role: WorkspaceRole }>(
    `select role from workspace_members where workspace_id = $1 and user_id = $2`,
    [workspaceId, currentUserId],
  );
  if (membership.rows[0]?.role !== "Owner") {
    throw new ApiRouteError(403, "Only owners can invite members");
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await query(`select 1 from workspace_members where workspace_id = $1 and email = $2 limit 1`, [workspaceId, normalizedEmail]);
  if ((existing.rowCount ?? 0) > 0) {
    throw new ApiRouteError(400, "User is already a member or has a pending invite");
  }
  const addedAt = nowIso();
  await query(
    `insert into workspace_members (user_id, workspace_id, role, email, pending, added_at, added_by_user_id)
     values ($1,$2,$3,$4,true,$5,$6)`,
    [generateId(), workspaceId, role, normalizedEmail, addedAt, currentUserId],
  );
  return { email: normalizedEmail, role, pending: true, addedAt };
}

export async function removeWorkspaceMember(currentUserId: string, workspaceId: string, targetUserId: string) {
  const membership = await query<{ role: WorkspaceRole }>(
    `select role from workspace_members where workspace_id = $1 and user_id = $2`,
    [workspaceId, currentUserId],
  );
  if (membership.rows[0]?.role !== "Owner") {
    throw new ApiRouteError(403, "Only owners can remove members");
  }
  if (currentUserId === targetUserId) {
    throw new ApiRouteError(400, "Cannot remove yourself as owner");
  }
  await query(`delete from workspace_members where workspace_id = $1 and user_id = $2`, [workspaceId, targetUserId]);
}
