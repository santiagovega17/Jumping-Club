CREATE TABLE IF NOT EXISTS public.inscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clase_id uuid NOT NULL REFERENCES public.clases(id) ON DELETE CASCADE,
  socio_id uuid NOT NULL REFERENCES public.socios(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS inscripciones_clase_id_socio_id_key
  ON public.inscripciones (clase_id, socio_id);

CREATE INDEX IF NOT EXISTS inscripciones_clase_id_idx
  ON public.inscripciones (clase_id);

CREATE INDEX IF NOT EXISTS inscripciones_socio_id_idx
  ON public.inscripciones (socio_id);
