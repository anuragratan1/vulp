-- Migration: 0002_google_auth.sql
-- Description: Add google_id column and unique index to users table for Google Sign-In

ALTER TABLE users ADD COLUMN google_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

