import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { etiqueta, formatoDinero, formatoFecha, formatoNumero } from "@/lib/formato";
import { Aviso, Encabezado, Estado } from "@/components/ui";
import { accionCotizacion, facturarPedido } from "../../acciones";

export const dynamic = "force-dynamic";

type Linea = { id: string; descripcion: string; cantidad: number; precio: number; costo: number; descuento_pct: number; itbis: number; total: number };

function BotonAccion({ id, accion, texto, primario = false }: { id: string; accion: string; texto: string; primario?: boolean }) {
  return (
    <form action={accionCotizacion}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="accion" value={accion} />
      <button type="submit" className={primario ? "btn-primary" : "btn-secondary"}>
        {texto}
      </button>
    </form>
  );
}

export default async function DetalleCotizacion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  const { data: c } = await supabase
    .from("cotizaciones")
    .select("*, clientes(id,nombre,rnc_cedula), prospectos(nombre,empresa), vendedores(nombre), cotizacion_lineas(*)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const [{ data: pedidos }, { data: perfil }] = await Promise.all([
    supabase.from("pedidos_venta").select("id,numero,estado,factura_id,facturas!pedidos_venta_factura_id_fkey(numero,ncf)").eq("cotizacion_id", id),
    supabase.auth.getUser().then(async ({ data }) => supabase.from("perfiles").select("rol").eq("id", data.user?.id ?? "").maybeSingle()),
  ]);
  const esGerencia = ["admin", "gerencia"].includes(String(perfil?.rol));
  const lineas = (c.cotizacion_lineas ?? []) as Linea[];
  const cliente = c.clientes as { id: string; nombre: string; rnc_cedula: string | null } | null;
  const prospecto = c.prospectos as { nombre: string; empresa: string | null } | null;
  const destinatario = cliente?.nombre ?? prospecto?.empresa ?? prospecto?.nombre ?? "—";
  const pendienteAprobacion = c.requiere_aprobacion && !c.aprobado_en;
  const editable = ["borrador", "por_aprobar", "en_negociacion"].includes(c.estado);

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Comercial", href: "/comercial" }, { texto: "Cotizaciones", href: "/comercial/cotizaciones" }, { texto: String(c.numero) }]}
        titulo={`Cotización ${c.numero}`}
        descripcion={`Para ${destinatario}`}
      >
        {editable ? (
          <Link href={`/comercial/cotizaciones/${id}/editar`} className="btn-secondary">
            Editar
          </Link>
        ) : null}
        {pendienteAprobacion && esGerencia ? <BotonAccion id={id} accion="aprobar" texto="Aprobar descuento / margen" primario /> : null}
        {["borrador", "por_aprobar"].includes(c.estado) && !pendienteAprobacion ? <BotonAccion id={id} accion="enviar" texto="Marcar como enviada" primario /> : null}
        {["enviada", "en_negociacion"].includes(c.estado) ? (
          <>
            <BotonAccion id={id} accion="aceptar" texto="Cliente aceptó" primario />
            {c.estado === "enviada" ? <BotonAccion id={id} accion="negociar" texto="En negociación" /> : null}
            <BotonAccion id={id} accion="rechazar" texto="Cliente rechazó" />
          </>
        ) : null}
      </Encabezado>

      {ok ? <Aviso tono="ok">{ok}</Aviso> : null}
      {error ? <Aviso tono="bad">{error}</Aviso> : null}
      {pendienteAprobacion ? (
        <Aviso tono="warn">
          Necesita aprobación de gerencia antes de enviarse: descuento mayor al permitido o margen por debajo del mínimo.
          {esGerencia ? "" : " Avise a gerencia para que la apruebe."}
        </Aviso>
      ) : null}

      <section className="card grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 p-4">
        {[
          ["Estado", <Estado key="e" valor={c.estado} />],
          ["Cliente / prospecto", cliente ? <Link key="c" href={`/comercial/clientes/${cliente.id}`} className="font-bold text-osmos-navy2 underline">{cliente.nombre}</Link> : destinatario],
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
          <p className="whitespace-pre-line">{c.notas}</p>
        </section>
      ) : null}

      {(pedidos ?? []).length ? (
        <section className="card flex flex-col gap-3 p-4">
          <h2 className="text-sm font-bold text-osmos-navy">Pedido de venta</h2>
          {(pedidos ?? []).map((p) => {
            const f = p.facturas as unknown as { numero: string; ncf: string } | null;
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>
                  <strong>{p.numero}</strong> · {etiqueta(p.estado)}
                  {f ? ` · Factura ${f.numero} (NCF ${f.ncf})` : ""}
                </span>
                {!p.factura_id ? (
                  <form action={facturarPedido}>
                    <input type="hidden" name="pedido_id" value={p.id} />
                    <input type="hidden" name="cotizacion_id" value={id} />
                    <button type="submit" className="btn-primary">Emitir factura</button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}
    </>
  );
}
