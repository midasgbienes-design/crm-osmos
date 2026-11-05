"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { formatoFecha } from "@/lib/formato";
import { Aviso, Encabezado } from "@/components/ui";
import { Cargando } from "@/components/mensajes";
import { useSesion } from "@/components/sesion";

type Parametro = { clave: string; valor: number | null; texto: string | null; descripcion: string | null; vigente_desde: string | null };

export default function Parametros() {
  const { perfil } = useSesion();
  const [aviso, setAviso] = useState<{ tono: "ok" | "bad"; texto: string } | null>(null);
  const { datos, error, cargando, recargar } = useDatos(async () => {
    const { data, error } = await supabase().from("parametros").select("*").order("clave");
    if (error) throw new Error(error.message);
    return (data ?? []) as Parametro[];
  }, []);
  const admin = perfil?.rol === "admin";

  const guardar = async (p: Parametro, valor: string) => {
    const n = Number(valor.replace(/,/g, ""));
    if (valor.trim() === "" || !Number.isFinite(n)) {
      setAviso({ tono: "bad", texto: `${p.descripcion ?? p.clave}: escriba un número.` });
      return;
    }
    if (n === Number(p.valor)) return;
    const { error } = await supabase().from("parametros").update({ valor: n, vigente_desde: new Date().toLocaleDateString("sv-SE") }).eq("clave", p.clave);
    setAviso(error ? { tono: "bad", texto: error.message } : { tono: "ok", texto: `${p.descripcion ?? p.clave}: ahora es ${n}.` });
    recargar();
  };

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Configuración", href: "/configuracion/" }, { texto: "Parámetros" }]}
        titulo="Parámetros"
        descripcion="Valores que usan los cálculos del sistema. Verifique tasas de TSS, ISR e ITBIS con su contador."
      />
      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}
      {error ? <Aviso tono="bad">{error}</Aviso> : null}
      {cargando && !datos ? <Cargando /> : null}
      <section className="card overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="bg-[#F7F9FC]"><th className="th">Parámetro</th><th className="th text-right">Valor</th><th className="th">Vigente desde</th></tr></thead>
          <tbody>
            {(datos ?? []).map((p) => (
              <tr key={p.clave}>
                <td className="td whitespace-normal"><strong>{p.descripcion ?? p.clave}</strong><span className="block text-xs text-osmos-muted">{p.clave}</span></td>
                <td className="td text-right">
                  <label className="sr-only" htmlFor={`p-${p.clave}`}>{p.descripcion ?? p.clave}</label>
                  <input
                    id={`p-${p.clave}`}
                    key={`${p.clave}-${p.valor}`}
                    defaultValue={p.valor ?? ""}
                    disabled={!admin}
                    inputMode="decimal"
                    onBlur={(e) => guardar(p, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="input ml-auto w-28 text-right"
                  />
                </td>
                <td className="td">{formatoFecha(p.vigente_desde)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-osmos-muted">El cambio se guarda al salir de la casilla.</p>
    </>
  );
}
