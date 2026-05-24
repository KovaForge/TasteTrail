import { NextRequest } from "next/server";
import { createCliToken, listCliTokens, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "api.cli-tokens.list", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const tokens = await listCliTokens(auth.user.id);
    return jsonOk(request, "api.cli-tokens.list", { tokens });
  });
}

export async function POST(request: NextRequest) {
  return withApiRoute(request, "api.cli-tokens.create", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const body = (await request.json()) as { label: string };
    const created = await createCliToken(auth.user.id, body.label?.trim() || "OpenClaw");
    return jsonOk(request, "api.cli-tokens.create", created, 201);
  });
}
