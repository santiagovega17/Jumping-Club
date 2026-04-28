image.png

-- LIMPIAR masivo (descomentar antes de re-ejecutar contra la misma franquicia cafebabe…)
-- DELETE FROM public.inscripciones WHERE clase_id IN (SELECT id FROM public.clases WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001');
-- DELETE FROM public.movimientos_caja WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001';
-- DELETE FROM public.clases WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001';
-- DELETE FROM public.plantillas_clases WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001';
-- DELETE FROM public.socios WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001';
-- DELETE FROM public.perfiles WHERE email LIKE '%@bulk.seed.jumpingclub.local' OR email = 'admin.bulk@seed.jumpingclub.local';
-- DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@bulk.seed.jumpingclub.local' OR email = 'admin.bulk@seed.jumpingclub.local');
-- DELETE FROM auth.users WHERE email LIKE '%@bulk.seed.jumpingclub.local' OR email = 'admin.bulk@seed.jumpingclub.local';
-- DELETE FROM public.conceptos_caja WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001';
-- DELETE FROM public.formas_pago WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001';
-- DELETE FROM public.planes WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001';
-- DELETE FROM public.instructores WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001';
-- DELETE FROM public.franquicias WHERE id = 'cafebabe-0000-4000-8000-000000000001';

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _jc_fid (id uuid PRIMARY KEY);
INSERT INTO _jc_fid VALUES ('cafebabe-0000-4000-8000-000000000001'::uuid);

INSERT INTO public.franquicias (id, nombre, direccion, minutos_limite_baja_inscripcion)
SELECT id, 'Jumping Club Seed Masivo (DEV)', 'Av. Corrientes 4500, CABA', 45 FROM _jc_fid;

INSERT INTO public.instructores (id, franquicia_id, nombre, estado, especialidad) VALUES
  ('caf01e10-0000-4000-8000-000000000001', 'cafebabe-0000-4000-8000-000000000001', 'Gabriela Martínez', 'activo', 'Jumping fitness'),
  ('caf01e10-0000-4000-8000-000000000002', 'cafebabe-0000-4000-8000-000000000001', 'Lucas Fernández', 'activo', 'Funcional'),
  ('caf01e10-0000-4000-8000-000000000003', 'cafebabe-0000-4000-8000-000000000001', 'Valeria Ocampo', 'activo', 'Stretching'),
  ('caf01e10-0000-4000-8000-000000000004', 'cafebabe-0000-4000-8000-000000000001', 'Diego Peralta', 'activo', 'Jump avanzado'),
  ('caf01e10-0000-4000-8000-000000000005', 'cafebabe-0000-4000-8000-000000000001', 'Marina Acosta', 'activo', 'Rehabilitación');

INSERT INTO public.planes (id, franquicia_id, nombre, precio, version, estado) VALUES
  ('caf02e20-0000-4000-8000-000000000001', 'cafebabe-0000-4000-8000-000000000001', 'Full mensual', 52000.00, 'v1', 'activo'),
  ('caf02e20-0000-4000-8000-000000000002', 'cafebabe-0000-4000-8000-000000000001', 'Plan duo', 43000.00, 'v1', 'activo');

INSERT INTO public.formas_pago (id, franquicia_id, nombre, orden, activo) VALUES
  ('caf03e30-0000-4000-8000-000000000001', 'cafebabe-0000-4000-8000-000000000001', 'Efectivo', 1, true),
  ('caf03e30-0000-4000-8000-000000000002', 'cafebabe-0000-4000-8000-000000000001', 'Transferencia', 2, true);

INSERT INTO public.conceptos_caja (id, franquicia_id, tipo, concepto, descripcion, orden) VALUES
  ('caf04e40-0000-4000-8000-000000000001', 'cafebabe-0000-4000-8000-000000000001', 'ingreso', 'Cuota mensual', 'Cobro mensualidad socios', 1),
  ('caf04e40-0000-4000-8000-000000000002', 'cafebabe-0000-4000-8000-000000000001', 'ingreso', 'Matrícula', 'Alta y kit bienvenida', 2),
  ('caf04e40-0000-4000-8000-000000000003', 'cafebabe-0000-4000-8000-000000000001', 'egreso', 'Luz y servicios', 'EDENAR / ABL', 10),
  ('caf04e40-0000-4000-8000-000000000004', 'cafebabe-0000-4000-8000-000000000001', 'egreso', 'Alquiler', 'Locación sede', 11),
  ('caf04e40-0000-4000-8000-000000000005', 'cafebabe-0000-4000-8000-000000000001', 'egreso', 'Sueldos', 'Honorarios staff', 12),
  ('caf04e40-0000-4000-8000-000000000006', 'cafebabe-0000-4000-8000-000000000001', 'egreso', 'Mantenimiento', 'Equipamiento y colchonetas', 13),
  ('caf04e40-0000-4000-8000-000000000007', 'cafebabe-0000-4000-8000-000000000001', 'egreso', 'Internet', 'Proveedor fibra', 14);

INSERT INTO public.plantillas_clases (
  id, franquicia_id, nombre, instructor_id, horario, dia_semana, cupo_maximo, orden, activo, valid_from, valid_to
) VALUES
  ('caf05e50-0000-4000-8000-000000000001', 'cafebabe-0000-4000-8000-000000000001', 'Jump matutino', 'caf01e10-0000-4000-8000-000000000001', '09:00', 'lun', 20, 1, true, '2026-02-01', NULL),
  ('caf05e50-0000-4000-8000-000000000002', 'cafebabe-0000-4000-8000-000000000001', 'Jump tarde', 'caf01e10-0000-4000-8000-000000000002', '18:30', 'mie', 22, 2, true, '2026-02-01', NULL),
  ('caf05e50-0000-4000-8000-000000000003', 'cafebabe-0000-4000-8000-000000000001', 'Power jump', 'caf01e10-0000-4000-8000-000000000004', '19:00', 'vie', 18, 3, true, '2026-02-01', NULL);

DO $$
DECLARE
  fid uuid := 'cafebabe-0000-4000-8000-000000000001';
  inst uuid;
  ns uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c1'::uuid;
  i int;
  uid uuid;
  sid uuid;
  pid uuid;
  nom text;
  em text;
  est text;
  mua date;
  ca timestamptz;
  pw_hash text;
  inst_ids uuid[] := ARRAY['caf01e10-0000-4000-8000-000000000001','caf01e10-0000-4000-8000-000000000002','caf01e10-0000-4000-8000-000000000003','caf01e10-0000-4000-8000-000000000004','caf01e10-0000-4000-8000-000000000005'];
  nombres text[] := ARRAY[
    'Lionel Messi','Antonela Roccuzzo','Santiago Martínez','Marisol Vega','Nicolás Otamendi',
    'Luciana Ferrer','Germán Pezzella','Carla Conti','Matías González','Florencia López',
    'Rodrigo De Paul','Paula Díaz','Emanuel Gómez','Julieta Romero','Tomás Acosta',
    'Lautaro Martínez','Agustina Casanova','Marcos Acuña','Micaela Suárez','Leandro Paredes',
    'Camila Gómez','Guido Rodríguez','Valentina Ruiz','Nahuel Molina','Bianca Fernández',
    'Emiliano Martínez','Rocío Montenegro','Ángel Di María','Soledad Ríos','Gonzalo Montiel'
  ];
BEGIN
  SELECT COALESCE((SELECT inn.id FROM auth.instances AS inn LIMIT 1), '00000000-0000-0000-0000-000000000000'::uuid) INTO inst;

  BEGIN
    pw_hash := extensions.crypt('JumpingClub_Seed2026!', extensions.gen_salt('bf'));
  EXCEPTION
    WHEN OTHERS THEN
      pw_hash := crypt('JumpingClub_Seed2026!', gen_salt('bf'));
  END;

  uid := uuid_generate_v5(ns, 'jc-bulk-admin');
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token,
    reauthentication_token,
    email_change_confirm_status,
    is_sso_user, is_anonymous
  ) VALUES (
    uid, inst, 'authenticated', 'authenticated', 'admin.bulk@seed.jumpingclub.local',
    pw_hash, timezone('utc'::text, now()),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    timezone('utc'::text, now()), timezone('utc'::text, now()),
    '', '',
    '', '', '',
    '', '',
    '',
    0::smallint,
    false, false
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), uid, uid::text,
    jsonb_build_object(
      'sub', uid::text,
      'email', 'admin.bulk@seed.jumpingclub.local',
      'email_verified', true
    ),
    'email', timezone('utc'::text, now()), timezone('utc'::text, now()), timezone('utc'::text, now())
  );
  INSERT INTO public.perfiles (id, rol, franquicia_id, nombre, email, created_at)
  VALUES (
    uid, 'admin_franquicia', fid, 'Carolina Ruiz (Admin bulk)', 'admin.bulk@seed.jumpingclub.local',
    '2026-02-05 12:00:00+00'::timestamptz
  );

  FOR i IN 1..30 LOOP
    uid := uuid_generate_v5(ns, 'jc-bulk-auth-' || i::text);
    sid := uuid_generate_v5(ns, 'jc-bulk-socio-' || i::text);
    nom := nombres[i];
    em := 'socio' || lpad(i::text, 2, '0') || '@bulk.seed.jumpingclub.local';
    IF i <= 20 THEN
      est := 'activo';
      mua := (DATE '2026-04-01' + (i % 20));
    ELSIF i <= 26 THEN
      est := 'vencido';
      mua := DATE '2026-01-15';
    ELSE
      est := 'inactivo';
      mua := DATE '2026-02-28';
    END IF;
    IF i <= 10 THEN
      ca := ('2026-02-' || lpad(((i * 2) % 27 + 1)::text, 2, '0') || ' 14:30:00+00')::timestamptz;
    ELSIF i <= 20 THEN
      ca := ('2026-03-' || lpad(((i * 3) % 28 + 1)::text, 2, '0') || ' 10:15:00+00')::timestamptz;
    ELSE
      ca := ('2026-04-' || lpad(((i * 5) % 25 + 1)::text, 2, '0') || ' 16:45:00+00')::timestamptz;
    END IF;
    pid := inst_ids[1 + ((i - 1) % 5)];

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token,
      reauthentication_token,
      email_change_confirm_status,
      is_sso_user, is_anonymous
    ) VALUES (
      uid, inst, 'authenticated', 'authenticated', em,
      pw_hash, timezone('utc'::text, now()),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      timezone('utc'::text, now()), timezone('utc'::text, now()),
      '', '',
      '', '', '',
      '', '',
      '',
      0::smallint,
      false, false
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true),
      'email', timezone('utc'::text, now()), timezone('utc'::text, now()), timezone('utc'::text, now())
    );
    INSERT INTO public.perfiles (id, rol, franquicia_id, nombre, email, created_at)
    VALUES (uid, 'socio', fid, nom, em, ca);
    INSERT INTO public.socios (
      id, perfil_id, franquicia_id, plan_id, instructor_id, dni, domicilio, provincia, telefono, mes_ultimo_aumento, estado
    ) VALUES (
      sid, uid, fid,
      CASE WHEN i % 2 = 0 THEN 'caf02e20-0000-4000-8000-000000000001'::uuid ELSE 'caf02e20-0000-4000-8000-000000000002'::uuid END,
      pid,
      lpad((20000000 + i)::text, 8, '0'),
      'Calle ' || i::text || ' 1200', 'CABA',
      '+54 9 11 6000-' || lpad(i::text, 4, '0'),
      mua, est
    );
  END LOOP;
