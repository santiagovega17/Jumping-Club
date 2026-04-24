"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Filter, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { SectionHeading } from "@/components/SectionHeading";
import { PremiumDialogTitle, PremiumSheetTitle } from "@/components/PremiumTitle";
import { PAGE_SUBTITLE_CLASS, PAGE_TITLE_CLASS } from "@/lib/headings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { registrarSocioAction } from "@/actions/socios";

type Role = "administracion" | "socio";

type MembresiaEstado =
  | "Al día"
  | "Vencida"
  | "Inactivo"
  | "Dado de baja";

function esMoroso(estado: MembresiaEstado) {
  return estado === "Vencida";
}

type FormaPagoPreferida =
  | "Efectivo"
  | "Transferencia"
  | "Débito Automático"
  | "Tarjeta de Crédito";

type Socio = {
  vendedor: string;
  mesUltimoAumento: string;
  nombre: string;
  dni: string;
  celular: string;
  domicilio: string;
  provincia: string;
  correo: string;
  plan: string;
  precioActual: number;
  historialPrecios: Record<string, number>;
  historialPlanes: Record<string, string>;
  historialMensual: Record<
    string,
    {
      planes: Array<{ nombre: string; monto: number; esAumento?: boolean }>;
    }
  >;
  formaPagoPreferida: FormaPagoPreferida;
  numeroTarjeta: string;
  titular: string;
  estado: MembresiaEstado;
};

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;
const MONTH_FULL_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

const PLAN_VERSION_PRICES = {
  "Plan Full": 28000,
  "Plan Full (A2)": 32000,
  "Plan Full (A3)": 35000,
  "Plan 2x Semana": 23000,
  "Plan 2x Semana (A2)": 26000,
  "Plan 2x Semana (A3)": 28500,
  "Plan 3x Semana": 24000,
  "Plan 3x Semana (A2)": 27000,
  "Mensual Premium": 30000,
  "Mensual Premium (A2)": 33500,
  "Pase Libre Diario": 18000,
} as const;

type PlanVersion = keyof typeof PLAN_VERSION_PRICES;

const PLAN_OPTIONS = Object.keys(PLAN_VERSION_PRICES) as PlanVersion[];
const PLAN_FILTROS = ["Todos", ...PLAN_OPTIONS] as const;
const INSTRUCTOR_OPTIONS = ["Juan Pérez", "Mariana Gómez", "Sin asignar"] as const;

