-- Run this in the Supabase SQL editor
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token text;
