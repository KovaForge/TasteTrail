import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { sql, now } from '../db';
import { withAuth, jsonResponse, errorResponse } from '../middleware/auth';
import { encrypt, decrypt, toBuffer } from '../utils/encryption';
import { createProvider } from '../services/aiProviders';

// GET /api/ai-settings - Get user's AI settings (masked)
app.http('getAISettings', {
  methods: ['GET'],
  route: 'ai-settings',
  handler: withAuth(async (request, context, auth) => {
    const settings = await sql`
      SELECT provider, model, encrypted_api_key, nonce
      FROM user_ai_settings
      WHERE user_id = ${auth.user.id}
    `;

    if (settings.length === 0) {
      return jsonResponse({
        hasKey: false,
      }, auth.correlationId);
    }

    const setting = settings[0];
    
    try {
        const encryptedBuffer = toBuffer(setting.encrypted_api_key);
        const nonceBuffer = toBuffer(setting.nonce);
        
        console.log(`[getAISettings] Buffers: cipher=${encryptedBuffer.length}B, nonce=${nonceBuffer.length}B`);

        // Decrypt key to get last 4 characters for masking
        const apiKey = decrypt(encryptedBuffer, nonceBuffer);
        const maskedKey = apiKey.length > 4 
          ? `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 4)}`
          : '***';

        return jsonResponse({
          provider: setting.provider,
          model: setting.model,
          hasKey: true,
          maskedKey,
        }, auth.correlationId);
    } catch (error) {
        console.error('[Encryption Error in getAISettings]', error);
        return jsonResponse({
            hasKey: false,
            provider: setting.provider,
            model: setting.model,
            error: `Decryption failed: ${error instanceof Error ? error.message : String(error)}`
        }, auth.correlationId);
    }
  }),
});

// POST /api/ai-settings - Save/update user's AI settings
app.http('saveAISettings', {
  methods: ['POST'],
  route: 'ai-settings',
  handler: withAuth(async (request, context, auth) => {
    const body = await request.json() as {
      provider: 'openai' | 'gemini';
      apiKey: string;
      model: string;
    };

    if (!body.provider || !body.apiKey || !body.model) {
      return errorResponse(400, 'Provider, API key, and model are required', auth.correlationId);
    }

    if (!['openai', 'gemini'].includes(body.provider)) {
      return errorResponse(400, 'Invalid provider. Must be "openai" or "gemini"', auth.correlationId);
    }

    if (!body.apiKey.trim()) {
      return errorResponse(400, 'API key cannot be empty', auth.correlationId);
    }

    // Encrypt the API key
    const { ciphertext, nonce } = encrypt(body.apiKey.trim());
    const timestamp = now();

    // Upsert settings
    const existing = await sql`
      SELECT user_id FROM user_ai_settings WHERE user_id = ${auth.user.id}
    `;

    if (existing.length > 0) {
      // Update
      await sql`
        UPDATE user_ai_settings
        SET provider = ${body.provider},
            encrypted_api_key = ${ciphertext},
            nonce = ${nonce},
            model = ${body.model},
            updated_at = ${timestamp}
        WHERE user_id = ${auth.user.id}
      `;
    } else {
      // Insert
      await sql`
        INSERT INTO user_ai_settings (
          user_id, workspace_id, provider, encrypted_api_key, nonce, model, created_at, updated_at
        ) VALUES (
          ${auth.user.id},
          ${auth.workspaceId || '00000000-0000-0000-0000-000000000000'},
          ${body.provider},
          ${ciphertext},
          ${nonce},
          ${body.model},
          ${timestamp},
          ${timestamp}
        )
      `;
    }

    // Mask the key for response
    const maskedKey = body.apiKey.length > 4
      ? `${body.apiKey.substring(0, 3)}...${body.apiKey.substring(body.apiKey.length - 4)}`
      : '***';

    return jsonResponse({
      provider: body.provider,
      model: body.model,
      maskedKey,
    }, auth.correlationId, 201);
  }),
});

// DELETE /api/ai-settings - Delete user's AI settings
app.http('deleteAISettings', {
  methods: ['DELETE'],
  route: 'ai-settings',
  handler: withAuth(async (request, context, auth) => {
    await sql`
      DELETE FROM user_ai_settings
      WHERE user_id = ${auth.user.id}
    `;

    return jsonResponse({ success: true }, auth.correlationId);
  }),
});

  // Test connection
  app.http('testAIConnection', {
    methods: ['POST'],
    route: 'ai-settings/test',
    handler: withAuth(async (request, context, auth) => {
      const settings = await sql`
        SELECT provider, model, encrypted_api_key, nonce
        FROM user_ai_settings
        WHERE user_id = ${auth.user.id}
      `;
  
      if (settings.length === 0) {
        return errorResponse(400, 'No AI settings configured', auth.correlationId);
      }
  
      const setting = settings[0];
  
      try {
        // Convert BYTEA data to proper Buffers (handles hex strings, Uint8Array, etc.)
        const encryptedBuffer = toBuffer(setting.encrypted_api_key);
        const nonceBuffer = toBuffer(setting.nonce);

        console.log(`[DEBUG] Decrypting Key: CipherLen=${encryptedBuffer.length}, NonceLen=${nonceBuffer.length}`);

        // Decrypt key and create provider
        const apiKey = decrypt(encryptedBuffer, nonceBuffer);
        const provider = createProvider(setting.provider, apiKey, setting.model);
  
        // Test connection
        const result = await provider.testConnection();
  
        return jsonResponse(result, auth.correlationId);
      } catch (error) {
        console.error('[Encryption Error]', error);
        return errorResponse(
          500,
          'Connection test failed',
          auth.correlationId,
          { 
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
          }
        );
      }
    }),
  });
