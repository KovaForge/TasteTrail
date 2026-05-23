import { sql, generateId, now } from '../db';
import { authTokenService } from './authTokenService';

export interface MicrosoftTokenClaims {
  email: string;
  displayName: string;
  sub: string;
  tenantId: string;
}

// ─── Microsoft OIDC token validation ─────────────────────────────────────────

function base64UrlDecode(value: string): Buffer {
  let padded = value.replace(/-/g, '+').replace(/_/g, '/');
  switch (padded.length % 4) {
    case 2: padded += '=='; break;
    case 3: padded += '='; break;
  }
  return Buffer.from(padded, 'base64');
}

export async function validateMicrosoftIdToken(idToken: string): Promise<MicrosoftTokenClaims | null> {
  if (process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development') {
    // Mock validation for local dev — parse JWT payload without signature check
    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
      );
      return {
        email: payload.email || payload.preferred_username || 'dev@example.com',
        displayName: payload.name || 'Dev User',
        sub: payload.sub || 'dev-user-001',
        tenantId: payload.tid || 'common',
      };
    } catch {
      return null;
    }
  }

  try {
    // Parse header to get kid
    const header = JSON.parse(Buffer.from(idToken.split('.')[0], 'base64').toString('utf8'));
    const { kid, alg } = header;
    if (!kid || alg !== 'RS256') return null;

    // Fetch OIDC metadata
    const tenant = process.env.MICROSOFT_AUTH_TENANT_ID || 'common';
    const metadataUrl = `https://login.microsoftonline.com/${tenant}/v2.0/.well-known/openid-configuration`;
    const metadataRes = await fetch(metadataUrl);
    if (!metadataRes.ok) return null;
    const metadata = (await metadataRes.json()) as { jwks_uri: string };

    // Fetch signing keys
    const jwksRes = await fetch(metadata.jwks_uri);
    if (!jwksRes.ok) return null;
    const jwks = (await jwksRes.json()) as { keys: { kid: string; x5c?: string[] }[] };

    // Find matching key
    const key = jwks.keys.find((k) => k.kid === kid);
    if (!key || !key.x5c || key.x5c.length === 0) return null;

    // Build RSA public key from X.509 cert
    const der = Buffer.from(key.x5c[0], 'base64');
    const publicKey = await crypto.subtle.importKey(
      'spki',
      der,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Verify signature
    const parts = idToken.split('.');
    const signingInput = `${parts[0]}.${parts[1]}`;
    const signature = base64UrlDecode(parts[2]);

    const verified = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      publicKey,
      signature,
      new TextEncoder().encode(signingInput)
    );
    if (!verified) return null;

    // Parse and validate payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    if (!payload.email && !payload.preferred_username) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.iat && payload.exp) {
      if (payload.iat > nowSec + 300 || payload.exp < nowSec - 300) return null;
    }

    return {
      email: payload.email || payload.preferred_username,
      displayName: payload.name || payload.display_name || payload.email,
      sub: payload.sub,
      tenantId: payload.tid || tenant,
    };
  } catch {
    return null;
  }
}

// ─── User management ───────────────────────────────────────────────────────────

export async function getOrCreateUser(email: string, displayName: string): Promise<{ id: string }> {
  // Try to find existing user via workspace_members
  const existing = await sql`
    SELECT DISTINCT user_id FROM workspace_members
    WHERE LOWER(email) = LOWER(${email})
  `;

  if (existing.length > 0) {
    return { id: existing[0].user_id };
  }

  // Create user and default workspace on first login
  const userId = generateId();
  const workspaceId = generateId();
  const createdAt = now();

  const defaultName = displayName || email.split('@')[0];

  await sql`
    INSERT INTO workspaces (id, name, created_at)
    VALUES (${workspaceId}, ${defaultName + "'s Workspace"}, ${createdAt})
  `;

  await sql`
    INSERT INTO workspace_members (user_id, workspace_id, role, email, pending, added_at, added_by_user_id)
    VALUES (${userId}, ${workspaceId}, 'Owner', LOWER(${email}), false, ${createdAt}, ${userId})
  `;

  return { id: userId };
}