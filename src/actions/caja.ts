"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type RangoFechas = {
  startDate: string;
  endDate: string;
  userId: string;
};

type ObtenerProximosVencimientosInput = RangoFechas & {
  limit?: number;
};

type ObtenerMovimientosRecientesInput = RangoFechas & {
  limit?: number;
};

type CrearMovimientoCajaInput = {
  userId: string;
  tipo: "ingreso" | "egreso";
  estado?: "pagado" | "pendiente";
  monto: number;
  conceptoId: string;
  formaPagoId: string;
  socioId?: string | null;
  fecha: string;
  fechaVencimiento?: string | null;
  observaciones?: string | null;
};

type DeleteMovimientoCajaInput = {
  userId: string;
  movimientoId: string;
};

type MarcarMovimientoPagadoInput = {
  userId: string;
  movimientoId: string;
  formaPagoId: string;
  montoPagado?: number;
  observaciones?: string | null;
};

type GenerarCuotasPendientesResult = {
  ok: true;
  generated: number;
  skipped: number;
} | {
  ok: false;
  error: string;
};

type SincronizarSociosMorososResult = {
  ok: true;
  updatedSocios: number;
} | {
  ok: false;
  error: string;
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type MovimientoBalanceRow = {
  monto: number | null;
  tipo: string | null;
  estado?: string | null;
};

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

function currentMonthBounds(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
    day10Iso: `${year}-${String(month + 1).padStart(2, "0")}-10`,
    day1Iso: `${year}-${String(month + 1).padStart(2, "0")}-01`,
  };
}

export async function obtenerBalanceCaja(input: RangoFechas) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const { franquiciaId, error: franquiciaError } = await resolveFranquiciaId(
      input.userId,
      admin,
    );
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const { data, error } = await admin
      .from("movimientos_caja")
      .select("monto,tipo,estado")
      .eq("franquicia_id", franquiciaId)
      .gte("fecha", input.startDate)
      .lte("fecha", input.endDate);

    if (error) return { ok: false as const, error: error.message };

    const balance = ((data ?? []) as MovimientoBalanceRow[]).reduce(
      (acc, row) => {
        const monto = Number(row?.monto ?? 0);
        const tipo = String(row?.tipo ?? "");
        const estado = String(row?.estado ?? "pagado").toLowerCase();

        if (estado === "pagado") {
          if (tipo === "ingreso") acc.ingresos += monto;
          if (tipo === "egreso") acc.egresos += monto;
        }
        if (estado === "pendiente") {
          if (tipo === "ingreso") acc.pendientesIngresos += monto;
          if (tipo === "egreso") acc.pendientesEgresos += monto;
        }
        return acc;
      },
      { ingresos: 0, egresos: 0, pendientesIngresos: 0, pendientesEgresos: 0 },
    );

    const pendientes = balance.pendientesIngresos - balance.pendientesEgresos;

    return {
      ok: true as const,
      data: {
        ingresos: balance.ingresos,
        egresos: balance.egresos,
        saldo: balance.ingresos - balance.egresos,
        pendientes,
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "No se pudo obtener el balance de caja",
    };
  }
}

export async function obtenerProximosVencimientos(
  input: ObtenerProximosVencimientosInput,
) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const { franquiciaId, error: franquiciaError } = await resolveFranquiciaId(
      input.userId,
      admin,
    );
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const { data, error } = await admin
      .from("movimientos_caja")
      .select(
        "id,monto,fecha_vencimiento,estado,concepto:conceptos_caja(concepto,descripcion)",
      )
      .eq("franquicia_id", franquiciaId)
      .eq("estado", "pendiente")
      .gte("fecha", input.startDate)
      .lte("fecha", input.endDate)
      .order("fecha_vencimiento", { ascending: true })
      .limit(input.limit ?? 10);

    if (error) return { ok: false as const, error: error.message };

    return { ok: true as const, data: data ?? [] };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo obtener próximos vencimientos",
    };
  }
}

export async function obtenerMovimientosRecientes(
  input: ObtenerMovimientosRecientesInput,
) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const { franquiciaId, error: franquiciaError } = await resolveFranquiciaId(
      input.userId,
      admin,
    );
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const { data, error } = await admin
      .from("movimientos_caja")
      .select(
        "id,monto,tipo,fecha,estado,fecha_vencimiento,observaciones,concepto_id,forma_pago_id,socio_id,concepto:conceptos_caja(concepto,descripcion),forma:formas_pago(nombre),socio:socios(perfil:perfiles(nombre))",
      )
      .eq("franquicia_id", franquiciaId)
      .gte("fecha", input.startDate)
      .lte("fecha", input.endDate)
      .order("fecha", { ascending: false })
      .limit(input.limit ?? 200);

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, data: data ?? [] };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo obtener movimientos recientes",
    };
  }
}

