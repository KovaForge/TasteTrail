import { NextRequest } from "next/server";
import { createWorkspaceForUser, listUserWorkspaces, requireRequestContext } from "@tastetrail/server";
import { jsonOk, withApiRoute } from "@/lib/http";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "api.workspaces.list", async (correlationId) => {
    const context = await requireRequestContext(request, correlationId, false);
    const workspaces = await listUserWorkspaces(context.user.id);
    return jsonOk(request, "api.workspaces.list", { workspaces });
  });
}

export async function POST(request: NextRequest) {
  return withApiRoute(request, "api.workspaces.create", async (correlationId) => {
    const context = await requireRequestContext(request, correlationId, false);
    const body = (await request.json()) as { name: string };
    const workspace = await createWorkspaceForUser(context.user, body.name);
    return jsonOk(request, "api.workspaces.create", workspace, 201);
  });
}
