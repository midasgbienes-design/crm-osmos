"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { cargarImagen, prepararLogo, prepararMarcaDeAgua, subirMarca } from "@/lib/imagenes";
import { Aviso, Encabezado } from "@/components/ui";
import { Cargando } from "@/components/mensajes";
import { useSesion } from "@/components/sesion";
import { Datos, Destinatario, Firmas, Hoja, LOGO_PREDETERMINADO, MARCA_PREDETERMINADA, Membrete, Notas, TablaLineas, Totales, type Empresa } from "@/components/hoja-documento";

type Campo = "logo_url" | "marca_agua_url" | "firma_url";

// Vista previa con datos de ejemplo.
function Ejemplo({ e }: { e: Empresa }) {
  return (
    <Hoja sello={null} empresa={e}>
      <Membrete empresa={e} titulo="Cotización" subtitulo={e.subtitulo_cotizacion ?? "Propuesta comercial"} />
      <Datos items={[["Cotización", "COT-0000"], ["Fecha", "08/11/2026"], ["Válida hasta", "23/11/2026"], ["Vendedor", "María Pérez"]]} />
      <Destinatario p={{ nombre: "Cliente de ejemplo, SRL", rnc_cedula: "1-01-00000-1", ciudad: "Santiago", telefono: "809-555-0000" }} titulo="Preparada para" />
      <TablaLineas
        precios
        lineas={[
          { descripcion: "Sistema de ósmosis inversa 1,000 GPD", cantidad: 1, precio: 185000, itbis: 33300, total: 218300 },
          { descripcion: "Instalación y puesta en marcha", cantidad: 1, precio: 15000, itbis: 2700, total: 17700 },
        ]}
      />
      <Totales filas={[["Subtotal", 200000], ["ITBIS 18%", 36000], ["Total", 236000, true]]} letras={236000}>
        <Notas titulo="Condiciones" texto={e.condiciones_cotizacion} className="mt-3" />
      </Totales>
      <Firmas firma={e.firma_url} izquierda="Preparado por · María Pérez" derecha="Aceptado por el cliente · Nombre y fecha" />
    </Hoja>
  );
}

function Imagen({ titulo, ayuda, url, predeterminada, fondo, subiendo, onArchivo, onQuitar, extra }: {
  titulo: string; ayuda: string; url: string | null | undefined; predeterminada?: string; fondo?: string;
  subiendo: boolean; onArchivo: (f: File) => void; onQuitar: () => void; extra?: React.ReactNode;
}) {
  const id = `img-${titulo.replace(/\W+/g, "-")}`;
  const mostrar = url || predeterminada;
  return (
    <div className="flex flex-col gap-2 border-b border-osmos-line pb-4 last:border-0">
      <div>
        <strong className="text-sm text-osmos-navy">{titulo}</strong>
        <p className="text-xs text-osmos-muted">{ayuda}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex h-20 w-40 items-center justify-center rounded-md border border-osmos-line p-2 ${fondo ?? "bg-white"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {mostrar ? <img src={mostrar} alt={titulo} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-osmos-muted">Sin imagen</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className={`btn-secondary cursor-pointer ${subiendo ? "pointer-events-none opacity-60" : ""}`}>
            {subiendo ? "Subiendo…" : url ? "Cambiar imagen" : "Subir imagen"}
          </label>
          <input
            id={id}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) onArchivo(f);
              ev.target.value = "";
            }}
          />
          {url ? (
            <button type="button" onClick={onQuitar} className="text-left text-xs font-bold text-osmos-navy2 underline">
              {predeterminada ? "Volver a la predeterminada" : "Quitar"}
            </button>
          ) : null}
        </div>
      </div>
      {extra}
    </div>
  );
}

