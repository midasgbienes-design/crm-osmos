"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { etiqueta, formatoDinero, formatoFecha } from "@/lib/formato";
import { Aviso, Encabezado, Estado } from "@/components/ui";
import { Cargando, MensajesUrl } from "@/components/mensajes";

type F = Record<string, unknown> & { id: string };

export default function DetalleIguala() {
  const id = useSearchParams().get("id") ?? "";
  const [aviso, setAviso] = useState<{ tono: "ok" | "bad"; texto: string } | null>(null);

  const { datos, error, cargando, recargar } = useDatos(async () => {
    const sb = supabase();
    const { data: ig, error } = await sb.from("igualas").select("*, clientes(id,nombre), vendedores(nombre), iguala_equipos(equipo_id)").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!ig) return null;
    const cliente = ig.clientes as { id: string; nombre: string };
    const [equipos, visitas, ordenes, facturas] = await Promise.all([
      sb.from("equipos_instalados").select("id,serie,descripcion,estado").eq("cliente_id", cliente.id).order("serie"),
      sb.from("visitas").select("id,fecha_programada,servicio,estado").eq("iguala_id", id).order("fecha_programada", { ascending: false }).limit(12),
      sb.from("ordenes_servicio").select("id,numero,fecha,tipo,estado").eq("iguala_id", id).order("fecha", { ascending: false }).limit(12),
      sb.from("facturas").select("id,numero,fecha,total,estado").eq("iguala_id", id).order("fecha", { ascending: false }).limit(12),
    ]);
    return {
      ig: ig as Record<string, unknown>, cliente,
      cubiertos: new Set(((ig.iguala_equipos ?? []) as { equipo_id: string }[]).map((e) => e.equipo_id)),
      equipos: (equipos.data ?? []) as F[], visitas: (visitas.data ?? []) as F[], ordenes: (ordenes.data ?? []) as F[], facturas: (facturas.data ?? []) as F[],
    };
  }, [id]);

  const cambiarEstado = async (estado: string) => {
    const { error } = await supabase().from("igualas").update({ estado }).eq("id", id);
    setAviso(error ? { tono: "bad", texto: error.message } : { tono: "ok", texto: "Estado actualizado." });
    recargar();
  };

  const guardarEquipos = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const equipos = new FormData(e.currentTarget).getAll("equipo").map(String);
    const { error } = await supabase().rpc("asignar_equipos_iguala", { p_iguala: id, p_equipos: equipos });
    setAviso(error ? { tono: "bad", texto: error.message } : { tono: "ok", texto: "Equipos actualizados." });
    recargar();
  };

  if (cargando && !datos) return <Cargando />;
  if (error) return <Aviso tono="bad">{error}</Aviso>;
  if (!datos) return <Aviso tono="warn">Iguala no encontrada.</Aviso>;
  const { ig, cliente } = datos;

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Igualas", href: "/igualas/" }, { texto: "Contratos de iguala", href: "/igualas/contratos/" }, { texto: String(ig.codigo) }]}
        titulo={`Iguala ${ig.codigo}`}
        descripcion={`${cliente.nombre} · ${ig.descripcion ?? ""}`}
      >
        <Link href={`/orden/nueva/?iguala=${id}`} className="btn-primary">Nueva orden de servicio</Link>
        <label className="sr-only" htmlFor="estado">Estado</label>
        <select id="estado" value={String(ig.estado)} onChange={(e) => cambiarEstado(e.target.value)} className="input w-[160px]">
          {["vigente", "por_renovar", "suspendida", "cancelada"].map((x) => <option key={x} value={x}>{etiqueta(x)}</option>)}
        </select>
      </Encabezado>
      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : <MensajesUrl />}

      <section className="card grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 p-4">
        {[
          ["Estado", <Estado key="e" valor={ig.estado} />],
          ["Cliente", <Link key="c" href={`/cliente/?id=${cliente.id}`} className="font-bold text-osmos-navy2 underline">{cliente.nombre}</Link>],
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
            <span className="text-sm">{String(ig.incluye_insumos)}</span>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
        <section className="card flex flex-col gap-3 p-4">
          <h2 className="text-sm font-bold text-osmos-navy">Equipos cubiertos</h2>
          {datos.equipos.length === 0 ? (
            <p className="text-[13px] text-osmos-muted">Este cliente no tiene equipos registrados en la base instalada.</p>
          ) : (
            <form onSubmit={guardarEquipos} className="flex flex-col gap-2">
              {datos.equipos.map((e) => (
                <label key={e.id} className="flex items-center gap-2.5 text-[13px]">
                  <input type="checkbox" name="equipo" value={e.id} defaultChecked={datos.cubiertos.has(e.id)} className="h-4 w-4 accent-osmos-navy" />
                  <span><strong>{String(e.descripcion)}</strong> · Serie {String(e.serie)}</span>
                </label>
              ))}
              <button type="submit" className="btn-secondary mt-1 self-start">Guardar equipos</button>
            </form>
          )}
        </section>

        <section className="card flex flex-col gap-2 p-4">
          <h2 className="text-sm font-bold text-osmos-navy">Visitas</h2>
          {datos.visitas.length === 0 ? <p className="text-[13px] text-osmos-muted">Sin visitas. Use “Programar visitas del mes” en Programación de visitas.</p> : null}
          {datos.visitas.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 border-b border-osmos-soft pb-2 text-[13px]">
              <span><strong>{formatoFecha(v.fecha_programada)}</strong> · {String(v.servicio ?? "")}</span>
              <span className="flex items-center gap-2">
                <Estado valor={v.estado} />
                {v.estado === "programada" ? <Link href={`/orden/nueva/?visita=${v.id}`} className="font-bold text-osmos-navy2 underline">Registrar</Link> : null}
              </span>
            </div>
          ))}
        </section>

        <section className="card flex flex-col gap-2 p-4">
          <h2 className="text-sm font-bold text-osmos-navy">Órdenes de servicio</h2>
          {datos.ordenes.length === 0 ? <p className="text-[13px] text-osmos-muted">Ninguna todavía.</p> : null}
          {datos.ordenes.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 border-b border-osmos-soft pb-2 text-[13px]">
              <span><Link href={`/orden/?id=${o.id}`} className="font-bold text-osmos-navy2 underline">{String(o.numero)}</Link> · {formatoFecha(o.fecha)} · {etiqueta(o.tipo)}</span>
              <Estado valor={o.estado} />
            </div>
          ))}
        </section>

        <section className="card flex flex-col gap-2 p-4">
          <h2 className="text-sm font-bold text-osmos-navy">Facturas de la iguala</h2>
          {datos.facturas.length === 0 ? <p className="text-[13px] text-osmos-muted">Se generan con “Generar facturación del mes”.</p> : null}
          {datos.facturas.map((f) => (
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
