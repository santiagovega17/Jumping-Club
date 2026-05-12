alter table public.socios
  add column if not exists dni text,
  add column if not exists domicilio text,
  add column if not exists provincia text,
  add column if not exists instructor_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'socios_instructor_id_fkey'
      and conrelid = 'public.socios'::regclass
  ) then
    alter table public.socios
      add constraint socios_instructor_id_fkey
      foreign key (instructor_id)
      references public.instructores (id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_socios_instructor_id on public.socios (instructor_id);

alter table public.socios
  alter column mes_ultimo_aumento set default current_date;

update public.socios
set mes_ultimo_aumento = current_date
where mes_ultimo_aumento is null;

alter table public.socios
  alter column mes_ultimo_aumento set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'perfiles'
      and column_name = 'telefono'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'socios'
      and column_name = 'telefono'
  ) then
    update public.socios s
    set telefono = coalesce(nullif(trim(both from s.telefono), ''), p.telefono)
    from public.perfiles p
    where s.perfil_id = p.id
      and p.telefono is not null
      and trim(both from p.telefono) <> '';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'perfiles'
      and column_name = 'documento_identidad'
  ) then
    update public.socios s
    set dni = coalesce(nullif(trim(both from coalesce(s.dni, '')), ''), nullif(trim(both from p.documento_identidad), ''))
    from public.perfiles p
    where s.perfil_id = p.id
      and p.documento_identidad is not null
      and trim(both from p.documento_identidad) <> '';
  end if;
end $$;

alter table public.perfiles drop column if exists telefono;
alter table public.perfiles drop column if exists documento_identidad;
