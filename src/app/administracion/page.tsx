"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumCardTitle, PremiumSheetTitle } from "@/components/PremiumTitle";
import { SectionHeading } from "@/components/SectionHeading";
import {
  KPI_TITLE_CLASS,
  PAGE_TITLE_CLASS,
} from "@/lib/headings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  EMPTY_CONCEPTOS,
  type ConceptosFinancieros,
  loadCajaCatalogForFranquicia,
} from "@/lib/franquicia-catalogo";
import {
  deleteMovimientoCajaAction,
  crearMovimientoCajaAction,
  obtenerBalanceCaja,
  obtenerMovimientosRecientes,
  obtenerProximosVencimientos,
} from "@/actions/caja";

const FONT_UI =
  "var(--font-sans), ui-sans-serif, system-ui, sans-serif";

const LABEL_TECH =
  "text-sm font-medium text-zinc-400 uppercase tracking-wider";

type CategoriaMov = "Ingreso" | "Egreso";

type Movimiento = {
  id: string;
  conceptoId: string;
  formaPagoId: string;
  socioId: string;
  fecha: string;
  concepto: string;
  descripcion: string;
  categoria: CategoriaMov;
  monto: number;
  formaPago: string;
  observaciones: string;
  estado: "Pagado" | "Pendiente";
  fechaVencimiento: string;
  socio: string;
};

function branchForCat(
  categoria: CategoriaMov,
  catalog: ConceptosFinancieros,
): Record<string, string[]> {
  return categoria === "Ingreso" ? catalog.INGRESOS : catalog.EGRESOS;
}

function conceptosKeysFrom(
  categoria: CategoriaMov,
  catalog: ConceptosFinancieros,
): string[] {
  return Object.keys(branchForCat(categoria, catalog));
}

function descripcionesForCat(
  categoria: CategoriaMov,
  concepto: string,
  catalog: ConceptosFinancieros,
): string[] {
  const b = branchForCat(categoria, catalog);
  return b[concepto] ?? [];
}

function firstConceptoDescFrom(
  categoria: CategoriaMov,
  catalog: ConceptosFinancieros,
): {
  concepto: string;
  descripcion: string;
} {
  const keys = conceptosKeysFrom(categoria, catalog);
  const concepto = keys[0] ?? "";
  const descList = descripcionesForCat(categoria, concepto, catalog);
  const descripcion = descList[0] ?? "";
  return { concepto, descripcion };
}

function isValidConceptoDescripcionFrom(
  categoria: CategoriaMov,
  concepto: string,
  descripcion: string,
  catalog: ConceptosFinancieros,
) {
  const list = descripcionesForCat(categoria, concepto, catalog);
  return list.includes(descripcion);
}

function isPagoCuota(categoria: CategoriaMov, concepto: string) {
  return categoria === "Ingreso" && /cuota/i.test(concepto);
}

type FormDraft = Omit<Movimiento, "id"> & { id?: string };

type ConceptoCajaOption = {
  id: string;
  tipo: "ingreso" | "egreso";
  concepto: string;
  descripcion: string;
};

type FormaPagoOption = {
  id: string;
  nombre: string;
};

type SocioOption = {
  id: string;
  nombre: string;
};

type CajaDataCache = {
  balance: {
    ingresos: number;
    egresos: number;
    saldo: number;
    pendientes: number;
  };
  movimientos: Movimiento[];
  proximos: Movimiento[];
};

function isDescripcionVacia(descripcion: string | null | undefined) {
  return !descripcion || descripcion.trim().length === 0;
}

function shouldAutoSelectDetalle(
  conceptoPrincipal: string,
  detalles: ConceptoCajaOption[],
) {
  const principal = (conceptoPrincipal ?? "").trim().toLowerCase();
  if (principal === "pago de cuota") return detalles.length > 0;
  return detalles.length === 1;
}

function signedAmount(m: Movimiento) {
  return m.categoria === "Ingreso" ? m.monto : -m.monto;
}

function formatPesos(value: number) {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

function isoToDisplay(iso: string) {
  if (!iso || iso.length < 10) return "—";
  const [y, mo, d] = iso.split("-");
  return `${d}/${mo}/${y}`;
}

function emptyDraftFrom(
  catalog: ConceptosFinancieros,
  formasPago: string[],
): FormDraft {
  const { concepto, descripcion } = firstConceptoDescFrom("Ingreso", catalog);
  return {
    conceptoId: "",
    formaPagoId: "",
    socioId: "",
    fecha: new Date().toISOString().slice(0, 10),
    concepto,
    descripcion,
    categoria: "Ingreso",
    monto: 0,
    formaPago: formasPago[0] ?? "",
    observaciones: "",
    estado: "Pagado",
    fechaVencimiento: "",
    socio: "",
  };
}

function movimientoToDraft(m: Movimiento): FormDraft {
  const { id, ...rest } = m;
  void id;
  return rest;
}

const PIE_PALETTE = ["#e41b68", "#b81858", "#ff6ba8", "#c084fc", "#38bdf8"];

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function periodoLabelFromRange(startDate: string, endDate: string) {
  const format = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(`${iso}T00:00:00`));
  return `${format(startDate)} - ${format(endDate)}`;
}

