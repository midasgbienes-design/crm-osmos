"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MODULOS, moduloDeRuta } from "@/lib/modulos";
import { Icono } from "./iconos";

const GRUPOS = ["Operaciones", "Finanzas", "Personas"] as const;

export function Menu() {
  const path = usePathname() ?? "/";
  const actual = moduloDeRuta(path);
  const [abierto, setAbierto] = useState(false);

  // En el teléfono el menú se cierra al cambiar de pantalla.
  useEffect(() => setAbierto(false), [path]);

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

  const nombreActual = actual ? MODULOS.find((m) => m.slug === actual)?.nombre ?? "Inicio" : "Inicio";

  return (
    <nav aria-label="Módulos" className="w-full border-osmos-line bg-white md:w-[230px] md:shrink-0 md:border-r">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="flex h-12 w-full items-center justify-between border-b border-osmos-line px-4 text-sm font-bold text-osmos-navy md:hidden"
      >
        <span>Menú · {nombreActual}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {abierto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <div className={`${abierto ? "flex" : "hidden"} flex-col gap-1 px-3 py-4 md:flex`}>
        {item("/", "Inicio", "inicio", path === "/")}
        {GRUPOS.map((g) => (
          <div key={g} className="flex flex-col gap-1">
            <span className="px-3 pb-1 pt-3 text-[11px] font-bold tracking-wider text-osmos-muted">{g.toUpperCase()}</span>
            {MODULOS.filter((m) => m.grupo === g).map((m) => item(`/${m.slug}/`, m.nombre, m.icono, actual === m.slug))}
          </div>
        ))}
      </div>
    </nav>
  );
}
