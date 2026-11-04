"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { configuracion, supabase } from "@/lib/supabase/cliente";

type Perfil = { nombre: string; rol: string };
type Sesion = { usuario: User; perfil: Perfil | null };

const Contexto = createContext<Sesion | null>(null);

export function useSesion() {
  const s = useContext(Contexto);
  if (!s) throw new Error("useSesion fuera de ProveedorSesion");
  return s;
}

export function esGerencia(rol?: string | null) {
  return rol === "admin" || rol === "gerencia";
}

// Protege las pantallas: sin sesión, envía al inicio de sesión.
export function ProveedorSesion({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [sinConfig, setSinConfig] = useState(false);

  useEffect(() => {
    if (!configuracion().valida) {
      setSinConfig(true);
      return;
    }
    const sb = supabase();
    let activo = true;
    const cargar = async () => {
      const { data } = await sb.auth.getUser();
      if (!activo) return;
      if (!data.user) {
        router.replace("/login/");
        return;
      }
      const { data: perfil } = await sb.from("perfiles").select("nombre, rol").eq("id", data.user.id).maybeSingle();
      if (activo) setSesion({ usuario: data.user, perfil });
    };
    cargar();
    const { data: sub } = sb.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") router.replace("/login/");
    });
    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (sinConfig) return <FaltaConfiguracion />;
  if (!sesion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-osmos-bg text-sm text-osmos-muted">
        Cargando…
      </div>
    );
  }
  return <Contexto.Provider value={sesion}>{children}</Contexto.Provider>;
}

export function FaltaConfiguracion() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-osmos-bg px-4">
      <div className="card max-w-lg p-6 text-sm">
        <h1 className="mb-2 text-lg font-bold text-osmos-navy">Falta la configuración de Supabase</h1>
        <p className="mb-2">
          En Hostinger, dentro de <code>public_html/crm</code>, copie <code>config.example.js</code> como <code>config.js</code> y pegue la clave
          <strong> anon public</strong> de Supabase (Project Settings → API).
        </p>
        <p className="text-osmos-muted">Después recargue esta página.</p>
      </div>
    </main>
  );
}
