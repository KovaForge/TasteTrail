-- Share Tokens Table
CREATE TABLE share_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    created_by VARCHAR(255) NOT NULL, -- User ID
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- Optional expiration
);

CREATE INDEX idx_share_tokens_restaurant ON share_tokens(restaurant_id);

-- Shared Restaurants Access Table
CREATE TABLE shared_restaurants (
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- Recipient User ID
    shared_by VARCHAR(255) NOT NULL, -- Sharer User ID
    shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (restaurant_id, user_id)
);

CREATE INDEX idx_shared_restaurants_user ON shared_restaurants(user_id);
