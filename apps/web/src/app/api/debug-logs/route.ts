import { NextRequest } from "next/server";
import { listRecentDebugLogs, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "api.debug-logs.list", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const logs = await listRecentDebugLogs(auth.user.id, auth.workspaceId);
    return jsonOk(request, "api.debug-logs.list", { logs });
  });
}
