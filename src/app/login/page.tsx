"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { configuracion, supabase } from "@/lib/supabase/cliente";
import { FaltaConfiguracion } from "@/components/sesion";

// Traduce el error de Supabase a una explicación útil.
function explicarError(mensaje: string, estado?: number) {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "El correo no está confirmado. En Supabase → Authentication → Users, confirme el usuario.";
  if (m.includes("invalid api key") || m.includes("no api key") || estado === 401)
    return "La clave de config.js no es válida. Copie de nuevo la clave anon public de Supabase (Project Settings → API).";
  if (m.includes("database error")) return `Supabase no pudo leer el usuario (${mensaje}). Ejecute el script de reparación del usuario.`;
  if (m.includes("failed to fetch") || m.includes("network"))
    return "No hay conexión con Supabase. Revise la dirección (supabaseUrl) en config.js y su conexión a internet.";
  return `No se pudo iniciar sesión: ${mensaje}`;
}

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sinConfig, setSinConfig] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setSinConfig(!configuracion().valida);
  }, []);

  if (sinConfig) return <FaltaConfiguracion />;

  const entrar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      const { error } = await supabase().auth.signInWithPassword({
        email: String(f.get("email") ?? "").trim(),
        password: String(f.get("password") ?? ""),
      });
      if (error) {
        setError(explicarError(error.message, error.status));
        return;
      }
      router.replace("/");
    } catch (e) {
      setError(explicarError(e instanceof Error ? e.message : String(e)));
    } finally {
      setEnviando(false);
    }
  };

  const olvide = async () => {
    const email = (document.getElementById("email") as HTMLInputElement | null)?.value.trim() ?? "";
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Escriba su correo arriba y vuelva a pulsar «¿Olvidó su contraseña?».");
      return;
    }
    const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/cuenta/?recuperar=1` });
    if (error) setError(explicarError(error.message, error.status));
    else setInfo(`Si ${email} tiene usuario, le llegará un correo con el enlace para crear una contraseña nueva.`);
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
          {info ? <p className="rounded-md bg-[#E3F4E8] px-3 py-2 text-sm text-[#1D6B3A]">{info}</p> : null}
          <button type="submit" disabled={enviando} className="btn-primary h-11">
            {enviando ? "Entrando…" : "Entrar"}
          </button>
          <button type="button" onClick={olvide} className="self-start text-xs font-bold text-osmos-navy2 underline">¿Olvidó su contraseña?</button>
        </form>
        <p className="mt-6 text-xs text-osmos-muted">¿No tiene usuario? Solicítelo al administrador del sistema.</p>
      </div>
    </main>
  );
}