function yyyymm(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthDiff(fromYYYYMM: string, to: Date) {
  const [y, m] = fromYYYYMM.split("-").map(Number);
  if (!y || !m) return 0;
  return (to.getFullYear() - y) * 12 + (to.getMonth() + 1 - m);
}

function formatMesAnio(mesYYYYMM: string) {
  const [y, m] = mesYYYYMM.split("-").map(Number);
  if (!y || !m) return "—";
  const d = new Date(y, m - 1, 1);
  const text = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(d);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatPesos(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function createHistorialAnual(precio: number, year: number) {
  const out: Record<string, number> = {};
  const now = new Date();
  const maxMonth = year < now.getFullYear() ? 12 : now.getMonth() + 1;
  for (let m = 1; m <= maxMonth; m++) {
    out[`${year}-${String(m).padStart(2, "0")}`] = precio;
  }
  return out;
}

function createHistorialPlanes(plan: string, year: number) {
  const out: Record<string, string> = {};
  const now = new Date();
  const maxMonth = year < now.getFullYear() ? 12 : now.getMonth() + 1;
  for (let m = 1; m <= maxMonth; m++) {
    out[`${year}-${String(m).padStart(2, "0")}`] = plan;
  }
  return out;
}

function createHistorialMensual(plan: string, precio: number, year: number) {
  const out: Record<
    string,
    {
      planes: Array<{ nombre: string; monto: number; esAumento?: boolean }>;
    }
  > = {};
  const now = new Date();
  const maxMonth = year < now.getFullYear() ? 12 : now.getMonth() + 1;
  for (let m = 1; m <= maxMonth; m++) {
    out[`${year}-${String(m).padStart(2, "0")}`] = {
      planes: [{ nombre: plan, monto: precio }],
    };
  }
  return out;
}

function priceForPlan(plan: string) {
  return PLAN_VERSION_PRICES[plan as PlanVersion] ?? 0;
}

const sociosIniciales: Socio[] = [
  {
    vendedor: "María Fernández",
    mesUltimoAumento: "2026-03",
    nombre: "Vega, Santiago",
    dni: "38.521.447",
    celular: "+54 9 11 5555-1201",
    domicilio: "Av. Corrientes 1842, Piso 3 B",
    provincia: "Ciudad Autónoma de Buenos Aires",
    correo: "santiago.vega@email.com",
    plan: "Plan Full (A2)",
    precioActual: priceForPlan("Plan Full (A2)"),
    historialPrecios: {
      ...createHistorialAnual(28000, 2026),
      "2026-03": 32000,
      "2026-04": 32000,
      "2026-05": 32000,
      "2026-06": 32000,
      "2026-07": 32000,
      "2026-08": 32000,
      "2026-09": 32000,
      "2026-10": 32000,
      "2026-11": 32000,
      "2026-12": 32000,
    },
    historialPlanes: createHistorialPlanes("Plan Full (A2)", 2026),
    historialMensual: {
      ...createHistorialMensual("Plan Full (A2)", priceForPlan("Plan Full (A2)"), 2026),
      "2026-03": {
        planes: [
          { nombre: "Plan Full", monto: 20000 },
          { nombre: "Plan Full (A2)", monto: 28000, esAumento: true },
        ],
      },
    },
    formaPagoPreferida: "Tarjeta de Crédito",
    numeroTarjeta: "**** 1234",
    titular: "Santiago Vega",
    estado: "Al día",
  },
  {
    vendedor: "Carlos Díaz",
    mesUltimoAumento: "2026-01",
    nombre: "Guzman, Luis",
    dni: "32.104.882",
    celular: "+54 9 11 5555-2208",
    domicilio: "Calle San Martín 450",
    provincia: "Buenos Aires",
    correo: "luis.guzman@email.com",
    plan: "Plan 2x Semana (A2)",
    precioActual: priceForPlan("Plan 2x Semana (A2)"),
    historialPrecios: createHistorialAnual(priceForPlan("Plan 2x Semana (A2)"), 2026),
    historialPlanes: createHistorialPlanes("Plan 2x Semana (A2)", 2026),
    historialMensual: createHistorialMensual(
      "Plan 2x Semana (A2)",
      priceForPlan("Plan 2x Semana (A2)"),
      2026,
    ),
    formaPagoPreferida: "Tarjeta de Crédito",
    numeroTarjeta: "**** 8891",
    titular: "Luis Guzman",
    estado: "Al día",
  },
  {
    vendedor: "María Fernández",
    mesUltimoAumento: "2026-04",
    nombre: "Gómez, Laura",
    dni: "41.203.991",
    celular: "+54 9 15 4444-9910",
    domicilio: "Rivadavia 2100",
    provincia: "Buenos Aires",
    correo: "laura.gomez@email.com",
    plan: "Plan Full (A3)",
    precioActual: priceForPlan("Plan Full (A3)"),
    historialPrecios: {
      ...createHistorialAnual(29000, 2026),
      "2026-04": 33000,
      "2026-05": 33000,
      "2026-06": 33000,
      "2026-07": 33000,
      "2026-08": 33000,
      "2026-09": 33000,
      "2026-10": 33000,
      "2026-11": 33000,
      "2026-12": 33000,
    },
    historialPlanes: createHistorialPlanes("Plan Full (A3)", 2026),
    historialMensual: createHistorialMensual(
      "Plan Full (A3)",
      priceForPlan("Plan Full (A3)"),
      2026,
    ),
    formaPagoPreferida: "Débito Automático",
    numeroTarjeta: "**** 4420",
    titular: "Laura Gómez",
    estado: "Vencida",
  },
  {
    vendedor: "Ana Ruiz",
    mesUltimoAumento: "2026-02",
    nombre: "López, Nancy",
    dni: "29.887.110",
    celular: "+54 9 11 5555-7733",
    domicilio: "Av. Santa Fe 3201",
    provincia: "Ciudad Autónoma de Buenos Aires",
    correo: "nancy.lopez@email.com",
    plan: "Plan 3x Semana (A2)",
    precioActual: priceForPlan("Plan 3x Semana (A2)"),
    historialPrecios: {
      ...createHistorialAnual(24000, 2026),
      "2026-02": 27000,
      "2026-03": 27000,
      "2026-04": 27000,
      "2026-05": 27000,
      "2026-06": 27000,
      "2026-07": 27000,
      "2026-08": 27000,
      "2026-09": 27000,
      "2026-10": 27000,
      "2026-11": 27000,
      "2026-12": 27000,
    },
    historialPlanes: createHistorialPlanes("Plan 3x Semana (A2)", 2026),
    historialMensual: createHistorialMensual(
      "Plan 3x Semana (A2)",
      priceForPlan("Plan 3x Semana (A2)"),
      2026,
    ),
    formaPagoPreferida: "Transferencia",
    numeroTarjeta: "",
    titular: "Nancy López",
    estado: "Al día",
  },
  {
    vendedor: "Carlos Díaz",
    mesUltimoAumento: "2026-03",
    nombre: "Pérez, Adrián",
    dni: "35.662.004",
    celular: "+54 9 11 5555-0044",
    domicilio: "Córdoba 980",
    provincia: "Ciudad Autónoma de Buenos Aires",
    correo: "adrian.perez@email.com",
    plan: "Plan Full (A2)",
    precioActual: priceForPlan("Plan Full (A2)"),
    historialPrecios: {
      ...createHistorialAnual(27500, 2026),
      "2026-03": 31000,
      "2026-04": 31000,
      "2026-05": 31000,
      "2026-06": 31000,
      "2026-07": 31000,
      "2026-08": 31000,
      "2026-09": 31000,
      "2026-10": 31000,
      "2026-11": 31000,
      "2026-12": 31000,
    },
    historialPlanes: createHistorialPlanes("Plan Full (A2)", 2026),
    historialMensual: createHistorialMensual(
      "Plan Full (A2)",
      priceForPlan("Plan Full (A2)"),
      2026,
    ),
    formaPagoPreferida: "Tarjeta de Crédito",
    numeroTarjeta: "**** 1001",
    titular: "Adrián Pérez",
    estado: "Vencida",
  },
  {
    vendedor: "Ana Ruiz",
    mesUltimoAumento: "2026-05",
    nombre: "Torres, Marisol",
    dni: "40.119.556",
    celular: "+54 9 11 5555-5566",
    domicilio: "Güemes 145",
    provincia: "Buenos Aires",
    correo: "marisol.torres@email.com",
    plan: "Plan 2x Semana (A2)",
    precioActual: priceForPlan("Plan 2x Semana (A2)"),
    historialPrecios: {
      ...createHistorialAnual(23000, 2026),
      "2026-05": 26000,
      "2026-06": 26000,
      "2026-07": 26000,
      "2026-08": 26000,
      "2026-09": 26000,
      "2026-10": 26000,
      "2026-11": 26000,
      "2026-12": 26000,
    },
    historialPlanes: createHistorialPlanes("Plan 2x Semana (A2)", 2026),
    historialMensual: createHistorialMensual(
      "Plan 2x Semana (A2)",
      priceForPlan("Plan 2x Semana (A2)"),
      2026,
    ),
    formaPagoPreferida: "Efectivo",
    numeroTarjeta: "",
    titular: "Marisol Torres",
    estado: "Al día",
  },
];


const SHEET_PANEL_CLASS =
  "flex h-full w-full flex-col border-l border-border bg-card text-card-foreground sm:max-w-md";

const inputPanelClass =
  "border-zinc-800 bg-zinc-950 text-foreground placeholder:text-muted-foreground";

const sectionBoxClass =
  "rounded-lg border border-zinc-800/50 bg-zinc-950/50 px-3 py-2";

const LABEL_TECH =
  "text-sm font-semibold text-zinc-400 uppercase tracking-wider";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatIsoToDisplay(iso: string) {
  if (!iso) return formatHoy();
  const parts = iso.split("-");
  if (parts.length !== 3) return formatHoy();
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function formatHoy() {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function parseDisplayToIso(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function EstadoBadge({ estado }: { estado: MembresiaEstado }) {
  if (estado === "Inactivo" || estado === "Dado de baja") {
    return (
      <span className="inline-flex rounded-full border border-zinc-600 bg-zinc-800/80 px-2.5 py-0.5 text-xs font-semibold text-zinc-300">
        {estado}
      </span>
    );
  }
  if (estado === "Vencida") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border-2 border-[#e41b68] bg-[#e41b68]/15 px-2.5 py-0.5 text-xs font-bold text-[#e41b68]",
        )}
      >
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
        VENCIDA
      </span>
    );
  }
  const isOk = estado === "Al día";
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        isOk
          ? "border-secondary/40 bg-[#5ab253]/20 text-[#5ab253]"
          : "border-zinc-600 bg-zinc-800/80 text-zinc-300"
      )}
    >
      {estado}
    </span>
  );
}

