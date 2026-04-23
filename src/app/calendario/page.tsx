"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PremiumCardTitle } from "@/components/PremiumTitle";
import { SectionHeading } from "@/components/SectionHeading";
import {
  KPI_TITLE_CLASS,
  LABEL_TECH,
  PAGE_SUBTITLE_CLASS,
  PAGE_TITLE_CLASS,
  SHEET_HEADING_CLASS,
} from "@/lib/headings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fallbackClasesBase = ["09:00", "10:30", "12:00", "16:00", "18:00", "19:30"];
const capacidadTotal = 20;
const CONFIG_STORAGE_KEY = "jumping-club-config-v1";
type Role = "administracion" | "socio";

type ClassSheetContext = "new" | "edit";

type InstructorConfig = {
  id: string;
  nombre: string;
};

type ClaseTemplateConfig = {
  id: string;
  nombre: string;
  instructorId: string;
  horario: string;
};

const initialInscriptos: Record<string, string[]> = {
  "09:00": ["Santiago Vega", "Luis Guzman", "Laura Gomez"],
  "10:30": ["Nora Medina", "Juan Perez"],
  "12:00": [],
  "16:00": ["Lucia Torres"],
  "18:00": ["Matias Roldan", "Clara Rios", "Agustin Luna"],
  "19:30": [],
};

function getDiasSelector() {
  const base = new Date();
  const hoy = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  const pasado = new Date(hoy);
  pasado.setDate(hoy.getDate() + 2);

  return [
    { id: "hoy", label: "Hoy", hint: formatShortDate(hoy), date: hoy },
    { id: "manana", label: "Mañana", hint: formatShortDate(manana), date: manana },
    {
      id: "pasado",
      label: "Pasado",
      hint: formatShortDate(pasado),
      date: pasado,
    },
  ] as const;
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
  }).format(date);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function horaToTimeValue(hora: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!m) return "09:00";
  const hh = m[1]!.padStart(2, "0");
  return `${hh}:${m[2]}`;
}

