"use client";

import Link from "next/link";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { Menu } from "@/components/menu";
import { ProveedorSesion, useSesion } from "@/components/sesion";
import { etiqueta } from "@/lib/formato";

function Marco({ children }: { children: React.ReactNode }) {
  const { usuario, perfil } = useSesion();
  const nombre = perfil?.nombre ?? usuario.email ?? "Usuario";
  const iniciales = nombre
    .replace(/[[\]]/g, "")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap print:hidden items-center gap-x-5 gap-y-3 bg-osmos-navy px-5 py-2.5 text-white">
        <Link href="/" className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/osmos-wordmark-blanco.png" alt="Osmos" className="h-auto w-[104px]" />
          <span className="hidden h-6 w-px bg-[#3A5A9A] sm:block" />
          <span className="hidden text-[13px] text-[#C9D3E8] sm:block">Sistema de gestión empresarial</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-osmos-teal text-[13px] font-bold">{iniciales}</span>
          <Link href="/cuenta/" title="Mi cuenta y contraseña" className="flex flex-col leading-4 hover:underline">
            <span className="text-[13px] font-semibold">{nombre}</span>
            <span className="text-xs text-[#C9D3E8]">{etiqueta(perfil?.rol ?? "consulta")} · Mi cuenta</span>
          </Link>
          <button
            type="button"
            onClick={() => supabase().auth.signOut()}
            className="ml-2 h-9 rounded-md border border-[#3A5A9A] px-3 text-[13px] hover:bg-osmos-navy2"
          >
            Salir
          </button>
        </div>
      </header>

      {perfil?.rol === "consulta" || !perfil ? (
        <div className="bg-osmos-yellow px-5 print:hidden py-2 text-sm font-semibold text-osmos-navy">
          Su usuario aún no tiene un rol asignado. Pida al administrador que le asigne uno para ver la información.
        </div>
      ) : null}

      <div className="flex flex-1 flex-col md:flex-row">
        <div className="print:hidden md:flex md:shrink-0">
          <Menu />
        </div>
        <main className="flex min-w-0 flex-1 flex-col gap-4 px-4 pb-10 pt-5 md:px-6 print:p-0">
          <Suspense fallback={<p className="text-sm text-osmos-muted">Cargando…</p>}>{children}</Suspense>
        </main>
      </div>

      <footer className="flex flex-wrap print:hidden gap-x-5 gap-y-1 border-t border-osmos-line bg-white px-5 py-2 text-xs text-osmos-muted">
        <span>Moneda: Peso dominicano (DOP)</span>
        <span className="ml-auto">Osmos Tecnología del Agua · Santiago, República Dominicana</span>
      </footer>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorSesion>
      <Marco>{children}</Marco>
    </ProveedorSesion>
  );
}
