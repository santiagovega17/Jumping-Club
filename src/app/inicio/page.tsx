"use client";

import Link from "next/link";
import { Calendar, Clock3, User } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { PAGE_SUBTITLE_CLASS, PAGE_TITLE_CLASS } from "@/lib/headings";

export default function InicioSocioPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className={PAGE_TITLE_CLASS}>
          ¡Hola, Santiago! Prepárate para saltar.
        </h1>
        <p className={PAGE_SUBTITLE_CLASS}>
          Tu panel personal para organizar clases y seguir tu plan.
        </p>
      </div>

      <section className="glass mt-8 rounded-2xl p-5 md:p-6">
        <SectionHeading>Accesos Rápidos</SectionHeading>
        <div className="mt-4 flex flex-col gap-4">
          <Button
            asChild
            className="glass h-14 w-full justify-start rounded-xl bg-primary text-base text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/calendario">
              <Calendar className="size-5 text-primary-foreground" aria-hidden />
              Reservar Clase
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="glass h-14 w-full justify-start rounded-xl border-zinc-800/50 bg-zinc-950/30 text-base text-zinc-100 hover:bg-zinc-900/50"
          >
            <Link href="/perfil">
              <User className="size-5 text-zinc-200" aria-hidden />
              Mi Perfil
            </Link>
          </Button>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 md:gap-6">
        <section className="glass rounded-2xl p-6">
          <SectionHeading>Próxima Clase</SectionHeading>
          <p className="mt-1 text-sm text-zinc-500">
            Recordatorio del próximo turno.
          </p>
          <div className="mt-4 rounded-xl border border-zinc-800/50 bg-zinc-950/40 p-5">
            <p className="text-sm font-medium uppercase tracking-wider text-zinc-400">
              Hoy · 18:00 hs
            </p>
            <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-100">
              Jumping Fitness
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-500">
              <Clock3 className="size-4 text-primary" aria-hidden />
              Faltan 2h 15m para el inicio
            </p>
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <SectionHeading>Estado del Plan</SectionHeading>
          <p className="mt-1 text-sm text-zinc-500">
            Resumen de tu membresía.
          </p>
          <div className="mt-5 flex items-center justify-center">
            <div className="flex size-36 flex-col items-center justify-center rounded-full border border-zinc-800/50 bg-zinc-950/40 text-center">
              <span className="text-sm font-medium uppercase tracking-wider text-zinc-400">
                Plan Mensual
              </span>
              <span className="mt-1 text-lg font-semibold tracking-tight text-secondary">
                Al día
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
