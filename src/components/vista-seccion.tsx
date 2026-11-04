"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { buscarModulo, rutaSeccion } from "@/lib/modulos";
import { Aviso, Encabezado, Pestanas } from "./ui";
import { TablaInteractiva } from "./tabla";
import { MensajesUrl } from "./mensajes";
import { buscarFormulario, nuevoTexto } from "@/lib/formularios";

export function VistaSeccion({ modulo, seccion }: { modulo: string; seccion: string }) {
  const m = buscarModulo(modulo);
  const s = m?.secciones.find((x) => x.slug === seccion);
  const [aviso, setAviso] = useState<{ tono: "ok" | "bad"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const { datos, error, cargando, recargar } = useDatos(async () => {
    if (!s?.tabla) return [];
    // Se traen todos los registros en bloques de 1,000 (hasta 20,000) para buscar y filtrar en pantalla.
    const filas: Record<string, unknown>[] = [];
    for (let desde = 0; desde < 20000; desde += 1000) {
      let q = supabase().from(s.tabla).select(s.select ?? "*");
      if (s.orden) q = q.order(s.orden.campo, { ascending: s.orden.asc ?? true, nullsFirst: false });
      const r = await q.range(desde, desde + 999);
      if (r.error) throw new Error(r.error.message);
      filas.push(...((r.data ?? []) as unknown as Record<string, unknown>[]));
      if ((r.data ?? []).length < 1000) break;
    }
    return filas;
  }, [modulo, seccion]);

  if (!m || !s) return <Aviso tono="bad">Esta sección no existe.</Aviso>;
  const formulario = buscarFormulario(modulo, seccion);
  const volverAqui = encodeURIComponent(rutaSeccion(m, s));

  const ejecutar = async (rpc: string, etiqueta: string, conPeriodo: boolean) => {
    setOcupado(rpc);
    setAviso(null);
    const args = conPeriodo ? { p_periodo: new Date().toISOString().slice(0, 10) } : {};
    const { data, error } = await supabase().rpc(rpc, args);
    setOcupado(null);
    if (error) {
      setAviso({ tono: "bad", texto: `No se pudo completar: ${error.message}` });
      return;
    }
    setAviso({ tono: "ok", texto: typeof data === "number" ? `${etiqueta}: ${data} registro(s) procesado(s).` : `${etiqueta}: completado.` });
    recargar();
  };

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: m.nombre, href: `/${m.slug}/` }, { texto: s.nombre }]}
        titulo={s.nombre}
        descripcion={s.descripcion ?? m.descripcion}
      >
        {s.nuevo ? (
          <Link href={s.nuevo.href} className="btn-primary">
            {s.nuevo.etiqueta}
          </Link>
        ) : formulario ? (
          <Link href={`/editar/?f=${modulo}/${seccion}`} className="btn-primary">
            {nuevoTexto(formulario)}
          </Link>
        ) : null}
        {s.acciones?.map((a) => (
          <button
            key={a.rpc}
            type="button"
            disabled={ocupado !== null}
            onClick={() => ejecutar(a.rpc, a.etiqueta, a.parametros === "periodo")}
            className={s.nuevo ? "btn-secondary" : "btn-primary"}
          >
            {ocupado === a.rpc ? "Procesando…" : a.etiqueta}
          </button>
        ))}
      </Encabezado>

      <Pestanas items={m.secciones.map((x) => ({ slug: x.slug, nombre: x.nombre, href: rutaSeccion(m, x) }))} activa={s.slug} />

      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : <MensajesUrl />}

      <section className="card flex flex-col">
        {error ? (
          <div className="p-4">
            <Aviso tono="bad">Error al consultar: {error}</Aviso>
          </div>
        ) : (
          <TablaInteractiva
            columnas={s.columnas ?? []}
            filas={datos ?? []}
            cargando={cargando}
            archivo={`${m.nombre} - ${s.nombre}`}
            editar={formulario ? (f) => `/editar/?f=${modulo}/${seccion}&id=${f.id}&volver=${volverAqui}` : undefined}
          />
        )}
      </section>
    </>
  );
}
