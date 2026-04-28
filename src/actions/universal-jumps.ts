"use server";

import { createClient } from "@supabase/supabase-js";

type EstadoSucursal = "Activa" | "Inactiva";

export type UniversalJumpsSucursalRow = {
  id: string;
  nombreSucursal: string;
  estado: EstadoSucursal;
  cantidadSocios: number;
};

export type UniversalJumpsDashboardData = {
  totalFranquiciasActivas: number;
  totalSociosGlobales: number;
  ingresosGlobalesMes: number;
  sucursales: UniversalJumpsSucursalRow[];
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

    const [sucursalesRes, sociosRes, ingresosMesRes] = await Promise.all([
      admin.from("sucursales").select("id,nombre,estado"),
      admin.from("socios").select("id,sucursal_id,franquicia_id,estado"),
      admin
        .from("movimientos_caja")
        .select("monto,sucursal_id,franquicia_id")
        .eq("tipo", "ingreso")
        .eq("estado", "pagado")
        .gte("fecha", startDate)
        .lte("fecha", endDate),
    ]);

    if (sucursalesRes.error) return { ok: false, error: sucursalesRes.error.message };
    if (sociosRes.error) return { ok: false, error: sociosRes.error.message };
    if (ingresosMesRes.error) return { ok: false, error: ingresosMesRes.error.message };

    const sociosPorFranquicia = new Map<string, number>();
    const sociosActivosPorFranquicia = new Map<string, number>();

    for (const socio of sociosRes.data ?? []) {
      const franquiciaId = socio.sucursal_id ?? socio.franquicia_id;
      if (!franquiciaId) continue;

      sociosPorFranquicia.set(franquiciaId, (sociosPorFranquicia.get(franquiciaId) ?? 0) + 1);

      const estadoSocio = String(socio.estado ?? "").toLowerCase();
      if (!estadoSocio || estadoSocio === "activo") {
        sociosActivosPorFranquicia.set(
          franquiciaId,
          (sociosActivosPorFranquicia.get(franquiciaId) ?? 0) + 1,
        );
      }
    }

    const sucursales: UniversalJumpsSucursalRow[] = (sucursalesRes.data ?? []).map((sucursal) => {
      const activos = sociosActivosPorFranquicia.get(sucursal.id) ?? 0;
      const estadoSucursal = String(sucursal.estado ?? "").toLowerCase();
      const estado: EstadoSucursal =
        estadoSucursal === "activa" || estadoSucursal === "activo"
          ? "Activa"
          : estadoSucursal === "inactiva" || estadoSucursal === "inactivo"
            ? "Inactiva"
            : activos > 0
              ? "Activa"
              : "Inactiva";
      return {
        id: sucursal.id,
        nombreSucursal: sucursal.nombre,
        estado,
        cantidadSocios: sociosPorFranquicia.get(sucursal.id) ?? 0,
      };
    });

    const totalFranquiciasActivas = sucursales.filter(
      (sucursal) => sucursal.estado === "Activa",
    ).length;

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
        sucursales,
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
