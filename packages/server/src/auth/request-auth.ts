import type { NextRequest } from "next/server";
import type { AuthUser } from "@tastetrail/shared";
import { auth } from "./auth";
import { resolveCliToken } from "./cli-tokens";
import { query } from "../db/pool";
import { ApiRouteError } from "../utils/errors";

export interface RequestContext {
  user: AuthUser;
  workspaceId: string | null;
  correlationId: string;
}

export async function requireRequestContext(request: NextRequest, correlationId: string, requireWorkspace = false): Promise<RequestContext> {
  const workspaceId = request.headers.get("x-workspace-id") ?? request.nextUrl.searchParams.get("workspaceId");
  const authHeader = request.headers.get("authorization");

  let user: AuthUser | null = null;

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const tokenValue = authHeader.slice(7);
    user = await resolveCliToken(tokenValue);
  }

  if (!user) {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (session?.user) {
      user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? session.user.email.split("@")[0],
      };
    }
  }

  if (!user) {
    throw new ApiRouteError(401, "Authentication required");
  }

  if (requireWorkspace && !workspaceId) {
    throw new ApiRouteError(400, "Workspace ID is required");
  }

  if (workspaceId) {
    const membership = await query(
      `select role from workspace_members where user_id = $1 and workspace_id = $2 and pending = false limit 1`,
      [user.id, workspaceId],
    );
    if ((membership.rowCount ?? 0) === 0) {
      throw new ApiRouteError(403, "Access denied to this workspace");
    }
  }

  return {
    user,
    workspaceId: workspaceId ?? null,
    correlationId,
  };
}
