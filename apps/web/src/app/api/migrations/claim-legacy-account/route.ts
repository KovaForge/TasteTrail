import { NextRequest } from "next/server";
import { claimLegacyMicrosoftData, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function POST(request: NextRequest) {
  return withApiRoute(request, "api.migrations.claim-legacy-account", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const result = await claimLegacyMicrosoftData(auth.user.id, auth.user.email);
    return jsonOk(request, "api.migrations.claim-legacy-account", result);
  });
}
