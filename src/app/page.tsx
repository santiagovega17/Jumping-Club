"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const role = window.localStorage.getItem("jumpingClubRole");
    router.replace(role === "socio" ? "/inicio" : "/dashboard");
  }, [router]);

  return null;
}
