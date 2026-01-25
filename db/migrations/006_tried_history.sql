-- Tried History Table
-- Tracks multiple 'tried' dates for each user/menu item combination

CREATE TABLE menu_item_tried_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    tried_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tried_history_user_item ON menu_item_tried_history(user_id, menu_item_id);
CREATE INDEX idx_tried_history_date ON menu_item_tried_history(tried_date DESC);

COMMENT ON TABLE menu_item_tried_history IS 'History of tried dates for menu items per user';
