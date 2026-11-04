"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Cotizador, type CotizacionInicial } from "@/components/cotizador";
import { Aviso, Encabezado } from "@/components/ui";
import { Cargando } from "@/components/mensajes";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { datosCotizador, guardarCotizacion } from "@/lib/cotizacion";
import { etiqueta } from "@/lib/formato";

type Linea = { producto_id: string | null; descripcion: string; cantidad: number; precio: number; descuento_pct: number };

export default function EditarCotizacion() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const [error, setError] = useState<string | null>(null);

  const { datos, error: errCarga, cargando } = useDatos(async () => {
    const sb = supabase();
    const { data: c, error } = await sb
      .from("cotizaciones")
      .select("id,numero,cliente_id,prospecto_id,vendedor_id,vence,notas,estado,cotizacion_lineas(producto_id,descripcion,cantidad,precio,descuento_pct)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) return null;
    const d = await datosCotizador();
    if (c.prospecto_id && !d.prospectos.some((p) => p.id === c.prospecto_id)) {
      const { data: pr } = await sb.from("prospectos").select("id,nombre,empresa").eq("id", c.prospecto_id).maybeSingle();
      if (pr) d.prospectos.unshift({ id: pr.id, nombre: pr.empresa ?? pr.nombre });
    }
    const inicial: CotizacionInicial = {
      id: c.id, cliente_id: c.cliente_id, prospecto_id: c.prospecto_id, vendedor_id: c.vendedor_id, vence: c.vence, notas: c.notas,
      lineas: ((c.cotizacion_lineas ?? []) as Linea[]).map((l) => ({ ...l, cantidad: Number(l.cantidad), precio: Number(l.precio), descuento_pct: Number(l.descuento_pct) })),
    };
    return { c, d, inicial };
  }, [id]);

  const guardar = async (f: FormData) => {
    const r = await guardarCotizacion(f);
    if (r.error) {
      setError(r.error);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push(`/cotizacion/?id=${r.id}&ok=${encodeURIComponent("Cotización actualizada.")}`);
  };

  if (cargando && !datos) return <Cargando />;
  if (errCarga) return <Aviso tono="bad">{errCarga}</Aviso>;
  if (!datos) return <Aviso tono="warn">Cotización no encontrada.</Aviso>;

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Comercial", href: "/comercial/" }, { texto: "Cotizaciones", href: "/comercial/cotizaciones/" }, { texto: String(datos.c.numero), href: `/cotizacion/?id=${id}` }, { texto: "Editar" }]}
        titulo={`Editar ${datos.c.numero}`}
        descripcion="Al guardar, la cotización vuelve a evaluarse y, si hace falta, pasa de nuevo a aprobación."
      />
      {error ? <Aviso tono="bad">{error}</Aviso> : null}
      {!["borrador", "por_aprobar", "en_negociacion"].includes(String(datos.c.estado)) ? (
        <Aviso tono="warn">Esta cotización ya no se puede editar porque su estado es: {etiqueta(datos.c.estado)}.</Aviso>
      ) : (
        <Cotizador onGuardar={guardar} {...datos.d} inicial={datos.inicial} />
      )}
    </>
  );
}
