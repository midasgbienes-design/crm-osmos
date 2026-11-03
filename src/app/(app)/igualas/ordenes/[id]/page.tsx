import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { etiqueta, formatoDinero, formatoFecha, formatoNumero } from "@/lib/formato";
import { Aviso, Encabezado, Estado } from "@/components/ui";
import { facturarOrden } from "../../acciones";

export const dynamic = "force-dynamic";

type Insumo = { id: string; cantidad: number; costo_unitario: number; precio_unitario: number; cobertura: string; facturado: boolean; productos: { codigo: string; nombre: string } | null };

export default async function DetalleOrden({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  const { data: os } = await supabase
    .from("ordenes_servicio")
    .select("*, clientes(id,nombre), igualas(id,codigo), equipos_instalados(serie,descripcion), orden_servicio_insumos(*, productos(codigo,nombre)), facturas!ordenes_servicio_factura_id_fkey(numero,ncf,total)")
    .eq("id", id)
    .maybeSingle();
  if (!os) notFound();

  const tecnico = os.tecnico_id ? (await supabase.from("v_directorio").select("nombre").eq("id", os.tecnico_id).maybeSingle()).data : null;
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
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Igualas", href: "/igualas" }, { texto: "Órdenes de servicio", href: "/igualas/ordenes" }, { texto: String(os.numero) }]}
        titulo={`Orden de servicio ${os.numero}`}
        descripcion={`${cliente.nombre} · ${etiqueta(os.tipo)} · ${formatoFecha(os.fecha)}`}
      >
        {os.estado === "por_facturar" ? (
          <form action={facturarOrden}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="btn-primary">Facturar insumos ({formatoDinero(porFacturar)} + ITBIS)</button>
          </form>
        ) : null}
      </Encabezado>
      {ok ? <Aviso tono="ok">{ok}</Aviso> : null}
      {error ? <Aviso tono="bad">{error}</Aviso> : null}

      <section className="card grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 p-4">
        {[
          ["Estado", <Estado key="e" valor={os.estado} />],
          ["Cliente", <Link key="c" href={`/comercial/clientes/${cliente.id}`} className="font-bold text-osmos-navy2 underline">{cliente.nombre}</Link>],
          ["Iguala", iguala ? <Link key="i" href={`/igualas/contratos/${iguala.id}`} className="font-bold text-osmos-navy2 underline">{iguala.codigo}</Link> : "Sin iguala"],
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
          <span className="text-sm">{os.trabajo_realizado ?? "—"}</span>
          {os.observaciones ? <span className="text-sm text-osmos-muted">Observaciones: {os.observaciones}</span> : null}
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
