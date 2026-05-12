-- Fase 2 - Estructura multi-sucursal para Universal Jumps
-- Ejecutar en Supabase SQL editor o como migracion.

begin;

-- 1) Tabla sucursales (si no existe)
create table if not exists public.sucursales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  estado text not null default 'activa' check (estado in ('activa', 'inactiva')),
  direccion text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- 2) Seed de sucursales desde franquicias existentes (sin duplicar)
insert into public.sucursales (id, nombre, estado, direccion, created_at)
select
  f.id,
  f.nombre,
  'activa',
  f.direccion,
  coalesce(f.created_at, timezone('utc'::text, now()))
from public.franquicias f
left join public.sucursales s on s.id = f.id
where s.id is null;

-- 3) Columnas sucursal_id en tablas principales
alter table public.socios
  add column if not exists sucursal_id uuid;

alter table public.movimientos_caja
  add column if not exists sucursal_id uuid;

alter table public.clases
  add column if not exists sucursal_id uuid;

-- 4) Backfill desde franquicia_id existente
update public.socios
set sucursal_id = franquicia_id
where sucursal_id is null and franquicia_id is not null;

update public.movimientos_caja
set sucursal_id = franquicia_id
where sucursal_id is null and franquicia_id is not null;

update public.clases
set sucursal_id = franquicia_id
where sucursal_id is null and franquicia_id is not null;

-- 5) Foreign keys hacia sucursales
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'socios_sucursal_id_fkey'
  ) then
    alter table public.socios
      add constraint socios_sucursal_id_fkey
      foreign key (sucursal_id) references public.sucursales(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'movimientos_caja_sucursal_id_fkey'
  ) then
    alter table public.movimientos_caja
      add constraint movimientos_caja_sucursal_id_fkey
      foreign key (sucursal_id) references public.sucursales(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clases_sucursal_id_fkey'
  ) then
    alter table public.clases
      add constraint clases_sucursal_id_fkey
      foreign key (sucursal_id) references public.sucursales(id);
  end if;
end $$;

-- 6) Indices recomendados para consultas globales
create index if not exists idx_sucursales_estado on public.sucursales (estado);
create index if not exists idx_socios_sucursal_id on public.socios (sucursal_id);
create index if not exists idx_movimientos_caja_sucursal_id on public.movimientos_caja (sucursal_id);
create index if not exists idx_clases_sucursal_id on public.clases (sucursal_id);

commit;
