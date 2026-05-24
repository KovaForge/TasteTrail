import { NextRequest } from "next/server";
import { addTriedHistory, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.menu-items.try", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const { id } = await context.params;
    const body = (await request.json()) as { notes?: string };
    const history = await addTriedHistory(auth.user.id, id, body.notes);
    return jsonOk(request, "api.menu-items.try", { success: true, history });
  });
}
