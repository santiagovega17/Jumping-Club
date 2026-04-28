"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PremiumCardTitle } from "@/components/PremiumTitle";
import { SectionHeading } from "@/components/SectionHeading";
import {
  PAGE_TITLE_CLASS,
} from "@/lib/headings";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/text";
import { toast } from "sonner";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { actualizarMinutosLimiteBajaInscripcionAction } from "@/actions/franquicia";
import type { ConceptoCaja, FormaPago, PlantillaClase } from "@/types/database.types";

const LABEL_TECH =
  "text-sm font-medium text-zinc-400 uppercase tracking-wider";

const BTN_FUCSIA =
  "bg-[#e41b68] font-semibold text-white hover:bg-[#e41b68]/90";
const BTN_VERDE =
  "bg-[#5ab253] font-semibold text-white hover:bg-[#5ab253]/90";
const CONCEPTO_PAGO_CUOTA = "Pago de Cuota";

const STORAGE_KEY = "jumping-club-config-v1";

const DAY_IDS = ["lun", "mar", "mie", "jue", "vie", "sab"] as const;
type DayId = (typeof DAY_IDS)[number];

const DAY_LABELS: Record<DayId, string> = {
  lun: "Lunes",
  mar: "Martes",
  mie: "Miércoles",
  jue: "Jueves",
  vie: "Viernes",
  sab: "Sábado",
};

type BlockSchedule = {
  enabled: boolean;
  inicio: string;
  fin: string;
};

type DaySchedule = {
  manana: BlockSchedule;
  tarde: BlockSchedule;
};

function hasVisibleDescription(value: string | null | undefined): boolean {
  return (value ?? "").trim().length > 0;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => Number(x) || 0);
  return h * 60 + m;
}

function isInsideOpenSchedule(day: DaySchedule, horario: string): boolean {
  const start = toMinutes(horario);
  const end = start + 60;
  const blocks = [day.manana, day.tarde].filter((b) => b.enabled);
  if (blocks.length === 0) return false;
  return blocks.some((block) => {
    const blockStart = toMinutes(block.inicio);
    const blockEnd = toMinutes(block.fin);
    return start >= blockStart && end <= blockEnd;
  });
}

type Pase = {
  id: string;
  nombre: string;
  precio: number;
  estado?: string | null;
};

type Instructor = {
  id: string;
  nombre: string;
  especialidad: string;
};

/** Preferencias locales (horarios, cupos). El resto vive en Supabase por franquicia. */
type ClubConfig = {
  pases: Pase[];
  schedules: Record<DayId, DaySchedule>;
  cantidadClasesDia: string;
  horariosFijos: string[];
  cupoMaximo: string;
  aplicarCupoNuevas: boolean;
};

const defaultDaySchedule = (): DaySchedule => ({
  manana: { enabled: true, inicio: "08:00", fin: "12:00" },
  tarde: { enabled: true, inicio: "16:00", fin: "21:00" },
});

const defaultSchedules: Record<DayId, DaySchedule> = {
  lun: defaultDaySchedule(),
  mar: defaultDaySchedule(),
  mie: defaultDaySchedule(),
  jue: defaultDaySchedule(),
  vie: {
    manana: { enabled: true, inicio: "08:00", fin: "12:00" },
    tarde: { enabled: true, inicio: "17:00", fin: "21:30" },
  },
  sab: {
    manana: { enabled: true, inicio: "09:00", fin: "13:00" },
    tarde: { enabled: false, inicio: "16:00", fin: "20:00" },
  },
};

const defaultConfig: ClubConfig = {
  pases: [],
  schedules: defaultSchedules,
  cantidadClasesDia: "3",
  horariosFijos: [],
  cupoMaximo: "20",
  aplicarCupoNuevas: true,
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatPesos(value: number) {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  return `$${formatted}`;
}

function sanitizePases(raw: unknown): Pase[] {
  if (!Array.isArray(raw)) return defaultConfig.pases;
  const list = raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : newId("pase");
      const nombre =
        typeof o.nombre === "string" ? o.nombre.trim() : "";
      const precio = Math.max(
        0,
        Math.round(Number(o.precio) || 0),
      );
      if (!nombre) return null;
      return { id, nombre, precio };
    })
    .filter((x): x is Pase => x != null);
  return list;
}

function mergeSchedules(
  patch?: Partial<Record<DayId, DaySchedule>> | null,
): Record<DayId, DaySchedule> {
  if (!patch || typeof patch !== "object") return { ...defaultSchedules };
  const out = { ...defaultSchedules };
  for (const id of DAY_IDS) {
    if (patch[id]) {
      out[id] = {
        manana: { ...out[id].manana, ...patch[id]!.manana },
        tarde: { ...out[id].tarde, ...patch[id]!.tarde },
      };
    }
  }
  return out;
}

type PersistedClubSlice = Pick<
  ClubConfig,
  | "schedules"
  | "cantidadClasesDia"
  | "horariosFijos"
  | "cupoMaximo"
  | "aplicarCupoNuevas"
>;

function parseStored(raw: string | null): Partial<ClubConfig> | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<ClubConfig> & Partial<PersistedClubSlice>;
    return {
      schedules: mergeSchedules(p.schedules ?? null),
      cantidadClasesDia:
        typeof p.cantidadClasesDia === "string"
          ? p.cantidadClasesDia
          : defaultConfig.cantidadClasesDia,
      horariosFijos:
        Array.isArray(p.horariosFijos) && p.horariosFijos.length > 0
          ? p.horariosFijos.filter(
              (x): x is string => typeof x === "string" && Boolean(x.trim()),
            )
          : defaultConfig.horariosFijos,
      cupoMaximo:
        typeof p.cupoMaximo === "string" ? p.cupoMaximo : defaultConfig.cupoMaximo,
      aplicarCupoNuevas:
        typeof p.aplicarCupoNuevas === "boolean"
          ? p.aplicarCupoNuevas
          : defaultConfig.aplicarCupoNuevas,
    };
  } catch {
    return null;
  }
}

