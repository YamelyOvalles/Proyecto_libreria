-- Ejecutar una vez con el propietario de PostgreSQL. No modifica tablas ni RLS existentes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.application_sessions (
    sid varchar PRIMARY KEY,
    sess json NOT NULL,
    expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS application_sessions_expire_idx ON public.application_sessions(expire);
ALTER TABLE public.application_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.application_sessions FROM anon, authenticated;
COMMIT;
