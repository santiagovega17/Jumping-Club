"use server";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type AdminFranquiciaRow = {
  id: string;
  nombre: string;
  email: string;
  franquiciaId: string;
  franquiciaNombre: string;
};

export type UniversalJumpsConfigOverview = {
  totalFranquicias: number;
  totalAdminsFranquicia: number;
  adminsFranquicia: AdminFranquiciaRow[];
  formasPagoDefault: string[];
  conceptosIngresoDefault: string[];
  planesGlobales: Array<{ id: string; nombre: string; clasesPorSemana: number }>;
};

type ResetFranquiciaAdminPasswordInput = {
  requesterUserId: string;
  targetAdminUserId: string;
  newPassword: string;
};

type SaveGlobalTemplatesInput = {
  requesterUserId: string;
  formasPagoDefault: string;
  conceptosIngresoDefault: string;
};

type SaveGlobalPlansInput = {
  requesterUserId: string;
  planesDefault: string;
};

type CreateFranquiciaWithAdminInput = {
  requesterUserId: string;
  franquiciaNombre: string;
  franquiciaDireccion?: string;
  adminNombre: string;
  adminEmail: string;
  adminPassword: string;
};

function isValidAdminPassword(password: string) {
  if (password.length < 8) return false;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasUppercase && hasLowercase && hasNumber;
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function linesToArray(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseGlobalPlans(raw: string) {
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed: Array<{ nombre: string; clasesPorSemana: number }> = [];
  for (const row of rows) {
    const [nombreRaw, cupoRaw] = row.split("|").map((part) => part?.trim() ?? "");
    const nombre = nombreRaw;
    const clasesPorSemana = Number(cupoRaw);
    if (!nombre || !Number.isFinite(clasesPorSemana) || clasesPorSemana <= 0) {
      return {
        ok: false as const,
        error:
          `Formato inválido en "${row}". Usá "Nombre del plan|2" con cupo semanal mayor a 0.`,
      };
    }
    parsed.push({ nombre, clasesPorSemana: Math.floor(clasesPorSemana) });
  }
  if (parsed.length === 0) {
    return { ok: false as const, error: "Debes definir al menos un plan global" };
  }
  const uniq = new Set(parsed.map((p) => p.nombre.toLowerCase()));
  if (uniq.size !== parsed.length) {
    return { ok: false as const, error: "No puede haber nombres de planes duplicados" };
  }
  return { ok: true as const, data: parsed };
}

async function syncGlobalPlansToFranquicias(
  admin: ReturnType<typeof getAdminClient>,
  targetFranquiciaId?: string,
) {
  if (!admin) return { ok: false as const, error: "Cliente no disponible" };

  const { data: globalRows, error: globalError } = await admin
    .from("universal_jumps_global_plans" as never)
    .select("id,nombre,clases_por_semana,activo")
    .eq("activo", true);
  if (globalError) return { ok: false as const, error: globalError.message };
  const activeGlobalPlans = (globalRows ?? []) as Array<{
    id: string;
    nombre: string;
    clases_por_semana: number;
    activo: boolean;
  }>;

  const franquiciasRes = targetFranquiciaId
    ? await admin.from("franquicias").select("id").eq("id", targetFranquiciaId)
    : await admin.from("franquicias").select("id");
  if (franquiciasRes.error) return { ok: false as const, error: franquiciasRes.error.message };
  const franquiciaIds = (franquiciasRes.data ?? []).map((r) => String(r.id));
  if (franquiciaIds.length === 0 || activeGlobalPlans.length === 0) return { ok: true as const };

  const activeGlobalPlanIdSet = new Set(activeGlobalPlans.map((p) => p.id));

  const { data: existingRows, error: existingError } = await admin
    .from("planes" as never)
    .select("id,franquicia_id,global_plan_id,precio")
    .in("franquicia_id", franquiciaIds)
    .not("global_plan_id", "is", null);
  if (existingError) return { ok: false as const, error: existingError.message };

  const existingByKey = new Map<string, { id: string; precio: number }>();
  for (const row of (existingRows ?? []) as Array<{
    id: string;
    franquicia_id: string;
    global_plan_id?: string | null;
    precio?: number | null;
  }>) {
    const fid = String(row.franquicia_id ?? "");
    const gid = String((row as { global_plan_id?: string | null }).global_plan_id ?? "");
    if (!fid || !gid) continue;
    existingByKey.set(`${fid}:${gid}`, {
      id: String(row.id),
      precio: Number((row as { precio?: number | null }).precio ?? 0),
    });
  }

  const inserts: Array<{
    franquicia_id: string;
    nombre: string;
    precio: number;
    estado: string;
    clases_por_semana: number;
    global_plan_id: string;
  }> = [];
  const updates: Array<{
    id: string;
    nombre: string;
    estado: string;
    clases_por_semana: number;
  }> = [];

  for (const fid of franquiciaIds) {
    for (const gp of activeGlobalPlans) {
      const key = `${fid}:${gp.id}`;
      const existing = existingByKey.get(key);
      if (!existing) {
        inserts.push({
          franquicia_id: fid,
          nombre: gp.nombre,
          precio: 0,
          estado: "activo",
          clases_por_semana: Number(gp.clases_por_semana ?? 1),
          global_plan_id: gp.id,
        });
      } else {
        updates.push({
          id: existing.id,
          nombre: gp.nombre,
          estado: "activo",
          clases_por_semana: Number(gp.clases_por_semana ?? 1),
        });
      }
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await admin.from("planes").insert(inserts as never);
    if (insertError) return { ok: false as const, error: insertError.message };
  }

  for (const upd of updates) {
    const { error: updateError } = await admin
      .from("planes")
      .update({
        nombre: upd.nombre,
        estado: upd.estado,
        clases_por_semana: upd.clases_por_semana,
      } as never)
      .eq("id", upd.id);
    if (updateError) return { ok: false as const, error: updateError.message };
  }

  // Limpieza: cualquier plan que no esté ligado a un plan global activo se elimina.
  // Antes de borrar, liberamos la referencia de socios.plan_id.
  const { data: allPlanRows, error: allPlanRowsError } = await admin
    .from("planes" as never)
    .select("id,global_plan_id")
    .in("franquicia_id", franquiciaIds);
  if (allPlanRowsError) return { ok: false as const, error: allPlanRowsError.message };

  const obsoletePlanIds = ((allPlanRows ?? []) as Array<{
    id: string;
    global_plan_id?: string | null;
  }>)
    .filter((row) => {
      const globalPlanId = String(row.global_plan_id ?? "");
      if (!globalPlanId) return true;
      return !activeGlobalPlanIdSet.has(globalPlanId);
    })
    .map((row) => row.id);

  if (obsoletePlanIds.length > 0) {
    const { error: clearSociosPlanError } = await admin
      .from("socios")
      .update({ plan_id: null })
      .in("plan_id", obsoletePlanIds);
    if (clearSociosPlanError) return { ok: false as const, error: clearSociosPlanError.message };

    const { error: deleteObsoletePlansError } = await admin
      .from("planes")
      .delete()
      .in("id", obsoletePlanIds);
    if (deleteObsoletePlansError) return { ok: false as const, error: deleteObsoletePlansError.message };
  }

  return { ok: true as const };
}

export async function getUniversalJumpsConfigOverview(): Promise<
  { ok: true; data: UniversalJumpsConfigOverview } | { ok: false; error: string }
> {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false, error: "Faltan variables de entorno de Supabase" };

    const [franquiciasRes, perfilesRes, templatesRes, planesRes] = await Promise.all([
      admin.from("franquicias").select("id,nombre"),
      admin
        .from("perfiles")
        .select("id,nombre,email,rol,franquicia_id")
        .eq("rol", "admin_franquicia"),
      admin
        .from("universal_jumps_global_templates" as never)
        .select("formas_pago_default,conceptos_ingreso_default")
        .eq("id", true)
        .maybeSingle(),
      admin
        .from("universal_jumps_global_plans" as never)
        .select("id,nombre,clases_por_semana")
        .eq("activo", true)
        .order("nombre", { ascending: true }),
    ]);

    if (franquiciasRes.error) return { ok: false, error: franquiciasRes.error.message };
    if (perfilesRes.error) return { ok: false, error: perfilesRes.error.message };
    if (templatesRes.error) return { ok: false, error: templatesRes.error.message };
    if (planesRes.error) return { ok: false, error: planesRes.error.message };

    const franquiciaNombreById = new Map<string, string>(
      (franquiciasRes.data ?? []).map((s) => [String(s.id), String(s.nombre)]),
    );

    const adminsFranquicia: AdminFranquiciaRow[] = (perfilesRes.data ?? [])
      .filter((perfil) => Boolean(perfil.franquicia_id))
      .map((perfil) => {
        const franquiciaId = String(perfil.franquicia_id ?? "");
        return {
          id: perfil.id,
          nombre: perfil.nombre,
          email: perfil.email,
          franquiciaId,
          franquiciaNombre: franquiciaNombreById.get(franquiciaId) ?? "Franquicia sin nombre",
        };
      })
      .sort((a, b) => a.franquiciaNombre.localeCompare(b.franquiciaNombre));
    const templatesData = templatesRes.data as
      | {
          formas_pago_default?: string[] | null;
          conceptos_ingreso_default?: string[] | null;
        }
      | null;

    return {
      ok: true,
      data: {
        totalFranquicias: franquiciasRes.data?.length ?? 0,
        totalAdminsFranquicia: adminsFranquicia.length,
        adminsFranquicia,
        formasPagoDefault: templatesData?.formas_pago_default ?? [],
        conceptosIngresoDefault: templatesData?.conceptos_ingreso_default ?? [],
        planesGlobales: ((planesRes.data ?? []) as Array<{
          id: string;
          nombre: string;
          clases_por_semana: number;
        }>).map((row) => ({
          id: row.id,
          nombre: row.nombre,
          clasesPorSemana: Number(row.clases_por_semana ?? 1),
        })),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo obtener la configuración global",
    };
  }
}

export async function saveUniversalJumpsGlobalPlansAction(
  input: SaveGlobalPlansInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false, error: "Faltan variables de entorno de Supabase" };
    if (!input.requesterUserId) return { ok: false, error: "Usuario inválido" };

    const { data: requester, error: requesterError } = await admin
      .from("perfiles")
      .select("rol")
      .eq("id", input.requesterUserId)
      .single();
    if (requesterError || !requester) {
      return { ok: false, error: "No se pudo validar el usuario que solicita el cambio" };
    }
    if (requester.rol !== "admin_global") {
      return { ok: false, error: "Solo Universal Jumps puede editar planes globales" };
    }

    const parsed = parseGlobalPlans(input.planesDefault);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    const { error: deactivateError } = await admin
      .from("universal_jumps_global_plans" as never)
      .update({ activo: false } as never)
      .eq("activo", true);
    if (deactivateError) return { ok: false, error: deactivateError.message };

    for (const plan of parsed.data) {
      const { data: existing, error: existingError } = await admin
        .from("universal_jumps_global_plans" as never)
        .select("id")
        .ilike("nombre", plan.nombre)
        .maybeSingle();
      if (existingError) return { ok: false, error: existingError.message };
      const existingRow = existing as { id?: string } | null;

      if (existingRow?.id) {
        const { error: updateError } = await admin
          .from("universal_jumps_global_plans" as never)
          .update({
            nombre: plan.nombre,
            clases_por_semana: plan.clasesPorSemana,
            activo: true,
          } as never)
          .eq("id", existingRow.id);
        if (updateError) return { ok: false, error: updateError.message };
      } else {
        const { error: insertError } = await admin
          .from("universal_jumps_global_plans" as never)
          .insert({
            nombre: plan.nombre,
            clases_por_semana: plan.clasesPorSemana,
            activo: true,
          } as never);
        if (insertError) return { ok: false, error: insertError.message };
      }
    }

    const syncResult = await syncGlobalPlansToFranquicias(admin);
    if (!syncResult.ok) return { ok: false, error: syncResult.error };

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar planes globales",
    };
  }
}

