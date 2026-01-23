import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sql } from '../db';

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

/**
 * Extract user from Azure SWA authentication headers
 */
export function getAuthUser(request: HttpRequest): AuthUser | null {
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

  return null;
}

/**
 * Helper to check for local dev mock user
 * This is separate to avoid cluttering the main extraction logic
 */
function getMockUser(): AuthUser | null {
  if (process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development') {
     return {
       id: 'local-dev-user',
       email: 'local@dev.com',
       name: 'Local Developer'
     };
  }
  return null;
}
/**
 * Generate or extract correlation ID
 */
export function getCorrelationId(request: HttpRequest): string {
  return request.headers.get('x-correlation-id') || 
    `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate that user is a member of the workspace
 */
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

/**
 * Create an error response
 */
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

/**
 * Create a success response
 */
export function jsonResponse<T>(
  data: T, 
  correlationId: string,
  status = 200
): HttpResponseInit {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify(data),
  };
}

/**
 * Authentication and workspace middleware wrapper
 */
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
    const user = getAuthUser(request);
    if (!user) {
      return errorResponse(401, 'Authentication required', correlationId);
    }

    // Get workspace ID from header or query
    let workspaceId = request.headers.get('x-workspace-id') || request.query.get('workspaceId');

    // Handle special 'global' workspace ID (means "all my workspaces")
    if (workspaceId === 'global') {
      workspaceId = null;
    }

    // Validate workspace membership if workspace is required or provided
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