export default function CalendarioPage() {
  const diasSelector = useMemo(() => getDiasSelector(), []);
  const [role] = useState<Role>(() => {
    if (typeof window === "undefined") return "administracion";
    const storedRole = window.localStorage.getItem("jumpingClubRole");
    return storedRole === "administracion" || storedRole === "socio"
      ? storedRole
      : "administracion";
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedClase, setSelectedClase] = useState<string | null>(null);
  const [inscripcionConfirmada, setInscripcionConfirmada] = useState(false);
  const [instructoresConfig, setInstructoresConfig] = useState<InstructorConfig[]>([]);
  const [clasesTemplateConfig, setClasesTemplateConfig] = useState<ClaseTemplateConfig[]>([]);
  const [clasesExtraPorDia, setClasesExtraPorDia] = useState<Record<string, string[]>>({});
  const [canceladosPorDia, setCanceladosPorDia] = useState<Record<string, string[]>>({});
  const [inscriptosPorClase, setInscriptosPorClase] = useState<Record<string, string[]>>(
    () => ({ ...initialInscriptos }),
  );
  const [cupoMaximoPorClase, setCupoMaximoPorClase] = useState<Record<string, number>>({});
  const [detalleClasePorDia, setDetalleClasePorDia] = useState<
    Record<string, Record<string, { nombre: string; instructorId: string }>>
  >({});

  const [classSheetOpen, setClassSheetOpen] = useState(false);
  const [classSheetContext, setClassSheetContext] = useState<ClassSheetContext | null>(
    null,
  );
  const [sheetHora, setSheetHora] = useState("14:00");
  const [sheetCupo, setSheetCupo] = useState(String(capacidadTotal));
  const [sheetNombreClase, setSheetNombreClase] = useState("");
  const [sheetInstructorId, setSheetInstructorId] = useState("");

  const selectedDateKey = selectedDate.toISOString().slice(0, 10);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        instructores?: InstructorConfig[];
        clasesTemplate?: ClaseTemplateConfig[];
      };
      setInstructoresConfig(
        Array.isArray(parsed.instructores)
          ? parsed.instructores.filter((x) => x?.id && x?.nombre)
          : [],
      );
      setClasesTemplateConfig(
        Array.isArray(parsed.clasesTemplate)
          ? parsed.clasesTemplate.filter(
              (x) => x?.id && x?.nombre && x?.instructorId && x?.horario,
            )
          : [],
      );
    } catch {
      setInstructoresConfig([]);
      setClasesTemplateConfig([]);
    }
  }, []);

  const clasesBase = useMemo(() => {
    if (clasesTemplateConfig.length === 0) return fallbackClasesBase;
    return [...new Set(clasesTemplateConfig.map((tpl) => tpl.horario))].sort();
  }, [clasesTemplateConfig]);

  const instructorNombreById = useMemo(
    () => Object.fromEntries(instructoresConfig.map((inst) => [inst.id, inst.nombre])),
    [instructoresConfig],
  );
  const nombresClaseDisponibles = useMemo(
    () => [...new Set(clasesTemplateConfig.map((tpl) => tpl.nombre))],
    [clasesTemplateConfig],
  );

  const clasesActivasDelDia = useMemo(() => {
    const extras = clasesExtraPorDia[selectedDateKey] ?? [];
    const cancelados = canceladosPorDia[selectedDateKey] ?? [];
    return [...clasesBase, ...extras].filter((h) => !cancelados.includes(h));
  }, [canceladosPorDia, clasesExtraPorDia, selectedDateKey]);

  const cuposPorClase = useMemo(() => {
    const seed = selectedDate.toISOString().slice(0, 10).replaceAll("-", "");
    return clasesActivasDelDia.map((hora, index) => {
      const factor = Number(seed.slice(-2)) + index * 2 + hora.length;
      const usados = 3 + (factor % 10);
      const max = cupoMaximoPorClase[hora] ?? capacidadTotal;
      const ocupados = Math.min(max, usados);
      return { hora, max, ocupados };
    });
  }, [clasesActivasDelDia, cupoMaximoPorClase, selectedDate]);

  const getClaseInfo = (hora: string, dateKey: string) => {
    const override = detalleClasePorDia[dateKey]?.[hora];
    if (override) return override;
    const template = clasesTemplateConfig.find((tpl) => tpl.horario === hora);
    if (template) {
      return { nombre: template.nombre, instructorId: template.instructorId };
    }
    return { nombre: "Clase general", instructorId: "" };
  };

  const clasesProgramadasMes = useMemo(() => {
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    let total = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const key = new Date(year, month, day).toISOString().slice(0, 10);
      const extras = clasesExtraPorDia[key]?.length ?? 0;
      const cancelados = canceladosPorDia[key]?.length ?? 0;
      total += clasesBase.length + extras - cancelados;
    }
    return total;
  }, [canceladosPorDia, clasesExtraPorDia, selectedDate]);

  const cuposLibresTotal = useMemo(
    () => cuposPorClase.reduce((acc, c) => acc + Math.max(0, c.max - c.ocupados), 0),
    [cuposPorClase],
  );

  const closeClassSheet = () => {
    setClassSheetOpen(false);
    setClassSheetContext(null);
  };

  const openNewClassSheet = () => {
    setClassSheetContext("new");
    const tpl = clasesTemplateConfig[0];
    setSheetHora(tpl?.horario ?? "14:00");
    setSheetCupo(String(capacidadTotal));
    setSheetNombreClase(tpl?.nombre ?? "");
    setSheetInstructorId(tpl?.instructorId ?? "");
    setClassSheetOpen(true);
  };

  const openEditClassSheet = () => {
    if (!selectedClase) return;
    setClassSheetContext("edit");
    setSheetHora(horaToTimeValue(selectedClase));
    setSheetCupo(
      String(cupoMaximoPorClase[selectedClase] ?? capacidadTotal),
    );
    const info = getClaseInfo(selectedClase, selectedDateKey);
    setSheetNombreClase(info.nombre);
    setSheetInstructorId(info.instructorId);
    setClassSheetOpen(true);
  };

  const onSelectClase = (hora: string) => {
    setSelectedClase(hora);
    setInscripcionConfirmada(false);
  };

  const onConfirmar = () => {
    if (!selectedClase) return;
    setInscripcionConfirmada(true);
    toast.success("Inscripción confirmada correctamente");
  };

  const confirmarClaseSheet = () => {
    const hRaw = sheetHora.trim();
    const nombreClase = sheetNombreClase.trim();
    if (!hRaw || !nombreClase || !sheetInstructorId) return;
    const h = horaToTimeValue(hRaw);
    const cupo = Math.min(60, Math.max(1, Math.round(Number(sheetCupo) || capacidadTotal)));

    if (classSheetContext === "new") {
      if (clasesActivasDelDia.includes(h)) {
        return;
      }
      setClasesExtraPorDia((prev) => ({
        ...prev,
        [selectedDateKey]: [...(prev[selectedDateKey] ?? []), h],
      }));
      setCupoMaximoPorClase((prev) => ({ ...prev, [h]: cupo }));
      setInscriptosPorClase((prev) => ({ ...prev, [h]: prev[h] ?? [] }));
      setDetalleClasePorDia((prev) => ({
        ...prev,
        [selectedDateKey]: {
          ...(prev[selectedDateKey] ?? {}),
          [h]: { nombre: nombreClase, instructorId: sheetInstructorId },
        },
      }));
      closeClassSheet();
      toast.success("Clase creada correctamente");
      return;
    }

    if (classSheetContext === "edit" && selectedClase) {
      const prevHora = selectedClase;
      const ocuparOtra = (lista: string[]) =>
        lista.filter((x) => x !== prevHora).includes(h);

      if (h !== prevHora && ocuparOtra(clasesActivasDelDia)) {
        return;
      }

      if (h !== prevHora) {
        const extras = [...(clasesExtraPorDia[selectedDateKey] ?? [])];
        const inExtras = extras.includes(prevHora);
        const isBase = (clasesBase as readonly string[]).includes(prevHora);

        if (inExtras) {
          const idx = extras.indexOf(prevHora);
          const next = [...extras];
          next[idx] = h;
          setClasesExtraPorDia((p) => ({ ...p, [selectedDateKey]: next }));
        } else if (isBase) {
          setCanceladosPorDia((p) => ({
            ...p,
            [selectedDateKey]: [...(p[selectedDateKey] ?? []), prevHora],
          }));
          setClasesExtraPorDia((p) => ({
            ...p,
            [selectedDateKey]: [...(p[selectedDateKey] ?? []), h],
          }));
        }

        setInscriptosPorClase((prev) => {
          const lista = prev[prevHora] ?? [];
          const { [prevHora]: _removed, ...rest } = prev;
          return { ...rest, [h]: lista };
        });
        setCupoMaximoPorClase((prev) => {
          const { [prevHora]: _c, ...rest } = prev;
          return { ...rest, [h]: cupo };
        });
        setSelectedClase(h);
        setDetalleClasePorDia((prev) => {
          const dayData = { ...(prev[selectedDateKey] ?? {}) };
          const prevInfo = dayData[prevHora];
          if (prevInfo) delete dayData[prevHora];
          dayData[h] = { nombre: nombreClase, instructorId: sheetInstructorId };
          return { ...prev, [selectedDateKey]: dayData };
        });
      } else {
        setCupoMaximoPorClase((prev) => ({ ...prev, [prevHora]: cupo }));
        setDetalleClasePorDia((prev) => ({
          ...prev,
          [selectedDateKey]: {
            ...(prev[selectedDateKey] ?? {}),
            [prevHora]: { nombre: nombreClase, instructorId: sheetInstructorId },
          },
        }));
      }
    }

    closeClassSheet();
    toast.success("Clase editada correctamente");
  };

  const cancelarClaseSeleccionada = () => {
    if (!selectedClase) return;
    const horaCancelada = selectedClase;
    setCanceladosPorDia((prev) => ({
      ...prev,
      [selectedDateKey]: [...(prev[selectedDateKey] ?? []), horaCancelada],
    }));
    setDetalleClasePorDia((prev) => {
      const dayData = { ...(prev[selectedDateKey] ?? {}) };
      delete dayData[horaCancelada];
      return { ...prev, [selectedDateKey]: dayData };
    });
    setSelectedClase(null);
    toast.success("Clase cancelada correctamente");
  };

  const sheetTitleText =
    classSheetContext === "edit" ? "EDITAR CLASE" : "NUEVA CLASE";

  return (
    <div>
      <h1 className={PAGE_TITLE_CLASS}>Calendario de Clases</h1>
      <p className={PAGE_SUBTITLE_CLASS}>
        Clases por día con vista adaptada para socios y administración.
      </p>

      {role === "administracion" ? (
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-zinc-800/50 bg-card p-4">
            <p className={KPI_TITLE_CLASS}>Clases del día</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-zinc-100">
              {clasesActivasDelDia.length}
            </p>
          </article>
          <article className="rounded-2xl border border-zinc-800/50 bg-card p-4">
            <p className={KPI_TITLE_CLASS}>Cupos libres (día)</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-zinc-100">
              {cuposLibresTotal}
            </p>
          </article>
          <article className="rounded-2xl border border-zinc-800/50 bg-card p-4">
            <p className={KPI_TITLE_CLASS}>Clases programadas (mes)</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-zinc-100">
              {clasesProgramadasMes}
            </p>
          </article>
        </section>
      ) : null}

      {role === "socio" ? (
        <section className="mt-6 rounded-2xl border border-zinc-800/50 bg-card p-3 md:p-4">
          <div className="grid grid-cols-3 gap-2">
            {diasSelector.map((dia) => {
              const selected = sameDay(selectedDate, dia.date);
              return (
                <button
                  key={dia.id}
                  type="button"
                  onClick={() => {
                    setSelectedDate(dia.date);
                    setSelectedClase(null);
                    setInscripcionConfirmada(false);
                  }}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-center transition-all",
                    selected
                      ? "border-primary bg-primary/20 text-primary ring-2 ring-primary/40 shadow-[0_0_24px_hsl(337_81%_50%_/_0.24)]"
                      : "border-white/10 bg-black/10 text-foreground/85 hover:bg-white/5"
                  )}
                >
                  <p className={KPI_TITLE_CLASS}>{dia.label}</p>
                  <p className="text-[11px] text-foreground/70">{dia.hint}</p>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div
        className={cn(
          "mt-6 grid w-full grid-cols-1 items-start gap-6",
          role === "administracion" && "xl:grid-cols-3",
        )}
      >
        {role === "administracion" ? (
          <Card className="w-full rounded-2xl border border-zinc-800/50 bg-card shadow-none">
            <CardHeader>
              <PremiumCardTitle>
                Calendario de clases
              </PremiumCardTitle>
              <CardDescription>
                Selecciona un día para gestionar horarios e inscriptos.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="flex w-full justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (!date) return;
                    setSelectedDate(date);
                    setSelectedClase(null);
                    setInscripcionConfirmada(false);
                  }}
                  className="rounded-xl border border-white/10 bg-black/15"
                  classNames={{
                    day_button:
                      "data-[selected-single=true]:ring-2 data-[selected-single=true]:ring-primary/45 data-[selected-single=true]:shadow-[0_0_20px_hsl(337_81%_50%_/_0.3)]",
                  }}
                />
              </div>
              <span className="mt-4 inline-flex rounded-full border border-secondary/35 bg-secondary/15 px-3 py-1 text-xs font-semibold text-secondary">
                {clasesProgramadasMes} clases programadas este mes
              </span>
            </CardContent>
          </Card>
        ) : null}

        <section className="flex h-full flex-col rounded-2xl border border-zinc-800/50 bg-card p-4 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionHeading>Clases Disponibles</SectionHeading>
              <p className="mt-1 text-sm text-foreground/70 capitalize">
                {formatLongDate(selectedDate)}
              </p>
            </div>
          </div>

          <div className="mt-5 flex w-full flex-col gap-3">
            {cuposPorClase.map(({ hora, max, ocupados }) => {
              const isSelected = selectedClase === hora;
              const porcentaje = max > 0 ? Math.min(100, Math.round((ocupados / max) * 100)) : 0;
              const info = getClaseInfo(hora, selectedDateKey);
              return (
                <button
                  key={hora}
                  type="button"
                  onClick={() => onSelectClase(hora)}
                  className={cn(
                    "flex w-full cursor-pointer flex-row items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left transition-colors hover:bg-zinc-800/80",
                    isSelected &&
                      "border-primary ring-2 ring-primary/45 shadow-[0_0_0_1px_hsl(337_81%_50%)]"
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <p
                      className={cn(
                        "text-xl font-bold text-zinc-50",
                        isSelected && "text-primary"
                      )}
                    >
                      {hora}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {info.nombre} • {instructorNombreById[info.instructorId] ?? "Sin instructor"}
                    </p>
                  </div>
                  <div className="flex min-w-[80px] flex-col items-end gap-2">
                    <p className="text-sm font-semibold text-zinc-100">
                      {ocupados}/{max}
                    </p>
                    <div className="h-1.5 w-28 rounded-full bg-zinc-800/80">
                      <div
                        className="h-full rounded-full bg-[#e41b68]"
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {role === "socio" && selectedClase ? (
            <div className="mt-7">
              <Button
                onClick={onConfirmar}
                disabled={inscripcionConfirmada}
                className={cn(
                  "h-11 w-full text-base font-semibold",
                  inscripcionConfirmada
                    ? "border border-secondary bg-secondary/10 text-secondary opacity-100 hover:bg-secondary/10"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                )}
              >
                {inscripcionConfirmada ? (
                  <>
                    <CheckCircle2 className="size-4" aria-hidden />
                    Inscripción Confirmada
                  </>
                ) : (
                  "Confirmar Inscripción"
                )}
              </Button>
              <p
                className={cn(
                  "mt-3 flex items-center gap-2 text-sm",
                  inscripcionConfirmada ? "text-secondary" : "text-foreground/65"
                )}
              >
                {inscripcionConfirmada ? (
                  <>
                    <CheckCircle2 className="size-4" aria-hidden />
                    Te anotaste a la clase de las {selectedClase}.
                  </>
                ) : (
                  "Confirma para reservar tu lugar en este horario."
                )}
              </p>
            </div>
          ) : null}

          {role === "administracion" ? (
            <div className="mt-auto flex flex-wrap gap-2 pt-7">
              <Button
                type="button"
                onClick={openEditClassSheet}
                disabled={!selectedClase}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Pencil className="size-4" aria-hidden />
                Editar Clase
              </Button>
              <Button
                type="button"
                onClick={cancelarClaseSeleccionada}
                disabled={!selectedClase}
                variant="outline"
                className="border-primary/55 text-primary hover:bg-primary/10 hover:text-primary"
              >
                Cancelar Clase
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                onClick={openNewClassSheet}
              >
                <Plus className="size-4" aria-hidden />
                Nueva Clase
              </Button>
            </div>
          ) : null}
        </section>

        {role === "administracion" ? (
          <section className="flex h-full flex-col rounded-2xl border border-zinc-800/50 bg-card p-4 md:p-7">
            <div className="flex items-center justify-between gap-3">
              <SectionHeading as="h3">Socios Inscriptos</SectionHeading>
            </div>

            <div className="mt-4">
              {selectedClase ? (
                (inscriptosPorClase[selectedClase] ?? []).length > 0 ? (
                  <ul className="space-y-2">
                    {(inscriptosPorClase[selectedClase] ?? []).map((nombre) => (
                      <li
                        key={nombre}
                        className="rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm"
                      >
                        {nombre}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-white/10 bg-black/10 px-3 py-3 text-sm text-foreground/70">
                    No hay socios anotados todavía.
                  </p>
                )
              ) : (
                <p className="rounded-lg border border-white/10 bg-black/10 px-3 py-3 text-sm text-foreground/70">
                  Selecciona una clase para ver el detalle de inscriptos.
                </p>
              )}
            </div>
          </section>
        ) : null}
      </div>

      {role === "administracion" ? (
        <Sheet
          open={classSheetOpen}
          onOpenChange={(open) => {
            if (!open) closeClassSheet();
          }}
        >
          <SheetContent
            side="right"
            className="flex w-full flex-col border-l border-zinc-800/50 bg-card text-zinc-50 sm:max-w-md"
          >
            <SheetHeader className="border-b border-zinc-800/50 pb-4 text-left">
              <SheetTitle className={SHEET_HEADING_CLASS}>{sheetTitleText}</SheetTitle>
              <SheetDescription className="text-sm text-zinc-500">
                {classSheetContext === "edit"
                  ? "Modificá nombre, instructor, hora y cupo máximo de la clase seleccionada."
                  : "Definí nombre, instructor, horario y cupo máximo para la nueva clase del día seleccionado."}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-1 py-6">
              <div className="space-y-1.5">
                <Label htmlFor="sheet-clase" className={LABEL_TECH}>
                  Nombre de la clase
                </Label>
                {nombresClaseDisponibles.length > 0 ? (
                  <Select value={sheetNombreClase} onValueChange={setSheetNombreClase}>
                    <SelectTrigger
                      id="sheet-clase"
                      className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    >
                      <SelectValue placeholder="Seleccionar clase" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                      {nombresClaseDisponibles.map((nombre) => (
                        <SelectItem key={nombre} value={nombre}>
                          {nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="sheet-clase"
                    value={sheetNombreClase}
                    onChange={(e) => setSheetNombreClase(e.target.value)}
                    placeholder="Ej. Funcional"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sheet-instructor" className={LABEL_TECH}>
                  Instructor
                </Label>
                <Select value={sheetInstructorId} onValueChange={setSheetInstructorId}>
                  <SelectTrigger
                    id="sheet-instructor"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                  >
                    <SelectValue placeholder="Seleccionar instructor" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                    {instructoresConfig.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sheet-hora" className={LABEL_TECH}>
                  Hora
                </Label>
                <Input
                  id="sheet-hora"
                  type="time"
                  step={1800}
                  value={sheetHora}
                  onChange={(e) => setSheetHora(e.target.value)}
                  className="border-zinc-800 bg-zinc-900 text-zinc-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sheet-cupo" className={LABEL_TECH}>
                  Cupo máximo
                </Label>
                <Input
                  id="sheet-cupo"
                  type="number"
                  min={1}
                  max={60}
                  value={sheetCupo}
                  onChange={(e) => setSheetCupo(e.target.value)}
                  className="border-zinc-800 bg-zinc-900 text-zinc-100"
                />
              </div>
            </div>

            <SheetFooter className="flex flex-row flex-wrap justify-end gap-2 border-t border-zinc-800/50 bg-card pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                onClick={closeClassSheet}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmarClaseSheet}
                disabled={!sheetNombreClase.trim() || !sheetInstructorId}
                className="bg-[#5ab253] font-semibold text-white hover:bg-[#5ab253]/90"
              >
                {classSheetContext === "edit"
                  ? "Guardar cambios"
                  : "Confirmar clase"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
