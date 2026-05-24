import { NextRequest } from "next/server";
import { inviteWorkspaceMember, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";
import type { WorkspaceRole } from "@tastetrail/shared";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.workspaces.invites.create", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    const body = (await request.json()) as { email: string; role: WorkspaceRole };
    const invite = await inviteWorkspaceMember(auth.user.id, id, body.email, body.role);
    return jsonOk(request, "api.workspaces.invites.create", invite, 201);
  });
}
