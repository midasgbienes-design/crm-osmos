"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { buscarModulo, rutaSeccion } from "@/lib/modulos";

export function RedirigirModulo({ modulo }: { modulo: string }) {
  const router = useRouter();
  useEffect(() => {
    const m = buscarModulo(modulo);
    router.replace(m ? rutaSeccion(m, m.secciones[0]) : "/");
  }, [modulo, router]);
  return <p className="text-sm text-osmos-muted">Abriendo…</p>;
}
