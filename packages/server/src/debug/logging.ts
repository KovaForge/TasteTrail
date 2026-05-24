import type { NextRequest } from "next/server";
import { insertDebugLog } from "../db/debug-log-repository";

export async function logRouteEvent(
  request: NextRequest,
  input: {
    routeName: string;
    userId?: string | null;
    workspaceId?: string | null;
    correlationId?: string | null;
    severity: "info" | "warn" | "error";
    message: string;
    details?: Record<string, unknown> | null;
  },
) {
  try {
    await insertDebugLog({
      routeName: input.routeName,
      userId: input.userId ?? null,
      workspaceId: input.workspaceId ?? request.headers.get("x-workspace-id"),
      correlationId: input.correlationId ?? null,
      severity: input.severity,
      message: input.message,
      details: input.details ?? null,
    });
  } catch (error) {
    console.error("Failed to write debug log", error);
  }
}
