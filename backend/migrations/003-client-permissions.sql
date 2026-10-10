DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='florindo_client') THEN CREATE ROLE florindo_client NOLOGIN NOBYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA public TO florindo_client;
GRANT EXECUTE ON FUNCTION public.florindo_login(text,text),public.florindo_logout(text),public.florindo_get_state(text),public.florindo_sync_state(text,jsonb) TO florindo_client;
GRANT florindo_client TO neondb_owner;
