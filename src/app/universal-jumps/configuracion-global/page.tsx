"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Building2, Eye, EyeOff, Shield } from "lucide-react";
import {
  createFranquiciaWithAdminAction,
  getUniversalJumpsConfigOverview,
  resetFranquiciaAdminPasswordAction,
  saveUniversalJumpsGlobalPlansAction,
  saveUniversalJumpsGlobalTemplatesAction,
} from "@/actions/universal-jumps-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KPI_TITLE_CLASS, PAGE_SUBTITLE_CLASS, PAGE_TITLE_CLASS } from "@/lib/headings";
import { cn } from "@/lib/utils";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type GlobalSettingsDraft = {
  formasPagoDefault: string;
  conceptosIngresoDefault: string;
  planesDefault: string;
};

const DEFAULT_SETTINGS: GlobalSettingsDraft = {
  formasPagoDefault: "Efectivo\nTransferencia\nDébito\nCrédito",
  conceptosIngresoDefault: "Pago de Cuota\nInscripción\nVenta de productos",
  planesDefault: "Plan 3xSemana|3\nPlan Mensual|99\nClase Individual|1",
};

export default function ConfiguracionGlobalPage() {
  const [settings, setSettings] = useState<GlobalSettingsDraft>(DEFAULT_SETTINGS);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTargetAdmin, setPasswordTargetAdmin] = useState<{
    id: string;
    nombre: string;
    email: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isCreatingFranquicia, setIsCreatingFranquicia] = useState(false);
  const [newFranquiciaForm, setNewFranquiciaForm] = useState({
    franquiciaNombre: "",
    franquiciaDireccion: "",
    adminNombre: "",
    adminEmail: "",
    adminPassword: "",
  });

  const { data, isLoading, mutate } = useSWR("uj-config-overview", async () => {
    const result = await getUniversalJumpsConfigOverview();
    if (!result.ok) throw new Error(result.error);
    return result.data;
  });

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    };
    void loadUser();
  }, []);

  useEffect(() => {
    if (!data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings({
      formasPagoDefault:
        data.formasPagoDefault.length > 0
          ? data.formasPagoDefault.join("\n")
          : DEFAULT_SETTINGS.formasPagoDefault,
      conceptosIngresoDefault:
        data.conceptosIngresoDefault.length > 0
          ? data.conceptosIngresoDefault.join("\n")
          : DEFAULT_SETTINGS.conceptosIngresoDefault,
      planesDefault:
        (data.planesGlobales ?? []).length > 0
          ? (data.planesGlobales ?? [])
              .map((p) => `${p.nombre}|${p.clasesPorSemana}`)
              .join("\n")
          : DEFAULT_SETTINGS.planesDefault,
    });
  }, [data]);

  const saveSettings = async () => {
    if (!currentUserId) {
      toast.error("No se pudo identificar al usuario actual");
      return;
    }
    const result = await saveUniversalJumpsGlobalTemplatesAction({
      requesterUserId: currentUserId,
      formasPagoDefault: settings.formasPagoDefault,
      conceptosIngresoDefault: settings.conceptosIngresoDefault,
    });
    if (!result.ok) {
      toast.error(result.error ?? "No se pudo guardar la plantilla global");
      return;
    }
    toast.success("Plantillas globales guardadas correctamente");
  };

  const saveGlobalPlans = async () => {
    if (!currentUserId) {
      toast.error("No se pudo identificar al usuario actual");
      return;
    }
    const result = await saveUniversalJumpsGlobalPlansAction({
      requesterUserId: currentUserId,
      planesDefault: settings.planesDefault,
    });
    if (!result.ok) {
      toast.error(result.error ?? "No se pudieron guardar los planes globales");
      return;
    }
    await mutate();
    toast.success("Planes globales guardados y sincronizados");
  };

  const openPasswordDialog = (admin: { id: string; nombre: string; email: string }) => {
    setPasswordTargetAdmin(admin);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordDialogOpen(true);
  };

  const submitPasswordChange = async () => {
    if (!currentUserId || !passwordTargetAdmin?.id) {
      toast.error("No se pudo identificar al usuario actual");
      return;
    }
    const passwordToValidate = newPassword.trim();
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
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setIsSavingPassword(true);
    try {
      const result = await resetFranquiciaAdminPasswordAction({
        requesterUserId: currentUserId,
        targetAdminUserId: passwordTargetAdmin.id,
        newPassword,
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo cambiar la contraseña");
        return;
      }
      toast.success("Contraseña actualizada correctamente");
      setPasswordDialogOpen(false);
      setPasswordTargetAdmin(null);
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const submitCreateFranquicia = async () => {
    if (!currentUserId) {
      toast.error("No se pudo identificar al usuario actual");
      return;
    }
    if (
      !newFranquiciaForm.franquiciaNombre.trim() ||
      !newFranquiciaForm.adminNombre.trim() ||
      !newFranquiciaForm.adminEmail.trim() ||
      !newFranquiciaForm.adminPassword.trim()
    ) {
      toast.error("Completá nombre de franquicia y datos del admin");
      return;
    }

    setIsCreatingFranquicia(true);
    try {
      const result = await createFranquiciaWithAdminAction({
        requesterUserId: currentUserId,
        franquiciaNombre: newFranquiciaForm.franquiciaNombre,
        franquiciaDireccion: newFranquiciaForm.franquiciaDireccion,
        adminNombre: newFranquiciaForm.adminNombre,
        adminEmail: newFranquiciaForm.adminEmail,
        adminPassword: newFranquiciaForm.adminPassword,
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo crear la franquicia");
        return;
      }
      setNewFranquiciaForm({
        franquiciaNombre: "",
        franquiciaDireccion: "",
        adminNombre: "",
        adminEmail: "",
        adminPassword: "",
      });
      await mutate();
      toast.success("Franquicia y admin creados correctamente");
    } finally {
      setIsCreatingFranquicia(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="rounded-2xl border border-violet-500/25 bg-zinc-900/70 px-5 py-4 md:px-6">
        <h1 className={cn(PAGE_TITLE_CLASS, "text-zinc-50")}>Configuración Global</h1>
        <p className={cn(PAGE_SUBTITLE_CLASS, "text-zinc-300/80")}>
          Parámetros y estándares aplicables a todas las franquicias.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border border-zinc-800 bg-card/95">
          <CardHeader className="pb-2">
            <p className={KPI_TITLE_CLASS}>Franquicias Totales</p>
            <CardTitle className="text-3xl font-semibold text-zinc-100 tabular-nums">
              {isLoading ? "..." : data?.totalFranquicias ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border border-zinc-800 bg-card/95">
          <CardHeader className="pb-2">
            <p className={KPI_TITLE_CLASS}>Admins de Franquicia</p>
            <CardTitle className="text-3xl font-semibold text-zinc-100 tabular-nums">
              {isLoading ? "..." : data?.totalAdminsFranquicia ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border border-zinc-800 bg-card/95">
          <CardHeader className="pb-2">
            <p className={KPI_TITLE_CLASS}>Estado del Panel</p>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
              <Shield className="size-4 text-violet-300" />
              Universal Jumps
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6">
        <Card className="border border-zinc-800 bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Building2 className="size-4 text-violet-300" />
              Nueva Franquicia
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Crea una franquicia y su admin principal en un solo paso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="franq-nombre">Nombre de franquicia</Label>
                <Input
                  id="franq-nombre"
                  value={newFranquiciaForm.franquiciaNombre}
                  onChange={(e) =>
                    setNewFranquiciaForm((prev) => ({ ...prev, franquiciaNombre: e.target.value }))
                  }
                  className="border-zinc-800 bg-zinc-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="franq-direccion">Dirección</Label>
                <Input
                  id="franq-direccion"
                  value={newFranquiciaForm.franquiciaDireccion}
                  onChange={(e) =>
                    setNewFranquiciaForm((prev) => ({ ...prev, franquiciaDireccion: e.target.value }))
                  }
                  className="border-zinc-800 bg-zinc-900"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="franq-admin-nombre">Nombre admin</Label>
                <Input
                  id="franq-admin-nombre"
                  value={newFranquiciaForm.adminNombre}
                  onChange={(e) =>
                    setNewFranquiciaForm((prev) => ({ ...prev, adminNombre: e.target.value }))
                  }
                  className="border-zinc-800 bg-zinc-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="franq-admin-email">Email admin</Label>
                <Input
                  id="franq-admin-email"
                  type="email"
                  value={newFranquiciaForm.adminEmail}
                  onChange={(e) =>
                    setNewFranquiciaForm((prev) => ({ ...prev, adminEmail: e.target.value }))
                  }
                  className="border-zinc-800 bg-zinc-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="franq-admin-password">Contraseña inicial</Label>
                <Input
                  id="franq-admin-password"
                  type="password"
                  value={newFranquiciaForm.adminPassword}
                  onChange={(e) =>
                    setNewFranquiciaForm((prev) => ({ ...prev, adminPassword: e.target.value }))
                  }
                  className="border-zinc-800 bg-zinc-900"
                />
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.
            </p>
            <Button
              type="button"
              onClick={() => void submitCreateFranquicia()}
              disabled={isCreatingFranquicia}
              className="bg-[#5ab253] text-white hover:bg-[#5ab253]/90"
            >
              {isCreatingFranquicia ? "Creando..." : "Crear franquicia"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-zinc-800 bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Building2 className="size-4 text-violet-300" />
              Plantillas para Nuevas Franquicias
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Defaults operativos sugeridos al dar de alta una franquicia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Formas de pago por defecto (una por línea)</Label>
              <Textarea
                value={settings.formasPagoDefault}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, formasPagoDefault: e.target.value }))
                }
                className="min-h-24"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Conceptos de ingreso por defecto (una por línea)</Label>
              <Textarea
                value={settings.conceptosIngresoDefault}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, conceptosIngresoDefault: e.target.value }))
                }
                className="min-h-24"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Planes globales (formato: Nombre|Clases por semana)</Label>
              <Textarea
                value={settings.planesDefault}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, planesDefault: e.target.value }))
                }
                className="min-h-24"
              />
              <p className="text-xs text-zinc-500">
                Ejemplo: Plan 2xSemana|2. Estos planes quedan disponibles para todas las franquicias.
              </p>
            </div>
            <Button onClick={() => void saveGlobalPlans()} variant="outline" className="border-zinc-700">
              Guardar planes globales
            </Button>
            <Button onClick={() => void saveSettings()} variant="outline" className="border-zinc-700">
              Guardar plantillas
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="border border-zinc-800 bg-card/95">
        <CardHeader className="border-b border-zinc-800">
          <CardTitle className="text-zinc-100">Admins por franquicia</CardTitle>
          <CardDescription className="text-zinc-400">
            Visibilidad centralizada de responsables por franquicia.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="px-4 py-3 text-zinc-400">Franquicia</TableHead>
                <TableHead className="px-4 py-3 text-zinc-400">Nombre</TableHead>
                <TableHead className="px-4 py-3 text-zinc-400">Email</TableHead>
                <TableHead className="px-4 py-3 text-zinc-400">Rol</TableHead>
                <TableHead className="px-4 py-3 text-right text-zinc-400">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    Cargando administradores...
                  </TableCell>
                </TableRow>
              ) : (data?.adminsFranquicia.length ?? 0) === 0 ? (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No hay admins de franquicia cargados.
                  </TableCell>
                </TableRow>
              ) : (
                data?.adminsFranquicia.map((admin) => (
                  <TableRow key={admin.id} className="border-zinc-800/80">
                    <TableCell className="px-4 py-3 text-zinc-100">{admin.franquiciaNombre}</TableCell>
                    <TableCell className="px-4 py-3 text-zinc-200">{admin.nombre}</TableCell>
                    <TableCell className="px-4 py-3 text-zinc-300">{admin.email}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="outline" className="border-violet-400/45 text-violet-200">
                        admin_franquicia
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-zinc-700 bg-transparent hover:bg-zinc-800"
                        onClick={() =>
                          openPasswordDialog({
                            id: admin.id,
                            nombre: admin.nombre,
                            email: admin.email,
                          })
                        }
                      >
                        Cambiar contraseña
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open);
          if (!open) {
            setPasswordTargetAdmin(null);
            setNewPassword("");
            setConfirmPassword("");
            setShowNewPassword(false);
            setShowConfirmPassword(false);
          }
        }}
      >
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña de admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              Admin:{" "}
              <span className="font-medium text-zinc-100">
                {passwordTargetAdmin?.nombre ?? "—"}
              </span>{" "}
              ({passwordTargetAdmin?.email ?? "—"})
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="new-admin-password">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="new-admin-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border-zinc-800 bg-zinc-900 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-100"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-admin-password">Confirmar contraseña</Label>
              <div className="relative">
                <Input
                  id="confirm-admin-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-zinc-800 bg-zinc-900 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-100"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700"
              onClick={() => setPasswordDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSavingPassword}
              className="bg-[#5ab253] text-white hover:bg-[#5ab253]/90"
              onClick={() => {
                void submitPasswordChange();
              }}
            >
              {isSavingPassword ? "Guardando..." : "Guardar contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
