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
  /** Si se envía, debe ser un admin de la misma franquicia que la clase; omite el bloqueo por socio vencido/inactivo. */
  operatorUserId?: string | null;
};

type DesinscribirSocioDeClaseInput = {
  userId: string;
  claseId: string;
};

type GetCalendarioFranquiciaDataInput = {
  franquiciaId: string;
  year: number;
  month: number;
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
      .select("id,estado,franquicia_id,plan:planes(id,nombre,clases_por_semana)")
      .eq("id", input.socioId)
      .maybeSingle();
    if (socioError || !socio?.id) {
      return { ok: false as const, error: socioError?.message ?? "Socio no encontrado" };
    }

    const { data: clase, error: claseError } = await admin
      .from("clases")
      .select("id,cupo_maximo,reservas_actuales,franquicia_id,fecha_hora")
      .eq("id", input.claseId)
      .single();
    if (claseError || !clase) {
      return { ok: false as const, error: claseError?.message ?? "Clase no encontrada" };
    }

    const socioFranquicia = String(socio.franquicia_id ?? "");
    const claseFranquicia = String(clase.franquicia_id ?? "");
    if (!socioFranquicia || !claseFranquicia || socioFranquicia !== claseFranquicia) {
      return { ok: false as const, error: "El socio y la clase deben pertenecer a la misma franquicia" };
    }

    let inscripcionComoAdmin = false;
    if (input.operatorUserId) {
      const { data: operador, error: operadorError } = await admin
        .from("perfiles")
        .select("rol,franquicia_id")
        .eq("id", input.operatorUserId)
        .maybeSingle();
      if (operadorError || !operador) {
        return { ok: false as const, error: "No se pudo validar al operador" };
      }
      const rol = operador.rol as string;
      if (rol !== "admin_franquicia" && rol !== "admin_global") {
        return { ok: false as const, error: "Solo un administrador puede inscribir a otro socio" };
      }
      if (rol === "admin_franquicia") {
        const opF = String(operador.franquicia_id ?? "");
        if (!opF || opF !== socioFranquicia || opF !== claseFranquicia) {
          return { ok: false as const, error: "No tenés permiso para inscribir en esta franquicia" };
        }
      }
      inscripcionComoAdmin = true;
    }

    if (!inscripcionComoAdmin) {
      const estadoSocio = String(socio.estado ?? "").toLowerCase();
      if (estadoSocio === "inactivo") {
        return {
          ok: false as const,
          error: "No se puede inscribir porque el socio está inactivo.",
        };
      }
    }

    const cupoMaximo = Number(clase.cupo_maximo ?? 0);
    const reservasActuales = Number(clase.reservas_actuales ?? 0);
    if (reservasActuales >= cupoMaximo) {
      return { ok: false as const, error: "Cupo lleno" };
    }

    const { data: existente, error: existeError } = await admin
      .from("inscripciones" as never)
      .select("id")
      .eq("clase_id", input.claseId)
      .eq("socio_id", input.socioId)
      .maybeSingle();
    if (existeError) return { ok: false as const, error: existeError.message };
    if ((existente as { id?: string } | null)?.id) return { ok: true as const };

    const maxSemanal = Number(
      (
        socio as {
          plan?: { clases_por_semana?: number | null; nombre?: string | null } | null;
        }
      ).plan?.clases_por_semana ?? 0,
    );
    if (Number.isFinite(maxSemanal) && maxSemanal > 0) {
      const claseDate = new Date(String(clase.fecha_hora ?? ""));
      if (!Number.isNaN(claseDate.getTime())) {
        const weekday = claseDate.getDay();
        const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
        const weekStart = new Date(claseDate);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() + diffToMonday);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const { data: inscripcionesSemana, error: inscripcionesSemanaError } = await admin
          .from("inscripciones" as never)
          .select("clase:clases(fecha_hora,estado)")
          .eq("socio_id", input.socioId);
        if (inscripcionesSemanaError) {
          return { ok: false as const, error: inscripcionesSemanaError.message };
        }

        const usadas = ((inscripcionesSemana ?? []) as Array<{
          clase?: { fecha_hora?: string | null; estado?: string | null } | null;
        }>)
          .map((row) => row.clase)
          .filter(
            (claseRow): claseRow is { fecha_hora?: string | null; estado?: string | null } =>
              Boolean(claseRow),
          )
          .filter((claseRow) => {
            const estado = String(claseRow.estado ?? "").toLowerCase();
            if (estado === "cancelada") return false;
            const t = Date.parse(String(claseRow.fecha_hora ?? ""));
            if (!Number.isFinite(t)) return false;
            return t >= weekStart.getTime() && t < weekEnd.getTime();
          }).length;

        if (usadas >= maxSemanal) {
          return {
            ok: false as const,
            error: `Tu plan permite hasta ${maxSemanal} inscripciones por semana.`,
          };
        }
      }
    }

    const { error: inscripcionError } = await admin.from("inscripciones" as never).insert({
      clase_id: input.claseId,
      socio_id: input.socioId,
    } as never);
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

    const { data, error } = await admin
      .from("inscripciones" as never)
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

