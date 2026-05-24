import { NextRequest } from "next/server";
import { deleteMenuItem, getMenuItem, requireRequestContext, updateMenuItem } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";
import type { MenuItemFormData } from "@tastetrail/shared";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.menu-items.get", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    const item = await getMenuItem(auth.user.id, id);
    return jsonOk(request, "api.menu-items.get", item);
  });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.menu-items.update", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    const body = (await request.json()) as Partial<MenuItemFormData & { lastTriedDate?: string | null }>;
    const item = await updateMenuItem(auth.user.id, id, body);
    return jsonOk(request, "api.menu-items.update", item);
  });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.menu-items.delete", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    await deleteMenuItem(auth.user.id, id);
    return jsonOk(request, "api.menu-items.delete", { success: true });
  });
}
