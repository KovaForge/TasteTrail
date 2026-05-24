import { NextRequest } from "next/server";
import { commitImportDraft, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";
import type { ImportDraft } from "@tastetrail/shared";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiRoute(request, "api.imports.commit", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, true);
    const { id } = await context.params;
    const body = (await request.json()) as ImportDraft;
    const result = await commitImportDraft(auth.workspaceId!, auth.user.id, id, body);
    return jsonOk(request, "api.imports.commit", result);
  });
}
