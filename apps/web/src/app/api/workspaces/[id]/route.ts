import { NextRequest } from "next/server";
import { deleteWorkspace, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.workspaces.delete", async (correlationId) => {
    const ctx = await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    await deleteWorkspace(ctx.user.id, id);
    return jsonOk(request, "api.workspaces.delete", { success: true });
  });
}
