"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { etiqueta, formatoDinero, formatoFecha, formatoNumero } from "@/lib/formato";
import { Aviso, Encabezado, Estado } from "@/components/ui";
import { Cargando, MensajesUrl } from "@/components/mensajes";

type Insumo = { id: string; cantidad: number; costo_unitario: number; precio_unitario: number; cobertura: string; facturado: boolean; productos: { codigo: string; nombre: string } | null };

export default function DetalleOrden() {
  const id = useSearchParams().get("id") ?? "";
  const [aviso, setAviso] = useState<{ tono: "ok" | "bad"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const { datos, error, cargando, recargar } = useDatos(async () => {
    const sb = supabase();
    const { data: os, error } = await sb
      .from("ordenes_servicio")
      .select("*, clientes(id,nombre), igualas(id,codigo), equipos_instalados(serie,descripcion), orden_servicio_insumos(*, productos(codigo,nombre)), facturas!ordenes_servicio_factura_id_fkey(numero,ncf,total)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!os) return null;
    const tecnico = os.tecnico_id ? (await sb.from("v_directorio").select("nombre").eq("id", os.tecnico_id).maybeSingle()).data : null;
    return { os: os as Record<string, unknown>, tecnico };
  }, [id]);

  const facturar = async () => {
    setOcupado(true);
    const { error } = await supabase().rpc("facturar_orden_servicio", { p_os: id });
    setOcupado(false);
    setAviso(error ? { tono: "bad", texto: error.message } : { tono: "ok", texto: "Factura emitida." });
    recargar();
  };

  if (cargando && !datos) return <Cargando />;
  if (error) return <Aviso tono="bad">{error}</Aviso>;
  if (!datos) return <Aviso tono="warn">Orden no encontrada.</Aviso>;

  const { os, tecnico } = datos;
  const cliente = os.clientes as { id: string; nombre: string };
  const iguala = os.igualas as { id: string; codigo: string } | null;
  const equipo = os.equipos_instalados as { serie: string; descripcion: string } | null;
  const factura = os.facturas as { numero: string; ncf: string; total: number } | null;
  const insumos = (os.orden_servicio_insumos ?? []) as Insumo[];
  const costoIncluido = insumos.filter((i) => i.cobertura === "incluido").reduce((t, i) => t + Number(i.cantidad) * Number(i.costo_unitario), 0);
  const porFacturar = insumos.filter((i) => i.cobertura === "facturable" && !i.facturado).reduce((t, i) => t + Number(i.cantidad) * Number(i.precio_unitario), 0);

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Igualas", href: "/igualas/" }, { texto: "Órdenes de servicio", href: "/igualas/ordenes/" }, { texto: String(os.numero) }]}
        titulo={`Orden de servicio ${os.numero}`}
        descripcion={`${cliente.nombre} · ${etiqueta(os.tipo)} · ${formatoFecha(os.fecha)}`}
      >
        <Link href={`/imprimir/?doc=orden&id=${id}`} className="btn-secondary">Imprimir orden</Link>
        {os.factura_id ? <Link href={`/imprimir/?doc=factura&id=${os.factura_id}`} className="btn-secondary">Ver factura</Link> : null}
        {os.estado === "por_facturar" ? (
          <button type="button" disabled={ocupado} onClick={facturar} className="btn-primary">Facturar insumos ({formatoDinero(porFacturar)} + ITBIS)</button>
        ) : null}
      </Encabezado>
      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : <MensajesUrl />}

      <section className="card grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 p-4">
        {[
          ["Estado", <Estado key="e" valor={os.estado} />],
          ["Cliente", <Link key="c" href={`/cliente/?id=${cliente.id}`} className="font-bold text-osmos-navy2 underline">{cliente.nombre}</Link>],
          ["Iguala", iguala ? <Link key="i" href={`/iguala/?id=${iguala.id}`} className="font-bold text-osmos-navy2 underline">{iguala.codigo}</Link> : "Sin iguala"],
          ["Equipo", equipo ? `${equipo.descripcion} · ${equipo.serie}` : "—"],
          ["Técnico", tecnico?.nombre ?? "—"],
          ["Factura", factura ? `${factura.numero} · ${formatoDinero(factura.total)}` : "—"],
        ].map(([l, v], i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <span className="text-xs text-osmos-muted">{l}</span>
            <span className="text-sm font-semibold">{v}</span>
          </div>
        ))}
        <div className="col-span-full flex flex-col gap-0.5 border-t border-osmos-soft pt-3">
          <span className="text-xs text-osmos-muted">Trabajo realizado</span>
          <span className="text-sm">{String(os.trabajo_realizado ?? "—")}</span>
          {os.observaciones ? <span className="text-sm text-osmos-muted">Observaciones: {String(os.observaciones)}</span> : null}
        </div>
      </section>

      <section className="card flex flex-col">
        <h2 className="border-b border-osmos-line px-4 py-3 text-sm font-bold text-osmos-navy">Insumos y repuestos</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F7F9FC]">
                {["Artículo", "Cantidad", "Costo", "Precio", "Cobertura", "Facturado"].map((h, i) => (
                  <th key={h} scope="col" className={`th ${i > 0 && i < 4 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {insumos.length === 0 ? (
                <tr><td colSpan={6} className="td text-osmos-muted">No se usaron insumos.</td></tr>
              ) : (
                insumos.map((i) => (
                  <tr key={i.id}>
                    <td className="td">{i.productos ? `${i.productos.codigo} · ${i.productos.nombre}` : "—"}</td>
                    <td className="td text-right tabular-nums">{formatoNumero(i.cantidad)}</td>
                    <td className="td text-right tabular-nums">{formatoDinero(i.costo_unitario)}</td>
                    <td className="td text-right tabular-nums">{formatoDinero(i.precio_unitario)}</td>
                    <td className="td">{i.cobertura === "incluido" ? "Incluido en la iguala" : "Facturable"}</td>
                    <td className="td">{i.cobertura === "facturable" ? (i.facturado ? "Sí" : "Pendiente") : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-osmos-muted">Costo de insumos absorbidos por la iguala: {formatoDinero(costoIncluido)}</p>
      </section>
    </>
  );
}
