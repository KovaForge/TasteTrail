import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sql, generateId, now } from '../db';
import { authTokenService } from '../infrastructure/authTokenService';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest {
  user: AuthUser;
  workspaceId: string | null;
  correlationId: string;
}

// ─── Device code config ────────────────────────────────────────────────────────

interface DeviceCodeConfig {
  clientId: string;
  tenantId: string;
  scopes: string;
}

function getDeviceCodeConfig(): DeviceCodeConfig | null {
  const clientId = process.env.MICROSOFT_AUTH_CLIENT_ID;
  if (!clientId) return null;

  return {
    clientId,
    tenantId: process.env.MICROSOFT_AUTH_TENANT_ID || 'common',
    scopes: process.env.MICROSOFT_AUTH_DEVICE_CODE_SCOPES || 'openid profile email',
  };
}

// ─── Token validation ──────────────────────────────────────────────────────────

interface MicrosoftTokenClaims {
  email: string;
  displayName: string;
  sub: string;
  tenantId: string;
}

/**
 * Validate a Microsoft ID token against OIDC discovery + JWKS.
 * Falls back to mock validation in development.
 */
async function validateMicrosoftIdToken(idToken: string): Promise<MicrosoftTokenClaims | null> {
  if (process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development') {
    // Mock validation for local dev — parse without signature check
    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
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
    const metadata = await metadataRes.json() as { jwks_uri: string; issuer: string };

    // Fetch signing keys
    const jwksRes = await fetch(metadata.jwks_uri);
    if (!jwksRes.ok) return null;
    const jwks = await jwksRes.json() as { keys: { kid: string; x5c?: string[]; n?: string; e?: string }[] };

    // Find matching key
    const key = jwks.keys.find((k) => k.kid === kid);
    if (!key) return null;

    // Build RSA public key
    const publicKey = await buildRSAPublicKey(key);
    if (!publicKey) return null;

    // Verify signature (RS256: base64url(header).base64url(payload) signed with RS256)
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

    // Parse payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));

    // Validate standard claims
    if (!payload.email && !payload.preferred_username) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.iat && payload.exp && (payload.iat > now + 300 || payload.exp < now - 300)) return null;

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

// ─── User management (get or create) ──────────────────────────────────────────

async function getOrCreateUser(email: string, displayName: string): Promise<{ id: string }> {
  // Try find via workspace_members
  const existing = await sql`
    SELECT DISTINCT user_id FROM workspace_members WHERE LOWER(email) = LOWER(${email})
  `;

  if (existing.length > 0) {
    return { id: existing[0].user_id };
  }

  // Create user entry via workspace_members with a new user_id
  // TasteTrail uses email as the user_id equivalent — generate a UUID
  const userId = generateId();
  const workspaceId = generateId();
  const createdAt = now();

  // Create a default workspace for the new user
  await sql`
    INSERT INTO workspaces (id, name, created_at)
    VALUES (${workspaceId}, ${displayName || email.split('@')[0]}'s Workspace', ${createdAt})
  `;

  await sql`
    INSERT INTO workspace_members (user_id, workspace_id, role, email, pending, added_at, added_by_user_id)
    VALUES (${userId}, ${workspaceId}, 'Owner', LOWER(${email}), false, ${createdAt}, ${userId})
  `;

  return { id: userId };
}

// ─── Auth middleware enhancement ──────────────────────────────────────────────

/**
 * Extract user from Azure SWA authentication OR from Bearer token
 */
export async function getAuthUser(request: HttpRequest): Promise<AuthUser | null> {
  // Try Bearer token first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7);
    const validated = authTokenService.tryValidate(token);
    if (validated) {
      return {
        id: validated.userId,
        email: validated.email,
        name: validated.email.split('@')[0],
      };
    }
  }

  // Azure SWA provides user info in x-ms-client-principal header
  const principalHeader = request.headers.get('x-ms-client-principal');
  if (!principalHeader) {
    return getMockUser();
  }

  try {
    const decoded = Buffer.from(principalHeader, 'base64').toString('utf-8');
    const principal = JSON.parse(decoded);
    return {
      id: principal.userId,
      email: principal.userDetails,
      name: principal.userDetails.split('@')[0],
    };
  } catch {
    return null;
  }
}

