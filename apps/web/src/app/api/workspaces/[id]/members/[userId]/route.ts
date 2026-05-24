import { NextRequest } from "next/server";
import { removeWorkspaceMember, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  return withApiRoute(request, "api.workspaces.members.remove", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const { id, userId } = await context.params;
    await removeWorkspaceMember(auth.user.id, id, userId);
    return jsonOk(request, "api.workspaces.members.remove", { success: true });
  });
}