type FiltroEstado = {
  alDia: boolean;
  vencida: boolean;
  inactivo: boolean;
  dadoDeBaja: boolean;
};

const filtroEstadoVacio: FiltroEstado = {
  alDia: false,
  vencida: false,
  inactivo: false,
  dadoDeBaja: false,
};

type NuevoSocioForm = {
  vendedor: string;
  mesUltimoAumento: string;
  nombre: string;
  dni: string;
  celular: string;
  domicilio: string;
  provincia: string;
  correo: string;
  plan: string;
  planId: string;
  precioActual: string;
  formaPagoPreferida: FormaPagoPreferida;
  numeroTarjeta: string;
  titular: string;
};

function formularioNuevoVacio(): NuevoSocioForm {
  const defaultPlan: PlanVersion = "Mensual Premium";
  return {
    vendedor: "Sin asignar",
    mesUltimoAumento: yyyymm(new Date()),
    nombre: "",
    dni: "",
    celular: "",
    domicilio: "",
    provincia: "",
    correo: "",
    plan: defaultPlan,
    planId: "",
    precioActual: String(priceForPlan(defaultPlan)),
    formaPagoPreferida: "Efectivo",
    numeroTarjeta: "",
    titular: "",
  };
}

type PlanOption = {
  id: string;
  nombre: string;
  version: string | null;
  precio: number;
  franquicia_id: string | null;
  estado: string | null;
};

