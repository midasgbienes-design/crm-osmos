"use client";

import { useState } from "react";
import { formatoDinero } from "@/lib/formato";

// Colores de series validados para daltonismo y contraste (ver dataviz).
export const SERIE = { azul: "#3366CC", turquesa: "#0093A5", naranja: "#C2410C" };

export function compacto(n: number) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)} M`;
  if (a >= 1000) return `${Math.round(n / 1000)} K`;
  return String(Math.round(n));
}

function escala(max: number) {
  if (max <= 0) return { tope: 1, pasos: [0] };
  const bruto = max / 4;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? bruto;
  const tope = paso * Math.ceil(max / paso);
  const pasos: number[] = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) pasos.push(v);
  return { tope, pasos };
}

export type Serie = { nombre: string; color: string; valores: number[] };

// Barras agrupadas con un solo eje (montos en RD$), leyenda y detalle al pasar el cursor.
export function BarrasAgrupadas({ categorias, series, alto = 220, titulo }: { categorias: string[]; series: Serie[]; alto?: number; titulo: string }) {
  const [activo, setActivo] = useState<number | null>(null);
  const ancho = 680;
  const m = { arriba: 12, derecha: 8, abajo: 30, izquierda: 60 };
  const w = ancho - m.izquierda - m.derecha;
  const h = alto - m.arriba - m.abajo;
  const max = Math.max(0, ...series.flatMap((s) => s.valores));
  const { tope, pasos } = escala(max);
  const banda = w / Math.max(1, categorias.length);
  const grupo = banda * 0.72;
  const barra = Math.max(2, (grupo - 2 * (series.length - 1)) / series.length);
  const y = (v: number) => m.arriba + h - (Math.max(0, v) / tope) * h;

  return (
    <figure className="relative flex flex-col gap-2">
      <figcaption className="sr-only">{titulo}</figcaption>
      <div className="flex flex-wrap gap-4 text-xs text-osmos-muted" aria-hidden="true">
        {series.map((s) => (
          <span key={s.nombre} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.nombre}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="h-auto w-full" role="img" aria-label={titulo} onMouseLeave={() => setActivo(null)}>
        {pasos.map((p) => (
          <g key={p}>
            <line x1={m.izquierda} x2={ancho - m.derecha} y1={y(p)} y2={y(p)} stroke="#E4E8F0" strokeWidth={1} />
            <text x={m.izquierda - 6} y={y(p) + 4} textAnchor="end" fontSize={14} fill="#4A5A7E">{compacto(p)}</text>
          </g>
        ))}
        {categorias.map((c, i) => {
          const x0 = m.izquierda + i * banda + (banda - grupo) / 2;
          return (
            <g key={c} onMouseEnter={() => setActivo(i)} onFocus={() => setActivo(i)} tabIndex={0} aria-label={`${c}: ${series.map((s) => `${s.nombre} ${formatoDinero(s.valores[i])}`).join(", ")}`}>
              <rect x={m.izquierda + i * banda} y={m.arriba} width={banda} height={h} fill={activo === i ? "#EEF3FA" : "transparent"} />
              {series.map((s, j) => {
                const v = s.valores[i] ?? 0;
                const alto0 = Math.max(0, m.arriba + h - y(v));
                const x = x0 + j * (barra + 2);
                return alto0 > 0 ? (
                  <path key={s.nombre} d={`M${x},${m.arriba + h} v${-Math.max(0, alto0 - 3)} q0,-3 3,-3 h${barra - 6} q3,0 3,3 v${Math.max(0, alto0 - 3)} z`} fill={s.color} />
                ) : null;
              })}
              <text x={m.izquierda + i * banda + banda / 2} y={alto - 9} textAnchor="middle" fontSize={14} fill="#4A5A7E">{c}</text>
            </g>
          );
        })}
        <line x1={m.izquierda} x2={ancho - m.derecha} y1={m.arriba + h} y2={m.arriba + h} stroke="#B8C4DD" strokeWidth={1} />
      </svg>
      {activo !== null ? (
        <div className="pointer-events-none absolute right-2 top-0 rounded-md border border-osmos-line bg-white px-3 py-2 text-xs shadow-md">
          <strong className="mb-1 block text-osmos-navy">{categorias[activo]}</strong>
          {series.map((s) => (
            <span key={s.nombre} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
              {s.nombre}: <strong className="tabular-nums">{formatoDinero(s.valores[activo])}</strong>
            </span>
          ))}
        </div>
      ) : null}
    </figure>
  );
}

// Barra horizontal de avance contra una meta.
export function Avance({ valor, meta }: { valor: number; meta: number | null }) {
  const pct = meta && meta > 0 ? (valor / meta) * 100 : null;
  const ancho = pct === null ? 0 : Math.min(100, pct);
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2.5 flex-1 rounded-full bg-osmos-soft" role="progressbar" aria-valuenow={pct === null ? undefined : Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full" style={{ width: `${ancho}%`, background: SERIE.turquesa }} />
      </div>
      <span className="w-16 whitespace-nowrap text-right text-xs font-bold tabular-nums">{pct === null ? "Sin meta" : `${Math.round(pct)}%`}</span>
    </div>
  );
}
