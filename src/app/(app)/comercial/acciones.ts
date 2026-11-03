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
