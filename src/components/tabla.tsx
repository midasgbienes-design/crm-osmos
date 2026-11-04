"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { exportarExcel, nombreArchivo, type TipoExcel } from "@/lib/excel";
import type { Columna } from "@/lib/modulos";
import { etiqueta, formatoDinero, formatoFecha, formatoMes, formatoNumero } from "@/lib/formato";
import { Estado } from "./ui";

type Fila = Record<string, unknown>;

export function valorEn(fila: Fila, ruta: string): unknown {
  return ruta.split(".").reduce<unknown>((acc, k) => {
    const base = Array.isArray(acc) ? acc[0] : acc;
    if (base === null || base === undefined || typeof base !== "object") return undefined;
    return (base as Fila)[k];
  }, fila);
}

function plantilla(t: string, fila: Fila) {
  return t.replace(/\{(\w+)\}/g, (_, k) => String(fila[k] ?? ""));
}

function Celda({ col, fila }: { col: Columna; fila: Fila }) {
  const v = valorEn(fila, col.campo);
  switch (col.tipo) {
    case "dinero":
      return <>{formatoDinero(v)}</>;
    case "fecha":
      return <>{formatoFecha(v)}</>;
    case "mes":
      return <>{formatoMes(v)}</>;
    case "numero":
      return <>{formatoNumero(v)}</>;
    case "pct":
      return <>{v === null || v === undefined ? "—" : `${formatoNumero(v)}%`}</>;
    case "estado":
      return <Estado valor={v} />;
    case "etiqueta":
      return <>{etiqueta(v)}</>;
    case "codigo":
      return <span className="font-semibold text-osmos-navy2">{v === null || v === undefined ? "—" : String(v)}</span>;
    case "enlace":
      return col.enlace && v ? (
        <Link href={plantilla(col.enlace, fila)} className="font-bold text-osmos-navy2 underline">
          {String(v)}
        </Link>
      ) : (
        <>{v ? String(v) : "—"}</>
      );
    default:
      return <>{v === null || v === undefined || v === "" ? "—" : String(v)}</>;
  }
}

const NUMERICOS = new Set(["dinero", "numero", "pct"]);

