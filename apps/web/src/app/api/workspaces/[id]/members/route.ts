import { NextRequest } from "next/server";
import { listWorkspaceMembers, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.workspaces.members.list", async (correlationId) => {
    await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    const members = await listWorkspaceMembers(id);
    return jsonOk(request, "api.workspaces.members.list", { members });
  });
}
