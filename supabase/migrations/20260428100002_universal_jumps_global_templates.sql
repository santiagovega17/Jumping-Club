-- Plantillas globales de Universal Jumps + autoseed al crear franquicia.

create table if not exists public.universal_jumps_global_templates (
  id boolean primary key default true check (id = true),
  formas_pago_default text[] not null default '{}',
  conceptos_ingreso_default text[] not null default '{}',
  updated_by uuid references public.perfiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.universal_jumps_global_templates enable row level security;

insert into public.universal_jumps_global_templates (
  id,
  formas_pago_default,
  conceptos_ingreso_default
)
values (
  true,
  array['Efectivo', 'Transferencia', 'Débito', 'Crédito'],
  array['Pago de Cuota', 'Inscripción', 'Venta de productos']
)
on conflict (id) do nothing;

create or replace function public.touch_universal_jumps_global_templates()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_universal_jumps_global_templates
on public.universal_jumps_global_templates;

create trigger trg_touch_universal_jumps_global_templates
before update on public.universal_jumps_global_templates
for each row
execute function public.touch_universal_jumps_global_templates();

create or replace function public.seed_franquicia_defaults_from_global_template()
returns trigger
language plpgsql
as $$
declare
  template_row public.universal_jumps_global_templates%rowtype;
begin
  select *
  into template_row
  from public.universal_jumps_global_templates
  where id = true;

  if not found then
    return new;
  end if;

  insert into public.formas_pago (franquicia_id, nombre, orden, activo)
  select
    new.id,
    value,
    row_number() over (),
    true
  from unnest(template_row.formas_pago_default) as value
  where btrim(value) <> ''
    and not exists (
      select 1
      from public.formas_pago fp
      where fp.franquicia_id = new.id
        and lower(fp.nombre) = lower(value)
    );

  insert into public.conceptos_caja (
    franquicia_id,
    tipo,
    concepto,
    descripcion,
    orden
  )
  select
    new.id,
    'ingreso',
    value,
    case
      when lower(value) = lower('Pago de Cuota') then ''
      else 'General'
    end,
    row_number() over ()
  from unnest(template_row.conceptos_ingreso_default) as value
  where btrim(value) <> ''
    and lower(value) <> lower('Pago de Cuota')
    and not exists (
      select 1
      from public.conceptos_caja cc
      where cc.franquicia_id = new.id
        and cc.tipo = 'ingreso'
        and lower(cc.concepto) = lower(value)
    );

  return new;
end;
$$;

drop trigger if exists trg_seed_franquicia_defaults_from_global_template
on public.franquicias;

create trigger trg_seed_franquicia_defaults_from_global_template
after insert on public.franquicias
for each row
execute function public.seed_franquicia_defaults_from_global_template();
