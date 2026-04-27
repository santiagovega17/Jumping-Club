"use client";

import { useState } from "react";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAGE_TITLE_CLASS } from "@/lib/headings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function PerfilPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "Martina García",
    plan: "Mensual Premium",
    vencimiento: "30/06/2026",
    email: "martina.garcia@email.com",
    telefono: "+54 9 11 5555 1234",
    password: "********",
  });

  const guardarPerfil = () => {
    toast.success("Información guardada correctamente");
    setIsEditing(false);
  };

  return (
    <div>
      <h1 className={cn(PAGE_TITLE_CLASS, "mb-8")}>Mi Perfil</h1>

      <section className="glass mt-8 rounded-2xl p-6 md:p-8">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading>Información de socio</SectionHeading>
          {!isEditing ? (
            <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
              Editar
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-wider text-foreground/60">Nombre</p>
            <p className="mt-1 font-medium">{formData.nombre}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-wider text-foreground/60">Plan</p>
            <p className="mt-1 font-medium">{formData.plan}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-wider text-foreground/60">
              Vencimiento
            </p>
            <p className="mt-1 font-medium">{formData.vencimiento}</p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              disabled={!isEditing}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              type="tel"
              value={formData.telefono}
              disabled={!isEditing}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, telefono: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              disabled={!isEditing}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          {isEditing ? (
            <Button
              type="button"
              onClick={guardarPerfil}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Guardar
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
