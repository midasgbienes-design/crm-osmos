"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { descargarPdf } from "@/lib/pdf";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { etiqueta, formatoDinero, formatoFecha, formatoNumero, numeroEnLetras } from "@/lib/formato";
import { Aviso } from "@/components/ui";
import { Cargando } from "@/components/mensajes";
import { useSesion } from "@/components/sesion";

type Fila = Record<string, unknown>;
type Empresa = {
  razon_social: string; nombre_comercial: string; rnc: string | null; direccion: string | null; ciudad: string | null;
  telefono: string | null; email: string | null; sitio_web: string | null; whatsapp: string | null;
  condiciones_cotizacion: string | null; condiciones_factura: string | null; instrucciones_pago: string | null;
};
type Parte = { nombre?: string | null; empresa?: string | null; rnc_cedula?: string | null; direccion?: string | null; ciudad?: string | null; telefono?: string | null; email?: string | null };
type Linea = { descripcion: string; cantidad: number; precio?: number; descuento_pct?: number; itbis?: number; total?: number; nota?: string };

const TITULO_NCF: Record<string, string> = {
  B01: "Factura de Crédito Fiscal",
  B02: "Factura de Consumo",
  B14: "Factura de Régimen Especial",
  B15: "Comprobante Gubernamental",
  E31: "Factura de Crédito Fiscal Electrónica",
  E32: "Factura de Consumo Electrónica",
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

function Membrete({ empresa, titulo, numero, filas }: { empresa: Empresa | null; titulo: string; numero: string; filas: [string, string][] }) {
  const e = empresa;
  return (
    <header className="flex items-start justify-between gap-6 border-b-[3px] border-osmos-navy pb-4">
      <div className="flex flex-col gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/osmos-wordmark.png" alt="Osmos" className="mb-1 h-auto w-[150px]" />
        <strong className="text-[13px] text-osmos-navy">{e?.razon_social ?? "Osmos Tecnología del Agua"}</strong>
        <span className="text-[11px] leading-4 text-osmos-muted">
          {e?.rnc ? <>RNC {e.rnc}<br /></> : null}
          {[e?.direccion, e?.ciudad].filter(Boolean).join(", ")}
          {e?.direccion || e?.ciudad ? <br /> : null}
          {[e?.telefono && `Tel. ${e.telefono}`, e?.whatsapp && `WhatsApp ${e.whatsapp}`].filter(Boolean).join(" · ")}
          {e?.telefono || e?.whatsapp ? <br /> : null}
          {[e?.email, e?.sitio_web].filter(Boolean).join(" · ")}
        </span>
      </div>
      <div className="min-w-[230px] text-right">
        <h1 className="font-display text-[15px] uppercase leading-5 text-osmos-navy">{titulo}</h1>
        <p className="mb-2 text-lg font-bold text-osmos-teal">{numero}</p>
        <dl className="grid grid-cols-[auto_auto] justify-end gap-x-3 text-[11px]">
          {filas.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-osmos-muted">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

function Destinatario({ titulo = "Cliente", p, extra = [] }: { titulo?: string; p: Parte | null; extra?: [string, string][] }) {
  const nombre = p?.empresa || p?.nombre || "—";
  return (
    <section className="grid grid-cols-2 gap-4 py-4 text-[12px]">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-osmos-muted">{titulo}</span>
        <strong className="text-[13px]">{nombre}</strong>
        {p?.empresa && p?.nombre ? <span>Atención: {p.nombre}</span> : null}
        {p?.rnc_cedula ? <span>RNC / Cédula: {p.rnc_cedula}</span> : null}
        {p?.direccion || p?.ciudad ? <span>{[p?.direccion, p?.ciudad].filter(Boolean).join(", ")}</span> : null}
        {p?.telefono || p?.email ? <span>{[p?.telefono, p?.email].filter(Boolean).join(" · ")}</span> : null}
      </div>
      <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-0.5">
        {extra.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-osmos-muted">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TablaLineas({ lineas, precios }: { lineas: Linea[]; precios: boolean }) {
  const cab = precios ? ["#", "Descripción", "Cant.", "Precio", "Desc.", "ITBIS", "Importe"] : ["#", "Descripción", "Cantidad", "Nota"];
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="bg-osmos-navy text-white">
          {cab.map((h, i) => (
            <th key={h} className={`whitespace-nowrap px-2 py-1.5 text-left font-semibold ${precios && i > 1 ? "text-right" : ""}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lineas.length === 0 ? (
          <tr><td colSpan={cab.length} className="px-2 py-3 text-osmos-muted">Sin artículos.</td></tr>
        ) : (
          lineas.map((l, i) => (
            <tr key={i} className="break-inside-avoid border-b border-osmos-line">
              <td className="px-2 py-1.5 align-top text-osmos-muted">{i + 1}</td>
              <td className="px-2 py-1.5 align-top">{l.descripcion}</td>
              <td className={`px-2 py-1.5 align-top tabular-nums ${precios ? "text-right" : ""}`}>{formatoNumero(l.cantidad)}</td>
              {precios ? (
                <>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right align-top tabular-nums">{formatoDinero(l.precio)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right align-top tabular-nums">{Number(l.descuento_pct ?? 0) ? `${formatoNumero(l.descuento_pct)}%` : "—"}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right align-top tabular-nums">{formatoDinero(l.itbis)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right align-top font-semibold tabular-nums">{formatoDinero(l.total)}</td>
                </>
              ) : (
                <td className="px-2 py-1.5 align-top text-osmos-muted">{l.nota ?? ""}</td>
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function Totales({ filas, letras }: { filas: [string, unknown, boolean?][]; letras?: number }) {
  return (
    <div className="mt-3 flex items-start justify-between gap-6 break-inside-avoid">
      <p className="max-w-[55%] text-[11px] italic text-osmos-muted">{letras !== undefined ? `Son: ${numeroEnLetras(letras)}` : ""}</p>
      <dl className="grid min-w-[240px] grid-cols-2 gap-x-6 gap-y-0.5 text-[12px]">
        {filas.map(([k, v, fuerte]) => (
          <div key={k} className={`contents ${fuerte ? "text-[14px] font-bold text-osmos-navy" : ""}`}>
            <dt className={fuerte ? "border-t border-osmos-navy pt-1" : "text-osmos-muted"}>{k}</dt>
            <dd className={`text-right tabular-nums ${fuerte ? "border-t border-osmos-navy pt-1" : ""}`}>{formatoDinero(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Notas({ titulo, texto }: { titulo: string; texto?: unknown }) {
  if (!texto) return null;
  return (
    <section className="mt-4 break-inside-avoid text-[11px]">
      <h2 className="mb-0.5 font-bold text-osmos-navy">{titulo}</h2>
      <p className="whitespace-pre-line text-osmos-ink">{String(texto)}</p>
    </section>
  );
}

function Firmas({ izquierda, derecha }: { izquierda: string; derecha: string }) {
  return (
    <section className="mt-14 grid grid-cols-2 gap-16 break-inside-avoid text-center text-[11px]">
      {[izquierda, derecha].map((t) => (
        <div key={t} className="border-t border-osmos-ink pt-1">{t}</div>
      ))}
    </section>
  );
}

function Sello({ texto }: { texto: string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <span className="rotate-[-24deg] whitespace-nowrap rounded-lg border-[6px] border-red-600/25 px-6 text-6xl font-bold uppercase text-red-600/25">{texto}</span>
    </div>
  );
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

  if (doc === "cotizacion") {
    const p = d.prospectos as Parte | null;
    const lineas = (d.cotizacion_lineas as Linea[]) ?? [];
    if (["rechazada", "vencida"].includes(String(d.estado))) sello = etiqueta(d.estado);
    contenido = (
      <>
        <Membrete empresa={e} titulo="Cotización" numero={String(d.numero)} filas={[["Fecha", formatoFecha(d.fecha)], ["Válida hasta", formatoFecha(d.vence)], ["Vendedor", (d.vendedores as Fila | null)?.nombre as string ?? "—"]]} />
        <Destinatario p={cliente ?? p} titulo={cliente ? "Cliente" : "Para"} />
        <TablaLineas lineas={lineas} precios />
        <Totales filas={[["Subtotal", d.subtotal], ["Descuento", -Number(d.descuento ?? 0)], ["ITBIS", d.itbis], ["Total", d.total, true]]} letras={Number(d.total)} />
        <Notas titulo="Notas" texto={d.notas} />
        <Notas titulo="Condiciones" texto={e?.condiciones_cotizacion} />
        <Firmas izquierda={`Preparado por · ${e?.nombre_comercial ?? "Osmos"}`} derecha="Aceptado por el cliente · Fecha" />
      </>
    );
  } else if (doc === "factura") {
    const lineas = (d.factura_lineas as Linea[]) ?? [];
    const tipo = String(d.tipo_ncf ?? "");
    if (d.estado === "borrador") sello = "Borrador · sin valor fiscal";
    if (d.estado === "anulada") sello = "Anulada";
    contenido = (
      <>
        <Membrete
          empresa={e}
          titulo={TITULO_NCF[tipo] ?? "Factura"}
          numero={d.ncf ? `NCF ${d.ncf}` : String(d.numero)}
          filas={[
            ["Factura", String(d.numero)],
            ["Fecha de emisión", formatoFecha(d.fecha)],
            ...(datos.extra.ncf_vence ? [["NCF válido hasta", formatoFecha(datos.extra.ncf_vence)] as [string, string]] : []),
            ["Vence el pago", formatoFecha(d.vence)],
          ]}
        />
        <Destinatario p={cliente} extra={[["Vendedor", String((d.vendedores as Fila | null)?.nombre ?? "—")], ["Origen", etiqueta(d.origen)], ["Condición", d.vence ? "Crédito" : "Contado"]]} />
        <TablaLineas lineas={lineas} precios />
        <Totales filas={[["Subtotal", d.subtotal], ["Descuento", -Number(d.descuento ?? 0)], ["ITBIS 18%", d.itbis], ["Total a pagar", d.total, true]]} letras={Number(d.total)} />
        {Number(d.saldo) > 0 && Number(d.saldo) < Number(d.total) ? <p className="mt-1 text-right text-[12px] font-semibold">Saldo pendiente: {formatoDinero(d.saldo)}</p> : null}
        <Notas titulo="Notas" texto={d.notas} />
        <Notas titulo="Forma de pago" texto={[e?.condiciones_factura, e?.instrucciones_pago].filter(Boolean).join("\n")} />
        <Firmas izquierda="Despachado por" derecha="Recibido conforme · Fecha" />
      </>
    );
  } else if (doc === "conduce") {
    const cot = d.cotizaciones as { numero: string; cotizacion_lineas: Linea[] } | null;
    contenido = (
      <>
        <Membrete empresa={e} titulo="Conduce de entrega" numero={String(d.numero)} filas={[["Fecha", formatoFecha(d.fecha)], ["Entrega", formatoFecha(d.fecha_entrega)], ["Cotización", cot?.numero ?? "—"]]} />
        <Destinatario p={cliente} titulo="Entregar a" extra={[["Técnico / chofer", String(datos.extra.tecnico ?? "—")], ["Vendedor", String((d.vendedores as Fila | null)?.nombre ?? "—")]]} />
        <TablaLineas lineas={cot?.cotizacion_lineas ?? []} precios={false} />
        <p className="mt-3 text-[11px] text-osmos-muted">El cliente declara recibir los artículos descritos en buen estado. Este documento no es un comprobante fiscal.</p>
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
        <Membrete empresa={e} titulo="Orden de servicio" numero={String(d.numero)} filas={[["Fecha", formatoFecha(d.fecha)], ["Tipo", etiqueta(d.tipo)], ["Iguala", String((d.igualas as Fila | null)?.codigo ?? "—")]]} />
        <Destinatario
          p={cliente}
          extra={[
            ["Técnico", String(datos.extra.tecnico ?? "—")],
            ["Equipo", eq ? `${eq.descripcion}` : "—"],
            ["Serie", eq ? String(eq.serie) : "—"],
            ...(eq?.ubicacion ? [["Ubicación", String(eq.ubicacion)] as [string, string]] : []),
          ]}
        />
        <Notas titulo="Trabajo realizado" texto={d.trabajo_realizado ?? "—"} />
        <Notas titulo="Observaciones" texto={d.observaciones} />
        <h2 className="mb-1 mt-4 text-[11px] font-bold text-osmos-navy">Insumos y repuestos utilizados</h2>
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
        <Membrete empresa={e} titulo="Recibo de ingreso" numero={String(d.numero)} filas={[["Fecha", formatoFecha(d.fecha)], ["Forma de pago", etiqueta(d.forma_pago)], ["Referencia", String(d.referencia ?? "—")]]} />
        <Destinatario p={cliente} titulo="Recibimos de" extra={banco ? [["Depositado en", `${banco.banco} · ${banco.numero}`]] : []} />
        <p className="mb-3 rounded-md bg-osmos-bg px-3 py-2 text-[13px]">
          La suma de <strong>{numeroEnLetras(Number(d.monto))}</strong> ({formatoDinero(d.monto)}) aplicada a:
        </p>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-osmos-navy text-white">
              {["Factura", "NCF", "Fecha", "Monto factura", "Aplicado", "Saldo actual"].map((h, i) => (
                <th key={h} className={`px-2 py-1.5 text-left font-semibold ${i > 2 ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apl.length === 0 ? (
              <tr><td colSpan={6} className="px-2 py-3 text-osmos-muted">Pago a cuenta, sin facturas aplicadas todavía.</td></tr>
            ) : (
              apl.map((a, i) => {
                const f = a.facturas as Fila;
                return (
                  <tr key={i} className="border-b border-osmos-line">
                    <td className="px-2 py-1.5">{String(f?.numero ?? "—")}</td>
                    <td className="px-2 py-1.5">{String(f?.ncf ?? "—")}</td>
                    <td className="px-2 py-1.5">{formatoFecha(f?.fecha)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatoDinero(f?.total)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatoDinero(a.monto)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatoDinero(f?.saldo)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Totales filas={[["Aplicado", d.aplicado], ["Total recibido", d.monto, true]]} />
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
      <article ref={hoja} className="hoja relative mx-auto w-full min-w-[640px] max-w-[816px] bg-white p-10 shadow-sm print:min-w-0 print:max-w-none print:p-0 print:shadow-none">
        {sello ? <Sello texto={sello} /> : null}
        {contenido}
        <footer className="mt-8 border-t border-osmos-line pt-2 text-center text-[10px] text-osmos-muted">
          {e?.razon_social ?? "Osmos Tecnología del Agua"} · Documento generado el {formatoFecha(new Date().toLocaleDateString("sv-SE"))}
        </footer>
      </article>
      </div>
    </>
  );
}