export async function saveUniversalJumpsGlobalTemplatesAction(
  input: SaveGlobalTemplatesInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false, error: "Faltan variables de entorno de Supabase" };
    if (!input.requesterUserId) return { ok: false, error: "Usuario inválido" };

    const { data: requester, error: requesterError } = await admin
      .from("perfiles")
      .select("rol")
      .eq("id", input.requesterUserId)
      .single();
    if (requesterError || !requester) {
      return { ok: false, error: "No se pudo validar el usuario que solicita el cambio" };
    }
    if (requester.rol !== "admin_global") {
      return { ok: false, error: "Solo Universal Jumps puede editar plantillas globales" };
    }

    const formasPagoDefault = linesToArray(input.formasPagoDefault);
    const conceptosIngresoDefault = linesToArray(input.conceptosIngresoDefault);
    if (formasPagoDefault.length === 0 || conceptosIngresoDefault.length === 0) {
      return { ok: false, error: "Debes definir al menos una forma de pago y un concepto" };
    }

    const { error: upsertError } = await admin
      .from("universal_jumps_global_templates" as never)
      .upsert(
        {
          id: true,
          formas_pago_default: formasPagoDefault,
          conceptos_ingreso_default: conceptosIngresoDefault,
          updated_by: input.requesterUserId,
        } as never,
        { onConflict: "id" },
      );
    if (upsertError) return { ok: false, error: upsertError.message };

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la plantilla global",
    };
  }
}

