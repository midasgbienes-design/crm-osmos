"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { configuracion, supabase } from "@/lib/supabase/cliente";
import { FaltaConfiguracion } from "@/components/sesion";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sinConfig, setSinConfig] = useState(false);

  useEffect(() => {
    setSinConfig(!configuracion().valida);
  }, []);

  if (sinConfig) return <FaltaConfiguracion />;

  const entrar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const { error } = await supabase().auth.signInWithPassword({
      email: String(f.get("email") ?? ""),
      password: String(f.get("password") ?? ""),
    });
    setEnviando(false);
    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.replace("/");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-osmos-navy px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-start gap-3">
          <div className="rounded-md bg-osmos-navy px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/osmos-wordmark-blanco.png" alt="Osmos" className="h-auto w-28" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-osmos-navy">Sistema de gestión empresarial</h1>
            <p className="text-sm text-osmos-muted">Ingrese con su usuario de Osmos.</p>
          </div>
        </div>
        <form onSubmit={entrar} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="label">Correo electrónico</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">Contraseña</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
          </div>
          {error ? <p className="rounded-md bg-[#FDE7E7] px-3 py-2 text-sm text-[#A12020]">{error}</p> : null}
          <button type="submit" disabled={enviando} className="btn-primary h-11">
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-6 text-xs text-osmos-muted">¿No tiene usuario? Solicítelo al administrador del sistema.</p>
      </div>
    </main>
  );
}
