"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { CheckCircle2, Pencil, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
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
  PAGE_TITLE_CLASS,
  SHEET_HEADING_CLASS,
} from "@/lib/headings";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/text";
import { toast } from "sonner";
import { z } from "zod";
import { es } from "date-fns/locale";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  desinscribirSocioDeClaseAction,
  getClaseHistorialAction,
  getInscriptosPorClaseAction,
  inscribirSocioEnClase,
  updateClaseWithHistoryAction,
} from "@/actions/clases";

const capacidadTotal = 20;
type Role = "administracion" | "socio";
const STORAGE_KEY = "jumping-club-config-v1";
const DAY_IDS = ["lun", "mar", "mie", "jue", "vie", "sab"] as const;
type DayId = (typeof DAY_IDS)[number];

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
  diaSemana: DayId;
  validFrom: string | null;
  validTo: string | null;
};

type ClaseProgramada = {
  id: string;
  nombre: string;
  instructorId: string;
  fechaHora: string;
  cupoMaximo: number;
  reservasActuales: number;
  estado: "activa" | "cancelada";
};

type ClaseRender = {
  id: string;
  source: "recurrente" | "especial";
  classId: string | null;
  nombre: string;
  instructorId: string;
  fechaHora: string;
  cupoMaximo: number;
  reservasActuales: number;
  estado: "activa" | "cancelada";
};

type ClaseHistorialItem = {
  id: string;
  nombreAnterior: string;
  instructorAnterior: string | null;
  fechaHoraAnterior: string;
  nombreNuevo: string;
  instructorNuevo: string | null;
  fechaHoraNuevo: string;
  editadoEn: string | null;
};

type InscriptoClase = {
  socioId: string;
  nombre: string;
};

type SocioListaInscripcionAdmin = {
  id: string;
  nombre: string;
  estado: string | null;
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

function weekdayToDayId(day: number): DayId | null {
  if (day === 1) return "lun";
  if (day === 2) return "mar";
  if (day === 3) return "mie";
  if (day === 4) return "jue";
  if (day === 5) return "vie";
  if (day === 6) return "sab";
  return null;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => Number(x) || 0);
  return h * 60 + m;
}

function getHorarioAperturaDia(
  dayId: DayId | null,
  schedules: Record<DayId, DaySchedule> | null,
) {
  const fallback = "08:00";
  if (!dayId) return fallback;
  const daySchedule = schedules?.[dayId];
  if (!daySchedule) return fallback;
  const aperturas = [daySchedule.manana, daySchedule.tarde]
    .filter((b) => b.enabled)
    .map((b) => b.inicio)
    .sort((a, b) => toMinutes(a) - toMinutes(b));
  return aperturas[0] ?? fallback;
}

function dateKeyFromDateTime(value: string) {
  return value.slice(0, 10);
}

function timeValueFromDateTime(value: string) {
  const t = value.slice(11, 16);
  return /^\d{2}:\d{2}$/.test(t) ? t : "09:00";
}

