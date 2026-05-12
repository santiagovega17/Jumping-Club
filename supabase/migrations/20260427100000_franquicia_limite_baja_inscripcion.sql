-- Antelación mínima (en minutos) antes del inicio de la clase para permitir
-- que un socio se dé de baja. Global por franquicia.
alter table public.franquicias
  add column if not exists minutos_limite_baja_inscripcion integer not null default 30;

comment on column public.franquicias.minutos_limite_baja_inscripcion is
  'Minutos antes del inicio de la clase; a partir de ese momento no se permite baja del socio.';