export async function crearMovimientoCajaAction(input: CrearMovimientoCajaInput) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    if (!input.monto || input.monto <= 0) {
      return { ok: false as const, error: "El monto debe ser mayor a cero" };
    }
    if (!input.conceptoId || !input.formaPagoId) {
      return { ok: false as const, error: "Concepto y forma de pago son obligatorios" };
    }

    const { franquiciaId, error: franquiciaError } = await resolveFranquiciaId(
      input.userId,
      admin,
    );
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const estado = input.estado ?? "pagado";
    const payload: Database["public"]["Tables"]["movimientos_caja"]["Insert"] = {
      franquicia_id: franquiciaId,
      tipo: input.tipo,
      estado,
      monto: input.monto,
      concepto_id: input.conceptoId,
      forma_pago_id: input.formaPagoId,
      socio_id: input.socioId ?? null,
      fecha: input.fecha,
      fecha_vencimiento:
        estado === "pendiente" ? input.fechaVencimiento ?? input.fecha : null,
      observaciones: input.observaciones ?? null,
    };

    const { data, error } = await admin
      .from("movimientos_caja")
      .insert(payload)
      .select("id")
      .single();

    if (error) return { ok: false as const, error: error.message };

    let warning: string | null = null;

    if (
      input.tipo === "ingreso" &&
      estado === "pagado" &&
      input.socioId &&
      input.conceptoId
    ) {
      const { data: conceptoRow, error: conceptoError } = await admin
        .from("conceptos_caja")
        .select("concepto")
        .eq("id", input.conceptoId)
        .eq("franquicia_id", franquiciaId)
        .maybeSingle();

      const conceptoNombre = conceptoRow?.concepto?.trim() ?? "";
      const esPagoCuota = conceptoNombre.toLowerCase() === "pago de cuota";
      if (!conceptoError && esPagoCuota) {
        const today = new Date();
        const todayIso = today.toISOString().slice(0, 10);
        const fechaVencimiento = new Date(today);
        fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
        const fechaVencimientoIso = fechaVencimiento.toISOString().slice(0, 10);

        const { error: socioUpdateWithVencError } = await admin
          .from("socios")
          .update({
            estado: "activo",
            // Best effort: si la columna existe, queda consistente con la lógica de pagos.
            fecha_vencimiento: fechaVencimientoIso,
            // campo auxiliar por compatibilidad con modelos previos en el proyecto
            mes_ultimo_aumento: todayIso.slice(0, 7),
          } as unknown as Database["public"]["Tables"]["socios"]["Update"])
          .eq("id", input.socioId)
          .eq("franquicia_id", franquiciaId);
        if (socioUpdateWithVencError) {
          const { error: socioUpdateError } = await admin
            .from("socios")
            .update({ estado: "activo" })
            .eq("id", input.socioId)
            .eq("franquicia_id", franquiciaId);
          if (socioUpdateError) {
            warning =
              "El movimiento se registró, pero no se pudo actualizar el estado del socio.";
          }
        }
      }
    }

    revalidatePath("/socios");
    revalidatePath("/administracion");
    revalidatePath("/dashboard");
    return { ok: true as const, data, warning };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "No se pudo registrar el movimiento",
    };
  }
}

export async function deleteMovimientoCajaAction(input: DeleteMovimientoCajaInput) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };
    if (!input.movimientoId) return { ok: false as const, error: "Movimiento inválido" };

    const { franquiciaId, error: franquiciaError } = await resolveFranquiciaId(input.userId, admin);
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const { data: original, error: selectError } = await admin
      .from("movimientos_caja")
      .select("id,tipo,concepto_id,socio_id")
      .eq("id", input.movimientoId)
      .eq("franquicia_id", franquiciaId)
      .maybeSingle();
    if (selectError || !original) {
      return { ok: false as const, error: selectError?.message ?? "Movimiento no encontrado" };
    }

    const { error: deleteError } = await admin
      .from("movimientos_caja")
      .delete()
      .eq("id", input.movimientoId)
      .eq("franquicia_id", franquiciaId);
    if (deleteError) return { ok: false as const, error: deleteError.message };

    if (original.tipo === "ingreso" && original.socio_id && original.concepto_id) {
      const { data: conceptoRow } = await admin
        .from("conceptos_caja")
        .select("concepto")
        .eq("id", original.concepto_id)
        .eq("franquicia_id", franquiciaId)
        .maybeSingle();
      const esPagoCuota = (conceptoRow?.concepto?.trim() ?? "").toLowerCase() === "pago de cuota";
      if (esPagoCuota) {
        await admin
          .from("socios")
          .update({ estado: "vencido" })
          .eq("id", original.socio_id)
          .eq("franquicia_id", franquiciaId);
      }
    }

    revalidatePath("/socios");
    revalidatePath("/administracion");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo eliminar el movimiento",
    };
  }
}

