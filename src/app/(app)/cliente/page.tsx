"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { buscarModulo, rutaSeccion } from "@/lib/modulos";
import { etiqueta, formatoDinero, formatoFecha, formatoNumero } from "@/lib/formato";
import { Aviso, Encabezado, Estado, Pestanas } from "@/components/ui";
import { Cargando, MensajesUrl } from "@/components/mensajes";

type F = Record<string, unknown> & { id: string };

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-3 p-4">
      <h3 className="text-sm font-bold text-osmos-navy">{titulo}</h3>
      {children}
    </section>
  );
}

const Vacio = ({ texto }: { texto: string }) => <p className="text-[13px] text-osmos-muted">{texto}</p>;

export default function FichaCliente() {
  const id = useSearchParams().get("id") ?? "";
  const m = buscarModulo("comercial")!;
  const [aviso, setAviso] = useState<string | null>(null);

  const { datos, error, cargando, recargar } = useDatos(async () => {
    const sb = supabase();
    const { data: cliente, error } = await sb
      .from("clientes")
      .select("*, vendedores(nombre, tipo), prospecto:prospectos!clientes_prospecto_fk(codigo, origen, fecha)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cliente) return null;
    const [resumen, contactos, equipos, igualas, analisis, facturas, oportunidades, actividades, ordenes] = await Promise.all([
      sb.from("v_cliente_resumen").select("*").eq("cliente_id", id).maybeSingle(),
      sb.from("contactos").select("*").eq("cliente_id", id).order("principal", { ascending: false }),
      sb.from("v_base_instalada").select("*").eq("cliente_id", id).order("proximo_reemplazo", { ascending: true, nullsFirst: false }),
      sb.from("igualas").select("id,codigo,descripcion,frecuencia_visita,cuota_mensual,fecha_fin,estado").eq("cliente_id", id).order("fecha_inicio", { ascending: false }),
      sb.from("analisis_agua").select("id,fecha,laboratorio,fuente,analisis_parametros(parametro,unidad,valor_crudo,valor_tratado,cumple)").eq("cliente_id", id).order("fecha", { ascending: false }).limit(1),
      sb.from("facturas").select("id,numero,ncf,fecha,vence,total,saldo,estado").eq("cliente_id", id).order("fecha", { ascending: false }).limit(10),
      sb.from("oportunidades").select("id,codigo,titulo,etapa,valor_estimado").eq("cliente_id", id).not("etapa", "in", "(ganada,perdida)"),
      sb.from("actividades").select("id,tipo,asunto,descripcion,fecha").eq("cliente_id", id).order("fecha", { ascending: false }).limit(15),
      sb.from("ordenes_servicio").select("id,numero,fecha,tipo,trabajo_realizado,estado").eq("cliente_id", id).order("fecha", { ascending: false }).limit(10),
    ]);
    return {
      cliente: cliente as Record<string, unknown>,
      r: (resumen.data ?? {}) as Record<string, unknown>,
      contactos: (contactos.data ?? []) as F[],
      equipos: (equipos.data ?? []) as F[],
      igualas: (igualas.data ?? []) as F[],
      analisis: ((analisis.data ?? []) as F[])[0],
      facturas: (facturas.data ?? []) as F[],
      oportunidades: (oportunidades.data ?? []) as F[],
      actividades: (actividades.data ?? []) as F[],
      ordenes: (ordenes.data ?? []) as F[],
    };
  }, [id]);

  const registrarActividad = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const { error } = await supabase().from("actividades").insert({
      cliente_id: id,
      tipo: String(f.get("tipo") ?? "nota"),
      asunto: String(f.get("asunto") ?? "Actividad"),
      descripcion: String(f.get("descripcion") ?? "") || null,
    });
    if (error) return setAviso(error.message);
    form.reset();
    setAviso(null);
    recargar();
  };

  if (error) return <Aviso tono="bad">{error}</Aviso>;
  if (cargando && !datos) return <Cargando />;
  if (!datos) return <Aviso tono="warn">Cliente no encontrado o sin permiso para verlo.</Aviso>;

  const { cliente, r } = datos;
  const vendedor = (cliente.vendedores as { nombre: string } | null)?.nombre ?? "Sin asignar";
  const prospecto = cliente.prospecto as { codigo: string; origen: string } | null;
  const igualaActiva = datos.igualas.find((i) => i.estado === "vigente" || i.estado === "por_renovar");
  const parametros = (datos.analisis?.analisis_parametros ?? []) as Record<string, unknown>[];
  const abiertas = datos.facturas.filter((f) => Number(f.saldo) > 0 && f.estado !== "anulada");
  const balance = Number(r.balance ?? 0);
  const limite = Number(cliente.limite_credito ?? 0);

  const linea = [
    ...datos.actividades.map((a) => ({ fecha: String(a.fecha), titulo: String(a.asunto), detalle: `${etiqueta(a.tipo)}${a.descripcion ? " · " + a.descripcion : ""}`, color: "#0093A5" })),
    ...datos.facturas.map((f) => ({ fecha: String(f.fecha), titulo: `Factura ${f.numero}`, detalle: `${formatoDinero(f.total)} · ${etiqueta(f.estado)}`, color: "#0C3585" })),
    ...datos.ordenes.map((x) => ({ fecha: String(x.fecha), titulo: `Orden de servicio ${x.numero}`, detalle: `${etiqueta(x.tipo)}${x.trabajo_realizado ? " · " + x.trabajo_realizado : ""}`, color: "#1D6B3A" })),
  ]
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, 12);

  const etiquetas: { t: string; v: string }[] = [];
  if (igualaActiva) etiquetas.push({ t: "Iguala vigente", v: "vigente" });
  if (abiertas.some((f) => f.estado === "vencida")) etiquetas.push({ t: "Pago atrasado", v: "vencida" });
  if (datos.oportunidades.length) etiquetas.push({ t: "Oportunidad abierta", v: "nuevo" });
  if (limite > 0 && balance > limite) etiquetas.push({ t: "Excede límite de crédito", v: "vencida" });

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Comercial", href: "/comercial/" }, { texto: "Clientes", href: "/comercial/clientes/" }, { texto: String(cliente.nombre) }]}
        titulo="Ficha del cliente"
        descripcion="Vista completa del cliente: equipos, igualas, análisis de agua, facturas y actividades."
      />
      <Pestanas items={m.secciones.map((x) => ({ slug: x.slug, nombre: x.nombre, href: rutaSeccion(m, x) }))} activa="clientes" />
      <MensajesUrl error={aviso} />

      <section className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-wider text-osmos-tealdark">
              {String(cliente.codigo)} · {etiqueta(cliente.segmento)}{cliente.sector ? ` · ${cliente.sector}` : ""}
            </span>
            <h2 className="text-2xl font-bold text-osmos-navy">{String(cliente.nombre)}</h2>
            <span className="text-[13px] text-osmos-muted">RNC {String(cliente.rnc_cedula ?? "—")} · {String(cliente.direccion ?? cliente.ciudad ?? "—")}</span>
            <div className="flex flex-wrap gap-1.5 pt-1">{etiquetas.map((e) => <Estado key={e.t} valor={e.v} texto={e.t} />)}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/editar/?f=comercial/clientes&id=${id}&volver=${encodeURIComponent(`/cliente/?id=${id}`)}`} className="btn-secondary">Editar datos</Link>
            <Link href={`/cotizacion/nueva/?cliente=${id}`} className="btn-primary">Nueva cotización</Link>
            <Link href={`/iguala/nueva/?cliente=${id}`} className="btn-secondary">Nueva iguala</Link>
            <Link href={`/orden/nueva/?cliente=${id}`} className="btn-secondary">Orden de servicio</Link>
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 border-t border-osmos-soft pt-3.5">
          {[
            ["Vendedor asignado", vendedor],
            ["Origen", prospecto ? `${etiqueta(prospecto.origen)} (${prospecto.codigo})` : etiqueta(cliente.origen)],
            ["Cliente desde", formatoFecha(String(cliente.created_at).slice(0, 10))],
            ["Iguala", igualaActiva ? `${igualaActiva.codigo} · ${etiqueta(igualaActiva.frecuencia_visita)}` : "Sin iguala"],
          ].map(([l, v]) => (
            <div key={l} className="flex flex-col gap-0.5">
              <span className="text-xs text-osmos-muted">{l}</span>
              <span className="text-sm font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {[
          ["Balance", formatoDinero(balance)],
          ["Límite de crédito", formatoDinero(limite)],
          ["Días promedio de pago", r.dias_promedio_pago == null ? "Sin historial" : formatoNumero(r.dias_promedio_pago)],
          ["Ventas acumuladas", formatoDinero(r.ventas_acumuladas ?? 0)],
          ["Cuota de igualas", `${formatoDinero(r.cuota_igualas ?? 0)} / mes`],
        ].map(([l, v]) => (
          <div key={l} className="card flex flex-col gap-0.5 px-3.5 py-3">
            <span className="text-xs text-osmos-muted">{l}</span>
            <span className="text-lg font-bold tabular-nums text-osmos-navy">{v}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
        <Bloque titulo="Equipos instalados">
          <div className="flex gap-3 text-[13px]">
            <Link href={`/editar/?f=comercial/equipos&cliente_id=${id}&volver=${encodeURIComponent(`/cliente/?id=${id}`)}`} className="font-bold text-osmos-navy2 underline">+ Agregar equipo</Link>
            <Link href={`/editar/?f=comercial/componentes&volver=${encodeURIComponent(`/cliente/?id=${id}`)}`} className="font-bold text-osmos-navy2 underline">+ Agregar componente</Link>
          </div>
          {datos.equipos.length === 0 ? <Vacio texto="No hay equipos registrados para este cliente." /> : datos.equipos.map((e) => (
            <div key={String(e.componente_id)} className="flex justify-between gap-3 border-b border-osmos-soft pb-2.5 text-[13px]">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold">{String(e.equipo)}</span>
                <span className="text-osmos-muted">Serie {String(e.serie)} · Instalado {formatoFecha(e.fecha_instalacion)}</span>
                <span>{String(e.componente)}: <strong>{e.proximo_reemplazo ? `reemplazo ${formatoFecha(e.proximo_reemplazo)}` : "sin fecha"}</strong></span>
              </div>
              <div className="self-start"><Estado valor={e.estado_reposicion} /></div>
            </div>
          ))}
        </Bloque>

        <Bloque titulo="Análisis de agua">
          {!datos.analisis ? <Vacio texto="No hay análisis registrados." /> : (
            <>
              <span className="text-xs text-osmos-muted">
                Último análisis: {formatoFecha(datos.analisis.fecha)} · {String(datos.analisis.laboratorio ?? "—")} · fuente: {String(datos.analisis.fuente ?? "—")}
              </span>
              <table className="w-full text-[13px]">
                <thead><tr>{["Parámetro", "Agua cruda", "Agua tratada", "Resultado"].map((h) => <th key={h} className="pb-1 text-left text-xs font-bold text-osmos-muted">{h}</th>)}</tr></thead>
                <tbody>
                  {parametros.map((p, i) => (
                    <tr key={i} className="border-t border-osmos-soft">
                      <td className="py-1.5 font-semibold">{String(p.parametro)}</td>
                      <td>{`${p.valor_crudo ?? "—"} ${p.unidad ?? ""}`}</td>
                      <td>{`${p.valor_tratado ?? "—"} ${p.valor_tratado ? p.unidad ?? "" : ""}`}</td>
                      <td>{p.cumple === null || p.cumple === undefined ? <Estado valor="pendiente" texto="Pendiente" /> : <Estado valor={p.cumple ? "aprobado" : "rechazada"} texto={p.cumple ? "Cumple" : "No cumple"} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Bloque>

        <Bloque titulo="Línea de tiempo">
          {linea.length === 0 ? <Vacio texto="Sin movimientos todavía." /> : linea.map((l, i) => (
            <div key={i} className="flex gap-2.5 text-[13px]">
              <span className="w-[72px] shrink-0 text-osmos-muted">{formatoFecha(l.fecha.slice(0, 10))}</span>
              <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.color }} />
              <span className="flex flex-col"><span className="font-semibold">{l.titulo}</span><span className="text-osmos-muted">{l.detalle}</span></span>
            </div>
          ))}
          <form onSubmit={registrarActividad} className="mt-2 flex flex-col gap-2 border-t border-osmos-soft pt-3">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <label className="sr-only" htmlFor="tipo">Tipo</label>
              <select id="tipo" name="tipo" className="input">{["llamada", "visita", "whatsapp", "correo", "reunion", "nota"].map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}</select>
              <label className="sr-only" htmlFor="asunto">Asunto</label>
              <input id="asunto" name="asunto" required placeholder="Asunto" className="input" />
            </div>
            <label className="sr-only" htmlFor="descripcion">Detalle</label>
            <input id="descripcion" name="descripcion" placeholder="Detalle (opcional)" className="input" />
            <button type="submit" className="btn-secondary self-start">Registrar actividad</button>
          </form>
        </Bloque>

        <Bloque titulo="Contactos">
          <Link href={`/editar/?f=comercial/contactos&cliente_id=${id}&volver=${encodeURIComponent(`/cliente/?id=${id}`)}`} className="self-start text-[13px] font-bold text-osmos-navy2 underline">+ Agregar contacto</Link>
          {datos.contactos.length === 0 ? <Vacio texto="Sin contactos registrados." /> : datos.contactos.map((c) => (
            <div key={c.id} className="flex items-center gap-2.5 text-[13px]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-osmos-hover text-xs font-bold text-osmos-navy">{String(c.nombre).replace(/[[\]]/g, "").slice(0, 2).toUpperCase()}</span>
              <span className="flex flex-col"><span className="font-semibold">{String(c.nombre)}</span><span className="text-osmos-muted">{String(c.rol ?? "—")} · {String(c.telefono ?? c.email ?? "—")}</span></span>
            </div>
          ))}
          <h3 className="mt-2 text-sm font-bold text-osmos-navy">Oportunidades abiertas</h3>
          {datos.oportunidades.length === 0 ? <Vacio texto="Ninguna." /> : datos.oportunidades.map((x) => (
            <div key={x.id} className="flex justify-between gap-2 text-[13px]">
              <span className="flex flex-col"><span className="font-semibold">{String(x.titulo)}</span><span className="text-osmos-muted">{formatoDinero(x.valor_estimado)} · {String(x.codigo)}</span></span>
              <Estado valor={x.etapa} />
            </div>
          ))}
          <h3 className="mt-2 text-sm font-bold text-osmos-navy">Facturas abiertas</h3>
          {abiertas.length === 0 ? <Vacio texto="Ninguna." /> : abiertas.map((f) => (
            <div key={f.id} className="flex justify-between gap-2 text-[13px]">
              <span className="flex flex-col"><span className="font-semibold">{String(f.numero)} · vence {formatoFecha(f.vence)}</span><span className="text-osmos-muted">Saldo {formatoDinero(f.saldo)}</span></span>
              <Estado valor={f.estado} />
            </div>
          ))}
        </Bloque>
      </div>
    </>
  );
}
