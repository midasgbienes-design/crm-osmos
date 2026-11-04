"use client";

import { useSearchParams } from "next/navigation";
import { Aviso } from "./ui";

// Muestra los mensajes ?ok= y ?error= que dejan las acciones al volver a una pantalla.
export function MensajesUrl({ error }: { error?: string | null }) {
  const sp = useSearchParams();
  const ok = sp.get("ok");
  const err = error ?? sp.get("error");
  return (
    <>
      {ok ? <Aviso tono="ok">{ok}</Aviso> : null}
      {err ? <Aviso tono="bad">{err}</Aviso> : null}
    </>
  );
}

export function Cargando() {
  return <p className="text-sm text-osmos-muted">Cargando…</p>;
}

export function conMensaje(ruta: string, tipo: "ok" | "error", texto: string) {
  const sep = ruta.includes("?") ? "&" : "?";
  return `${ruta}${sep}${tipo}=${encodeURIComponent(texto)}`;
}
