-- Database migration for OAuth state tracking and multi-account support
-- Run this SQL in your Vercel Postgres database

-- Create oauth_states table for PKCE and CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
  id SERIAL PRIMARY KEY,
  state VARCHAR(255) UNIQUE NOT NULL,
  code_verifier VARCHAR(255) NOT NULL,
  code_challenge VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),
  workspace_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  INDEX idx_state (state),
  INDEX idx_created_at (created_at),
  INDEX idx_used (used)
);

-- Update accounts table to support multi-account per workspace
-- Add user_id and workspace_id if not already present
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(255);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accounts_open_id ON accounts(open_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_workspace_id ON accounts(workspace_id);

-- Add a unique constraint to prevent duplicate accounts
-- This ensures each open_id can only be linked once (prevents duplicate linking)
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_unique_open_id ON accounts(open_id);

-- Clean up old oauth_states (run this periodically or use a cron job)
-- DELETE FROM oauth_states WHERE created_at < NOW() - INTERVAL '10 minutes';

-- Verify the tables
SELECT 'oauth_states table created' AS status;
SELECT 'accounts table updated' AS status;

-- Display current schema
\d oauth_states;
\d accounts;