END $$;

INSERT INTO public.clases (id, franquicia_id, instructor_id, nombre, fecha_hora, cupo_maximo, reservas_actuales, estado)
SELECT
  uuid_generate_v5('deadbeef-0000-4000-8000-000000000001'::uuid, 'jc-clase-' || g::text),
  'cafebabe-0000-4000-8000-000000000001'::uuid,
  (ARRAY[
    'caf01e10-0000-4000-8000-000000000001'::uuid,
    'caf01e10-0000-4000-8000-000000000002'::uuid,
    'caf01e10-0000-4000-8000-000000000003'::uuid,
    'caf01e10-0000-4000-8000-000000000004'::uuid,
    'caf01e10-0000-4000-8000-000000000005'::uuid
  ])[1 + ((g + 2) % 5)],
  CASE (g % 4)
    WHEN 0 THEN 'Jump matutino'
    WHEN 1 THEN 'Funcional trampolín'
    WHEN 2 THEN 'Stretch & bounce'
    ELSE 'Power jump'
  END,
  timezone('America/Argentina/Buenos_Aires'::text, ts),
  CASE WHEN g % 5 = 0 THEN 14 WHEN g % 5 = 1 THEN 18 WHEN g % 5 = 2 THEN 20 ELSE 16 END,
  0,
  'activa'
