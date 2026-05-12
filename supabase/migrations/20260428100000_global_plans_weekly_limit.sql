create table if not exists public.universal_jumps_global_plans (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  clases_por_semana integer not null check (clases_por_semana > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.universal_jumps_global_plans enable row level security;

alter table public.planes
  add column if not exists clases_por_semana integer not null default 1,
  add column if not exists global_plan_id uuid references public.universal_jumps_global_plans(id);

create unique index if not exists uq_planes_franquicia_global_plan
  on public.planes (franquicia_id, global_plan_id)
  where global_plan_id is not null;

create or replace function public.touch_universal_jumps_global_plans()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_universal_jumps_global_plans
on public.universal_jumps_global_plans;

create trigger trg_touch_universal_jumps_global_plans
before update on public.universal_jumps_global_plans
for each row
execute function public.touch_universal_jumps_global_plans();

insert into public.universal_jumps_global_plans (nombre, clases_por_semana, activo)
values
  ('Plan 3xSemana', 3, true),
  ('Plan Mensual', 99, true),
  ('Clase Individual', 1, true)
on conflict (nombre) do update
set clases_por_semana = excluded.clases_por_semana,
    activo = true;