export default function SociosPage() {
  const [role] = useState<Role>(() => {
    if (typeof window === "undefined") return "administracion";
    const stored = window.localStorage.getItem("jumpingClubRole");
    return stored === "socio" ? "socio" : "administracion";
  });

  const [socios, setSocios] = useState<Socio[]>(() => [...sociosIniciales]);
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nuevoSheetOpen, setNuevoSheetOpen] = useState(false);
  const [selectedDni, setSelectedDni] = useState<string | null>(null);
  const [draft, setDraft] = useState<Socio | null>(null);

  const [nuevoForm, setNuevoForm] = useState<NuevoSocioForm>(formularioNuevoVacio);

  const [bajaOpen, setBajaOpen] = useState(false);
  const [motivoBaja, setMotivoBaja] = useState("");
  const [isPending, startTransition] = useTransition();
  const [planesActivos, setPlanesActivos] = useState<PlanOption[]>([]);
  const [adminFranquiciaId, setAdminFranquiciaId] = useState<string | null>(null);

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>({ ...filtroEstadoVacio });
  const [filtroPlan, setFiltroPlan] = useState<(typeof PLAN_FILTROS)[number]>("Todos");
  const [filtroConDeuda, setFiltroConDeuda] = useState(false);
  const [filtroARevisar, setFiltroARevisar] = useState(false);
  const [isEditingSocio, setIsEditingSocio] = useState(false);
  const [viewModeSocio, setViewModeSocio] = useState<"detalle" | "historial">("detalle");

  const socioDetail = useMemo(
    () => socios.find((s) => s.dni === selectedDni) ?? null,
    [socios, selectedDni]
  );

  const hayFiltroEstadoActivo = useMemo(
    () => Object.values(filtroEstado).some(Boolean),
    [filtroEstado]
  );

  const sociosConDeudaCount = useMemo(
    () => socios.filter((s) => esMoroso(s.estado)).length,
    [socios],
  );

  const socioRequiereRevision = (socio: Socio) =>
    monthDiff(socio.mesUltimoAumento, new Date()) >= 3;

  useEffect(() => {
    const loadAdminContextAndPlanes = async () => {
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
          .select("id,nombre,version,precio,franquicia_id,estado")
          .eq("franquicia_id", perfil.franquicia_id)
          .eq("estado", "activo")
          .order("nombre", { ascending: true });

        if (!planesError && planes) {
          setPlanesActivos(planes as PlanOption[]);
          setNuevoForm((f) => {
            if (f.planId || planes.length === 0) return f;
            const defaultPlan = planes[0] as PlanOption;
            const planLabel = defaultPlan.version
              ? `${defaultPlan.nombre} (${defaultPlan.version})`
              : defaultPlan.nombre;
            return {
              ...f,
              planId: defaultPlan.id,
              plan: planLabel,
              precioActual: String(defaultPlan.precio),
            };
          });
        }
      } catch {
        // noop: UI can still work with local fallback.
      }
    };

    loadAdminContextAndPlanes();
  }, []);

  const filtrados = useMemo(() => {
    let list = socios;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const blob = [
          s.nombre,
          s.dni,
          s.correo,
          s.celular,
          s.domicilio,
          s.provincia,
          s.vendedor,
          s.plan,
          formatMesAnio(s.mesUltimoAumento),
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }

    if (filtroConDeuda) {
      list = list.filter((s) => esMoroso(s.estado));
    } else if (filtroARevisar) {
      list = list.filter((s) => socioRequiereRevision(s));
    } else if (hayFiltroEstadoActivo) {
      list = list.filter((s) => {
        if (filtroEstado.alDia && s.estado === "Al día") return true;
        if (filtroEstado.vencida && s.estado === "Vencida") return true;
        if (filtroEstado.inactivo && s.estado === "Inactivo") return true;
        if (filtroEstado.dadoDeBaja && s.estado === "Dado de baja") return true;
        return false;
      });
    }

    if (filtroPlan !== "Todos") {
      list = list.filter((s) => s.plan === filtroPlan);
    }

    return list;
  }, [
    socios,
    query,
    filtroConDeuda,
    filtroARevisar,
    filtroEstado,
    filtroPlan,
    hayFiltroEstadoActivo,
  ]);

  const abrirDetalle = (socio: Socio) => {
    setNuevoSheetOpen(false);
    setSelectedDni(socio.dni);
    setDraft({ ...socio });
    setIsEditingSocio(false);
    setViewModeSocio("detalle");
    setSheetOpen(true);
  };

  const cerrarSheet = () => {
    setSheetOpen(false);
    setSelectedDni(null);
    setDraft(null);
    setIsEditingSocio(false);
    setViewModeSocio("detalle");
  };

  const abrirNuevoSocio = () => {
    cerrarSheet();
    setNuevoForm(formularioNuevoVacio());
    setNuevoSheetOpen(true);
  };

  const cerrarNuevoSheet = () => {
    setNuevoSheetOpen(false);
    setNuevoForm(formularioNuevoVacio());
  };

  const guardarEdicion = () => {
    if (!draft || !selectedDni) return;
    const hoyMes = yyyymm(new Date());
    setSocios((prev) =>
      prev.map((s) => {
        if (s.dni !== selectedDni) return s;
        const planActualizado = draft.plan;
        const precioDelPlan = priceForPlan(planActualizado);
        const changedPlan = s.plan !== planActualizado;
        const next = {
          ...draft,
          precioActual: precioDelPlan,
          historialPrecios: { ...s.historialPrecios },
          historialPlanes: { ...s.historialPlanes },
          historialMensual: { ...s.historialMensual },
        };
        next.historialPrecios[hoyMes] = precioDelPlan;
        next.historialPlanes[hoyMes] = planActualizado;
        next.historialMensual[hoyMes] = {
          planes: [
            {
              nombre: planActualizado,
              monto: precioDelPlan,
              esAumento: changedPlan,
            },
          ],
        };
        if (changedPlan) {
          next.mesUltimoAumento = hoyMes;
        }
        return next;
      })
    );
    const changedPlan = socioDetail ? socioDetail.plan !== draft.plan : false;
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            precioActual: priceForPlan(prev.plan),
            mesUltimoAumento: changedPlan ? hoyMes : prev.mesUltimoAumento,
          }
        : prev
    );
    toast.success(
      changedPlan
        ? "Plan actualizado y aumento registrado"
        : "Información guardada correctamente"
    );
    setIsEditingSocio(false);
  };

  const guardarNuevoSocio = () => {
    if (
      !nuevoForm.nombre.trim() ||
      !nuevoForm.dni.trim() ||
      !nuevoForm.correo.trim() ||
      !nuevoForm.planId ||
      !adminFranquiciaId
    ) {
      toast.error("Completá nombre, email, DNI y plan para registrar el socio");
      return;
    }

    startTransition(async () => {
      const result = await registrarSocioAction({
        nombre: nuevoForm.nombre.trim(),
        email: nuevoForm.correo.trim(),
        telefono: nuevoForm.celular.trim() || null,
        dni: nuevoForm.dni.trim(),
        planId: nuevoForm.planId,
        franquiciaId: adminFranquiciaId,
      });

      if (!result.ok) {
        toast.error(result.error ?? "No se pudo registrar el socio");
        return;
      }

      const selectedPlan = planesActivos.find((p) => p.id === nuevoForm.planId);
      const planLabel = selectedPlan
        ? selectedPlan.version
          ? `${selectedPlan.nombre} (${selectedPlan.version})`
          : selectedPlan.nombre
        : nuevoForm.plan;
      const precioActual =
        selectedPlan?.precio ?? (Number(nuevoForm.precioActual) || 0);
      const [year] = nuevoForm.mesUltimoAumento.split("-").map(Number);

      const nuevo: Socio = {
        vendedor: nuevoForm.vendedor.trim() || "Sin asignar",
        mesUltimoAumento: nuevoForm.mesUltimoAumento || yyyymm(new Date()),
        nombre: nuevoForm.nombre.trim(),
        dni: nuevoForm.dni.trim(),
        celular: nuevoForm.celular.trim() || "—",
        domicilio: nuevoForm.domicilio.trim() || "—",
        provincia: nuevoForm.provincia.trim() || "—",
        correo: nuevoForm.correo.trim() || "—",
        plan: planLabel,
        precioActual,
        historialPrecios: createHistorialAnual(
          precioActual,
          year || new Date().getFullYear(),
        ),
        historialPlanes: createHistorialPlanes(
          planLabel,
          year || new Date().getFullYear(),
        ),
        historialMensual: createHistorialMensual(
          planLabel,
          precioActual,
          year || new Date().getFullYear(),
        ),
        formaPagoPreferida: nuevoForm.formaPagoPreferida,
        numeroTarjeta: nuevoForm.numeroTarjeta.trim(),
        titular: nuevoForm.titular.trim() || nuevoForm.nombre.trim(),
        estado: "Al día",
      };

      setSocios((prev) => [...prev, nuevo]);
      cerrarNuevoSheet();
      toast.success("Socio registrado correctamente");
    });
  };

  const confirmarBaja = () => {
    if (!selectedDni || !motivoBaja.trim()) return;
    setSocios((prev) =>
      prev.map((s) =>
        s.dni === selectedDni ? { ...s, estado: "Dado de baja" as MembresiaEstado } : s
      )
    );
    setBajaOpen(false);
    setMotivoBaja("");
    cerrarSheet();
    toast.success("Socio dado de baja correctamente");
  };

  const reactivarSocio = () => {
    if (!selectedDni) return;
    setSocios((prev) =>
      prev.map((s) =>
        s.dni === selectedDni ? { ...s, estado: "Al día" as MembresiaEstado } : s
      )
    );
    setDraft((prev) =>
      prev ? { ...prev, estado: "Al día" as MembresiaEstado } : prev
    );
    toast.success("Socio reactivado correctamente");
  };

  const limpiarFiltros = () => {
    setFiltroEstado({ ...filtroEstadoVacio });
    setFiltroPlan("Todos");
    setFiltroConDeuda(false);
    setFiltroARevisar(false);
  };

  const toggleFiltroConDeuda = () => {
    setFiltroConDeuda((prev) => {
      const next = !prev;
      if (next) {
        setFiltroEstado({ ...filtroEstadoVacio });
        setFiltroARevisar(false);
      }
      return next;
    });
  };

  const toggleFiltroARevisar = () => {
    setFiltroARevisar((prev) => {
      const next = !prev;
      if (next) {
        setFiltroEstado({ ...filtroEstadoVacio });
        setFiltroConDeuda(false);
      }
      return next;
    });
  };

  const vista = draft ?? socioDetail;

  const socioInactivo =
    vista?.estado === "Inactivo" || vista?.estado === "Dado de baja";
  const consolidadoYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth() + 1;
  const consolidadoMeses = MONTH_LABELS.map(
    (_, i) => `${consolidadoYear}-${String(i + 1).padStart(2, "0")}`,
  );
  const mesesSinAumento = vista ? Math.max(0, monthDiff(vista.mesUltimoAumento, new Date())) : 0;
  const bloqueoAumento = mesesSinAumento < 3;
  const socioFieldsDisabled = !isEditingSocio;

  if (role !== "administracion") {
    return (
      <div>
        <div className="mb-8">
          <h1 className={PAGE_TITLE_CLASS}>Socios</h1>
          <p className={PAGE_SUBTITLE_CLASS}>
            La gestión de socios está disponible solo para administración.
          </p>
        </div>
        <div className="mt-8 rounded-2xl border border-zinc-800/50 bg-card p-6 md:p-8">
          <p className="text-sm text-zinc-500">
            Cambiá al rol Administración en el panel lateral para ver el listado completo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="mb-8">
          <h1 className={PAGE_TITLE_CLASS}>Gestión de Socios</h1>
          <p className={PAGE_SUBTITLE_CLASS}>
            Listado de alumnos con plan y estado de membresía.
          </p>
        </div>
        <Button
          type="button"
          onClick={abrirNuevoSocio}
          className="h-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:self-start"
        >
          <Plus className="size-4" aria-hidden />
          Nuevo Socio
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        <div className="rounded-2xl border border-zinc-800/50 bg-card p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="search"
              placeholder="Buscar por nombre, DNI, correo..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 flex-1 border-white/15 bg-black/20"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 border-white/15 bg-black/10 text-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                >
                  <Filter className="size-4" aria-hidden />
                  Filtros
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-4">
              <div>
                <p className={`mb-2 ${LABEL_TECH}`}>Estado</p>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      ["alDia", "Al día"],
                      ["vencida", "Vencida"],
                      ["inactivo", "Inactivo"],
                      ["dadoDeBaja", "Dado de baja"],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200"
                    >
                      <input
                        type="checkbox"
                        checked={filtroEstado[key]}
                        onChange={(e) => {
                          setFiltroConDeuda(false);
                          setFiltroEstado((prev) => ({
                            ...prev,
                            [key]: e.target.checked,
                          }));
                        }}
                        className="size-4 rounded border-zinc-600 bg-zinc-900 accent-primary"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="filtro-plan" className={LABEL_TECH}>
                  Plan
                </Label>
                <select
                  id="filtro-plan"
                  value={filtroPlan}
                  onChange={(e) => {
                    setFiltroConDeuda(false);
                    setFiltroPlan(
                      e.target.value as (typeof PLAN_FILTROS)[number],
                    );
                  }}
                  className={cn(
                    "mt-2 h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    inputPanelClass
                  )}
                >
                  {PLAN_FILTROS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                onClick={limpiarFiltros}
              >
                Limpiar filtros
              </Button>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="outline"
              aria-pressed={filtroConDeuda}
              onClick={toggleFiltroConDeuda}
              className={cn(
                "h-10 shrink-0 border-[#e41b68]/55 bg-zinc-900 text-[#e41b68] hover:bg-[#e41b68]/10 hover:text-[#e41b68]",
                filtroConDeuda &&
                  "border-[#e41b68] bg-[#e41b68]/15 text-[#ff8fb8] ring-2 ring-[#e41b68]/40",
              )}
            >
              Filtrar deudores
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-pressed={filtroARevisar}
              onClick={toggleFiltroARevisar}
              className={cn(
                "h-10 shrink-0 border-fuchsia-500/55 bg-zinc-900 text-fuchsia-300 hover:bg-fuchsia-500/10 hover:text-fuchsia-200",
                filtroARevisar &&
                  "border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-200 ring-2 ring-fuchsia-500/40",
              )}
            >
              A revisar
            </Button>
          </div>
        </div>

        {sociosConDeudaCount > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <Alert
              variant="default"
              className={cn(
                "flex-1 rounded-xl border border-[#e41b68]/45 bg-zinc-900 px-4 py-3 shadow-none sm:min-h-[2.75rem]",
              )}
            >
              <AlertTriangle
                className="size-4 shrink-0 text-[#e41b68]"
                aria-hidden
              />
              <AlertTitle className="text-sm font-bold uppercase tracking-normal text-zinc-100">
                Atención: hay {sociosConDeudaCount} socios con cuota vencida
              </AlertTitle>
            </Alert>
          </div>
        ) : null}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800/50 bg-card p-2 md:p-4">
        <div className="overflow-x-auto w-full pb-2">
          <div className="min-w-[700px]">
            <Table>
          <TableHeader>
            <TableRow className="border-zinc-800/50 hover:bg-transparent">
              <TableHead className={LABEL_TECH}>Nombre</TableHead>
              <TableHead className={LABEL_TECH}>DNI</TableHead>
              <TableHead className={LABEL_TECH}>Plan</TableHead>
              <TableHead className={LABEL_TECH}>Precio</TableHead>
              <TableHead className={LABEL_TECH}>Último aumento</TableHead>
              <TableHead className={LABEL_TECH}>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((socio) => (
              <TableRow
                key={socio.dni}
                onClick={() => abrirDetalle(socio)}
                className="cursor-pointer border-zinc-800/50 hover:bg-zinc-900/40"
              >
                <TableCell className="font-medium">{socio.nombre}</TableCell>
                <TableCell className="text-foreground/85">{socio.dni}</TableCell>
                <TableCell className="text-foreground/85">{socio.plan}</TableCell>
                <TableCell className="font-semibold text-zinc-100">
                  {formatPesos(socio.precioActual)}
                </TableCell>
                <TableCell className="text-foreground/85">
                  <div className="inline-flex items-center gap-2">
                    <span
                      className={cn(
                        socioRequiereRevision(socio)
                          ? "text-zinc-100"
                          : "text-zinc-400",
                      )}
                    >
                      {formatMesAnio(socio.mesUltimoAumento)}
                    </span>
                    {socioRequiereRevision(socio) ? (
                      <span className="inline-flex rounded-full border border-fuchsia-500/50 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300">
                        Revisar
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <EstadoBadge estado={socio.estado} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
            </Table>
          </div>
        </div>
        {filtrados.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-zinc-500">
            No hay resultados para tu búsqueda o filtros.
          </p>
        ) : null}
      </div>

      <Sheet open={nuevoSheetOpen} onOpenChange={(o) => !o && cerrarNuevoSheet()}>
        <SheetContent side="right" className={SHEET_PANEL_CLASS}>
          <SheetHeader className="border-b border-zinc-800 pb-4 text-left">
            <PremiumSheetTitle>Agregar Nuevo Socio</PremiumSheetTitle>
            <SheetDescription className="text-sm text-zinc-500">
              Completá todos los datos del socio. Los campos con * son mínimos para guardar.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nf-vendedor" className={LABEL_TECH}>
                  Instructor
                </Label>
                <Select
                  value={nuevoForm.vendedor}
                  onValueChange={(value) =>
                    setNuevoForm((f) => ({ ...f, vendedor: value }))
                  }
                >
                  <SelectTrigger id="nf-vendedor" className={inputPanelClass}>
                    <SelectValue placeholder="Seleccionar instructor" />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTRUCTOR_OPTIONS.map((instructor) => (
                      <SelectItem key={instructor} value={instructor}>
                        {instructor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nf-alta" className={LABEL_TECH}>
                  Último aumento (mes)
                </Label>
                <Input
                  id="nf-alta"
                  type="month"
                  value={nuevoForm.mesUltimoAumento}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, mesUltimoAumento: e.target.value }))
                  }
                  className={inputPanelClass}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nf-nombre" className={LABEL_TECH}>
                  Apellido y Nombre *
                </Label>
                <Input
                  id="nf-nombre"
                  value={nuevoForm.nombre}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                  className={inputPanelClass}
                  placeholder="Ej. Pérez, Juan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nf-dni" className={LABEL_TECH}>
                  DNI *
                </Label>
                <Input
                  id="nf-dni"
                  value={nuevoForm.dni}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, dni: e.target.value }))
                  }
                  className={inputPanelClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nf-celular" className={LABEL_TECH}>
                  Celular
                </Label>
                <Input
                  id="nf-celular"
                  value={nuevoForm.celular}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, celular: e.target.value }))
                  }
                  className={inputPanelClass}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nf-domicilio" className={LABEL_TECH}>
                  Domicilio
                </Label>
                <Input
                  id="nf-domicilio"
                  value={nuevoForm.domicilio}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, domicilio: e.target.value }))
                  }
                  className={inputPanelClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nf-provincia" className={LABEL_TECH}>
                  Provincia
                </Label>
                <Input
                  id="nf-provincia"
                  value={nuevoForm.provincia}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, provincia: e.target.value }))
                  }
                  className={inputPanelClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nf-correo" className={LABEL_TECH}>
                  Correo
                </Label>
                <Input
                  id="nf-correo"
                  type="email"
                  value={nuevoForm.correo}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, correo: e.target.value }))
                  }
                  className={inputPanelClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nf-plan" className={LABEL_TECH}>
                  Plan
                </Label>
                <Select
                  value={nuevoForm.planId}
                  onValueChange={(value) => {
                    const selected = planesActivos.find((p) => p.id === value);
                    const planLabel = selected
                      ? selected.version
                        ? `${selected.nombre} (${selected.version})`
                        : selected.nombre
                      : "";
                    setNuevoForm((f) => ({
                      ...f,
                      planId: value,
                      plan: planLabel,
                      precioActual: String(selected?.precio ?? 0),
                    }));
                  }}
                >
                  <SelectTrigger id="nf-plan" className={inputPanelClass}>
                    <SelectValue placeholder="Seleccionar plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {planesActivos.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.version ? `${plan.nombre} (${plan.version})` : plan.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nf-precio" className={LABEL_TECH}>
                  Precio actual
                </Label>
                <Input
                  id="nf-precio"
                  type="text"
                  value={formatPesos(Number(nuevoForm.precioActual) || 0)}
                  disabled
                  className={cn(
                    inputPanelClass,
                    "font-semibold text-zinc-100 opacity-100 disabled:cursor-not-allowed disabled:opacity-100",
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label className={LABEL_TECH}>Forma de pago</Label>
                <Select
                  value={nuevoForm.formaPagoPreferida}
                  onValueChange={(v: FormaPagoPreferida) =>
                    setNuevoForm((f) => ({
                      ...f,
                      formaPagoPreferida: v,
                      numeroTarjeta:
                        v === "Débito Automático" || v === "Tarjeta de Crédito"
                          ? f.numeroTarjeta
                          : "",
                    }))
                  }
                >
                  <SelectTrigger className={inputPanelClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                    <SelectItem value="Débito Automático">Débito Automático</SelectItem>
                    <SelectItem value="Tarjeta de Crédito">Tarjeta de Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {nuevoForm.formaPagoPreferida === "Débito Automático" ||
              nuevoForm.formaPagoPreferida === "Tarjeta de Crédito" ? (
                <div className="space-y-2">
                  <Label htmlFor="nf-numero-tarjeta" className={LABEL_TECH}>
                    Número de tarjeta
                  </Label>
                  <Input
                    id="nf-numero-tarjeta"
                    value={nuevoForm.numeroTarjeta}
                    onChange={(e) =>
                      setNuevoForm((f) => ({ ...f, numeroTarjeta: e.target.value }))
                    }
                    className={inputPanelClass}
                    placeholder="Ej. 4500 1234 5678 0000"
                  />
                </div>
              ) : null}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nf-titular" className={LABEL_TECH}>
                  Titular
                </Label>
                <Input
                  id="nf-titular"
                  value={nuevoForm.titular}
                  onChange={(e) =>
                    setNuevoForm((f) => ({ ...f, titular: e.target.value }))
                  }
                  className={inputPanelClass}
                />
              </div>
            </div>
          </div>
          <SheetFooter className="border-t border-zinc-800">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                onClick={cerrarNuevoSheet}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={guardarNuevoSocio}
                disabled={isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isPending ? "Guardando..." : "Guardar Socio"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={bajaOpen} onOpenChange={setBajaOpen}>
        <DialogContent className="border-zinc-800/50 bg-card text-card-foreground sm:max-w-md">
          <DialogHeader>
            <PremiumDialogTitle>
              ¿Seguro que deseas dar de baja a este socio?
            </PremiumDialogTitle>
            <DialogDescription className="text-sm text-zinc-500">
              Escribí el motivo de la baja. Esta acción es simulada para la presentación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-baja" className={LABEL_TECH}>
              Motivo
            </Label>
            <textarea
              id="motivo-baja"
              rows={4}
              value={motivoBaja}
              onChange={(e) => setMotivoBaja(e.target.value)}
              placeholder="Ej. Falta de pago"
              className={cn(
                "min-h-[100px] w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                inputPanelClass
              )}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              onClick={() => {
                setBajaOpen(false);
                setMotivoBaja("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!motivoBaja.trim()}
              onClick={confirmarBaja}
              className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Confirmar Baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) cerrarSheet();
          else setSheetOpen(true);
        }}
      >
        <SheetContent side="right" className={SHEET_PANEL_CLASS}>
          {vista ? (
            <>
              <SheetHeader className="border-b border-zinc-800 pb-4 text-left">
                <PremiumSheetTitle>Información de socio</PremiumSheetTitle>
                <SheetDescription className="text-sm text-zinc-500">
                  {vista.nombre}
                </SheetDescription>
              </SheetHeader>

              {socioInactivo ? (
                <div className="border-b border-zinc-800 px-4 py-3">
                  <Button
                    type="button"
                    className="h-10 w-full bg-secondary text-sm font-semibold text-secondary-foreground hover:bg-secondary/90"
                    onClick={reactivarSocio}
                  >
                    Dar de alta nuevamente
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
                <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-4">
                  {viewModeSocio === "detalle" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                      onClick={() => setViewModeSocio("historial")}
                    >
                      Ver historial de pagos
                    </Button>
                  ) : null}
                  {socioRequiereRevision(vista) ? (
                    <span className="inline-flex rounded-full border border-fuchsia-500/50 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300">
                      Revisar
                    </span>
                  ) : null}
                </div>

                {viewModeSocio === "historial" ? (
                  <section className="flex flex-1 flex-col">
                    <h3 className="mb-4 uppercase text-sm font-semibold tracking-wider text-zinc-400">
                      Historial de pagos y planes por mes
                    </h3>
                    <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                      {consolidadoMeses.map((monthKey, index) => {
                        const planesMes =
                          index + 1 > currentMonthIndex
                            ? []
                            : (vista.historialMensual[monthKey]?.planes ?? [
                                {
                                  nombre: vista.historialPlanes[monthKey] ?? vista.plan,
                                  monto: vista.historialPrecios[monthKey] ?? vista.precioActual,
                                },
                              ]);
                        const value =
                          planesMes.length > 0 ? planesMes[planesMes.length - 1]!.monto : null;
                        const prevMonthPlans =
                          index === 0
                            ? []
                            : (vista.historialMensual[consolidadoMeses[index - 1]!]?.planes ?? []);
                        const prevValue =
                          index === 0
                            ? value
                            : prevMonthPlans.length > 0
                              ? prevMonthPlans[prevMonthPlans.length - 1]!.monto
                              : (vista.historialPrecios[consolidadoMeses[index - 1]!] ?? null);
                        const cambioPrecio =
                          value != null &&
                          prevValue != null &&
                          (value !== prevValue || planesMes.some((p) => p.esAumento));
                        return (
                          <div
                            key={`sheet-hist-row-${vista.dni}-${monthKey}`}
                            className={cn(
                              "rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2",
                              cambioPrecio && "border-fuchsia-500/45",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs uppercase text-zinc-400">
                                {MONTH_FULL_LABELS[index]}
                              </p>
                              {cambioPrecio ? (
                                <TrendingUp className="size-3 text-fuchsia-400" aria-hidden />
                              ) : null}
                            </div>
                            <div className="flex w-full flex-row gap-4 mt-2 divide-x divide-zinc-800">
                              {(planesMes.length > 0
                                ? planesMes
                                : [{ nombre: "—", monto: 0 }]).map((planMes, planIdx) => (
                                <div
                                  key={`${monthKey}-${planMes.nombre}-${planIdx}`}
                                  className={cn("flex-1", planIdx > 0 && "pl-4")}
                                >
                                  <p className="text-sm font-medium text-zinc-100">
                                    {planMes.nombre}
                                  </p>
                                  <p className="text-lg font-bold text-zinc-50">
                                    {planesMes.length === 0 ? "—" : formatPesos(planMes.monto)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : (
                  <>

                <section className="border-b border-zinc-800 pb-6">
                  <SectionHeading as="h3">Perfil</SectionHeading>
                  <div className="mt-3 grid gap-3">
                    <div className="space-y-1.5">
                      <Label className={LABEL_TECH}>Nombre</Label>
                      {draft ? (
                        <Input
                          value={draft.nombre}
                          onChange={(e) =>
                            setDraft((d) => (d ? { ...d, nombre: e.target.value } : d))
                          }
                          disabled={socioFieldsDisabled}
                          className={inputPanelClass}
                        />
                      ) : (
                        <p className={cn("text-sm text-zinc-100", sectionBoxClass)}>
                          {vista.nombre}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className={LABEL_TECH}>Último aumento</Label>
                      <p className={cn("text-sm text-zinc-200", sectionBoxClass)}>
                        {formatMesAnio(vista.mesUltimoAumento)}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={LABEL_TECH}>Instructor</Label>
                      {draft ? (
                        <Select
                          value={draft.vendedor}
                          onValueChange={(value) =>
                            setDraft((d) => (d ? { ...d, vendedor: value } : d))
                          }
                          disabled={socioFieldsDisabled}
                        >
                          <SelectTrigger className={inputPanelClass}>
                            <SelectValue placeholder="Seleccionar instructor" />
                          </SelectTrigger>
                          <SelectContent>
                            {INSTRUCTOR_OPTIONS.map((instructor) => (
                              <SelectItem key={instructor} value={instructor}>
                                {instructor}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className={cn("text-sm text-zinc-100", sectionBoxClass)}>
                          {vista.vendedor}
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="border-b border-zinc-800 pb-6">
                  <SectionHeading as="h3">Contacto</SectionHeading>
                  <div className="mt-3 grid gap-3">
                    {(
                      [
                        ["Celular", "celular"],
                        ["Correo", "correo"],
                        ["Domicilio", "domicilio"],
                        ["Provincia", "provincia"],
                      ] as const
                    ).map(([label, key]) => (
                      <div key={key} className="space-y-1.5">
                        <Label className={LABEL_TECH}>{label}</Label>
                        {draft ? (
                          <Input
                            value={draft[key]}
                            onChange={(e) =>
                              setDraft((d) =>
                                d ? { ...d, [key]: e.target.value } : d
                              )
                            }
                            disabled={socioFieldsDisabled}
                            className={inputPanelClass}
                          />
                        ) : (
                          <p className={cn("text-sm text-zinc-100", sectionBoxClass)}>
                            {vista[key]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionHeading as="h3">Plan y pago</SectionHeading>
                  <div className="mt-3 grid gap-3">
                    <div className="space-y-1.5">
                      <Label className={LABEL_TECH}>Meses sin aumento</Label>
                      <div className={cn(sectionBoxClass, "text-sm font-semibold text-zinc-100")}>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                            mesesSinAumento < 3
                              ? "border-amber-400/50 bg-amber-500/10 text-amber-300"
                              : "border-zinc-600 bg-zinc-800/80 text-zinc-200",
                          )}
                        >
                          {mesesSinAumento} meses
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={LABEL_TECH}>Plan</Label>
                      {draft ? (
                        <Select
                          value={draft.plan}
                          onValueChange={(value) =>
                            setDraft((d) =>
                              d
                                ? {
                                    ...d,
                                    plan: value,
                                    precioActual: priceForPlan(value),
                                  }
                                : d
                            )
                          }
                          disabled={socioFieldsDisabled}
                        >
                          <SelectTrigger className={inputPanelClass}>
                            <SelectValue placeholder="Seleccionar plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLAN_OPTIONS.map((plan) => (
                              <SelectItem key={plan} value={plan}>
                                {plan}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className={cn("text-sm text-zinc-100", sectionBoxClass)}>
                          {vista.plan}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className={LABEL_TECH}>Precio</Label>
                      {draft ? (
                        <Input
                          type="text"
                          value={formatPesos(draft.precioActual)}
                          disabled
                          className={cn(
                            inputPanelClass,
                            "font-semibold text-zinc-100 opacity-100 disabled:cursor-not-allowed disabled:opacity-100",
                            bloqueoAumento && "border-amber-400/50 bg-amber-500/10 text-amber-100",
                          )}
                        />
                      ) : (
                        <p className={cn("text-sm font-semibold text-zinc-100", sectionBoxClass)}>
                          {formatPesos(vista.precioActual)}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className={LABEL_TECH}>Estado</Label>
                      <div className={cn(sectionBoxClass)}>
                        <EstadoBadge estado={vista.estado} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={LABEL_TECH}>Forma de pago</Label>
                      {draft ? (
                        <Select
                          value={draft.formaPagoPreferida}
                          onValueChange={(v: FormaPagoPreferida) =>
                            setDraft((d) =>
                              d
                                ? {
                                    ...d,
                                    formaPagoPreferida: v,
                                    numeroTarjeta:
                                      v === "Débito Automático" || v === "Tarjeta de Crédito"
                                        ? d.numeroTarjeta
                                        : "",
                                  }
                                : d
                            )
                          }
                          disabled={socioFieldsDisabled}
                        >
                          <SelectTrigger className={inputPanelClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Efectivo">Efectivo</SelectItem>
                            <SelectItem value="Transferencia">Transferencia</SelectItem>
                            <SelectItem value="Débito Automático">Débito Automático</SelectItem>
                            <SelectItem value="Tarjeta de Crédito">Tarjeta de Crédito</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className={cn("text-sm text-zinc-100", sectionBoxClass)}>
                          {vista.formaPagoPreferida}
                        </p>
                      )}
                    </div>
                    {(vista.formaPagoPreferida === "Débito Automático" ||
                      vista.formaPagoPreferida === "Tarjeta de Crédito" ||
                      (draft &&
                        (draft.formaPagoPreferida === "Débito Automático" ||
                          draft.formaPagoPreferida === "Tarjeta de Crédito"))) && (
                      <div className="space-y-1.5">
                        <Label className={LABEL_TECH}>Número de tarjeta</Label>
                        {draft ? (
                          <Input
                            value={draft.numeroTarjeta}
                            onChange={(e) =>
                              setDraft((d) =>
                                d ? { ...d, numeroTarjeta: e.target.value } : d
                              )
                            }
                            disabled={socioFieldsDisabled}
                            className={inputPanelClass}
                          />
                        ) : (
                          <p className={cn("text-sm text-zinc-100", sectionBoxClass)}>
                            {vista.numeroTarjeta || "—"}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className={LABEL_TECH}>Titular</Label>
                      {draft ? (
                        <Input
                          value={draft.titular}
                          onChange={(e) =>
                            setDraft((d) => (d ? { ...d, titular: e.target.value } : d))
                          }
                          disabled={socioFieldsDisabled}
                          className={inputPanelClass}
                        />
                      ) : (
                        <p className={cn("text-sm text-zinc-100", sectionBoxClass)}>
                          {vista.titular}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
                  </>
                )}
              </div>

              <SheetFooter className="border-t border-zinc-800">
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                  {viewModeSocio === "historial" ? (
                    <Button
                      type="button"
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:ml-auto sm:w-auto"
                      onClick={() => setViewModeSocio("detalle")}
                    >
                      Volver al detalle
                    </Button>
                  ) : isEditingSocio ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="order-2 border-zinc-700 text-zinc-200 hover:bg-zinc-800 sm:order-1"
                        onClick={() => {
                          if (socioDetail) setDraft({ ...socioDetail });
                          setIsEditingSocio(false);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        className="order-1 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:order-2 sm:ml-auto sm:w-auto"
                        onClick={guardarEdicion}
                      >
                        Guardar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="order-2 border-primary/60 text-primary hover:bg-primary/10 hover:text-primary sm:order-1"
                        onClick={() => setBajaOpen(true)}
                      >
                        Dar de baja
                      </Button>
                      <Button
                        type="button"
                        className="order-1 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:order-2 sm:ml-auto sm:w-auto"
                        onClick={() => setIsEditingSocio(true)}
                      >
                        Editar
                      </Button>
                    </>
                  )}
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