FROM generate_series(1, 30) AS g
CROSS JOIN LATERAL (
  SELECT (
    DATE '2026-03-30' + ((g * 11) % 42) * INTERVAL '1 day'
    + make_interval(hours => 7 + (g % 12), mins => (g * 13) % 55)
  )::timestamp AS ts
) t;

DO $$
DECLARE
  fid uuid := 'cafebabe-0000-4000-8000-000000000001';
  r_clase record;
  r_socio record;
  k int := 0;
  max_ins int := 95;
BEGIN
  FOR r_clase IN
    SELECT id, cupo_maximo FROM public.clases WHERE franquicia_id = fid ORDER BY fecha_hora, id
  LOOP
    FOR r_socio IN
      SELECT s.id FROM public.socios s
      JOIN public.perfiles p ON p.id = s.perfil_id
      WHERE s.franquicia_id = fid AND p.rol = 'socio' AND s.estado = 'activo'
      ORDER BY md5(r_clase.id::text || s.id::text)
      LIMIT LEAST(6, r_clase.cupo_maximo)
    LOOP
      BEGIN
        INSERT INTO public.inscripciones (clase_id, socio_id) VALUES (r_clase.id, r_socio.id);
        k := k + 1;
        EXIT WHEN k >= max_ins;
      EXCEPTION WHEN unique_violation THEN
        NULL;
      END;
    END LOOP;
    EXIT WHEN k >= max_ins;
  END LOOP;
