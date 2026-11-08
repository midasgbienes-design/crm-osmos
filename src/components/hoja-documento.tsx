// Piezas de la hoja timbrada de Osmos (cotización, factura, conduce, orden y recibo).
// Diseño: franja lateral con los colores de la marca, rombo como marca de agua,
// nombre del documento en grande y datos clave en una fila.
import { formatoDinero, formatoNumero, numeroEnLetras } from "@/lib/formato";

export type Empresa = {
  razon_social: string; nombre_comercial: string; rnc: string | null; direccion: string | null; ciudad: string | null;
  telefono: string | null; email: string | null; sitio_web: string | null; whatsapp: string | null;
  condiciones_cotizacion: string | null; condiciones_factura: string | null; instrucciones_pago: string | null;
  // Apariencia (Configuración → Apariencia de documentos)
  logo_url?: string | null; marca_agua_url?: string | null; firma_url?: string | null;
  marca_agua_visible?: boolean | null; marca_agua_opacidad?: number | null;
  lema?: string | null; pie_documentos?: string | null; subtitulo_cotizacion?: string | null;
};

export const LOGO_PREDETERMINADO = "/osmos-wordmark.png";
export const MARCA_PREDETERMINADA = "/osmos-rombo-agua.png";
export type Parte = { nombre?: string | null; empresa?: string | null; rnc_cedula?: string | null; direccion?: string | null; ciudad?: string | null; telefono?: string | null; email?: string | null };
export type Linea = { descripcion: string; cantidad: number; precio?: number; descuento_pct?: number; itbis?: number; total?: number; nota?: string };
export type Par = [string, string];

