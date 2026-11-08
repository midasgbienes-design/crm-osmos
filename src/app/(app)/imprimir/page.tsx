"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { descargarPdf } from "@/lib/pdf";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { etiqueta, formatoDinero, formatoFecha, numeroEnLetras } from "@/lib/formato";
import { Aviso } from "@/components/ui";
import { Cargando } from "@/components/mensajes";
import { useSesion } from "@/components/sesion";
import { Datos, Destinatario, Firmas, Hoja, Membrete, Notas, TD, TH, TablaLineas, Totales, type Empresa, type Linea, type Par, type Parte } from "@/components/hoja-documento";

type Fila = Record<string, unknown>;

// Subtítulo bajo "FACTURA" según el tipo de comprobante.
const TIPO_NCF: Record<string, string> = {
  B01: "Crédito fiscal",
  B02: "Consumo",
  B14: "Régimen especial",
  B15: "Gubernamental",
  E31: "Crédito fiscal electrónica",
  E32: "Consumo electrónica",
};

const CLIENTE = "nombre,rnc_cedula,direccion,ciudad,telefono,email";

async function cargarDocumento(doc: string, id: string) {
  const sb = supabase();
  const empresa = (await sb.from("empresa").select("*").eq("id", 1).maybeSingle()).data as Empresa | null;
  const leer = async (tabla: string, select: string) => {
    const r = await sb.from(tabla).select(select).eq("id", id).maybeSingle();
    if (r.error) throw new Error(r.error.message);
    return r.data as unknown as Fila | null;
  };
  let d: Fila | null = null;
  let extra: Fila = {};
  if (doc === "cotizacion") {
    d = await leer("cotizaciones", `*, clientes(${CLIENTE}), prospectos(nombre,empresa,telefono,email,ciudad), vendedores(nombre), cotizacion_lineas(*)`);
  } else if (doc === "factura") {
    d = await leer("facturas", `*, clientes(${CLIENTE}), vendedores(nombre), factura_lineas(*)`);
    if (d?.ncf) {
      const ncf = String(d.ncf);
      const { data } = await sb.from("secuencias_ncf").select("prefijo,desde,hasta,vence").eq("tipo", String(d.tipo_ncf));
      const n = Number(ncf.replace(/^\D+/, ""));
      const sec = (data ?? []).find((s) => ncf.startsWith(String(s.prefijo)) && n >= Number(s.desde) && n <= Number(s.hasta));
      extra = { ncf_vence: sec?.vence ?? null };
    }
  } else if (doc === "conduce") {
    d = await leer("pedidos_venta", `*, clientes(${CLIENTE}), vendedores(nombre), cotizaciones(numero, cotizacion_lineas(descripcion,cantidad))`);
    if (d?.tecnico_id) extra.tecnico = (await sb.from("v_directorio").select("nombre").eq("id", String(d.tecnico_id)).maybeSingle()).data?.nombre;
  } else if (doc === "orden") {
    d = await leer("ordenes_servicio", `*, clientes(${CLIENTE}), igualas(codigo), equipos_instalados(serie,descripcion,capacidad,ubicacion), orden_servicio_insumos(cantidad,precio_unitario,cobertura, productos(codigo,nombre,unidad))`);
    if (d?.tecnico_id) extra.tecnico = (await sb.from("v_directorio").select("nombre").eq("id", String(d.tecnico_id)).maybeSingle()).data?.nombre;
  } else if (doc === "recibo") {
    d = await leer("recibos", `*, clientes(${CLIENTE}), cuentas_bancarias(banco,numero), recibo_aplicaciones(monto, facturas(numero,ncf,fecha,total,saldo))`);
  } else {
    throw new Error("Tipo de documento no reconocido.");
  }
  return { empresa, d, extra };
}

