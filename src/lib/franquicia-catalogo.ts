import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type SupabaseBrowserClient = SupabaseClient<Database>;

/** Catálogo anidado compatible con el formulario de caja (ingreso/egreso). */
export type ConceptosFinancieros = {
  INGRESOS: Record<string, string[]>;
  EGRESOS: Record<string, string[]>;
};

export const EMPTY_CONCEPTOS: ConceptosFinancieros = {
  INGRESOS: {},
  EGRESOS: {},
};

export async function fetchFranquiciaIdForUser(
  client: SupabaseBrowserClient,
): Promise<string | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from("perfiles")
    .select("franquicia_id")
    .eq("id", user.id)
    .single();
  if (error || !data?.franquicia_id) return null;
  return data.franquicia_id;
}

function rowsToConceptosFinancieros(
  rows: { tipo: string; concepto: string; descripcion: string }[],
): ConceptosFinancieros {
  const INGRESOS: Record<string, string[]> = {};
  const EGRESOS: Record<string, string[]> = {};
  for (const r of rows) {
    const branch = r.tipo === "egreso" ? EGRESOS : INGRESOS;
    if (!branch[r.concepto]) branch[r.concepto] = [];
    if (!branch[r.concepto].includes(r.descripcion)) {
      branch[r.concepto].push(r.descripcion);
    }
  }
  return { INGRESOS, EGRESOS };
}

export async function fetchConceptosFinancierosCatalog(
  client: SupabaseBrowserClient,
  franquiciaId: string,
): Promise<ConceptosFinancieros> {
  const { data, error } = await client
    .from("conceptos_caja")
    .select("tipo,concepto,descripcion,orden")
    .eq("franquicia_id", franquiciaId)
    .order("orden", { ascending: true })
    .order("concepto", { ascending: true })
    .order("descripcion", { ascending: true });
  if (error || !data) return EMPTY_CONCEPTOS;
  return rowsToConceptosFinancieros(data);
}

export async function fetchFormasPagoNombres(
  client: SupabaseBrowserClient,
  franquiciaId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("formas_pago")
    .select("nombre,orden")
    .eq("franquicia_id", franquiciaId)
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => r.nombre);
}

export async function loadCajaCatalogForFranquicia(
  client: SupabaseBrowserClient,
  franquiciaId: string,
): Promise<{ conceptos: ConceptosFinancieros; formasPago: string[] }> {
  const [conceptos, formasPago] = await Promise.all([
    fetchConceptosFinancierosCatalog(client, franquiciaId),
    fetchFormasPagoNombres(client, franquiciaId),
  ]);
  return { conceptos, formasPago };
}
