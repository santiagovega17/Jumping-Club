"use server";

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
  if (!admin) return { franquiciaId: null, error: "Cliente de Supabase no disponible" };
  const { data, error } = await admin
    .from("perfiles")
    .select("franquicia_id")
    .eq("id", userId)
    .single();
  if (error) return { franquiciaId: null, error: error.message };
  return { franquiciaId: data?.franquicia_id ?? null, error: null };
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export async function getDashboardKPIs(userId: string) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const { franquiciaId, error: franquiciaError } = await resolveFranquiciaId(userId, admin);
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const { startDate, endDate } = currentMonthRange();
    const [movimientosRes, proximaClaseRes] = await Promise.all([
      admin
        .from("movimientos_caja")
        .select("monto,tipo,estado")
        .eq("franquicia_id", franquiciaId)
        .eq("estado", "pagado")
        .gte("fecha", startDate)
        .lte("fecha", endDate),
      admin
        .from("clases")
        .select("nombre,fecha_hora,instructor:instructores(nombre)")
        .eq("franquicia_id", franquiciaId)
        .neq("estado", "cancelada")
        .gt("fecha_hora", new Date().toISOString())
        .order("fecha_hora", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (movimientosRes.error) return { ok: false as const, error: movimientosRes.error.message };
    if (proximaClaseRes.error) return { ok: false as const, error: proximaClaseRes.error.message };

    const balance = (movimientosRes.data ?? []).reduce(
      (acc, row) => {
        const monto = Number(row.monto ?? 0);
        if (row.tipo === "ingreso") acc.ingresos += monto;
        if (row.tipo === "egreso") acc.egresos += monto;
        return acc;
      },
      { ingresos: 0, egresos: 0 },
    );

    const clase = proximaClaseRes.data
      ? {
          nombre: proximaClaseRes.data.nombre,
          fechaHora: proximaClaseRes.data.fecha_hora,
          instructor: (proximaClaseRes.data.instructor as { nombre?: string | null } | null)
            ?.nombre ?? null,
        }
      : null;

    return {
      ok: true as const,
      data: {
        ingresos: balance.ingresos,
        egresos: balance.egresos,
        proximaClase: clase,
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudieron obtener los KPIs",
    };
  }
}

export async function getDashboardProximosVencimientos(userId: string, limit = 5) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const { franquiciaId, error: franquiciaError } = await resolveFranquiciaId(userId, admin);
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("movimientos_caja")
      .select("id,monto,fecha_vencimiento,concepto:conceptos_caja(concepto,descripcion)")
      .eq("franquicia_id", franquiciaId)
      .eq("estado", "pendiente")
      .gte("fecha_vencimiento", todayIso)
      .order("fecha_vencimiento", { ascending: true })
      .limit(limit);
    if (error) return { ok: false as const, error: error.message };

    const rows = (data ?? []).map((row) => ({
      id: row.id,
      concepto: (row.concepto as { concepto?: string | null } | null)?.concepto ?? "Sin concepto",
      descripcion:
        (row.concepto as { descripcion?: string | null } | null)?.descripcion ?? "",
      total: Number(row.monto ?? 0),
      fecha: (row as { fecha_vencimiento?: string | null }).fecha_vencimiento ?? "",
    }));

    return { ok: true as const, data: rows };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudieron obtener vencimientos",
    };
  }
}

export async function getDashboardChartData(userId: string) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const { franquiciaId, error: franquiciaError } = await resolveFranquiciaId(userId, admin);
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { data, error } = await admin
      .from("movimientos_caja")
      .select("monto,tipo,fecha")
      .eq("franquicia_id", franquiciaId)
      .eq("estado", "pagado")
      .gte("fecha", start.toISOString().slice(0, 10))
      .lte("fecha", end.toISOString().slice(0, 10));
    if (error) return { ok: false as const, error: error.message };

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const name = d.toLocaleDateString("es-AR", { month: "short" });
      return { key, name: name.charAt(0).toUpperCase() + name.slice(1).replace(".", "") };
    });

    const bucket: Record<string, { ingresos: number; egresos: number }> = {};
    for (const m of months) bucket[m.key] = { ingresos: 0, egresos: 0 };

    for (const row of data ?? []) {
      const fecha = String(row.fecha ?? "");
      const key = fecha.slice(0, 7);
      if (!bucket[key]) continue;
      const monto = Number(row.monto ?? 0);
      if (row.tipo === "ingreso") bucket[key].ingresos += monto;
      if (row.tipo === "egreso") bucket[key].egresos += monto;
    }

    const chart = months.map((m) => ({
      name: m.name,
      ingresos: bucket[m.key]?.ingresos ?? 0,
      egresos: bucket[m.key]?.egresos ?? 0,
    }));

    return { ok: true as const, data: chart };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo obtener el gráfico",
    };
  }
}

export async function getDashboardUltimosMovimientos(userId: string, limit = 5) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const { franquiciaId, error: franquiciaError } = await resolveFranquiciaId(userId, admin);
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const { data, error } = await admin
      .from("movimientos_caja")
      .select("id,monto,tipo,fecha,concepto:conceptos_caja(concepto,descripcion)")
      .eq("franquicia_id", franquiciaId)
      .eq("estado", "pagado")
      .order("fecha", { ascending: false })
      .limit(limit);
    if (error) return { ok: false as const, error: error.message };

    const rows = (data ?? []).map((row) => ({
      id: row.id,
      tipo: row.tipo,
      monto: Number(row.monto ?? 0),
      fecha: String(row.fecha ?? ""),
      concepto: (row.concepto as { concepto?: string | null } | null)?.concepto ?? "Sin concepto",
      descripcion:
        (row.concepto as { descripcion?: string | null } | null)?.descripcion ?? "",
    }));

    return { ok: true as const, data: rows };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudieron obtener los movimientos",
    };
  }
}