export async function resetFranquiciaAdminPasswordAction(
  input: ResetFranquiciaAdminPasswordInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false, error: "Faltan variables de entorno de Supabase" };

    const newPassword = input.newPassword.trim();
    if (!input.requesterUserId || !input.targetAdminUserId) {
      return { ok: false, error: "Datos incompletos para cambiar contraseña" };
    }
    if (!isValidAdminPassword(newPassword)) {
      return {
        ok: false,
        error:
          "La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.",
      };
    }

    const { data: requester, error: requesterError } = await admin
      .from("perfiles")
      .select("rol")
      .eq("id", input.requesterUserId)
      .single();
    if (requesterError || !requester) {
      return { ok: false, error: "No se pudo validar el usuario que solicita el cambio" };
    }
    if (requester.rol !== "admin_global") {
      return { ok: false, error: "Solo Universal Jumps puede cambiar contraseñas de franquicia" };
    }

    const { data: target, error: targetError } = await admin
      .from("perfiles")
      .select("rol")
      .eq("id", input.targetAdminUserId)
      .single();
    if (targetError || !target) {
      return { ok: false, error: "No se encontró el admin de franquicia seleccionado" };
    }
    if (target.rol !== "admin_franquicia") {
      return { ok: false, error: "El usuario objetivo no es admin de franquicia" };
    }

    const { error: authError } = await admin.auth.admin.updateUserById(
      input.targetAdminUserId,
      { password: newPassword },
    );
    if (authError) return { ok: false, error: authError.message };

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo cambiar la contraseña del admin",
    };
  }
}

