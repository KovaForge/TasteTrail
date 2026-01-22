
import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { sql } from '../db';
import { jsonResponse, errorResponse } from '../middleware/auth';

app.http('healthCheck', {
  methods: ['GET'],
  route: 'health',
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const correlationId = 'health-check-' + Date.now();
    const envUrl = process.env.DATABASE_URL;

    // 1. Check if Env var exists
    if (!envUrl) {
      return errorResponse(500, 'DATABASE_URL environment variable is missing', correlationId);
    }

    // 2. Try to connect
    try {
      const result = await sql`SELECT 1 as health`;
      return jsonResponse({ 
        status: 'ok', 
        database: 'connected',
        queryResult: result,
        envUrlLength: envUrl.length // returning length for verification safely
      }, correlationId);
    } catch (error) {
      return errorResponse(500, 'Database connection failed', correlationId, {
        message: error instanceof Error ? error.message : String(error),
        envUrlLength: envUrl.length
      });
    }
  },
});