export default function AparienciaDocumentos() {
  const { perfil } = useSesion();
  const [aviso, setAviso] = useState<{ tono: "ok" | "bad"; texto: string } | null>(null);
  const [subiendo, setSubiendo] = useState<Campo | null>(null);
  const [colores, setColores] = useState(false);
  const [e, setE] = useState<Empresa | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { datos, error, cargando } = useDatos(async () => {
    const { data, error } = await supabase().from("empresa").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Empresa | null;
  }, []);
  useEffect(() => {
    if (datos) setE(datos);
  }, [datos]);

  if (perfil?.rol !== "admin") return <Aviso tono="warn">Solo el administrador puede cambiar la apariencia de los documentos.</Aviso>;
  if (cargando && !e) return <Cargando />;
  if (error) return <Aviso tono="bad">{error.includes("marca_agua") || error.includes("logo_url") ? "Falta ejecutar la actualización 8-apariencia-documentos.sql en Supabase." : error}</Aviso>;
  if (!e) return <Aviso tono="warn">No se encontraron los datos de la empresa.</Aviso>;

  const guardar = async (cambios: Partial<Empresa>, mensaje: string) => {
    setAviso(null);
    const { error } = await supabase().from("empresa").update(cambios).eq("id", 1);
    if (error) {
      setAviso({ tono: "bad", texto: error.message.includes("column") ? "Falta ejecutar la actualización 8-apariencia-documentos.sql en Supabase." : error.message });
      return false;
    }
    setE({ ...e, ...cambios });
    setAviso({ tono: "ok", texto: mensaje });
    return true;
  };

  const subir = async (campo: Campo, archivo: File) => {
    if (archivo.size > 5 * 1024 * 1024) {
      setAviso({ tono: "bad", texto: "La imagen pesa más de 5 MB. Use una versión más liviana." });
      return;
    }
    setSubiendo(campo);
    setAviso(null);
    try {
      const img = await cargarImagen(archivo);
      const blob = campo === "marca_agua_url" ? await prepararMarcaDeAgua(img, colores) : await prepararLogo(img, campo === "firma_url" ? 600 : 900);
      const url = await subirMarca(campo.replace("_url", ""), blob);
      await guardar({ [campo]: url }, campo === "logo_url" ? "Logo actualizado." : campo === "firma_url" ? "Firma actualizada." : "Marca de agua actualizada.");
    } catch (err) {
      setAviso({ tono: "bad", texto: err instanceof Error ? err.message : String(err) });
    } finally {
      setSubiendo(null);
    }
  };

  const guardarTextos = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const t = (k: string) => String(f.get(k) ?? "").trim() || null;
    setGuardando(true);
    await guardar(
      { lema: t("lema"), pie_documentos: t("pie_documentos"), subtitulo_cotizacion: t("subtitulo_cotizacion"), condiciones_cotizacion: t("condiciones_cotizacion"), condiciones_factura: t("condiciones_factura"), instrucciones_pago: t("instrucciones_pago") },
      "Textos guardados.",
    );
    setGuardando(false);
  };

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Configuración", href: "/configuracion/" }, { texto: "Apariencia de documentos" }]}
        titulo="Apariencia de documentos"
        descripcion="Logo, marca de agua, firma y textos de cotizaciones, facturas, conduces, órdenes y recibos. La vista previa se actualiza al instante."
      >
        <Link href="/editar/?f=config/empresa&id=1&volver=/configuracion/documentos/" className="btn-secondary">RNC, dirección y teléfonos</Link>
      </Encabezado>
      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_1fr]">
        <div className="flex flex-col gap-4">
          <section className="card flex flex-col gap-4 p-4">
            <Imagen
              titulo="Logo del encabezado"
              ayuda="Sale arriba a la izquierda. Mejor en PNG con fondo transparente, horizontal."
              url={e.logo_url}
              predeterminada={LOGO_PREDETERMINADO}
              subiendo={subiendo === "logo_url"}
              onArchivo={(f) => subir("logo_url", f)}
              onQuitar={() => guardar({ logo_url: null }, "Se volvió al logo predeterminado.")}
            />
            <Imagen
              titulo="Marca de agua"
              ayuda="Se coloca grande y muy suave detrás del contenido. El sistema la convierte al azul de Osmos."
              url={e.marca_agua_url}
              predeterminada={MARCA_PREDETERMINADA}
              subiendo={subiendo === "marca_agua_url"}
              onArchivo={(f) => subir("marca_agua_url", f)}
              onQuitar={() => guardar({ marca_agua_url: null }, "Se volvió a la marca de agua predeterminada.")}
              extra={
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={colores} onChange={(ev) => setColores(ev.target.checked)} className="h-4 w-4 accent-osmos-navy" />
                    Al subir, conservar los colores originales
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={e.marca_agua_visible !== false} onChange={(ev) => guardar({ marca_agua_visible: ev.target.checked }, ev.target.checked ? "Marca de agua visible." : "Marca de agua oculta.")} className="h-4 w-4 accent-osmos-navy" />
                    Mostrar marca de agua en los documentos
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Intensidad: <strong>{Number(e.marca_agua_opacidad ?? 6)}%</strong></span>
                    <input
                      type="range"
                      min={2}
                      max={20}
                      step={1}
                      value={Number(e.marca_agua_opacidad ?? 6)}
                      onChange={(ev) => setE({ ...e, marca_agua_opacidad: Number(ev.target.value) })}
                      onMouseUp={(ev) => guardar({ marca_agua_opacidad: Number((ev.target as HTMLInputElement).value) }, "Intensidad guardada.")}
                      onTouchEnd={(ev) => guardar({ marca_agua_opacidad: Number((ev.target as HTMLInputElement).value) }, "Intensidad guardada.")}
                      onKeyUp={(ev) => guardar({ marca_agua_opacidad: Number((ev.target as HTMLInputElement).value) }, "Intensidad guardada.")}
                      className="accent-osmos-navy"
                      aria-label="Intensidad de la marca de agua"
                    />
                    <span className="text-xs text-osmos-muted">Recomendado entre 5% y 8% para que no estorbe la lectura.</span>
                  </label>
                </div>
              }
            />
            <Imagen
              titulo="Firma o sello"
              ayuda="Opcional. Sale sobre la línea de firma de Osmos. Escanee la firma sobre papel blanco; el fondo blanco se recorta."
              url={e.firma_url}
              subiendo={subiendo === "firma_url"}
              onArchivo={(f) => subir("firma_url", f)}
              onQuitar={() => guardar({ firma_url: null }, "Firma quitada.")}
            />
          </section>

          <form onSubmit={guardarTextos} className="card flex flex-col gap-3 p-4">
            <strong className="text-sm text-osmos-navy">Textos de los documentos</strong>
            {(
              [
                ["lema", "Lema bajo el logo", e.lema, "input"],
                ["subtitulo_cotizacion", "Subtítulo de las cotizaciones", e.subtitulo_cotizacion, "input"],
                ["pie_documentos", "Frase al pie de la hoja", e.pie_documentos, "input"],
                ["condiciones_cotizacion", "Condiciones de las cotizaciones", e.condiciones_cotizacion, "textarea"],
                ["instrucciones_pago", "Cuentas para transferencias (facturas)", e.instrucciones_pago, "textarea"],
                ["condiciones_factura", "Nota al pie de las facturas", e.condiciones_factura, "textarea"],
              ] as const
            ).map(([k, etq, v, tipo]) => (
              <div key={k}>
                <label className="label" htmlFor={`t-${k}`}>{etq}</label>
                {tipo === "input" ? (
                  <input id={`t-${k}`} name={k} defaultValue={v ?? ""} onChange={(ev) => setE({ ...e, [k]: ev.target.value })} className="input" />
                ) : (
                  <textarea id={`t-${k}`} name={k} rows={3} defaultValue={v ?? ""} onChange={(ev) => setE({ ...e, [k]: ev.target.value })} className="input h-auto py-2" />
                )}
              </div>
            ))}
            <button type="submit" disabled={guardando} className="btn-primary h-10 self-start">{guardando ? "Guardando…" : "Guardar textos"}</button>
          </form>
        </div>

        <section aria-label="Vista previa" className="card flex flex-col gap-2 overflow-hidden p-4">
          <strong className="text-sm text-osmos-navy">Vista previa</strong>
          <div className="overflow-x-auto rounded-md bg-[#8A93A6] p-4">
            <div className="origin-top-left scale-[0.62] [height:calc(1056px*0.62)] [width:calc(816px*0.62)] sm:mx-auto">
              <div className="w-[816px]">
                <Ejemplo e={e} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
