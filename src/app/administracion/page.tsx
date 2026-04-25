"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CalendarRange,
  Check,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { PremiumCardTitle, PremiumSheetTitle } from "@/components/PremiumTitle";
import { SectionHeading } from "@/components/SectionHeading";
import {
  KPI_TITLE_CLASS,
  PAGE_SUBTITLE_CLASS,
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

const FONT_UI =
  "var(--font-sans), ui-sans-serif, system-ui, sans-serif";

const LABEL_TECH =
  "text-sm font-medium text-zinc-400 uppercase tracking-wider";

const MESES = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
] as const;

type CategoriaMov = "Ingreso" | "Egreso";

type Movimiento = {
  id: string;
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

function newId() {
  return `mov-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
  const { id: _id, ...rest } = m;
  return rest;
}

const PIE_PALETTE = ["#e41b68", "#b81858", "#ff6ba8", "#c084fc", "#38bdf8"];

function filterByPeriod(
  list: Movimiento[],
  vistaAnual: boolean,
  year: string,
  month: string,
) {
  const y = year;
  if (vistaAnual) {
    return list.filter((m) => m.fecha.startsWith(y));
  }
  const prefix = `${y}-${month}`;
  return list.filter((m) => m.fecha.startsWith(prefix));
}

function isVenceEn7Dias(isoDate: string) {
  if (!isoDate) return false;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${isoDate}T00:00:00`);
  const diffDays = Math.ceil((target.getTime() - start.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays <= 7;
}

export default function AdministracionPage() {
  const now = new Date();
  const defaultYear = String(now.getFullYear());
  const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");

  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [vistaAnual, setVistaAnual] = useState(false);
  const [filtroProximosVencimientos, setFiltroProximosVencimientos] = useState(false);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [sociosCaja, setSociosCaja] = useState<string[]>([]);

  const [conceptosCatalog, setConceptosCatalog] =
    useState<ConceptosFinancieros>(EMPTY_CONCEPTOS);
  const [formasPagoList, setFormasPagoList] = useState<string[]>([]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"edit" | "new">("edit");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FormDraft>(() =>
    emptyDraftFrom(EMPTY_CONCEPTOS, []),
  );
  const [socioComboboxOpen, setSocioComboboxOpen] = useState(false);
  const [isEditingMovimiento, setIsEditingMovimiento] = useState(false);

  const [consolidadoOpen, setConsolidadoOpen] = useState(false);
  const [expConsIng, setExpConsIng] = useState<Record<string, boolean>>({});
  const [expConsEgr, setExpConsEgr] = useState<Record<string, boolean>>({});

  const [chartReady, setChartReady] = useState(false);
  useEffect(() => {
    setChartReady(true);
  }, []);

  useEffect(() => {
    if (formasPagoList.length === 0) return;
    setDraft((d) =>
      formasPagoList.includes(d.formaPago)
        ? d
        : { ...d, formaPago: formasPagoList[0] ?? "" },
    );
  }, [formasPagoList]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

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

        const { data: pagos } = await supabase
          .from("pagos")
          .select("id,monto,nombre_plan_historico,mes_correspondiente,fecha_pago,socio:socios(perfil:perfiles(nombre))")
          .eq("franquicia_id", perfilAdmin.franquicia_id);

        const mappedMovs: Movimiento[] = (pagos ?? []).map((p: any) => ({
          id: p.id,
          fecha: p.fecha_pago?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          concepto: "Cuotas",
          descripcion: p.nombre_plan_historico ?? "Mensual",
          categoria: "Ingreso",
          monto: Number(p.monto) || 0,
          formaPago: "",
          observaciones: "",
          estado: "Pagado",
          fechaVencimiento: "",
          socio: p.socio?.perfil?.nombre ?? "",
        }));
        setMovimientos(mappedMovs);

        const { data: perfilesSocios } = await supabase
          .from("perfiles")
          .select("nombre")
          .eq("franquicia_id", perfilAdmin.franquicia_id)
          .eq("rol", "socio");
        setSociosCaja((perfilesSocios ?? []).map((s) => s.nombre));
      } catch {
        setMovimientos([]);
        setSociosCaja([]);
        setConceptosCatalog(EMPTY_CONCEPTOS);
        setFormasPagoList([]);
      }
    };
    loadData();
  }, []);

  const movimientosPeriodo = useMemo(
    () => filterByPeriod(movimientos, vistaAnual, year, month),
    [movimientos, vistaAnual, year, month],
  );

  const filtrados = useMemo(() => {
    const base = movimientosPeriodo;
    if (!filtroProximosVencimientos) return base;
    return base.filter(
      (m) => m.estado === "Pendiente" && isVenceEn7Dias(m.fechaVencimiento),
    );
  }, [movimientosPeriodo, filtroProximosVencimientos]);

  const saldos = useMemo(() => {
    let actual = 0;
    let proyectado = 0;
    for (const m of movimientosPeriodo) {
      const s = signedAmount(m);
      proyectado += s;
      if (m.estado === "Pagado") actual += s;
    }
    return { saldoActual: actual, saldoProyectado: proyectado };
  }, [movimientosPeriodo]);

  const totalesCaja = useMemo(() => {
    let ing = 0;
    let egr = 0;
    for (const m of movimientosPeriodo) {
      if (m.estado !== "Pagado") continue;
      if (m.categoria === "Ingreso") ing += m.monto;
      else egr += m.monto;
    }
    return { ingresosPagados: ing, egresosPagados: egr };
  }, [movimientosPeriodo]);

  const totalPendientes = useMemo(
    () =>
      movimientosPeriodo
        .filter((m) => m.estado === "Pendiente")
        .reduce((sum, m) => sum + m.monto, 0),
    [movimientosPeriodo],
  );

  const proximosVencimientosTop = useMemo(
    () =>
      movimientosPeriodo
        .filter((m) => m.categoria === "Egreso" && m.estado === "Pendiente" && isVenceEn7Dias(m.fechaVencimiento))
        .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
        .slice(0, 3),
    [movimientosPeriodo],
  );

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
    setIsEditingMovimiento(true);
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
        setDraft(emptyDraftFrom(conceptos, formasPago));
      } catch {
        setConceptosCatalog(EMPTY_CONCEPTOS);
        setFormasPagoList([]);
        setDraft(emptyDraftFrom(EMPTY_CONCEPTOS, []));
      }
    })();
  }, []);

  const openEdit = useCallback((m: Movimiento) => {
    setConsolidadoOpen(false);
    setSheetMode("edit");
    setEditingId(m.id);
    setIsEditingMovimiento(false);
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
        if (
          formasPago.length > 0 &&
          (!d.formaPago || !formasPago.includes(d.formaPago))
        ) {
          d = { ...d, formaPago: formasPago[0] ?? "" };
        }
        setDraft(d);
      } catch {
        setConceptosCatalog(EMPTY_CONCEPTOS);
        setFormasPagoList([]);
        setDraft(movimientoToDraft(m));
      }
    })();
  }, []);

  const saveDraft = useCallback(() => {
    const montoNum = Math.abs(Number(draft.monto) || 0);
    if (
      montoNum === 0 ||
      !isValidConceptoDescripcionFrom(
        draft.categoria,
        draft.concepto,
        draft.descripcion,
        conceptosCatalog,
      ) ||
      (formasPagoList.length > 0 &&
        (!draft.formaPago || !formasPagoList.includes(draft.formaPago)))
    ) {
      return;
    }

    const base: Movimiento = {
      id: editingId ?? newId(),
      fecha: draft.fecha,
      concepto: draft.concepto,
      descripcion: draft.descripcion,
      categoria: draft.categoria,
      monto: montoNum,
      formaPago: draft.formaPago,
      observaciones: draft.observaciones.trim(),
      estado: draft.estado,
      fechaVencimiento:
        draft.estado === "Pendiente" ? draft.fechaVencimiento : "",
      socio: isPagoCuota(draft.categoria, draft.concepto) ? draft.socio : "",
    };

    setMovimientos((prev) => {
      if (sheetMode === "new") return [...prev, base];
      return prev.map((x) => (x.id === editingId ? base : x));
    });
    setSheetOpen(false);
    setIsEditingMovimiento(false);
    if (sheetMode === "new") {
      if (base.categoria === "Ingreso" && base.socio) {
        toast.success("Pago registrado exitosamente", {
          action: {
            label: "Enviar Comprobante",
            onClick: () => {
              toast.success("Comprobante enviado al correo del socio");
            },
          },
        });
      } else {
        toast.success("Movimiento registrado");
      }
    } else {
      toast.success("Movimiento actualizado correctamente");
    }
  }, [conceptosCatalog, draft, editingId, formasPagoList, sheetMode]);

  const deleteMovimiento = useCallback(() => {
    if (sheetMode !== "edit" || !editingId) return;
    setMovimientos((prev) => prev.filter((m) => m.id !== editingId));
    setSheetOpen(false);
    toast.success("Movimiento eliminado");
  }, [editingId, sheetMode]);

  const draftConceptoList = conceptosKeysFrom(draft.categoria, conceptosCatalog);
  const draftDescList = descripcionesForCat(
    draft.categoria,
    draft.concepto,
    conceptosCatalog,
  );
  const fieldsDisabled = sheetMode === "edit" && !isEditingMovimiento;

  const saveDisabled =
    !(Number(draft.monto) > 0) ||
    !isValidConceptoDescripcionFrom(
      draft.categoria,
      draft.concepto,
      draft.descripcion,
      conceptosCatalog,
    ) ||
    (formasPagoList.length > 0 &&
      (!draft.formaPago || !formasPagoList.includes(draft.formaPago))) ||
    (formasPagoList.length === 0 && sheetMode === "new") ||
    (isPagoCuota(draft.categoria, draft.concepto) && !draft.socio);

  const periodoLabel = vistaAnual
    ? `Año ${year}`
    : `${MESES.find((x) => x.value === month)?.label ?? month} ${year}`;

  const kpiNumberClass = "text-3xl font-semibold tracking-tight tabular-nums";
  return (
    <div className="min-w-0 bg-zinc-950 font-sans text-zinc-50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="mb-8">
          <h1 className={PAGE_TITLE_CLASS}>Balance de Caja</h1>
          <p className={cn(PAGE_SUBTITLE_CLASS, "max-w-2xl")}>
            Movimientos, saldos y proyección según el período seleccionado.
          </p>
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
                  <Label className={LABEL_TECH}>Año</Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["2025", "2026", "2027"].map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div
                  className={cn(
                    "space-y-2",
                    vistaAnual && "pointer-events-none opacity-40",
                  )}
                >
                  <Label className={LABEL_TECH}>Mes</Label>
                  <Select
                    value={month}
                    onValueChange={setMonth}
                    disabled={vistaAnual}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map((mes) => (
                        <SelectItem key={mes.value} value={mes.value}>
                          {mes.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <span className={LABEL_TECH}>Vista</span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "flex-1 border-zinc-800 bg-zinc-950",
                        !vistaAnual &&
                          "border-[#5ab253]/50 bg-[#5ab253]/10 text-[#7fd672]",
                      )}
                      onClick={() => setVistaAnual(false)}
                    >
                      <CalendarRange className="mr-1 size-4 shrink-0" />
                      Mensual
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "flex-1 border-zinc-800 bg-zinc-950",
                        vistaAnual &&
                          "border-[#e41b68]/50 bg-[#e41b68]/10 text-[#ff8fb8]",
                      )}
                      onClick={() => setVistaAnual(true)}
                    >
                      Anual
                    </Button>
                  </div>
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

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-zinc-800/50 bg-card shadow-none ring-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className={KPI_TITLE_CLASS}>Ingresos</p>
          </CardHeader>
          <CardContent>
            <p className={cn(kpiNumberClass, "text-[#5ab253]")}>
              {formatPesos(totalesCaja.ingresosPagados)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800/50 bg-card shadow-none ring-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className={KPI_TITLE_CLASS}>Egresos</p>
          </CardHeader>
          <CardContent>
            <p className={cn(kpiNumberClass, "text-[#e41b68]")}>
              {formatPesos(totalesCaja.egresosPagados)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800/50 bg-card shadow-none ring-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className={KPI_TITLE_CLASS}>Saldo</p>
          </CardHeader>
          <CardContent>
            <p className={cn(kpiNumberClass, "text-[#3b82f6]")}>
              {formatPesos(saldos.saldoActual)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800/50 bg-card shadow-none ring-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <p className={KPI_TITLE_CLASS}>Pendientes</p>
          </CardHeader>
          <CardContent>
            <p className={cn(kpiNumberClass, "text-amber-300")}>
              {formatPesos(totalPendientes)}
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
                {proximosVencimientosTop.length === 0 ? (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-zinc-500">
                      No hay movimientos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((row) => (
                    <TableRow
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openEdit(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openEdit(row);
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-zinc-800 hover:bg-zinc-800/50",
                        row.estado === "Pendiente" && "bg-[#e41b68]/[0.07]",
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
                          <Badge variant="pending" className="font-normal">
                            <Clock className="size-3.5" />
                            Pendiente
                          </Badge>
                        ) : (
                          <Badge variant="success" className="font-normal">
                            Pagado
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
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
          if (!open) setIsEditingMovimiento(false);
        }}
      >
        <SheetContent
          side="right"
          className="w-full border-l border-zinc-800/50 bg-card sm:max-w-md"
        >
          <SheetHeader>
            <PremiumSheetTitle>
              {sheetMode === "new" ? "Nuevo movimiento" : "Editar movimiento"}
            </PremiumSheetTitle>
            <SheetDescription className="text-sm text-zinc-500">
              Completá los datos y guardá para actualizar el balance.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
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
                disabled={fieldsDisabled}
                className="border-zinc-800 bg-zinc-950 text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className={LABEL_TECH}>Categoría</Label>
                <Select
                  value={draft.categoria}
                  onValueChange={(v: CategoriaMov) => {
                    const { concepto, descripcion } = firstConceptoDescFrom(
                      v,
                      conceptosCatalog,
                    );
                    setDraft((d) => ({
                      ...d,
                      categoria: v,
                      concepto,
                      descripcion,
                      socio: isPagoCuota(v, concepto) ? d.socio : "",
                    }));
                  }}
                  disabled={fieldsDisabled}
                >
                  <SelectTrigger>
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
                  disabled={fieldsDisabled}
                  className="border-zinc-800 bg-zinc-950 text-foreground"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL_TECH}>Concepto</Label>
              <Select
                value={draft.concepto}
                onValueChange={(concepto) => {
                  const list = descripcionesForCat(
                    draft.categoria,
                    concepto,
                    conceptosCatalog,
                  );
                  const descripcion = list.includes(draft.descripcion)
                    ? draft.descripcion
                    : (list[0] ?? "");
                  setDraft((d) => ({
                    ...d,
                    concepto,
                    descripcion,
                    socio: isPagoCuota(d.categoria, concepto) ? d.socio : "",
                  }));
                }}
                disabled={fieldsDisabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegí concepto" />
                </SelectTrigger>
                <SelectContent>
                  {draftConceptoList.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL_TECH}>Descripción</Label>
              <Select
                value={
                  draftDescList.includes(draft.descripcion)
                    ? draft.descripcion
                    : (draftDescList[0] ?? "")
                }
                onValueChange={(descripcion) =>
                  setDraft((d) => ({ ...d, descripcion }))
                }
                disabled={draftDescList.length === 0 || fieldsDisabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegí descripción" />
                </SelectTrigger>
                <SelectContent>
                  {draftDescList.map((dItem) => (
                    <SelectItem key={dItem} value={dItem}>
                      {dItem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                      disabled={fieldsDisabled}
                      className="w-full justify-between border-zinc-800 bg-zinc-950 text-zinc-100"
                    >
                      {draft.socio || "Seleccionar socio"}
                      <ChevronRight className="size-4 rotate-90 opacity-70" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar socio..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron socios.</CommandEmpty>
                        <CommandGroup>
                          {sociosCaja.map((socio) => (
                            <CommandItem
                              key={socio}
                              value={socio}
                              onSelect={() => {
                                setDraft((d) => ({ ...d, socio }));
                                setSocioComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "size-4",
                                  draft.socio === socio ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {socio}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className={LABEL_TECH}>Forma de pago</Label>
              <Select
                value={draft.formaPago || undefined}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, formaPago: v }))
                }
                disabled={fieldsDisabled || formasPagoList.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      formasPagoList.length === 0
                        ? "Configurá formas de pago en Configuración"
                        : undefined
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {formasPagoList.map((fp) => (
                    <SelectItem key={fp} value={fp}>
                      {fp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                placeholder="Notas internas"
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
                <SelectTrigger>
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
          </div>

          <SheetFooter className="border-t border-zinc-800/50 bg-card">
            {sheetMode === "edit" && !isEditingMovimiento ? (
              <Button
                type="button"
                variant="outline"
                className="ml-auto border-zinc-700"
                onClick={() => setSheetOpen(false)}
              >
                Cerrar
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-700"
                  onClick={() => {
                    if (sheetMode === "edit" && editingId) {
                      const original = movimientos.find((m) => m.id === editingId);
                      if (original) setDraft(movimientoToDraft(original));
                      setIsEditingMovimiento(false);
                    } else {
                      setSheetOpen(false);
                    }
                  }}
                >
                  Cancelar
                </Button>
                {sheetMode === "edit" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#e41b68]/50 text-[#e41b68] hover:bg-[#e41b68]/10 hover:text-[#ff8fb8]"
                    onClick={deleteMovimiento}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Eliminar
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={saveDraft}
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
    </div>
  );
}
