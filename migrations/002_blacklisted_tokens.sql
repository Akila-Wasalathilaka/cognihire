-- Migration 002: Add blacklisted tokens table for secure session management
-- Created: 2025-09-01
-- Purpose: Track invalidated JWT tokens to prevent reuse after logout

-- Create blacklisted_tokens table
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    token_jti TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    blacklisted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_jti ON blacklisted_tokens(token_jti);
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires ON blacklisted_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_user ON blacklisted_tokens(user_id);

-- Insert migration record
INSERT OR IGNORE INTO schema_migrations (version, applied_at) 
VALUES ('002_blacklisted_tokens', CURRENT_TIMESTAMP);