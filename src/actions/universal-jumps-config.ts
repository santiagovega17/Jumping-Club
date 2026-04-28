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
  totalSucursales: number;
  totalAdminsFranquicia: number;
  adminsFranquicia: AdminFranquiciaRow[];
};

type ResetFranquiciaAdminPasswordInput = {
  requesterUserId: string;
  targetAdminUserId: string;
  newPassword: string;
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

export async function getUniversalJumpsConfigOverview(): Promise<
  { ok: true; data: UniversalJumpsConfigOverview } | { ok: false; error: string }
> {
  try {
    const admin = getAdminClient();
    if (!admin) return { ok: false, error: "Faltan variables de entorno de Supabase" };

    const [sucursalesRes, perfilesRes] = await Promise.all([
      admin.from("sucursales" as never).select("id,nombre"),
      admin
        .from("perfiles")
        .select("id,nombre,email,rol,franquicia_id")
        .eq("rol", "admin_franquicia"),
    ]);

    if (sucursalesRes.error) return { ok: false, error: sucursalesRes.error.message };
    if (perfilesRes.error) return { ok: false, error: perfilesRes.error.message };

    const sucursalNombreById = new Map<string, string>(
      (sucursalesRes.data ?? []).map((s) => [String(s.id), String(s.nombre)]),
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
          franquiciaNombre: sucursalNombreById.get(franquiciaId) ?? "Sucursal sin nombre",
        };
      })
      .sort((a, b) => a.franquiciaNombre.localeCompare(b.franquiciaNombre));

    return {
      ok: true,
      data: {
        totalSucursales: sucursalesRes.data?.length ?? 0,
        totalAdminsFranquicia: adminsFranquicia.length,
        adminsFranquicia,
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