// Encabezado: logo y datos de Osmos a la izquierda; nombre del documento en grande a la derecha.
export function Membrete({ empresa, titulo, subtitulo }: { empresa: Empresa | null; titulo: string; subtitulo?: string }) {
  const e = empresa;
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="flex flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={e?.logo_url || LOGO_PREDETERMINADO} alt={e?.nombre_comercial ?? "Osmos"} crossOrigin="anonymous" className="h-auto max-h-[80px] w-auto max-w-[200px] self-start object-contain" />
        {e?.lema ? <span className="mt-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-osmos-teal">{e.lema}</span> : null}
        <span className="mt-2.5 text-[11px] leading-[17px] text-osmos-muted">
          <strong className="text-[12.5px] text-osmos-navy">{e?.razon_social ?? "Osmos Tecnología del Agua"}</strong>
          <br />
          {[e?.rnc && `RNC ${e.rnc}`, [e?.direccion, e?.ciudad].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
          {e?.rnc || e?.direccion || e?.ciudad ? <br /> : null}
          {[e?.telefono, e?.whatsapp && `WhatsApp ${e.whatsapp}`, e?.email, e?.sitio_web].filter(Boolean).join(" · ")}
        </span>
      </div>
      <div className="text-right">
        <h1 className={`font-display uppercase leading-none text-osmos-navy ${titulo.length > 10 ? "text-[22px]" : "text-[30px]"}`}>{titulo}</h1>
        {subtitulo ? <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-osmos-teal">{subtitulo}</p> : null}
      </div>
    </header>
  );
}

// Fila de datos clave (número, fechas…), separados por líneas finas.
export function Datos({ items }: { items: Par[] }) {
  return (
    <div className="mb-5 mt-7 grid border-y border-osmos-line" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(([k, v], i) => (
        <div key={k} className={`py-2.5 ${i ? "border-l border-osmos-line px-3" : "pr-3"}`}>
          <span className="block text-[9.5px] uppercase tracking-[0.14em] text-osmos-muted">{k}</span>
          <strong className="text-[13.5px] text-osmos-navy">{v}</strong>
        </div>
      ))}
    </div>
  );
}

export function Destinatario({ titulo = "Cliente", p, extra = [], tituloExtra = "Condiciones" }: { titulo?: string; p: Parte | null; extra?: Par[]; tituloExtra?: string }) {
  const nombre = p?.empresa || p?.nombre || "—";
  const lineas = [
    p?.empresa && p?.nombre ? `Atención: ${p.nombre}` : null,
    p?.rnc_cedula ? `RNC / Cédula ${p.rnc_cedula}` : null,
    [p?.direccion, p?.ciudad].filter(Boolean).join(", ") || null,
    [p?.telefono, p?.email].filter(Boolean).join(" · ") || null,
  ].filter(Boolean);
  return (
    <section className="mb-5 grid grid-cols-2 gap-5 text-[12px]">
      <div>
        <h3 className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-osmos-teal">{titulo}</h3>
        <strong className="mb-0.5 block text-[16px] text-osmos-ink">{nombre}</strong>
        <p className="leading-[17px] text-osmos-muted">{lineas.map((l, i) => <span key={i} className="block">{l}</span>)}</p>
      </div>
      {extra.length ? (
        <div>
          <h3 className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-osmos-teal">{tituloExtra}</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 leading-[17px]">
            {extra.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-osmos-muted">{k}</dt>
                <dd className="font-semibold text-osmos-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

export const TH = "whitespace-nowrap border-b-2 border-osmos-navy px-2 py-2 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-osmos-navy";
export const TD = "border-b border-osmos-line px-2 py-2.5 align-top";

export function TablaLineas({ lineas, precios }: { lineas: Linea[]; precios: boolean }) {
  const cab = precios ? ["Descripción", "Cant.", "Precio", "Desc.", "ITBIS", "Importe"] : ["Descripción", "Cantidad", "Nota"];
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr>
          {cab.map((h, i) => (
            <th key={h} className={`${TH} ${precios && i > 0 ? "text-right" : ""}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lineas.length === 0 ? (
          <tr><td colSpan={cab.length} className={`${TD} text-osmos-muted`}>Sin artículos.</td></tr>
        ) : (
          lineas.map((l, i) => (
            <tr key={i} className="break-inside-avoid">
              <td className={TD}><strong className="font-semibold text-osmos-ink">{l.descripcion}</strong></td>
              <td className={`${TD} tabular-nums ${precios ? "text-right" : ""}`}>{formatoNumero(l.cantidad)}</td>
              {precios ? (
                <>
                  <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{formatoDinero(l.precio)}</td>
                  <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{Number(l.descuento_pct ?? 0) ? `${formatoNumero(l.descuento_pct)}%` : "—"}</td>
                  <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{formatoDinero(l.itbis)}</td>
                  <td className={`${TD} whitespace-nowrap text-right font-bold tabular-nums`}>{formatoDinero(l.total)}</td>
                </>
              ) : (
                <td className={`${TD} text-osmos-muted`}>{l.nota ?? ""}</td>
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

// Totales a la derecha; a la izquierda el monto en letras y lo que se pase como contenido.
export function Totales({ filas, letras, children }: { filas: [string, unknown, boolean?][]; letras?: number; children?: React.ReactNode }) {
  return (
    <div className="mt-4 grid grid-cols-[1fr_280px] gap-8 break-inside-avoid">
      <div className="text-[11.5px]">
        {letras !== undefined ? <p className="italic text-osmos-muted">Son: {numeroEnLetras(letras)}</p> : null}
        {children}
      </div>
      <dl className="text-[12px]">
        {filas.map(([k, v, fuerte]) =>
          fuerte ? (
            <div key={k} className="mt-2 flex justify-between rounded bg-gradient-to-r from-osmos-navy to-osmos-navy2 px-3.5 py-3 text-[16px] font-bold text-white">
              <dt>{k}</dt>
              <dd className="tabular-nums">{formatoDinero(v)}</dd>
            </div>
          ) : (
            <div key={k} className="flex justify-between border-b border-osmos-line py-1.5">
              <dt className="text-osmos-muted">{k}</dt>
              <dd className="tabular-nums">{formatoDinero(v)}</dd>
            </div>
          ),
        )}
      </dl>
    </div>
  );
}

export function Notas({ titulo, texto, className = "mt-4" }: { titulo: string; texto?: unknown; className?: string }) {
  if (!texto) return null;
  return (
    <section className={`${className} break-inside-avoid text-[11.5px]`}>
      <h4 className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-osmos-navy">{titulo}</h4>
      <p className="whitespace-pre-line leading-[16px] text-osmos-ink">{String(texto)}</p>
    </section>
  );
}

// Firmas al pie. Si hay una firma o sello cargado, aparece sobre la línea de Osmos (izquierda).
export function Firmas({ izquierda, derecha, firma }: { izquierda: string; derecha: string; firma?: string | null }) {
  return (
    <section className="mt-auto grid grid-cols-2 items-end gap-16 break-inside-avoid pb-6 pt-14 text-center text-[11px] text-osmos-muted">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {firma ? <img src={firma} alt="Firma" crossOrigin="anonymous" className="mx-auto -mb-2 h-[64px] w-auto max-w-[220px] object-contain" /> : null}
        <div className="border-t border-osmos-ink pt-1.5">{izquierda}</div>
      </div>
      <div className="border-t border-osmos-ink pt-1.5">{derecha}</div>
    </section>
  );
}

export function Sello({ texto }: { texto: string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center overflow-hidden">
      <span className="rotate-[-24deg] whitespace-nowrap rounded-lg border-[6px] border-red-600/25 px-6 text-6xl font-bold uppercase text-red-600/25">{texto}</span>
    </div>
  );
}

// La hoja completa: franja lateral, marca de agua, contenido y pie.
export function Hoja({ hojaRef, sello, empresa, children }: { hojaRef?: React.Ref<HTMLElement>; sello: string | null; empresa: Empresa | null; children: React.ReactNode }) {
  const hoy = new Date().toLocaleDateString("sv-SE").split("-").reverse().join("/");
  const opacidad = Number(empresa?.marca_agua_opacidad ?? 6) / 100;
  return (
    <>
      {/* Impresión sin márgenes del navegador: la hoja trae los suyos y la franja llega al borde */}
      <style>{"@page { size: letter; margin: 0; }"}</style>
      <article
        ref={hojaRef}
        className="hoja relative mx-auto flex min-h-[1056px] w-full min-w-[640px] max-w-[816px] overflow-hidden bg-white shadow-sm print:min-h-[11in] print:min-w-0 print:max-w-none print:overflow-visible print:shadow-none"
      >
        <div data-pdf="franja" aria-hidden="true" className="w-[34px] shrink-0 bg-[linear-gradient(180deg,#00246A_0_82%,#0093A5_82%_94%,#D3D200_94%_100%)] print:fixed print:bottom-0 print:left-0 print:top-0" />
        {empresa?.marca_agua_visible !== false ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            data-pdf="agua"
            data-opacidad={opacidad}
            src={empresa?.marca_agua_url || MARCA_PREDETERMINADA}
            alt=""
            aria-hidden="true"
            crossOrigin="anonymous"
            style={{ opacity: opacidad }}
            className="pointer-events-none absolute left-[calc(50%+17px)] top-[55%] w-[600px] max-w-none -translate-x-1/2 -translate-y-1/2 print:fixed"
          />
        ) : null}
        {sello ? <Sello texto={sello} /> : null}
        <div className="relative z-[1] flex min-w-0 flex-1 flex-col pl-11 pr-12 pt-11 print:ml-[34px]">
          {children}
          <footer className="flex justify-between border-t border-osmos-line pb-5 pt-3 text-[10.5px] text-osmos-muted">
            <span>{empresa?.pie_documentos ?? `Gracias por confiar en ${empresa?.nombre_comercial ?? "Osmos"}.`}</span>
            <span>{[empresa?.sitio_web, `Generado el ${hoy}`].filter(Boolean).join(" · ")}</span>
          </footer>
        </div>
      </article>
    </>
  );
}
