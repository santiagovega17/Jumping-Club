"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type UpdateClaseInput = {
  claseId: string;
  franquiciaId: string;
  nombre: string;
  instructorId: string;
  fechaHora?: string;
  cupoMaximo: number;
};

type GetClaseHistorialInput = {
  claseId: string;
  franquiciaId: string;
};

type InscribirSocioEnClaseInput = {
  claseId: string;
  socioId: string;
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function updateClaseWithHistoryAction(input: UpdateClaseInput) {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return {
        ok: false as const,
        error: "Faltan variables de entorno de Supabase",
      };
    }
    const { data: actual, error: selectError } = await admin
      .from("clases")
      .select("id,nombre,instructor_id,fecha_hora")
      .eq("id", input.claseId)
      .eq("franquicia_id", input.franquiciaId)
      .single();
    if (selectError || !actual) {
      return { ok: false as const, error: selectError?.message ?? "Clase no encontrada" };
    }

    // Registra snapshot antes del update; la fecha/hora nueva se mantiene igual a la actual
    // porque fecha_hora es inmutable por regla de negocio.
    const { error: historialError } = await admin.from("clases_historial").insert({
      clase_id: actual.id,
      franquicia_id: input.franquiciaId,
      nombre_anterior: actual.nombre,
      instructor_id_anterior: actual.instructor_id,
      fecha_hora_anterior: actual.fecha_hora,
      nombre_nuevo: input.nombre,
      instructor_id_nuevo: input.instructorId,
      fecha_hora_nuevo: actual.fecha_hora,
    });
    if (historialError) {
      return { ok: false as const, error: historialError.message };
    }

    const { error: updateError } = await admin
      .from("clases")
      .update({
        nombre: input.nombre,
        instructor_id: input.instructorId,
        cupo_maximo: input.cupoMaximo,
        estado: "activa",
      })
      .eq("id", input.claseId)
      .eq("franquicia_id", input.franquiciaId);
    if (updateError) {
      return { ok: false as const, error: updateError.message };
    }

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo actualizar la clase",
    };
  }
}

export async function getClaseHistorialAction(input: GetClaseHistorialInput) {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return {
        ok: false as const,
        error: "Faltan variables de entorno de Supabase",
        rows: [] as Array<Database["public"]["Tables"]["clases_historial"]["Row"]>,
      };
    }

    const { data, error } = await admin
      .from("clases_historial")
      .select("*")
      .eq("clase_id", input.claseId)
      .eq("franquicia_id", input.franquiciaId)
      .order("editado_en", { ascending: false });

    if (error) {
      return { ok: false as const, error: error.message, rows: [] as Array<Database["public"]["Tables"]["clases_historial"]["Row"]> };
    }
    return { ok: true as const, rows: data ?? [] };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo cargar el historial",
      rows: [] as Array<Database["public"]["Tables"]["clases_historial"]["Row"]>,
    };
  }
}

export async function inscribirSocioEnClase(input: InscribirSocioEnClaseInput) {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return { ok: false as const, error: "Faltan variables de entorno de Supabase" };
    }
    if (!input.claseId || !input.socioId) {
      return { ok: false as const, error: "Datos incompletos para inscribir" };
    }

    const { data: socio, error: socioError } = await admin
      .from("socios")
      .select("id,estado")
      .eq("id", input.socioId)
      .maybeSingle();
    if (socioError || !socio?.id) {
      return { ok: false as const, error: socioError?.message ?? "Socio no encontrado" };
    }
    const estadoSocio = String(socio.estado ?? "").toLowerCase();
    if (estadoSocio === "vencido" || estadoSocio === "inactivo") {
      return {
        ok: false as const,
        error: "No se puede inscribir porque su cuota está vencida o pendiente de pago.",
      };
    }

    const { data: clase, error: claseError } = await admin
      .from("clases")
      .select("id,cupo_maximo,reservas_actuales")
      .eq("id", input.claseId)
      .single();
    if (claseError || !clase) {
      return { ok: false as const, error: claseError?.message ?? "Clase no encontrada" };
    }

    const cupoMaximo = Number(clase.cupo_maximo ?? 0);
    const reservasActuales = Number(clase.reservas_actuales ?? 0);
    if (reservasActuales >= cupoMaximo) {
      return { ok: false as const, error: "Cupo lleno" };
    }

    const adminAny = admin as unknown as {
      from: (table: string) => {
        select: (columns: string) => any;
        insert: (values: Record<string, unknown>) => any;
      };
    };

    const { data: existente, error: existeError } = await adminAny
      .from("inscripciones")
      .select("id")
      .eq("clase_id", input.claseId)
      .eq("socio_id", input.socioId)
      .maybeSingle();
    if (existeError) return { ok: false as const, error: existeError.message };
    if (existente?.id) return { ok: true as const };

    const { error: inscripcionError } = await adminAny.from("inscripciones").insert({
      clase_id: input.claseId,
      socio_id: input.socioId,
    });
    if (inscripcionError) return { ok: false as const, error: inscripcionError.message };

    const { error: updateError } = await admin
      .from("clases")
      .update({ reservas_actuales: reservasActuales + 1 })
      .eq("id", input.claseId)
      .eq("reservas_actuales", reservasActuales);
    if (updateError) {
      return { ok: false as const, error: "No se pudo confirmar la inscripción" };
    }

    revalidatePath("/calendario");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo inscribir el socio",
    };
  }
}

export async function getInscriptosPorClaseAction(claseId: string) {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return { ok: false as const, error: "Faltan variables de entorno de Supabase", data: [] as Array<{ socioId: string; nombre: string }> };
    }
    if (!claseId) return { ok: true as const, data: [] as Array<{ socioId: string; nombre: string }> };

    const adminAny = admin as unknown as {
      from: (table: string) => {
        select: (columns: string) => any;
      };
    };

    const { data, error } = await adminAny
      .from("inscripciones")
      .select("socio_id,socio:socios(id,perfil:perfiles(nombre))")
      .eq("clase_id", claseId)
      .order("nombre", { ascending: true, foreignTable: "socio.perfil" });
    if (error) return { ok: false as const, error: error.message, data: [] as Array<{ socioId: string; nombre: string }> };

    const rows = (data ?? []).map((row: { socio_id?: string; socio?: { perfil?: { nombre?: string | null } | null } | null }) => ({
      socioId: row.socio_id ?? "",
      nombre: row.socio?.perfil?.nombre ?? "Sin nombre",
    })).filter((row: { socioId: string; nombre: string }) => Boolean(row.socioId));

    return { ok: true as const, data: rows };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudieron obtener los inscriptos",
      data: [] as Array<{ socioId: string; nombre: string }>,
    };
  }
}
