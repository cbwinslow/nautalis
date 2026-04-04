-- Auth stub for plain PostgreSQL (non-Supabase) deployments
-- This provides the auth.uid() function used in RLS policies.
-- It reads the current user ID from the session variable `nautalis.user_id`.
-- The application sets this variable after authenticating the user.

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
  SELECT current_setting('nautalis.user_id', true)::UUID;
$$ LANGUAGE SQL STABLE;
