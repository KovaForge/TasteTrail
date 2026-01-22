-- TasteTrail Database Schema
-- Run this migration on Neon PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workspaces Table
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workspace Members Table
CREATE TABLE workspace_members (
    user_id VARCHAR(255) NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Owner', 'Editor', 'Viewer')),
    email VARCHAR(255) NOT NULL,
    pending BOOLEAN NOT NULL DEFAULT false,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by_user_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (user_id, workspace_id)
);

-- Index for looking up by email (for invite conversion)
CREATE INDEX idx_workspace_members_email ON workspace_members(email);

-- Restaurants Table
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    cuisine VARCHAR(100) NOT NULL,
    address_suburb VARCHAR(255),
    notes TEXT,
    last_visited_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for workspace lookup
CREATE INDEX idx_restaurants_workspace ON restaurants(workspace_id);
CREATE INDEX idx_restaurants_cuisine ON restaurants(cuisine);

-- Menu Items Table
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    price DECIMAL(10, 2),
    description TEXT,
    tried BOOLEAN NOT NULL DEFAULT false,
    last_tried_date TIMESTAMPTZ,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for menu items
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_workspace ON menu_items(workspace_id);
CREATE INDEX idx_menu_items_tried ON menu_items(tried);
CREATE INDEX idx_menu_items_name ON menu_items(LOWER(name));

-- Menu Imports Table
CREATE TABLE menu_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('text', 'url', 'image')),
    source_value TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'committed')) DEFAULT 'draft'
);

CREATE INDEX idx_menu_imports_workspace ON menu_imports(workspace_id);

-- Comments
COMMENT ON TABLE workspaces IS 'Family workspace for shared restaurant tracking';
COMMENT ON TABLE workspace_members IS 'Members of a workspace with roles';
COMMENT ON TABLE restaurants IS 'Restaurants with cuisine and location info';
COMMENT ON TABLE menu_items IS 'Menu items with ratings, tried status, and tags';
COMMENT ON TABLE menu_imports IS 'Import history for text/URL/image imports';