/**
 * Helper to check for local dev mock user
 */
function getMockUser(): AuthUser | null {
  if (process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development') {
    return {
      id: 'local-dev-user',
      email: 'local@dev.com',
      name: 'Local Developer',
    };
  }
  return null;
}

// ─── Correlation ID ───────────────────────────────────────────────────────────

export function getCorrelationId(request: HttpRequest): string {
  return (
    request.headers.get('x-correlation-id') ||
    `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`
  );
}

// ─── Workspace membership ─────────────────────────────────────────────────────

export async function validateWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<{ valid: boolean; role: string | null }> {
  const result = await sql`
    SELECT role FROM workspace_members
    WHERE user_id = ${userId} AND workspace_id = ${workspaceId} AND pending = false
  `;

  if (result.length === 0) {
    return { valid: false, role: null };
  }

  return { valid: true, role: result[0]?.role ?? null };
}

// ─── Response helpers ──────────────────────────────────────────────────────────

export function errorResponse(
  status: number,
  message: string,
  correlationId: string,
  details?: Record<string, unknown>
): HttpResponseInit {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify({
      error: true,
      message,
      correlationId,
      ...(details && { details }),
    }),
  };
}

export function jsonResponse<T>(data: T, correlationId: string, status = 200): HttpResponseInit {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify(data),
  };
}

// ─── Auth middleware wrapper ───────────────────────────────────────────────────

export function withAuth(
  handler: (
    request: HttpRequest,
    context: InvocationContext,
    auth: AuthenticatedRequest
  ) => Promise<HttpResponseInit>,
  options: { requireWorkspace?: boolean } = {}
) {
  return async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const correlationId = getCorrelationId(request);

    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return errorResponse(401, 'Authentication required', correlationId);
    }

    // Get workspace ID from header or query
    let workspaceId = request.headers.get('x-workspace-id') || request.query.get('workspaceId');

    // Handle special 'global' workspace ID
    if (workspaceId === 'global') {
      workspaceId = null;
    }

    if (options.requireWorkspace && !workspaceId) {
      return errorResponse(400, 'Workspace ID is required', correlationId);
    }

    if (workspaceId) {
      const { valid } = await validateWorkspaceMembership(user.id, workspaceId);
      if (!valid) {
        return errorResponse(403, 'Access denied to this workspace', correlationId);
      }
    }

    try {
      return await handler(request, context, { user, workspaceId, correlationId });
    } catch (error) {
      context.error('Handler error:', error);
      return errorResponse(
        500,
        error instanceof Error ? error.message : 'Internal server error',
        correlationId,
        process.env.NODE_ENV === 'development' && error instanceof Error
          ? { stack: error.stack }
          : undefined
      );
    }
  };
}

// ─── Base64url decode (shared with auth.ts functions) ─────────────────────────

export function base64UrlDecode(value: string): Buffer {
  let padded = value.replace(/-/g, '+').replace(/_/g, '/');
  switch (padded.length % 4) {
    case 2: padded += '=='; break;
    case 3: padded += '='; break;
  }
  return Buffer.from(padded, 'base64');
}

// ─── RSA public key builder from JWK ─────────────────────────────────────────

async function buildRSAPublicKey(jwk: { x5c?: string[]; n?: string; e?: string }): Promise<CryptoKey | null> {
  try {
    if (jwk.x5c && jwk.x5c.length > 0) {
      // Use X.509 cert chain — first element is the leaf cert
      const der = Buffer.from(jwk.x5c[0], 'base64');
      return await crypto.subtle.importKey(
        'spki',
        der,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
    }
    if (jwk.n && jwk.e) {
      // Use JWK RSA components
      return await crypto.subtle.importKey(
        'jwk',
        {
          kty: 'RSA',
          n: jwk.n,
          e: jwk.e,
          alg: 'RS256',
          use: 'sig',
        },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
    }
    return null;
  } catch {
    return null;
  }
}