export function Tabla({
  columnas,
  filas,
  vacio = "No hay registros todavía.",
  editar,
}: {
  columnas: Columna[];
  filas: Fila[];
  vacio?: string;
  editar?: (fila: Fila) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-[#F7F9FC]">
            {columnas.map((c) => (
              <th key={c.campo} scope="col" className={`th ${NUMERICOS.has(c.tipo ?? "") ? "text-right" : ""}`}>
                {c.etiqueta}
              </th>
            ))}
            {editar ? <th scope="col" className="th"><span className="sr-only">Acciones</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr>
              <td className="td text-osmos-muted" colSpan={columnas.length + (editar ? 1 : 0)}>
                {vacio}
              </td>
            </tr>
          ) : (
            filas.map((f, i) => (
              <tr key={String(f.id ?? i)} className="hover:bg-[#FAFBFD]">
                {columnas.map((c) => (
                  <td key={c.campo} className={`td ${NUMERICOS.has(c.tipo ?? "") ? "text-right tabular-nums" : ""}`}>
                    <Celda col={c} fila={f} />
                  </td>
                ))}
                {editar ? (
                  <td className="td text-right">
                    <Link href={editar(f)} className="font-bold text-osmos-navy2 underline">Editar</Link>
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------
// Tabla con búsqueda, filtros, orden, páginas, totales y exportación a Excel.
// ---------------------------------------------------------------------

const POR_PAGINA = 50;

// Texto que ve el usuario en la celda: se usa para buscar.
function textoCelda(col: Columna, fila: Fila): string {
  const v = valorEn(fila, col.campo);
  if (v === null || v === undefined) return "";
  switch (col.tipo) {
    case "dinero":
      return formatoDinero(v);
    case "fecha":
      return formatoFecha(v);
    case "mes":
      return formatoMes(v);
    case "estado":
    case "etiqueta":
      return etiqueta(v);
    default:
      return String(v);
  }
}

function comparar(col: Columna, a: Fila, b: Fila) {
  const x = valorEn(a, col.campo);
  const y = valorEn(b, col.campo);
  if (x === y) return 0;
  if (x === null || x === undefined || x === "") return 1;
  if (y === null || y === undefined || y === "") return -1;
  if (NUMERICOS.has(col.tipo ?? "")) return Number(x) - Number(y);
  if (col.tipo === "fecha" || col.tipo === "mes") return String(x).localeCompare(String(y));
  return textoCelda(col, a).localeCompare(textoCelda(col, b), "es", { numeric: true, sensitivity: "base" });
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function TablaInteractiva({
  columnas,
  filas,
  vacio = "No hay registros todavía.",
  editar,
  archivo,
  cargando,
}: {
  columnas: Columna[];
  filas: Fila[];
  vacio?: string;
  editar?: (fila: Fila) => string;
  archivo: string;
  cargando?: boolean;
}) {
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [orden, setOrden] = useState<{ campo: string; asc: boolean } | null>(null);
  const [pagina, setPagina] = useState(0);
  const [exportando, setExportando] = useState(false);

  // Filtros de lista para columnas de estado o tipo con pocos valores distintos.
  const opciones = useMemo(() => {
    const r: { col: Columna; valores: string[] }[] = [];
    for (const c of columnas) {
      if (c.tipo !== "estado" && c.tipo !== "etiqueta") continue;
      const set = new Set<string>();
      for (const f of filas) {
        const v = valorEn(f, c.campo);
        if (v !== null && v !== undefined && v !== "") set.add(String(v));
      }
      if (set.size >= 2 && set.size <= 30) r.push({ col: c, valores: [...set].sort((a, b) => etiqueta(a).localeCompare(etiqueta(b), "es")) });
    }
    return r;
  }, [columnas, filas]);
  const colFecha = columnas.find((c) => c.tipo === "fecha");

  const visibles = useMemo(() => {
    const t = sinAcentos(q.trim());
    let r = filas.filter((f) => {
      for (const [campo, valor] of Object.entries(filtros)) {
        if (valor && String(valorEn(f, campo) ?? "") !== valor) return false;
      }
      if (colFecha && (desde || hasta)) {
        const v = String(valorEn(f, colFecha.campo) ?? "").slice(0, 10);
        if (!v) return false;
        if (desde && v < desde) return false;
        if (hasta && v > hasta) return false;
      }
      if (t) {
        const texto = sinAcentos(columnas.map((c) => textoCelda(c, f)).join(" "));
        if (!t.split(/\s+/).every((p) => texto.includes(p))) return false;
      }
      return true;
    });
    if (orden) {
      const col = columnas.find((c) => c.campo === orden.campo);
      if (col) r = [...r].sort((a, b) => (orden.asc ? 1 : -1) * comparar(col, a, b));
    }
    return r;
  }, [filas, filtros, q, desde, hasta, orden, columnas, colFecha]);

  // Al cambiar los filtros se vuelve a la primera página.
  useEffect(() => setPagina(0), [q, filtros, desde, hasta, orden]);

  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas - 1);
  const enPagina = visibles.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA);
  const totales = columnas.filter((c) => c.tipo === "dinero");
  const hayFiltros = Boolean(q || desde || hasta || Object.values(filtros).some(Boolean));

  const exportar = async () => {
    setExportando(true);
    try {
      const tipo = (c: Columna) => (c.tipo === "dinero" ? "dinero" : c.tipo === "numero" || c.tipo === "pct" ? "numero" : c.tipo === "fecha" ? "fecha" : "texto") as TipoExcel;
      await exportarExcel(
        nombreArchivo(archivo),
        archivo,
        columnas.map((c) => ({ titulo: c.etiqueta, tipo: tipo(c), ancho: c.tipo === "dinero" ? 16 : undefined })),
        visibles.map((f) => columnas.map((c) => (["dinero", "numero", "pct", "fecha"].includes(c.tipo ?? "") ? valorEn(f, c.campo) : textoCelda(c, f)))),
      );
    } finally {
      setExportando(false);
    }
  };

  const ordenar = (campo: string) =>
    setOrden((o) => (o?.campo === campo ? (o.asc ? { campo, asc: false } : null) : { campo, asc: true }));

  return (
    <>
      <div className="flex flex-wrap items-end gap-2 border-b border-osmos-line px-3.5 py-3 print:hidden">
        <label className="flex min-w-[200px] flex-1 flex-col">
          <span className="sr-only">Buscar</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en esta lista…" className="input" />
        </label>
        {opciones.map(({ col, valores }) => (
          <label key={col.campo} className="flex flex-col">
            <span className="label mb-0.5">{col.etiqueta}</span>
            <select value={filtros[col.campo] ?? ""} onChange={(e) => setFiltros((f) => ({ ...f, [col.campo]: e.target.value }))} className="input w-auto min-w-[130px]">
              <option value="">Todos</option>
              {valores.map((v) => <option key={v} value={v}>{etiqueta(v)}</option>)}
            </select>
          </label>
        ))}
        {colFecha ? (
          <>
            <label className="flex flex-col">
              <span className="label mb-0.5">{colFecha.etiqueta} desde</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="input w-auto" />
            </label>
            <label className="flex flex-col">
              <span className="label mb-0.5">hasta</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input w-auto" />
            </label>
          </>
        ) : null}
        {hayFiltros ? (
          <button type="button" onClick={() => { setQ(""); setFiltros({}); setDesde(""); setHasta(""); }} className="btn-secondary">Limpiar</button>
        ) : null}
        <button type="button" onClick={exportar} disabled={exportando || visibles.length === 0} className="btn-secondary ml-auto">
          {exportando ? "Exportando…" : "Exportar a Excel"}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-[13px] text-osmos-muted">
        <span>
          {cargando ? "Cargando…" : hayFiltros ? `${visibles.length} de ${filas.length} registros` : `${filas.length} registros`}
        </span>
        {totales.length && visibles.length ? (
          <span className="flex flex-wrap gap-x-4">
            {totales.map((c) => (
              <span key={c.campo}>
                {c.etiqueta}: <strong className="tabular-nums text-osmos-navy">{formatoDinero(visibles.reduce((t, f) => t + Number(valorEn(f, c.campo) ?? 0), 0))}</strong>
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F7F9FC]">
              {columnas.map((c) => {
                const activo = orden?.campo === c.campo;
                return (
                  <th key={c.campo} scope="col" aria-sort={activo ? (orden.asc ? "ascending" : "descending") : "none"} className={`th ${NUMERICOS.has(c.tipo ?? "") ? "text-right" : ""}`}>
                    <button type="button" onClick={() => ordenar(c.campo)} className={`inline-flex items-center gap-1 hover:text-osmos-navy ${activo ? "text-osmos-navy" : ""}`}>
                      {c.etiqueta}
                      <span aria-hidden="true" className="text-[10px]">{activo ? (orden.asc ? "▲" : "▼") : "↕"}</span>
                    </button>
                  </th>
                );
              })}
              {editar ? <th scope="col" className="th"><span className="sr-only">Acciones</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {enPagina.length === 0 ? (
              <tr>
                <td className="td text-osmos-muted" colSpan={columnas.length + (editar ? 1 : 0)}>
                  {cargando ? "Cargando…" : hayFiltros ? "Ningún registro coincide con la búsqueda." : vacio}
                </td>
              </tr>
            ) : (
              enPagina.map((f, i) => (
                <tr key={String(f.id ?? i)} className="hover:bg-[#FAFBFD]">
                  {columnas.map((c) => (
                    <td key={c.campo} className={`td ${NUMERICOS.has(c.tipo ?? "") ? "text-right tabular-nums" : ""}`}>
                      <Celda col={c} fila={f} />
                    </td>
                  ))}
                  {editar ? (
                    <td className="td text-right">
                      <Link href={editar(f)} className="font-bold text-osmos-navy2 underline">Editar</Link>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {paginas > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-end gap-2 px-3.5 py-3 text-[13px]">
          <button type="button" disabled={pag === 0} onClick={() => setPagina(pag - 1)} className="btn-secondary h-8">Anterior</button>
          <span className="text-osmos-muted">Página {pag + 1} de {paginas}</span>
          <button type="button" disabled={pag >= paginas - 1} onClick={() => setPagina(pag + 1)} className="btn-secondary h-8">Siguiente</button>
        </nav>
      ) : null}
    </>
  );
}
