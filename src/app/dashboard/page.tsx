"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Clock,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeading } from "@/components/SectionHeading";
import {
  KPI_TITLE_CLASS,
  PAGE_TITLE_CLASS,
} from "@/lib/headings";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  getDashboardChartData,
  getDashboardKPIs,
  getDashboardProximosVencimientos,
  getDashboardUltimosMovimientos,
} from "@/actions/dashboard";

type Role = "admin" | "socio";

const COLOR_INGRESO = "#5ab253";
const COLOR_EGRESO = "#e41b68";

const FONT_UI =
  "var(--font-sans), ui-sans-serif, system-ui, sans-serif";

type ProximoVencimientoRow = {
  id: string;
  concepto: string;
  descripcion: string;
  total: number;
  fecha: string;
};

type ChartMonthRow = { name: string; ingresos: number; egresos: number };

type MovimientoResumen = {
  id: string;
  positive: boolean;
  monto: number;
  categoria: string;
  detalle: string;
};

function formatPesos(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DashboardPage() {
  const [role] = useState<Role>(() => {
    if (typeof window === "undefined") return "admin";
    const sessionRole = window.sessionStorage.getItem("userRole");
    if (sessionRole === "admin" || sessionRole === "socio") return sessionRole;
    const legacyRole = window.localStorage.getItem("jumpingClubRole");
    if (legacyRole === "administracion") return "admin";
    if (legacyRole === "socio") return "socio";
    return "admin";
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const swrSilentOptions = {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  } as const;

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    };
    void loadUser();
  }, []);

  const { data: kpisData, isLoading: isLoadingKpis, error: kpisError } = useSWR(
    currentUserId ? ["dashboard-kpis", currentUserId] : null,
    async () => {
      const result = await getDashboardKPIs(currentUserId!);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    swrSilentOptions,
  );

  const { data: vencimientosData, isLoading: isLoadingVencimientos, error: vencimientosError } = useSWR(
    currentUserId ? ["dashboard-vencimientos", currentUserId] : null,
    async () => {
      const result = await getDashboardProximosVencimientos(currentUserId!, 5);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    swrSilentOptions,
  );

  const { data: chartDataResponse, isLoading: isLoadingChart, error: chartError } = useSWR(
    currentUserId ? ["dashboard-chart", currentUserId] : null,
    async () => {
      const result = await getDashboardChartData(currentUserId!);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    swrSilentOptions,
  );

  const { data: movimientosData, isLoading: isLoadingMovimientos, error: movimientosError } = useSWR(
    currentUserId ? ["dashboard-movimientos", currentUserId] : null,
    async () => {
      const result = await getDashboardUltimosMovimientos(currentUserId!, 5);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    swrSilentOptions,
  );

  const proximosVencimientos: ProximoVencimientoRow[] = vencimientosData ?? [];
  const chartData: ChartMonthRow[] = chartDataResponse ?? [];
  const movimientos: MovimientoResumen[] = useMemo(
    () =>
      (movimientosData ?? []).map((item) => ({
        id: item.id,
        positive: item.tipo === "ingreso",
        monto: item.monto,
        categoria: item.tipo === "ingreso" ? "Ingreso" : "Egreso",
        detalle: item.descripcion?.trim() ? `${item.concepto} · ${item.descripcion}` : item.concepto,
      })),
    [movimientosData],
  );
  const tieneDatosGrafico = chartData.length > 0;

  return (
    <div className="min-w-0 font-sans">
      <h1 className={cn(PAGE_TITLE_CLASS, "mb-8")}>Dashboard</h1>

      {role === "admin" ? (
        <div className="mt-8 space-y-6 md:space-y-8">
          {kpisError || vencimientosError || chartError || movimientosError ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              Ocurrió un error cargando el dashboard.
            </div>
          ) : null}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            <article className="rounded-2xl border border-zinc-800/50 bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={KPI_TITLE_CLASS}>Ingresos</p>
                  <div
                    suppressHydrationWarning={true}
                    className="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-[#5ab253]"
                  >
                    {isLoadingKpis && !kpisData ? (
                      <Skeleton className="h-9 w-28 bg-zinc-800" />
                    ) : (
                      formatPesos(kpisData?.ingresos ?? 0)
                    )}
                  </div>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#5ab253]/35 bg-[#5ab253]/12 p-2.5">
                  <TrendingUp className="size-5 text-[#5ab253]" aria-hidden />
                </div>
              </div>
            </article>
            <article className="rounded-2xl border border-zinc-800/50 bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={KPI_TITLE_CLASS}>Egresos</p>
                  <div
                    suppressHydrationWarning={true}
                    className="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-[#e41b68]"
                  >
                    {isLoadingKpis && !kpisData ? (
                      <Skeleton className="h-9 w-28 bg-zinc-800" />
                    ) : (
                      formatPesos(kpisData?.egresos ?? 0)
                    )}
                  </div>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e41b68]/35 bg-[#e41b68]/12 p-2.5">
                  <TrendingDown className="size-5 text-[#e41b68]" aria-hidden />
                </div>
              </div>
            </article>
            <article className="rounded-2xl border border-zinc-800/50 bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={KPI_TITLE_CLASS}>Próxima clase</p>
                  {isLoadingKpis && !kpisData ? (
                    <div className="mt-2 space-y-2">
                      <Skeleton className="h-6 w-44 bg-zinc-800" />
                      <Skeleton className="h-4 w-36 bg-zinc-800" />
                    </div>
                  ) : kpisData?.proximaClase ? (
                    <>
                      <p className="mt-2 text-lg font-semibold text-zinc-100">
                        {kpisData.proximaClase.nombre}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {new Date(kpisData.proximaClase.fechaHora).toLocaleString("es-AR", {
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {kpisData.proximaClase.instructor
                          ? ` · ${kpisData.proximaClase.instructor}`
                          : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-lg font-semibold text-zinc-100">—</p>
                      <p className="mt-1 text-sm text-zinc-400">Sin datos suficientes</p>
                    </>
                  )}
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e41b68]/35 bg-[#e41b68]/12 p-2.5">
                  <Calendar className="size-5 text-[#e41b68]" aria-hidden />
                </div>
              </div>
            </article>
          </section>
          <article className="rounded-2xl border border-zinc-800/50 bg-card p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <SectionHeading as="h3">Próximos Vencimientos</SectionHeading>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" className="border-zinc-700 bg-transparent">
                  <Link href="/administracion">Ir a Administración</Link>
                </Button>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-400/35 bg-amber-400/12">
                  <Clock className="size-4 text-amber-400" aria-hidden />
                </div>
              </div>
            </div>
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
                  {isLoadingVencimientos && proximosVencimientos.length === 0 ? (
                    [...Array.from({ length: 3 })].map((_, idx) => (
                      <tr key={`sk-venc-${idx}`}>
                        <td className="px-3 py-3"><Skeleton className="h-4 w-24 bg-zinc-800" /></td>
                        <td className="px-3 py-3"><Skeleton className="h-4 w-32 bg-zinc-800" /></td>
                        <td className="px-3 py-3 text-right"><Skeleton className="ml-auto h-4 w-20 bg-zinc-800" /></td>
                        <td className="px-3 py-3 text-right"><Skeleton className="ml-auto h-4 w-20 bg-zinc-800" /></td>
                      </tr>
                    ))
                  ) : proximosVencimientos.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-10 text-center text-sm text-zinc-500"
                      >
                        Sin datos suficientes
                      </td>
                    </tr>
                  ) : (
                    proximosVencimientos.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-zinc-800/40 last:border-b-0"
                      >
                        <td className="px-3 py-2 text-zinc-100">{item.concepto}</td>
                        <td className="px-3 py-2 text-zinc-400">{item.descripcion}</td>
                        <td className="px-3 py-2 text-right font-semibold text-zinc-100">
                          {formatPesos(item.total)}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-400">
                          {item.fecha
                            ? new Date(`${item.fecha}T00:00:00`).toLocaleDateString("es-AR")
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </article>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <article className="min-w-0 rounded-2xl border border-zinc-800/50 bg-card p-5 md:p-6 lg:col-span-2">
              <SectionHeading>Ingresos vs Egresos</SectionHeading>
              <p className="mt-1 text-sm text-foreground/70">
                Comparativa de los últimos 6 meses
              </p>
              <div className="mt-4 h-[300px] w-full min-w-0 sm:h-[320px]">
                {tieneDatosGrafico ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...chartData]}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(0 0% 100% / 8%)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{
                          fill: "hsl(215 20% 72%)",
                          fontSize: 12,
                          fontFamily: FONT_UI,
                        }}
                        axisLine={{ stroke: "hsl(0 0% 100% / 12%)" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{
                          fill: "hsl(215 20% 72%)",
                          fontSize: 11,
                          fontFamily: FONT_UI,
                        }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) =>
                          v >= 1_000_000
                            ? `$${(v / 1_000_000).toFixed(1)}M`
                            : `$${Math.round(v / 1000)}k`
                        }
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(0 0% 100% / 4%)" }}
                        contentStyle={{
                          backgroundColor: "hsl(222 34% 12%)",
                          border: "1px solid hsl(0 0% 100% / 12%)",
                          borderRadius: "0.75rem",
                          color: "hsl(210 20% 96%)",
                          fontFamily: FONT_UI,
                          fontSize: 13,
                        }}
                        labelStyle={{
                          color: "hsl(215 20% 80%)",
                          fontFamily: FONT_UI,
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                        itemStyle={{
                          fontFamily: FONT_UI,
                          fontSize: 13,
                        }}
                        formatter={(val, name) => {
                          const n =
                            typeof val === "number"
                              ? val
                              : Number(val ?? 0);
                          const key = String(name);
                          return [
                            formatPesos(Number.isFinite(n) ? n : 0),
                            key === "ingresos" ? "Ingresos" : "Egresos",
                          ];
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          paddingTop: 16,
                          fontFamily: FONT_UI,
                          fontSize: 13,
                          color: "hsl(215 20% 78%)",
                        }}
                        formatter={(value) =>
                          value === "ingresos" ? "Ingresos" : "Egresos"
                        }
                      />
                      <Bar
                        dataKey="ingresos"
                        name="ingresos"
                        fill={COLOR_INGRESO}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={36}
                      />
                      <Bar
                        dataKey="egresos"
                        name="egresos"
                        fill={COLOR_EGRESO}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : isLoadingChart ? (
                  <div
                    className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 text-sm text-foreground/50"
                    aria-hidden
                  >
                    <Skeleton className="h-[220px] w-full bg-zinc-800" />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 px-4 text-center text-sm text-foreground/50">
                    Sin datos suficientes
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-zinc-800/50 bg-card p-5 md:p-6 lg:col-span-1">
              <SectionHeading>Últimos Movimientos</SectionHeading>
              <p className="mt-1 text-sm text-foreground/65">
                Entradas y salidas recientes
              </p>
              <ul className="mt-4 space-y-2">
                {movimientos.length === 0 ? (
                  isLoadingMovimientos ? (
                    [...Array.from({ length: 3 })].map((_, idx) => (
                      <li key={`sk-mov-${idx}`} className="rounded-xl border border-white/10 bg-black/15 px-3 py-3">
                        <Skeleton className="h-4 w-28 bg-zinc-800" />
                        <Skeleton className="mt-2 h-4 w-44 bg-zinc-800" />
                      </li>
                    ))
                  ) : (
                    <li className="rounded-xl border border-dashed border-white/10 bg-black/10 px-3 py-6 text-center text-sm text-foreground/50">
                      Sin datos suficientes
                    </li>
                  )
                ) : (
                  movimientos.map((mov) => (
                    <li
                      key={mov.id}
                      className="rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wide text-foreground/55">
                            {mov.categoria}
                          </p>
                          <p className="mt-0.5 truncate text-foreground/85">
                            {mov.detalle}
                          </p>
                        </div>
                        <p
                          className={`shrink-0 font-semibold tabular-nums ${
                            mov.positive ? "text-[#5ab253]" : "text-[#e41b68]"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {mov.positive ? (
                              <ArrowUpRight className="size-4" aria-hidden />
                            ) : (
                              <ArrowDownLeft className="size-4" aria-hidden />
                            )}
                            {formatPesos(mov.monto)}
                          </span>
                        </p>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </article>
          </section>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_1fr]">
          <section className="rounded-2xl border border-zinc-800/50 bg-card p-4 md:p-8">
            <SectionHeading>¡Hola! Listo para saltar?</SectionHeading>
            <p className="mt-2 text-sm text-zinc-500">
              Tu energía de hoy arranca con una buena clase. Reserva en segundos.
            </p>

            <div className="mt-6 rounded-xl border border-secondary/30 bg-zinc-900 p-5">
              <p className={KPI_TITLE_CLASS}>Próxima clase</p>
              <p className="mt-2 text-lg font-semibold leading-tight text-zinc-100">—</p>
              <p className="mt-1 text-sm text-foreground/75">Sin datos suficientes</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/calendario">Reservar Clase</Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              >
                <Link href="/perfil">Ver mi perfil</Link>
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800/50 bg-card p-6">
            <SectionHeading as="h3">Tu actividad</SectionHeading>
            <div className="mt-4 space-y-2 text-sm">
              <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2">
                Asistencia del mes:{" "}
                <span className="font-semibold text-secondary">—</span>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2">
                Próximo vencimiento: <span className="font-semibold">—</span>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2">
                Plan actual: <span className="font-semibold">—</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
