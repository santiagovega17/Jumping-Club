"use client";

import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      theme="dark"
      richColors
      toastOptions={{
        classNames: {
          toast: "border border-zinc-800 bg-zinc-900 text-zinc-100",
          actionButton: "bg-[#e41b68] text-white hover:bg-[#e41b68]/90",
        },
      }}
      {...props}
    />
  );
}
