"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { etiqueta } from "@/lib/formato";
import { Aviso, Encabezado } from "@/components/ui";
import { useSesion } from "@/components/sesion";

export default function MiCuenta() {
  const { usuario, perfil } = useSesion();
  const recuperar = useSearchParams().get("recuperar");
  const [aviso, setAviso] = useState<{ tono: "ok" | "bad"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cambiar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const nueva = String(f.get("nueva"));
    if (nueva !== String(f.get("repetir"))) {
      setAviso({ tono: "bad", texto: "Las dos contraseñas no coinciden." });
      return;
    }
    setGuardando(true);
    const { error } = await supabase().auth.updateUser({ password: nueva });
    setGuardando(false);
    if (error) {
      const m = error.message.toLowerCase();
      setAviso({
        tono: "bad",
        texto: m.includes("same") ? "La contraseña nueva debe ser distinta a la actual." : m.includes("weak") || m.includes("characters") ? "La contraseña es muy débil: use al menos 8 caracteres con letras y números." : `No se pudo cambiar: ${error.message}`,
      });
      return;
    }
    form.reset();
    setAviso({ tono: "ok", texto: "Contraseña cambiada. Úsela la próxima vez que entre." });
  };

  return (
    <>
      <Encabezado migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Mi cuenta" }]} titulo="Mi cuenta" descripcion={`${perfil?.nombre ?? ""} · ${usuario.email ?? ""} · ${etiqueta(perfil?.rol ?? "consulta")}`} />
      {recuperar ? <Aviso tono="info">Escriba su contraseña nueva para terminar.</Aviso> : null}
      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}
      <form onSubmit={cambiar} className="card grid max-w-md gap-4 p-5">
        <h2 className="text-sm font-bold text-osmos-navy">Cambiar contraseña</h2>
        <div>
          <label className="label" htmlFor="nueva">Contraseña nueva</label>
          <input id="nueva" name="nueva" type="password" minLength={8} required autoComplete="new-password" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="repetir">Repítala</label>
          <input id="repetir" name="repetir" type="password" minLength={8} required autoComplete="new-password" className="input" />
        </div>
        <button type="submit" disabled={guardando} className="btn-primary h-10">{guardando ? "Guardando…" : "Guardar contraseña"}</button>
      </form>
    </>
  );
}
