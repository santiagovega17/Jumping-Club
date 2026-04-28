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

async function resolveScopeFranquiciaId(
  admin: ReturnType<typeof getAdminClient>,
  userId?: string | null,
  franquiciaIdOverride?: string | null,
) {
  if (franquiciaIdOverride) return { franquiciaId: franquiciaIdOverride, error: null as string | null };
  if (!userId) return { franquiciaId: null, error: "Usuario no especificado" };
  return resolveFranquiciaId(userId, admin);
}

export async function getDashboardKPIs(userId?: string | null, franquiciaIdOverride?: string | null) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const { franquiciaId, error: franquiciaError } = await resolveScopeFranquiciaId(
      admin,
      userId,
      franquiciaIdOverride,
    );
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const { startDate, endDate } = currentMonthRange();
    const nowMs = Date.now();
    const windowStart = new Date(nowMs - 48 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(nowMs + 730 * 24 * 60 * 60 * 1000).toISOString();

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
        .select("nombre,fecha_hora,estado,instructor:instructores(nombre)")
        .eq("franquicia_id", franquiciaId)
        .or("estado.eq.activa,estado.is.null")
        .gte("fecha_hora", windowStart)
        .lte("fecha_hora", windowEnd)
        .order("fecha_hora", { ascending: true })
        .limit(400),
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

    const claseRow = (proximaClaseRes.data ?? []).find((row) => {
      if (String(row.estado ?? "").toLowerCase() === "cancelada") return false;
      const t = Date.parse(String(row.fecha_hora ?? ""));
      return Number.isFinite(t) && t > nowMs;
    });

    const instructorRel = claseRow?.instructor as
      | { nombre?: string | null }
      | { nombre?: string | null }[]
      | null
      | undefined;
    const instructorNombre = Array.isArray(instructorRel)
      ? instructorRel[0]?.nombre ?? null
      : instructorRel?.nombre ?? null;

    const clase = claseRow
      ? {
          nombre: claseRow.nombre,
          fechaHora: claseRow.fecha_hora,
          instructor: instructorNombre,
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

export async function getDashboardProximosVencimientos(
  userId?: string | null,
  limit = 5,
  franquiciaIdOverride?: string | null,
) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const { franquiciaId, error: franquiciaError } = await resolveScopeFranquiciaId(
      admin,
      userId,
      franquiciaIdOverride,
    );
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const fetchCap = Math.min(500, Math.max(80, limit * 40));
    const { data, error } = await admin
      .from("movimientos_caja")
      .select(
        "id,monto,fecha,fecha_vencimiento,tipo,estado,concepto:conceptos_caja(concepto,descripcion)",
      )
      .eq("franquicia_id", franquiciaId)
      .eq("estado", "pendiente")
      .eq("tipo", "egreso")
      .limit(fetchCap);
    if (error) return { ok: false as const, error: error.message };

    type Row = {
      id: string;
      monto: number | null;
      fecha: string | null;
      fecha_vencimiento?: string | null;
      concepto?: { concepto?: string | null; descripcion?: string | null } | null;
    };

    const sortKey = (row: Row) => {
      const fv = row.fecha_vencimiento?.slice(0, 10) ?? "";
      const fd = row.fecha?.slice(0, 10) ?? "";
      return fv || fd || "9999-99-99";
    };

    const rows = [...((data ?? []) as Row[])]
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
      .slice(0, limit)
      .map((row) => {
        const join = row.concepto;
        const fv = row.fecha_vencimiento?.slice(0, 10) ?? "";
        const fd = row.fecha?.slice(0, 10) ?? "";
        const monto = Number(row.monto ?? 0);
        return {
          id: row.id,
          concepto: join?.concepto?.trim() || "Sin concepto",
          descripcion: (join?.descripcion ?? "").trim(),
          total: -Math.abs(monto),
          fecha: fv || fd,
        };
      });

    return { ok: true as const, data: rows };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudieron obtener vencimientos",
    };
  }
}

export async function getDashboardChartData(userId?: string | null, franquiciaIdOverride?: string | null) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const { franquiciaId, error: franquiciaError } = await resolveScopeFranquiciaId(
      admin,
      userId,
      franquiciaIdOverride,
    );
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

export async function getDashboardUltimosMovimientos(
  userId?: string | null,
  limit = 5,
  franquiciaIdOverride?: string | null,
) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const { franquiciaId, error: franquiciaError } = await resolveScopeFranquiciaId(
      admin,
      userId,
      franquiciaIdOverride,
    );
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