export async function createFranquiciaWithAdminAction(
  input: CreateFranquiciaWithAdminInput,
): Promise<{ ok: true; data: { franquiciaId: string; adminUserId: string } } | { ok: false; error: string }> {
  let createdAuthUserId: string | null = null;
  let createdFranquiciaId: string | null = null;
  let completed = false;

  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false, error: "Faltan variables de entorno de Supabase" };

    if (!input.requesterUserId) return { ok: false, error: "Usuario inválido" };

    const franquiciaNombre = input.franquiciaNombre.trim();
    const franquiciaDireccion = input.franquiciaDireccion?.trim() ?? "";
    const adminNombre = input.adminNombre.trim();
    const adminEmail = input.adminEmail.trim().toLowerCase();
    const adminPassword = input.adminPassword.trim();

    if (!franquiciaNombre || !adminNombre || !adminEmail || !adminPassword) {
      return { ok: false, error: "Completá nombre de franquicia y datos del admin" };
    }
    if (!isValidAdminPassword(adminPassword)) {
      return {
        ok: false,
        error:
          "La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.",
      };
    }

    const { data: requester, error: requesterError } = await admin
      .from("perfiles")
      .select("rol")
      .eq("id", input.requesterUserId)
      .single();
    if (requesterError || !requester) {
      return { ok: false, error: "No se pudo validar el usuario que solicita el alta" };
    }
    if (requester.rol !== "admin_global") {
      return { ok: false, error: "Solo Universal Jumps puede crear franquicias" };
    }

    const { data: existingEmail } = await admin
      .from("perfiles")
      .select("id")
      .eq("email", adminEmail)
      .maybeSingle();
    if (existingEmail?.id) {
      return { ok: false, error: "Ya existe un usuario con ese email" };
    }

    const { data: existingFranquicia } = await admin
      .from("franquicias")
      .select("id,nombre")
      .ilike("nombre", franquiciaNombre)
      .maybeSingle();
    if (existingFranquicia?.id) {
      return { ok: false, error: "Ya existe una franquicia con ese nombre" };
    }

    const franquiciaId = crypto.randomUUID();

    const { error: franquiciaLegacyError } = await admin.from("franquicias").insert({
      id: franquiciaId,
      nombre: franquiciaNombre,
      direccion: franquiciaDireccion || null,
    });
    if (franquiciaLegacyError) return { ok: false, error: franquiciaLegacyError.message };
    createdFranquiciaId = franquiciaId;

    const { data: createdAuth, error: authError } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { nombre: adminNombre },
    });
    if (authError || !createdAuth.user?.id) {
      return { ok: false, error: authError?.message ?? "No se pudo crear el usuario admin" };
    }
    createdAuthUserId = createdAuth.user.id;

    const { error: perfilError } = await admin.from("perfiles").insert({
      id: createdAuth.user.id,
      rol: "admin_franquicia",
      franquicia_id: franquiciaId,
      nombre: adminNombre,
      email: adminEmail,
    });
    if (perfilError) {
      return { ok: false, error: perfilError.message };
    }

    const syncPlansResult = await syncGlobalPlansToFranquicias(admin, franquiciaId);
    if (!syncPlansResult.ok) {
      return { ok: false, error: syncPlansResult.error };
    }

    completed = true;
    return { ok: true, data: { franquiciaId, adminUserId: createdAuth.user.id } };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo crear la franquicia",
    };
  } finally {
    // Rollback best-effort en caso de fallo intermedio.
    const admin = getAdminClient();
    if (admin && !completed) {
      if (createdAuthUserId) {
        await admin.auth.admin.deleteUser(createdAuthUserId);
      }
      if (createdFranquiciaId) {
        await admin.from("franquicias").delete().eq("id", createdFranquiciaId);
      }
    }
  }
}
