import { NextRequest } from "next/server";
import { createRestaurant, listRestaurants, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";
import type { RestaurantFormData } from "@tastetrail/shared";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "api.restaurants.list", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const restaurants = await listRestaurants(auth.user.id, auth.workspaceId);
    return jsonOk(request, "api.restaurants.list", { restaurants });
  });
}

export async function POST(request: NextRequest) {
  return withApiRoute(request, "api.restaurants.create", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, true);
    const body = (await request.json()) as RestaurantFormData;
    const restaurant = await createRestaurant(auth.workspaceId!, body);
    return jsonOk(request, "api.restaurants.create", restaurant, 201);
  });
}
