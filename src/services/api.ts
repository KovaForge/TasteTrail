import type { ApiError, ApiResponse, DebugEntry } from '../types';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

// Get workspace ID from context (will be injected via provider)
let currentWorkspaceId: string | null = null;
let debugCallback: ((entry: Omit<DebugEntry, 'id'>) => void) | null = null;
let userId: string | null = null;

export function setApiContext(
  workspaceId: string | null,
  uid: string | null,
  debugFn: ((entry: Omit<DebugEntry, 'id'>) => void) | null
) {
  currentWorkspaceId = workspaceId;
  userId = uid;
  debugCallback = debugFn;
}

function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'x-correlation-id': correlationId,
    ...(currentWorkspaceId && { 'x-workspace-id': currentWorkspaceId }),
    ...options.headers,
  };

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const duration = Date.now() - startTime;
    const responseCorrelationId = response.headers.get('x-correlation-id') || correlationId;

    // Log API call to debug console
    if (debugCallback) {
      debugCallback({
        timestamp: new Date().toISOString(),
        type: 'api',
        message: `${options.method || 'GET'} ${endpoint} - ${response.status} (${duration}ms)`,
        correlationId: responseCorrelationId,
        apiRoute: endpoint,
        userId: userId || undefined,
        workspaceId: currentWorkspaceId || undefined,
      });
    }

    if (!response.ok) {
      let errorData: ApiError;
      
      try {
        const json = await response.json();
        errorData = {
          message: json.message || json.error || `Request failed with status ${response.status}`,
          correlationId: responseCorrelationId,
          code: json.code,
          details: json.details,
        };
      } catch {
        errorData = {
          message: `Request failed with status ${response.status}`,
          correlationId: responseCorrelationId,
        };
      }

      // Log error to debug console
      if (debugCallback) {
        debugCallback({
          timestamp: new Date().toISOString(),
          type: 'error',
          message: errorData.message,
          correlationId: responseCorrelationId,
          apiRoute: endpoint,
          userId: userId || undefined,
          workspaceId: currentWorkspaceId || undefined,
          details: errorData.details,
        });
      }

      return { error: errorData };
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return { data: undefined as unknown as T };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    
    // Log network error to debug console
    if (debugCallback) {
      debugCallback({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `Network error: ${errorMessage}`,
        correlationId,
        apiRoute: endpoint,
        userId: userId || undefined,
        workspaceId: currentWorkspaceId || undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    return {
      error: {
        message: errorMessage,
        correlationId,
      },
    };
  }
}

// API Methods
export const api = {
  // Workspaces
  getWorkspaces: () => apiFetch<{ workspaces: import('../types').Workspace[] }>('/api/workspaces'),
  createWorkspace: (name: string) => apiFetch<import('../types').Workspace>('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),
  getWorkspaceMembers: (workspaceId: string) => 
    apiFetch<{ members: import('../types').WorkspaceMember[] }>(`/api/workspaces/${workspaceId}/members`),
  inviteMember: (workspaceId: string, email: string, role: import('../types').WorkspaceRole) =>
    apiFetch<import('../types').WorkspaceMember>(`/api/workspaces/${workspaceId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  removeMember: (workspaceId: string, userId: string) =>
    apiFetch<void>(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
    }),

  // Restaurants
  getRestaurants: (workspaceId: string) =>
    apiFetch<{ restaurants: import('../types').Restaurant[] }>(`/api/restaurants?workspaceId=${workspaceId}`),
  getRestaurant: (id: string) =>
    apiFetch<import('../types').Restaurant>(`/api/restaurants/${id}`),
  createRestaurant: (data: import('../types').RestaurantFormData) =>
    apiFetch<import('../types').Restaurant>('/api/restaurants', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRestaurant: (id: string, data: Partial<import('../types').RestaurantFormData>) =>
    apiFetch<import('../types').Restaurant>(`/api/restaurants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteRestaurant: (id: string) =>
    apiFetch<void>(`/api/restaurants/${id}`, { method: 'DELETE' }),

  // Menu Items
  getMenuItems: (restaurantId: string) =>
    apiFetch<{ items: import('../types').MenuItem[] }>(`/api/restaurants/${restaurantId}/menu-items`),
  getMenuItem: (id: string) =>
    apiFetch<import('../types').MenuItem>(`/api/menu-items/${id}`),
  createMenuItem: (restaurantId: string, data: import('../types').MenuItemFormData) =>
    apiFetch<import('../types').MenuItem>(`/api/restaurants/${restaurantId}/menu-items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateMenuItem: (id: string, data: Partial<import('../types').MenuItemFormData>) =>
    apiFetch<import('../types').MenuItem>(`/api/menu-items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteMenuItem: (id: string) =>
    apiFetch<void>(`/api/menu-items/${id}`, { method: 'DELETE' }),
  toggleTried: (id: string, tried: boolean) =>
    apiFetch<import('../types').MenuItem>(`/api/menu-items/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ tried, lastTriedDate: tried ? new Date().toISOString() : null }),
    }),
  tryMenuItem: (id: string, notes?: string, date?: string) =>
    apiFetch<{ success: true; history: any }>(`/api/menu-items/${id}/try`, {
      method: 'POST',
      body: JSON.stringify({ notes, date }),
    }),
  getTriedHistory: (id: string) =>
    apiFetch<{ history: Array<{ id: string; tried_date: string; notes: string | null; created_at: string }> }>(
      `/api/menu-items/${id}/tried-history`
    ),
  addTriedHistory: (id: string, notes?: string) =>
    apiFetch<{ id: string; triedDate: string; notes: string | null }>(
      `/api/menu-items/${id}/tried-history`,
      {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }
    ),

  // Search
  search: (filters: import('../types').SearchFilters) =>
    apiFetch<import('../types').SearchResult>(`/api/search?${new URLSearchParams({
      q: filters.query,
      ...(filters.tried !== undefined && { tried: String(filters.tried) }),
      ...(filters.minRating && { minRating: String(filters.minRating) }),
      ...(filters.tags?.length && { tags: filters.tags.join(',') }),
    })}`),

  // Statistics
  getCuisineStats: (scope: import('../types').StatsScope, countBy: import('../types').StatsCountBy) =>
    apiFetch<import('../types').StatsResponse>(`/api/stats/cuisines?scope=${scope}&countBy=${countBy}`),

  // Imports
  parseImport: (data: { sourceType: string; sourceValue: string; restaurantHint?: string; provider?: string }) =>
    apiFetch<{ 
      id: string;
      restaurant: any; 
      items: any[]; 
      warnings: string[];
      meta: { provider: string; model: string; sourceType: string; itemCount: number; durationMs: number };
    }>('/api/imports/parse', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  commitImport: (importId: string, draft: import('../types').ImportDraft) =>
    apiFetch<{ restaurant: import('../types').Restaurant; items: import('../types').MenuItem[] }>(
      `/api/imports/${importId}/commit`,
      {
        method: 'POST',
        body: JSON.stringify(draft),
      }
    ),

  // AI Settings
  getAISettings: () => 
    apiFetch<{ 
      hasOpenAi: boolean; 
      hasGemini: boolean;
      openAiModel: string;
      geminiModel: string;
      maskedOpenAiKey?: string; 
      maskedGeminiKey?: string; 
      error?: string 
    }>('/api/ai-settings'),
  
  saveAISettings: (provider: string, apiKey: string, model: string) =>
    apiFetch<{ provider: string; model: string; maskedKey: string }>('/api/ai-settings', {
      method: 'POST',
      body: JSON.stringify({ provider, apiKey, model }),
    }),
  
  deleteAISettings: (provider?: string) =>
    apiFetch<{ success: boolean }>(`/api/ai-settings${provider ? `?provider=${provider}` : ''}`, { method: 'DELETE' }),
  
  testAIConnection: (provider?: string) =>
    apiFetch<{ success: boolean; message: string; model: string }>('/api/ai-settings/test', { 
      method: 'POST',
      body: JSON.stringify({ provider })
    }),

  // Sharing
  createShareLink: (restaurantId: string) =>
    apiFetch<{ token: string; restaurantName: string }>(`/api/restaurants/${restaurantId}/share`, {
      method: 'POST',
    }),
  
  claimShare: (token: string) =>
    apiFetch<{ success: boolean; restaurantId: string; name: string; cuisine: string; message?: string }>('/api/shares/claim', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  getMyShares: () =>
    apiFetch<{ shares: Array<{ token: string; restaurant_id: string; restaurant_name: string; created_at: string }> }>('/api/shares/mine'),

  deleteShare: (token: string) =>
    apiFetch<{ success: boolean }>(`/api/shares/${token}`, { method: 'DELETE' }),
};
