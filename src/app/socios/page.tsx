"use client";

import { type FormEvent, type MouseEvent, useEffect, useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { usePathname } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_TITLE_CLASS } from "@/lib/headings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  registrarSocioAction,
  toggleEstadoSocioAction,
  updateSocioAction,
} from "@/actions/socios";
import { crearMovimientoCajaAction } from "@/actions/caja";
import { getSpectatorFranquiciaId } from "@/lib/spectator-mode";
import { formatPlanLabel } from "@/lib/plan-label";

type Role = "administracion" | "socio";

type MembresiaEstado =
  | "Activo"
  | "Vencido"
  | "Inactivo";

function esMoroso(estado: MembresiaEstado) {
  return estado === "Vencido";
}

function toTitleCase(str: string) {
  return str
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

type Socio = {
  socioId: string;
  perfilId: string;
  planId: string;
  instructorId: string;
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
  formaPagoPreferida: string;
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

function estadoVisualSocio(estadoDb: string | null | undefined): MembresiaEstado {
  const normalized = (estadoDb ?? "").trim().toLowerCase();
  if (normalized === "activo") return "Activo";
  if (normalized === "vencido") return "Vencido";
  return "Inactivo";
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

function EstadoBadge({ estado }: { estado: MembresiaEstado }) {
  if (estado === "Inactivo") {
    return (
      <span className="inline-flex rounded-full border border-zinc-600 bg-zinc-800/80 px-2.5 py-0.5 text-xs font-semibold text-zinc-300">
        {estado}
      </span>
    );
  }
  if (estado === "Vencido") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border-2 border-[#e41b68] bg-[#e41b68]/15 px-2.5 py-0.5 text-xs font-bold text-[#e41b68]",
        )}
      >
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
        VENCIDO
      </span>
    );
  }
  const isOk = estado === "Activo";
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
  activo: boolean;
  vencida: boolean;
  inactivo: boolean;
};

const filtroEstadoVacio: FiltroEstado = {
  activo: false,
  vencida: false,
  inactivo: false,
};

const filtroEstadoDefault: FiltroEstado = {
  activo: true,
  vencida: true,
  inactivo: false,
};

type NuevoSocioForm = {
  instructorId: string;
  nombre: string;
  dni: string;
  celular: string;
  domicilio: string;
  provincia: string;
  correo: string;
  plan: string;
  planId: string;
  precioActual: string;
  formaPagoId: string;
  numeroTarjeta: string;
  titular: string;
};

function formularioNuevoVacio(): NuevoSocioForm {
  return {
    instructorId: "",
    nombre: "",
    dni: "",
    celular: "",
    domicilio: "",
    provincia: "",
    correo: "",
    plan: "",
    planId: "",
    precioActual: "0",
    formaPagoId: "",
    numeroTarjeta: "",
    titular: "",
  };
}

type PlanOption = {
  id: string;
  nombre: string;
  precio: number;
  franquicia_id: string | null;
  estado: string | null;
};

type InstructorOption = { id: string; nombre: string };
type FormaPagoOption = { id: string; nombre: string };
type ConceptoIngresoOption = { id: string; concepto: string; descripcion: string };
type CobroForm = {
  conceptoId: string;
  formaPagoId: string;
  monto: string;
  fecha: string;
  observaciones: string;
};

