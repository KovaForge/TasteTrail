import { NextRequest } from "next/server";
import { parseImportDraft, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";
import type { ImportSourceType } from "@tastetrail/shared";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "api.imports.parse", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, true);
    const body = (await request.json()) as {
      sourceType: ImportSourceType;
      sourceValue: string;
      restaurantHint?: string;
      provider?: string;
    };
    const parsed = await parseImportDraft(auth.user.id, auth.workspaceId!, body);
    return jsonOk(request, "api.imports.parse", parsed);
  });
}
