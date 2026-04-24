"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { PremiumCardTitle } from "@/components/PremiumTitle";
import { SectionHeading } from "@/components/SectionHeading";
import {
  PAGE_SUBTITLE_CLASS,
  PAGE_TITLE_CLASS,
} from "@/lib/headings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

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

type ClaseTemplate = {
  id: string;
  nombre: string;
  instructorId: string;
  horario: string;
};

type ConceptosBranch = Record<string, string[]>;

type ClubConfig = {
  pases: Pase[];
  formasPago: string[];
  conceptosCaja: {
    ingresos: ConceptosBranch;
    egresos: ConceptosBranch;
  };
  instructores: Instructor[];
  clasesTemplate: ClaseTemplate[];
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

const defaultConceptos: ClubConfig["conceptosCaja"] = {
  ingresos: {},
  egresos: {},
};

const defaultConfig: ClubConfig = {
  pases: [],
  formasPago: [],
  conceptosCaja: defaultConceptos,
  instructores: [],
  clasesTemplate: [],
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

function sanitizeConceptBranch(
  raw: unknown,
  fallback: ConceptosBranch,
): ConceptosBranch {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const out: ConceptosBranch = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || !k.trim()) continue;
    if (!Array.isArray(v)) out[k] = [];
    else {
      out[k] = v.filter(
        (x): x is string => typeof x === "string" && Boolean(x.trim()),
      );
    }
  }
  return out;
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

function sanitizeInstructores(raw: unknown): Instructor[] {
  if (!Array.isArray(raw)) return defaultConfig.instructores;
  return raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const nombre = typeof o.nombre === "string" ? o.nombre.trim() : "";
      if (!nombre) return null;
      return {
        id: typeof o.id === "string" ? o.id : newId("inst"),
        nombre,
        especialidad:
          typeof o.especialidad === "string" ? o.especialidad.trim() : "",
      };
    })
    .filter((x): x is Instructor => x != null);
}

function sanitizeClasesTemplate(raw: unknown): ClaseTemplate[] {
  if (!Array.isArray(raw)) return defaultConfig.clasesTemplate;
  return raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const nombre = typeof o.nombre === "string" ? o.nombre.trim() : "";
      const instructorId =
        typeof o.instructorId === "string" ? o.instructorId.trim() : "";
      const horario = typeof o.horario === "string" ? o.horario.trim() : "";
      if (!nombre || !instructorId || !horario) return null;
      return {
        id: typeof o.id === "string" ? o.id : newId("tpl"),
        nombre,
        instructorId,
        horario,
      };
    })
    .filter((x): x is ClaseTemplate => x != null);
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

