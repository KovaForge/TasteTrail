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
    // Fetch all settings for the user
    const settings = await sql`
      SELECT provider, model, encrypted_api_key, nonce
      FROM user_ai_settings
      WHERE user_id = ${auth.user.id}
    `;

    const response = {
      hasOpenAi: false,
      hasGemini: false,
      openAiModel: 'gpt-4o', // Default
      geminiModel: 'gemini-2.0-flash-exp', // Default
      maskedOpenAiKey: undefined as string | undefined,
      maskedGeminiKey: undefined as string | undefined,
      error: undefined as string | undefined
    };

    if (settings.length > 0) {
      for (const setting of settings) {
        try {
          const encryptedBuffer = toBuffer(setting.encrypted_api_key);
          const nonceBuffer = toBuffer(setting.nonce);
          
          // Try to decrypt just to verify validity/masking
          const apiKey = decrypt(encryptedBuffer, nonceBuffer);
          const maskedKey = apiKey.length > 4 
            ? `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 4)}`
            : '***';

          if (setting.provider === 'openai') {
            response.hasOpenAi = true;
            response.openAiModel = setting.model;
            response.maskedOpenAiKey = maskedKey;
          } else if (setting.provider === 'gemini') {
            response.hasGemini = true;
            response.geminiModel = setting.model;
            response.maskedGeminiKey = maskedKey;
          }
        } catch (error) {
          console.error(`[Encryption Error] Failed to decrypt ${setting.provider} key:`, error);
          response.error = `Decryption failed for ${setting.provider}: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }

    return jsonResponse(response, auth.correlationId);
  }),
});

// POST /api/ai-settings - Save/update user's AI settings for a specific provider
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
    // Convert Buffers to plain hex strings for the Neon HTTP driver
    const ciphertextHex = ciphertext.toString('hex');
    const nonceHex = nonce.toString('hex');
    const timestamp = now();

    // Upsert settings (Composite key: user_id + provider)
    await sql`
      INSERT INTO user_ai_settings (
        user_id, workspace_id, provider, encrypted_api_key, nonce, model, created_at, updated_at
      ) VALUES (
        ${auth.user.id},
        ${auth.workspaceId || '00000000-0000-0000-0000-000000000000'},
        ${body.provider},
        decode(${ciphertextHex}, 'hex'),
        decode(${nonceHex}, 'hex'),
        ${body.model},
        ${timestamp},
        ${timestamp}
      )
      ON CONFLICT (user_id, provider) DO UPDATE SET
        encrypted_api_key = EXCLUDED.encrypted_api_key,
        nonce = EXCLUDED.nonce,
        model = EXCLUDED.model,
        updated_at = EXCLUDED.updated_at
    `;

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

// DELETE /api/ai-settings - Delete user's AI settings (Optionally filtered by provider)
app.http('deleteAISettings', {
  methods: ['DELETE'],
  route: 'ai-settings',
  handler: withAuth(async (request, context, auth) => {
    const provider = request.query.get('provider'); // Optional query param

    if (provider && ['openai', 'gemini'].includes(provider)) {
       await sql`
        DELETE FROM user_ai_settings
        WHERE user_id = ${auth.user.id} AND provider = ${provider}
      `;
    } else {
      // Delete ALL if no provider specified
      await sql`
        DELETE FROM user_ai_settings
        WHERE user_id = ${auth.user.id}
      `;
    }

    return jsonResponse({ success: true }, auth.correlationId);
  }),
});

  // Test connection
  app.http('testAIConnection', {
    methods: ['POST'],
    route: 'ai-settings/test',
    handler: withAuth(async (request, context, auth) => {
      const body = await request.json() as { provider?: string };
      
      let query;
      if (body.provider && ['openai', 'gemini'].includes(body.provider)) {
        query = sql`
          SELECT provider, model, encrypted_api_key, nonce
          FROM user_ai_settings
          WHERE user_id = ${auth.user.id} AND provider = ${body.provider}
        `;
      } else {
        // Default to first available if not specified
        query = sql`
          SELECT provider, model, encrypted_api_key, nonce
          FROM user_ai_settings
          WHERE user_id = ${auth.user.id}
          LIMIT 1
        `;
      }

      const settings = await query;
  
      if (settings.length === 0) {
        return errorResponse(400, 'AI settings not configured for this provider', auth.correlationId);
      }
  
      const setting = settings[0];
  
      try {
        // Convert BYTEA data to proper Buffers
        const encryptedBuffer = toBuffer(setting.encrypted_api_key);
        const nonceBuffer = toBuffer(setting.nonce);

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
