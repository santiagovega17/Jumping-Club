"use server";

import { createClient } from "@supabase/supabase-js";

type EstadoFranquicia = "Activa" | "Inactiva";

export type UniversalJumpsFranquiciaRow = {
  id: string;
  nombreFranquicia: string;
  estado: EstadoFranquicia;
  cantidadSocios: number;
};

export type UniversalJumpsDashboardData = {
  totalFranquiciasActivas: number;
  totalSociosGlobales: number;
  ingresosGlobalesMes: number;
  franquicias: UniversalJumpsFranquiciaRow[];
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export async function getUniversalJumpsDashboardData(): Promise<
  { ok: true; data: UniversalJumpsDashboardData } | { ok: false; error: string }
> {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return { ok: false, error: "Faltan variables de entorno de Supabase" };
    }

    const { startDate, endDate } = getCurrentMonthRange();

    const [franquiciasRes, sociosRes, ingresosMesRes] = await Promise.all([
      admin.from("franquicias").select("id,nombre"),
      admin.from("socios").select("id,sucursal_id,franquicia_id,estado"),
      admin
        .from("movimientos_caja")
        .select("monto,sucursal_id,franquicia_id")
        .eq("tipo", "ingreso")
        .eq("estado", "pagado")
        .gte("fecha", startDate)
        .lte("fecha", endDate),
    ]);

    if (franquiciasRes.error) return { ok: false, error: franquiciasRes.error.message };
    if (sociosRes.error) return { ok: false, error: sociosRes.error.message };
    if (ingresosMesRes.error) return { ok: false, error: ingresosMesRes.error.message };

    const sociosPorFranquicia = new Map<string, number>();
    for (const socio of sociosRes.data ?? []) {
      const franquiciaId = socio.sucursal_id ?? socio.franquicia_id;
      if (!franquiciaId) continue;

      sociosPorFranquicia.set(franquiciaId, (sociosPorFranquicia.get(franquiciaId) ?? 0) + 1);
    }

    const franquicias: UniversalJumpsFranquiciaRow[] = (franquiciasRes.data ?? []).map((franquicia) => {
      const estado: EstadoFranquicia = "Activa";
      return {
        id: franquicia.id,
        nombreFranquicia: franquicia.nombre,
        estado,
        cantidadSocios: sociosPorFranquicia.get(franquicia.id) ?? 0,
      };
    });

    const totalFranquiciasActivas = franquicias.length;

    const totalSociosGlobales = sociosRes.data?.length ?? 0;

    const ingresosGlobalesMes = (ingresosMesRes.data ?? []).reduce((acc, item) => {
      const scopedId = item.sucursal_id ?? item.franquicia_id;
      if (!scopedId) return acc;
      return acc + Number(item.monto ?? 0);
    }, 0);

    return {
      ok: true,
      data: {
        totalFranquiciasActivas,
        totalSociosGlobales,
        ingresosGlobalesMes,
        franquicias,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo obtener el dashboard global de franquicias",
    };
  }
}
