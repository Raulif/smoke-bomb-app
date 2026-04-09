ALTER TABLE users
  ADD COLUMN IF NOT EXISTS home_latitude float8,
  ADD COLUMN IF NOT EXISTS home_longitude float8;