END $$;

UPDATE public.clases c
SET reservas_actuales = sub.n
FROM (
  SELECT i.clase_id, COUNT(*)::int AS n
  FROM public.inscripciones i
  JOIN public.clases cl ON cl.id = i.clase_id
  WHERE cl.franquicia_id = 'cafebabe-0000-4000-8000-000000000001'::uuid
  GROUP BY i.clase_id
) sub
WHERE c.id = sub.clase_id AND c.franquicia_id = 'cafebabe-0000-4000-8000-000000000001'::uuid;

INSERT INTO public.movimientos_caja (
  id, franquicia_id, socio_id, concepto_id, forma_pago_id, tipo, monto, fecha, observaciones, estado, fecha_vencimiento
)
SELECT
  gen_random_uuid(),
  'cafebabe-0000-4000-8000-000000000001'::uuid,
  s.id,
  'caf04e40-0000-4000-8000-000000000001'::uuid,
  CASE WHEN g % 2 = 0 THEN 'caf03e30-0000-4000-8000-000000000001'::uuid ELSE 'caf03e30-0000-4000-8000-000000000002'::uuid END,
  'ingreso',
  (43000 + (g * 97) % 12000)::numeric,
  timezone('utc', ('2026-02-01'::timestamp + ((g * 3) % 58) * INTERVAL '1 day' + make_interval(hours => 10 + (g % 8), mins => (g * 5) % 50))),
  'Cuota pagada (hist. Feb–Mar)',
  'pagado',
  NULL
FROM generate_series(1, 40) g
CROSS JOIN LATERAL (
  SELECT id FROM public.socios
  WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001'::uuid AND estado = 'activo'
  ORDER BY id LIMIT 1 OFFSET ((g + 3) % 20)
) s;

