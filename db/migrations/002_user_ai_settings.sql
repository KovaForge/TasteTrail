-- User AI Settings Table
-- Stores encrypted API keys for OpenAI or Gemini per user
CREATE TABLE user_ai_settings (
    user_id VARCHAR(255) PRIMARY KEY,
    workspace_id UUID NOT NULL,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('openai', 'gemini')),
    encrypted_api_key BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    model VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_ai_settings_workspace ON user_ai_settings(workspace_id);
