"use client";

import { useEffect, useMemo, useState } from "react";
import { getMiPerfilAction, updateMiPerfilAction } from "@/actions/perfil";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAGE_TITLE_CLASS } from "@/lib/headings";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function PerfilPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formData, setFormData] = useState({
    nombre: "",
    plan: "Sin plan",
    vencimiento: "",
    email: "",
    telefono: "",
    password: "",
  });
  const [initialFormData, setInitialFormData] = useState({
    nombre: "",
    plan: "Sin plan",
    vencimiento: "",
    email: "",
    telefono: "",
    password: "",
  });

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const supabase = createSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.id) {
          toast.error("No se pudo identificar al usuario actual");
          return;
        }
        setCurrentUserId(user.id);

        const result = await getMiPerfilAction(user.id);
        if (!result.ok) {
          toast.error(result.error ?? "No se pudo cargar el perfil");
          return;
        }

        const vencimiento = result.data.vencimiento
          ? new Date(`${result.data.vencimiento}T00:00:00`).toLocaleDateString("es-AR")
          : "Sin vencimiento";

        setFormData((prev) => ({
          ...prev,
          nombre: result.data.nombre,
          plan: result.data.plan,
          vencimiento,
          email: result.data.email,
          telefono: result.data.telefono,
          password: "",
        }));
        setInitialFormData({
          nombre: result.data.nombre,
          plan: result.data.plan,
          vencimiento,
          email: result.data.email,
          telefono: result.data.telefono,
          password: "",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const puedeGuardar = useMemo(
    () => formData.nombre.trim().length > 0 && formData.email.trim().length > 0,
    [formData.email, formData.nombre],
  );

  const guardarPerfil = async () => {
    if (!currentUserId) {
      toast.error("No se pudo identificar al usuario");
      return;
    }
    if (!puedeGuardar) {
      toast.error("Completá al menos nombre y email");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createSupabaseClient();

      const authPatch: { email?: string; password?: string } = {};
      const emailValue = formData.email.trim().toLowerCase();
      if (emailValue) authPatch.email = emailValue;
      if (formData.password.trim()) {
        const passwordToValidate = formData.password.trim();
        const hasUppercase = /[A-Z]/.test(passwordToValidate);
        const hasLowercase = /[a-z]/.test(passwordToValidate);
        const hasNumber = /\d/.test(passwordToValidate);
        if (
          passwordToValidate.length < 8 ||
          !hasUppercase ||
          !hasLowercase ||
          !hasNumber
        ) {
          toast.error(
            "La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.",
          );
          return;
        }
        if (passwordToValidate !== confirmPassword.trim()) {
          toast.error("La confirmación de contraseña no coincide");
          return;
        }
        authPatch.password = passwordToValidate;
      }

      if (Object.keys(authPatch).length > 0) {
        const { error: authError } = await supabase.auth.updateUser(authPatch);
        if (authError) {
          toast.error(authError.message || "No se pudieron actualizar credenciales");
          return;
        }
      }

      const saveResult = await updateMiPerfilAction({
        requesterUserId: currentUserId,
        nombre: formData.nombre,
        email: emailValue,
        telefono: formData.telefono,
      });
      if (!saveResult.ok) {
        toast.error(saveResult.error ?? "No se pudo guardar el perfil");
        return;
      }

      toast.success("Información guardada correctamente");
      const cleaned = { ...formData, password: "" };
      setFormData(cleaned);
      setInitialFormData(cleaned);
      setConfirmPassword("");
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelarEdicion = () => {
    setFormData(initialFormData);
    setConfirmPassword("");
    setIsEditing(false);
  };

  return (
    <div>
      <h1 className={cn(PAGE_TITLE_CLASS, "mb-8")}>Mi Perfil</h1>

      <section className="glass mt-8 rounded-2xl p-6 md:p-8">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading>Información de socio</SectionHeading>
          {!isEditing ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmPassword("");
                setFormData((prev) => ({ ...prev, password: "" }));
                setIsEditing(true);
              }}
            >
              Editar
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-wider text-foreground/60">Nombre</p>
            <p className="mt-1 font-medium">{isLoading ? "Cargando..." : formData.nombre || "—"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-wider text-foreground/60">Plan</p>
            <p className="mt-1 font-medium">{isLoading ? "Cargando..." : formData.plan || "—"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-wider text-foreground/60">
              Vencimiento
            </p>
            <p className="mt-1 font-medium">
              {isLoading ? "Cargando..." : formData.vencimiento || "—"}
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              disabled={!isEditing || isLoading}
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
              disabled={!isEditing || isLoading}
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
              placeholder={isEditing ? "Nueva contraseña (opcional)" : "********"}
              disabled={!isEditing || isLoading}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
            />
          </div>
          {isEditing ? (
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar contraseña</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                placeholder="Repetí la nueva contraseña"
                disabled={isLoading}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {isEditing ? (
            <>
              <Button type="button" variant="outline" onClick={cancelarEdicion} disabled={isSaving}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={guardarPerfil}
                disabled={isSaving || !puedeGuardar}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSaving ? "Guardando..." : "Guardar"}
              </Button>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
