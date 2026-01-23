-- Migration: Enable multiple AI providers per user
-- Drop existing single-provider primary key and create composite key

-- Drop the old primary key (user_id)
ALTER TABLE user_ai_settings DROP CONSTRAINT IF EXISTS user_ai_settings_pkey;

-- Add new composite primary key (user_id + provider)
ALTER TABLE user_ai_settings ADD PRIMARY KEY (user_id, provider);

-- Comment
COMMENT ON TABLE user_ai_settings IS 'Stores encrypted API keys per user per provider';
