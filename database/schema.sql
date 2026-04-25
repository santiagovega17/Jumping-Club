-- =============================================================================
-- Jumping Club — Esquema documentado (configuración por franquicia)
-- =============================================================================
-- Este archivo describe el SQL necesario para las tablas de configuración
-- dinámica vinculadas a `franquicias`. Las tablas base (`franquicias`,
-- `perfiles`, `planes`, `socios`, `pagos`, `clases`) se definen en
-- `supabase/migrations/20260424_initial_schema.sql`.
--
-- Convenciones:
--   - Todas las tablas incluyen `franquicia_id` NOT NULL → `franquicias(id)`.
--   - Los timestamps usan UTC (`timezone('utc', now())`).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Instructores (tabla existente + columna opcional de UI)
-- -----------------------------------------------------------------------------
-- La tabla `instructores` ya existe en la migración inicial. Se documenta
-- aquí la extensión recomendada para alinear con la app (especialidad).
-- -----------------------------------------------------------------------------

ALTER TABLE instructores
  ADD COLUMN IF NOT EXISTS especialidad TEXT;

COMMENT ON COLUMN instructores.especialidad IS 'Especialidad o foco del instructor (texto libre, opcional).';

-- -----------------------------------------------------------------------------
-- formas_pago — Medios de pago aceptados en caja
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formas_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franquicia_id UUID NOT NULL REFERENCES franquicias (id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden SMALLINT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS formas_pago_franquicia_nombre_lower
  ON formas_pago (franquicia_id, lower(nombre));

COMMENT ON TABLE formas_pago IS 'Catálogo de formas de pago por franquicia (caja / administración).';

-- -----------------------------------------------------------------------------
-- conceptos_caja — Líneas de catálogo ingreso/egreso (concepto + descripción)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conceptos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franquicia_id UUID NOT NULL REFERENCES franquicias (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  concepto TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS conceptos_caja_unique_line
  ON conceptos_caja (franquicia_id, tipo, concepto, descripcion);

COMMENT ON TABLE conceptos_caja IS 'Catálogo jerárquico aplanado: cada fila es concepto + descripción para ingresos o egresos.';

-- -----------------------------------------------------------------------------
-- plantillas_clases — Horarios base reutilizables en el calendario
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plantillas_clases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franquicia_id UUID NOT NULL REFERENCES franquicias (id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  instructor_id UUID NOT NULL REFERENCES instructores (id) ON DELETE RESTRICT,
  horario TEXT NOT NULL,
  cupo_maximo INTEGER,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc'::text, now())
);

COMMENT ON TABLE plantillas_clases IS 'Plantillas de clase (nombre, instructor, horario fijo) por franquicia.';
COMMENT ON COLUMN plantillas_clases.horario IS 'Hora fija en formato HH:MM (24h).';

-- =============================================================================
-- Row Level Security (recomendado en Supabase)
-- =============================================================================
-- Política: el usuario solo accede a filas de su propia franquicia (según
-- `perfiles.franquicia_id`). Ajustar si se requiere soporte para `admin_global`.

ALTER TABLE formas_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE conceptos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_clases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formas_pago_franquicia"
  ON formas_pago FOR ALL
  USING (
    franquicia_id IN (
      SELECT franquicia_id FROM perfiles WHERE id = auth.uid() AND franquicia_id IS NOT NULL
    )
  )
  WITH CHECK (
    franquicia_id IN (
      SELECT franquicia_id FROM perfiles WHERE id = auth.uid() AND franquicia_id IS NOT NULL
    )
  );

CREATE POLICY "conceptos_caja_franquicia"
  ON conceptos_caja FOR ALL
  USING (
    franquicia_id IN (
      SELECT franquicia_id FROM perfiles WHERE id = auth.uid() AND franquicia_id IS NOT NULL
    )
  )
  WITH CHECK (
    franquicia_id IN (
      SELECT franquicia_id FROM perfiles WHERE id = auth.uid() AND franquicia_id IS NOT NULL
    )
  );

CREATE POLICY "plantillas_clases_franquicia"
  ON plantillas_clases FOR ALL
  USING (
    franquicia_id IN (
      SELECT franquicia_id FROM perfiles WHERE id = auth.uid() AND franquicia_id IS NOT NULL
    )
  )
  WITH CHECK (
    franquicia_id IN (
      SELECT franquicia_id FROM perfiles WHERE id = auth.uid() AND franquicia_id IS NOT NULL
    )
  );
