"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { exportarExcel, leerExcel } from "@/lib/excel";
import { IMPORTABLES, ayudaCampo, camposDe, indiceRelacion, interpretar, tituloColumna, type FilaImportada, type Importable, type Indice } from "@/lib/importacion";
import { buscarModulo, rutaSeccion } from "@/lib/modulos";
import { Aviso, Encabezado } from "@/components/ui";

type Resultado = { filas: FilaImportada[]; faltan: string[]; desconocidas: string[]; archivo: string };

function explicar(msg: string) {
  if (msg.includes("duplicate key")) return "Ya existe un registro con ese código o serie.";
  if (msg.includes("row-level security") || msg.includes("permission denied")) return "Su rol no tiene permiso para guardar en esta sección.";
  if (msg.includes("vendedor_interno_es_empleado")) return "Un vendedor interno debe estar vinculado a un empleado.";
  return msg;
}

export default function Importar() {
  const [imp, setImp] = useState<Importable>(IMPORTABLES[0]);
  const [res, setRes] = useState<Resultado | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState<{ hechos: number; total: number } | null>(null);
  const [final, setFinal] = useState<{ creados: number; fallidos: { numero: number; error: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const campos = camposDe(imp);
  const tabla = imp ? IMPORTABLES.find((x) => x.clave === imp.clave) : null;

  const elegir = (clave: string) => {
    setImp(IMPORTABLES.find((x) => x.clave === clave) ?? IMPORTABLES[0]);
    setRes(null);
    setFinal(null);
    setError(null);
  };

  const plantilla = () =>
    exportarExcel(
      `Plantilla_${imp.titulo.replace(/\s+/g, "_")}`,
      imp.titulo,
      campos.map((c) => ({ titulo: tituloColumna(c), ancho: Math.max(14, c.etiqueta.length + 4) })),
      [],
    );

  const leer = async (archivo: File) => {
    setLeyendo(true);
    setError(null);
    setFinal(null);
    setRes(null);
    try {
      const hoja = await leerExcel(archivo);
      const sb = supabase();
      // Índices para traducir códigos o nombres a registros existentes.
      const indices: Record<string, Indice> = {};
      for (const c of campos.filter((x) => x.tipo === "relacion" && x.relacion)) {
        const r = c.relacion!;
        const cols = new Set(["id", ...r.select.split(","), ...(["clientes", "productos", "vendedores", "suplidores"].includes(r.tabla) ? ["codigo", "nombre"] : [])]);
        const { data, error } = await sb.from(r.tabla).select([...cols].join(",")).limit(20000);
        if (error) throw new Error(error.message);
        indices[c.campo] = indiceRelacion(c, (data ?? []) as unknown as Record<string, unknown>[]);
      }
      const form = (await import("@/lib/formularios")).FORMULARIOS[imp.clave];
      const colsDup = [...new Set(imp.duplicado.flat())];
      const { data: existentes, error: e2 } = await sb.from(form.tabla).select(colsDup.join(",")).limit(50000);
      if (e2) throw new Error(e2.message);
      setRes({ ...interpretar(imp, hoja, indices, (existentes ?? []) as unknown as Record<string, unknown>[]), archivo: archivo.name });
    } catch (e) {
      setError(`No se pudo leer el archivo: ${e instanceof Error ? e.message : String(e)}. Use un archivo .xlsx con la plantilla.`);
    } finally {
      setLeyendo(false);
    }
  };

  const listas = res?.filas.filter((f) => !f.errores.length && !f.duplicado) ?? [];
  const conError = res?.filas.filter((f) => f.errores.length) ?? [];
  const duplicadas = res?.filas.filter((f) => !f.errores.length && f.duplicado) ?? [];

  const importar = async () => {
    if (!listas.length) return;
    const form = (await import("@/lib/formularios")).FORMULARIOS[imp.clave];
    const sb = supabase();
    let creados = 0;
    const fallidos: { numero: number; error: string }[] = [];
    setGuardando({ hechos: 0, total: listas.length });
    for (let i = 0; i < listas.length; i += 100) {
      const bloque = listas.slice(i, i + 100);
      const { error } = await sb.from(form.tabla).insert(bloque.map((f) => f.valores));
      if (!error) {
        creados += bloque.length;
      } else {
        // Si el bloque falla, se guarda fila por fila para saber cuál tiene el problema.
        for (const f of bloque) {
          const r = await sb.from(form.tabla).insert(f.valores);
          if (r.error) fallidos.push({ numero: f.numero, error: explicar(r.error.message) });
          else creados++;
        }
      }
      setGuardando({ hechos: Math.min(listas.length, i + 100), total: listas.length });
    }
    setGuardando(null);
    setFinal({ creados, fallidos });
    setRes(null);
  };

  const [modulo, seccion] = imp.clave.split("/");
  const m = buscarModulo(modulo);
  const s = m?.secciones.find((x) => x.slug === seccion);
  const columnasVista = campos.filter((c) => c.requerido || ["codigo", "nombre", "serie", "descripcion"].includes(c.campo)).slice(0, 4);

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Configuración", href: "/configuracion/" }, { texto: "Importar desde Excel" }]}
        titulo="Importar desde Excel"
        descripcion="Descargue la plantilla, llénela en Excel y súbala. Antes de guardar verá qué filas están listas y cuáles tienen errores."
      />

      <section className="card grid gap-4 p-4 md:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-1">
          <span className="label">1. ¿Qué desea importar?</span>
          {IMPORTABLES.map((x) => (
            <label key={x.clave} className={`flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm ${x.clave === imp.clave ? "bg-osmos-hover" : "hover:bg-osmos-bg"}`}>
              <input type="radio" name="tipo" checked={x.clave === imp.clave} onChange={() => elegir(x.clave)} className="mt-1 accent-osmos-navy" />
              <span className="flex flex-col">
                <strong className="text-osmos-navy">{x.titulo}</strong>
                <span className="text-xs text-osmos-muted">{x.descripcion}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="label">2. Descargue la plantilla de {tabla?.titulo.toLowerCase()}</span>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={plantilla} className="btn-secondary">Descargar plantilla (.xlsx)</button>
              <span className="text-xs text-osmos-muted">Las columnas con * son obligatorias. Puede borrar las columnas que no use.</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr><th className="th">Columna</th><th className="th">Qué escribir</th></tr></thead>
                <tbody>
                  {campos.map((c) => (
                    <tr key={c.campo}>
                      <td className="td font-semibold">{tituloColumna(c)}</td>
                      <td className="td whitespace-normal text-osmos-muted">{[ayudaCampo(c), c.ayuda].filter(Boolean).join(" · ") || "Texto"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="label" htmlFor="archivo">3. Suba el archivo lleno</label>
            <input
              id="archivo"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) leer(f);
                e.target.value = "";
              }}
              className="text-sm file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-osmos-navy file:px-4 file:font-bold file:text-white"
            />
            {leyendo ? <p className="text-sm text-osmos-muted">Revisando el archivo…</p> : null}
          </div>
        </div>
      </section>

      {error ? <Aviso tono="bad">{error}</Aviso> : null}

      {final ? (
        <Aviso tono={final.fallidos.length ? "warn" : "ok"}>
          Se crearon {final.creados} registro(s) de {imp.titulo.toLowerCase()}.
          {final.fallidos.length ? ` ${final.fallidos.length} fila(s) no se guardaron: ${final.fallidos.slice(0, 5).map((f) => `fila ${f.numero} (${f.error})`).join("; ")}.` : ""}
          {m && s ? <> <Link href={rutaSeccion(m, s)} className="font-bold underline">Ver {s.nombre.toLowerCase()}</Link></> : null}
        </Aviso>
      ) : null}

      {res ? (
        <section className="card flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-osmos-line p-4">
            <div className="flex flex-col gap-0.5 text-sm">
              <strong className="text-osmos-navy">4. Revise y confirme · {res.archivo}</strong>
              <span>
                <strong className="text-[#1D6B3A]">{listas.length} lista(s) para importar</strong>
                {" · "}<span className={conError.length ? "font-bold text-[#A12020]" : ""}>{conError.length} con errores</span>
                {" · "}{duplicadas.length} ya existen (se omiten)
              </span>
            </div>
            <button type="button" disabled={!listas.length || guardando !== null || res.faltan.length > 0} onClick={importar} className="btn-primary">
              {guardando ? `Guardando ${guardando.hechos} de ${guardando.total}…` : `Importar ${listas.length} registro(s)`}
            </button>
          </div>
          {res.faltan.length ? <div className="p-4 pb-0"><Aviso tono="bad">Faltan columnas obligatorias en el archivo: {res.faltan.join(", ")}. Use la plantilla.</Aviso></div> : null}
          {res.desconocidas.length ? <div className="p-4 pb-0"><Aviso tono="warn">Estas columnas no se reconocieron y se ignorarán: {res.desconocidas.join(", ")}.</Aviso></div> : null}
          <div className="overflow-x-auto p-1">
            <table className="w-full text-[12px]">
              <thead>
                <tr>
                  <th className="th">Fila</th>
                  <th className="th">Estado</th>
                  {columnasVista.map((c) => <th key={c.campo} className="th">{c.etiqueta}</th>)}
                  <th className="th">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {[...conError, ...duplicadas, ...listas].slice(0, 300).map((f) => (
                  <tr key={f.numero}>
                    <td className="td tabular-nums">{f.numero}</td>
                    <td className="td">
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${f.errores.length ? "bg-[#FDE7E7] text-[#A12020]" : f.duplicado ? "bg-[#EEF0F4] text-osmos-muted" : "bg-[#E3F4E8] text-[#1D6B3A]"}`}>
                        {f.errores.length ? "Error" : f.duplicado ? "Ya existe" : "Lista"}
                      </span>
                    </td>
                    {columnasVista.map((c) => (
                      <td key={c.campo} className="td">{c.tipo === "relacion" ? (f.valores[c.campo] ? "✓" : "—") : String(f.valores[c.campo] ?? "—")}</td>
                    ))}
                    <td className="td whitespace-normal text-[#A12020]">{f.errores.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {res.filas.length > 300 ? <p className="p-3 text-xs text-osmos-muted">Se muestran las primeras 300 filas de {res.filas.length}.</p> : null}
            {res.filas.length === 0 ? <p className="p-3 text-sm text-osmos-muted">El archivo no tiene filas con datos.</p> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
