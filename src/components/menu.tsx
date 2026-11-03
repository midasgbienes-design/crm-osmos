"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULOS } from "@/lib/modulos";
import { Icono } from "./iconos";

const GRUPOS = ["Operaciones", "Finanzas", "Personas"] as const;

export function Menu() {
  const path = usePathname();

  const item = (href: string, nombre: string, icono: string, activo: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`flex h-[42px] items-center gap-2.5 rounded-md px-3 text-sm ${
        activo ? "bg-osmos-hover font-bold text-osmos-navy" : "font-medium text-[#33415F] hover:bg-osmos-bg"
      }`}
    >
      <Icono nombre={icono} />
      {nombre}
    </Link>
  );

  return (
    <nav aria-label="Módulos" className="flex w-full flex-col gap-1 border-osmos-line bg-white px-3 py-4 md:w-[230px] md:shrink-0 md:border-r">
      {item("/", "Inicio", "inicio", path === "/")}
      {GRUPOS.map((g) => (
        <div key={g} className="flex flex-col gap-1">
          <span className="px-3 pb-1 pt-3 text-[11px] font-bold tracking-wider text-osmos-muted">{g.toUpperCase()}</span>
          {MODULOS.filter((m) => m.grupo === g).map((m) => item(`/${m.slug}`, m.nombre, m.icono, path.startsWith(`/${m.slug}`)))}
        </div>
      ))}
    </nav>
  );
}