INSERT INTO public.movimientos_caja (
  id, franquicia_id, socio_id, concepto_id, forma_pago_id, tipo, monto, fecha, observaciones, estado, fecha_vencimiento
)
SELECT
  gen_random_uuid(),
  'cafebabe-0000-4000-8000-000000000001'::uuid,
  NULL,
  CASE ((g - 1) % 3)
    WHEN 0 THEN 'caf04e40-0000-4000-8000-000000000003'::uuid
    WHEN 1 THEN 'caf04e40-0000-4000-8000-000000000004'::uuid
    ELSE 'caf04e40-0000-4000-8000-000000000005'::uuid
  END,
  'caf03e30-0000-4000-8000-000000000002'::uuid,
  'egreso',
  CASE ((g - 1) % 3)
    WHEN 0 THEN (70000 + g * 1200)::numeric
    WHEN 1 THEN (400000 + g * 3500)::numeric
    ELSE (190000 + g * 1800)::numeric
  END,
  timezone('utc', ('2026-02-08'::timestamp + (g * 5 + (g % 3)) * INTERVAL '1 day' + make_interval(hours => 9, mins => (g * 7) % 50))),
  CASE ((g - 1) % 3)
    WHEN 0 THEN 'Luz Feb–Mar'
    WHEN 1 THEN 'Alquiler Feb–Mar'
    ELSE 'Sueldos Feb–Mar'
  END,
  'pagado',
  NULL
FROM generate_series(1, 10) g;

INSERT INTO public.movimientos_caja (
  id, franquicia_id, socio_id, concepto_id, forma_pago_id, tipo, monto, fecha, observaciones, estado, fecha_vencimiento
)
SELECT
  gen_random_uuid(),
  'cafebabe-0000-4000-8000-000000000001'::uuid,
  s.id,
  'caf04e40-0000-4000-8000-000000000001'::uuid,
  CASE WHEN g % 2 = 0 THEN 'caf03e30-0000-4000-8000-000000000001'::uuid ELSE 'caf03e30-0000-4000-8000-000000000002'::uuid END,
  'ingreso',
  (45000 + (g * 83) % 9000)::numeric,
  timezone('utc', ('2026-04-01'::timestamp + ((g * 2) % 26) * INTERVAL '1 day' + make_interval(hours => 11 + (g % 6), mins => 10 + (g % 40)))),
  'Cuota abril pagada',
  'pagado',
  NULL
FROM generate_series(1, 15) g
CROSS JOIN LATERAL (
  SELECT id FROM public.socios
  WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001'::uuid AND estado = 'activo'
  ORDER BY id LIMIT 1 OFFSET ((g + 1) % 20)
) s;

INSERT INTO public.movimientos_caja (
  id, franquicia_id, socio_id, concepto_id, forma_pago_id, tipo, monto, fecha, observaciones, estado, fecha_vencimiento
)
SELECT
  gen_random_uuid(),
  'cafebabe-0000-4000-8000-000000000001'::uuid,
  NULL,
  cid,
  'caf03e30-0000-4000-8000-000000000002'::uuid,
  'egreso',
  mont,
  timezone('utc', ('2026-04-03'::timestamp + (g * 5) * INTERVAL '1 day')),
  obs,
  'pagado',
  NULL
FROM generate_series(1, 5) g
CROSS JOIN LATERAL (
  SELECT * FROM (VALUES
    (1, 'caf04e40-0000-4000-8000-000000000003'::uuid, 88500::numeric, 'Luz abril'),
    (2, 'caf04e40-0000-4000-8000-000000000004'::uuid, 410000::numeric, 'Alquiler abril'),
    (3, 'caf04e40-0000-4000-8000-000000000005'::uuid, 178000::numeric, 'Sueldos abril'),
    (4, 'caf04e40-0000-4000-8000-000000000006'::uuid, 42000::numeric, 'Mantenimiento abril'),
    (5, 'caf04e40-0000-4000-8000-000000000007'::uuid, 19200::numeric, 'Internet abril')
  ) t(idx, cid, mont, obs)
  WHERE t.idx = g
) x;

INSERT INTO public.movimientos_caja (
  id, franquicia_id, socio_id, concepto_id, forma_pago_id, tipo, monto, fecha, observaciones, estado, fecha_vencimiento
)
SELECT
  gen_random_uuid(),
  'cafebabe-0000-4000-8000-000000000001'::uuid,
  s.id,
  'caf04e40-0000-4000-8000-000000000001'::uuid,
  'caf03e30-0000-4000-8000-000000000002'::uuid,
  'ingreso',
  (52000 + g * 500)::numeric,
  timezone('utc', '2026-04-12 10:00:00'::timestamp),
  'Cuota abril — pendiente vencida',
  'pendiente',
  DATE '2026-04-10'
