ALTER TABLE public.clases
ADD COLUMN IF NOT EXISTS estado text;

UPDATE public.clases
SET estado = 'activa'
WHERE estado IS NULL;

ALTER TABLE public.clases
ALTER COLUMN estado SET DEFAULT 'activa';
