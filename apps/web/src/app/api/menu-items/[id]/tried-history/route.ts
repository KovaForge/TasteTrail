import { NextRequest } from "next/server";
import { addTriedHistory, getTriedHistory, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.menu-items.history.list", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    const history = await getTriedHistory(auth.user.id, id);
    return jsonOk(request, "api.menu-items.history.list", { history });
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.menu-items.history.add", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    const body = (await request.json()) as { notes?: string };
    const history = await addTriedHistory(auth.user.id, id, body.notes);
    return jsonOk(request, "api.menu-items.history.add", history, 201);
  });
}
