import { NextRequest } from "next/server";
import { deleteRestaurant, getRestaurant, requireRequestContext, updateRestaurant } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";
import type { RestaurantFormData } from "@tastetrail/shared";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.restaurants.get", async (correlationId) => {
    await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    const restaurant = await getRestaurant(id);
    return jsonOk(request, "api.restaurants.get", restaurant);
  });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.restaurants.update", async (correlationId) => {
    await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    const body = (await request.json()) as Partial<RestaurantFormData & { lastVisitedDate?: string | null }>;
    const restaurant = await updateRestaurant(id, body);
    return jsonOk(request, "api.restaurants.update", restaurant);
  });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.restaurants.delete", async (correlationId) => {
    await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    await deleteRestaurant(id);
    return jsonOk(request, "api.restaurants.delete", { success: true });
  });
}
