"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveFranquiciaId(
  userId: string,
  admin: ReturnType<typeof getAdminClient>,
) {
  if (!admin) return { franquiciaId: null as string | null, error: "Cliente de Supabase no disponible" };
  const { data, error } = await admin
    .from("perfiles")
    .select("franquicia_id")
    .eq("id", userId)
    .single();
  if (error) return { franquiciaId: null as string | null, error: error.message };
  return { franquiciaId: data?.franquicia_id ?? null, error: null };
}

type ActualizarMinutosLimiteBajaInput = {
  userId: string;
  minutos: number;
};

export async function actualizarMinutosLimiteBajaInscripcionAction(
  input: ActualizarMinutosLimiteBajaInput,
) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const minutos = Math.round(Number(input.minutos));
    if (!Number.isFinite(minutos) || minutos < 0 || minutos > 10_080) {
      return {
        ok: false as const,
        error: "El tiempo límite debe estar entre 0 y 10080 minutos (7 días).",
      };
    }

    const { franquiciaId, error: franquiciaError } = await resolveFranquiciaId(input.userId, admin);
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const { error } = await admin
      .from("franquicias")
      .update({ minutos_limite_baja_inscripcion: minutos })
      .eq("id", franquiciaId);

    if (error) return { ok: false as const, error: error.message };

    revalidatePath("/configuracion");
    revalidatePath("/calendario");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la política de bajas",
    };
  }
}

export async function getFranquiciaDetalleByIdAction(franquiciaId: string) {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return { ok: false as const, error: "Faltan variables de entorno de Supabase" };
    }

    const { data, error } = await admin
      .from("franquicias")
      .select("id,nombre,direccion")
      .eq("id", franquiciaId)
      .single();

    if (error || !data) return { ok: false as const, error: error?.message ?? "Franquicia no encontrada" };

    return {
      ok: true as const,
      data: {
        id: data.id,
        nombre: data.nombre,
        direccion: data.direccion ?? "",
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo obtener el detalle de la franquicia",
    };
  }
}
