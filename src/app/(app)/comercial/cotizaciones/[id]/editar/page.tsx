import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Cotizador } from "@/components/cotizador";
import { Aviso, Encabezado } from "@/components/ui";
import { datosCotizador } from "@/lib/datos-cotizacion";
import { etiqueta } from "@/lib/formato";
import { guardarCotizacion } from "../../../acciones";

export const dynamic = "force-dynamic";

export default async function EditarCotizacion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("cotizaciones")
    .select("id,numero,cliente_id,prospecto_id,vendedor_id,vence,notas,estado,cotizacion_lineas(producto_id,descripcion,cantidad,precio,descuento_pct)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const d = await datosCotizador();
  const lineas = ((c.cotizacion_lineas ?? []) as { producto_id: string | null; descripcion: string; cantidad: number; precio: number; descuento_pct: number }[]).map((l) => ({
    ...l,
    cantidad: Number(l.cantidad),
    precio: Number(l.precio),
    descuento_pct: Number(l.descuento_pct),
  }));
  // Un prospecto ya convertido o cerrado igual debe aparecer en la lista.
  if (c.prospecto_id && !d.prospectos.some((p) => p.id === c.prospecto_id)) {
    const { data: pr } = await supabase.from("prospectos").select("id,nombre,empresa").eq("id", c.prospecto_id).maybeSingle();
    if (pr) d.prospectos.unshift({ id: pr.id, nombre: pr.empresa ?? pr.nombre });
  }
  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Comercial", href: "/comercial" }, { texto: "Cotizaciones", href: "/comercial/cotizaciones" }, { texto: String(c.numero), href: `/comercial/cotizaciones/${id}` }, { texto: "Editar" }]}
        titulo={`Editar ${c.numero}`}
        descripcion="Al guardar, la cotización vuelve a evaluarse y, si hace falta, pasa de nuevo a aprobación."
      />
      {error ? <Aviso tono="bad">{error}</Aviso> : null}
      {!["borrador", "por_aprobar", "en_negociacion"].includes(String(c.estado)) ? (
        <Aviso tono="warn">Esta cotización ya no se puede editar porque su estado es: {etiqueta(c.estado)}.</Aviso>
      ) : (
        <Cotizador
          accion={guardarCotizacion}
          {...d}
          inicial={{ id: c.id, cliente_id: c.cliente_id, prospecto_id: c.prospecto_id, vendedor_id: c.vendedor_id, vence: c.vence, notas: c.notas, lineas }}
        />
      )}
    </>
  );
}
