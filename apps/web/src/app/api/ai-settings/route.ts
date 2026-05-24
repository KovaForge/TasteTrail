import { NextRequest } from "next/server";
import { deleteUserAiSettings, getUserAiSettings, requireRequestContext, saveUserAiSettings } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "api.ai-settings.get", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const settings = await getUserAiSettings(auth.user.id);
    return jsonOk(request, "api.ai-settings.get", settings);
  });
}

export async function POST(request: NextRequest) {
  return withApiRoute(request, "api.ai-settings.save", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const body = (await request.json()) as { provider: "openai" | "gemini"; apiKey: string; model: string };
    const saved = await saveUserAiSettings(auth.user.id, auth.workspaceId, body.provider, body.apiKey, body.model);
    return jsonOk(request, "api.ai-settings.save", saved, 201);
  });
}

export async function DELETE(request: NextRequest) {
  return withApiRoute(request, "api.ai-settings.delete", async (correlationId) => {
    const auth = await requireRequestContext(request, correlationId, false);
    const provider = request.nextUrl.searchParams.get("provider") as "openai" | "gemini" | null;
    await deleteUserAiSettings(auth.user.id, provider ?? undefined);
    return jsonOk(request, "api.ai-settings.delete", { success: true });
  });
}
