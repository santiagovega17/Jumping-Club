-- Configuración por franquicia: formas de pago, conceptos de caja, plantillas.
-- Extiende instructores con especialidad (UI).

ALTER TABLE instructores
  ADD COLUMN IF NOT EXISTS especialidad TEXT;

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

ALTER TABLE formas_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE conceptos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_clases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formas_pago_franquicia" ON formas_pago;
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

DROP POLICY IF EXISTS "conceptos_caja_franquicia" ON conceptos_caja;
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

DROP POLICY IF EXISTS "plantillas_clases_franquicia" ON plantillas_clases;
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
