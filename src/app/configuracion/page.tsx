"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  PAGE_SUBTITLE_CLASS,
  PAGE_TITLE_CLASS,
} from "@/lib/headings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { ConceptoCaja, FormaPago, PlantillaClase } from "@/types/database.types";

const LABEL_TECH =
  "text-sm font-medium text-zinc-400 uppercase tracking-wider";

const BTN_FUCSIA =
  "bg-[#e41b68] font-semibold text-white hover:bg-[#e41b68]/90";
const BTN_VERDE =
  "bg-[#5ab253] font-semibold text-white hover:bg-[#5ab253]/90";

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

type Pase = {
  id: string;
  nombre: string;
  precio: number;
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

  const refreshFranquiciaData = useCallback(async (franquiciaId: string) => {
    const supabase = createSupabaseClient();
    const [planesRes, instRes, fpRes, ccRes, plRes] = await Promise.all([
      supabase
        .from("planes")
        .select("id,nombre,precio,version")
        .eq("franquicia_id", franquiciaId)
        .eq("estado", "activo")
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
    ]);

    if (!planesRes.error && planesRes.data) {
      setConfig((c) => ({
        ...c,
        pases: planesRes.data.map((p) => ({
          id: p.id,
          nombre: p.version ? `${p.nombre} (${p.version})` : p.nombre,
          precio: Math.round(Number(p.precio) || 0),
        })),
      }));
    }

    if (!instRes.error && instRes.data) {
      setInstructoresRows(
        instRes.data.map((inst) => ({
          id: inst.id,
          nombre: inst.nombre,
          especialidad: inst.especialidad?.trim() ?? "",
        })),
      );
    } else {
      setInstructoresRows([]);
    }

    if (!fpRes.error && fpRes.data) setFormasPagoRows(fpRes.data);
    else setFormasPagoRows([]);

    if (!ccRes.error && ccRes.data) setConceptosCajaRows(ccRes.data);
    else setConceptosCajaRows([]);

    if (!plRes.error && plRes.data) setPlantillasRows(plRes.data);
    else setPlantillasRows([]);
  }, []);

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
    const load = async () => {
      try {
        const supabase = createSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: perfil, error: perfilError } = await supabase
          .from("perfiles")
          .select("franquicia_id")
          .eq("id", user.id)
          .single();

        if (perfilError || !perfil?.franquicia_id) return;
        setAdminFranquiciaId(perfil.franquicia_id);
        await refreshFranquiciaData(perfil.franquicia_id);
      } catch {
        /* ignore */
      }
    };

    void load();
  }, [refreshFranquiciaData]);

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

  const addPase = async () => {
    const nombre = nuevoPaseNombre.trim();
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
        version: "v1",
        estado: "activo",
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      const { data: planes, error: loadError } = await supabase
        .from("planes")
        .select("id,nombre,precio,version")
        .eq("franquicia_id", adminFranquiciaId)
        .eq("estado", "activo")
        .order("nombre", { ascending: true });

      if (!loadError && planes) {
        setConfig((c) => ({
          ...c,
          pases: planes.map((p) => ({
            id: p.id,
            nombre: p.version ? `${p.nombre} (${p.version})` : p.nombre,
            precio: Math.round(Number(p.precio) || 0),
          })),
        }));
      }
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
      await refreshFranquiciaData(adminFranquiciaId);
      toast.success("Pase eliminado correctamente");
    } catch {
      toast.error("No se pudo eliminar el plan");
    }
  };

  const addForma = async () => {
    const t = nuevaForma.trim();
    if (!t || !adminFranquiciaId) return;
    if (
      formasPagoRows.some((x) => x.nombre.toLowerCase() === t.toLowerCase())
    ) {
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
        toast.error(error.message);
        return;
      }
      setNuevaForma("");
      await refreshFranquiciaData(adminFranquiciaId);
      toast.success("Forma de pago agregada correctamente");
    } catch {
      toast.error("No se pudo agregar la forma de pago");
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
      await refreshFranquiciaData(adminFranquiciaId);
      toast.success("Forma de pago eliminada correctamente");
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const addConcepto = async (rama: "ingresos" | "egresos", nombre: string) => {
    const t = nombre.trim();
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
        descripcion: "General",
        orden: 0,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (rama === "ingresos") setNuevoConceptoIng("");
      else setNuevoConceptoEgr("");
      await refreshFranquiciaData(adminFranquiciaId);
      toast.success("Concepto agregado correctamente");
    } catch {
      toast.error("No se pudo agregar el concepto");
    }
  };

  const removeConcepto = async (
    rama: "ingresos" | "egresos",
    concepto: string,
  ) => {
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
      await refreshFranquiciaData(adminFranquiciaId);
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
    const text = (descDrafts[draftKey] ?? "").trim();
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
      await refreshFranquiciaData(adminFranquiciaId);
      toast.success("Descripción agregada correctamente");
    } catch {
      toast.error("No se pudo agregar la descripción");
    }
  };

  const removeDescripcionRow = async (id: string) => {
    if (!adminFranquiciaId) return;
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from("conceptos_caja")
        .delete()
        .eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await refreshFranquiciaData(adminFranquiciaId);
      toast.success("Descripción eliminada correctamente");
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const addInstructor = async () => {
    const nombre = nuevoInstructorNombre.trim();
    if (!nombre || !adminFranquiciaId) return;
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("instructores").insert({
        franquicia_id: adminFranquiciaId,
        nombre,
        estado: "activo",
        especialidad: nuevoInstructorEspecialidad.trim() || null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setNuevoInstructorNombre("");
      setNuevoInstructorEspecialidad("");
      await refreshFranquiciaData(adminFranquiciaId);
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
      await refreshFranquiciaData(adminFranquiciaId);
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
    const nombre = instructorEditNombre.trim();
    if (!nombre) return;
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from("instructores")
        .update({
          nombre,
          especialidad: instructorEditEspecialidad.trim() || null,
        })
        .eq("id", instructorEditId)
        .eq("franquicia_id", adminFranquiciaId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setInstructorDialogOpen(false);
      setInstructorEditId(null);
      await refreshFranquiciaData(adminFranquiciaId);
      toast.success("Instructor actualizado");
    } catch {
      toast.error("No se pudo guardar");
    }
  };

  const addClaseTemplate = async () => {
    const nombre = nuevaClaseNombre.trim();
    const horarioRaw = nuevaClaseHorario.trim().slice(0, 5);
    if (!nombre || !nuevaClaseInstructorId || !horarioRaw || !adminFranquiciaId)
      return;
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("plantillas_clases").insert({
        franquicia_id: adminFranquiciaId,
        nombre,
        instructor_id: nuevaClaseInstructorId,
        horario: horarioRaw,
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
      await refreshFranquiciaData(adminFranquiciaId);
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
      await refreshFranquiciaData(adminFranquiciaId);
      toast.success("Plantilla eliminada correctamente");
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const cardClass =
    "border-zinc-800/50 bg-card shadow-none ring-0 text-zinc-50";

  return (
    <div className="min-w-0 font-sans text-zinc-50">
      <div className="mb-8">
        <h1 className={PAGE_TITLE_CLASS}>Configuración</h1>
        <p className={cn(PAGE_SUBTITLE_CLASS, "max-w-2xl")}>
          Pases, formas de pago, conceptos de caja, instructores y plantillas se
          guardan en la base por franquicia. Los horarios semanales siguen en
          este navegador.
        </p>
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
                Definí los pases con nombre y precio mensual. Podés agregar o
                quitar filas en cualquier momento.
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
                      placeholder="Ej. Plan Full"
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
                      placeholder="25000"
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
                <p className={cn(LABEL_TECH, "mb-2")}>Pases actuales</p>
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800/50 hover:bg-transparent">
                      <TableHead className={LABEL_TECH}>Nombre</TableHead>
                      <TableHead className={cn("text-right", LABEL_TECH)}>
                        Precio
                      </TableHead>
                      <TableHead className="w-12 text-right">
                        <span className="sr-only">Eliminar</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {config.pases.length === 0 ? (
                      <TableRow className="border-zinc-800/50">
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-sm text-zinc-500"
                        >
                          No hay pases cargados. Agregá el primero arriba.
                        </TableCell>
                      </TableRow>
                    ) : (
                      config.pases.map((p) => (
                        <TableRow
                          key={p.id}
                          className="border-zinc-800/50 hover:bg-zinc-800/30"
                        >
                          <TableCell className="font-medium text-zinc-100">
                            {p.nombre}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-zinc-200">
                            {formatPesos(p.precio)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-[#e41b68]/80 hover:bg-[#e41b68]/10 hover:text-[#e41b68]"
                              onClick={() => void removePase(p.id)}
                              aria-label={`Eliminar ${p.nombre}`}
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

        <TabsContent value="formas" className="mt-0 outline-none">
          <Card className={cardClass}>
            <CardHeader>
              <PremiumCardTitle>Formas de pago</PremiumCardTitle>
              <CardDescription className="text-sm text-zinc-500">
                Métodos aceptados en caja y administración. Agregá o quitá
                etiquetas según tu operación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-4">
                <p className={cn(LABEL_TECH, "mb-3")}>Agregar método</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={nuevaForma}
                    onChange={(e) => setNuevaForma(e.target.value)}
                    placeholder="Ej. QR / Billetera virtual"
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
                    Agregar método
                  </Button>
                </div>
              </div>

              <div>
                <p className={cn(LABEL_TECH, "mb-3")}>Métodos configurados</p>
                <div className="flex flex-wrap gap-2">
                  {formasPagoRows.length === 0 ? (
                    <p className="text-sm text-zinc-500">Sin registros.</p>
                  ) : (
                    formasPagoRows.map((fp) => (
                      <span
                        key={fp.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/80 px-3 py-1.5 text-sm text-zinc-200"
                      >
                        {fp.nombre}
                        <button
                          type="button"
                          className="rounded p-0.5 text-[#e41b68]/80 transition-colors hover:bg-[#e41b68]/15 hover:text-[#e41b68]"
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
                        placeholder="Ej. Bonificaciones"
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
                    <p className="text-sm text-zinc-500">Sin registros.</p>
                  ) : (
                    <Accordion
                      type="multiple"
                      className="rounded-xl border border-zinc-800/50 bg-zinc-950/40 px-2"
                    >
                      {ingresosGrouped.map(([concepto, rows]) => (
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
                                void removeConcepto("ingresos", concepto);
                              }}
                              aria-label={`Eliminar concepto ${concepto}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2 pb-2">
                              {rows.map((row) => (
                                <span
                                  key={row.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-zinc-800/80 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200"
                                >
                                  {row.descripcion}
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-zinc-500 hover:text-[#e41b68]"
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
                            <div className="flex flex-col gap-2 border-t border-zinc-800/50 pt-3 sm:flex-row">
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
                                placeholder="Nueva descripción"
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
                        placeholder="Ej. Marketing"
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
                    <p className="text-sm text-zinc-500">Sin registros.</p>
                  ) : (
                    <Accordion
                      type="multiple"
                      className="rounded-xl border border-zinc-800/50 bg-zinc-950/40 px-2"
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
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2 pb-2">
                              {rows.map((row) => (
                                <span
                                  key={row.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-zinc-800/80 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200"
                                >
                                  {row.descripcion}
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-zinc-500 hover:text-[#e41b68]"
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
                            <div className="flex flex-col gap-2 border-t border-zinc-800/50 pt-3 sm:flex-row">
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
                                placeholder="Nueva descripción"
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
                      placeholder="Ej. Agustina Díaz"
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
                      placeholder="Ej. Yoga"
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
                        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
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
              <PremiumCardTitle>
                Plantillas de clases globales
              </PremiumCardTitle>
              <CardDescription className="text-sm text-zinc-500">
                Definí nombre, instructor y horario fijo para reutilizar en el
                calendario diario.
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
                      placeholder="Ej. Funcional"
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
              </div>

              <div>
                <p className={cn(LABEL_TECH, "mb-2")}>Plantillas cargadas</p>
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800/50 hover:bg-transparent">
                      <TableHead className={LABEL_TECH}>Clase</TableHead>
                      <TableHead className={LABEL_TECH}>Instructor</TableHead>
                      <TableHead className={LABEL_TECH}>Horario</TableHead>
                      <TableHead className="w-12 text-right">
                        <span className="sr-only">Eliminar</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plantillasRows.length === 0 ? (
                      <TableRow className="border-zinc-800/50">
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-sm text-zinc-500"
                        >
                          Sin registros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      plantillasRows.map((tpl) => (
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
          <DialogFooter className="gap-2 sm:gap-0">
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
    </div>
  );
}
