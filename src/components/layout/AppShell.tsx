"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login" || pathname === "/";
  const isUniversalJumpsRoute = pathname.startsWith("/universal-jumps");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (isLoginPage) return;
    const validateSession = async () => {
      const userRole = sessionStorage.getItem("userRole");
      if (!userRole) {
        router.push("/login");
        return;
      }
      try {
        const supabase = createSupabaseClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          await supabase.auth.signOut();
          sessionStorage.removeItem("userRole");
          sessionStorage.removeItem("jumpingClubUserId");
          localStorage.removeItem("jumpingClubRole");
          router.replace("/login");
        } else {
          sessionStorage.setItem("jumpingClubUserId", data.user.id);
        }
      } catch {
        sessionStorage.removeItem("userRole");
        sessionStorage.removeItem("jumpingClubUserId");
        localStorage.removeItem("jumpingClubRole");
        router.replace("/login");
      }
    };
    void validateSession();
  }, [isLoginPage, router]);

  if (isLoginPage || isUniversalJumpsRoute) {
    return <main className="min-h-screen w-full bg-zinc-950">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="flex min-h-screen">
        <Sidebar className="hidden md:flex" />
        <div className="flex min-h-screen flex-1 flex-col md:pl-64">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 px-4 py-3 backdrop-blur md:hidden">
            <p className="text-sm font-semibold uppercase tracking-wider text-zinc-100">
              Jumping Club
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-zinc-100 hover:bg-zinc-800"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </Button>
          </header>

          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="w-64 border-zinc-800 bg-zinc-900 p-0">
              <Sidebar
                fixed={false}
                className="h-full w-full border-r-0"
                onNavigate={() => setMobileNavOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <main className="min-h-screen flex-1 bg-zinc-950">
            <div className="mx-auto w-full max-w-6xl p-4 md:p-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
