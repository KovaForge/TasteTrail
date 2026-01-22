-- Separate User Menu Item State
-- Moves tried, rating, notes, tags from menu_items to user_menu_item_state table

CREATE TABLE user_menu_item_state (
    user_id VARCHAR(255) NOT NULL,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    tried BOOLEAN DEFAULT FALSE,
    last_tried_date TIMESTAMPTZ,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    tags JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, menu_item_id)
);

CREATE INDEX idx_user_state_user ON user_menu_item_state(user_id);
CREATE INDEX idx_user_state_item ON user_menu_item_state(menu_item_id);
