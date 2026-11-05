"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { MODULOS, rutaSeccion } from "@/lib/modulos";
import { formatoDinero, formatoFecha, formatoNumero } from "@/lib/formato";
import { Encabezado, Kpi } from "@/components/ui";
import { cargarAvisos } from "@/lib/avisos";

const suma = (filas: Record<string, unknown>[] | null, campo: string) =>
  filas ? filas.reduce((t, f) => t + Number(f[campo] ?? 0), 0) : null;

export default function Inicio() {
  const { datos } = useDatos(async () => {
    const sb = supabase();
    const [cxc, cxp, igualas, prospectos, reposiciones] = await Promise.all([
      sb.from("facturas").select("saldo").gt("saldo", 0).not("estado", "in", "(anulada,borrador)"),
      sb.from("facturas_suplidor").select("saldo").gt("saldo", 0).neq("estado", "anulada"),
      sb.from("igualas").select("cuota_mensual").in("estado", ["vigente", "por_renovar"]),
      sb.from("prospectos").select("id", { count: "exact", head: true }).in("estado", ["nuevo", "contactado", "calificado"]),
      sb.from("v_base_instalada").select("componente_id", { count: "exact", head: true }).in("estado_reposicion", ["vencido", "proximo"]),
    ]);
    return {
      porCobrar: cxc.error ? null : suma(cxc.data, "saldo"),
      porPagar: cxp.error ? null : suma(cxp.data, "saldo"),
      recurrente: igualas.error ? null : suma(igualas.data, "cuota_mensual"),
      igualas: igualas.data?.length ?? 0,
      prospectos: prospectos.error ? null : prospectos.count ?? 0,
      reposiciones: reposiciones.error ? null : reposiciones.count ?? 0,
    };
  });

  const { datos: avisos } = useDatos(() => cargarAvisos().catch(() => []), []);
  const importantes = (avisos ?? []).filter((a) => a.prioridad <= 2);

  const v = (n: number | null | undefined, f: (x: number) => string) => (n === null || n === undefined ? "—" : f(n));

  return (
    <>
      <Encabezado migas={[{ texto: "Osmos ERP" }, { texto: "Inicio" }]} titulo="Inicio" descripcion="Resumen de la empresa y acceso a todas las funciones del sistema" />

      <section aria-label="Indicadores" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <Kpi titulo="Cuentas por cobrar" valor={v(datos?.porCobrar, formatoDinero)} tono="info" detalle="Saldo de facturas abiertas" />
        <Kpi titulo="Cuentas por pagar" valor={v(datos?.porPagar, formatoDinero)} tono="warn" detalle="Suplidores y vendedores externos" />
        <Kpi titulo="Ingreso recurrente (igualas)" valor={v(datos?.recurrente, formatoDinero)} tono="ok" detalle={`${datos?.igualas ?? 0} igualas activas`} />
        <Kpi titulo="Prospectos abiertos" valor={v(datos?.prospectos, formatoNumero)} tono="info" detalle="Nuevos, contactados y calificados" />
        <Kpi titulo="Reposiciones pendientes" valor={v(datos?.reposiciones, formatoNumero)} tono="warn" detalle="Base instalada, próximos 60 días" />
      </section>

      {importantes.length ? (
        <section aria-label="Avisos de hoy" className="card flex flex-col">
          <div className="flex items-center justify-between border-b border-osmos-line px-4 py-3">
            <h2 className="text-sm font-bold text-osmos-navy">Avisos de hoy · {importantes.length} requieren atención</h2>
            <Link href="/avisos/" className="text-xs font-bold text-osmos-navy2 underline">Ver todos</Link>
          </div>
          <ul>
            {importantes.slice(0, 6).map((a) => (
              <li key={`${a.categoria}-${a.registro_id}-${a.titulo}`} className="flex flex-wrap items-center gap-x-3 border-b border-osmos-soft px-4 py-2 text-[13px] last:border-0">
                <span className={`rounded px-2 py-0.5 text-xs font-bold ${a.prioridad === 1 ? "bg-[#FDE7E7] text-[#A12020]" : "bg-[#FFF4D6] text-[#7A5600]"}`}>{a.prioridad === 1 ? "Urgente" : "Importante"}</span>
                {a.enlace ? <Link href={a.enlace} className="font-semibold text-osmos-navy underline">{a.titulo}</Link> : <strong>{a.titulo}</strong>}
                <span className="text-osmos-muted">{a.detalle}</span>
                <span className="ml-auto text-xs text-osmos-muted">{formatoFecha(a.fecha)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {MODULOS.map((m) => (
        <section key={m.slug} className="flex flex-col gap-2.5">
          <h2 className="text-[15px] font-bold text-osmos-navy">{m.nombre}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-2.5">
            {m.secciones.map((s) => (
              <Link key={s.slug} href={rutaSeccion(m, s)} className="card flex min-h-[84px] flex-col justify-between gap-2 p-3.5 text-left hover:border-osmos-teal">
                <span className="text-sm font-semibold leading-[18px]">{s.nombre}</span>
                <span className="text-xs text-osmos-muted">Abrir</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
