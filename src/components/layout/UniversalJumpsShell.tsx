"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { UniversalJumpsSidebar } from "@/components/layout/UniversalJumpsSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type UniversalJumpsShellProps = {
  children: React.ReactNode;
};

export function UniversalJumpsShell({ children }: UniversalJumpsShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="flex min-h-screen">
        <UniversalJumpsSidebar className="hidden md:flex" />

        <div className="flex min-h-screen flex-1 flex-col md:pl-72">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-violet-500/25 bg-zinc-900/95 px-4 py-3 backdrop-blur md:hidden">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-200/85">
                Universal Jumps
              </p>
              <p className="text-sm font-medium text-zinc-100">Panel Global</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-zinc-100 hover:bg-zinc-800"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menú de Universal Jumps"
            >
              <Menu className="size-5" />
            </Button>
          </header>

          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="w-72 border-violet-500/25 bg-zinc-900 p-0">
              <UniversalJumpsSidebar
                fixed={false}
                className="h-full w-full border-r-0"
                onNavigate={() => setMobileNavOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <main className="min-h-screen flex-1 bg-zinc-950">
            <div className="mx-auto w-full max-w-7xl p-4 md:p-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
