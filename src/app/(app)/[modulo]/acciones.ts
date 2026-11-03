"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarModulo } from "@/lib/modulos";

// Ejecuta un proceso de la base de datos declarado en el mapa de módulos.
export async function ejecutarAccion(formData: FormData) {
  const modulo = String(formData.get("modulo"));
  const seccion = String(formData.get("seccion"));
  const rpc = String(formData.get("rpc"));

  const s = buscarModulo(modulo)?.secciones.find((x) => x.slug === seccion);
  const accion = s?.acciones?.find((a) => a.rpc === rpc);
  if (!accion) throw new Error("Acción no permitida");

  const supabase = await createClient();
  const args = accion.parametros === "periodo" ? { p_periodo: new Date().toISOString().slice(0, 10) } : {};
  const { data, error } = await supabase.rpc(accion.rpc, args);

  const ruta = `/${modulo}/${seccion}`;
  revalidatePath(ruta);
  const mensaje = error
    ? `No se pudo completar: ${error.message}`
    : typeof data === "number"
      ? `${accion.etiqueta}: ${data} registro(s) procesado(s).`
      : `${accion.etiqueta}: completado.`;
  redirect(`${ruta}?${error ? "error" : "ok"}=${encodeURIComponent(mensaje)}`);
}