function persistableSlice(c: ClubConfig): PersistedClubSlice {
  return {
    schedules: c.schedules,
    cantidadClasesDia: c.cantidadClasesDia,
    horariosFijos: c.horariosFijos,
    cupoMaximo: c.cupoMaximo,
    aplicarCupoNuevas: c.aplicarCupoNuevas,
  };
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<ClubConfig>(defaultConfig);
  const [hydrated, setHydrated] = useState(false);

  const [selectedDay, setSelectedDay] = useState<DayId>("lun");

  const [nuevoPaseNombre, setNuevoPaseNombre] = useState("");
  const [nuevoPasePrecio, setNuevoPasePrecio] = useState("");
  const [planesVista, setPlanesVista] = useState<"activos" | "archivados" | "todos">(
    "activos",
  );

  const [nuevaForma, setNuevaForma] = useState("");

  const [nuevoConceptoIng, setNuevoConceptoIng] = useState("");
  const [nuevoConceptoEgr, setNuevoConceptoEgr] = useState("");
  const [descDrafts, setDescDrafts] = useState<Record<string, string>>({});
  const [nuevoInstructorNombre, setNuevoInstructorNombre] = useState("");
  const [nuevoInstructorEspecialidad, setNuevoInstructorEspecialidad] =
    useState("");
  const [nuevaClaseNombre, setNuevaClaseNombre] = useState("");
  const [nuevaClaseInstructorId, setNuevaClaseInstructorId] = useState("");
  const [nuevaClaseHorario, setNuevaClaseHorario] = useState("09:00");
  const [adminFranquiciaId, setAdminFranquiciaId] = useState<string | null>(null);

  const [formasPagoRows, setFormasPagoRows] = useState<FormaPago[]>([]);
  const [conceptosCajaRows, setConceptosCajaRows] = useState<ConceptoCaja[]>([]);
  const [plantillasRows, setPlantillasRows] = useState<PlantillaClase[]>([]);
  const [instructoresRows, setInstructoresRows] = useState<Instructor[]>([]);
  const [instructorDialogOpen, setInstructorDialogOpen] = useState(false);
  const [instructorEditId, setInstructorEditId] = useState<string | null>(null);
  const [instructorEditNombre, setInstructorEditNombre] = useState("");
  const [instructorEditEspecialidad, setInstructorEditEspecialidad] =
    useState("");
  const [plantillaDialogOpen, setPlantillaDialogOpen] = useState(false);
  const [plantillaEditId, setPlantillaEditId] = useState<string | null>(null);
  const [plantillaEditNombre, setPlantillaEditNombre] = useState("");
  const [plantillaEditInstructorId, setPlantillaEditInstructorId] = useState("");
  const [plantillaEditHorario, setPlantillaEditHorario] = useState("09:00");
  const [minutosLimiteBajaInscripcion, setMinutosLimiteBajaInscripcion] = useState(30);
  const [guardandoLimiteBaja, setGuardandoLimiteBaja] = useState(false);
  const { data: adminContext } = useSWR(
    "config-admin-context",
    async () => {
      const supabase = createSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: perfil, error: perfilError } = await supabase
        .from("perfiles")
        .select("franquicia_id")
        .eq("id", user.id)
        .single();
      if (perfilError || !perfil?.franquicia_id) return null;
      return { franquiciaId: perfil.franquicia_id, userId: user.id };
    },
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const {
    data: franquiciaData,
    isLoading: isLoadingConfigData,
    mutate: mutateFranquiciaData,
  } = useSWR(
    adminContext?.franquiciaId ? ["config-data", adminContext.franquiciaId] : null,
    async () => {
      const franquiciaId = adminContext!.franquiciaId;
      const supabase = createSupabaseClient();
      const [planesRes, instRes, fpRes, ccRes, plRes, franquiciaRes] = await Promise.all([
        supabase
          .from("planes")
          .select("id,nombre,precio,estado")
          .eq("franquicia_id", franquiciaId)
          .order("nombre", { ascending: true }),
        supabase
          .from("instructores")
          .select("id,nombre,estado,especialidad")
          .eq("franquicia_id", franquiciaId)
          .order("nombre", { ascending: true }),
        supabase
          .from("formas_pago")
          .select("*")
          .eq("franquicia_id", franquiciaId)
          .eq("activo", true)
          .order("orden", { ascending: true })
          .order("nombre", { ascending: true }),
        supabase
          .from("conceptos_caja")
          .select("*")
          .eq("franquicia_id", franquiciaId)
          .order("orden", { ascending: true })
          .order("concepto", { ascending: true })
          .order("descripcion", { ascending: true }),
        supabase
          .from("plantillas_clases")
          .select("*")
          .eq("franquicia_id", franquiciaId)
          .eq("activo", true)
          .order("orden", { ascending: true })
          .order("horario", { ascending: true }),
        supabase
          .from("franquicias")
          .select("minutos_limite_baja_inscripcion")
          .eq("id", franquiciaId)
          .single(),
      ]);

      return {
        franquiciaId,
        minutosLimiteBajaInscripcion: (() => {
          const v = franquiciaRes.data?.minutos_limite_baja_inscripcion;
          const n = Number(v);
          return Number.isFinite(n) ? n : 30;
        })(),
        pases:
          !planesRes.error && planesRes.data
            ? planesRes.data.map((p) => ({
                id: p.id,
                nombre: p.nombre,
                precio: Math.round(Number(p.precio) || 0),
                estado: p.estado,
              }))
            : [],
        instructores:
          !instRes.error && instRes.data
            ? instRes.data.map((inst) => ({
                id: inst.id,
                nombre: inst.nombre,
                especialidad: inst.especialidad?.trim() ?? "",
              }))
            : [],
        formas: !fpRes.error && fpRes.data ? fpRes.data : [],
        conceptos:
          !ccRes.error && ccRes.data
            ? ccRes.data.filter((row) => row.descripcion.trim().toLowerCase() !== "general")
            : [],
        plantillas: !plRes.error && plRes.data ? plRes.data : [],
      };
    },
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  useEffect(() => {
    const loaded = parseStored(
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null,
    );
    if (loaded) setConfig((c) => ({ ...defaultConfig, ...loaded }));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(persistableSlice(config)),
    );
  }, [config, hydrated]);

  useEffect(() => {
    if (!franquiciaData) return;
    setAdminFranquiciaId(franquiciaData.franquiciaId);
    setConfig((c) => ({ ...c, pases: franquiciaData.pases }));
    setInstructoresRows(franquiciaData.instructores);
    setFormasPagoRows(franquiciaData.formas);
    setConceptosCajaRows(franquiciaData.conceptos);
    setPlantillasRows(franquiciaData.plantillas);
    setMinutosLimiteBajaInscripcion(franquiciaData.minutosLimiteBajaInscripcion);
  }, [franquiciaData]);

  const guardarLimiteBajaInscripcion = useCallback(async () => {
    if (!adminContext?.userId) {
      toast.error("No se pudo identificar al usuario actual");
      return;
    }
    setGuardandoLimiteBaja(true);
    try {
      const result = await actualizarMinutosLimiteBajaInscripcionAction({
        userId: adminContext.userId,
        minutos: minutosLimiteBajaInscripcion,
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar");
        return;
      }
      await mutateFranquiciaData();
      toast.success("Política de bajas actualizada");
    } finally {
      setGuardandoLimiteBaja(false);
    }
  }, [adminContext?.userId, minutosLimiteBajaInscripcion, mutateFranquiciaData]);

  const updateBlock = useCallback(
    (block: "manana" | "tarde", patch: Partial<BlockSchedule>) => {
      setConfig((prev) => ({
        ...prev,
        schedules: {
          ...prev.schedules,
          [selectedDay]: {
            ...prev.schedules[selectedDay],
            [block]: { ...prev.schedules[selectedDay][block], ...patch },
          },
        },
      }));
    },
    [selectedDay],
  );

  const day = config.schedules[selectedDay];

  const ingresosGrouped = useMemo(() => {
    const map = new Map<string, ConceptoCaja[]>();
    for (const r of conceptosCajaRows) {
      if (r.tipo !== "ingreso") continue;
      if (!map.has(r.concepto)) map.set(r.concepto, []);
      map.get(r.concepto)!.push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [conceptosCajaRows]);

  const egresosGrouped = useMemo(() => {
    const map = new Map<string, ConceptoCaja[]>();
    for (const r of conceptosCajaRows) {
      if (r.tipo !== "egreso") continue;
      if (!map.has(r.concepto)) map.set(r.concepto, []);
      map.get(r.concepto)!.push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [conceptosCajaRows]);

  const instructorNombreById = useMemo(
    () =>
      Object.fromEntries(
        instructoresRows.map((inst) => [inst.id, inst.nombre]),
      ),
    [instructoresRows],
  );

  const plantillasFiltradas = useMemo(
    () =>
      plantillasRows.filter((tpl) => {
        if (tpl.dia_semana !== selectedDay) return false;
        const today = new Date().toISOString().slice(0, 10);
        if (tpl.valid_from && tpl.valid_from > today) return false;
        if (tpl.valid_to && tpl.valid_to < today) return false;
        return true;
      }),
    [plantillasRows, selectedDay],
  );

  const addPase = async () => {
    const nombre = toTitleCase(nuevoPaseNombre.trim());
    const precio = Math.max(0, Math.round(Number(nuevoPasePrecio) || 0));
    if (!nombre) return;
    if (!adminFranquiciaId) {
      toast.error("No se pudo identificar la franquicia del administrador");
      return;
    }

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("planes").insert({
        franquicia_id: adminFranquiciaId,
        nombre,
        precio,
        estado: "activo",
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      await mutateFranquiciaData();
      setNuevoPaseNombre("");
      setNuevoPasePrecio("");
      toast.success("Plan creado correctamente");
    } catch {
      toast.error("No se pudo crear el plan");
    }
  };

  const removePase = async (id: string) => {
    if (!adminFranquiciaId) return;
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from("planes")
        .update({ estado: "inactivo" })
        .eq("id", id)
        .eq("franquicia_id", adminFranquiciaId);
      if (error) {
        toast.error(error.message);
        return;
      }
      await mutateFranquiciaData();
      toast.success("Pase eliminado correctamente");
    } catch {
      toast.error("No se pudo eliminar el plan");
    }
  };

  const restorePase = async (id: string) => {
    if (!adminFranquiciaId) return;
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from("planes")
        .update({ estado: "activo" })
        .eq("id", id)
        .eq("franquicia_id", adminFranquiciaId);
      if (error) {
        toast.error(error.message);
        return;
      }
      await mutateFranquiciaData();
      toast.success("Plan restaurado correctamente");
    } catch {
      toast.error("No se pudo restaurar el plan");
    }
  };

  const addForma = async () => {
    const t = toTitleCase(nuevaForma.trim());
    if (!t || !adminFranquiciaId) return;
    if (
      formasPagoRows.some((x) => x.nombre.toLowerCase() === t.toLowerCase())
    ) {
      toast.error("Esta forma de pago ya existe");
      return;
    }
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("formas_pago").insert({
        franquicia_id: adminFranquiciaId,
        nombre: t,
        orden: formasPagoRows.length,
        activo: true,
      });
      if (error) {
        if (error.code === "23505" || error.message.includes("duplicate")) {
          return toast.error("Esta forma de pago ya existe");
        }
        return toast.error("Error al guardar la forma de pago");
      }
      setNuevaForma("");
      await mutateFranquiciaData();
      toast.success("Forma de pago agregada correctamente");
    } catch (err) {
      const message =
        err instanceof Error ? err.message.toLowerCase() : "";
      if (message.includes("23505") || message.includes("duplicate")) {
        return toast.error("Esta forma de pago ya existe");
      }
      return toast.error("Error al guardar la forma de pago");
    }
  };

  const removeForma = async (id: string) => {
    if (!adminFranquiciaId) return;
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("formas_pago").delete().eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await mutateFranquiciaData();
      toast.success("Forma de pago eliminada correctamente");
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const addConcepto = async (rama: "ingresos" | "egresos", nombre: string) => {
    const t = toTitleCase(nombre.trim());
    const tipo = rama === "ingresos" ? "ingreso" : "egreso";
    if (!t || !adminFranquiciaId) return;
    if (conceptosCajaRows.some((r) => r.tipo === tipo && r.concepto === t)) {
      return;
    }
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("conceptos_caja").insert({
        franquicia_id: adminFranquiciaId,
        tipo,
        concepto: t,
        descripcion: "",
        orden: 0,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (rama === "ingresos") setNuevoConceptoIng("");
      else setNuevoConceptoEgr("");
      await mutateFranquiciaData();
      toast.success("Concepto agregado correctamente");
    } catch {
      toast.error("No se pudo agregar el concepto");
    }
  };

  const removeConcepto = async (
    rama: "ingresos" | "egresos",
    concepto: string,
  ) => {
    if (concepto === CONCEPTO_PAGO_CUOTA) {
      toast.error("Este concepto es del sistema y no se puede eliminar");
      return;
    }
    if (!adminFranquiciaId) return;
    const tipo = rama === "ingresos" ? "ingreso" : "egreso";
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from("conceptos_caja")
        .delete()
        .eq("franquicia_id", adminFranquiciaId)
        .eq("tipo", tipo)
        .eq("concepto", concepto);
      if (error) {
        toast.error(error.message);
        return;
      }
      await mutateFranquiciaData();
      toast.success("Concepto eliminado correctamente");
    } catch {
      toast.error("No se pudo eliminar el concepto");
    }
  };

  const addDescripcion = async (
    rama: "ingresos" | "egresos",
    concepto: string,
    draftKey: string,
  ) => {
    const text = toTitleCase((descDrafts[draftKey] ?? "").trim());
    const tipo = rama === "ingresos" ? "ingreso" : "egreso";
    if (!text || !adminFranquiciaId) return;
    if (
      conceptosCajaRows.some(
        (r) =>
          r.tipo === tipo &&
          r.concepto === concepto &&
          r.descripcion.toLowerCase() === text.toLowerCase(),
      )
    ) {
      return;
    }
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("conceptos_caja").insert({
        franquicia_id: adminFranquiciaId,
        tipo,
        concepto,
        descripcion: text,
        orden: 0,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setDescDrafts((d) => ({ ...d, [draftKey]: "" }));
      await mutateFranquiciaData();
      toast.success("Descripción agregada correctamente");
    } catch {
      toast.error("No se pudo agregar la descripción");
    }
  };

  const removeDescripcionRow = async (id: string) => {
    if (!adminFranquiciaId) return;
    const target = conceptosCajaRows.find((row) => row.id === id);
    if (!target) return;
    const siblings = conceptosCajaRows.filter(
      (row) =>
        row.tipo === target.tipo &&
        row.concepto === target.concepto &&
        row.franquicia_id === target.franquicia_id,
    );
    try {
      const supabase = createSupabaseClient();
      const { error } =
        siblings.length <= 1
          ? await supabase
              .from("conceptos_caja")
              .update({ descripcion: "" })
              .eq("id", id)
          : await supabase
              .from("conceptos_caja")
              .delete()
              .eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await mutateFranquiciaData();
      toast.success("Descripción eliminada correctamente");
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const addInstructor = async () => {
    const nombre = toTitleCase(nuevoInstructorNombre.trim());
    if (!nombre || !adminFranquiciaId) return;
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("instructores").insert({
        franquicia_id: adminFranquiciaId,
        nombre,
        estado: "activo",
        especialidad: toTitleCase(nuevoInstructorEspecialidad.trim()) || null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setNuevoInstructorNombre("");
      setNuevoInstructorEspecialidad("");
      await mutateFranquiciaData();
      toast.success("Instructor agregado correctamente");
    } catch {
      toast.error("No se pudo agregar el instructor");
    }
  };

  const removeInstructor = async (id: string) => {
    if (!adminFranquiciaId) return;
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("instructores").delete().eq("id", id);
      if (error) {
        toast.error(
          error.message.includes("foreign key")
            ? "No se puede eliminar: hay plantillas u otras referencias."
            : error.message,
        );
        return;
      }
      await mutateFranquiciaData();
      toast.success("Instructor eliminado correctamente");
    } catch {
      toast.error("No se pudo eliminar el instructor");
    }
  };

  const openEditInstructor = (inst: Instructor) => {
    setInstructorEditId(inst.id);
    setInstructorEditNombre(inst.nombre);
    setInstructorEditEspecialidad(inst.especialidad ?? "");
    setInstructorDialogOpen(true);
  };

  const saveInstructorEdit = async () => {
    if (!instructorEditId || !adminFranquiciaId) return;
    const nombre = toTitleCase(instructorEditNombre.trim());
    if (!nombre) return;
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from("instructores")
        .update({
          nombre,
          especialidad: toTitleCase(instructorEditEspecialidad.trim()) || null,
        })
        .eq("id", instructorEditId)
        .eq("franquicia_id", adminFranquiciaId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setInstructorDialogOpen(false);
      setInstructorEditId(null);
      await mutateFranquiciaData();
      toast.success("Instructor actualizado");
    } catch {
      toast.error("No se pudo guardar");
    }
  };

  const addClaseTemplate = async () => {
    const nombre = toTitleCase(nuevaClaseNombre.trim());
    const horarioRaw = nuevaClaseHorario.trim().slice(0, 5);
    if (!nombre || !nuevaClaseInstructorId || !horarioRaw || !adminFranquiciaId)
      return;
    const daySchedule = config.schedules[selectedDay];
    if (!isInsideOpenSchedule(daySchedule, horarioRaw)) {
      toast.error("El horario de la clase está fuera del horario de apertura del club");
      return;
    }
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("plantillas_clases").insert({
        franquicia_id: adminFranquiciaId,
        nombre,
        instructor_id: nuevaClaseInstructorId,
        horario: horarioRaw,
        dia_semana: selectedDay,
        valid_from: new Date().toISOString().slice(0, 10),
        valid_to: null,
        orden: plantillasRows.length,
        activo: true,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setNuevaClaseNombre("");
      setNuevaClaseInstructorId("");
      setNuevaClaseHorario("09:00");
      await mutateFranquiciaData();
      toast.success("Plantilla guardada correctamente");
    } catch {
      toast.error("No se pudo guardar la plantilla");
    }
  };

  const removeClaseTemplate = async (id: string) => {
    if (!adminFranquiciaId) return;
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from("plantillas_clases")
        .delete()
        .eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await mutateFranquiciaData();
      toast.success("Plantilla eliminada correctamente");
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const openEditPlantilla = (tpl: PlantillaClase) => {
    setPlantillaEditId(tpl.id);
    setPlantillaEditNombre(tpl.nombre);
    setPlantillaEditInstructorId(tpl.instructor_id);
    setPlantillaEditHorario(tpl.horario);
    setPlantillaDialogOpen(true);
  };

  const savePlantillaEdit = async () => {
    if (!plantillaEditId || !adminFranquiciaId) return;
    const nombre = toTitleCase(plantillaEditNombre.trim());
    const horarioRaw = plantillaEditHorario.trim().slice(0, 5);
    if (!nombre || !plantillaEditInstructorId || !horarioRaw) return;
    const daySchedule = config.schedules[selectedDay];
    if (!isInsideOpenSchedule(daySchedule, horarioRaw)) {
      toast.error("El horario de la clase está fuera del horario de apertura del club");
      return;
    }
    try {
      const supabase = createSupabaseClient();
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const current = plantillasRows.find((tpl) => tpl.id === plantillaEditId);
      if (!current) return;

      const { error: closeError } = await supabase
        .from("plantillas_clases")
        .update({
          valid_to: today,
        })
        .eq("id", plantillaEditId)
        .eq("franquicia_id", adminFranquiciaId);
      if (closeError) {
        toast.error(closeError.message);
        return;
      }

      const { error: createError } = await supabase.from("plantillas_clases").insert({
        franquicia_id: adminFranquiciaId,
        nombre,
        instructor_id: plantillaEditInstructorId,
        horario: horarioRaw,
        dia_semana: current.dia_semana,
        valid_from: tomorrow,
        valid_to: null,
        orden: current.orden ?? 0,
        activo: true,
      });
      if (createError) {
        toast.error(createError.message);
        return;
      }
      setPlantillaDialogOpen(false);
      setPlantillaEditId(null);
      await mutateFranquiciaData();
      toast.success("Plantilla actualizada correctamente");
    } catch {
      toast.error("No se pudo actualizar la plantilla");
    }
  };

  const cardClass =
    "border-zinc-800/50 bg-card shadow-none ring-0 text-zinc-50";

  const pasesFiltrados = useMemo(() => {
    if (planesVista === "todos") return config.pases;
    return config.pases.filter((p) =>
      planesVista === "activos" ? p.estado !== "inactivo" : p.estado === "inactivo",
    );
  }, [config.pases, planesVista]);

  return (
    <div className="min-w-0 font-sans text-zinc-50">
      <div className="mb-8">
        <h1 className={PAGE_TITLE_CLASS}>Configuración</h1>
      </div>

      <Tabs defaultValue="pases" className="w-full min-w-0">
        <TabsList
          variant="line"
          className="mb-6 h-auto w-full min-w-0 flex-wrap justify-start gap-1 border-b border-zinc-800/50 bg-transparent p-0 pb-0"
        >
          <TabsTrigger
            value="pases"
            className="rounded-none border-0 border-b-2 border-transparent px-3 py-2 data-active:border-[#e41b68] data-active:bg-transparent data-active:text-zinc-50 data-active:shadow-none"
          >
            Pases
          </TabsTrigger>
          <TabsTrigger
            value="formas"
            className="rounded-none border-0 border-b-2 border-transparent px-3 py-2 data-active:border-[#e41b68] data-active:bg-transparent data-active:text-zinc-50 data-active:shadow-none"
          >
            Formas de Pago
          </TabsTrigger>
          <TabsTrigger
            value="conceptos"
            className="rounded-none border-0 border-b-2 border-transparent px-3 py-2 data-active:border-[#e41b68] data-active:bg-transparent data-active:text-zinc-50 data-active:shadow-none"
          >
            Conceptos de Caja
          </TabsTrigger>
          <TabsTrigger
            value="horarios"
            className="rounded-none border-0 border-b-2 border-transparent px-3 py-2 data-active:border-[#e41b68] data-active:bg-transparent data-active:text-zinc-50 data-active:shadow-none"
          >
            Horarios
          </TabsTrigger>
          <TabsTrigger
            value="instructores"
            className="rounded-none border-0 border-b-2 border-transparent px-3 py-2 data-active:border-[#e41b68] data-active:bg-transparent data-active:text-zinc-50 data-active:shadow-none"
          >
            Instructores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pases" className="mt-0 outline-none">
          <Card className={cardClass}>
            <CardHeader>
              <PremiumCardTitle>Planes del gimnasio</PremiumCardTitle>
              <CardDescription className="text-sm text-zinc-500">
                Los planes son inmutables en nombre/precio: para actualizar un valor,
                creá uno nuevo y archivá el anterior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-4">
                <p className={cn(LABEL_TECH, "mb-3")}>Nuevo pase</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor="pase-nombre" className={LABEL_TECH}>
                      Nombre del pase
                    </Label>
                    <Input
                      id="pase-nombre"
                      value={nuevoPaseNombre}
                      onChange={(e) => setNuevoPaseNombre(e.target.value)}
                      className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    />
                  </div>
                  <div className="w-full space-y-1.5 sm:w-40">
                    <Label htmlFor="pase-precio" className={LABEL_TECH}>
                      Precio mensual
                    </Label>
                    <Input
                      id="pase-precio"
                      type="number"
                      min={0}
                      step={500}
                      value={nuevoPasePrecio}
                      onChange={(e) => setNuevoPasePrecio(e.target.value)}
                      className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    />
                  </div>
                  <Button
                    type="button"
                    className={cn("w-full shrink-0 sm:w-auto", BTN_FUCSIA)}
                    onClick={() => void addPase()}
                  >
                    <Plus className="size-4" aria-hidden />
                    Agregar pase
                  </Button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className={LABEL_TECH}>Planes</p>
                  <div className="inline-flex rounded-lg border border-zinc-800/70 bg-zinc-950/50 p-1">
                    {(["activos", "archivados", "todos"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPlanesVista(mode)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                          planesVista === mode
                            ? "bg-[#e41b68]/20 text-[#ff8fb8]"
                            : "text-zinc-400 hover:text-zinc-200",
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                {pasesFiltrados.length === 0 ? (
                  <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/50 py-8 text-center text-sm text-zinc-500">
                    {isLoadingConfigData && !franquiciaData ? "Cargando..." : "Sin registros."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {pasesFiltrados.map((p) => {
                      const archivado = p.estado === "inactivo";
                      return (
                        <article
                          key={p.id}
                          className={cn(
                            "rounded-2xl border border-zinc-800 bg-zinc-900 p-6",
                            archivado && "opacity-70",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="text-xl font-bold text-zinc-100">{p.nombre}</h4>
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                                archivado
                                  ? "border-zinc-600 bg-zinc-800/80 text-zinc-300"
                                  : "border-[#5ab253]/40 bg-[#5ab253]/15 text-[#5ab253]",
                              )}
                            >
                              {archivado ? "Archivado" : "Activo"}
                            </span>
                          </div>

                          <p className="my-4 text-3xl font-extrabold tracking-tight text-zinc-50">
                            {formatPesos(p.precio)}
                          </p>

                          <div className="mt-4 border-t border-zinc-800/70 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "w-full border-zinc-700 bg-transparent",
                                archivado
                                  ? "text-zinc-200 hover:bg-zinc-800"
                                  : "text-[#e41b68] hover:bg-[#e41b68]/10 hover:text-[#e41b68]",
                              )}
                              onClick={() =>
                                archivado
                                  ? void restorePase(p.id)
                                  : void removePase(p.id)
                              }
                              aria-label={`${archivado ? "Restaurar" : "Archivar"} ${p.nombre}`}
                            >
                              {archivado ? "Restaurar" : "Archivar"}
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="formas" className="mt-0 outline-none">
          <Card className={cardClass}>
            <CardHeader>
              <PremiumCardTitle>Formas de pago</PremiumCardTitle>
              <CardDescription className="text-sm text-zinc-500">
                Formas de pago aceptadas en caja y administración. Agregá o quitá
                etiquetas según tu operación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-4">
                <p className={cn(LABEL_TECH, "mb-3")}>Agregar forma de pago</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={nuevaForma}
                    onChange={(e) => setNuevaForma(e.target.value)}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addForma();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    className={cn("w-full sm:w-auto", BTN_VERDE)}
                    onClick={() => void addForma()}
                  >
                    <Plus className="size-4" aria-hidden />
                    Agregar forma de pago
                  </Button>
                </div>
              </div>

              <div>
                <p className={cn(LABEL_TECH, "mb-3")}>Formas de pago configuradas</p>
                <div className="flex flex-wrap gap-2">
                  {formasPagoRows.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      {isLoadingConfigData && !franquiciaData ? "Cargando..." : "Sin registros."}
                    </p>
                  ) : (
                    formasPagoRows.map((fp) => (
                      <span
                        key={fp.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/80 px-3 py-1.5 text-sm text-zinc-200"
                      >
                        {fp.nombre}
                        <button
                          type="button"
                          className="rounded p-0.5 text-[#e41b68]/80 transition-colors hover:bg-[#e41b68]/15 hover:text-[#e41b68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                          onClick={() => void removeForma(fp.id)}
                          aria-label={`Quitar ${fp.nombre}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conceptos" className="mt-0 outline-none">
          <Card className={cardClass}>
            <CardHeader>
              <PremiumCardTitle>Conceptos de caja</PremiumCardTitle>
              <CardDescription className="text-sm text-zinc-500">
                Catálogo guardado en la base de datos por franquicia. Se usa en
                caja para validar movimientos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-8 lg:grid-cols-2">
                <section className="min-w-0 space-y-4">
                  <SectionHeading as="h3">Ingresos</SectionHeading>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label htmlFor="nuevo-concepto-ing" className={LABEL_TECH}>
                        Nuevo concepto
                      </Label>
                      <Input
                        id="nuevo-concepto-ing"
                        value={nuevoConceptoIng}
                        onChange={(e) => setNuevoConceptoIng(e.target.value)}
                        className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      />
                    </div>
                    <Button
                      type="button"
                      className={cn("w-full shrink-0 sm:w-auto", BTN_VERDE)}
                      onClick={() =>
                        void addConcepto("ingresos", nuevoConceptoIng)
                      }
                    >
                      <Plus className="size-4" aria-hidden />
                      Nuevo concepto
                    </Button>
                  </div>
                  {ingresosGrouped.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      {isLoadingConfigData && !franquiciaData ? "Cargando..." : "Sin registros."}
                    </p>
                  ) : (
                    <Accordion
                      type="multiple"
                      className="h-auto rounded-xl border border-zinc-800/50 bg-zinc-950/40 px-2"
                    >
                      {ingresosGrouped.map(([concepto, rows]) => (
                        (() => {
                          const isSystemConcept = concepto === CONCEPTO_PAGO_CUOTA;
                          return (
                        <AccordionItem
                          key={concepto}
                          value={concepto}
                          className="border-zinc-800/50"
                        >
                          <div className="flex items-stretch gap-1">
                            <AccordionTrigger className="flex-1 py-3 hover:no-underline">
                              <span className="text-left text-sm font-semibold text-zinc-100">
                                {concepto}
                              </span>
                            </AccordionTrigger>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-2 shrink-0 self-start text-[#e41b68]/80 hover:bg-[#e41b68]/10 hover:text-[#e41b68]"
                              disabled={isSystemConcept}
                              title={
                                isSystemConcept
                                  ? "Este concepto es del sistema y no se puede eliminar"
                                  : undefined
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                void removeConcepto("ingresos", concepto);
                              }}
                              aria-label={`Eliminar concepto ${concepto}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          {isSystemConcept ? (
                            <p className="px-1 pb-2 text-xs text-zinc-500">
                              Este concepto es del sistema y no se puede eliminar.
                            </p>
                          ) : null}
                          <AccordionContent className="h-auto overflow-visible pb-4">
                            <div className="flex flex-wrap gap-2 pb-2">
                              {rows
                                .filter((row) => hasVisibleDescription(row.descripcion))
                                .map((row) => (
                                <span
                                  key={row.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-zinc-800/80 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200"
                                >
                                  {row.descripcion}
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-zinc-500 hover:text-[#e41b68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                                    onClick={() =>
                                      void removeDescripcionRow(row.id)
                                    }
                                    aria-label={`Quitar ${row.descripcion}`}
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="relative mb-2 flex h-auto flex-col gap-2 border-t border-zinc-800/50 pt-3 pb-3 sm:flex-row">
                              <Input
                                value={
                                  descDrafts[`ing-${concepto}`] ?? ""
                                }
                                onChange={(e) =>
                                  setDescDrafts((prev) => ({
                                    ...prev,
                                    [`ing-${concepto}`]: e.target.value,
                                  }))
                                }
                                className="border-zinc-800 bg-zinc-950 text-sm text-zinc-100 sm:flex-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className={cn("w-full sm:w-auto", BTN_VERDE)}
                                onClick={() =>
                                  void addDescripcion(
                                    "ingresos",
                                    concepto,
                                    `ing-${concepto}`,
                                  )
                                }
                              >
                                <Plus className="size-4" aria-hidden />
                                Nueva descripción
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                          );
                        })()
                      ))}
                    </Accordion>
                  )}
                </section>

                <section className="min-w-0 space-y-4">
                  <SectionHeading as="h3">Egresos</SectionHeading>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label htmlFor="nuevo-concepto-egr" className={LABEL_TECH}>
                        Nuevo concepto
                      </Label>
                      <Input
                        id="nuevo-concepto-egr"
                        value={nuevoConceptoEgr}
                        onChange={(e) => setNuevoConceptoEgr(e.target.value)}
                        className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      />
                    </div>
                    <Button
                      type="button"
                      className={cn("w-full shrink-0 sm:w-auto", BTN_FUCSIA)}
                      onClick={() =>
                        void addConcepto("egresos", nuevoConceptoEgr)
                      }
                    >
                      <Plus className="size-4" aria-hidden />
                      Nuevo concepto
                    </Button>
                  </div>
                  {egresosGrouped.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      {isLoadingConfigData && !franquiciaData ? "Cargando..." : "Sin registros."}
                    </p>
                  ) : (
                    <Accordion
                      type="multiple"
                      className="h-auto rounded-xl border border-zinc-800/50 bg-zinc-950/40 px-2"
                    >
                      {egresosGrouped.map(([concepto, rows]) => (
                        <AccordionItem
                          key={concepto}
                          value={concepto}
                          className="border-zinc-800/50"
                        >
                          <div className="flex items-stretch gap-1">
                            <AccordionTrigger className="flex-1 py-3 hover:no-underline">
                              <span className="text-left text-sm font-semibold text-zinc-100">
                                {concepto}
                              </span>
                            </AccordionTrigger>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-2 shrink-0 self-start text-[#e41b68]/80 hover:bg-[#e41b68]/10 hover:text-[#e41b68]"
                              onClick={(e) => {
                                e.stopPropagation();
                                void removeConcepto("egresos", concepto);
                              }}
                              aria-label={`Eliminar concepto ${concepto}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          <AccordionContent className="h-auto overflow-visible pb-4">
                            <div className="flex flex-wrap gap-2 pb-2">
                              {rows
                                .filter((row) => hasVisibleDescription(row.descripcion))
                                .map((row) => (
                                <span
                                  key={row.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-zinc-800/80 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200"
                                >
                                  {row.descripcion}
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-zinc-500 hover:text-[#e41b68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                                    onClick={() =>
                                      void removeDescripcionRow(row.id)
                                    }
                                    aria-label={`Quitar ${row.descripcion}`}
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="relative mb-2 flex h-auto flex-col gap-2 border-t border-zinc-800/50 pt-3 pb-3 sm:flex-row">
                              <Input
                                value={
                                  descDrafts[`egr-${concepto}`] ?? ""
                                }
                                onChange={(e) =>
                                  setDescDrafts((prev) => ({
                                    ...prev,
                                    [`egr-${concepto}`]: e.target.value,
                                  }))
                                }
                                className="border-zinc-800 bg-zinc-950 text-sm text-zinc-100 sm:flex-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className={cn("w-full sm:w-auto", BTN_FUCSIA)}
                                onClick={() =>
                                  void addDescripcion(
                                    "egresos",
                                    concepto,
                                    `egr-${concepto}`,
                                  )
                                }
                              >
                                <Plus className="size-4" aria-hidden />
                                Nueva descripción
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </section>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instructores" className="mt-0 outline-none">
          <Card className={cardClass}>
            <CardHeader>
              <PremiumCardTitle>Instructores</PremiumCardTitle>
              <CardDescription className="text-sm text-zinc-500">
                Gestioná el staff de profesores para asignarlo en plantillas y
                clases del calendario.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-4">
                <p className={cn(LABEL_TECH, "mb-3")}>Nuevo instructor</p>
                <div className="grid gap-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="instructor-nombre" className={LABEL_TECH}>
                      Nombre
                    </Label>
                    <Input
                      id="instructor-nombre"
                      value={nuevoInstructorNombre}
                      onChange={(e) => setNuevoInstructorNombre(e.target.value)}
                      className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="instructor-esp" className={LABEL_TECH}>
                      Especialidad (opcional)
                    </Label>
                    <Input
                      id="instructor-esp"
                      value={nuevoInstructorEspecialidad}
                      onChange={(e) =>
                        setNuevoInstructorEspecialidad(e.target.value)
                      }
                      className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    />
                  </div>
                  <Button
                    type="button"
                    className={cn("w-full md:w-auto", BTN_FUCSIA)}
                    onClick={() => void addInstructor()}
                  >
                    <Plus className="size-4" />
                    Agregar instructor
                  </Button>
                </div>
              </div>
              <div>
                <p className={cn(LABEL_TECH, "mb-2")}>Plantel cargado</p>
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800/50 hover:bg-transparent">
                      <TableHead className={LABEL_TECH}>Nombre</TableHead>
                      <TableHead className={LABEL_TECH}>Especialidad</TableHead>
                      <TableHead className="w-24 text-right">
                        <span className="sr-only">Editar</span>
                      </TableHead>
                      <TableHead className="w-12 text-right">
                        <span className="sr-only">Eliminar</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instructoresRows.length === 0 ? (
                      <TableRow className="border-zinc-800/50">
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-sm text-zinc-500"
                        >
                          Sin registros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      instructoresRows.map((inst) => (
                        <TableRow
                          key={inst.id}
                          className="border-zinc-800/50 hover:bg-zinc-800/30"
                        >
                          <TableCell className="font-semibold text-zinc-100">
                            {inst.nombre}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-300">
                            {inst.especialidad || "Sin especialidad"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                              onClick={() => openEditInstructor(inst)}
                              aria-label={`Editar ${inst.nombre}`}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-[#e41b68]/80 hover:bg-[#e41b68]/10 hover:text-[#e41b68]"
                              onClick={() => void removeInstructor(inst.id)}
                              aria-label={`Eliminar ${inst.nombre}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="horarios" className="mt-0 space-y-8 outline-none">
          <Card className={cardClass}>
            <CardHeader>
              <PremiumCardTitle>
                Horarios globales del gimnasio
              </PremiumCardTitle>
              <CardDescription className="text-sm text-zinc-500">
                Definí franjas por día (lunes a sábado). Los cambios quedan
                guardados en este navegador.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className={cn(LABEL_TECH, "mb-2")}>Día</p>
                <div className="flex flex-wrap gap-2">
                  {DAY_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedDay(id)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                        selectedDay === id
                          ? "border-[#e41b68] bg-[#e41b68]/15 text-[#ff8fb8]"
                          : "border-zinc-800/80 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60",
                      )}
                    >
                      {DAY_LABELS[id]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#5ab253]">
                        Mañana
                      </p>
                      <p className="text-xs text-zinc-500">
                        Franja habitual de apertura
                      </p>
                    </div>
                    <Switch
                      checked={day.manana.enabled}
                      onCheckedChange={(v) =>
                        updateBlock("manana", { enabled: v })
                      }
                    />
                  </div>
                  <div
                    className={cn(
                      "mt-4 grid gap-3 sm:grid-cols-2",
                      !day.manana.enabled && "pointer-events-none opacity-40",
                    )}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="manana-inicio" className={LABEL_TECH}>
                        Desde
                      </Label>
                      <Input
                        id="manana-inicio"
                        type="time"
                        value={day.manana.inicio}
                        onChange={(e) =>
                          updateBlock("manana", { inicio: e.target.value })
                        }
                        className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="manana-fin" className={LABEL_TECH}>
                        Hasta
                      </Label>
                      <Input
                        id="manana-fin"
                        type="time"
                        value={day.manana.fin}
                        onChange={(e) =>
                          updateBlock("manana", { fin: e.target.value })
                        }
                        className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#e41b68]">
                        Tarde
                      </p>
                      <p className="text-xs text-zinc-500">
                        Segundo turno del día
                      </p>
                    </div>
                    <Switch
                      checked={day.tarde.enabled}
                      onCheckedChange={(v) =>
                        updateBlock("tarde", { enabled: v })
                      }
                    />
                  </div>
                  <div
                    className={cn(
                      "mt-4 grid gap-3 sm:grid-cols-2",
                      !day.tarde.enabled && "pointer-events-none opacity-40",
                    )}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="tarde-inicio" className={LABEL_TECH}>
                        Desde
                      </Label>
                      <Input
                        id="tarde-inicio"
                        type="time"
                        value={day.tarde.inicio}
                        onChange={(e) =>
                          updateBlock("tarde", { inicio: e.target.value })
                        }
                        className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tarde-fin" className={LABEL_TECH}>
                        Hasta
                      </Label>
                      <Input
                        id="tarde-fin"
                        type="time"
                        value={day.tarde.fin}
                        onChange={(e) =>
                          updateBlock("tarde", { fin: e.target.value })
                        }
                        className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader>
              <PremiumCardTitle>Baja de inscripciones (socios)</PremiumCardTitle>
              <CardDescription className="text-sm text-zinc-500">
                Tiempo mínimo antes del inicio de cada clase en el que el socio ya no puede
                anular su reserva. Vale para todas las clases y todos los días.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:max-w-md">
                <div className="space-y-1.5">
                  <Label htmlFor="limite-baja-minutos" className={LABEL_TECH}>
                    Antelación mínima (minutos)
                  </Label>
                  <Input
                    id="limite-baja-minutos"
                    type="number"
                    min={0}
                    max={10080}
                    inputMode="numeric"
                    value={minutosLimiteBajaInscripcion}
                    onChange={(e) =>
                      setMinutosLimiteBajaInscripcion(
                        Math.max(0, Math.min(10_080, Math.round(Number(e.target.value) || 0))),
                      )
                    }
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                  />
                  <p className="text-xs text-zinc-500">
                    Ejemplo: con 30, si la clase empieza a las 10:00, la baja en línea se cierra a
                    las 9:30.
                  </p>
                </div>
                <Button
                  type="button"
                  className={cn("w-full sm:w-auto", BTN_VERDE)}
                  disabled={guardandoLimiteBaja || !adminContext?.userId}
                  onClick={() => void guardarLimiteBajaInscripcion()}
                >
                  {guardandoLimiteBaja ? "Guardando…" : "Guardar política"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader>
              <PremiumCardTitle>
                Plantillas de clases globales
              </PremiumCardTitle>
              <CardDescription className="text-sm text-zinc-500">
                Definí nombre, instructor y horario fijo para el día seleccionado
                en el selector superior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-4">
                <p className={cn(LABEL_TECH, "mb-3")}>Nueva plantilla</p>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-nombre" className={LABEL_TECH}>
                      Nombre de la clase
                    </Label>
                    <Input
                      id="tpl-nombre"
                      value={nuevaClaseNombre}
                      onChange={(e) => setNuevaClaseNombre(e.target.value)}
                      className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-instructor" className={LABEL_TECH}>
                      Instructor a cargo
                    </Label>
                    <Select
                      value={nuevaClaseInstructorId}
                      onValueChange={setNuevaClaseInstructorId}
                    >
                      <SelectTrigger
                        id="tpl-instructor"
                        className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      >
                        <SelectValue placeholder="Seleccionar instructor" />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                        {instructoresRows.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id}>
                            {inst.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-horario" className={LABEL_TECH}>
                      Horario fijo
                    </Label>
                    <Input
                      id="tpl-horario"
                      type="time"
                      value={nuevaClaseHorario}
                      onChange={(e) => setNuevaClaseHorario(e.target.value)}
                      className="border-zinc-800 bg-zinc-950 text-zinc-100"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      className={cn("w-full md:w-auto", BTN_FUCSIA)}
                      onClick={() => void addClaseTemplate()}
                    >
                      <Plus className="size-4" />
                      Guardar plantilla
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Día asignado automáticamente: {DAY_LABELS[selectedDay]}.
                </p>
              </div>

              <div>
                <p className={cn(LABEL_TECH, "mb-2")}>
                  Plantillas cargadas ({DAY_LABELS[selectedDay]})
                </p>
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800/50 hover:bg-transparent">
                      <TableHead className={LABEL_TECH}>Clase</TableHead>
                      <TableHead className={LABEL_TECH}>Instructor</TableHead>
                      <TableHead className={LABEL_TECH}>Horario</TableHead>
                      <TableHead className="w-24 text-right">
                        <span className="sr-only">Editar</span>
                      </TableHead>
                      <TableHead className="w-12 text-right">
                        <span className="sr-only">Eliminar</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plantillasFiltradas.length === 0 ? (
                      <TableRow className="border-zinc-800/50">
                        <TableCell
                          colSpan={5}
                          className="py-8 text-center text-sm text-zinc-500"
                        >
                          Sin registros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      plantillasFiltradas.map((tpl) => (
                        <TableRow
                          key={tpl.id}
                          className="border-zinc-800/50 hover:bg-zinc-800/30"
                        >
                          <TableCell className="font-semibold text-zinc-100">
                            {tpl.nombre}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-300">
                            {instructorNombreById[tpl.instructor_id] ??
                              "Sin instructor"}
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-zinc-200">
                            {tpl.horario}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                              onClick={() => openEditPlantilla(tpl)}
                              aria-label={`Editar ${tpl.nombre}`}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-[#e41b68]/80 hover:bg-[#e41b68]/10 hover:text-[#e41b68]"
                              onClick={() => void removeClaseTemplate(tpl.id)}
                              aria-label={`Eliminar ${tpl.nombre}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={instructorDialogOpen} onOpenChange={setInstructorDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar instructor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-inst-nombre" className={LABEL_TECH}>
                Nombre
              </Label>
              <Input
                id="edit-inst-nombre"
                value={instructorEditNombre}
                onChange={(e) => setInstructorEditNombre(e.target.value)}
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-inst-esp" className={LABEL_TECH}>
                Especialidad
              </Label>
              <Input
                id="edit-inst-esp"
                value={instructorEditEspecialidad}
                onChange={(e) => setInstructorEditEspecialidad(e.target.value)}
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-row justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700"
              onClick={() => setInstructorDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className={BTN_VERDE}
              onClick={() => void saveInstructorEdit()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={plantillaDialogOpen} onOpenChange={setPlantillaDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar plantilla</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-plantilla-nombre" className={LABEL_TECH}>
                Nombre de la clase
              </Label>
              <Input
                id="edit-plantilla-nombre"
                value={plantillaEditNombre}
                onChange={(e) => setPlantillaEditNombre(e.target.value)}
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-plantilla-instructor" className={LABEL_TECH}>
                Instructor
              </Label>
              <Select
                value={plantillaEditInstructorId}
                onValueChange={setPlantillaEditInstructorId}
              >
                <SelectTrigger
                  id="edit-plantilla-instructor"
                  className="border-zinc-800 bg-zinc-900 text-zinc-100"
                >
                  <SelectValue placeholder="Seleccionar instructor" />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                  {instructoresRows.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-plantilla-horario" className={LABEL_TECH}>
                Horario
              </Label>
              <Input
                id="edit-plantilla-horario"
                type="time"
                value={plantillaEditHorario}
                onChange={(e) => setPlantillaEditHorario(e.target.value)}
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
              />
            </div>
            <p className="text-xs text-zinc-500">
              Los cambios impactan en instancias futuras no sobreescritas en Calendario.
            </p>
          </div>
          <DialogFooter className="flex flex-row justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700"
              onClick={() => setPlantillaDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className={BTN_VERDE}
              onClick={() => void savePlantillaEdit()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
