"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Building2, LogOut, Settings } from "lucide-react";
import { signOut } from "@/actions/auth";
import { cn } from "@/lib/utils";
import logoUJ from "../../../logo-UJ.png";

const navigationItems = [
  {
    href: "/universal-jumps",
    label: "Dashboard Franquicias",
    icon: Building2,
  },
  {
    href: "/universal-jumps/configuracion-global",
    label: "Configuración Global",
    icon: Settings,
  },
] as const;

type UniversalJumpsSidebarProps = {
  className?: string;
  fixed?: boolean;
  onNavigate?: () => void;
};

export function UniversalJumpsSidebar({
  className,
  fixed = true,
  onNavigate,
}: UniversalJumpsSidebarProps) {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <aside
      className={cn(
        "z-40 flex h-screen w-64 flex-col gap-2 border-r border-violet-500/30 bg-zinc-900 p-4 text-foreground",
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

      <nav className="flex flex-1 flex-col gap-1" aria-label="Navegación Universal Jumps">
        {navigationItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-violet-400 bg-violet-500/15 text-violet-200"
                  : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <Icon
                className={cn("size-5 shrink-0", active ? "text-violet-300" : "opacity-90")}
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
        <button
          type="submit"
          disabled={isSigningOut}
          className={cn(
            "mt-2 flex w-full items-center gap-3 rounded-md border border-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-zinc-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
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
