CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.perfil_rol AS ENUM (
  'superadmin_global',
  'admin_franquicia',
  'recepcionista',
  'socio'
);

CREATE TYPE public.tipo_movimiento_caja AS ENUM ('ingreso', 'egreso');

CREATE TYPE public.estado_movimiento_caja AS ENUM ('pagado', 'pendiente', 'anulado');

CREATE TYPE public.estado_socio AS ENUM ('activo', 'vencido', 'inactivo');

CREATE TYPE public.estado_plan AS ENUM ('activo', 'inactivo');

CREATE TYPE public.estado_instructor AS ENUM ('activo', 'inactivo');

CREATE TYPE public.estado_clase AS ENUM ('activa', 'cancelada');

CREATE TYPE public.estado_franquicia AS ENUM ('activa', 'inactiva');

CREATE TYPE public.dia_semana_plantilla AS ENUM (
  'lun', 'mar', 'mie', 'jue', 'vie', 'sab'
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE TABLE public.universal_jumps_global_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  clases_por_semana integer NOT NULL CHECK (clases_por_semana > 0),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER trg_universal_jumps_global_plans_updated_at
  BEFORE UPDATE ON public.universal_jumps_global_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.franquicias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  direccion text,
  estado public.estado_franquicia NOT NULL DEFAULT 'activa',
  minutos_limite_baja_inscripcion integer NOT NULL DEFAULT 30
    CHECK (minutos_limite_baja_inscripcion >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER trg_franquicias_updated_at
  BEFORE UPDATE ON public.franquicias
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  rol public.perfil_rol NOT NULL,
  franquicia_id uuid REFERENCES public.franquicias (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT perfiles_franquicia_scope_ck CHECK (
    (rol = 'superadmin_global' AND franquicia_id IS NULL)
    OR (rol <> 'superadmin_global' AND franquicia_id IS NOT NULL)
  )
);

CREATE INDEX idx_perfiles_franquicia_id ON public.perfiles (franquicia_id);

CREATE TRIGGER trg_perfiles_updated_at
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.universal_jumps_global_templates (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  formas_pago_default text[] NOT NULL DEFAULT '{}',
  conceptos_ingreso_default text[] NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES public.perfiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER trg_universal_jumps_global_templates_updated_at
  BEFORE UPDATE ON public.universal_jumps_global_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.instructores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franquicia_id uuid NOT NULL REFERENCES public.franquicias (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  estado public.estado_instructor NOT NULL DEFAULT 'activo',
  especialidad text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_instructores_franquicia_id ON public.instructores (franquicia_id);

CREATE UNIQUE INDEX uq_instructores_franquicia_entity
  ON public.instructores (franquicia_id, id);

CREATE TRIGGER trg_instructores_updated_at
  BEFORE UPDATE ON public.instructores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.planes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franquicia_id uuid NOT NULL REFERENCES public.franquicias (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  precio numeric NOT NULL CHECK (precio >= 0),
  version text NOT NULL DEFAULT 'v1',
  estado public.estado_plan NOT NULL DEFAULT 'activo',
  clases_por_semana integer NOT NULL DEFAULT 1 CHECK (clases_por_semana > 0),
  global_plan_id uuid REFERENCES public.universal_jumps_global_plans (id)
    ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX uq_planes_franquicia_global_plan
  ON public.planes (franquicia_id, global_plan_id)
  WHERE global_plan_id IS NOT NULL;

CREATE UNIQUE INDEX uq_planes_franquicia_entity
  ON public.planes (franquicia_id, id);

CREATE INDEX idx_planes_franquicia_id ON public.planes (franquicia_id);

CREATE TRIGGER trg_planes_updated_at
  BEFORE UPDATE ON public.planes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.formas_pago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franquicia_id uuid NOT NULL REFERENCES public.franquicias (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  orden smallint NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX uq_formas_pago_franquicia_nombre_lower
  ON public.formas_pago (franquicia_id, lower(nombre));

CREATE UNIQUE INDEX uq_formas_pago_franquicia_entity
  ON public.formas_pago (franquicia_id, id);

CREATE INDEX idx_formas_pago_franquicia_id ON public.formas_pago (franquicia_id);

CREATE TRIGGER trg_formas_pago_updated_at
  BEFORE UPDATE ON public.formas_pago
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.conceptos_caja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franquicia_id uuid NOT NULL REFERENCES public.franquicias (id) ON DELETE CASCADE,
  tipo public.tipo_movimiento_caja NOT NULL,
  concepto text NOT NULL,
  descripcion text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX uq_conceptos_caja_linea
  ON public.conceptos_caja (franquicia_id, tipo, concepto, descripcion);

CREATE UNIQUE INDEX uq_conceptos_caja_franquicia_entity
  ON public.conceptos_caja (franquicia_id, id);

CREATE INDEX idx_conceptos_caja_franquicia_id ON public.conceptos_caja (franquicia_id);

CREATE TRIGGER trg_conceptos_caja_updated_at
  BEFORE UPDATE ON public.conceptos_caja
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.plantillas_clases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franquicia_id uuid NOT NULL REFERENCES public.franquicias (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  instructor_id uuid NOT NULL,
  horario text NOT NULL,
  dia_semana public.dia_semana_plantilla NOT NULL,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  cupo_maximo integer CHECK (cupo_maximo IS NULL OR cupo_maximo > 0),
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT plantillas_clases_instructor_misma_franquicia_fk
    FOREIGN KEY (franquicia_id, instructor_id)
    REFERENCES public.instructores (franquicia_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_plantillas_clases_franquicia_id ON public.plantillas_clases (franquicia_id);

CREATE TRIGGER trg_plantillas_clases_updated_at
  BEFORE UPDATE ON public.plantillas_clases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.perfiles (id) ON DELETE CASCADE,
  franquicia_id uuid NOT NULL REFERENCES public.franquicias (id) ON DELETE CASCADE,
  plan_id uuid NOT NULL,
  telefono text,
  dni text,
  domicilio text,
  provincia text,
  mes_ultimo_aumento date NOT NULL DEFAULT CURRENT_DATE,
  instructor_id uuid REFERENCES public.instructores (id) ON DELETE SET NULL,
  estado public.estado_socio NOT NULL DEFAULT 'activo',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT socios_plan_misma_franquicia_fk
    FOREIGN KEY (franquicia_id, plan_id)
    REFERENCES public.planes (franquicia_id, id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_socios_perfil_franquicia_vivos
  ON public.socios (perfil_id, franquicia_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_socios_franquicia_id ON public.socios (franquicia_id);
CREATE INDEX idx_socios_plan_id ON public.socios (plan_id);
CREATE INDEX idx_socios_instructor_id ON public.socios (instructor_id);
CREATE INDEX idx_socios_deleted_at ON public.socios (deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_socios_updated_at
  BEFORE UPDATE ON public.socios
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.clases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franquicia_id uuid NOT NULL REFERENCES public.franquicias (id) ON DELETE CASCADE,
  instructor_id uuid REFERENCES public.instructores (id) ON DELETE SET NULL,
  nombre text NOT NULL,
  fecha_hora timestamptz NOT NULL,
  cupo_maximo integer NOT NULL DEFAULT 20 CHECK (cupo_maximo > 0),
  reservas_actuales integer NOT NULL DEFAULT 0 CHECK (reservas_actuales >= 0),
  estado public.estado_clase NOT NULL DEFAULT 'activa',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_clases_franquicia_fecha ON public.clases (franquicia_id, fecha_hora);
CREATE INDEX idx_clases_deleted_at ON public.clases (deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_clases_updated_at
  BEFORE UPDATE ON public.clases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.inscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clase_id uuid NOT NULL REFERENCES public.clases (id) ON DELETE CASCADE,
  socio_id uuid NOT NULL REFERENCES public.socios (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX uq_inscripciones_clase_socio ON public.inscripciones (clase_id, socio_id);
CREATE INDEX idx_inscripciones_clase_id ON public.inscripciones (clase_id);
CREATE INDEX idx_inscripciones_socio_id ON public.inscripciones (socio_id);

CREATE TRIGGER trg_inscripciones_updated_at
  BEFORE UPDATE ON public.inscripciones
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.movimientos_caja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franquicia_id uuid NOT NULL REFERENCES public.franquicias (id) ON DELETE CASCADE,
  socio_id uuid REFERENCES public.socios (id) ON DELETE SET NULL,
  concepto_id uuid NOT NULL,
  forma_pago_id uuid NOT NULL,
  tipo public.tipo_movimiento_caja NOT NULL,
  monto numeric NOT NULL CHECK (monto >= 0),
  fecha timestamptz NOT NULL,
  observaciones text,
  estado public.estado_movimiento_caja NOT NULL DEFAULT 'pagado',
  fecha_vencimiento date,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT movimientos_caja_concepto_misma_franquicia_fk
    FOREIGN KEY (franquicia_id, concepto_id)
    REFERENCES public.conceptos_caja (franquicia_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT movimientos_caja_forma_pago_misma_franquicia_fk
    FOREIGN KEY (franquicia_id, forma_pago_id)
    REFERENCES public.formas_pago (franquicia_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_movimientos_caja_franquicia_fecha
  ON public.movimientos_caja (franquicia_id, fecha DESC);
CREATE INDEX idx_movimientos_caja_estado_vencimiento
  ON public.movimientos_caja (estado, fecha_vencimiento);
CREATE INDEX idx_movimientos_caja_deleted_at ON public.movimientos_caja (deleted_at)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_movimientos_caja_updated_at
  BEFORE UPDATE ON public.movimientos_caja
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franquicia_id uuid NOT NULL REFERENCES public.franquicias (id) ON DELETE CASCADE,
  socio_id uuid NOT NULL REFERENCES public.socios (id) ON DELETE CASCADE,
  monto numeric NOT NULL CHECK (monto >= 0),
  nombre_plan_historico text NOT NULL,
  mes_correspondiente text NOT NULL,
  fecha_pago timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_pagos_franquicia_id ON public.pagos (franquicia_id);
CREATE INDEX idx_pagos_socio_id ON public.pagos (socio_id);

CREATE TRIGGER trg_pagos_updated_at
  BEFORE UPDATE ON public.pagos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
