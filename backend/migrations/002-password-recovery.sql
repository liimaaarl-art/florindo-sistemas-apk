CREATE SCHEMA IF NOT EXISTS florindo_auth_private;
CREATE TABLE IF NOT EXISTS florindo_auth_private.florindo_recovery_accounts (user_id text PRIMARY KEY REFERENCES public.florindo_app_users(id), email text NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS florindo_auth_private.florindo_password_resets (id text PRIMARY KEY, user_id text REFERENCES public.florindo_app_users(id), code_hash text NOT NULL, attempts integer NOT NULL DEFAULT 0, consumed boolean NOT NULL DEFAULT false, delivered boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes');
CREATE INDEX IF NOT EXISTS florindo_password_resets_created ON florindo_auth_private.florindo_password_resets(created_at);
ALTER TABLE florindo_auth_private.florindo_recovery_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE florindo_auth_private.florindo_password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON florindo_auth_private.florindo_recovery_accounts, florindo_auth_private.florindo_password_resets FROM PUBLIC, florindo_api;
REVOKE ALL ON SCHEMA florindo_auth_private FROM PUBLIC, florindo_api;
