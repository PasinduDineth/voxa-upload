-- TikTok Accounts Table
-- This table stores authenticated TikTok accounts with their access tokens

CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  open_id VARCHAR(255) UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  display_name VARCHAR(255),
  avatar_url TEXT,
  scope TEXT,
  expires_in INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by open_id
CREATE INDEX IF NOT EXISTS idx_accounts_open_id ON accounts(open_id);

-- Index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at DESC);
