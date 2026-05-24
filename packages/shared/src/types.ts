export type WorkspaceRole = "Owner" | "Editor" | "Viewer";
export type ImportSourceType = "text" | "url" | "image" | "json";
export type ImportStatus = "draft" | "committed";
export type DebugSeverity = "info" | "warn" | "error";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
}

export interface WorkspaceMember {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  email: string;
  pending: boolean;
  addedAt: string;
  addedByUserId: string;
}

export interface Restaurant {
  id: string;
  workspaceId: string;
  name: string;
  cuisine: string;
  addressSuburb?: string | null;
  notes?: string | null;
  lastVisitedDate?: string | null;
  createdAt: string;
  menuItemCount?: number;
  triedCount?: number;
  isShared: boolean;
  isDirectShare?: boolean;
  ownerName?: string | null;
}

export interface RestaurantFormData {
  name: string;
  cuisine: string;
  addressSuburb?: string;
  notes?: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  workspaceId: string;
  name: string;
  category?: string | null;
  price?: number | null;
  description?: string | null;
  tried: boolean;
  lastTriedDate?: string | null;
  rating?: number | null;
  notes?: string | null;
  tags: string[];
  history?: Array<{ id: string; triedDate: string; notes?: string | null }>;
  createdAt: string;
}

export interface MenuItemFormData {
  name: string;
  category?: string;
  price?: number;
  description?: string;
  tried?: boolean;
  rating?: number;
  notes?: string;
  tags?: string[];
}

export interface SearchFilters {
  query: string;
  tried?: boolean;
  minRating?: number;
}

export interface SearchResult {
  restaurants: Restaurant[];
  menuItems: MenuItem[];
}

export interface CuisineStats {
  cuisine: string;
  count: number;
  percent: number;
}

export interface StatsResponse {
  totalCount: number;
  rows: CuisineStats[];
}

export interface ImportDraftItem {
  name: string;
  category?: string;
  price?: number;
  description?: string;
  selected: boolean;
}

export interface ImportDraft {
  restaurantName: string;
  cuisine: string;
  items: ImportDraftItem[];
}

export interface MenuImport {
  id: string;
  workspaceId: string;
  sourceType: ImportSourceType;
  sourceValue: string;
  importedAt: string;
  status: ImportStatus;
}

export interface ParsedImportMenu {
  restaurant: {
    name: string;
    cuisine: string;
    addressSuburb?: string;
    notes?: string;
  };
  items: Array<{
    name: string;
    category?: string;
    price?: number;
    description?: string;
    tags?: string[];
    tried: boolean;
    notes: string;
  }>;
  warnings: string[];
}

export interface DebugLogEntry {
  id: string;
  timestamp: string;
  routeName: string;
  userId?: string | null;
  workspaceId?: string | null;
  correlationId?: string | null;
  severity: DebugSeverity;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface CliTokenInfo {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    correlationId?: string;
    details?: Record<string, unknown>;
  };
}