function dayIdToWeekday(dayId: DayId) {
  if (dayId === "lun") return 1;
  if (dayId === "mar") return 2;
  if (dayId === "mie") return 3;
  if (dayId === "jue") return 4;
  if (dayId === "vie") return 5;
  return 6;
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
  const [selectedClaseId, setSelectedClaseId] = useState<string | null>(null);
  const [instructoresConfig, setInstructoresConfig] = useState<InstructorConfig[]>([]);
  const [clasesTemplateConfig, setClasesTemplateConfig] = useState<ClaseTemplateConfig[]>([]);
  const [adminFranquiciaId, setAdminFranquiciaId] = useState<string | null>(null);
  const [clasesProgramadas, setClasesProgramadas] = useState<ClaseProgramada[]>([]);
  const [clasesCanceladas, setClasesCanceladas] = useState<
    Array<{ nombre: string; instructorId: string; fechaHora: string }>
  >([]);
  const [currentSocioId, setCurrentSocioId] = useState<string | null>(null);
  const [currentSocioEstado, setCurrentSocioEstado] = useState<string | null>(null);

  const [classSheetOpen, setClassSheetOpen] = useState(false);
  const [classSheetContext, setClassSheetContext] = useState<ClassSheetContext | null>(
    null,
  );
  const [sheetHora, setSheetHora] = useState("14:00");
  const [sheetCupo, setSheetCupo] = useState(String(capacidadTotal));
  const [sheetNombreClase, setSheetNombreClase] = useState("");
  const [sheetInstructorId, setSheetInstructorId] = useState("");
  const [editingClaseId, setEditingClaseId] = useState<string | null>(null);
  const [isSavingClase, setIsSavingClase] = useState(false);
  const [schedulesConfig, setSchedulesConfig] = useState<Record<DayId, DaySchedule> | null>(null);
  const [claseHistorial, setClaseHistorial] = useState<ClaseHistorialItem[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [classSubmitError, setClassSubmitError] = useState<string | null>(null);
  const [classSubmitAttempted, setClassSubmitAttempted] = useState(false);
  const [classFieldErrors, setClassFieldErrors] = useState<
    Partial<Record<"nombre" | "instructorId" | "hora", string>>
  >({});
  const [isBajandoInscripcion, setIsBajandoInscripcion] = useState(false);
  const [socioInscripcionAdminId, setSocioInscripcionAdminId] = useState("");
  const [inscribiendoSocioAdmin, setInscribiendoSocioAdmin] = useState(false);

  const selectedDateKey = selectedDate.toISOString().slice(0, 10);
  const selectedDayId = weekdayToDayId(selectedDate.getDay());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        schedules?: Record<DayId, DaySchedule>;
      };
      if (parsed.schedules) setSchedulesConfig(parsed.schedules);
    } catch {
      setSchedulesConfig(null);
    }
  }, []);

  const { data: calendarContext, error: calendarContextError } = useSWR(
    "calendario-context",
    async () => {
      const supabase = createSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("franquicia_id")
        .eq("id", user.id)
        .single();
      if (!perfil?.franquicia_id) return null;
      const { data: instRows } = await supabase
        .from("instructores")
        .select("id,nombre")
        .eq("franquicia_id", perfil.franquicia_id)
        .order("nombre", { ascending: true });
      const { data: socioRow } = await supabase
        .from("socios")
        .select("id,estado")
        .eq("perfil_id", user.id)
        .maybeSingle();

      const { data: franquiciaRow } = await supabase
        .from("franquicias")
        .select("minutos_limite_baja_inscripcion")
        .eq("id", perfil.franquicia_id)
        .maybeSingle();
      const minutosLimiteBajaInscripcion = Number(
        franquiciaRow?.minutos_limite_baja_inscripcion ?? 30,
      );

      return {
        userId: user.id,
        franquiciaId: perfil.franquicia_id,
        socioId: socioRow?.id ?? null,
        socioEstado: socioRow?.estado ?? null,
        minutosLimiteBajaInscripcion: Number.isFinite(minutosLimiteBajaInscripcion)
          ? minutosLimiteBajaInscripcion
          : 30,
        instructores:
          (instRows ?? [])
            .filter((x) => x.id && x.nombre)
            .map((x) => ({ id: x.id, nombre: x.nombre })) as InstructorConfig[],
      };
    },
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  useEffect(() => {
    if (!calendarContext) return;
    setAdminFranquiciaId(calendarContext.franquiciaId);
    setCurrentSocioId(calendarContext.socioId);
    setCurrentSocioEstado(calendarContext.socioEstado);
    setInstructoresConfig(calendarContext.instructores);
  }, [calendarContext]);

  useEffect(() => {
    setSocioInscripcionAdminId("");
  }, [selectedClaseId]);

  const {
    data: calendarData,
    isLoading: isLoadingCalendar,
    error: calendarDataError,
    mutate: mutateCalendar,
  } = useSWR(
    adminFranquiciaId
      ? ["calendario-data", adminFranquiciaId, selectedDate.getFullYear(), selectedDate.getMonth()]
      : null,
    async () => {
      const supabase = createSupabaseClient();
      const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      const from = `${firstDay.toISOString().slice(0, 10)}T00:00:00`;
      const to = `${lastDay.toISOString().slice(0, 10)}T23:59:59`;
      const [{ data: tplRows }, { data: claseRows }, { data: canceladasRows }] = await Promise.all([
        supabase
          .from("plantillas_clases")
          .select("id,nombre,instructor_id,horario,dia_semana,valid_from,valid_to")
          .eq("franquicia_id", adminFranquiciaId)
          .eq("activo", true)
          .order("horario", { ascending: true }),
        supabase
          .from("clases")
          .select("id,nombre,instructor_id,fecha_hora,cupo_maximo,reservas_actuales,estado")
          .eq("franquicia_id", adminFranquiciaId)
          .eq("estado", "activa")
          .gte("fecha_hora", from)
          .lte("fecha_hora", to)
          .order("fecha_hora", { ascending: true }),
        supabase
          .from("clases")
          .select("nombre,instructor_id,fecha_hora")
          .eq("franquicia_id", adminFranquiciaId)
          .eq("estado", "cancelada")
          .gte("fecha_hora", from)
          .lte("fecha_hora", to),
      ]);

      return {
        templates: (tplRows ?? [])
          .filter(
            (x) =>
              x.id &&
              x.nombre &&
              x.instructor_id &&
              x.horario &&
              DAY_IDS.includes((x.dia_semana ?? "") as DayId),
          )
          .map((x) => ({
            id: x.id,
            nombre: x.nombre,
            instructorId: x.instructor_id,
            horario: x.horario,
            diaSemana: x.dia_semana as DayId,
            validFrom: x.valid_from ?? null,
            validTo: x.valid_to ?? null,
          })),
        programadas: (claseRows ?? []).map((row) => ({
          id: row.id,
          nombre: row.nombre ?? "",
          instructorId: row.instructor_id ?? "",
          fechaHora: row.fecha_hora,
          cupoMaximo: row.cupo_maximo ?? capacidadTotal,
          reservasActuales: row.reservas_actuales ?? 0,
          estado: (row.estado as "activa" | "cancelada") ?? "activa",
        })),
        canceladas: (canceladasRows ?? []).map((row) => ({
          nombre: row.nombre ?? "",
          instructorId: row.instructor_id ?? "",
          fechaHora: row.fecha_hora,
        })),
      };
    },
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  useEffect(() => {
    if (!calendarData) return;
    setClasesTemplateConfig(calendarData.templates);
    setClasesProgramadas(calendarData.programadas);
    setClasesCanceladas(calendarData.canceladas);
  }, [calendarData]);

  const reloadCalendarData = useCallback(async () => {
    await mutateCalendar();
  }, [mutateCalendar]);

  const instructorNombreById = useMemo(
    () => Object.fromEntries(instructoresConfig.map((inst) => [inst.id, inst.nombre])),
    [instructoresConfig],
  );
  const nombresClaseDisponibles = useMemo(
    () =>
      selectedDayId
        ? [
            ...new Set(
              clasesTemplateConfig
                .filter((tpl) => tpl.diaSemana === selectedDayId)
                .map((tpl) => tpl.nombre),
            ),
          ]
        : [],
    [clasesTemplateConfig, selectedDayId],
  );

  const clasesRenderMes = useMemo(() => {
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    const recurrentes: ClaseRender[] = [];
    const especiales: ClaseRender[] = [];

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (const tpl of clasesTemplateConfig) {
      const targetWeekday = dayIdToWeekday(tpl.diaSemana);
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        if (d.getDay() !== targetWeekday) continue;
        const dateKey = d.toISOString().slice(0, 10);
        if (tpl.validFrom && tpl.validFrom > dateKey) continue;
        if (tpl.validTo && tpl.validTo < dateKey) continue;
        const hhmm = horaToTimeValue(tpl.horario);
        recurrentes.push({
          id: `tpl-${tpl.id}-${dateKey}-${hhmm}`,
          source: "recurrente",
          classId: null,
          nombre: tpl.nombre,
          instructorId: tpl.instructorId,
          fechaHora: `${dateKey}T${hhmm}:00`,
          cupoMaximo: capacidadTotal,
          reservasActuales: 0,
          estado: "activa",
        });
      }
    }

    for (const clase of clasesProgramadas) {
      especiales.push({
        id: clase.id,
        source: "especial",
        classId: clase.id,
        nombre: clase.nombre,
        instructorId: clase.instructorId,
        fechaHora: clase.fechaHora,
        cupoMaximo: clase.cupoMaximo ?? capacidadTotal,
        reservasActuales: clase.reservasActuales ?? 0,
        estado: clase.estado,
      });
    }

    const sameSlotAndIdentity = (a: ClaseRender, b: ClaseRender) =>
      a.fechaHora === b.fechaHora &&
      a.nombre === b.nombre &&
      a.instructorId === b.instructorId;

    for (const c of clasesCanceladas) {
      const idx = recurrentes.findIndex(
        (r) =>
          r.fechaHora === c.fechaHora &&
          r.nombre === c.nombre &&
          r.instructorId === c.instructorId,
      );
      if (idx >= 0) recurrentes.splice(idx, 1);
    }

    for (const esp of especiales) {
      if (esp.estado === "cancelada") {
        const idx = recurrentes.findIndex((r) => sameSlotAndIdentity(r, esp));
        if (idx >= 0) recurrentes.splice(idx, 1);
      } else {
        const idx = recurrentes.findIndex((r) => sameSlotAndIdentity(r, esp));
        if (idx >= 0) recurrentes[idx] = esp;
      }
    }

    const merged = [
      ...recurrentes,
      ...especiales.filter(
        (esp) =>
          esp.estado !== "cancelada" &&
          !recurrentes.some((r) => sameSlotAndIdentity(r, esp)),
      ),
    ];

    return merged.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
  }, [clasesCanceladas, clasesProgramadas, clasesTemplateConfig, selectedDate]);

  const clasesActivasDelDia = useMemo(
    () =>
      clasesRenderMes
        .filter((clase) => clase.estado !== "cancelada")
        .filter((clase) => dateKeyFromDateTime(clase.fechaHora) === selectedDateKey)
        .sort((a, b) => timeValueFromDateTime(a.fechaHora).localeCompare(timeValueFromDateTime(b.fechaHora))),
    [clasesRenderMes, selectedDateKey],
  );

  const cuposPorClase = useMemo(
    () =>
      clasesActivasDelDia.map((clase) => {
        const max = clase.cupoMaximo ?? capacidadTotal;
        const ocupados = Math.min(max, Math.max(clase.reservasActuales, 0));
        return {
          id: clase.id,
          source: clase.source,
          classId: clase.classId,
          fechaHora: clase.fechaHora,
          hora: timeValueFromDateTime(clase.fechaHora),
          max,
          ocupados,
          nombre: clase.nombre,
          instructorId: clase.instructorId,
        };
      }),
    [clasesActivasDelDia],
  );
  const horaInicioVisual = useMemo(
    () => getHorarioAperturaDia(selectedDayId, schedulesConfig),
    [schedulesConfig, selectedDayId],
  );
  const cuposPorClaseVisibles = useMemo(
    () => cuposPorClase.filter((c) => toMinutes(c.hora) >= toMinutes(horaInicioVisual)),
    [cuposPorClase, horaInicioVisual],
  );

  const clasesProgramadasMes = useMemo(() => {
    return clasesRenderMes.length;
  }, [clasesRenderMes]);

  const cuposLibresTotal = useMemo(
    () => cuposPorClase.reduce((acc, c) => acc + Math.max(0, c.max - c.ocupados), 0),
    [cuposPorClase],
  );
  const selectedClase = useMemo(
    () => cuposPorClase.find((c) => c.id === selectedClaseId) ?? null,
    [cuposPorClase, selectedClaseId],
  );
  const {
    data: inscriptosClaseData,
    isLoading: isLoadingInscriptosClase,
    error: inscriptosError,
    mutate: mutateInscriptosClase,
  } = useSWR<InscriptoClase[]>(
    selectedClase?.classId ? ["clase-inscriptos", selectedClase.classId] : null,
    async () => {
      const result = await getInscriptosPorClaseAction(selectedClase!.classId!);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const {
    data: sociosInscripcionAdminData,
    isLoading: isLoadingSociosInscripcionAdmin,
    error: sociosInscripcionAdminError,
  } = useSWR<SocioListaInscripcionAdmin[]>(
    role === "administracion" && adminFranquiciaId
      ? ["calendario-socios-inscripcion-admin", adminFranquiciaId]
      : null,
    async () => {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("socios")
        .select("id,estado,perfil:perfiles(nombre)")
        .eq("franquicia_id", adminFranquiciaId!)
        .order("nombre", { ascending: true, foreignTable: "perfiles" });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{
        id: string;
        estado: string | null;
        perfil?: { nombre?: string | null } | null;
      }>;
      return rows
        .filter((r) => Boolean(r.id))
        .map((r) => ({
          id: r.id,
          nombre: (r.perfil?.nombre ?? "").trim() || "Sin nombre",
          estado: r.estado,
        }));
    },
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const sociosInscribiblesParaAdmin = useMemo(() => {
    const base = sociosInscripcionAdminData ?? [];
    const ya = new Set((inscriptosClaseData ?? []).map((i) => i.socioId));
    return [...base].filter((s) => !ya.has(s.id)).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [inscriptosClaseData, sociosInscripcionAdminData]);

  const claseCupoLlenoAdmin = useMemo(() => {
    if (!selectedClase) return false;
    return selectedClase.ocupados >= selectedClase.max;
  }, [selectedClase]);

  const closeClassSheet = () => {
    setClassSheetOpen(false);
    setClassSheetContext(null);
    setEditingClaseId(null);
    setClassSubmitAttempted(false);
    setClassFieldErrors({});
    setClassSubmitError(null);
  };

  const openNewClassSheet = () => {
    setClassSheetContext("new");
    setEditingClaseId(null);
    const tpl = clasesTemplateConfig[0];
    const horaBase = tpl?.horario ?? horaInicioVisual;
    setSheetHora(
      toMinutes(horaBase) < toMinutes(horaInicioVisual) ? horaInicioVisual : horaBase,
    );
    setSheetCupo(String(capacidadTotal));
    setSheetNombreClase(tpl?.nombre ?? "");
    setSheetInstructorId(tpl?.instructorId ?? "");
    setClassSubmitAttempted(false);
    setClassFieldErrors({});
    setClassSubmitError(null);
    setClassSheetOpen(true);
  };

  const openEditClassSheet = () => {
    if (!selectedClase || !selectedClase.classId) {
      toast.error("Selecciona una instancia real de clase para editar");
      return;
    }
    setClassSheetContext("edit");
    setEditingClaseId(selectedClase.classId);
    setSheetHora(selectedClase.hora);
    setSheetCupo(String(selectedClase.max ?? capacidadTotal));
    setSheetNombreClase(selectedClase.nombre);
    setSheetInstructorId(selectedClase.instructorId);
    setClassSubmitAttempted(false);
    setClassFieldErrors({});
    setClassSubmitError(null);
    setClassSheetOpen(true);
  };

  const onSelectClase = (claseId: string) => {
    setSelectedClaseId(claseId);
  };

  useEffect(() => {
    const loadHistorial = async () => {
      if (!classSheetOpen || classSheetContext !== "edit" || !selectedClase || !adminFranquiciaId) {
        setClaseHistorial([]);
        return;
      }
      const claseId = selectedClase.classId;
      if (!claseId) {
        setClaseHistorial([]);
        return;
      }
      setLoadingHistorial(true);
      const result = await getClaseHistorialAction({
        claseId,
        franquiciaId: adminFranquiciaId,
      });
      setLoadingHistorial(false);
      if (!result.ok) {
        setClaseHistorial([]);
        return;
      }
      setClaseHistorial(
        result.rows.map((r) => ({
          id: r.id,
          nombreAnterior: r.nombre_anterior,
          instructorAnterior: r.instructor_id_anterior,
          fechaHoraAnterior: r.fecha_hora_anterior,
          nombreNuevo: r.nombre_nuevo,
          instructorNuevo: r.instructor_id_nuevo,
          fechaHoraNuevo: r.fecha_hora_nuevo,
          editadoEn: r.editado_en,
        })),
      );
    };
    void loadHistorial();
  }, [adminFranquiciaId, classSheetContext, classSheetOpen, selectedClase]);

  const onConfirmar = () => {
    if (!selectedClase || !adminFranquiciaId || !currentSocioId || !selectedClase.classId) {
      toast.error("No se pudo identificar la clase para inscribirte");
      return;
    }
    const classId = selectedClase.classId;
    const socioId = currentSocioId;
    const confirmarInscripcion = async () => {
      const result = await inscribirSocioEnClase({
        claseId: classId,
        socioId,
      });
      if (!result.ok) {
        toast.error(result.error || "No se pudo confirmar la inscripción");
        return;
      }
      await reloadCalendarData();
      await mutateInscriptosClase();
      toast.success("Inscripción confirmada correctamente");
    };
    void confirmarInscripcion();
  };

  const onInscribirSocioAdministrativo = useCallback(() => {
    const classId = selectedClase?.classId ?? null;
    const operatorUserId = calendarContext?.userId ?? null;
    if (!classId || !socioInscripcionAdminId) {
      toast.error("Elegí una clase persistida y un socio para inscribir");
      return;
    }
    if (!operatorUserId) {
      toast.error("No se pudo identificar tu sesión");
      return;
    }
    if (!selectedClase || selectedClase.ocupados >= selectedClase.max) {
      toast.error("Cupo lleno");
      return;
    }
    const socioId = socioInscripcionAdminId;
    const run = async () => {
      setInscribiendoSocioAdmin(true);
      try {
        const result = await inscribirSocioEnClase({
          claseId: classId,
          socioId,
          operatorUserId,
        });
        if (!result.ok) {
          toast.error(result.error ?? "No se pudo inscribir al socio");
          return;
        }
        setSocioInscripcionAdminId("");
        await reloadCalendarData();
        await mutateInscriptosClase();
        toast.success("Socio inscripto correctamente");
      } finally {
        setInscribiendoSocioAdmin(false);
      }
    };
    void run();
  }, [
    calendarContext?.userId,
    mutateInscriptosClase,
    reloadCalendarData,
    selectedClase,
    socioInscripcionAdminId,
  ]);

  const socioEstaInhabilitado = useMemo(() => {
    const estado = String(currentSocioEstado ?? "").toLowerCase();
    return estado === "vencido" || estado === "inactivo";
  }, [currentSocioEstado]);

  const socioYaIncriptoEnClase = useMemo(() => {
    if (!currentSocioId) return false;
    return (inscriptosClaseData ?? []).some(
      (item: InscriptoClase) => item.socioId === currentSocioId,
    );
  }, [currentSocioId, inscriptosClaseData]);

  const claseSinCupo = useMemo(() => {
    if (!selectedClase) return false;
    return selectedClase.ocupados >= selectedClase.max;
  }, [selectedClase]);

  const estadoBotonInscripcion = useMemo<
    "ya-inscripto" | "cupo-lleno" | "socio-inhabilitado" | "ok"
  >(() => {
    if (socioYaIncriptoEnClase) return "ya-inscripto";
    if (claseSinCupo) return "cupo-lleno";
    if (socioEstaInhabilitado) return "socio-inhabilitado";
    return "ok";
  }, [claseSinCupo, socioEstaInhabilitado, socioYaIncriptoEnClase]);

  const minutosLimiteBajaInscripcion = calendarContext?.minutosLimiteBajaInscripcion ?? 30;

  const puedeDarDeBajaInscripcion = useMemo(() => {
    if (!socioYaIncriptoEnClase || !selectedClase?.classId || !selectedClase.fechaHora) {
      return false;
    }
    const inicioMs = Date.parse(selectedClase.fechaHora);
    if (!Number.isFinite(inicioMs)) return false;
    const limiteMs = Math.max(0, minutosLimiteBajaInscripcion) * 60 * 1000;
    return Date.now() < inicioMs - limiteMs;
  }, [
    minutosLimiteBajaInscripcion,
    selectedClase?.classId,
    selectedClase?.fechaHora,
    socioYaIncriptoEnClase,
  ]);

  const onDarDeBajaInscripcion = useCallback(() => {
    if (!calendarContext?.userId || !selectedClase?.classId) {
      toast.error("No se pudo identificar la clase o tu usuario");
      return;
    }
    const claseId = selectedClase.classId;
    const userId = calendarContext.userId;
    const ejecutar = async () => {
      setIsBajandoInscripcion(true);
      try {
        const result = await desinscribirSocioDeClaseAction({
          userId,
          claseId,
        });
        if (!result.ok) {
          toast.error(result.error ?? "No se pudo dar de baja");
          return;
        }
        await reloadCalendarData();
        await mutateInscriptosClase();
        toast.success("Te diste de baja de la clase");
      } finally {
        setIsBajandoInscripcion(false);
      }
    };
    void ejecutar();
  }, [
    calendarContext?.userId,
    mutateInscriptosClase,
    reloadCalendarData,
    selectedClase?.classId,
  ]);

  const confirmarClaseSheet = () => {
    if (isSavingClase) return;
    setClassSubmitAttempted(true);
    setClassSubmitError(null);
    setClassFieldErrors({});
    const hRaw = sheetHora.trim();
    const nombreClase = sheetNombreClase.trim();
    const daySchedule = selectedDayId ? schedulesConfig?.[selectedDayId] : null;
    const classSchema = z
      .object({
        nombre: z.string().trim().min(1, "Completá el nombre de la clase."),
        instructorId: z.string().trim().min(1, "Seleccioná un instructor."),
        hora: z
          .string()
          .trim()
          .regex(/^\d{2}:\d{2}$/, "Ingresá una hora válida (HH:mm)."),
      })
      .superRefine(({ hora }, ctx) => {
        const parsedTime = horaToTimeValue(hora);
        const start = toMinutes(parsedTime);
        const end = start + 60;
        const turnoMananaInicio = toMinutes("07:00");
        const turnoMananaFin = toMinutes("13:00");
        const turnoTardeInicio = toMinutes("15:00");
        const turnoTardeFin = toMinutes("21:00");
        const isWithinOpening =
          (start >= turnoMananaInicio && end <= turnoMananaFin) ||
          (start >= turnoTardeInicio && end <= turnoTardeFin);

        if (!isWithinOpening) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["hora"],
            message:
              "El horario debe estar entre las 07:00 y 13:00, o entre las 15:00 y 21:00.",
          });
        }
      });
    const parsed = classSchema.safeParse({
      nombre: nombreClase,
      instructorId: sheetInstructorId,
      hora: hRaw,
    });
    if (!parsed.success) {
      const nextErrors: Partial<Record<"nombre" | "instructorId" | "hora", string>> = {};
      const flattened = parsed.error.flatten().fieldErrors;
      if (flattened.nombre?.[0]) nextErrors.nombre = flattened.nombre[0];
      if (flattened.instructorId?.[0]) nextErrors.instructorId = flattened.instructorId[0];
      if (flattened.hora?.[0]) nextErrors.hora = flattened.hora[0];
      setClassFieldErrors(nextErrors);
      return;
    }

    const h = horaToTimeValue(parsed.data.hora);
    const cupo = Math.min(60, Math.max(1, Math.round(Number(sheetCupo) || capacidadTotal)));

    const fechaHora = `${selectedDateKey}T${h}:00`;
    const save = async () => {
      if (!adminFranquiciaId) return;
      setIsSavingClase(true);
      try {
        const supabase = createSupabaseClient();
        if (classSheetContext === "new") {
          const { error } = await supabase.from("clases").insert({
            nombre: toTitleCase(nombreClase),
            franquicia_id: adminFranquiciaId,
            instructor_id: sheetInstructorId,
            fecha_hora: fechaHora,
            cupo_maximo: cupo,
            reservas_actuales: 0,
            estado: "activa",
          });
          if (error) {
            toast.error("No se pudo guardar la clase");
            return;
          }
          toast.success("Clase creada correctamente");
        } else if (classSheetContext === "edit" && selectedClase) {
          let error: { message?: string } | null = null;
          if (editingClaseId) {
            const res = await updateClaseWithHistoryAction({
              claseId: editingClaseId,
              franquiciaId: adminFranquiciaId,
              nombre: toTitleCase(nombreClase),
              instructorId: sheetInstructorId,
              fechaHora,
              cupoMaximo: cupo,
            });
            error = res.ok ? null : { message: res.error };
          } else {
            const res = await supabase.from("clases").insert({
              nombre: toTitleCase(nombreClase),
              franquicia_id: adminFranquiciaId,
              instructor_id: sheetInstructorId,
              fecha_hora: fechaHora,
              cupo_maximo: cupo,
              reservas_actuales: 0,
              estado: "activa",
            });
            error = res.error;
          }
          if (error) {
            setClassSubmitError(error.message ?? "No se pudo editar la clase");
            toast.error("No se pudo editar la clase");
            return;
          }
          toast.success("Clase editada correctamente");
        }
        await reloadCalendarData();
        setEditingClaseId(null);
        closeClassSheet();
      } finally {
        setIsSavingClase(false);
      }
    };
    void save();
  };

  const cancelarClaseSeleccionada = () => {
    if (!selectedClase || !selectedClase.classId) {
      toast.error("Selecciona una instancia real de clase para cancelar");
      return;
    }
    const reservas = Math.max(0, selectedClase.ocupados);
    const shouldContinue =
      reservas > 0
        ? window.confirm(
            `Esta clase tiene ${reservas} reservas. Si la eliminas, se cancelarán las reservas de los socios. ¿Deseas continuar?`,
          )
        : true;
    if (!shouldContinue) return;
    const remove = async () => {
      const supabase = createSupabaseClient();
      let error: { message?: string } | null = null;
      const res = await supabase
        .from("clases")
        .update({ estado: "cancelada" })
        .eq("id", selectedClase.classId);
      error = res.error;
      if (error) {
        toast.error("No se pudo cancelar la clase");
        return;
      }
      await reloadCalendarData();
      setSelectedClaseId(null);
      toast.success("Clase cancelada correctamente");
    };
    void remove();
  };

  const sheetTitleText =
    classSheetContext === "edit" ? "EDITAR CLASE" : "NUEVA CLASE";

  return (
    <div>
      <h1 className={cn(PAGE_TITLE_CLASS, "mb-8")}>Calendario de Clases</h1>

      {role === "administracion" ? (
        <>
          {calendarContextError || calendarDataError ? (
            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              No se pudieron cargar los datos del calendario.
            </div>
          ) : null}
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
        </>
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
                    setSelectedClaseId(null);
                  }}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
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
                  locale={es}
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (!date) return;
                    setSelectedDate(date);
                    setSelectedClaseId(null);
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
            {isLoadingCalendar && !calendarData ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full bg-zinc-800" />
                <Skeleton className="h-20 w-full bg-zinc-800" />
              </div>
            ) : cuposPorClaseVisibles.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-center text-sm text-foreground/55">
                No hay clases programadas para este día. Configurá plantillas en Configuración o agregá una clase con el botón correspondiente.
              </p>
            ) : null}
            {cuposPorClaseVisibles.map(({ id, hora, max, ocupados, nombre, instructorId }) => {
              const isSelected = selectedClaseId === id;
              const porcentaje = max > 0 ? Math.min(100, Math.round((ocupados / max) * 100)) : 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectClase(id)}
                  className={cn(
                    "flex w-full cursor-pointer flex-row items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left transition-colors hover:bg-zinc-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
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
                    <p className="text-sm font-semibold text-zinc-100">
                      {nombre.trim() ? nombre : "Sin nombre"}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {instructorNombreById[instructorId] ?? "Sin instructor"}
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
                disabled={estadoBotonInscripcion !== "ok"}
                className={cn(
                  "h-11 w-full text-base font-semibold",
                  estadoBotonInscripcion === "ok" &&
                    "bg-secondary text-secondary-foreground hover:bg-secondary/90",
                  estadoBotonInscripcion === "ya-inscripto" &&
                    "border border-secondary bg-secondary/10 text-secondary opacity-100 hover:bg-secondary/10",
                  estadoBotonInscripcion === "cupo-lleno" &&
                    "bg-zinc-700 text-zinc-300 hover:bg-zinc-700",
                  estadoBotonInscripcion === "socio-inhabilitado" &&
                    "bg-zinc-700 text-zinc-300 hover:bg-zinc-700",
                )}
              >
                {estadoBotonInscripcion === "ya-inscripto" ? (
                  <>
                    <CheckCircle2 className="size-4" aria-hidden />
                    Ya inscripto
                  </>
                ) : estadoBotonInscripcion === "cupo-lleno" ? (
                  "Cupo lleno"
                ) : estadoBotonInscripcion === "socio-inhabilitado" ? (
                  "Socio inhabilitado"
                ) : (
                  "Confirmar Inscripción"
                )}
              </Button>
              {estadoBotonInscripcion === "socio-inhabilitado" ? (
                <p className="mt-3 text-sm text-red-400">
                  No se puede inscribir porque su cuota está vencida o pendiente de pago.
                </p>
              ) : null}
              <p
                className={cn(
                  "mt-3 flex items-center gap-2 text-sm",
                  estadoBotonInscripcion === "ya-inscripto"
                    ? "text-secondary"
                    : "text-foreground/65"
                )}
              >
                {estadoBotonInscripcion === "ya-inscripto" ? (
                  <>
                    <CheckCircle2 className="size-4" aria-hidden />
                    Te anotaste a la clase de las {selectedClase.hora}.
                  </>
                ) : (
                  "Confirma para reservar tu lugar en este horario."
                )}
              </p>
              {estadoBotonInscripcion === "ya-inscripto" && selectedClase.classId ? (
                <div className="mt-4 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full border-zinc-600 text-zinc-200 hover:bg-zinc-800"
                    disabled={!puedeDarDeBajaInscripcion || isBajandoInscripcion}
                    onClick={onDarDeBajaInscripcion}
                  >
                    {isBajandoInscripcion ? "Procesando…" : "Darme de baja"}
                  </Button>
                  {!puedeDarDeBajaInscripcion ? (
                    <p className="text-center text-xs text-zinc-500">
                      Ya no podés anular: faltan menos de {minutosLimiteBajaInscripcion} minutos
                      para el inicio de la clase.
                    </p>
                  ) : null}
                </div>
              ) : estadoBotonInscripcion === "ya-inscripto" && !selectedClase.classId ? (
                <p className="mt-3 text-xs text-zinc-500">
                  Para gestionar la baja, elegí la clase con cupo confirmado en el sistema.
                </p>
              ) : null}
            </div>
          ) : null}

          {role === "administracion" ? (
            <div className="mt-auto flex flex-wrap gap-2 pt-7">
              <Button
                type="button"
                onClick={openEditClassSheet}
                disabled={!selectedClaseId}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Pencil className="size-4" aria-hidden />
                Editar Clase
              </Button>
              <Button
                type="button"
                onClick={cancelarClaseSeleccionada}
                disabled={!selectedClaseId}
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
                Crear clase
              </Button>
            </div>
          ) : null}
        </section>

        {role === "administracion" ? (
          <section className="flex h-full flex-col rounded-2xl border border-zinc-800/50 bg-card p-4 md:p-7">
            <div className="flex items-center justify-between gap-3">
              <SectionHeading as="h3">Socios Inscriptos</SectionHeading>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
              <p className={cn(LABEL_TECH, "mb-3")}>Inscribir socio</p>
              {sociosInscripcionAdminError ? (
                <p className="text-sm text-red-400">No se pudo cargar el listado de socios.</p>
              ) : null}
              {!selectedClaseId ? (
                <p className="text-sm text-zinc-500">Seleccioná una clase en el calendario.</p>
              ) : !selectedClase?.classId ? (
                <p className="text-sm text-zinc-500">
                  Esta instancia aún no tiene registro persistido; no se puede inscribir desde acá.
                </p>
              ) : claseCupoLlenoAdmin ? (
                <p className="text-sm text-amber-200/90">Cupo lleno: no se pueden agregar más inscriptos.</p>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="admin-inscripcion-socio" className="text-xs text-zinc-400">
                      Socio
                    </Label>
                    <Select
                      value={socioInscripcionAdminId || undefined}
                      onValueChange={setSocioInscripcionAdminId}
                      disabled={
                        isLoadingSociosInscripcionAdmin ||
                        inscribiendoSocioAdmin ||
                        sociosInscribiblesParaAdmin.length === 0
                      }
                    >
                      <SelectTrigger
                        id="admin-inscripcion-socio"
                        className="border-zinc-800 bg-zinc-950 text-zinc-100"
                      >
                        <SelectValue placeholder="Elegí un socio" />
                      </SelectTrigger>
                      <SelectContent>
                        {sociosInscribiblesParaAdmin.map((s) => {
                          const estado = String(s.estado ?? "").toLowerCase();
                          const sufijo =
                            estado === "vencido" || estado === "inactivo" ? ` — ${estado}` : "";
                          return (
                            <SelectItem key={s.id} value={s.id}>
                              {s.nombre}
                              {sufijo}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {!isLoadingSociosInscripcionAdmin &&
                    (sociosInscripcionAdminData?.length ?? 0) > 0 &&
                    sociosInscribiblesParaAdmin.length === 0 ? (
                      <p className="text-xs text-zinc-500">Todos los socios de la franquicia ya están inscriptos.</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={
                      !socioInscripcionAdminId ||
                      !calendarContext?.userId ||
                      inscribiendoSocioAdmin ||
                      isLoadingSociosInscripcionAdmin ||
                      sociosInscribiblesParaAdmin.length === 0
                    }
                    onClick={onInscribirSocioAdministrativo}
                  >
                    <UserPlus className="size-4" aria-hidden />
                    {inscribiendoSocioAdmin ? "Inscribiendo…" : "Inscribir"}
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-4">
              {selectedClaseId ? (
                selectedClase?.classId ? (
                  isLoadingInscriptosClase ? (
                    <p className="rounded-lg border border-white/10 bg-black/10 px-3 py-3 text-sm text-foreground/70">
                      Cargando inscriptos...
                    </p>
                  ) : inscriptosError ? (
                    <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-3 text-sm text-red-200">
                      No se pudo cargar el listado de inscriptos.
                    </p>
                  ) : (inscriptosClaseData ?? []).length > 0 ? (
                  <ul className="space-y-2">
                    {(inscriptosClaseData ?? []).map((item) => (
                      <li
                        key={item.socioId}
                        className="rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm"
                      >
                        {item.nombre}
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
                    Esta instancia aún no tiene registro persistido.
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
                {" "}
                Los cambios permanentes de la serie se realizan desde Configuración.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-1 py-6">
              {classSubmitError ? (
                <p className="text-sm text-red-500">{classSubmitError}</p>
              ) : null}
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
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                  />
                )}
                {classSubmitAttempted && classFieldErrors.nombre ? (
                  <p className="text-sm text-red-500">{classFieldErrors.nombre}</p>
                ) : null}
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
                {classSubmitAttempted && classFieldErrors.instructorId ? (
                  <p className="text-sm text-red-500">{classFieldErrors.instructorId}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sheet-hora" className={LABEL_TECH}>
                  Hora
                </Label>
                {classSheetContext === "edit" ? (
                  <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-400">
                    {sheetHora}
                  </div>
                ) : (
                  <Input
                    id="sheet-hora"
                    type="time"
                    step={1800}
                    value={sheetHora}
                    onChange={(e) => setSheetHora(e.target.value)}
                    className="border-zinc-800 bg-zinc-900 text-zinc-100"
                  />
                )}
                {classSheetContext === "edit" ? (
                  <p className="text-sm text-zinc-500 italic">
                    El horario no se puede modificar. Para cambiarlo, cancela esta clase y crea una nueva.
                  </p>
                ) : null}
                {classSubmitAttempted && classFieldErrors.hora ? (
                  <p className="text-sm text-red-500">{classFieldErrors.hora}</p>
                ) : null}
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
            {classSheetContext === "edit" ? (
              <div className="space-y-2 border-t border-zinc-800/50 pt-4">
                <p className={LABEL_TECH}>Historial de cambios</p>
                {loadingHistorial ? (
                  <p className="text-sm text-zinc-500">Cargando historial...</p>
                ) : claseHistorial.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sin registros anteriores.</p>
                ) : (
                  <ul className="space-y-2">
                    {claseHistorial.map((h) => {
                      const when = h.editadoEn
                        ? new Intl.DateTimeFormat("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }).format(new Date(h.editadoEn))
                        : "—";
                      const instructorAntes =
                        (h.instructorAnterior && instructorNombreById[h.instructorAnterior]) ||
                        "Sin instructor";
                      const instructorDespues =
                        (h.instructorNuevo && instructorNombreById[h.instructorNuevo]) ||
                        "Sin instructor";
                      return (
                        <li
                          key={h.id}
                          className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-xs text-zinc-300"
                        >
                          El {when}, el instructor cambió de "{instructorAntes}" a "
                          {instructorDespues}" ({h.nombreAnterior} {timeValueFromDateTime(h.fechaHoraAnterior)} {"->"} {h.nombreNuevo} {timeValueFromDateTime(h.fechaHoraNuevo)}).
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
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
                disabled={!sheetNombreClase.trim() || !sheetInstructorId || isSavingClase}
                className="bg-[#5ab253] font-semibold text-white hover:bg-[#5ab253]/90"
              >
                {classSheetContext === "edit" || editingClaseId
                  ? "Guardar cambios"
                  : "Crear clase"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
