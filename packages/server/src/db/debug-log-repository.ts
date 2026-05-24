import type { DebugLogEntry, DebugSeverity } from "@tastetrail/shared";
import { query } from "./pool";
import { generateId } from "../utils/ids";
import { nowIso } from "../utils/time";

type InsertDebugLogInput = {
  routeName: string;
  userId?: string | null;
  workspaceId?: string | null;
  correlationId?: string | null;
  severity: DebugSeverity;
  message: string;
  details?: Record<string, unknown> | null;
};

export async function insertDebugLog(input: InsertDebugLogInput) {
  const id = generateId();
  const timestamp = nowIso();
  await query(
    `insert into debug_log_entries (
      id,
      timestamp,
      route_name,
      user_id,
      workspace_id,
      correlation_id,
      severity,
      message,
      details
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [
      id,
      timestamp,
      input.routeName,
      input.userId ?? null,
      input.workspaceId ?? null,
      input.correlationId ?? null,
      input.severity,
      input.message,
      input.details ? JSON.stringify(input.details) : null,
    ],
  );
  return { id, timestamp };
}

export async function listRecentDebugLogs(userId?: string | null, workspaceId?: string | null): Promise<DebugLogEntry[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (userId) {
    params.push(userId);
    clauses.push(`user_id = $${params.length}`);
  }
  if (workspaceId) {
    params.push(workspaceId);
    clauses.push(`workspace_id = $${params.length}`);
  }

  const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
  const result = await query<{
    id: string;
    timestamp: string;
    route_name: string;
    user_id: string | null;
    workspace_id: string | null;
    correlation_id: string | null;
    severity: DebugSeverity;
    message: string;
    details: Record<string, unknown> | null;
  }>(
    `select id, timestamp, route_name, user_id, workspace_id, correlation_id, severity, message, details
     from debug_log_entries
     ${where}
     order by timestamp desc
     limit 200`,
    params,
  );

  return result.rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    routeName: row.route_name,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    correlationId: row.correlation_id,
    severity: row.severity,
    message: row.message,
    details: row.details,
  }));
}
