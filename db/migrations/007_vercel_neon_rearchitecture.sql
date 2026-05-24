-- TasteTrail Vercel + Neon rearchitecture support tables
-- Better Auth core tables are generated separately by the Better Auth CLI.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS user_cli_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_cli_tokens_user ON user_cli_tokens(user_id);

CREATE TABLE IF NOT EXISTS debug_log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    route_name VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    workspace_id UUID,
    correlation_id VARCHAR(255),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warn', 'error')),
    message TEXT NOT NULL,
    details JSONB
);

CREATE INDEX IF NOT EXISTS idx_debug_logs_timestamp ON debug_log_entries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_debug_logs_workspace ON debug_log_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_user ON debug_log_entries(user_id);

CREATE TABLE IF NOT EXISTS legacy_identity_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_provider VARCHAR(50) NOT NULL,
    legacy_subject VARCHAR(255) NOT NULL,
    legacy_email VARCHAR(255),
    user_id VARCHAR(255) NOT NULL,
    migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legacy_identity_links_user ON legacy_identity_links(user_id);

COMMENT ON TABLE user_cli_tokens IS 'Personal access tokens for OpenClaw and CLI usage';
COMMENT ON TABLE debug_log_entries IS 'Server-collected debug logs for in-app Debug View and CLI access';
COMMENT ON TABLE legacy_identity_links IS 'Links legacy Microsoft-era identities to new passkey-first user accounts';
