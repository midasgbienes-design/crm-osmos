"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const texto = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function crearProspecto(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("prospectos").insert({
    nombre: texto(formData, "nombre"),
    empresa: texto(formData, "empresa"),
    telefono: texto(formData, "telefono"),
    email: texto(formData, "email"),
    ciudad: texto(formData, "ciudad"),
    segmento: texto(formData, "segmento"),
    origen: texto(formData, "origen"),
    referido_por_vendedor_id: texto(formData, "referido_por_vendedor_id"),
    referido_por_cliente_id: texto(formData, "referido_por_cliente_id"),
    interes: texto(formData, "interes"),
    asignado_a: texto(formData, "asignado_a"),
    proxima_accion: texto(formData, "proxima_accion"),
    proxima_fecha: texto(formData, "proxima_fecha"),
  });
  revalidatePath("/comercial/prospectos");
  redirect(`/comercial/prospectos?${error ? "error=" + encodeURIComponent(error.message) : "ok=" + encodeURIComponent("Prospecto registrado.")}`);
}

export async function cambiarEstadoProspecto(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const estado = String(formData.get("estado"));
  const { error } = await supabase.from("prospectos").update({ estado }).eq("id", id);
  revalidatePath("/comercial/prospectos");
  if (error) redirect(`/comercial/prospectos?error=${encodeURIComponent(error.message)}`);
}

export async function convertirProspecto(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convertir_prospecto", { p_prospecto: String(formData.get("id")) });
  revalidatePath("/comercial/prospectos");
  if (error || !data) redirect(`/comercial/prospectos?error=${encodeURIComponent(error?.message ?? "No se pudo convertir")}`);
  redirect(`/comercial/clientes/${data}`);
}

// ---------------------------------------------------------------------
// Cotizaciones
// ---------------------------------------------------------------------

export async function guardarCotizacion(formData: FormData) {
  const supabase = await createClient();
  const para = String(formData.get("para") ?? "cliente");
  const id = texto(formData, "id");
  let lineas: unknown = [];
  try {
    lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    lineas = [];
  }
  const { data, error } = await supabase.rpc("guardar_cotizacion", {
    p: {
      id,
      cliente_id: para === "cliente" ? texto(formData, "cliente_id") : null,
      prospecto_id: para === "prospecto" ? texto(formData, "prospecto_id") : null,
      vendedor_id: texto(formData, "vendedor_id"),
      vence: texto(formData, "vence"),
      notas: texto(formData, "notas"),
      lineas,
    },
  });
  if (error || !data) {
    const volver = id ? `/comercial/cotizaciones/${id}/editar` : "/comercial/cotizaciones/nueva";
    redirect(`${volver}?error=${encodeURIComponent(error?.message ?? "No se pudo guardar")}`);
  }
  revalidatePath("/comercial/cotizaciones");
  redirect(`/comercial/cotizaciones/${data}?ok=${encodeURIComponent("Cotización guardada.")}`);
}

const MENSAJES: Record<string, string> = {
  aprobar: "Cotización aprobada por gerencia.",
  enviar: "Cotización marcada como enviada al cliente.",
  negociar: "Cotización en negociación.",
  aceptar: "El cliente aceptó: se creó el pedido de venta.",
  rechazar: "Cotización marcada como rechazada.",
};

export async function accionCotizacion(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const accion = String(formData.get("accion"));
  const { error } = await supabase.rpc("accion_cotizacion", { p_id: id, p_accion: accion, p_motivo: texto(formData, "motivo") });
  revalidatePath(`/comercial/cotizaciones/${id}`);
  redirect(`/comercial/cotizaciones/${id}?${error ? "error=" + encodeURIComponent(error.message) : "ok=" + encodeURIComponent(MENSAJES[accion] ?? "Listo.")}`);
}

export async function facturarPedido(formData: FormData) {
  const supabase = await createClient();
  const cot = String(formData.get("cotizacion_id"));
  const { error } = await supabase.rpc("facturar_pedido", { p_pedido: String(formData.get("pedido_id")) });
  revalidatePath(`/comercial/cotizaciones/${cot}`);
  redirect(`/comercial/cotizaciones/${cot}?${error ? "error=" + encodeURIComponent(error.message) : "ok=" + encodeURIComponent("Factura emitida.")}`);
}

export async function registrarActividad(formData: FormData) {
  const supabase = await createClient();
  const cliente = String(formData.get("cliente_id"));
  const { error } = await supabase.from("actividades").insert({
    cliente_id: cliente,
    tipo: texto(formData, "tipo") ?? "nota",
    asunto: texto(formData, "asunto") ?? "Actividad",
    descripcion: texto(formData, "descripcion"),
  });
  revalidatePath(`/comercial/clientes/${cliente}`);
  if (error) redirect(`/comercial/clientes/${cliente}?error=${encodeURIComponent(error.message)}`);
}
