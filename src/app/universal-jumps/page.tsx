import Link from "next/link";
import { ArrowRight, Eye, Users } from "lucide-react";
import { getUniversalJumpsDashboardData } from "@/actions/universal-jumps";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KPI_TITLE_CLASS, PAGE_SUBTITLE_CLASS, PAGE_TITLE_CLASS } from "@/lib/headings";
import { cn } from "@/lib/utils";

function formatPesos(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function UniversalJumpsDashboardPage() {
  const result = await getUniversalJumpsDashboardData();

  if (!result.ok) {
    return (
      <div className="space-y-6 md:space-y-8">
        <header className="rounded-2xl border border-violet-500/25 bg-zinc-900/70 px-5 py-4 md:px-6">
          <h1 className={cn(PAGE_TITLE_CLASS, "text-zinc-50")}>Dashboard Franquicias</h1>
          <p className={cn(PAGE_SUBTITLE_CLASS, "text-zinc-300/80")}>
            Vista global de sucursales habilitadas para Universal Jumps.
          </p>
        </header>
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          No se pudieron cargar los datos del dashboard: {result.error}
        </div>
      </div>
    );
  }

  const { totalFranquiciasActivas, totalSociosGlobales, ingresosGlobalesMes, sucursales } =
    result.data;

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="rounded-2xl border border-violet-500/25 bg-zinc-900/70 px-5 py-4 md:px-6">
        <h1 className={cn(PAGE_TITLE_CLASS, "text-zinc-50")}>Dashboard Franquicias</h1>
        <p className={cn(PAGE_SUBTITLE_CLASS, "text-zinc-300/80")}>
          Vista global de sucursales habilitadas para Universal Jumps.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border border-zinc-800 bg-card/95">
          <CardHeader className="pb-2">
            <p className={KPI_TITLE_CLASS}>Total Franquicias Activas</p>
            <CardTitle className="text-3xl font-semibold text-zinc-100 tabular-nums">
              {totalFranquiciasActivas}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border border-zinc-800 bg-card/95">
          <CardHeader className="pb-2">
            <p className={KPI_TITLE_CLASS}>Total Socios Globales</p>
            <CardTitle className="text-3xl font-semibold text-zinc-100 tabular-nums">
              {totalSociosGlobales}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border border-zinc-800 bg-card/95">
          <CardHeader className="pb-2">
            <p className={KPI_TITLE_CLASS}>Ingresos Globales del Mes</p>
            <CardTitle className="text-3xl font-semibold text-zinc-100 tabular-nums">
              {formatPesos(ingresosGlobalesMes)}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card className="border border-zinc-800 bg-card/95 py-0">
        <CardHeader className="border-b border-zinc-800 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-zinc-100">
                Franquicias habilitadas
              </CardTitle>
              <p className="mt-1 text-sm text-zinc-400">
                Estado consolidado y acceso rápido a cada sucursal.
              </p>
            </div>
            <Badge variant="outline" className="border-violet-400/45 text-violet-200">
              <Users className="size-3.5" aria-hidden />
              Global
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="px-4 py-3 text-zinc-400">Nombre de Sucursal</TableHead>
                <TableHead className="px-4 py-3 text-zinc-400">Estado</TableHead>
                <TableHead className="px-4 py-3 text-right text-zinc-400">
                  Cantidad de Socios
                </TableHead>
                <TableHead className="px-4 py-3 text-right text-zinc-400">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sucursales.map((sucursal) => (
                <TableRow key={sucursal.id} className="border-zinc-800/80">
                  <TableCell className="px-4 py-3 font-medium text-zinc-100">
                    {sucursal.nombreSucursal}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge
                      variant={sucursal.estado === "Activa" ? "success" : "pending"}
                      className="w-fit"
                    >
                      {sucursal.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums text-zinc-200">
                    {sucursal.cantidadSocios}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 bg-transparent hover:bg-zinc-800"
                    >
                      <Link href={`/universal-jumps/sucursal/${sucursal.id}`}>
                        <Eye className="size-4" aria-hidden />
                        Ver Sucursal
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