export default function SociosPage() {
  const pathname = usePathname();
  const spectatorFranquiciaId = getSpectatorFranquiciaId(pathname);
  const isReadOnly = Boolean(spectatorFranquiciaId);
  const [role] = useState<Role>(() => {
    if (typeof window === "undefined") return "administracion";
    const stored = window.localStorage.getItem("jumpingClubRole");
    return stored === "socio" ? "socio" : "administracion";
  });

  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nuevoSheetOpen, setNuevoSheetOpen] = useState(false);
  const [selectedSocioId, setSelectedSocioId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Socio | null>(null);

  const [nuevoForm, setNuevoForm] = useState<NuevoSocioForm>(formularioNuevoVacio);

  const [bajaOpen, setBajaOpen] = useState(false);
  const [motivoBaja, setMotivoBaja] = useState("");
  const [isPending, startTransition] = useTransition();
  const [planesActivos, setPlanesActivos] = useState<PlanOption[]>([]);
  const [instructoresActivos, setInstructoresActivos] = useState<InstructorOption[]>([]);
  const [formasPagoActivas, setFormasPagoActivas] = useState<FormaPagoOption[]>([]);
  const [conceptosIngreso, setConceptosIngreso] = useState<ConceptoIngresoOption[]>([]);
  const [adminFranquiciaId, setAdminFranquiciaId] = useState<string | null>(null);
  const [isSavingCobro, setIsSavingCobro] = useState(false);
  const [cobroForm, setCobroForm] = useState<CobroForm>({
    conceptoId: "",
    formaPagoId: "",
    monto: "0",
    fecha: todayIso(),
    observaciones: "",
  });

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>({ ...filtroEstadoDefault });
  const [filtroPlan, setFiltroPlan] = useState<string>("Todos");
  const [filtroConDeuda, setFiltroConDeuda] = useState(false);
  const [filtroARevisar, setFiltroARevisar] = useState(false);
  const [isEditingSocio, setIsEditingSocio] = useState(false);
  const [viewModeSocio, setViewModeSocio] = useState<"detalle" | "historial">("detalle");

  const { data: adminCatalogData, error: catalogError, mutate: mutateCatalogos } = useSWR(
    "socios-catalogos",
    async () => {
      const supabase = createSupabaseClient();
      let scopeFranquiciaId = spectatorFranquiciaId;
      if (!scopeFranquiciaId) {
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
        scopeFranquiciaId = perfil.franquicia_id;
      }

      const [{ data: planes }, { data: instructores }, { data: formas }, { data: conceptos }] =
        await Promise.all([
          supabase
            .from("planes")
            .select("id,nombre,precio,franquicia_id,estado")
            .eq("franquicia_id", scopeFranquiciaId)
            .eq("estado", "activo")
            .order("nombre", { ascending: true }),
          supabase
            .from("instructores")
            .select("id,nombre")
            .eq("franquicia_id", scopeFranquiciaId)
            .eq("estado", "activo")
            .order("nombre", { ascending: true }),
          supabase
            .from("formas_pago")
            .select("id,nombre")
            .eq("franquicia_id", scopeFranquiciaId)
            .eq("activo", true)
            .order("nombre", { ascending: true }),
          supabase
            .from("conceptos_caja")
            .select("id,concepto,descripcion")
            .eq("franquicia_id", scopeFranquiciaId)
            .eq("tipo", "ingreso")
            .order("concepto", { ascending: true }),
        ]);

      return {
        franquiciaId: scopeFranquiciaId,
        planes: (planes ?? []) as PlanOption[],
        instructores: (instructores ?? []) as InstructorOption[],
        formas: (formas ?? []) as FormaPagoOption[],
        conceptos: (conceptos ?? []) as ConceptoIngresoOption[],
      };
    },
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const { data: sociosData, isLoading: isLoadingSocios, error: sociosError, mutate: mutateSocios } = useSWR(
    adminCatalogData?.franquiciaId
      ? [
          "socios-lista-v2-order-by-perfiles-nombre",
          adminCatalogData.franquiciaId,
          filtroEstado.activo,
          filtroEstado.vencida,
          filtroEstado.inactivo,
        ]
      : null,
    async () => {
      const supabase = createSupabaseClient();
      const franquiciaId = adminCatalogData!.franquiciaId;
      const estadosSeleccionados: string[] = [];
      if (filtroEstado.activo) estadosSeleccionados.push("activo");
      if (filtroEstado.vencida) estadosSeleccionados.push("vencido");
      if (filtroEstado.inactivo) estadosSeleccionados.push("inactivo");
      let query = supabase
        .from("socios")
        .select(
          "id,perfil_id,plan_id,instructor_id,dni,domicilio,provincia,telefono,mes_ultimo_aumento,estado,perfil:perfiles(nombre,email),plan:planes(nombre,precio),instructor:instructores(nombre)",
        )
        .eq("franquicia_id", franquiciaId);
      if (estadosSeleccionados.length > 0) {
        query = query.in("estado", estadosSeleccionados);
      }
      const { data: rows } = await query.order("nombre", {
        ascending: true,
        foreignTable: "perfiles",
      });

      type SocioRow = {
        id: string;
        perfil_id: string | null;
        plan_id: string | null;
        instructor_id: string | null;
        dni: string | null;
        domicilio: string | null;
        provincia: string | null;
        telefono: string | null;
        mes_ultimo_aumento: string | null;
        estado: string | null;
        perfil?: { nombre?: string | null; email?: string | null } | null;
        plan?: { nombre?: string | null; precio?: number | null } | null;
        instructor?: { nombre?: string | null } | null;
      };

      return ((rows ?? []) as SocioRow[])
        .map((row) => {
        const planLabel = formatPlanLabel(row.plan?.nombre);
        const precio = Number(row.plan?.precio ?? 0);
        return {
          socioId: row.id,
          perfilId: row.perfil_id ?? "",
          planId: row.plan_id ?? "",
          instructorId: row.instructor_id ?? "",
          vendedor: row.instructor?.nombre ?? "Sin asignar",
          mesUltimoAumento: row.mes_ultimo_aumento ?? yyyymm(new Date()),
          nombre: row.perfil?.nombre ?? "Sin nombre",
          dni: row.dni ?? row.id,
          celular: row.telefono ?? "—",
          domicilio: row.domicilio ?? "—",
          provincia: row.provincia ?? "—",
          correo: row.perfil?.email ?? "—",
          plan: planLabel,
          precioActual: precio,
          historialPrecios: createHistorialAnual(precio, new Date().getFullYear()),
          historialPlanes: createHistorialPlanes(planLabel, new Date().getFullYear()),
          historialMensual: createHistorialMensual(planLabel, precio, new Date().getFullYear()),
          formaPagoPreferida: "Efectivo",
          numeroTarjeta: "",
          titular: row.perfil?.nombre ?? "—",
          estado: estadoVisualSocio(row.estado),
        } satisfies Socio;
      })
        .sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es", {
            sensitivity: "base",
            ignorePunctuation: true,
          }),
        );
    },
    { revalidateOnFocus: false, keepPreviousData: true },
  );
  const socios = useMemo(() => sociosData ?? [], [sociosData]);

  const socioDetail = useMemo(
    () => socios.find((s) => s.socioId === selectedSocioId) ?? null,
    [socios, selectedSocioId]
  );

  useEffect(() => {
    if (!socioDetail) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCobroForm((prev) => ({
      ...prev,
      conceptoId: prev.conceptoId || conceptosIngreso[0]?.id || "",
      formaPagoId: prev.formaPagoId || formasPagoActivas[0]?.id || "",
      monto:
        prev.monto !== "0" && prev.monto !== ""
          ? prev.monto
          : String(socioDetail.precioActual || 0),
      fecha: todayIso(),
    }));
  }, [socioDetail, conceptosIngreso, formasPagoActivas]);

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

  const planOptionsFilter = useMemo(
    () => ["Todos", ...new Set(socios.map((s) => s.plan))],
    [socios],
  );

  useEffect(() => {
    if (!adminCatalogData) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdminFranquiciaId(adminCatalogData.franquiciaId);
    setPlanesActivos(adminCatalogData.planes);
    setInstructoresActivos(adminCatalogData.instructores);
    setFormasPagoActivas(adminCatalogData.formas);
    setConceptosIngreso(adminCatalogData.conceptos);
    setNuevoForm((f) => {
      const defaultPlan = adminCatalogData.planes[0];
      const defaultInstructor = adminCatalogData.instructores[0];
      const defaultFormaPago = adminCatalogData.formas[0];
      return {
        ...f,
        planId: f.planId || defaultPlan?.id || "",
        plan: f.plan || formatPlanLabel(defaultPlan?.nombre) || "",
        precioActual:
          f.precioActual !== "0" ? f.precioActual : String(defaultPlan?.precio ?? 0),
        instructorId: f.instructorId || defaultInstructor?.id || "",
        formaPagoId: f.formaPagoId || defaultFormaPago?.id || "",
      };
    });
    setCobroForm((prev) => ({
      ...prev,
      conceptoId: prev.conceptoId || adminCatalogData.conceptos[0]?.id || "",
      formaPagoId: prev.formaPagoId || adminCatalogData.formas[0]?.id || "",
    }));
  }, [adminCatalogData]);

  useEffect(() => {
    if (!adminCatalogData?.franquiciaId) return;
    void mutateSocios();
  }, [adminCatalogData?.franquiciaId, mutateSocios]);

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
        if (filtroEstado.activo && s.estado === "Activo") return true;
        if (filtroEstado.vencida && s.estado === "Vencido") return true;
        if (filtroEstado.inactivo && s.estado === "Inactivo") return true;
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
    setSelectedSocioId(socio.socioId);
    setDraft({ ...socio });
    setIsEditingSocio(false);
    setViewModeSocio("detalle");
    setSheetOpen(true);
  };

  const cerrarSheet = () => {
    setSheetOpen(false);
    setSelectedSocioId(null);
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

  const guardarEdicion = async () => {
    if (isReadOnly) return;
    if (!draft || !selectedSocioId || !adminFranquiciaId) {
      toast.error("No se pudo identificar el socio a editar");
      return;
    }
    const selectedPlan = planesActivos.find(
      (p) => formatPlanLabel(p.nombre) === draft.plan,
    );
    const selectedInstructor = instructoresActivos.find(
      (i) => i.nombre === draft.vendedor,
    );
    if (
      !selectedPlan ||
      !selectedInstructor ||
      !draft.dni.trim() ||
      !draft.nombre.trim() ||
      !draft.correo.trim()
    ) {
      toast.error("Revisa los campos del formulario");
      return;
    }
    const payload = {
      socioId: draft.socioId,
      perfilId: draft.perfilId,
      franquiciaId: adminFranquiciaId,
      planId: selectedPlan.id,
      instructorId: selectedInstructor.id,
      dni: draft.dni.trim(),
      domicilio: toTitleCase(draft.domicilio.trim()),
      provincia: toTitleCase(draft.provincia.trim()),
      telefono: draft.celular.trim() || null,
      nombre: toTitleCase(draft.nombre.trim()),
      email: draft.correo.trim(),
    };
    try {
      const result = await updateSocioAction(payload);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudieron guardar los cambios");
        return;
      }

      toast.success("Datos actualizados correctamente");
      setIsEditingSocio(false);
      await mutateSocios();
    } catch {
      toast.error("No se pudieron guardar los cambios");
    }
  };

  const onSubmitEdicion = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await guardarEdicion();
  };

  const onStartEditing = (e: MouseEvent<HTMLButtonElement>) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsEditingSocio(true);
  };

  const guardarNuevoSocio = () => {
    if (isReadOnly) return;
    if (
      !nuevoForm.nombre.trim() ||
      !nuevoForm.dni.trim() ||
      !nuevoForm.correo.trim() ||
      !nuevoForm.planId ||
      !nuevoForm.instructorId ||
      !nuevoForm.formaPagoId ||
      !adminFranquiciaId
    ) {
      toast.error("Completá nombre, email, DNI, instructor, plan y forma de pago");
      return;
    }

    startTransition(async () => {
      const result = await registrarSocioAction({
        nombre: toTitleCase(nuevoForm.nombre.trim()),
        email: nuevoForm.correo.trim(),
        telefono: nuevoForm.celular.trim() || null,
        dni: nuevoForm.dni.trim(),
        domicilio: toTitleCase(nuevoForm.domicilio.trim()) || "",
        provincia: toTitleCase(nuevoForm.provincia.trim()) || "",
        instructorId: nuevoForm.instructorId,
        planId: nuevoForm.planId,
        franquiciaId: adminFranquiciaId,
      });

      if (!result.ok) {
        toast.error(result.error ?? "No se pudo registrar el socio");
        return;
      }

      cerrarNuevoSheet();
      toast.success("Socio registrado correctamente");
      await mutateSocios();
      await mutateCatalogos();
    });
  };

  const registrarCobro = async () => {
    if (isReadOnly) return;
    if (!selectedSocioId || !adminFranquiciaId) {
      toast.error("No se pudo identificar el socio");
      return;
    }
    if (!cobroForm.conceptoId || !cobroForm.formaPagoId) {
      toast.error("Seleccioná concepto y forma de pago");
      return;
    }
    const monto = Number(cobroForm.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    setIsSavingCobro(true);
    try {
      const supabase = createSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        toast.error("No se pudo identificar el usuario actual");
        return;
      }
      const result = await crearMovimientoCajaAction({
        userId: user.id,
        tipo: "ingreso",
        monto,
        conceptoId: cobroForm.conceptoId,
        formaPagoId: cobroForm.formaPagoId,
        socioId: selectedSocioId,
        fecha: cobroForm.fecha || todayIso(),
        observaciones: cobroForm.observaciones.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error || "No se pudo registrar el cobro");
        return;
      }
      if (result.warning) {
        toast.error(result.warning);
      }
      setDraft((prev) => (prev ? { ...prev, estado: "Activo" as MembresiaEstado } : prev));
      setCobroForm((prev) => ({
        ...prev,
        monto: String(vista?.precioActual ?? 0),
        fecha: todayIso(),
        observaciones: "",
      }));
      toast.success("Cobro registrado correctamente");
      await mutateSocios();
    } finally {
      setIsSavingCobro(false);
    }
  };

  const confirmarBaja = async () => {
    if (isReadOnly) return;
    if (!selectedSocioId || !motivoBaja.trim()) return;
    const result = await toggleEstadoSocioAction({
      socioId: selectedSocioId,
      nuevoEstado: "inactivo",
    });
    if (!result.ok) {
      toast.error(result.error || "No se pudo dar de baja el socio");
      return;
    }
    await mutateSocios();
    setBajaOpen(false);
    setMotivoBaja("");
    cerrarSheet();
    toast.success("Socio dado de baja correctamente");
  };

  const reactivarSocio = async () => {
    if (isReadOnly) return;
    if (!selectedSocioId) return;
    const result = await toggleEstadoSocioAction({
      socioId: selectedSocioId,
      nuevoEstado: "activo",
    });
    if (!result.ok) {
      toast.error(result.error || "No se pudo reactivar el socio");
      return;
    }
    await mutateSocios();
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

  const socioInactivo = vista?.estado === "Inactivo";
  const consolidadoYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth() + 1;
  const consolidadoMeses = MONTH_LABELS.map(
    (_, i) => `${consolidadoYear}-${String(i + 1).padStart(2, "0")}`,
  );
  const mesesSinAumento = vista ? Math.max(0, monthDiff(vista.mesUltimoAumento, new Date())) : 0;
  const bloqueoAumento = mesesSinAumento < 3;
  const socioFieldsDisabled = isReadOnly || !isEditingSocio;

  if (role !== "administracion") {
    return (
      <div>
        <div className="mb-8">
          <h1 className={PAGE_TITLE_CLASS}>Socios</h1>
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
          {isReadOnly ? (
            <p className="mt-2 text-sm text-zinc-400">Modo espectador: solo lectura.</p>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={abrirNuevoSocio}
          disabled={isReadOnly}
          className="h-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 sm:self-start"
        >
          <Plus className="size-4" aria-hidden />
          Nuevo Socio
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {catalogError || sociosError ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            No se pudieron cargar los datos de socios.
          </div>
        ) : null}
        <div className="rounded-2xl border border-zinc-800/50 bg-card p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="search"
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
                      ["activo", "Activo"],
                      ["vencida", "Vencido"],
                      ["inactivo", "Inactivo"],
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
                    setFiltroPlan(e.target.value);
                  }}
                  className={cn(
                    "mt-2 h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    inputPanelClass
                  )}
                >
                  {planOptionsFilter.map((p) => (
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
            {isLoadingSocios && !sociosData ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={`socios-skeleton-${idx}`} className="border-zinc-800/50">
                  <TableCell><Skeleton className="h-4 w-36 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 bg-zinc-800" /></TableCell>
                </TableRow>
              ))
            ) : filtrados.map((socio) => (
              <TableRow
                key={socio.socioId}
                className="cursor-pointer border-zinc-800/50 hover:bg-zinc-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                onClick={() => abrirDetalle(socio)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    abrirDetalle(socio);
                  }
                }}
                tabIndex={0}
              >
                <TableCell className="font-medium">
                  {socio.nombre}
                </TableCell>
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
        {!isLoadingSocios && filtrados.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-zinc-500">
            No hay registros disponibles. Comienza agregando uno nuevo.
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
                  value={nuevoForm.instructorId}
                  onValueChange={(value) =>
                    setNuevoForm((f) => ({ ...f, instructorId: value }))
                  }
                  disabled={instructoresActivos.length === 0}
                >
                  <SelectTrigger id="nf-vendedor" className={inputPanelClass}>
                    <SelectValue
                      placeholder={
                        instructoresActivos.length === 0
                          ? "Sin instructores (Crea uno en Configuración)"
                          : "Seleccionar instructor"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {instructoresActivos.map((instructor) => (
                      <SelectItem key={instructor.id} value={instructor.id}>
                        {instructor.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    const planLabel = selected ? formatPlanLabel(selected.nombre) : "";
                    setNuevoForm((f) => ({
                      ...f,
                      planId: value,
                      plan: planLabel,
                      precioActual: String(selected?.precio ?? 0),
                    }));
                  }}
                  disabled={planesActivos.length === 0}
                >
                  <SelectTrigger id="nf-plan" className={inputPanelClass}>
                    <SelectValue
                      placeholder={
                        planesActivos.length === 0
                          ? "Sin planes activos (Crea uno en Configuración)"
                          : "Seleccionar plan"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {planesActivos.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {formatPlanLabel(plan.nombre)}
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
                  value={nuevoForm.formaPagoId}
                  onValueChange={(v) =>
                    setNuevoForm((f) => ({
                      ...f,
                      formaPagoId: v,
                      numeroTarjeta:
                        ["Débito Automático", "Tarjeta de Crédito"].includes(
                          formasPagoActivas.find((fp) => fp.id === v)?.nombre ?? "",
                        )
                          ? f.numeroTarjeta
                          : "",
                    }))
                  }
                  disabled={formasPagoActivas.length === 0}
                >
                  <SelectTrigger className={inputPanelClass}>
                    <SelectValue
                      placeholder={
                        formasPagoActivas.length === 0
                          ? "Sin formas de pago (Crea una en Configuración)"
                          : "Seleccionar forma de pago"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {formasPagoActivas.map((fp) => (
                      <SelectItem key={fp.id} value={fp.id}>
                        {fp.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {["Débito Automático", "Tarjeta de Crédito"].includes(
                formasPagoActivas.find((fp) => fp.id === nuevoForm.formaPagoId)?.nombre ?? "",
              ) ? (
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
                disabled={isPending || isReadOnly}
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
              Escribí el motivo de la baja. Esta acción actualiza el estado en la base de datos.
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
              disabled={!motivoBaja.trim() || isReadOnly}
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
                  <form id="socio-edit-form" onSubmit={onSubmitEdicion}>

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
                            {instructoresActivos.map((instructor) => (
                              <SelectItem key={instructor.id} value={instructor.nombre}>
                                {instructor.nombre}
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
                                    precioActual:
                                      planesActivos.find((p) => formatPlanLabel(p.nombre) === value)?.precio ??
                                      d.precioActual,
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
                            {planesActivos.map((plan) => (
                              <SelectItem key={plan.id} value={formatPlanLabel(plan.nombre)}>
                                {formatPlanLabel(plan.nombre)}
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
                          onValueChange={(v) =>
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
                            {formasPagoActivas.map((fp) => (
                              <SelectItem key={fp.id} value={fp.nombre}>
                                {fp.nombre}
                              </SelectItem>
                            ))}
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
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className={LABEL_TECH}>Registrar cobro</Label>
                      <div className={cn("grid gap-3 rounded-lg border border-zinc-800/50 p-3 md:grid-cols-2", sectionBoxClass)}>
                        <div className="space-y-1.5">
                          <Label className={LABEL_TECH}>Concepto (ingreso)</Label>
                          <Select
                            value={cobroForm.conceptoId}
                            onValueChange={(value) =>
                              setCobroForm((prev) => ({ ...prev, conceptoId: value }))
                            }
                            disabled={conceptosIngreso.length === 0}
                          >
                            <SelectTrigger className={inputPanelClass}>
                              <SelectValue
                                placeholder={
                                  conceptosIngreso.length === 0
                                    ? "Sin conceptos de ingreso"
                                    : "Seleccionar concepto"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {conceptosIngreso.map((concepto) => (
                                <SelectItem key={concepto.id} value={concepto.id}>
                                  {concepto.descripcion
                                    ? `${concepto.concepto} - ${concepto.descripcion}`
                                    : concepto.concepto}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className={LABEL_TECH}>Forma de pago</Label>
                          <Select
                            value={cobroForm.formaPagoId}
                            onValueChange={(value) =>
                              setCobroForm((prev) => ({ ...prev, formaPagoId: value }))
                            }
                            disabled={formasPagoActivas.length === 0}
                          >
                            <SelectTrigger className={inputPanelClass}>
                              <SelectValue
                                placeholder={
                                  formasPagoActivas.length === 0
                                    ? "Sin formas de pago"
                                    : "Seleccionar forma de pago"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {formasPagoActivas.map((fp) => (
                                <SelectItem key={fp.id} value={fp.id}>
                                  {fp.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className={LABEL_TECH}>Monto</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={cobroForm.monto}
                            onChange={(e) =>
                              setCobroForm((prev) => ({ ...prev, monto: e.target.value }))
                            }
                            className={inputPanelClass}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className={LABEL_TECH}>Fecha</Label>
                          <Input
                            type="date"
                            value={cobroForm.fecha}
                            onChange={(e) =>
                              setCobroForm((prev) => ({ ...prev, fecha: e.target.value }))
                            }
                            className={inputPanelClass}
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label className={LABEL_TECH}>Observaciones</Label>
                          <Input
                            value={cobroForm.observaciones}
                            onChange={(e) =>
                              setCobroForm((prev) => ({
                                ...prev,
                                observaciones: e.target.value,
                              }))
                            }
                            className={inputPanelClass}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Button
                            type="button"
                            onClick={registrarCobro}
                            disabled={
                              isReadOnly ||
                              isSavingCobro ||
                              conceptosIngreso.length === 0 ||
                              formasPagoActivas.length === 0
                            }
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            {isSavingCobro ? "Registrando..." : "Registrar cobro"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
                  </form>
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
                  ) : (
                    <>
                      {!isEditingSocio ? (
                        socioInactivo ? (
                          <Button
                            type="button"
                            className="order-2 bg-emerald-600 text-white hover:bg-emerald-500 sm:order-1"
                            disabled={isReadOnly}
                            onClick={reactivarSocio}
                          >
                            Dar de alta
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isReadOnly}
                            className="order-2 border-red-500/60 text-red-400 hover:bg-red-500/10 hover:text-red-300 sm:order-1"
                            onClick={() => setBajaOpen(true)}
                          >
                            Dar de Baja
                          </Button>
                        )
                      ) : null}
                      {isEditingSocio ? (
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
                      ) : null}
                      <Button
                        type={isEditingSocio ? "submit" : "button"}
                        form={isEditingSocio ? "socio-edit-form" : undefined}
                        disabled={isReadOnly}
                        className="order-1 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:order-2 sm:ml-auto sm:w-auto"
                        onClick={isEditingSocio ? undefined : onStartEditing}
                      >
                        {isEditingSocio ? "Guardar" : "Editar"}
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
