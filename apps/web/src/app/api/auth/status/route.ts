import { NextRequest } from "next/server";
import { requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "api.auth.status", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    return jsonOk(request, "api.auth.status", {
      authenticated: true,
      user: auth.user,
      workspaceId: auth.workspaceId,
    });
  });
}