export default function Imprimir() {
  const sp = useSearchParams();
  const router = useRouter();
  const { perfil } = useSesion();
  const doc = sp.get("doc") ?? "";
  const id = sp.get("id") ?? "";
  const { datos, error, cargando } = useDatos(() => cargarDocumento(doc, id), [doc, id]);
  const hoja = useRef<HTMLElement>(null);
  const [bajando, setBajando] = useState(false);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);
  const bajarPdf = async () => {
    if (!hoja.current) return;
    setBajando(true);
    setErrorPdf(null);
    try {
      await descargarPdf(hoja.current, document.title);
    } catch (e) {
      setErrorPdf(`No se pudo generar el PDF (${e instanceof Error ? e.message : String(e)}). Use «Imprimir» y elija «Guardar como PDF».`);
    } finally {
      setBajando(false);
    }
  };

  const d = datos?.d;
  const titulos: Record<string, string> = { cotizacion: "Cotización", factura: "Factura", conduce: "Conduce", orden: "Orden de servicio", recibo: "Recibo de ingreso" };

  // El título de la pestaña es el nombre que el navegador propone para el PDF.
  useEffect(() => {
    if (!d) return;
    const c = d.clientes as Parte | null;
    const p = d.prospectos as Parte | null;
    const nombre = c?.nombre ?? p?.empresa ?? p?.nombre ?? "";
    const anterior = document.title;
    document.title = `${titulos[doc] ?? "Documento"} ${String(d.numero ?? "")} ${nombre}`.trim();
    return () => { document.title = anterior; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, doc]);

  if (cargando && !datos) return <Cargando />;
  if (error) return <Aviso tono="bad">{error}</Aviso>;
  if (!d) return <Aviso tono="warn">Documento no encontrado o sin permiso para verlo.</Aviso>;
  const e = datos.empresa;
  const cliente = d.clientes as Parte | null;

  let contenido: React.ReactNode = null;
  let sello: string | null = null;

  const vendedor = String((d.vendedores as Fila | null)?.nombre ?? "—");

  if (doc === "cotizacion") {
    const p = d.prospectos as Parte | null;
    const lineas = (d.cotizacion_lineas as Linea[]) ?? [];
    if (["rechazada", "vencida"].includes(String(d.estado))) sello = etiqueta(d.estado);
    contenido = (
      <>
        <Membrete empresa={e} titulo="Cotización" subtitulo="Propuesta comercial" />
        <Datos items={[["Cotización", String(d.numero)], ["Fecha", formatoFecha(d.fecha)], ["Válida hasta", formatoFecha(d.vence)], ["Vendedor", vendedor]]} />
        <Destinatario p={cliente ?? p} titulo={cliente ? "Preparada para" : "Para"} />
        <TablaLineas lineas={lineas} precios />
        <Totales filas={[["Subtotal", d.subtotal], ["Descuento", -Number(d.descuento ?? 0)], ["ITBIS 18%", d.itbis], ["Total", d.total, true]]} letras={Number(d.total)}>
          <Notas titulo="Notas" texto={d.notas} className="mt-3" />
          <Notas titulo="Condiciones" texto={e?.condiciones_cotizacion} className="mt-3" />
        </Totales>
        <Firmas izquierda={`Preparado por · ${vendedor !== "—" ? vendedor : e?.nombre_comercial ?? "Osmos"}`} derecha="Aceptado por el cliente · Nombre y fecha" />
      </>
    );
  } else if (doc === "factura") {
    const lineas = (d.factura_lineas as Linea[]) ?? [];
    const tipo = String(d.tipo_ncf ?? "");
    if (d.estado === "borrador") sello = "Borrador · sin valor fiscal";
    if (d.estado === "anulada") sello = "Anulada";
    contenido = (
      <>
        <Membrete empresa={e} titulo={tipo === "B15" ? "Comprobante" : "Factura"} subtitulo={TIPO_NCF[tipo]} />
        <Datos items={[["NCF", String(d.ncf ?? "Pendiente")], ["Factura", String(d.numero)], ["Emisión", formatoFecha(d.fecha)], ["Vence el pago", formatoFecha(d.vence)]]} />
        <Destinatario
          p={cliente}
          titulo="Facturado a"
          extra={[
            ["Condición", d.vence && d.vence !== d.fecha ? "Crédito" : "Contado"],
            ["Vendedor", vendedor],
            ...(datos.extra.ncf_vence ? [["NCF válido hasta", formatoFecha(datos.extra.ncf_vence)] as Par] : []),
            ["Origen", etiqueta(d.origen)],
          ]}
        />
        <TablaLineas lineas={lineas} precios />
        <Totales filas={[["Subtotal", d.subtotal], ["Descuento", -Number(d.descuento ?? 0)], ["ITBIS 18%", d.itbis], ["Total a pagar", d.total, true]]} letras={Number(d.total)}>
          {Number(d.saldo) > 0 && Number(d.saldo) < Number(d.total) ? <p className="mt-2 font-semibold">Saldo pendiente: {formatoDinero(d.saldo)}</p> : null}
          <Notas titulo="Forma de pago" texto={[e?.instrucciones_pago, e?.condiciones_factura].filter(Boolean).join("\n")} className="mt-3" />
          <Notas titulo="Notas" texto={d.notas} className="mt-3" />
        </Totales>
        <Firmas izquierda="Despachado por" derecha="Recibido conforme · Nombre y fecha" />
      </>
    );
  } else if (doc === "conduce") {
    const cot = d.cotizaciones as { numero: string; cotizacion_lineas: Linea[] } | null;
    contenido = (
      <>
        <Membrete empresa={e} titulo="Conduce" subtitulo="Entrega de mercancía" />
        <Datos items={[["Conduce", String(d.numero)], ["Fecha", formatoFecha(d.fecha)], ["Entrega", formatoFecha(d.fecha_entrega)], ["Cotización", cot?.numero ?? "—"]]} />
        <Destinatario p={cliente} titulo="Entregar a" tituloExtra="Entrega" extra={[["Técnico / chofer", String(datos.extra.tecnico ?? "—")], ["Vendedor", vendedor]]} />
        <TablaLineas lineas={cot?.cotizacion_lineas ?? []} precios={false} />
        <p className="mt-4 text-[11px] text-osmos-muted">El cliente declara recibir los artículos descritos en buen estado. Este documento no es un comprobante fiscal.</p>
        <Firmas izquierda="Entregado por" derecha="Recibido por · Cédula · Fecha" />
      </>
    );
  } else if (doc === "orden") {
    const eq = d.equipos_instalados as Fila | null;
    const insumos = ((d.orden_servicio_insumos as Fila[]) ?? []).map((i) => {
      const p = i.productos as Fila | null;
      return { descripcion: p ? `${p.codigo} · ${p.nombre}` : "—", cantidad: Number(i.cantidad), nota: i.cobertura === "incluido" ? "Incluido en la iguala" : `Facturable · ${formatoDinero(i.precio_unitario)} c/u` };
    });
    contenido = (
      <>
        <Membrete empresa={e} titulo="Orden de servicio" subtitulo={etiqueta(d.tipo)} />
        <Datos items={[["Orden", String(d.numero)], ["Fecha", formatoFecha(d.fecha)], ["Iguala", String((d.igualas as Fila | null)?.codigo ?? "—")], ["Técnico", String(datos.extra.tecnico ?? "—")]]} />
        <Destinatario
          p={cliente}
          tituloExtra="Equipo atendido"
          extra={[
            ["Equipo", eq ? String(eq.descripcion) : "—"],
            ["Serie", eq ? String(eq.serie) : "—"],
            ...(eq?.capacidad ? [["Capacidad", String(eq.capacidad)] as Par] : []),
            ...(eq?.ubicacion ? [["Ubicación", String(eq.ubicacion)] as Par] : []),
          ]}
        />
        <Notas titulo="Trabajo realizado" texto={d.trabajo_realizado ?? "—"} className="mt-0" />
        <Notas titulo="Observaciones" texto={d.observaciones} />
        <h4 className="mb-1 mt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-osmos-navy">Insumos y repuestos utilizados</h4>
        <TablaLineas lineas={insumos} precios={false} />
        <Firmas izquierda="Técnico de Osmos" derecha="Conforme el cliente · Nombre y fecha" />
      </>
    );
  } else if (doc === "recibo") {
    const apl = (d.recibo_aplicaciones as Fila[]) ?? [];
    const banco = d.cuentas_bancarias as Fila | null;
    if (d.estado === "anulado") sello = "Anulado";
    contenido = (
      <>
        <Membrete empresa={e} titulo="Recibo" subtitulo="De ingreso" />
        <Datos items={[["Recibo", String(d.numero)], ["Fecha", formatoFecha(d.fecha)], ["Forma de pago", etiqueta(d.forma_pago)], ["Referencia", String(d.referencia ?? "—")]]} />
        <Destinatario p={cliente} titulo="Recibimos de" tituloExtra="Depósito" extra={banco ? [["Cuenta", `${banco.banco} · ${banco.numero}`]] : []} />
        <p className="mb-4 rounded bg-osmos-bg px-3.5 py-2.5 text-[13px]">
          La suma de <strong>{numeroEnLetras(Number(d.monto))}</strong> ({formatoDinero(d.monto)}), aplicada a:
        </p>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {["Factura", "NCF", "Fecha", "Monto factura", "Aplicado", "Saldo actual"].map((h, i) => (
                <th key={h} className={`${TH} ${i > 2 ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apl.length === 0 ? (
              <tr><td colSpan={6} className={`${TD} text-osmos-muted`}>Pago a cuenta, sin facturas aplicadas todavía.</td></tr>
            ) : (
              apl.map((a, i) => {
                const f = a.facturas as Fila;
                return (
                  <tr key={i}>
                    <td className={`${TD} font-semibold`}>{String(f?.numero ?? "—")}</td>
                    <td className={TD}>{String(f?.ncf ?? "—")}</td>
                    <td className={TD}>{formatoFecha(f?.fecha)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{formatoDinero(f?.total)}</td>
                    <td className={`${TD} text-right font-bold tabular-nums`}>{formatoDinero(a.monto)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{formatoDinero(f?.saldo)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Totales filas={[["Aplicado a facturas", d.aplicado], ["Total recibido", d.monto, true]]} />
        <Firmas izquierda="Recibido por · Osmos" derecha="Entregado por el cliente" />
      </>
    );
  }

  const admin = perfil?.rol === "admin";
  const faltaEmpresa = !e?.rnc || !e?.telefono;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" onClick={() => router.back()} className="btn-secondary">← Volver</button>
        <button type="button" onClick={bajarPdf} disabled={bajando} className="btn-primary">{bajando ? "Generando PDF…" : "Descargar PDF"}</button>
        <button type="button" onClick={() => window.print()} className="btn-secondary">Imprimir</button>
        {admin ? <Link href={`/editar/?f=config/empresa&id=1&volver=${encodeURIComponent(`/imprimir/?doc=${doc}&id=${id}`)}`} className="btn-secondary">Datos de la empresa</Link> : null}
        <span className="text-xs text-osmos-muted">El PDF se guarda en Descargas, listo para enviar por WhatsApp o correo.</span>
      </div>
      {faltaEmpresa ? (
        <div className="print:hidden">
          <Aviso tono="warn">Faltan datos de la empresa (RNC o teléfono) en el membrete. {admin ? "Complételos en «Datos de la empresa»." : "Pida al administrador que los complete."}</Aviso>
        </div>
      ) : null}
      {/* En el teléfono la hoja conserva su ancho y se desplaza de lado */}
      <div className="overflow-x-auto print:overflow-visible">
      {errorPdf ? <div className="print:hidden"><Aviso tono="bad">{errorPdf}</Aviso></div> : null}
      <Hoja hojaRef={hoja} sello={sello} empresa={e}>
        {contenido}
      </Hoja>
      </div>
    </>
  );
}
