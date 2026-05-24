import crypto from "node:crypto";
import type { CliTokenInfo } from "@tastetrail/shared";
import { query } from "../db/pool";
import { generateId } from "../utils/ids";
import { nowIso } from "../utils/time";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createCliToken(userId: string, label: string) {
  const id = generateId();
  const rawToken = `tt_pat_${crypto.randomBytes(24).toString("base64url")}`;
  const tokenHash = hashToken(rawToken);
  const createdAt = nowIso();
  await query(
    `insert into user_cli_tokens (id, user_id, label, token_hash, created_at)
     values ($1,$2,$3,$4,$5)`,
    [id, userId, label, tokenHash, createdAt],
  );
  return {
    token: rawToken,
    info: {
      id,
      label,
      createdAt,
      lastUsedAt: null,
      expiresAt: null,
    } satisfies CliTokenInfo,
  };
}

export async function listCliTokens(userId: string): Promise<CliTokenInfo[]> {
  const result = await query<{
    id: string;
    label: string;
    created_at: string;
    last_used_at: string | null;
    expires_at: string | null;
  }>(
    `select id, label, created_at, last_used_at, expires_at
     from user_cli_tokens
     where user_id = $1 and revoked_at is null
     order by created_at desc`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
  }));
}

export async function revokeCliToken(userId: string, tokenId: string) {
  await query(
    `update user_cli_tokens
     set revoked_at = $3
     where id = $1 and user_id = $2`,
    [tokenId, userId, nowIso()],
  );
}

export async function resolveCliToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const result = await query<{
    user_id: string;
    email: string;
    name: string | null;
  }>(
    `update user_cli_tokens tokens
     set last_used_at = $2
     from "user" users
     where tokens.token_hash = $1
       and tokens.user_id = users.id
       and tokens.revoked_at is null
       and (tokens.expires_at is null or tokens.expires_at > now())
     returning tokens.user_id, users.email, users.name`,
    [tokenHash, nowIso()],
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.user_id,
    email: row.email,
    name: row.name ?? row.email.split("@")[0],
  };
}
