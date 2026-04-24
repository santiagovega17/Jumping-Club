"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        toast.error("Credenciales incorrectas");
        return;
      }

      const { data: perfil, error: perfilError } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", data.user.id)
        .single();

      if (perfilError || !perfil?.rol) {
        toast.error("No se pudo obtener el perfil del usuario");
        return;
      }

      const isAdminRole =
        perfil.rol === "admin_global" || perfil.rol === "admin_franquicia";
      sessionStorage.setItem("userRole", isAdminRole ? "admin" : "socio");
      localStorage.setItem(
        "jumpingClubRole",
        isAdminRole ? "administracion" : "socio",
      );

      toast.success(isAdminRole ? "Bienvenido Administrador" : "Bienvenido Socio");
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-md bg-card border-zinc-800 shadow-2xl">
        <CardHeader>
          <h1 className="text-3xl font-black tracking-tight text-zinc-50 text-center">
            JUMPING CLUB
          </h1>
          <p className="text-sm font-medium text-zinc-400 uppercase tracking-wider text-center mt-2">
            Ingresa a tu cuenta
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="uppercase text-xs font-semibold tracking-wider text-zinc-400">
                Correo electrónico
              </Label>
              <Input
                type="email"
                placeholder="admin@jumpingclub.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="uppercase text-xs font-semibold tracking-wider text-zinc-400">
                Contraseña
              </Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full uppercase tracking-wider font-bold bg-[#e41b68] hover:bg-[#c21455] text-white"
            >
              {isLoading ? "Ingresando..." : "Iniciar sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
