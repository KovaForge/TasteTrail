import { NextRequest } from "next/server";
import { getCuisineStats, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "api.stats.cuisines", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, true);
    const scope = (request.nextUrl.searchParams.get("scope") || "tried") as "tried" | "all";
    const countBy = (request.nextUrl.searchParams.get("countBy") || "restaurants") as "restaurants" | "items";
    const stats = await getCuisineStats(auth.user.id, auth.workspaceId!, scope, countBy);
    return jsonOk(request, "api.stats.cuisines", stats);
  });
}