function parseStored(raw: string | null): ClubConfig | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<ClubConfig>;
    const conceptosCaja =
      p.conceptosCaja == null
        ? defaultConceptos
        : {
            ingresos: sanitizeConceptBranch(
              p.conceptosCaja.ingresos,
              defaultConceptos.ingresos,
            ),
            egresos: sanitizeConceptBranch(
              p.conceptosCaja.egresos,
              defaultConceptos.egresos,
            ),
          };
    return {
      pases: sanitizePases(p.pases),
      instructores: sanitizeInstructores(p.instructores),
      clasesTemplate: sanitizeClasesTemplate(p.clasesTemplate),
      formasPago: Array.isArray(p.formasPago)
        ? p.formasPago.filter((x) => typeof x === "string" && x.trim())
        : defaultConfig.formasPago,
      conceptosCaja,
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

  useEffect(() => {
    const loaded = parseStored(
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null,
    );
    if (loaded) setConfig(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config, hydrated]);

  useEffect(() => {
    const loadPlanesForAdminFranquicia = async () => {
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

        const { data: planes, error: planesError } = await supabase
          .from("planes")
          .select("id,nombre,precio,version")
          .eq("franquicia_id", perfil.franquicia_id)
          .eq("estado", "activo")
          .order("nombre", { ascending: true });

        if (!planesError && planes) {
          setConfig((c) => ({
            ...c,
            pases: planes.map((p) => ({
              id: p.id,
              nombre: p.version ? `${p.nombre} (${p.version})` : p.nombre,
              precio: Math.round(Number(p.precio) || 0),
            })),
          }));
        }

        const { data: instructores, error: instructoresError } = await supabase
          .from("instructores")
          .select("id,nombre,estado")
          .eq("franquicia_id", perfil.franquicia_id);

        if (!instructoresError && instructores) {
          setConfig((c) => ({
            ...c,
            instructores: instructores.map((inst) => ({
              id: inst.id,
              nombre: inst.nombre,
              especialidad: "",
            })),
          }));
        }
      } catch {
        // fallback local-only
      }
    };

    loadPlanesForAdminFranquicia();
  }, []);

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

  const ingresosKeys = useMemo(
    () => Object.keys(config.conceptosCaja.ingresos).sort(),
    [config.conceptosCaja.ingresos],
  );
  const egresosKeys = useMemo(
    () => Object.keys(config.conceptosCaja.egresos).sort(),
    [config.conceptosCaja.egresos],
  );

  const instructorNombreById = useMemo(
    () =>
      Object.fromEntries(config.instructores.map((inst) => [inst.id, inst.nombre])),
    [config.instructores],
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

  const removePase = (id: string) => {
    setConfig((c) => ({ ...c, pases: c.pases.filter((p) => p.id !== id) }));
    toast.success("Pase eliminado correctamente");
  };

  const addForma = () => {
    const t = nuevaForma.trim();
    if (!t || config.formasPago.some((x) => x.toLowerCase() === t.toLowerCase()))
      return;
    setConfig((c) => ({ ...c, formasPago: [...c.formasPago, t] }));
    setNuevaForma("");
    toast.success("Forma de pago agregada correctamente");
  };

  const removeForma = (forma: string) => {
    setConfig((c) => ({
      ...c,
      formasPago: c.formasPago.filter((x) => x !== forma),
    }));
    toast.success("Forma de pago eliminada correctamente");
  };

  const addConcepto = (rama: "ingresos" | "egresos", nombre: string) => {
    const t = nombre.trim();
    if (!t || config.conceptosCaja[rama][t]) return;
    setConfig((c) => ({
      ...c,
      conceptosCaja: {
        ...c.conceptosCaja,
        [rama]: { ...c.conceptosCaja[rama], [t]: [] },
      },
    }));
    if (rama === "ingresos") setNuevoConceptoIng("");
    else setNuevoConceptoEgr("");
    toast.success("Concepto agregado correctamente");
  };

  const removeConcepto = (rama: "ingresos" | "egresos", concepto: string) => {
    setConfig((c) => {
      const next = { ...c.conceptosCaja[rama] };
      delete next[concepto];
      return {
        ...c,
        conceptosCaja: { ...c.conceptosCaja, [rama]: next },
      };
    });
    toast.success("Concepto eliminado correctamente");
  };

  const addDescripcion = (
    rama: "ingresos" | "egresos",
    concepto: string,
    draftKey: string,
  ) => {
    const text = (descDrafts[draftKey] ?? "").trim();
    if (!text) return;
    setConfig((c) => {
      const branch = { ...c.conceptosCaja[rama] };
      const list = [...(branch[concepto] ?? [])];
      if (list.some((x) => x.toLowerCase() === text.toLowerCase())) return c;
      list.push(text);
      branch[concepto] = list;
      return {
        ...c,
        conceptosCaja: { ...c.conceptosCaja, [rama]: branch },
      };
    });
    setDescDrafts((d) => ({ ...d, [draftKey]: "" }));
    toast.success("Descripción agregada correctamente");
  };

  const removeDescripcion = (
    rama: "ingresos" | "egresos",
    concepto: string,
    desc: string,
  ) => {
    setConfig((c) => {
      const branch = { ...c.conceptosCaja[rama] };
      branch[concepto] = (branch[concepto] ?? []).filter((x) => x !== desc);
      return {
        ...c,
        conceptosCaja: { ...c.conceptosCaja, [rama]: branch },
      };
    });
    toast.success("Descripción eliminada correctamente");
  };

  const addInstructor = () => {
    const nombre = nuevoInstructorNombre.trim();
    if (!nombre) return;
    setConfig((c) => ({
      ...c,
      instructores: [
        ...c.instructores,
        {
          id: newId("inst"),
          nombre,
          especialidad: nuevoInstructorEspecialidad.trim(),
        },
      ],
    }));
    setNuevoInstructorNombre("");
    setNuevoInstructorEspecialidad("");
    toast.success("Instructor agregado correctamente");
  };

  const removeInstructor = (id: string) => {
    setConfig((c) => ({
      ...c,
      instructores: c.instructores.filter((inst) => inst.id !== id),
      clasesTemplate: c.clasesTemplate.filter((tpl) => tpl.instructorId !== id),
    }));
    toast.success("Instructor eliminado correctamente");
  };

  const addClaseTemplate = () => {
    const nombre = nuevaClaseNombre.trim();
    if (!nombre || !nuevaClaseInstructorId || !nuevaClaseHorario) return;
    setConfig((c) => ({
      ...c,
      clasesTemplate: [
        ...c.clasesTemplate,
        {
          id: newId("tpl"),
          nombre,
          instructorId: nuevaClaseInstructorId,
          horario: nuevaClaseHorario,
        },
      ],
    }));
    setNuevaClaseNombre("");
    setNuevaClaseInstructorId("");
    setNuevaClaseHorario("09:00");
    toast.success("Clase global guardada correctamente");
  };

  const removeClaseTemplate = (id: string) => {
    setConfig((c) => ({
      ...c,
      clasesTemplate: c.clasesTemplate.filter((tpl) => tpl.id !== id),
    }));
    toast.success("Clase global eliminada correctamente");
  };

  const cardClass =
    "border-zinc-800/50 bg-card shadow-none ring-0 text-zinc-50";

  return (
    <div className="min-w-0 font-sans text-zinc-50">
      <div className="mb-8">
        <h1 className={PAGE_TITLE_CLASS}>Configuración</h1>
        <p className={cn(PAGE_SUBTITLE_CLASS, "max-w-2xl")}>
          Pases, medios de pago, conceptos de caja y horarios del club. Los
          cambios se guardan automáticamente en este navegador.
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
                    onClick={addPase}
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
                              onClick={() => removePase(p.id)}
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
                    onClick={addForma}
                  >
                    <Plus className="size-4" aria-hidden />
                    Agregar método
                  </Button>
                </div>
              </div>

              <div>
                <p className={cn(LABEL_TECH, "mb-3")}>Métodos configurados</p>
                <div className="flex flex-wrap gap-2">
                  {config.formasPago.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No hay métodos. Agregá uno arriba.
                    </p>
                  ) : (
                    config.formasPago.map((forma) => (
                      <span
                        key={forma}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/80 px-3 py-1.5 text-sm text-zinc-200"
                      >
                        {forma}
                        <button
                          type="button"
                          className="rounded p-0.5 text-[#e41b68]/80 transition-colors hover:bg-[#e41b68]/15 hover:text-[#e41b68]"
                          onClick={() => removeForma(forma)}
                          aria-label={`Quitar ${forma}`}
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
                Catálogo de ingresos y egresos por concepto y descripción. Se
                usa como referencia para cargar movimientos.
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
                        addConcepto("ingresos", nuevoConceptoIng)
                      }
                    >
                      <Plus className="size-4" aria-hidden />
                      Nuevo concepto
                    </Button>
                  </div>
                  <Accordion
                    type="multiple"
                    className="rounded-xl border border-zinc-800/50 bg-zinc-950/40 px-2"
                  >
                    {ingresosKeys.map((concepto) => (
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
                              removeConcepto("ingresos", concepto);
                            }}
                            aria-label={`Eliminar concepto ${concepto}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <AccordionContent>
                          <div className="flex flex-wrap gap-2 pb-2">
                            {(config.conceptosCaja.ingresos[concepto] ?? []).map(
                              (d) => (
                                <span
                                  key={d}
                                  className="inline-flex items-center gap-1 rounded-md border border-zinc-800/80 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200"
                                >
                                  {d}
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-zinc-500 hover:text-[#e41b68]"
                                    onClick={() =>
                                      removeDescripcion(
                                        "ingresos",
                                        concepto,
                                        d,
                                      )
                                    }
                                    aria-label={`Quitar ${d}`}
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </span>
                              ),
                            )}
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
                                addDescripcion(
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
                        addConcepto("egresos", nuevoConceptoEgr)
                      }
                    >
                      <Plus className="size-4" aria-hidden />
                      Nuevo concepto
                    </Button>
                  </div>
                  <Accordion
                    type="multiple"
                    className="rounded-xl border border-zinc-800/50 bg-zinc-950/40 px-2"
                  >
                    {egresosKeys.map((concepto) => (
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
                              removeConcepto("egresos", concepto);
                            }}
                            aria-label={`Eliminar concepto ${concepto}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <AccordionContent>
                          <div className="flex flex-wrap gap-2 pb-2">
                            {(config.conceptosCaja.egresos[concepto] ?? []).map(
                              (d) => (
                                <span
                                  key={d}
                                  className="inline-flex items-center gap-1 rounded-md border border-zinc-800/80 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-200"
                                >
                                  {d}
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-zinc-500 hover:text-[#e41b68]"
                                    onClick={() =>
                                      removeDescripcion(
                                        "egresos",
                                        concepto,
                                        d,
                                      )
                                    }
                                    aria-label={`Quitar ${d}`}
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </span>
                              ),
                            )}
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
                                addDescripcion(
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
                    onClick={addInstructor}
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
                      <TableHead className="w-12 text-right">
                        <span className="sr-only">Eliminar</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {config.instructores.length === 0 ? (
                      <TableRow className="border-zinc-800/50">
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-sm text-zinc-500"
                        >
                          No hay registros disponibles. Comienza agregando uno nuevo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      config.instructores.map((inst) => (
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
                              className="text-[#e41b68]/80 hover:bg-[#e41b68]/10 hover:text-[#e41b68]"
                              onClick={() => removeInstructor(inst.id)}
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
                        {config.instructores.map((inst) => (
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
                      onClick={addClaseTemplate}
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
                    {config.clasesTemplate.length === 0 ? (
                      <TableRow className="border-zinc-800/50">
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-sm text-zinc-500"
                        >
                          No hay plantillas cargadas.
                        </TableCell>
                      </TableRow>
                    ) : (
                      config.clasesTemplate.map((tpl) => (
                        <TableRow
                          key={tpl.id}
                          className="border-zinc-800/50 hover:bg-zinc-800/30"
                        >
                          <TableCell className="font-semibold text-zinc-100">
                            {tpl.nombre}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-300">
                            {instructorNombreById[tpl.instructorId] ?? "Sin instructor"}
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
                              onClick={() => removeClaseTemplate(tpl.id)}
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
    </div>
  );
}
