-- 1. Tabla de Franquicias (Casa central y sedes)
CREATE TABLE franquicias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tabla de Perfiles (Maneja los Roles y se vincula con auth.users de Supabase)
CREATE TABLE perfiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  rol TEXT NOT NULL CHECK (rol IN ('admin_global', 'admin_franquicia', 'socio')),
  franquicia_id UUID REFERENCES franquicias(id) ON DELETE CASCADE, -- Es NULL si el rol es admin_global
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Tabla de Instructores
CREATE TABLE instructores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  franquicia_id UUID REFERENCES franquicias(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  estado TEXT DEFAULT 'activo'
);

-- 4. Tabla de Planes
CREATE TABLE planes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  franquicia_id UUID REFERENCES franquicias(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  precio NUMERIC NOT NULL,
  version TEXT DEFAULT 'v1',
  estado TEXT DEFAULT 'activo'
);

-- 5. Tabla de Socios (Ficha operativa del alumno, vinculada a su Perfil)
CREATE TABLE socios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  perfil_id UUID REFERENCES perfiles(id) ON DELETE CASCADE, -- Link a su usuario y contraseña
  franquicia_id UUID REFERENCES franquicias(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES planes(id),
  telefono TEXT,
  mes_ultimo_aumento DATE NOT NULL DEFAULT CURRENT_DATE,
  estado TEXT DEFAULT 'activo'
);

-- 6. Tabla de Pagos
CREATE TABLE pagos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  franquicia_id UUID REFERENCES franquicias(id) ON DELETE CASCADE,
  socio_id UUID REFERENCES socios(id) ON DELETE CASCADE,
  monto NUMERIC NOT NULL,
  nombre_plan_historico TEXT NOT NULL,
  mes_correspondiente TEXT NOT NULL,
  fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. Tabla de Clases
CREATE TABLE clases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  franquicia_id UUID REFERENCES franquicias(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES instructores(id),
  nombre TEXT NOT NULL,
  fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  cupo_maximo INTEGER NOT NULL DEFAULT 20,
  reservas_actuales INTEGER DEFAULT 0
);