FROM generate_series(1, 6) g
CROSS JOIN LATERAL (
  SELECT id FROM public.socios
  WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001'::uuid AND estado IN ('activo', 'vencido')
  ORDER BY id LIMIT 1 OFFSET ((g + 11) % 26)
) s;

INSERT INTO public.movimientos_caja (
  id, franquicia_id, socio_id, concepto_id, forma_pago_id, tipo, monto, fecha, observaciones, estado, fecha_vencimiento
)
SELECT
  gen_random_uuid(),
  'cafebabe-0000-4000-8000-000000000001'::uuid,
  s.id,
  'caf04e40-0000-4000-8000-000000000001'::uuid,
  'caf03e30-0000-4000-8000-000000000002'::uuid,
  'ingreso',
  (51000 + g * 400)::numeric,
  timezone('utc', '2026-04-20 12:00:00'::timestamp),
  'Cuota mayo — pendiente',
  'pendiente',
  DATE '2026-05-10'
FROM generate_series(1, 10) g
CROSS JOIN LATERAL (
  SELECT id FROM public.socios
  WHERE franquicia_id = 'cafebabe-0000-4000-8000-000000000001'::uuid AND estado = 'activo'
  ORDER BY id LIMIT 1 OFFSET ((g + 5) % 20)
) s;

INSERT INTO public.movimientos_caja (
  id, franquicia_id, socio_id, concepto_id, forma_pago_id, tipo, monto, fecha, observaciones, estado, fecha_vencimiento
)
SELECT
  gen_random_uuid(),
  'cafebabe-0000-4000-8000-000000000001'::uuid,
  NULL,
  cid,
  'caf03e30-0000-4000-8000-000000000002'::uuid,
  'egreso',
  mont,
  timezone('utc', ('2026-04-28'::timestamp + (g * 2) * INTERVAL '1 day')),
  obs,
  'pendiente',
  venc
FROM generate_series(1, 3) g
CROSS JOIN LATERAL (
  SELECT * FROM (VALUES
    (1, 'caf04e40-0000-4000-8000-000000000004'::uuid, 410000::numeric, 'Alquiler mayo (pendiente)', DATE '2026-05-03'),
    (2, 'caf04e40-0000-4000-8000-000000000003'::uuid, 91000::numeric, 'Luz / servicios mayo (pendiente)', DATE '2026-05-02'),
    (3, 'caf04e40-0000-4000-8000-000000000007'::uuid, 20100::numeric, 'Internet mayo (pendiente)', DATE '2026-05-04')
  ) t(idx, cid, mont, obs, venc)
  WHERE t.idx = g
) x;

COMMIT;

-- franquicia_id: cafebabe-0000-4000-8000-000000000001
-- Contraseña seed (Auth): JumpingClub_Seed2026!  (mayúsculas, minúsculas, número y símbolo)
-- admin → admin.bulk@seed.jumpingclub.local
-- socios → socio01@bulk.seed.jumpingclub.local … socio30@bulk.seed.jumpingclub.local
-- (la tabla public.socios no tiene created_at; la “alta” simulada está en perfiles.created_at)
--
-- Si el login devolvía "Database error querying schema", corré (una vez) en SQL Editor:
-- UPDATE auth.users SET
--   confirmation_token = COALESCE(confirmation_token, ''),
--   recovery_token = COALESCE(recovery_token, ''),
--   email_change = COALESCE(email_change, ''),
--   email_change_token_new = COALESCE(email_change_token_new, ''),
--   email_change_token_current = COALESCE(email_change_token_current, ''),
--   phone_change = COALESCE(phone_change, ''),
--   phone_change_token = COALESCE(phone_change_token, ''),
--   reauthentication_token = COALESCE(reauthentication_token, ''),
--   is_sso_user = COALESCE(is_sso_user, false),
--   is_anonymous = COALESCE(is_anonymous, false)
-- WHERE email = 'admin.bulk@seed.jumpingclub.local' OR email LIKE '%@bulk.seed.jumpingclub.local';
--
-- Re-hash contraseña si hace falta:
-- UPDATE auth.users SET encrypted_password = extensions.crypt('JumpingClub_Seed2026!', extensions.gen_salt('bf'))
-- WHERE email = 'admin.bulk@seed.jumpingclub.local' OR email LIKE '%@bulk.seed.jumpingclub.local';