function isVenceEn7Dias(isoDate: string) {
  if (!isoDate) return false;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${isoDate}T00:00:00`);
  const diffDays = Math.ceil((target.getTime() - start.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays <= 7;
}

function isPendienteVencido(row: Movimiento) {
  if (row.estado !== "Pendiente" || !row.fechaVencimiento) return false;
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const due = new Date(`${row.fechaVencimiento}T00:00:00`);
  return due < current;
}

export default function AdministracionPage() {
  const [cachedCajaData] = useState<CajaDataCache | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("admin-caja-cache-v1");
      if (!raw) return null;
      return JSON.parse(raw) as CajaDataCache;
    } catch {
      return null;
    }
  });
  const defaultRange = getCurrentMonthRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [filtroProximosVencimientos, setFiltroProximosVencimientos] = useState(false);
  const [sociosOptions, setSociosOptions] = useState<SocioOption[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [conceptosCatalog, setConceptosCatalog] =
    useState<ConceptosFinancieros>(EMPTY_CONCEPTOS);
  const [formasPagoList, setFormasPagoList] = useState<string[]>([]);
  const [conceptosOptions, setConceptosOptions] = useState<ConceptoCajaOption[]>([]);
  const [formasPagoOptions, setFormasPagoOptions] = useState<FormaPagoOption[]>([]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"edit" | "new">("edit");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [conceptoComboboxOpen, setConceptoComboboxOpen] = useState(false);
  const [detalleComboboxOpen, setDetalleComboboxOpen] = useState(false);
  const [draft, setDraft] = useState<FormDraft>(() =>
    emptyDraftFrom(EMPTY_CONCEPTOS, []),
  );
  const [socioComboboxOpen, setSocioComboboxOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Movimiento | null>(null);
  const [hasTriedSubmitMovimiento, setHasTriedSubmitMovimiento] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [consolidadoOpen, setConsolidadoOpen] = useState(false);
  const [expConsIng, setExpConsIng] = useState<Record<string, boolean>>({});
  const [expConsEgr, setExpConsEgr] = useState<Record<string, boolean>>({});

  const chartReady = true;

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        const { data: perfilAdmin } = await supabase
          .from("perfiles")
          .select("franquicia_id")
          .eq("id", user.id)
          .single();
        if (!perfilAdmin?.franquicia_id) return;

        const { conceptos, formasPago } = await loadCajaCatalogForFranquicia(
          supabase,
          perfilAdmin.franquicia_id,
        );
        setConceptosCatalog(conceptos);
        setFormasPagoList(formasPago);

        const [{ data: conceptosRows }, { data: formasRows }, { data: sociosRows }] =
          await Promise.all([
            supabase
              .from("conceptos_caja")
              .select("id,tipo,concepto,descripcion")
              .eq("franquicia_id", perfilAdmin.franquicia_id)
              .order("concepto", { ascending: true })
              .order("descripcion", { ascending: true }),
            supabase
              .from("formas_pago")
              .select("id,nombre,activo")
              .eq("franquicia_id", perfilAdmin.franquicia_id)
              .eq("activo", true)
              .order("nombre", { ascending: true }),
            supabase
              .from("socios")
              .select("id,perfil:perfiles(nombre)")
              .eq("franquicia_id", perfilAdmin.franquicia_id),
          ]);

        setConceptosOptions(
          ((conceptosRows ?? []) as Array<{
            id: string;
            tipo: "ingreso" | "egreso";
            concepto: string;
            descripcion: string;
          }>).map((row) => ({
            id: row.id,
            tipo: row.tipo,
            concepto: row.concepto,
            descripcion: row.descripcion,
          })),
        );
        setFormasPagoOptions(
          ((formasRows ?? []) as Array<{ id: string; nombre: string }>).map((row) => ({
            id: row.id,
            nombre: row.nombre,
          })),
        );

        const sociosParsed = ((sociosRows ?? []) as Array<{
          id: string;
          perfil?: { nombre?: string | null } | null;
        }>)
          .map((row) => ({ id: row.id, nombre: row.perfil?.nombre ?? "Sin nombre" }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        setSociosOptions(sociosParsed);
      } catch {
        setSociosOptions([]);
        setConceptosCatalog(EMPTY_CONCEPTOS);
        setFormasPagoList([]);
        setConceptosOptions([]);
        setFormasPagoOptions([]);
      }
    };
    loadData();
  }, []);

  const { data: cajaData, isLoading: isCajaLoading, error: cajaError, mutate: mutateCaja } = useSWR(
    currentUserId && startDate && endDate && startDate <= endDate
      ? ["caja-data", currentUserId, startDate, endDate]
      : null,
    async () => {
      const [balanceRes, vencimientosRes, movimientosRes] = await Promise.all([
        obtenerBalanceCaja({ userId: currentUserId!, startDate, endDate }),
        obtenerProximosVencimientos({ userId: currentUserId!, startDate, endDate, limit: 10 }),
        obtenerMovimientosRecientes({ userId: currentUserId!, startDate, endDate, limit: 250 }),
      ]);

      type MovimientoCajaFetch = {
        id: string;
        fecha: string | null;
        tipo: string | null;
        monto: number | null;
        estado?: string | null;
        fecha_vencimiento?: string | null;
        observaciones?: string | null;
        concepto_id?: string | null;
        forma_pago_id?: string | null;
        socio_id?: string | null;
        concepto?: { concepto?: string | null; descripcion?: string | null } | null;
        forma?: { nombre?: string | null } | null;
        socio?: { perfil?: { nombre?: string | null } | null } | null;
      };

      type VencimientoFetch = {
        id: string;
        monto: number | null;
        fecha_vencimiento?: string | null;
        concepto?: { concepto?: string | null; descripcion?: string | null } | null;
      };

      const mappedMovs: Movimiento[] = movimientosRes.ok
        ? ((movimientosRes.data ?? []) as MovimientoCajaFetch[]).map((row) => ({
            id: row.id,
            conceptoId: String(row.concepto_id ?? ""),
            formaPagoId: String(row.forma_pago_id ?? ""),
            socioId: String(row.socio_id ?? ""),
            fecha: row.fecha?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
            concepto: row.concepto?.concepto ?? "Sin concepto",
            descripcion: row.concepto?.descripcion ?? "",
            categoria: row.tipo === "egreso" ? "Egreso" : "Ingreso",
            monto: Number(row.monto) || 0,
            formaPago: row.forma?.nombre ?? "",
            observaciones: row.observaciones ?? "",
            estado:
              String(row.estado ?? "pagado").toLowerCase() === "pendiente"
                ? "Pendiente"
                : "Pagado",
            fechaVencimiento: row.fecha_vencimiento?.slice(0, 10) ?? "",
            socio: row.socio?.perfil?.nombre ?? "",
          }))
        : [];

      const mappedVencimientos: Movimiento[] = vencimientosRes.ok
        ? ((vencimientosRes.data ?? []) as VencimientoFetch[]).map((row) => ({
            id: row.id,
            conceptoId: "",
            formaPagoId: "",
            socioId: "",
            fecha: row.fecha_vencimiento?.slice(0, 10) ?? "",
            concepto: row.concepto?.concepto ?? "Sin concepto",
            descripcion: row.concepto?.descripcion ?? "",
            categoria: "Egreso",
            monto: Number(row.monto) || 0,
            formaPago: "",
            observaciones: "",
            estado: "Pendiente",
            fechaVencimiento: row.fecha_vencimiento?.slice(0, 10) ?? "",
            socio: "",
          }))
        : [];

      return {
        balance: balanceRes.ok
          ? balanceRes.data
          : { ingresos: 0, egresos: 0, saldo: 0, pendientes: 0 },
        movimientos: mappedMovs,
        proximos: mappedVencimientos,
      };
    },
    {
      fallbackData: cachedCajaData ?? undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 60_000,
    },
  );

  useEffect(() => {
    if (!cajaData || typeof window === "undefined") return;
    try {
      window.localStorage.setItem("admin-caja-cache-v1", JSON.stringify(cajaData));
    } catch {
      // ignore localStorage write errors
    }
  }, [cajaData]);

  const cajaDataView = cajaData ?? cachedCajaData;
  const hasCajaData = Boolean(cajaDataView);
  const balanceCaja = cajaDataView?.balance ?? null;
  const movimientos = useMemo(() => cajaDataView?.movimientos ?? [], [cajaDataView]);
  const proximosVencimientosTop = useMemo(
    () => cajaDataView?.proximos ?? [],
    [cajaDataView],
  );
  const movimientosPeriodo = useMemo(() => movimientos, [movimientos]);

  const filtrados = useMemo(() => {
    const base = movimientosPeriodo;
    if (!filtroProximosVencimientos) return base;
    return base.filter(
      (m) => m.estado === "Pendiente" && isVenceEn7Dias(m.fechaVencimiento),
    );
  }, [movimientosPeriodo, filtroProximosVencimientos]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of movimientosPeriodo) {
      if (m.categoria !== "Egreso" || m.estado !== "Pagado") continue;
      map[m.concepto] = (map[m.concepto] ?? 0) + m.monto;
    }
    const names = Object.keys(map).filter((k) => map[k] > 0);
    return names.map((name, i) => ({
      name,
      value: map[name],
      fill: PIE_PALETTE[i % PIE_PALETTE.length],
    }));
  }, [movimientosPeriodo]);

  const pieTotal = useMemo(
    () => pieData.reduce((s, d) => s + d.value, 0),
    [pieData],
  );

  type AggConcepto = { total: number; byDesc: Record<string, number> };

  const consolidado = useMemo(() => {
    const ingresos: Record<string, AggConcepto> = {};
    const egresos: Record<string, AggConcepto> = {};
    for (const m of movimientosPeriodo) {
      const bucket = m.categoria === "Ingreso" ? ingresos : egresos;
      if (!bucket[m.concepto]) {
        bucket[m.concepto] = { total: 0, byDesc: {} };
      }
      bucket[m.concepto].total += m.monto;
      bucket[m.concepto].byDesc[m.descripcion] =
        (bucket[m.concepto].byDesc[m.descripcion] ?? 0) + m.monto;
    }
    return { ingresos, egresos };
  }, [movimientosPeriodo]);

  const totalIngresosCons = useMemo(
    () =>
      Object.values(consolidado.ingresos).reduce((s, x) => s + x.total, 0),
    [consolidado],
  );
  const totalEgresosCons = useMemo(
    () =>
      Object.values(consolidado.egresos).reduce((s, x) => s + x.total, 0),
    [consolidado],
  );
  const resultadoNetoCons = totalIngresosCons - totalEgresosCons;

  const openNew = useCallback(() => {
    setConsolidadoOpen(false);
    setSheetMode("new");
    setEditingId(null);
    setHasTriedSubmitMovimiento(false);
    setSheetOpen(true);
    const initial = emptyDraftFrom(conceptosCatalog, formasPagoList);
    const firstForma = formasPagoOptions[0];
    setDraft({
      ...initial,
      formaPagoId: firstForma?.id ?? "",
      formaPago: firstForma?.nombre ?? "",
      socioId: "",
      socio: "",
    });
  }, [conceptosCatalog, formasPagoList, formasPagoOptions]);

  const openEdit = useCallback((m: Movimiento) => {
    setConsolidadoOpen(false);
    setSheetMode("edit");
    setEditingId(m.id);
    setHasTriedSubmitMovimiento(false);
    setSheetOpen(true);
    void (async () => {
      try {
        const supabase = createSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("franquicia_id")
          .eq("id", user.id)
          .single();
        if (!perfil?.franquicia_id) return;
        const { conceptos, formasPago } = await loadCajaCatalogForFranquicia(
          supabase,
          perfil.franquicia_id,
        );
        setConceptosCatalog(conceptos);
        setFormasPagoList(formasPago);
        let d = movimientoToDraft(m);
        if (
          !isValidConceptoDescripcionFrom(
            m.categoria,
            m.concepto,
            m.descripcion,
            conceptos,
          )
        ) {
          const fb = firstConceptoDescFrom(m.categoria, conceptos);
          d = { ...d, concepto: fb.concepto, descripcion: fb.descripcion };
        }
        setDraft(d);
      } catch {
        setConceptosCatalog(EMPTY_CONCEPTOS);
        setFormasPagoList([]);
        setDraft(movimientoToDraft(m));
      }
    })();
  }, []);

  const saveDraft = useCallback(async () => {
    setHasTriedSubmitMovimiento(true);
    setSubmitError(null);
    const montoNum = Math.abs(Number(draft.monto) || 0);
    const conceptoRow = conceptosOptions.find((item) => item.id === draft.conceptoId);
    const formaPagoRow = formasPagoOptions.find((item) => item.id === draft.formaPagoId);

    if (
      montoNum === 0 ||
      !draft.conceptoId ||
      !draft.formaPagoId
    ) {
      toast.error("Completá monto, concepto y forma de pago");
      return;
    }

    if (sheetMode === "new") {
      if (!currentUserId) {
        toast.error("No se pudo identificar el usuario actual");
        return;
      }
      if (!conceptoRow?.id || !formaPagoRow?.id) {
        toast.error("Concepto o forma de pago inválidos");
        return;
      }

      const result = await crearMovimientoCajaAction({
        userId: currentUserId,
        tipo: draft.categoria === "Ingreso" ? "ingreso" : "egreso",
        monto: montoNum,
        conceptoId: conceptoRow.id,
        formaPagoId: draft.formaPagoId,
        socioId: draft.socioId || null,
        fecha: draft.fecha,
        observaciones: draft.observaciones.trim() || null,
      });

      if (!result.ok) {
        setSubmitError(result.error ?? "No se pudo registrar el movimiento");
        toast.error(result.error ?? "No se pudo registrar el movimiento");
        return;
      }
      if (result.warning) {
        toast.error(result.warning);
      }

      setSheetOpen(false);
      await mutateCaja();
      toast.success("Movimiento registrado correctamente");
      return;
    }

    setSheetOpen(false);
    await mutateCaja();
    toast.success("Movimiento registrado");
  }, [
    conceptosOptions,
    currentUserId,
    draft,
    formasPagoOptions,
    sheetMode,
    mutateCaja,
  ]);

  const deleteMovimiento = useCallback(async (movimiento: Movimiento) => {
    if (!currentUserId) {
      toast.error("No se pudo identificar el usuario actual");
      return;
    }
    const result = await deleteMovimientoCajaAction({
      userId: currentUserId,
      movimientoId: movimiento.id,
    });
    if (!result.ok) {
      toast.error(result.error ?? "No se pudo eliminar el movimiento");
      return;
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    if (editingId === movimiento.id) {
      setSheetOpen(false);
      setEditingId(null);
    }
    await mutateCaja();
    toast.success("Movimiento eliminado");
  }, [currentUserId, editingId, mutateCaja]);

  const conceptosByCategoria = useMemo(
    () =>
      conceptosOptions.filter(
        (item) =>
          item.tipo === (draft.categoria === "Ingreso" ? "ingreso" : "egreso") &&
          Boolean(item.id) &&
          ((item.descripcion && item.descripcion.trim().length > 0) ||
            item.concepto === "Pago de Cuota"),
      ),
    [conceptosOptions, draft.categoria],
  );
  const conceptosPrincipalesUnicos = useMemo(
    () =>
      Array.from(
        new Set(
          conceptosByCategoria
            .map((item) => String(item.concepto ?? "").trim())
            .filter(Boolean),
        ),
      ),
    [conceptosByCategoria],
  );
  const detallesConceptoSeleccionado = useMemo(
    () =>
      conceptosByCategoria.filter(
        (item) => String(item.concepto ?? "").trim() === String(draft.concepto ?? "").trim(),
      ),
    [conceptosByCategoria, draft.concepto],
  );
  const autoDetalle = useMemo(
    () => shouldAutoSelectDetalle(draft.concepto, detallesConceptoSeleccionado),
    [draft.concepto, detallesConceptoSeleccionado],
  );
  const shouldRenderDetalleSelector = useMemo(
    () => !autoDetalle && detallesConceptoSeleccionado.length > 1,
    [autoDetalle, detallesConceptoSeleccionado.length],
  );
  const safeFormaPagoOptions = useMemo(
    () =>
      formasPagoOptions.filter(
        (item) => Boolean(item?.id) && Boolean(String(item?.nombre ?? "").trim()),
      ),
    [formasPagoOptions],
  );
  const safeSociosOptions = useMemo(
    () =>
      sociosOptions.filter(
        (socio) => Boolean(socio?.id) && Boolean(String(socio?.nombre ?? "").trim()),
      ),
    [sociosOptions],
  );
  const fieldsDisabled = sheetMode === "edit";
  const shouldShowValidationErrors = hasTriedSubmitMovimiento;

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!(Number(draft.monto) > 0)) {
      errors.monto = "Ingresá un monto mayor a 0.";
    }
    if (!draft.concepto) {
      errors.concepto = "Seleccioná un concepto principal.";
    }
    if (!autoDetalle && draft.concepto && !draft.conceptoId) {
      errors.detalle = "Seleccioná una descripción/detalle para continuar.";
    }
    if (!draft.conceptoId) {
      errors.conceptoId = "Concepto inválido o incompleto.";
    }
    if (!draft.formaPagoId) {
      errors.formaPagoId = "Seleccioná una forma de pago.";
    }
    if (safeFormaPagoOptions.length === 0 && sheetMode === "new") {
      errors.formaPagoCatalog = "No hay formas de pago configuradas.";
    }
    if (isPagoCuota(draft.categoria, draft.concepto) && !draft.socioId) {
      errors.socioId = "Seleccioná un socio para Pago de Cuota.";
    }
    return errors;
  }, [autoDetalle, draft, safeFormaPagoOptions.length, sheetMode]);

  const saveDisabled = Object.keys(validationErrors).length > 0;

  useEffect(() => {
    if (!sheetOpen || !autoDetalle || draft.conceptoId || detallesConceptoSeleccionado.length === 0) return;
    const detalleDefault = detallesConceptoSeleccionado[0];
    if (!detalleDefault?.id) return;
    setDraft((d) => ({
      ...d,
      conceptoId: String(detalleDefault.id),
      descripcion: detalleDefault.descripcion ?? "",
    }));
  }, [autoDetalle, detallesConceptoSeleccionado, draft.conceptoId, sheetOpen]);

  const periodoLabel = periodoLabelFromRange(startDate, endDate);

  const kpiNumberClass = "text-3xl font-semibold tracking-tight tabular-nums";
  return (
    <div className="min-w-0 bg-zinc-950 font-sans text-zinc-50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="mb-8">
          <h1 className={PAGE_TITLE_CLASS}>Balance de Caja</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              >
                <Calendar className="size-4 shrink-0" aria-hidden />
                Filtrar Período
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="filtro-desde" className={LABEL_TECH}>Desde</Label>
                  <Input
                    id="filtro-desde"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border-zinc-800 bg-zinc-950 text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="filtro-hasta" className={LABEL_TECH}>Hasta</Label>
                  <Input
                    id="filtro-hasta"
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border-zinc-800 bg-zinc-950 text-foreground"
                  />
                </div>
                <p className="border-t border-zinc-800/50 pt-2 text-sm text-zinc-500">
                  Activo:{" "}
                  <span className="font-medium text-zinc-100">
                    {periodoLabel}
                  </span>
                </p>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={() => {
              setSheetOpen(false);
              setConsolidadoOpen(true);
            }}
          >
            Ver Consolidado
          </Button>
          <Button
            type="button"
            onClick={openNew}
            className="gap-2 bg-[#e41b68] font-semibold text-white hover:bg-[#e41b68]/90"
          >
            <Plus className="size-4 shrink-0" aria-hidden />
            Nuevo Movimiento
          </Button>
        </div>
      </div>
      {cajaError ? (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          No se pudieron cargar los datos de caja.
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-zinc-800/50 bg-card shadow-none ring-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className={KPI_TITLE_CLASS}>Ingresos</p>
          </CardHeader>
          <CardContent>
            <p className={cn(kpiNumberClass, "text-[#5ab253]")}>
              {hasCajaData && balanceCaja ? (
                formatPesos(balanceCaja.ingresos)
              ) : (
                <Skeleton className="h-9 w-36 bg-zinc-800" />
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800/50 bg-card shadow-none ring-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className={KPI_TITLE_CLASS}>Egresos</p>
          </CardHeader>
          <CardContent>
            <p className={cn(kpiNumberClass, "text-[#e41b68]")}>
              {hasCajaData && balanceCaja ? (
                formatPesos(balanceCaja.egresos)
              ) : (
                <Skeleton className="h-9 w-36 bg-zinc-800" />
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800/50 bg-card shadow-none ring-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className={KPI_TITLE_CLASS}>Saldo</p>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                kpiNumberClass,
                (balanceCaja?.saldo ?? 0) < 0 ? "text-red-500" : "text-green-500",
              )}
            >
              {hasCajaData && balanceCaja ? (
                formatPesos(balanceCaja.saldo)
              ) : (
                <Skeleton className="h-9 w-36 bg-zinc-800" />
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800/50 bg-card shadow-none ring-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className={KPI_TITLE_CLASS}>Pendientes</p>
          </CardHeader>
          <CardContent>
            <p className={cn(kpiNumberClass, "text-amber-300")}>
              {hasCajaData && balanceCaja ? (
                formatPesos(balanceCaja.pendientes)
              ) : (
                <Skeleton className="h-9 w-36 bg-zinc-800" />
              )}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6 border-zinc-800/50 bg-card shadow-none ring-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <PremiumCardTitle>Próximos vencimientos</PremiumCardTitle>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/35 bg-amber-400/12">
            <Clock className="size-4 text-amber-400" aria-hidden />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto w-full pb-2">
            <div className="overflow-hidden rounded-lg border border-zinc-800/50 min-w-[640px]">
              <table className="w-full text-sm">
              <thead className="bg-zinc-900">
                <tr className="border-b border-zinc-800/50">
                  <th className={cn("px-3 py-2 text-left", KPI_TITLE_CLASS)}>Concepto</th>
                  <th className={cn("px-3 py-2 text-left", KPI_TITLE_CLASS)}>Descripción</th>
                  <th className={cn("px-3 py-2 text-right", KPI_TITLE_CLASS)}>Total</th>
                  <th className={cn("px-3 py-2 text-right", KPI_TITLE_CLASS)}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {!hasCajaData && isCajaLoading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-sm text-zinc-500">
                      Cargando...
                    </td>
                  </tr>
                ) : proximosVencimientosTop.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-sm text-zinc-500">
                      No hay vencimientos en los próximos 7 días.
                    </td>
                  </tr>
                ) : (
                  proximosVencimientosTop.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-800/40 last:border-b-0">
                      <td className="px-3 py-2 text-zinc-100">{item.concepto}</td>
                      <td className="px-3 py-2 text-zinc-400">{item.descripcion}</td>
                      <td className="px-3 py-2 text-right font-semibold text-zinc-100">
                        {formatPesos(item.monto)}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-400">
                        {isoToDisplay(item.fechaVencimiento)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <Card className="border-zinc-800/50 bg-card shadow-none ring-0 lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <PremiumCardTitle>Movimientos de Caja</PremiumCardTitle>
              <CardDescription className="text-sm text-zinc-500">
                Tocá una fila para editar en el panel lateral.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              aria-pressed={filtroProximosVencimientos}
              onClick={() => setFiltroProximosVencimientos((prev) => !prev)}
              className={cn(
                "gap-2 border-amber-400/45 bg-zinc-900 text-amber-300 hover:bg-amber-400/10 hover:text-amber-200",
                filtroProximosVencimientos && "border-amber-400 bg-amber-400/15 ring-2 ring-amber-400/30",
              )}
            >
              Próximos vencimientos
            </Button>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <div className="overflow-x-auto w-full pb-2">
              <div className="min-w-[760px]">
                <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-zinc-800/40">
                  <TableHead className={cn("w-10", LABEL_TECH)} />
                  <TableHead className={LABEL_TECH}>Fecha</TableHead>
                  <TableHead className={LABEL_TECH}>Concepto</TableHead>
                  <TableHead className={LABEL_TECH}>Categoría</TableHead>
                  <TableHead className={cn("text-right", LABEL_TECH)}>
                    Monto
                  </TableHead>
                  <TableHead className={LABEL_TECH}>Estado</TableHead>
                  <TableHead className={cn("text-right", LABEL_TECH)}>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!hasCajaData && isCajaLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-zinc-500">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-zinc-500">
                      No hay movimientos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((row) => {
                    const pendienteVencido = isPendienteVencido(row);
                    return (
                      <TableRow
                        key={row.id}
                        onClick={() => openEdit(row)}
                        className={cn(
                          "cursor-pointer border-zinc-800 hover:bg-muted/50",
                          row.estado === "Pendiente" && "bg-[#e41b68]/[0.07]",
                          pendienteVencido && "ring-1 ring-[#e41b68]/60",
                        )}
                      >
                      <TableCell className="text-zinc-500">
                        {row.categoria === "Ingreso" ? (
                          <ArrowDownLeft
                            className="size-4 text-[#5ab253]"
                            aria-label="Ingreso"
                          />
                        ) : (
                          <ArrowUpRight
                            className="size-4 text-[#e41b68]"
                            aria-label="Egreso"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {isoToDisplay(row.fecha)}
                      </TableCell>
                      <TableCell className="max-w-[220px] min-w-0">
                        <p className="truncate font-medium text-zinc-100">
                          {row.concepto}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {row.descripcion}
                          {row.socio ? ` · Socio: ${row.socio}` : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            row.categoria === "Ingreso"
                              ? "text-sm font-medium text-[#5ab253]"
                              : "text-sm font-medium text-[#e41b68]"
                          }
                        >
                          {row.categoria}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-sm font-semibold tabular-nums",
                          row.categoria === "Ingreso"
                            ? "text-[#5ab253]"
                            : "text-[#e41b68]",
                        )}
                      >
                        {formatPesos(signedAmount(row))}
                      </TableCell>
                        <TableCell>
                          {row.estado === "Pendiente" ? (
                            pendienteVencido ? (
                              <Badge
                                variant="pending"
                                className="border-red-500/40 bg-red-500/15 text-red-300 font-normal"
                              >
                                <AlertTriangle className="size-3.5" />
                                Pendiente vencido
                              </Badge>
                            ) : (
                              <Badge variant="pending" className="font-normal">
                                <Clock className="size-3.5" />
                                Pendiente
                              </Badge>
                            )
                          ) : (
                            <Badge variant="success" className="font-normal">
                              Pagado
                            </Badge>
                          )}
                        </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-[#e41b68] hover:text-[#ff8fb8]"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteTarget(row);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden />
                            <span className="sr-only">Eliminar movimiento</span>
                          </Button>
                        </div>
                      </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/50 bg-card shadow-none ring-0 lg:col-span-1">
          <CardHeader>
            <PremiumCardTitle>Egresos pagados por rubro</PremiumCardTitle>
            <CardDescription className="text-sm text-zinc-500">
              Egresos pagados por concepto del catálogo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full min-w-0">
              {chartReady && pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#09090b",
                        border: "1px solid #3f3f46",
                        borderRadius: "0.75rem",
                        color: "#fafafa",
                        fontFamily: FONT_UI,
                        fontSize: 13,
                      }}
                      formatter={(val) =>
                        formatPesos(typeof val === "number" ? val : Number(val))
                      }
                    />
                    <Legend
                      wrapperStyle={{
                        fontFamily: FONT_UI,
                        fontSize: 12,
                        color: "#a1a1aa",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-700 text-center text-sm text-zinc-500">
                  {pieData.length === 0
                    ? "Sin egresos pagados en este período."
                    : "Cargando gráfico…"}
                </div>
              )}
            </div>
            {pieTotal > 0 && (
              <p className="mt-2 text-center text-sm text-zinc-500">
                Total: {formatPesos(pieTotal)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet
        open={consolidadoOpen}
        onOpenChange={(open) => {
          setConsolidadoOpen(open);
          if (open) setSheetOpen(false);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col border-l border-zinc-800/50 bg-card p-0 sm:max-w-lg"
        >
          <SheetHeader className="border-b border-zinc-800/50 px-4 pb-4">
            <PremiumSheetTitle>Consolidado financiero</PremiumSheetTitle>
            <SheetDescription className="text-sm text-zinc-500">
              Totales por concepto y descripción ({periodoLabel}).
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto bg-card px-4 pb-6 pt-4">
            <section>
              <SectionHeading as="h3" className="mb-3">
                Ingresos
              </SectionHeading>
              <div className="space-y-2">
                {Object.keys(consolidado.ingresos).length === 0 ? (
                  <p className="text-sm text-zinc-500">Sin movimientos.</p>
                ) : (
                  Object.entries(consolidado.ingresos)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([concepto, agg]) => (
                      <div
                        key={concepto}
                        className="overflow-hidden rounded-lg border border-zinc-800/50 bg-card"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-zinc-900/60"
                          onClick={() =>
                            setExpConsIng((p) => ({
                              ...p,
                              [concepto]: !p[concepto],
                            }))
                          }
                        >
                          <ChevronRight
                            className={cn(
                              "size-4 shrink-0 text-muted-foreground transition-transform",
                              expConsIng[concepto] && "rotate-90",
                            )}
                            aria-hidden
                          />
                          <span className="flex-1 text-sm font-medium text-zinc-100">
                            {concepto}
                          </span>
                          <span className="font-mono text-sm font-semibold text-[#5ab253]">
                            {formatPesos(agg.total)}
                          </span>
                        </button>
                        {expConsIng[concepto] ? (
                          <ul className="border-t border-zinc-800/50 bg-card/80 px-3 py-2">
                            {Object.entries(agg.byDesc)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([desc, val]) => (
                                <li
                                  key={desc}
                                  className="flex justify-between gap-2 py-1 text-sm"
                                >
                                  <span className="text-sm text-zinc-500">
                                    {desc}
                                  </span>
                                  <span className="font-mono font-medium text-[#5ab253]">
                                    {formatPesos(val)}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        ) : null}
                      </div>
                    ))
                )}
              </div>
            </section>
            <section>
              <SectionHeading as="h3" className="mb-3">
                Egresos
              </SectionHeading>
              <div className="space-y-2">
                {Object.keys(consolidado.egresos).length === 0 ? (
                  <p className="text-sm text-zinc-500">Sin movimientos.</p>
                ) : (
                  Object.entries(consolidado.egresos)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([concepto, agg]) => (
                      <div
                        key={concepto}
                        className="overflow-hidden rounded-lg border border-zinc-800/50 bg-card"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-zinc-900/60"
                          onClick={() =>
                            setExpConsEgr((p) => ({
                              ...p,
                              [concepto]: !p[concepto],
                            }))
                          }
                        >
                          <ChevronRight
                            className={cn(
                              "size-4 shrink-0 text-muted-foreground transition-transform",
                              expConsEgr[concepto] && "rotate-90",
                            )}
                            aria-hidden
                          />
                          <span className="flex-1 text-sm font-medium text-zinc-100">
                            {concepto}
                          </span>
                          <span className="font-mono text-sm font-semibold text-[#e41b68]">
                            {formatPesos(agg.total)}
                          </span>
                        </button>
                        {expConsEgr[concepto] ? (
                          <ul className="border-t border-zinc-800/50 bg-card/80 px-3 py-2">
                            {Object.entries(agg.byDesc)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([desc, val]) => (
                                <li
                                  key={desc}
                                  className="flex justify-between gap-2 py-1 text-sm"
                                >
                                  <span className="text-sm text-zinc-500">
                                    {desc}
                                  </span>
                                  <span className="font-mono font-medium text-[#e41b68]">
                                    {formatPesos(val)}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        ) : null}
                      </div>
                    ))
                )}
              </div>
            </section>
            <div className="rounded-xl border border-zinc-800/50 bg-card px-4 py-4">
              <p className={LABEL_TECH}>Resultado neto</p>
              <p
                className={cn(
                  "mt-1 font-mono text-3xl font-semibold tracking-tight tabular-nums",
                  resultadoNetoCons >= 0
                    ? "text-[#5ab253]"
                    : "text-[#e41b68]",
                )}
              >
                {formatPesos(resultadoNetoCons)}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (open) setConsolidadoOpen(false);
          if (!open) {
            setHasTriedSubmitMovimiento(false);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full border-l border-zinc-800/50 bg-card sm:max-w-md"
        >
          <SheetHeader>
            <PremiumSheetTitle>
              {sheetMode === "new" ? "Nuevo movimiento" : "Detalle de movimiento"}
            </PremiumSheetTitle>
            <SheetDescription className="text-sm text-zinc-500">
              {sheetMode === "new"
                ? "Completá los datos y guardá para actualizar el balance."
                : "Vista de solo lectura. Los movimientos guardados no se pueden editar."}
            </SheetDescription>
          </SheetHeader>

          <form
            id="movimiento-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (sheetMode === "edit") return;
              void saveDraft();
            }}
            className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4"
          >
            {submitError ? (
              <p className="text-sm text-red-500">{submitError}</p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="f-fecha" className={LABEL_TECH}>
                Fecha
              </Label>
              <Input
                id="f-fecha"
                type="date"
                value={draft.fecha}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, fecha: e.target.value }))
                }
                disabled={sheetMode === "edit" || fieldsDisabled}
                className="border-zinc-800 bg-zinc-950 text-foreground"
              />
              {sheetMode === "edit" ? (
                <p className="text-sm italic text-zinc-500">
                  La fecha no se puede modificar en movimientos existentes.
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className={LABEL_TECH}>Categoría</Label>
                <Select
                  value={draft.categoria}
                  onValueChange={(v: CategoriaMov) => {
                    const conceptosCategoria = conceptosOptions.filter(
                      (item) =>
                        item.tipo === (v === "Ingreso" ? "ingreso" : "egreso") &&
                        ((item.descripcion && item.descripcion.trim().length > 0) ||
                          item.concepto === "Pago de Cuota"),
                    );
                    const primerConceptoPrincipal = Array.from(
                      new Set(
                        conceptosCategoria
                          .map((item) => String(item.concepto ?? "").trim())
                          .filter(Boolean),
                      ),
                    )[0];
                    const detallesPrimerConcepto = conceptosCategoria.filter(
                      (item) => item.concepto === primerConceptoPrincipal,
                    );
                    const debeAutoseleccionar = shouldAutoSelectDetalle(
                      primerConceptoPrincipal ?? "",
                      detallesPrimerConcepto,
                    );
                    const detalleDefault =
                      debeAutoseleccionar && detallesPrimerConcepto.length > 0
                        ? detallesPrimerConcepto[0]
                        : null;
                    setDraft((d) => ({
                      ...d,
                      categoria: v,
                      conceptoId: detalleDefault?.id ?? "",
                      concepto: primerConceptoPrincipal ?? "",
                      descripcion: detalleDefault?.descripcion ?? "",
                      socio:
                        isPagoCuota(v, primerConceptoPrincipal ?? "") ? d.socio : "",
                      socioId:
                        isPagoCuota(v, primerConceptoPrincipal ?? "") ? d.socioId : "",
                    }));
                  }}
                  disabled={fieldsDisabled}
                >
                  <SelectTrigger tabIndex={0}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ingreso">Ingreso</SelectItem>
                    <SelectItem value="Egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-monto" className={LABEL_TECH}>
                  Monto
                </Label>
                <Input
                  id="f-monto"
                  type="number"
                  min={0}
                  step={1}
                  value={draft.monto || ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      monto: Math.abs(Number(e.target.value) || 0),
                    }))
                  }
                  disabled={sheetMode === "edit" || fieldsDisabled}
                  className="border-zinc-800 bg-zinc-950 text-foreground"
                />
                {sheetMode === "edit" ? (
                  <p className="text-sm italic text-zinc-500">
                    El monto no se puede modificar en movimientos existentes.
                  </p>
                ) : null}
                {shouldShowValidationErrors && validationErrors.monto ? (
                  <p className="text-red-500 text-sm">{validationErrors.monto}</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL_TECH}>Concepto principal</Label>
              <Popover
                open={conceptoComboboxOpen}
                onOpenChange={(open) => {
                  if (fieldsDisabled) return;
                  setConceptoComboboxOpen(open);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    tabIndex={0}
                    disabled={fieldsDisabled || conceptosPrincipalesUnicos.length === 0}
                    className="w-full justify-between border-zinc-800 bg-zinc-950 text-zinc-100"
                  >
                    {draft.concepto || "Seleccionar concepto"}
                    <ChevronRight className="size-4 rotate-90 opacity-70" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar concepto..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron conceptos.</CommandEmpty>
                      <CommandGroup>
                        {conceptosPrincipalesUnicos.map((concepto) => (
                          <CommandItem
                            key={String(concepto)}
                            value={String(concepto)}
                            onSelect={() => {
                              const detalles = conceptosByCategoria.filter(
                                (item) => item.concepto === concepto,
                              );
                              const debeAutoseleccionar = shouldAutoSelectDetalle(
                                concepto,
                                detalles,
                              );
                              const detalleDefault =
                                debeAutoseleccionar && detalles.length > 0
                                  ? detalles[0]
                                  : null;
                              setDraft((d) => ({
                                ...d,
                                concepto,
                                conceptoId: detalleDefault?.id ?? "",
                                descripcion: detalleDefault?.descripcion ?? "",
                                socio: isPagoCuota(d.categoria, concepto) ? d.socio : "",
                                socioId: isPagoCuota(d.categoria, concepto) ? d.socioId : "",
                              }));
                              setConceptoComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "size-4",
                                draft.concepto === concepto ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {concepto}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {shouldShowValidationErrors && validationErrors.concepto ? (
                <p className="text-red-500 text-sm">{validationErrors.concepto}</p>
              ) : null}
            </div>
            {shouldRenderDetalleSelector ? (
              <div className="space-y-1.5">
                <Label className={LABEL_TECH}>Descripción / Detalle</Label>
                <Popover
                  open={detalleComboboxOpen}
                  onOpenChange={(open) => {
                    if (fieldsDisabled || !draft.concepto || autoDetalle) return;
                    setDetalleComboboxOpen(open);
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      tabIndex={0}
                      disabled={
                        fieldsDisabled ||
                        !draft.concepto ||
                        autoDetalle ||
                        detallesConceptoSeleccionado.length === 0
                      }
                      className="w-full justify-between border-zinc-800 bg-zinc-950 text-zinc-100"
                    >
                      {draft.descripcion || "Seleccionar detalle"}
                      <ChevronRight className="size-4 rotate-90 opacity-70" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar descripción..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron descripciones.</CommandEmpty>
                        <CommandGroup>
                          {detallesConceptoSeleccionado
                            .filter((item) => item.id)
                            .map((item) => {
                              const descripcionLabel =
                                item.descripcion && item.descripcion.trim().length > 0
                                  ? item.descripcion
                                  : "Sin descripción";
                              return (
                                <CommandItem
                                  key={String(item.id)}
                                  value={`${item.concepto} ${descripcionLabel}`}
                                  onSelect={() => {
                                    setDraft((d) => ({
                                      ...d,
                                      conceptoId: String(item.id),
                                      descripcion: item.descripcion ?? "",
                                    }));
                                    setDetalleComboboxOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "size-4",
                                      draft.conceptoId === item.id
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {descripcionLabel}
                                </CommandItem>
                              );
                            })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {shouldShowValidationErrors && validationErrors.detalle ? (
                  <p className="text-red-500 text-sm">{validationErrors.detalle}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className={LABEL_TECH}>Descripción / Detalle</Label>
                <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-400">
                  {draft.descripcion || "Detalle autoasignado"}
                </div>
              </div>
            )}
            {isPagoCuota(draft.categoria, draft.concepto) ? (
              <div className="space-y-1.5">
                <Label className={LABEL_TECH}>Socio</Label>
                <Popover
                  open={socioComboboxOpen}
                  onOpenChange={(open) => {
                    if (fieldsDisabled) return;
                    setSocioComboboxOpen(open);
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      tabIndex={0}
                      disabled={fieldsDisabled}
                      className="w-full justify-between border-zinc-800 bg-zinc-950 text-zinc-100"
                    >
                      {safeSociosOptions.find((s) => s.id === draft.socioId)?.nombre ||
                        "Seleccionar socio"}
                      <ChevronRight className="size-4 rotate-90 opacity-70" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar socio..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron socios.</CommandEmpty>
                        <CommandGroup>
                          {safeSociosOptions.map((socio) => (
                            <CommandItem
                              key={String(socio.id)}
                              value={String(socio.nombre)}
                              onSelect={() => {
                                setDraft((d) => ({
                                  ...d,
                                  socioId: String(socio.id),
                                  socio: socio.nombre,
                                }));
                                setSocioComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "size-4",
                                  draft.socioId === socio.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {socio.nombre}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {shouldShowValidationErrors && validationErrors.socioId ? (
                  <p className="text-red-500 text-sm">{validationErrors.socioId}</p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className={LABEL_TECH}>Forma de pago</Label>
              <Select
                value={draft.formaPagoId || undefined}
                onValueChange={(v) => {
                  const selected = safeFormaPagoOptions.find(
                    (item) => String(item.id) === String(v),
                  );
                  setDraft((d) => ({
                    ...d,
                    formaPagoId: String(v),
                    formaPago: selected?.nombre ?? d.formaPago,
                  }));
                }}
                disabled={fieldsDisabled || safeFormaPagoOptions.length === 0}
              >
                <SelectTrigger tabIndex={0}>
                  <SelectValue
                    placeholder={
                      safeFormaPagoOptions.length === 0
                        ? "Configurá formas de pago en Configuración"
                        : undefined
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {safeFormaPagoOptions.map((fp) => (
                    <SelectItem key={String(fp.id)} value={String(fp.id)}>
                      {fp.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {shouldShowValidationErrors && validationErrors.formaPagoId ? (
                <p className="text-red-500 text-sm">{validationErrors.formaPagoId}</p>
              ) : null}
              {shouldShowValidationErrors && validationErrors.formaPagoCatalog ? (
                <p className="text-red-500 text-sm">{validationErrors.formaPagoCatalog}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-obs" className={LABEL_TECH}>
                Observaciones
              </Label>
              <Textarea
                id="f-obs"
                value={draft.observaciones}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, observaciones: e.target.value }))
                }
                disabled={fieldsDisabled}
                className="border-zinc-800 bg-zinc-950"
              />
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL_TECH}>Estado</Label>
              <Select
                value={draft.estado}
                onValueChange={(v: "Pagado" | "Pendiente") =>
                  setDraft((d) => ({
                    ...d,
                    estado: v,
                    fechaVencimiento:
                      v === "Pendiente" ? d.fechaVencimiento || d.fecha : "",
                  }))
                }
                disabled={fieldsDisabled}
              >
                <SelectTrigger tabIndex={0}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pagado">Pagado</SelectItem>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.estado === "Pendiente" && (
              <div className="space-y-1.5">
                <Label htmlFor="f-venc" className={LABEL_TECH}>
                  Fecha de vencimiento
                </Label>
                <Input
                  id="f-venc"
                  type="date"
                  value={draft.fechaVencimiento}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      fechaVencimiento: e.target.value,
                    }))
                  }
                  disabled={fieldsDisabled}
                  className="border-zinc-800 bg-zinc-950 text-foreground"
                />
              </div>
            )}
          </form>

          <SheetFooter className="border-t border-zinc-800/50 bg-card">
            {sheetMode === "edit" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-700"
                  onClick={() => setSheetOpen(false)}
                >
                  Cerrar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#e41b68]/50 text-[#e41b68] hover:bg-[#e41b68]/10 hover:text-[#ff8fb8]"
                  onClick={() => {
                    const current = movimientos.find((m) => m.id === editingId);
                    if (!current) return;
                    setDeleteTarget(current);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Eliminar
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-700"
                  onClick={(e) => {
                    e.preventDefault();
                    setSheetOpen(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  form="movimiento-form"
                  disabled={saveDisabled}
                  className="bg-[#5ab253] font-semibold text-white hover:bg-[#5ab253]/90"
                >
                  Guardar
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Eliminar movimiento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Esta accion eliminara definitivamente el movimiento seleccionado.
          </p>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteTarget(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#e41b68] text-white hover:bg-[#e41b68]/90"
              onClick={() => {
                if (!deleteTarget) return;
                void deleteMovimiento(deleteTarget);
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
