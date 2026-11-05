"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { etiqueta, formatoDinero, formatoMes } from "@/lib/formato";
import { Aviso, Encabezado, Kpi } from "@/components/ui";
import { Cargando } from "@/components/mensajes";
import { Avance, BarrasAgrupadas, SERIE } from "@/components/graficos";
import { esGerencia, useSesion } from "@/components/sesion";

type Tablero = {
  indicadores: Record<string, number>;
  vendedores: { nombre: string; tipo: string; meta: number | null; facturado: number; facturas: number; cobrado: number }[];
  meses: { mes: string; facturado: number; cobrado: number }[];
  cartera: Record<"corriente" | "d1_30" | "d31_60" | "d61_90" | "mas_90" | "total", number>;
  deudores: { cliente_id: string; cliente: string; total: number; vencido: number }[];
  igualas: { id: string; codigo: string; cliente: string; cuota: number; costo_mensual: number; servicios_90d: number; margen: number; margen_pct: number | null }[];
  flujo: { semana: string; entradas: number; entradas_igualas: number; salidas: number }[];
};

const n = (v: unknown) => Number(v ?? 0);
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesCorto = (f: string) => MESES_CORTOS[Number(f.slice(5, 7)) - 1] ?? f;
const diaMes = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

function Panel({ titulo, detalle, children, accion }: { titulo: string; detalle?: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-osmos-navy">{titulo}</h2>
          {detalle ? <p className="text-xs text-osmos-muted">{detalle}</p> : null}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

export default function Tableros() {
  const { perfil } = useSesion();
  const hoy = new Date();
  const [mes, setMes] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`);
  const [verTabla, setVerTabla] = useState(false);
  const { datos, error, cargando } = useDatos(async () => {
    const { data, error } = await supabase().rpc("tablero_gerencia", { p_mes: `${mes}-01` });
    if (error) throw new Error(error.message);
    return data as Tablero;
  }, [mes]);

  const permitido = esGerencia(perfil?.rol) || perfil?.rol === "contabilidad";

  if (!permitido) return <Aviso tono="warn">Los tableros de gerencia son para gerencia, administración y contabilidad.</Aviso>;

  const t = datos;
  const i = t?.indicadores ?? {};
  const variacion = n(i.facturado_mes_anterior) > 0 ? ((n(i.facturado_mes) - n(i.facturado_mes_anterior)) / n(i.facturado_mes_anterior)) * 100 : null;
  const metaTotal = (t?.vendedores ?? []).reduce((s, v) => s + n(v.meta), 0);
  const ventasConMeta = (t?.vendedores ?? []).filter((v) => n(v.meta) > 0).reduce((s, v) => s + n(v.facturado), 0);

  let acumulado = 0;
  const flujo = (t?.flujo ?? []).map((f) => {
    acumulado += n(f.entradas) - n(f.salidas);
    return { ...f, neto: n(f.entradas) - n(f.salidas), acumulado };
  });
  const cartera = t?.cartera;
  const tramos: [string, number][] = cartera
    ? [["Corriente", n(cartera.corriente)], ["1–30 días", n(cartera.d1_30)], ["31–60 días", n(cartera.d31_60)], ["61–90 días", n(cartera.d61_90)], ["Más de 90", n(cartera.mas_90)]]
    : [];
  const maxTramo = Math.max(1, ...tramos.map(([, v]) => v));

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Tableros de gerencia" }]}
        titulo="Tableros de gerencia"
        descripcion={`Ventas, cartera, igualas y flujo de caja · ${formatoMes(`${mes}-01`)}`}
      >
        <label className="flex items-center gap-2 text-sm">
          <span className="text-osmos-muted">Mes</span>
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="input w-auto" />
        </label>
        <button type="button" onClick={() => window.print()} className="btn-secondary print:hidden">Imprimir</button>
      </Encabezado>

      {error ? <Aviso tono="bad">{error}</Aviso> : null}
      {cargando && !t ? <Cargando /> : null}

      {t ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
            <Kpi titulo="Ventas del mes (sin ITBIS)" valor={formatoDinero(i.facturado_mes)} detalle={variacion === null ? "Sin datos del mes anterior" : `${variacion >= 0 ? "▲" : "▼"} ${Math.abs(variacion).toFixed(1)}% contra el mes anterior`} tono={variacion === null ? "off" : variacion >= 0 ? "ok" : "bad"} />
            <Kpi titulo="Cobrado en el mes" valor={formatoDinero(i.cobrado_mes)} />
            <Kpi titulo="Cartera por cobrar" valor={formatoDinero(i.cartera_total)} detalle={`Vencida: ${formatoDinero(i.cartera_vencida)}`} tono={n(i.cartera_vencida) > 0 ? "bad" : "ok"} />
            <Kpi titulo="Ingreso recurrente (igualas)" valor={formatoDinero(i.ingreso_recurrente)} detalle={`${n(i.igualas_vigentes)} igualas vigentes · por mes`} tono="info" />
            <Kpi titulo="Oportunidades abiertas" valor={formatoDinero(i.pipeline)} detalle={`Ponderado por probabilidad: ${formatoDinero(i.pipeline_ponderado)}`} />
            <Kpi titulo="Cuentas por pagar" valor={formatoDinero(i.por_pagar)} />
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Panel
              titulo="Facturado y cobrado · últimos 12 meses"
              detalle="Montos con ITBIS."
              accion={<button type="button" onClick={() => setVerTabla((v) => !v)} className="text-xs font-bold text-osmos-navy2 underline print:hidden">{verTabla ? "Ver gráfico" : "Ver tabla"}</button>}
            >
              {verTabla ? (
                <table className="w-full text-[13px]">
                  <thead><tr><th className="th">Mes</th><th className="th text-right">Facturado</th><th className="th text-right">Cobrado</th></tr></thead>
                  <tbody>
                    {t.meses.map((m) => (
                      <tr key={m.mes}><td className="td">{formatoMes(m.mes)}</td><td className="td text-right tabular-nums">{formatoDinero(m.facturado)}</td><td className="td text-right tabular-nums">{formatoDinero(m.cobrado)}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <BarrasAgrupadas
                  titulo="Facturado y cobrado por mes"
                  categorias={t.meses.map((m) => mesCorto(m.mes))}
                  series={[
                    { nombre: "Facturado", color: SERIE.azul, valores: t.meses.map((m) => n(m.facturado)) },
                    { nombre: "Cobrado", color: SERIE.turquesa, valores: t.meses.map((m) => n(m.cobrado)) },
                  ]}
                />
              )}
            </Panel>

            <Panel titulo="Flujo de caja proyectado · 8 semanas" detalle={`Entradas: facturas por vencer y próximas cuotas de igualas. Salidas: suplidores, comisiones y nómina. No incluye cartera vencida (${formatoDinero(i.cartera_vencida)}).`}>
              <BarrasAgrupadas
                titulo="Entradas y salidas por semana"
                categorias={flujo.map((f) => diaMes(f.semana))}
                series={[
                  { nombre: "Entradas", color: SERIE.turquesa, valores: flujo.map((f) => n(f.entradas)) },
                  { nombre: "Salidas", color: SERIE.naranja, valores: flujo.map((f) => n(f.salidas)) },
                ]}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr><th className="th px-2">Semana del</th><th className="th px-2 text-right">Entradas</th><th className="th px-2 text-right">Salidas</th><th className="th px-2 text-right">Neto</th><th className="th px-2 text-right">Acumulado</th></tr>
                  </thead>
                  <tbody>
                    {flujo.map((f) => (
                      <tr key={f.semana}>
                        <td className="td px-2">{diaMes(f.semana)}</td>
                        <td className="td px-2 text-right tabular-nums">{formatoDinero(f.entradas)}</td>
                        <td className="td px-2 text-right tabular-nums">{formatoDinero(f.salidas)}</td>
                        <td className={`td px-2 text-right font-semibold tabular-nums ${f.neto < 0 ? "text-[#A12020]" : ""}`}>{formatoDinero(f.neto)}</td>
                        <td className={`td px-2 text-right tabular-nums ${f.acumulado < 0 ? "text-[#A12020]" : ""}`}>{formatoDinero(f.acumulado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel titulo="Ventas contra meta por vendedor" detalle={`Facturado sin ITBIS en ${formatoMes(`${mes}-01`)}. Equipo: ${formatoDinero(ventasConMeta)} de ${formatoDinero(metaTotal)}.`}>
              {t.vendedores.length === 0 ? <p className="text-sm text-osmos-muted">No hay vendedores activos.</p> : null}
              <ul className="flex flex-col gap-3">
                {t.vendedores.map((v, k) => (
                  <li key={k} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                      <span className="font-semibold">{v.nombre} <span className="text-xs font-normal text-osmos-muted">· {etiqueta(v.tipo)}</span></span>
                      <span className="tabular-nums text-osmos-muted">
                        <strong className="text-osmos-ink">{formatoDinero(v.facturado)}</strong>
                        {n(v.meta) > 0 ? ` de ${formatoDinero(v.meta)}` : ""} · {v.facturas} factura(s)
                      </span>
                    </div>
                    <Avance valor={n(v.facturado)} meta={n(v.meta) || null} />
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel titulo="Cartera por antigüedad" detalle={`Total por cobrar: ${formatoDinero(cartera?.total)}`} accion={<Link href="/cobros/antiguedad/" className="text-xs font-bold text-osmos-navy2 underline print:hidden">Ver detalle</Link>}>
              <ul className="flex flex-col gap-2">
                {tramos.map(([nombre, v], k) => (
                  <li key={nombre} className="grid grid-cols-[90px_1fr_120px] items-center gap-2 text-[13px]">
                    <span className="text-osmos-muted">{nombre}</span>
                    <div className="h-3 rounded-sm bg-osmos-soft">
                      {/* Un solo tono que oscurece con los días de atraso */}
                      <div className="h-full rounded-sm" style={{ width: `${(v / maxTramo) * 100}%`, background: ["#F6D2B8", "#EFA676", "#E07B39", "#C2410C", "#8A2E08"][k] }} />
                    </div>
                    <span className="text-right font-semibold tabular-nums">{formatoDinero(v)}</span>
                  </li>
                ))}
              </ul>
              <h3 className="mt-2 text-xs font-bold text-osmos-muted">Clientes con mayor saldo</h3>
              <table className="w-full text-[12px]">
                <thead><tr><th className="th">Cliente</th><th className="th text-right">Saldo</th><th className="th text-right">Vencido</th></tr></thead>
                <tbody>
                  {t.deudores.length === 0 ? <tr><td colSpan={3} className="td text-osmos-muted">No hay saldos pendientes.</td></tr> : null}
                  {t.deudores.map((d) => (
                    <tr key={d.cliente_id}>
                      <td className="td"><Link href={`/cliente/?id=${d.cliente_id}`} className="font-semibold text-osmos-navy2 underline">{d.cliente}</Link></td>
                      <td className="td text-right tabular-nums">{formatoDinero(d.total)}</td>
                      <td className={`td text-right tabular-nums ${n(d.vencido) > 0 ? "font-bold text-[#A12020]" : ""}`}>{formatoDinero(d.vencido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          <Panel titulo="Rentabilidad por iguala" detalle="Cuota mensual contra el costo de insumos incluidos (promedio mensual de los últimos 90 días). No incluye la mano de obra. Las menos rentables aparecen primero.">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    <th className="th">Iguala</th><th className="th">Cliente</th><th className="th text-right">Cuota</th><th className="th text-right">Insumos / mes</th>
                    <th className="th text-right">Servicios (90 días)</th><th className="th text-right">Margen</th><th className="th text-right">Margen %</th>
                  </tr>
                </thead>
                <tbody>
                  {t.igualas.length === 0 ? <tr><td colSpan={7} className="td text-osmos-muted">No hay igualas vigentes.</td></tr> : null}
                  {t.igualas.map((g) => (
                    <tr key={g.id}>
                      <td className="td"><Link href={`/iguala/?id=${g.id}`} className="font-bold text-osmos-navy2 underline">{g.codigo}</Link></td>
                      <td className="td">{g.cliente}</td>
                      <td className="td text-right tabular-nums">{formatoDinero(g.cuota)}</td>
                      <td className="td text-right tabular-nums">{formatoDinero(g.costo_mensual)}</td>
                      <td className="td text-right tabular-nums">{g.servicios_90d}</td>
                      <td className={`td text-right tabular-nums ${n(g.margen) < 0 ? "font-bold text-[#A12020]" : ""}`}>{formatoDinero(g.margen)}</td>
                      <td className="td text-right font-semibold tabular-nums">{g.margen_pct === null ? "—" : `${n(g.margen_pct).toFixed(1)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}
    </>
  );
}
