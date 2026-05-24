import { NextRequest } from "next/server";
import { createMenuItem, listMenuItems, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";
import type { MenuItemFormData } from "@tastetrail/shared";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.menu-items.list", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    const items = await listMenuItems(auth.user.id, id);
    return jsonOk(request, "api.menu-items.list", { items });
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.menu-items.create", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    const body = (await request.json()) as MenuItemFormData;
    const item = await createMenuItem(auth.user.id, id, body);
    return jsonOk(request, "api.menu-items.create", item, 201);
  });
}
