import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authTokenService } from '../infrastructure/authTokenService';
import { jsonResponse, errorResponse, getCorrelationId } from '../middleware/auth';
import { validateMicrosoftIdToken, getOrCreateUser } from '../infrastructure/microsoftAuth';

// ─── GET /auth/microsoft/device-code/config ────────────────────────────────────

app.http('authMicrosoftDeviceCodeConfig', {
  methods: ['GET'],
  route: 'auth/microsoft/device-code/config',
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const clientId = process.env.MICROSOFT_AUTH_CLIENT_ID;
    if (!clientId) {
      return {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Microsoft CLI login is not configured' }),
      };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        tenantId: process.env.MICROSOFT_AUTH_TENANT_ID || 'common',
        scopes: process.env.MICROSOFT_AUTH_DEVICE_CODE_SCOPES || 'openid profile email',
      }),
    };
  },
});

// ─── POST /auth/microsoft/cli-token ──────────────────────────────────────────

app.http('authMicrosoftCliToken', {
  methods: ['POST'],
  route: 'auth/microsoft/cli-token',
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const correlationId = getCorrelationId(request);

    let body: { idToken?: string };
    try {
      body = await request.json() as { idToken?: string };
    } catch {
      return errorResponse(400, 'Invalid JSON payload', correlationId);
    }

    if (!body.idToken) {
      return errorResponse(400, 'Microsoft id token is required', correlationId);
    }

    const claims = await validateMicrosoftIdToken(body.idToken);
    if (!claims) {
      return errorResponse(401, 'Invalid Microsoft token', correlationId);
    }

    const { id: userId } = await getOrCreateUser(claims.email, claims.displayName);

    const authToken = authTokenService.issueToken(userId, claims.email, true);
    if (!authToken) {
      return errorResponse(500, 'Token issuance is not configured', correlationId);
    }

    return jsonResponse({
      userId,
      email: claims.email,
      displayName: claims.displayName,
      authToken,
      provider: 'microsoft',
    }, correlationId, 200);
  },
});

// ─── GET /auth/status ──────────────────────────────────────────────────────────

app.http('authStatus', {
  methods: ['GET'],
  route: 'auth/status',
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const correlationId = getCorrelationId(request);

    const authHeader = request.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7);
      const validated = authTokenService.tryValidate(token);
      if (validated) {
        return jsonResponse({
          authenticated: true,
          userId: validated.userId,
          email: validated.email,
          mfaSatisfied: validated.mfaSatisfied,
        }, correlationId);
      }
      return errorResponse(401, 'Invalid or expired token', correlationId);
    }

    const principalHeader = request.headers.get('x-ms-client-principal');
    if (principalHeader) {
      try {
        const decoded = Buffer.from(principalHeader, 'base64').toString('utf-8');
        const principal = JSON.parse(decoded);
        return jsonResponse({
          authenticated: true,
          userId: principal.userId,
          email: principal.userDetails,
          provider: 'azure-swa',
        }, correlationId);
      } catch {
        // fall through
      }
    }

    return jsonResponse({ authenticated: false }, correlationId);
  },
});

// ─── POST /auth/microsoft/device-code/token ────────────────────────────────────

/**
 * Device code token polling endpoint.
 * The CLI polls this with the device_code until the user completes auth in the browser.
 * We forward to Microsoft's token endpoint to check if the code has been redeemed.
 */
app.http('authMicrosoftDeviceCodeToken', {
  methods: ['POST'],
  route: 'auth/microsoft/device-code/token',
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const correlationId = getCorrelationId(request);

    const clientId = process.env.MICROSOFT_AUTH_CLIENT_ID;
    if (!clientId) {
      return errorResponse(503, 'Microsoft CLI login is not configured', correlationId);
    }

    let body: { deviceCode?: string; interval?: number };
    try {
      body = await request.json() as { deviceCode?: string; interval?: number };
    } catch {
      return errorResponse(400, 'Invalid JSON payload', correlationId);
    }

    if (!body.deviceCode) {
      return errorResponse(400, 'device_code is required', correlationId);
    }

    const tenant = process.env.MICROSOFT_AUTH_TENANT_ID || 'common';
    const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

    const scopes = process.env.MICROSOFT_AUTH_DEVICE_CODE_SCOPES || 'openid profile email';

    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: clientId,
      device_code: body.deviceCode,
    });
    for (const scope of scopes.split(' ')) {
      params.append('scope', scope);
    }

    try {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const data = await res.json() as {
        access_token?: string;
        id_token?: string;
        error?: string;
        error_description?: string;
      };

      if (data.error) {
        if (data.error === 'authorization_pending') {
          return jsonResponse({ pending: true, interval: body.interval || 5 }, correlationId, 200);
        }
        if (data.error === 'slow_down') {
          return jsonResponse({ pending: true, interval: (body.interval || 5) + 5 }, correlationId, 200);
        }
        return errorResponse(400, data.error_description || data.error, correlationId);
      }

      if (!data.id_token) {
        return errorResponse(500, 'No id_token received from Microsoft', correlationId);
      }

      const claims = await validateMicrosoftIdToken(data.id_token);
      if (!claims) {
        return errorResponse(401, 'Invalid Microsoft token from device code exchange', correlationId);
      }

      const { id: userId } = await getOrCreateUser(claims.email, claims.displayName);
      const authToken = authTokenService.issueToken(userId, claims.email, true);
      if (!authToken) {
        return errorResponse(500, 'Token issuance is not configured', correlationId);
      }

      return jsonResponse({
        userId,
        email: claims.email,
        displayName: claims.displayName,
        authToken,
        provider: 'microsoft',
      }, correlationId, 200);
    } catch (err) {
      context.error('Device code token exchange failed:', err);
      return errorResponse(502, 'Failed to contact Microsoft', correlationId);
    }
  },
});