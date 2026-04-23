"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  LayoutDashboard,
  SlidersHorizontal,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";
import { BRAND_TITLE_CLASS } from "@/lib/headings";
import { cn } from "@/lib/utils";

const adminItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/administracion", label: "Administración", icon: Wallet },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/socios", label: "Socios", icon: Users },
  { href: "/configuracion", label: "Configuración", icon: SlidersHorizontal },
] as const;

const socioItems = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  {
    href: "/calendario",
    label: "Calendario",
    icon: Calendar,
  },
  { href: "/perfil", label: "Mi Perfil", icon: UserCircle },
] as const;

type Role = "admin" | "socio";

type SidebarProps = {
  className?: string;
  fixed?: boolean;
  onNavigate?: () => void;
};

export function Sidebar({ className, fixed = true, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>(() => {
    if (typeof window === "undefined") return "admin";
    const storedRole = window.sessionStorage.getItem("userRole");
    return storedRole === "admin" || storedRole === "socio"
      ? storedRole
      : "admin";
  });
  const items = role === "admin" ? adminItems : socioItems;
  const accentStyles =
    role === "admin"
      ? {
          active: "border-primary bg-primary/15 text-primary",
          icon: "text-primary",
        }
      : {
          active: "border-secondary bg-secondary/15 text-secondary",
          icon: "text-secondary",
        };

  useEffect(() => {
    const storedRole = window.sessionStorage.getItem("userRole");
    if (storedRole === "admin" || storedRole === "socio") {
      setRole(storedRole);
    }
  }, []);

  return (
    <aside
      className={cn(
        "z-40 flex h-screen w-64 flex-col gap-2 border-r border-zinc-800 bg-zinc-900 p-4",
        fixed && "fixed left-0 top-0",
        "text-foreground",
        className,
      )}
    >
      <div className="mb-4 px-2 pt-1">
        <p className="text-xs font-medium uppercase tracking-widest text-foreground/70">
          Gimnasio
        </p>
        <h2 className={BRAND_TITLE_CLASS}>Jumping Club</h2>
      </div>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Navegación principal">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 border-l-2 border-transparent pl-[10px] pr-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? accentStyles.active
                  : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0",
                  active ? accentStyles.icon : "opacity-90"
                )}
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
