"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type RegistrarSocioInput = {
  nombre: string;
  email: string;
  telefono?: string | null;
  dni: string;
  domicilio?: string | null;
  provincia?: string | null;
  instructorId: string;
  planId: string;
  franquiciaId: string;
};

function toTitleCase(str: string) {
  return str
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function mesActualIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

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

  if (
    !input.email ||
    !input.dni ||
    !input.planId ||
    !input.instructorId ||
    !input.franquiciaId
  ) {
    return { ok: false as const, error: "Datos incompletos para registrar socio" };
  }

  const nombreNormalizado = toTitleCase(input.nombre.trim());
  const domicilioNormalizado = toTitleCase((input.domicilio ?? "").trim());
  const provinciaNormalizada = toTitleCase((input.provincia ?? "").trim());

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.dni,
    email_confirm: true,
    user_metadata: { nombre: nombreNormalizado },
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
    nombre: nombreNormalizado,
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
    instructor_id: input.instructorId,
    dni: input.dni,
    domicilio: domicilioNormalizado,
    provincia: provinciaNormalizada,
    telefono: input.telefono ?? null,
    mes_ultimo_aumento: mesActualIsoDate(),
    estado: "vencido",
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

type UpdateSocioInput = {
  socioId: string;
  perfilId: string;
  franquiciaId: string;
  planId: string;
  instructorId: string;
  dni: string;
  domicilio: string;
  provincia: string;
  telefono?: string | null;
  nombre: string;
  email: string;
};

export async function updateSocioAction(input: UpdateSocioInput) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return {
        ok: false as const,
        error:
          "Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
      };
    }

    if (
      !input.socioId ||
      !input.perfilId ||
      !input.franquiciaId ||
      !input.planId ||
      !input.instructorId ||
      !input.dni
    ) {
      return { ok: false as const, error: "Datos incompletos para actualizar socio" };
    }

    const nombreNormalizado = toTitleCase(input.nombre.trim());
    const domicilioNormalizado = toTitleCase((input.domicilio ?? "").trim());
    const provinciaNormalizada = toTitleCase((input.provincia ?? "").trim());

    const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: socioError } = await admin
      .from("socios")
      .update({
        plan_id: input.planId,
        instructor_id: input.instructorId,
        dni: input.dni,
        domicilio: domicilioNormalizado,
        provincia: provinciaNormalizada,
        telefono: input.telefono ?? null,
      })
      .eq("id", input.socioId)
      .eq("franquicia_id", input.franquiciaId);

    if (socioError) {
      return { ok: false as const, error: socioError.message };
    }

    const { error: perfilError } = await admin
      .from("perfiles")
      .update({
        nombre: nombreNormalizado,
        email: input.email,
      })
      .eq("id", input.perfilId)
      .eq("franquicia_id", input.franquiciaId);

    if (perfilError) {
      return { ok: false as const, error: perfilError.message };
    }

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo actualizar el socio",
    };
  }
}

type ToggleEstadoSocioInput = {
  socioId: string;
  nuevoEstado: "activo" | "vencido" | "inactivo";
};

export async function toggleEstadoSocioAction(input: ToggleEstadoSocioInput) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return {
        ok: false as const,
        error:
          "Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
      };
    }
    if (!input.socioId || !input.nuevoEstado) {
      return { ok: false as const, error: "Datos incompletos para cambiar estado" };
    }

    const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await admin
      .from("socios")
      .update({ estado: input.nuevoEstado })
      .eq("id", input.socioId);
    if (error) return { ok: false as const, error: error.message };

    revalidatePath("/socios");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo cambiar el estado del socio",
    };
  }
}
