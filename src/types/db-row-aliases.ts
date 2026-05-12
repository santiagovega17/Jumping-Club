import type { Database } from "./database.types";

export type ConceptoCaja = Database["public"]["Tables"]["conceptos_caja"]["Row"];
export type FormaPago = Database["public"]["Tables"]["formas_pago"]["Row"];
export type PlantillaClase = Database["public"]["Tables"]["plantillas_clases"]["Row"];
