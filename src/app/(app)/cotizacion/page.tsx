"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { etiqueta, formatoDinero, formatoFecha, formatoNumero } from "@/lib/formato";
import { Aviso, Encabezado, Estado } from "@/components/ui";
import { Cargando, MensajesUrl } from "@/components/mensajes";
import { esGerencia, useSesion } from "@/components/sesion";

type Linea = { id: string; descripcion: string; cantidad: number; precio: number; costo: number; descuento_pct: number; itbis: number; total: number };
type Pedido = { id: string; numero: string; estado: string; factura_id: string | null; facturas: { numero: string; ncf: string } | null };

const MENSAJES: Record<string, string> = {
  aprobar: "Cotización aprobada por gerencia.",
  enviar: "Cotización marcada como enviada al cliente.",
  negociar: "Cotización en negociación.",
  aceptar: "El cliente aceptó: se creó el pedido de venta.",
  rechazar: "Cotización marcada como rechazada.",
};

export default function DetalleCotizacion() {
  const id = useSearchParams().get("id") ?? "";
  const { perfil } = useSesion();
  const gerencia = esGerencia(perfil?.rol);
  const [aviso, setAviso] = useState<{ tono: "ok" | "bad"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const { datos, error, cargando, recargar } = useDatos(async () => {
    const sb = supabase();
    const [c, p] = await Promise.all([
      sb.from("cotizaciones").select("*, clientes(id,nombre,rnc_cedula), prospectos(nombre,empresa), vendedores(nombre), cotizacion_lineas(*)").eq("id", id).maybeSingle(),
      sb.from("pedidos_venta").select("id,numero,estado,factura_id,facturas!pedidos_venta_factura_id_fkey(numero,ncf)").eq("cotizacion_id", id),
    ]);
    if (c.error) throw new Error(c.error.message);
    return { c: c.data as Record<string, unknown> | null, pedidos: (p.data ?? []) as unknown as Pedido[] };
  }, [id]);

  const accion = async (a: string) => {
    let motivo: string | null = null;
    if (a === "rechazar") {
      motivo = window.prompt("Motivo del rechazo (precio, competidor, tiempo…)") ?? null;
    }
    setOcupado(true);
    const { error } = await supabase().rpc("accion_cotizacion", { p_id: id, p_accion: a, p_motivo: motivo });
    setOcupado(false);
    setAviso(error ? { tono: "bad", texto: error.message } : { tono: "ok", texto: MENSAJES[a] ?? "Listo." });
    recargar();
  };

  const facturar = async (pedido: string) => {
    setOcupado(true);
    const { error } = await supabase().rpc("facturar_pedido", { p_pedido: pedido });
    setOcupado(false);
    setAviso(error ? { tono: "bad", texto: error.message } : { tono: "ok", texto: "Factura emitida." });
    recargar();
  };

  if (cargando && !datos) return <Cargando />;
  if (error) return <Aviso tono="bad">{error}</Aviso>;
  const c = datos?.c;
  if (!c) return <Aviso tono="warn">Cotización no encontrada.</Aviso>;

  const lineas = (c.cotizacion_lineas ?? []) as Linea[];
  const cliente = c.clientes as { id: string; nombre: string } | null;
  const prospecto = c.prospectos as { nombre: string; empresa: string | null } | null;
  const destinatario = cliente?.nombre ?? prospecto?.empresa ?? prospecto?.nombre ?? "—";
  const estado = String(c.estado);
  const pendiente = Boolean(c.requiere_aprobacion) && !c.aprobado_en;
  const editable = ["borrador", "por_aprobar", "en_negociacion"].includes(estado);

  const Boton = ({ a, texto, primario = false }: { a: string; texto: string; primario?: boolean }) => (
    <button type="button" disabled={ocupado} onClick={() => accion(a)} className={primario ? "btn-primary" : "btn-secondary"}>{texto}</button>
  );

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Comercial", href: "/comercial/" }, { texto: "Cotizaciones", href: "/comercial/cotizaciones/" }, { texto: String(c.numero) }]}
        titulo={`Cotización ${c.numero}`}
        descripcion={`Para ${destinatario}`}
      >
        <Link href={`/imprimir/?doc=cotizacion&id=${id}`} className="btn-secondary">Imprimir / PDF</Link>
        {editable ? <Link href={`/cotizacion/editar/?id=${id}`} className="btn-secondary">Editar</Link> : null}
        {pendiente && gerencia ? <Boton a="aprobar" texto="Aprobar descuento / margen" primario /> : null}
        {["borrador", "por_aprobar"].includes(estado) && !pendiente ? <Boton a="enviar" texto="Marcar como enviada" primario /> : null}
        {["enviada", "en_negociacion"].includes(estado) ? (
          <>
            <Boton a="aceptar" texto="Cliente aceptó" primario />
            {estado === "enviada" ? <Boton a="negociar" texto="En negociación" /> : null}
            <Boton a="rechazar" texto="Cliente rechazó" />
          </>
        ) : null}
      </Encabezado>

      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : <MensajesUrl />}
      {pendiente ? (
        <Aviso tono="warn">
          Necesita aprobación de gerencia antes de enviarse: descuento mayor al permitido o margen por debajo del mínimo.
          {gerencia ? "" : " Avise a gerencia para que la apruebe."}
        </Aviso>
      ) : null}

      <section className="card grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 p-4">
        {[
          ["Estado", <Estado key="e" valor={estado} />],
          ["Cliente / prospecto", cliente ? <Link key="c" href={`/cliente/?id=${cliente.id}`} className="font-bold text-osmos-navy2 underline">{cliente.nombre}</Link> : destinatario],
          ["Vendedor", (c.vendedores as { nombre: string } | null)?.nombre ?? "—"],
          ["Fecha", formatoFecha(c.fecha)],
          ["Válida hasta", formatoFecha(c.vence)],
          ["Aprobación", c.requiere_aprobacion ? (c.aprobado_en ? `Aprobada ${formatoFecha(String(c.aprobado_en).slice(0, 10))}` : "Pendiente") : "No requiere"],
        ].map(([l, v], i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <span className="text-xs text-osmos-muted">{l}</span>
            <span className="text-sm font-semibold">{v}</span>
          </div>
        ))}
      </section>

      <section className="card flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F7F9FC]">
                {["Descripción", "Cantidad", "Precio", "Desc. %", "Costo", "Margen", "ITBIS", "Total"].map((h, i) => (
                  <th key={h} scope="col" className={`th ${i > 0 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const neto = Number(l.cantidad) * Number(l.precio) * (1 - Number(l.descuento_pct) / 100);
                const margen = neto > 0 ? ((neto - Number(l.costo) * Number(l.cantidad)) / neto) * 100 : null;
                return (
                  <tr key={l.id}>
                    <td className="td">{l.descripcion}</td>
                    <td className="td text-right tabular-nums">{formatoNumero(l.cantidad)}</td>
                    <td className="td text-right tabular-nums">{formatoDinero(l.precio)}</td>
                    <td className="td text-right tabular-nums">{formatoNumero(l.descuento_pct)}%</td>
                    <td className="td text-right tabular-nums">{formatoDinero(l.costo)}</td>
                    <td className="td text-right tabular-nums">{margen === null ? "—" : `${margen.toFixed(1)}%`}</td>
                    <td className="td text-right tabular-nums">{formatoDinero(l.itbis)}</td>
                    <td className="td text-right font-semibold tabular-nums">{formatoDinero(l.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto grid min-w-[280px] grid-cols-2 gap-x-6 gap-y-1 p-4 text-sm">
          <dt className="text-osmos-muted">Subtotal</dt><dd className="text-right tabular-nums">{formatoDinero(c.subtotal)}</dd>
          <dt className="text-osmos-muted">Descuento</dt><dd className="text-right tabular-nums">-{formatoDinero(c.descuento)}</dd>
          <dt className="text-osmos-muted">ITBIS</dt><dd className="text-right tabular-nums">{formatoDinero(c.itbis)}</dd>
          <dt className="font-bold text-osmos-navy">Total</dt><dd className="text-right text-lg font-bold tabular-nums text-osmos-navy">{formatoDinero(c.total)}</dd>
          <dt className="text-osmos-muted">Margen</dt><dd className="text-right font-bold tabular-nums">{c.margen_pct === null ? "—" : `${formatoNumero(c.margen_pct)}%`}</dd>
        </dl>
      </section>

      {c.notas ? (
        <section className="card p-4 text-sm">
          <h2 className="mb-1 text-sm font-bold text-osmos-navy">Notas y condiciones</h2>
          <p className="whitespace-pre-line">{String(c.notas)}</p>
        </section>
      ) : null}

      {datos.pedidos.length ? (
        <section className="card flex flex-col gap-3 p-4">
          <h2 className="text-sm font-bold text-osmos-navy">Pedido de venta</h2>
          {datos.pedidos.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                <strong>{p.numero}</strong> · {etiqueta(p.estado)}
                {p.facturas ? ` · Factura ${p.facturas.numero} (NCF ${p.facturas.ncf})` : ""}
              </span>
              <span className="flex flex-wrap gap-2">
                <Link href={`/imprimir/?doc=conduce&id=${p.id}`} className="btn-secondary">Conduce</Link>
                {p.factura_id ? <Link href={`/imprimir/?doc=factura&id=${p.factura_id}`} className="btn-secondary">Ver factura</Link> : null}
                {!p.factura_id ? <button type="button" disabled={ocupado} onClick={() => facturar(p.id)} className="btn-primary">Emitir factura</button> : null}
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
