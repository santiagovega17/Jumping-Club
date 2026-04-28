"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Eye } from "lucide-react";
import { getFranquiciaDetalleByIdAction } from "@/actions/franquicia";
import { SucursalDashboardOverview } from "@/components/dashboard/SucursalDashboardOverview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PAGE_SUBTITLE_CLASS, PAGE_TITLE_CLASS } from "@/lib/headings";
import { cn } from "@/lib/utils";

export default function UniversalJumpsSucursalPage() {
  const params = useParams<{ id: string }>();
  const franquiciaId = params?.id ?? "";

  const { data: franquicia, isLoading } = useSWR(
    franquiciaId ? ["universal-jumps-franquicia-detalle", franquiciaId] : null,
    async () => {
      const result = await getFranquiciaDetalleByIdAction(franquiciaId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    { revalidateOnFocus: false },
  );

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-violet-500/25 bg-zinc-900/70 px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className={cn(PAGE_TITLE_CLASS, "text-zinc-50")}>
              {isLoading ? "Cargando sucursal..." : franquicia?.nombre ?? "Sucursal"}
            </h1>
            <p className={cn(PAGE_SUBTITLE_CLASS, "text-zinc-300/80")}>
              {isLoading
                ? "Preparando vista de detalle."
                : franquicia?.direccion
                  ? `Modo espectador · ${franquicia.direccion}`
                  : "Modo espectador · Solo lectura"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-violet-400/45 text-violet-200">
              <Eye className="size-3.5" aria-hidden />
              Modo Espectador
            </Badge>
            <Button
              asChild
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-800"
            >
              <Link href="/universal-jumps">
                <ArrowLeft className="size-4" aria-hidden />
                Volver a Franquicias
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {franquiciaId ? <SucursalDashboardOverview franquiciaId={franquiciaId} isReadOnly={true} /> : null}
    </div>
  );
}
