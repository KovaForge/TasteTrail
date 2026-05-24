import { query } from "../db/pool";
import { coercePgBytes, decryptSecret, encryptSecret } from "../utils/encryption";
import { nowIso } from "../utils/time";
import { parseMenuWithProvider } from "../imports/ai-providers";

export async function getUserAiSettings(userId: string) {
  const result = await query<{
    provider: string;
    model: string;
    encrypted_api_key: unknown;
    nonce: unknown;
  }>(`select provider, model, encrypted_api_key, nonce from user_ai_settings where user_id = $1`, [userId]);

  const response = {
    hasOpenAi: false,
    hasGemini: false,
    openAiModel: "gpt-4o",
    geminiModel: "gemini-2.0-flash-exp",
    maskedOpenAiKey: undefined as string | undefined,
    maskedGeminiKey: undefined as string | undefined,
  };

  for (const row of result.rows) {
    const apiKey = decryptSecret(coercePgBytes(row.encrypted_api_key), coercePgBytes(row.nonce));
    const masked = `${apiKey.slice(0, 3)}...${apiKey.slice(-4)}`;
    if (row.provider === "openai") {
      response.hasOpenAi = true;
      response.openAiModel = row.model;
      response.maskedOpenAiKey = masked;
    } else if (row.provider === "gemini") {
      response.hasGemini = true;
      response.geminiModel = row.model;
      response.maskedGeminiKey = masked;
    }
  }

  return response;
}

export async function saveUserAiSettings(userId: string, workspaceId: string | null, provider: "openai" | "gemini", apiKey: string, model: string) {
  const encrypted = encryptSecret(apiKey.trim());
  const timestamp = nowIso();
  await query(
    `insert into user_ai_settings (user_id, workspace_id, provider, encrypted_api_key, nonce, model, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$7)
     on conflict (user_id, provider) do update set
       encrypted_api_key = excluded.encrypted_api_key,
       nonce = excluded.nonce,
       model = excluded.model,
       updated_at = excluded.updated_at`,
    [userId, workspaceId ?? "00000000-0000-0000-0000-000000000000", provider, encrypted.ciphertext, encrypted.nonce, model, timestamp],
  );
  return {
    provider,
    model,
    maskedKey: `${apiKey.slice(0, 3)}...${apiKey.slice(-4)}`,
  };
}

export async function deleteUserAiSettings(userId: string, provider?: "openai" | "gemini") {
  if (provider) {
    await query(`delete from user_ai_settings where user_id = $1 and provider = $2`, [userId, provider]);
  } else {
    await query(`delete from user_ai_settings where user_id = $1`, [userId]);
  }
}

export async function testUserAiConnection(userId: string, provider?: "openai" | "gemini") {
  const result = provider
    ? await query<{
        provider: string;
        model: string;
        encrypted_api_key: unknown;
        nonce: unknown;
      }>(`select provider, model, encrypted_api_key, nonce from user_ai_settings where user_id = $1 and provider = $2 limit 1`, [userId, provider])
    : await query<{
        provider: string;
        model: string;
        encrypted_api_key: unknown;
        nonce: unknown;
      }>(`select provider, model, encrypted_api_key, nonce from user_ai_settings where user_id = $1 limit 1`, [userId]);

  if ((result.rowCount ?? 0) === 0) {
    throw new Error("AI settings not configured for this provider");
  }
  const row = result.rows[0];
  const apiKey = decryptSecret(coercePgBytes(row.encrypted_api_key), coercePgBytes(row.nonce));

  if (row.provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return {
      success: response.ok,
      message: response.ok ? "Connection successful" : `Authentication failed (${response.status})`,
      model: row.model,
    };
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${row.model}?key=${apiKey}`);
  return {
    success: response.ok,
    message: response.ok ? "Connection successful" : `Authentication failed (${response.status})`,
    model: row.model,
  };
}

export async function getProviderCredentials(userId: string, selectedProvider?: string) {
  const result = selectedProvider
    ? await query<{
        provider: string;
        model: string;
        encrypted_api_key: unknown;
        nonce: unknown;
      }>(`select provider, model, encrypted_api_key, nonce from user_ai_settings where user_id = $1 and provider = $2 limit 1`, [userId, selectedProvider])
    : await query<{
        provider: string;
        model: string;
        encrypted_api_key: unknown;
        nonce: unknown;
      }>(`select provider, model, encrypted_api_key, nonce from user_ai_settings where user_id = $1 order by updated_at desc limit 1`, [userId]);
  if ((result.rowCount ?? 0) === 0) {
    return null;
  }
  const row = result.rows[0];
  return {
    provider: row.provider,
    model: row.model,
    apiKey: decryptSecret(coercePgBytes(row.encrypted_api_key), coercePgBytes(row.nonce)),
  };
}