export async function marcarMovimientoPagadoAction(input: MarcarMovimientoPagadoInput) {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };
    if (!input.movimientoId || !input.formaPagoId) {
      return { ok: false as const, error: "Movimiento o forma de pago inválidos" };
    }

    const { franquiciaId, error: franquiciaError } = await resolveFranquiciaId(input.userId, admin);
    if (franquiciaError || !franquiciaId) {
      return { ok: false as const, error: franquiciaError ?? "Franquicia no encontrada" };
    }

    const { data: movimiento, error: movimientoError } = await admin
      .from("movimientos_caja")
      .select("id,estado,tipo,concepto_id,socio_id")
      .eq("id", input.movimientoId)
      .eq("franquicia_id", franquiciaId)
      .maybeSingle();
    if (movimientoError || !movimiento?.id) {
      return { ok: false as const, error: movimientoError?.message ?? "Movimiento no encontrado" };
    }
    if (String(movimiento.estado ?? "").toLowerCase() !== "pendiente") {
      return { ok: false as const, error: "Solo se pueden cobrar/pagar movimientos pendientes" };
    }

    const montoPagado = Number(input.montoPagado ?? NaN);
    const payload: Database["public"]["Tables"]["movimientos_caja"]["Update"] = {
      estado: "pagado",
      forma_pago_id: input.formaPagoId,
      fecha: new Date().toISOString(),
    };
    if (Number.isFinite(montoPagado) && montoPagado >= 0) {
      payload.monto = montoPagado;
    }
    if (typeof input.observaciones === "string") {
      payload.observaciones = input.observaciones.trim() || null;
    }

    const { error: updateError } = await admin
      .from("movimientos_caja")
      .update(payload)
      .eq("id", input.movimientoId)
      .eq("franquicia_id", franquiciaId);
    if (updateError) return { ok: false as const, error: updateError.message };

    if (movimiento.tipo === "ingreso" && movimiento.socio_id && movimiento.concepto_id) {
      const { data: conceptoRow, error: conceptoError } = await admin
        .from("conceptos_caja")
        .select("concepto")
        .eq("id", movimiento.concepto_id)
        .eq("franquicia_id", franquiciaId)
        .maybeSingle();

      const esPagoCuota = (conceptoRow?.concepto?.trim() ?? "").toLowerCase() === "pago de cuota";
      if (!conceptoError && esPagoCuota) {
        const today = new Date();
        const todayIso = today.toISOString().slice(0, 10);
        const fechaVencimiento = new Date(today);
        fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
        const fechaVencimientoIso = fechaVencimiento.toISOString().slice(0, 10);

        const { error: socioUpdateWithVencError } = await admin
          .from("socios")
          .update({
            estado: "activo",
            fecha_vencimiento: fechaVencimientoIso,
            mes_ultimo_aumento: todayIso.slice(0, 7),
          } as unknown as Database["public"]["Tables"]["socios"]["Update"])
          .eq("id", movimiento.socio_id)
          .eq("franquicia_id", franquiciaId);

        if (socioUpdateWithVencError) {
          const { error: socioUpdateError } = await admin
            .from("socios")
            .update({ estado: "activo" })
            .eq("id", movimiento.socio_id)
            .eq("franquicia_id", franquiciaId);
          if (socioUpdateError) {
            return {
              ok: false as const,
              error:
                "Se marcó el movimiento como pagado, pero no se pudo actualizar el estado del socio.",
            };
          }
        }
      }
    }

    revalidatePath("/administracion");
    revalidatePath("/dashboard");
    revalidatePath("/socios");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "No se pudo actualizar el estado del movimiento",
    };
  }
}

