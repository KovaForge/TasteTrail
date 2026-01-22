// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Workspace Types
export type WorkspaceRole = 'Owner' | 'Editor' | 'Viewer';

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

// Restaurant Types
export interface Restaurant {
  id: string;
  workspaceId: string;
  name: string;
  cuisine: string;
  addressSuburb?: string;
  notes?: string;
  lastVisitedDate?: string;
  createdAt: string;
  // Computed fields from API
  menuItemCount?: number;
  triedCount?: number;
  isShared: boolean;
  ownerName?: string;
}

export interface RestaurantFormData {
  name: string;
  cuisine: string;
  addressSuburb?: string;
  notes?: string;
}

// Menu Item Types
export interface MenuItem {
  id: string;
  restaurantId: string;
  workspaceId: string;
  name: string;
  category?: string;
  price?: number;
  description?: string;
  tried: boolean;
  lastTriedDate?: string;
  rating?: number;
  notes?: string;
  tags: string[];
  createdAt: string;
}

export interface MenuItemFormData {
  name: string;
  category?: string;
  price?: number;
  description?: string;
  tried: boolean;
  rating?: number;
  notes?: string;
  tags: string[];
}

// Import Types
export type ImportSourceType = 'text' | 'url' | 'image';
export type ImportStatus = 'draft' | 'committed';

export interface MenuImport {
  id: string;
  workspaceId: string;
  sourceType: ImportSourceType;
  sourceValue: string;
  importedAt: string;
  status: ImportStatus;
}

export interface ImportDraft {
  restaurantName: string;
  cuisine: string;
  items: ImportDraftItem[];
}

export interface ImportDraftItem {
  name: string;
  category?: string;
  price?: number;
  description?: string;
  selected: boolean;
}

// Statistics Types
export type StatsScope = 'tried' | 'all';
export type StatsCountBy = 'restaurants' | 'items';

export interface CuisineStats {
  cuisine: string;
  count: number;
  percent: number;
}

export interface StatsResponse {
  totalCount: number;
  rows: CuisineStats[];
}

// Search Types
export interface SearchFilters {
  query: string;
  tried?: boolean;
  minRating?: number;
  tags?: string[];
}

export interface SearchResult {
  restaurants: Restaurant[];
  menuItems: MenuItem[];
}

// Debug Types
export interface DebugEntry {
  id: string;
  timestamp: string;
  type: 'error' | 'api' | 'info';
  message: string;
  correlationId?: string;
  apiRoute?: string;
  userId?: string;
  workspaceId?: string;
  stack?: string;
  details?: Record<string, unknown>;
}

// API Types
export interface ApiError {
  message: string;
  correlationId: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

// Predefined Lists
export const CUISINES = [
  'Italian',
  'Chinese',
  'Japanese',
  'Korean',
  'Thai',
  'Vietnamese',
  'Indian',
  'Mexican',
  'American',
  'French',
  'Mediterranean',
  'Greek',
  'Turkish',
  'Lebanese',
  'Spanish',
  'Brazilian',
  'Peruvian',
  'Ethiopian',
  'Moroccan',
  'Australian',
  'British',
  'German',
  'Fusion',
  'Seafood',
  'Steakhouse',
  'Vegetarian',
  'Vegan',
  'Cafe',
  'Bakery',
  'Dessert',
  'Other',
] as const;

export const QUICK_TAGS = [
  'Too salty',
  'Too sweet',
  'Too spicy',
  'Great value',
  'Worth the price',
  'Overpriced',
  'Generous portion',
  'Small portion',
  'Fresh ingredients',
  'Would order again',
  'Skip this one',
  'Perfect for sharing',
  'Good for solo',
  'Instagram worthy',
  'Hidden gem',
] as const;
