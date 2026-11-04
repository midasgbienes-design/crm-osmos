import Link from "next/link";
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
