import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { etiqueta, formatoDinero, formatoFecha } from "@/lib/formato";
import { Aviso, Encabezado, Estado } from "@/components/ui";
import { actualizarEstadoIguala, asignarEquipos } from "../../acciones";

export const dynamic = "force-dynamic";

type F = Record<string, unknown> & { id: string };

export default async function DetalleIguala({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  const { data: ig } = await supabase.from("igualas").select("*, clientes(id,nombre), vendedores(nombre), iguala_equipos(equipo_id)").eq("id", id).maybeSingle();
  if (!ig) notFound();
  const cliente = ig.clientes as { id: string; nombre: string };

  const [equipos, visitas, ordenes, facturas] = await Promise.all([
    supabase.from("equipos_instalados").select("id,serie,descripcion,estado").eq("cliente_id", cliente.id).order("serie"),
    supabase.from("visitas").select("id,fecha_programada,servicio,estado").eq("iguala_id", id).order("fecha_programada", { ascending: false }).limit(12),
    supabase.from("ordenes_servicio").select("id,numero,fecha,tipo,trabajo_realizado,estado").eq("iguala_id", id).order("fecha", { ascending: false }).limit(12),
    supabase.from("facturas").select("id,numero,ncf,fecha,total,saldo,estado").eq("iguala_id", id).order("fecha", { ascending: false }).limit(12),
  ]);
  const cubiertos = new Set(((ig.iguala_equipos ?? []) as { equipo_id: string }[]).map((e) => e.equipo_id));

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Igualas", href: "/igualas" }, { texto: "Contratos de iguala", href: "/igualas/contratos" }, { texto: String(ig.codigo) }]}
        titulo={`Iguala ${ig.codigo}`}
        descripcion={`${cliente.nombre} · ${ig.descripcion ?? ""}`}
      >
        <Link href={`/igualas/ordenes/nueva?iguala=${id}`} className="btn-primary">Nueva orden de servicio</Link>
        <form action={actualizarEstadoIguala} className="flex gap-2">
          <input type="hidden" name="id" value={id} />
          <label className="sr-only" htmlFor="estado">Estado</label>
          <select id="estado" name="estado" defaultValue={ig.estado} className="input w-[150px]">
            {["vigente", "por_renovar", "suspendida", "cancelada"].map((e) => <option key={e} value={e}>{etiqueta(e)}</option>)}
          </select>
          <button type="submit" className="btn-secondary">Cambiar estado</button>
        </form>
      </Encabezado>
      {ok ? <Aviso tono="ok">{ok}</Aviso> : null}
      {error ? <Aviso tono="bad">{error}</Aviso> : null}

      <section className="card grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 p-4">
        {[
          ["Estado", <Estado key="e" valor={ig.estado} />],
          ["Cliente", <Link key="c" href={`/comercial/clientes/${cliente.id}`} className="font-bold text-osmos-navy2 underline">{cliente.nombre}</Link>],
          ["Cuota mensual (sin ITBIS)", formatoDinero(ig.cuota_mensual)],
          ["Visitas", etiqueta(ig.frecuencia_visita)],
          ["Vigencia", `${formatoFecha(ig.fecha_inicio)} – ${formatoFecha(ig.fecha_fin)}`],
          ["Día de facturación", String(ig.dia_facturacion)],
          ["Vendedor", (ig.vendedores as { nombre: string } | null)?.nombre ?? "—"],
        ].map(([l, v], i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <span className="text-xs text-osmos-muted">{l}</span>
            <span className="text-sm font-semibold">{v}</span>
          </div>
        ))}
        {ig.incluye_insumos ? (
          <div className="col-span-full flex flex-col gap-0.5 border-t border-osmos-soft pt-3">
            <span className="text-xs text-osmos-muted">Incluye</span>
            <span className="text-sm">{ig.incluye_insumos}</span>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
        <section className="card flex flex-col gap-3 p-4">
          <h2 className="text-sm font-bold text-osmos-navy">Equipos cubiertos</h2>
          {(equipos.data ?? []).length === 0 ? (
            <p className="text-[13px] text-osmos-muted">Este cliente no tiene equipos registrados en la base instalada.</p>
          ) : (
            <form action={asignarEquipos} className="flex flex-col gap-2">
              <input type="hidden" name="iguala_id" value={id} />
              {((equipos.data ?? []) as F[]).map((e) => (
                <label key={e.id} className="flex items-center gap-2.5 text-[13px]">
                  <input type="checkbox" name="equipo" value={e.id} defaultChecked={cubiertos.has(e.id)} className="h-4 w-4 accent-osmos-navy" />
                  <span><strong>{String(e.descripcion)}</strong> · Serie {String(e.serie)}</span>
                </label>
              ))}
              <button type="submit" className="btn-secondary mt-1 self-start">Guardar equipos</button>
            </form>
          )}
        </section>

        <section className="card flex flex-col gap-2 p-4">
          <h2 className="text-sm font-bold text-osmos-navy">Visitas</h2>
          {(visitas.data ?? []).length === 0 ? <p className="text-[13px] text-osmos-muted">Sin visitas. Use “Programar visitas del mes” en Programación de visitas.</p> : null}
          {((visitas.data ?? []) as F[]).map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 border-b border-osmos-soft pb-2 text-[13px]">
              <span><strong>{formatoFecha(v.fecha_programada)}</strong> · {String(v.servicio ?? "")}</span>
              <span className="flex items-center gap-2">
                <Estado valor={v.estado} />
                {v.estado === "programada" ? <Link href={`/igualas/ordenes/nueva?visita=${v.id}`} className="font-bold text-osmos-navy2 underline">Registrar</Link> : null}
              </span>
            </div>
          ))}
        </section>

        <section className="card flex flex-col gap-2 p-4">
          <h2 className="text-sm font-bold text-osmos-navy">Órdenes de servicio</h2>
          {(ordenes.data ?? []).length === 0 ? <p className="text-[13px] text-osmos-muted">Ninguna todavía.</p> : null}
          {((ordenes.data ?? []) as F[]).map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 border-b border-osmos-soft pb-2 text-[13px]">
              <span>
                <Link href={`/igualas/ordenes/${o.id}`} className="font-bold text-osmos-navy2 underline">{String(o.numero)}</Link> · {formatoFecha(o.fecha)} · {etiqueta(o.tipo)}
              </span>
              <Estado valor={o.estado} />
            </div>
          ))}
        </section>

        <section className="card flex flex-col gap-2 p-4">
          <h2 className="text-sm font-bold text-osmos-navy">Facturas de la iguala</h2>
          {(facturas.data ?? []).length === 0 ? <p className="text-[13px] text-osmos-muted">Se generan con “Generar facturación del mes”.</p> : null}
          {((facturas.data ?? []) as F[]).map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-2 border-b border-osmos-soft pb-2 text-[13px]">
              <span><strong>{String(f.numero)}</strong> · {formatoFecha(f.fecha)} · {formatoDinero(f.total)}</span>
              <Estado valor={f.estado} />
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
