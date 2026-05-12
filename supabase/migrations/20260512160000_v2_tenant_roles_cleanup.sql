drop table if exists public.clases_historial cascade;

do $$
declare
  r record;
begin
  for r in
    select tc.table_name, tc.constraint_name
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.constraint_type = 'FOREIGN KEY'
      and tc.constraint_name in (
        'socios_sucursal_id_fkey',
        'movimientos_caja_sucursal_id_fkey',
        'clases_sucursal_id_fkey'
      )
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.table_name, r.constraint_name);
  end loop;
end $$;

drop index if exists public.idx_socios_sucursal_id;
drop index if exists public.idx_movimientos_caja_sucursal_id;
drop index if exists public.idx_clases_sucursal_id;
drop index if exists public.idx_sucursales_estado;

alter table if exists public.socios drop column if exists sucursal_id;
alter table if exists public.movimientos_caja drop column if exists sucursal_id;
alter table if exists public.clases drop column if exists sucursal_id;

drop table if exists public.sucursales cascade;

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'perfiles'
      and c.contype = 'c'
  loop
    execute format('alter table public.perfiles drop constraint if exists %I', r.conname);
  end loop;
end $$;

update public.perfiles
set rol = 'superadmin_global'
where rol = 'admin_global';

alter table public.perfiles
  add constraint perfiles_rol_check check (
    rol in ('superadmin_global', 'admin_franquicia', 'recepcionista', 'socio')
  );
