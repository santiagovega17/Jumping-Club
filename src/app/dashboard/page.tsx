"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/SectionHeading";
import { KPI_TITLE_CLASS, PAGE_TITLE_CLASS } from "@/lib/headings";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { SucursalDashboardOverview } from "@/components/dashboard/SucursalDashboardOverview";

type Role = "admin" | "socio";

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

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem("jumpingClubUserId");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const id = user?.id ?? null;
      setCurrentUserId(id);
      if (typeof window === "undefined") return;
      if (id) {
        sessionStorage.setItem("jumpingClubUserId", id);
      } else {
        sessionStorage.removeItem("jumpingClubUserId");
      }
    };
    void loadUser();
  }, []);

  return (
    <div className="min-w-0 font-sans">
      <h1 className={cn(PAGE_TITLE_CLASS, "mb-8")}>Dashboard</h1>

      {role === "admin" ? (
        <SucursalDashboardOverview userId={currentUserId} />
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
