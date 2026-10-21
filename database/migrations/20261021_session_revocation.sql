-- Aditiva: protege logout frente a saves/touches de solicitudes concurrentes.
BEGIN;
ALTER TABLE public.application_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
CREATE INDEX IF NOT EXISTS application_sessions_revoked_idx ON public.application_sessions(revoked_at) WHERE revoked_at IS NOT NULL;
COMMIT;
