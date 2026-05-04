"use server";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { formatPlanLabel } from "@/lib/plan-label";

type PerfilVista = {
  nombre: string;
  plan: string;
  vencimiento: string | null;
  email: string;
  telefono: string;
  estado: string;
  proximaClase: {
    nombre: string;
    fechaHora: string;
    instructor: string | null;
  } | null;
  clasesAsistidasSemana: number;
};

type UpdateMiPerfilInput = {
  requesterUserId: string;
  nombre: string;
  email: string;
  telefono: string;
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getMiPerfilAction(
  requesterUserId: string,
): Promise<{ ok: true; data: PerfilVista } | { ok: false; error: string }> {
  try {
    if (!requesterUserId) {
      return { ok: false, error: "Usuario inválido" };
    }
    const admin = getAdminClient();
    if (!admin) return { ok: false, error: "Faltan variables de entorno de Supabase" };

    const { data: perfil, error: perfilError } = await admin
      .from("perfiles")
      .select("id,nombre,email,rol")
      .eq("id", requesterUserId)
      .single();
    if (perfilError || !perfil) {
      return { ok: false, error: perfilError?.message ?? "No se pudo cargar el perfil" };
    }

    const { data: socio, error: socioError } = await admin
      .from("socios")
      .select("id,telefono,estado,plan:planes(nombre)")
      .eq("perfil_id", requesterUserId)
      .maybeSingle();
    if (socioError) {
      return { ok: false, error: socioError.message };
    }

    let vencimiento: string | null = null;
    if (socio?.id) {
      const { data: vencRow } = await admin
        .from("movimientos_caja")
        .select("fecha_vencimiento")
        .eq("socio_id", socio.id)
        .eq("estado", "pendiente")
        .order("fecha_vencimiento", { ascending: true })
        .limit(1)
        .maybeSingle();
      vencimiento = vencRow?.fecha_vencimiento ?? null;
    }

    let proximaClase: PerfilVista["proximaClase"] = null;
    let clasesAsistidasSemana = 0;
    if (socio?.id) {
      const { data: inscripcionesData } = await admin
        .from("inscripciones" as never)
        .select("clase:clases(nombre,fecha_hora,estado,instructor:instructores(nombre))")
        .eq("socio_id", socio.id)
        .limit(100);

      const nowMs = Date.now();
      type InscripcionClaseRow = {
        clase?:
          | {
              nombre?: string | null;
              fecha_hora?: string | null;
              estado?: string | null;
              instructor?: { nombre?: string | null } | { nombre?: string | null }[] | null;
            }
          | null;
      };

      const upcoming = ((inscripcionesData ?? []) as InscripcionClaseRow[])
        .map((r) => r.clase)
        .filter((clase): clase is NonNullable<InscripcionClaseRow["clase"]> => Boolean(clase))
        .filter((clase) => {
          const estado = String(clase.estado ?? "").toLowerCase();
          if (estado === "cancelada") return false;
          const t = Date.parse(String(clase.fecha_hora ?? ""));
          return Number.isFinite(t) && t > nowMs;
        })
        .sort((a, b) => {
          const ta = Date.parse(String(a.fecha_hora ?? ""));
          const tb = Date.parse(String(b.fecha_hora ?? ""));
          return ta - tb;
        })[0];

      if (upcoming) {
        const instRel = upcoming.instructor;
        const instructor = Array.isArray(instRel)
          ? instRel[0]?.nombre ?? null
          : instRel?.nombre ?? null;
        proximaClase = {
          nombre: upcoming.nombre ?? "Clase",
          fechaHora: String(upcoming.fecha_hora ?? ""),
          instructor,
        };
      }

      const now = new Date();
      const currentDay = now.getDay();
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() + diffToMonday);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      clasesAsistidasSemana = ((inscripcionesData ?? []) as InscripcionClaseRow[])
        .map((r) => r.clase)
        .filter((clase): clase is NonNullable<InscripcionClaseRow["clase"]> => Boolean(clase))
        .filter((clase) => {
          const estado = String(clase.estado ?? "").toLowerCase();
          if (estado === "cancelada") return false;
          const t = Date.parse(String(clase.fecha_hora ?? ""));
          if (!Number.isFinite(t)) return false;
          return t >= weekStart.getTime() && t < weekEnd.getTime() && t <= now.getTime();
        }).length;
    }

    return {
      ok: true,
      data: {
        nombre: perfil.nombre ?? "",
        plan: formatPlanLabel(socio?.plan?.nombre),
        vencimiento,
        email: perfil.email ?? "",
        telefono: socio?.telefono ?? "",
        estado: String(socio?.estado ?? "inactivo"),
        proximaClase,
        clasesAsistidasSemana,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo obtener el perfil",
    };
  }
}

export async function updateMiPerfilAction(
  input: UpdateMiPerfilInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false, error: "Faltan variables de entorno de Supabase" };
    if (!input.requesterUserId) return { ok: false, error: "Usuario inválido" };

    const nombre = input.nombre.trim();
    const email = input.email.trim().toLowerCase();
    const telefono = input.telefono.trim();
    if (!nombre || !email) {
      return { ok: false, error: "Nombre y email son obligatorios" };
    }

    const { error: perfilError } = await admin
      .from("perfiles")
      .update({
        nombre,
        email,
      })
      .eq("id", input.requesterUserId);
    if (perfilError) return { ok: false, error: perfilError.message };

    const { error: socioError } = await admin
      .from("socios")
      .update({
        telefono: telefono || null,
      })
      .eq("perfil_id", input.requesterUserId);
    if (socioError) return { ok: false, error: socioError.message };

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar el perfil",
    };
  }
}