export async function generarCuotasPendientes(): Promise<GenerarCuotasPendientesResult> {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const { data: conceptoPagoCuota, error: conceptoError } = await admin
      .from("conceptos_caja")
      .select("id,franquicia_id")
      .eq("concepto", "Pago de Cuota");
    if (conceptoError) return { ok: false as const, error: conceptoError.message };

    const conceptosByFranquicia = new Map(
      (conceptoPagoCuota ?? [])
        .filter((row) => row.id && row.franquicia_id)
        .map((row) => [String(row.franquicia_id), String(row.id)]),
    );
    if (conceptosByFranquicia.size === 0) {
      return { ok: true as const, generated: 0, skipped: 0 };
    }

    const { startIso, endIso, day10Iso, day1Iso } = currentMonthBounds();

    const { data: formasPagoRows, error: formasPagoError } = await admin
      .from("formas_pago")
      .select("id,franquicia_id")
      .eq("activo", true)
      .order("orden", { ascending: true });
    if (formasPagoError) return { ok: false as const, error: formasPagoError.message };

    const formaPagoByFranquicia = new Map<string, string>();
    for (const row of formasPagoRows ?? []) {
      const franquiciaId = String(row.franquicia_id ?? "");
      if (!franquiciaId || formaPagoByFranquicia.has(franquiciaId)) continue;
      formaPagoByFranquicia.set(franquiciaId, String(row.id));
    }

    const { data: sociosRows, error: sociosError } = await admin
      .from("socios")
      .select("id,franquicia_id,estado,plan:planes(precio)")
      .not("franquicia_id", "is", null);
    if (sociosError) return { ok: false as const, error: sociosError.message };

    const sociosElegibles = (sociosRows ?? []).filter((row) => {
      const franquiciaId = String(row.franquicia_id ?? "");
      const estado = String(row.estado ?? "").toLowerCase();
      return (
        Boolean(franquiciaId) &&
        estado !== "inactivo" &&
        conceptosByFranquicia.has(franquiciaId) &&
        formaPagoByFranquicia.has(franquiciaId)
      );
    });

    if (sociosElegibles.length === 0) return { ok: true as const, generated: 0, skipped: 0 };

    const socioIds = sociosElegibles.map((row) => String(row.id));
    const { data: existingRows, error: existingError } = await admin
      .from("movimientos_caja")
      .select("socio_id,franquicia_id")
      .eq("tipo", "ingreso")
      .eq("estado", "pendiente")
      .gte("fecha", startIso)
      .lte("fecha", endIso)
      .in("socio_id", socioIds);
    if (existingError) return { ok: false as const, error: existingError.message };

    const existingKey = new Set(
      (existingRows ?? []).map(
        (row) => `${String(row.franquicia_id ?? "")}:${String(row.socio_id ?? "")}`,
      ),
    );

    const inserts: Database["public"]["Tables"]["movimientos_caja"]["Insert"][] = [];
    let skipped = 0;
    for (const socio of sociosElegibles) {
      const franquiciaId = String(socio.franquicia_id ?? "");
      const socioId = String(socio.id);
      const key = `${franquiciaId}:${socioId}`;
      if (existingKey.has(key)) {
        skipped += 1;
        continue;
      }
      const monto = Number((socio.plan as { precio?: number | null } | null)?.precio ?? 0);
      inserts.push({
        franquicia_id: franquiciaId,
        tipo: "ingreso",
        monto: monto > 0 ? monto : 0,
        concepto_id: conceptosByFranquicia.get(franquiciaId)!,
        forma_pago_id: formaPagoByFranquicia.get(franquiciaId)!,
        socio_id: socioId,
        fecha: day1Iso,
        estado: "pendiente",
        fecha_vencimiento: day10Iso,
        observaciones: "Cuota generada automáticamente",
      });
    }

    if (inserts.length > 0) {
      const { error: insertError } = await admin.from("movimientos_caja").insert(inserts);
      if (insertError) return { ok: false as const, error: insertError.message };
    }

    revalidatePath("/administracion");
    revalidatePath("/dashboard");
    return { ok: true as const, generated: inserts.length, skipped };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "No se pudieron generar cuotas pendientes",
    };
  }
}

export async function sincronizarSociosMorosos(): Promise<SincronizarSociosMorososResult> {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false as const, error: "Faltan variables de entorno de Supabase" };

    const todayIso = new Date().toISOString().slice(0, 10);
    const { data: conceptosPagoCuota, error: conceptosError } = await admin
      .from("conceptos_caja")
      .select("id")
      .eq("concepto", "Pago de Cuota");
    if (conceptosError) return { ok: false as const, error: conceptosError.message };
    const conceptoIds = (conceptosPagoCuota ?? []).map((row) => String(row.id));
    if (conceptoIds.length === 0) return { ok: true as const, updatedSocios: 0 };

    const { data: morososRows, error: morososError } = await admin
      .from("movimientos_caja")
      .select("socio_id")
      .eq("estado", "pendiente")
      .in("concepto_id", conceptoIds)
      .lt("fecha_vencimiento", todayIso)
      .not("socio_id", "is", null);
    if (morososError) return { ok: false as const, error: morososError.message };

    const socioIds = Array.from(
      new Set((morososRows ?? []).map((row) => String(row.socio_id ?? "")).filter(Boolean)),
    );
    if (socioIds.length === 0) return { ok: true as const, updatedSocios: 0 };

    const { error: updateError } = await admin
      .from("socios")
      .update({ estado: "vencido" })
      .in("id", socioIds);
    if (updateError) return { ok: false as const, error: updateError.message };

    revalidatePath("/socios");
    revalidatePath("/administracion");
    revalidatePath("/dashboard");
    return { ok: true as const, updatedSocios: socioIds.length };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo sincronizar socios morosos",
    };
  }
}
