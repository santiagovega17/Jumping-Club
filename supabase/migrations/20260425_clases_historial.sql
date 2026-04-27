CREATE TABLE IF NOT EXISTS public.clases_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clase_id uuid NOT NULL REFERENCES public.clases(id) ON DELETE CASCADE,
  franquicia_id uuid NOT NULL REFERENCES public.franquicias(id) ON DELETE CASCADE,
  nombre_anterior text NOT NULL,
  instructor_id_anterior uuid NULL REFERENCES public.instructores(id) ON DELETE SET NULL,
  fecha_hora_anterior timestamptz NOT NULL,
  nombre_nuevo text NOT NULL,
  instructor_id_nuevo uuid NULL REFERENCES public.instructores(id) ON DELETE SET NULL,
  fecha_hora_nuevo timestamptz NOT NULL,
  editado_en timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.clases_historial
ADD COLUMN IF NOT EXISTS clase_id uuid,
ADD COLUMN IF NOT EXISTS franquicia_id uuid,
ADD COLUMN IF NOT EXISTS nombre_anterior text,
ADD COLUMN IF NOT EXISTS instructor_id_anterior uuid,
ADD COLUMN IF NOT EXISTS fecha_hora_anterior timestamptz,
ADD COLUMN IF NOT EXISTS nombre_nuevo text,
ADD COLUMN IF NOT EXISTS instructor_id_nuevo uuid,
ADD COLUMN IF NOT EXISTS fecha_hora_nuevo timestamptz,
ADD COLUMN IF NOT EXISTS editado_en timestamptz;

ALTER TABLE public.clases_historial
ALTER COLUMN editado_en SET DEFAULT timezone('utc'::text, now());

UPDATE public.clases_historial
SET editado_en = timezone('utc'::text, now())
WHERE editado_en IS NULL;

CREATE INDEX IF NOT EXISTS clases_historial_clase_id_idx
  ON public.clases_historial (clase_id, editado_en DESC);
