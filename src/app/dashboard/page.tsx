"use client";

import Link from "next/link";
import {
  Calendar,
  Clock,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/SectionHeading";
import {
  KPI_TITLE_CLASS,
  PAGE_SUBTITLE_CLASS,
  PAGE_TITLE_CLASS,
} from "@/lib/headings";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
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

type Role = "admin" | "socio";

const COLOR_INGRESO = "#5ab253";
const COLOR_EGRESO = "#e41b68";

const FONT_UI =
  "var(--font-sans), ui-sans-serif, system-ui, sans-serif";

const proximosVencimientos = [
  {
    concepto: "Sueldos",
    descripcion: "Profesores",
    total: 120000,
    fecha: "2026-04-25",
  },
  {
    concepto: "Servicios",
    descripcion: "Luz",
    total: 32000,
    fecha: "2026-04-26",
  },
  {
    concepto: "Servicios",
    descripcion: "Alquiler",
    total: 105000,
    fecha: "2026-04-28",
  },
] as const;

const chartData = [
  { mes: "Nov", ingresos: 780000, egresos: 210000 },
  { mes: "Dic", ingresos: 890000, egresos: 245000 },
  { mes: "Ene", ingresos: 920000, egresos: 265000 },
  { mes: "Feb", ingresos: 980000, egresos: 290000 },
  { mes: "Mar", ingresos: 1150000, egresos: 305000 },
  { mes: "Abr", ingresos: 1250000, egresos: 320000 },
] as const;

const movimientos = [
  {
    positive: true,
    monto: "+ $25.000",
    categoria: "Cuotas",
    detalle: "Santiago Vega",
  },
  {
    positive: false,
    monto: "- $15.000",
    categoria: "Mantenimiento",
    detalle: "Equipamiento",
  },
  {
    positive: true,
    monto: "+ $14.500",
    categoria: "Cuotas",
    detalle: "Martina García",
  },
  {
    positive: false,
    monto: "- $32.000",
    categoria: "Servicios",
    detalle: "Limpieza mensual",
  },
  {
    positive: true,
    monto: "+ $39.000",
    categoria: "Cuotas",
    detalle: "Trimestral — Sofía Mena",
  },
] as const;

function formatPesos(value: number) {
  return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
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

  const [chartReady, setChartReady] = useState(false);
  useEffect(() => {
    setChartReady(true);
  }, []);

  return (
    <div className="min-w-0 font-sans">
      <h1 className={PAGE_TITLE_CLASS}>Dashboard</h1>
      <p className={PAGE_SUBTITLE_CLASS}>
        {role === "admin"
          ? "Resumen financiero y operativo de Jumping Club."
          : "Tu panel rápido para reservar y seguir tu actividad."}
      </p>

      {role === "admin" ? (
        <div className="mt-8 space-y-6 md:space-y-8">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            <article className="rounded-2xl border border-zinc-800/50 bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={KPI_TITLE_CLASS}>Ingresos</p>
                  <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-[#5ab253]">
                    $1.250.000
                  </p>
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
                  <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-[#e41b68]">
                    $320.000
                  </p>
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
                  <p className="mt-2 text-lg font-semibold text-zinc-100">19:30 HS</p>
                  <p className="mt-1 text-sm text-zinc-400">15/20 inscriptos</p>
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
                  {proximosVencimientos.map((item) => (
                    <tr key={`${item.concepto}-${item.descripcion}`} className="border-b border-zinc-800/40 last:border-b-0">
                      <td className="px-3 py-2 text-zinc-100">{item.concepto}</td>
                      <td className="px-3 py-2 text-zinc-400">{item.descripcion}</td>
                      <td className="px-3 py-2 text-right font-semibold text-zinc-100">
                        {formatPesos(item.total)}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-400">{item.fecha}</td>
                    </tr>
                  ))}
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
                {chartReady ? (
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
                        dataKey="mes"
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
                ) : (
                  <div
                    className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 text-sm text-foreground/50"
                    aria-hidden
                  >
                    Preparando gráfico…
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
                {movimientos.map((mov) => (
                  <li
                    key={`${mov.monto}-${mov.detalle}`}
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
                        {mov.monto}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_1fr]">
          <section className="rounded-2xl border border-zinc-800/50 bg-card p-4 md:p-8">
            <SectionHeading>¡Hola, Santiago! Listo para saltar?</SectionHeading>
            <p className="mt-2 text-sm text-zinc-500">
              Tu energía de hoy arranca con una buena clase. Reserva en segundos.
            </p>

            <div className="mt-6 rounded-xl border border-secondary/30 bg-zinc-900 p-5">
              <p className={KPI_TITLE_CLASS}>Próxima clase</p>
              <p className="mt-2 text-lg font-semibold leading-tight text-zinc-100">18:00 HS</p>
              <p className="mt-1 text-sm text-foreground/75">18/20 inscriptos</p>
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
                Asistencia del mes: <span className="font-semibold text-secondary">9 clases</span>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2">
                Próximo vencimiento: <span className="font-semibold">30/06/2026</span>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2">
                Plan actual: <span className="font-semibold">Mensual Premium</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
