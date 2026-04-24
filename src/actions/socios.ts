"use server";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type RegistrarSocioInput = {
  nombre: string;
  email: string;
  telefono?: string | null;
  dni: string;
  planId: string;
  franquiciaId: string;
};

export async function registrarSocioAction(input: RegistrarSocioInput) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false as const,
      error:
        "Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
    };
  }

  if (!input.email || !input.dni || !input.planId || !input.franquiciaId) {
    return { ok: false as const, error: "Datos incompletos para registrar socio" };
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.dni,
    email_confirm: true,
    user_metadata: { nombre: input.nombre },
  });

  if (userError || !userData.user) {
    return {
      ok: false as const,
      error: userError?.message ?? "No se pudo crear el usuario en auth",
    };
  }

  const userId = userData.user.id;

  const { error: perfilError } = await admin.from("perfiles").insert({
    id: userId,
    rol: "socio",
    franquicia_id: input.franquiciaId,
    nombre: input.nombre,
    email: input.email,
  });

  if (perfilError) {
    await admin.auth.admin.deleteUser(userId);
    return {
      ok: false as const,
      error: perfilError.message,
    };
  }

  const { error: socioError } = await admin.from("socios").insert({
    perfil_id: userId,
    franquicia_id: input.franquiciaId,
    plan_id: input.planId,
    telefono: input.telefono ?? null,
    estado: "activo",
  });

  if (socioError) {
    await admin.from("perfiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    return {
      ok: false as const,
      error: socioError.message,
    };
  }

  return { ok: true as const, userId };
}