export async function desinscribirSocioDeClaseAction(input: DesinscribirSocioDeClaseInput) {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return { ok: false as const, error: "Faltan variables de entorno de Supabase" };
    }
    if (!input.claseId || !input.userId) {
      return { ok: false as const, error: "Datos incompletos para darse de baja" };
    }

    const { data: socio, error: socioError } = await admin
      .from("socios")
      .select("id,franquicia_id")
      .eq("perfil_id", input.userId)
      .maybeSingle();
    if (socioError || !socio?.id) {
      return { ok: false as const, error: socioError?.message ?? "Socio no encontrado" };
    }

    const { data: clase, error: claseError } = await admin
      .from("clases")
      .select("id,franquicia_id,fecha_hora")
      .eq("id", input.claseId)
      .maybeSingle();
    if (claseError || !clase?.id) {
      return { ok: false as const, error: claseError?.message ?? "Clase no encontrada" };
    }
    if (String(clase.franquicia_id) !== String(socio.franquicia_id)) {
      return { ok: false as const, error: "La clase no pertenece a tu franquicia" };
    }

    const { data: franquicia, error: franquiciaError } = await admin
      .from("franquicias")
      .select("minutos_limite_baja_inscripcion")
      .eq("id", clase.franquicia_id as string)
      .maybeSingle();
    if (franquiciaError) {
      return { ok: false as const, error: franquiciaError.message };
    }

    const minutosLimite = Number(franquicia?.minutos_limite_baja_inscripcion ?? 30);
    const limiteMs = Math.max(0, minutosLimite) * 60 * 1000;
    const inicioMs = Date.parse(String(clase.fecha_hora ?? ""));
    if (!Number.isFinite(inicioMs)) {
      return { ok: false as const, error: "No se pudo interpretar la fecha de la clase" };
    }
    const cierreBajaMs = inicioMs - limiteMs;
    if (Date.now() >= cierreBajaMs) {
      return {
        ok: false as const,
        error: `Ya no podés darte de baja: faltan menos de ${minutosLimite} minutos para el inicio de la clase.`,
      };
    }

    const { data: inscripcion, error: insSelectError } = await admin
      .from("inscripciones")
      .select("id")
      .eq("clase_id", input.claseId)
      .eq("socio_id", socio.id)
      .maybeSingle();
    if (insSelectError) return { ok: false as const, error: insSelectError.message };
    if (!inscripcion?.id) {
      return { ok: false as const, error: "No estás inscripto en esta clase" };
    }

    const { error: deleteError } = await admin
      .from("inscripciones")
      .delete()
      .eq("id", inscripcion.id as string);
    if (deleteError) return { ok: false as const, error: deleteError.message };

    const { count, error: countError } = await admin
      .from("inscripciones")
      .select("id", { count: "exact", head: true })
      .eq("clase_id", input.claseId);
    if (countError) return { ok: false as const, error: countError.message };

    const { error: updateClaseError } = await admin
      .from("clases")
      .update({ reservas_actuales: count ?? 0 })
      .eq("id", input.claseId);
    if (updateClaseError) return { ok: false as const, error: updateClaseError.message };

    revalidatePath("/calendario");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo completar la baja",
    };
  }
}

export async function getCalendarioFranquiciaDataAction(input: GetCalendarioFranquiciaDataInput) {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return { ok: false as const, error: "Faltan variables de entorno de Supabase" };
    }
    if (!input.franquiciaId) {
      return { ok: false as const, error: "Franquicia inválida" };
    }

    const firstDay = new Date(input.year, input.month, 1);
    const lastDay = new Date(input.year, input.month + 1, 0);
    const from = `${firstDay.toISOString().slice(0, 10)}T00:00:00`;
    const to = `${lastDay.toISOString().slice(0, 10)}T23:59:59`;

    const [{ data: instRows }, { data: tplRows }, { data: claseRows }, { data: canceladasRows }] =
      await Promise.all([
        admin
          .from("instructores")
          .select("id,nombre")
          .eq("franquicia_id", input.franquiciaId)
          .order("nombre", { ascending: true }),
        admin
          .from("plantillas_clases")
          .select("id,nombre,instructor_id,horario,dia_semana,valid_from,valid_to")
          .eq("franquicia_id", input.franquiciaId)
          .eq("activo", true)
          .order("horario", { ascending: true }),
        admin
          .from("clases")
          .select("id,nombre,instructor_id,fecha_hora,cupo_maximo,reservas_actuales,estado")
          .eq("franquicia_id", input.franquiciaId)
          .eq("estado", "activa")
          .gte("fecha_hora", from)
          .lte("fecha_hora", to)
          .order("fecha_hora", { ascending: true }),
        admin
          .from("clases")
          .select("nombre,instructor_id,fecha_hora")
          .eq("franquicia_id", input.franquiciaId)
          .eq("estado", "cancelada")
          .gte("fecha_hora", from)
          .lte("fecha_hora", to),
      ]);

    return {
      ok: true as const,
      data: {
        instructores: (instRows ?? []).map((x) => ({
          id: x.id ?? "",
          nombre: x.nombre ?? "",
        })),
        templates: (tplRows ?? []).map((x) => ({
          id: x.id,
          nombre: x.nombre,
          instructorId: x.instructor_id,
          horario: x.horario,
          diaSemana: x.dia_semana,
          validFrom: x.valid_from ?? null,
          validTo: x.valid_to ?? null,
        })),
        programadas: (claseRows ?? []).map((row) => ({
          id: row.id,
          nombre: row.nombre ?? "",
          instructorId: row.instructor_id ?? "",
          fechaHora: row.fecha_hora,
          cupoMaximo: row.cupo_maximo ?? 20,
          reservasActuales: row.reservas_actuales ?? 0,
          estado: row.estado ?? "activa",
        })),
        canceladas: (canceladasRows ?? []).map((row) => ({
          nombre: row.nombre ?? "",
          instructorId: row.instructor_id ?? "",
          fechaHora: row.fecha_hora,
        })),
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo obtener el calendario",
    };
  }
}
