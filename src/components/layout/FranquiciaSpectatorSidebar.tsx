"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  LayoutDashboard,
  LogOut,
  SlidersHorizontal,
  Users,
  Wallet,
} from "lucide-react";
import { signOut } from "@/actions/auth";
import { cn } from "@/lib/utils";
import logoUJ from "../../../logo-UJ.png";

const spectatorItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  { key: "administracion", label: "Administración", icon: Wallet, enabled: true },
  { key: "calendario", label: "Calendario", icon: Calendar, enabled: true },
  { key: "socios", label: "Socios", icon: Users, enabled: true },
  { key: "configuracion", label: "Configuración", icon: SlidersHorizontal, enabled: true },
] as const;

type FranquiciaSpectatorSidebarProps = {
  className?: string;
  fixed?: boolean;
  onNavigate?: () => void;
};

export function FranquiciaSpectatorSidebar({
  className,
  fixed = true,
  onNavigate,
}: FranquiciaSpectatorSidebarProps) {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const pathSegments = pathname.split("/").filter(Boolean);
  const franquiciaId = pathSegments[2] ?? "";
  const dashboardHref = franquiciaId
    ? `/universal-jumps/franquicia/${franquiciaId}`
    : "/universal-jumps";

  return (
    <aside
      className={cn(
        "z-40 flex h-screen w-64 flex-col gap-2 border-r border-zinc-800 bg-zinc-900 p-4 text-foreground",
        fixed && "fixed left-0 top-0",
        className,
      )}
    >
      <div className="mb-4 px-1 py-1">
        <div className="flex items-center justify-center">
          <Image
            src={logoUJ}
            alt="Universal Jumps"
            width={210}
            height={90}
            className="h-auto w-full object-contain"
            priority
          />
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Navegación franquicia espectador">
        {spectatorItems.map(({ key, label, icon: Icon, enabled }) => {
          const href =
            key === "dashboard"
              ? dashboardHref
              : `${dashboardHref}/${key}`;
          const active =
            key === "dashboard"
              ? pathname === dashboardHref
              : pathname.startsWith(`${dashboardHref}/${key}`);

          if (!enabled) {
            return (
              <div
                key={key}
                className="flex cursor-not-allowed items-center gap-3 border-l-2 border-transparent pl-[10px] pr-3 py-2.5 text-sm font-medium text-foreground/35"
                title="Disponible en próximas fases"
              >
                <Icon className="size-5 shrink-0 opacity-60" aria-hidden />
                {label}
              </div>
            );
          }

          return (
            <Link
              key={key}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 border-l-2 border-transparent pl-[10px] pr-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <Icon
                className={cn("size-5 shrink-0", active ? "text-primary" : "opacity-90")}
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <form
        action={signOut}
        onSubmit={() => {
          setIsSigningOut(true);
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem("userRole");
            window.sessionStorage.removeItem("jumpingClubUserId");
            window.localStorage.removeItem("jumpingClubRole");
          }
          onNavigate?.();
        }}
      >
        <Link
          href="/universal-jumps"
          onClick={onNavigate}
          className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700/80 bg-zinc-900/60 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a Franquicias
        </Link>
        <button
          type="submit"
          disabled={isSigningOut}
          className={cn(
            "mt-2 flex w-full items-center gap-3 rounded-md border border-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-zinc-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
            isSigningOut && "cursor-not-allowed opacity-60",
          )}
          aria-label="Cerrar sesión"
        >
          <LogOut className="size-5 shrink-0" aria-hidden />
          {isSigningOut ? "Cerrando sesión..." : "Cerrar Sesión"}
        </button>
      </form>
    </aside>
  );
}
