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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email === "admin@gmail.com" && password === "123") {
      sessionStorage.setItem("userRole", "admin");
      localStorage.setItem("jumpingClubRole", "administracion");
      toast.success("Bienvenido Administrador");
      router.push("/dashboard");
      return;
    }

    if (email === "socio@gmail.com" && password === "123") {
      sessionStorage.setItem("userRole", "socio");
      localStorage.setItem("jumpingClubRole", "socio");
      toast.success("Bienvenido Socio");
      router.push("/dashboard");
      return;
    }

    toast.error("Credenciales incorrectas");
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
              className="w-full uppercase tracking-wider font-bold bg-[#e41b68] hover:bg-[#c21455] text-white"
            >
              Iniciar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
