ALTER TABLE public.plantillas_clases
ADD COLUMN IF NOT EXISTS valid_from date,
ADD COLUMN IF NOT EXISTS valid_to date;

UPDATE public.plantillas_clases
SET valid_from = COALESCE(valid_from, CURRENT_DATE)
WHERE valid_from IS NULL;

ALTER TABLE public.plantillas_clases
ALTER COLUMN valid_from SET DEFAULT CURRENT_DATE;
