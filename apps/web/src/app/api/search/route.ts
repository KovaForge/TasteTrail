import { NextRequest } from "next/server";
import { requireRequestContext, searchWorkspace } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "api.search", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, true);
    const query = request.nextUrl.searchParams.get("q") || "";
    if (!query.trim()) {
      return jsonOk(request, "api.search", { restaurants: [], menuItems: [] });
    }
    const tried = request.nextUrl.searchParams.get("tried");
    const minRating = request.nextUrl.searchParams.get("minRating");
    const result = await searchWorkspace(auth.user.id, auth.workspaceId!, {
      query,
      tried: tried === "true" ? true : tried === "false" ? false : undefined,
      minRating: minRating ? Number(minRating) : undefined,
    });
    return jsonOk(request, "api.search", result);
  });
}
