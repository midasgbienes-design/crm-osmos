"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const texto = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function crearIguala(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("igualas")
    .insert({
      cliente_id: texto(formData, "cliente_id"),
      vendedor_id: texto(formData, "vendedor_id"),
      descripcion: texto(formData, "descripcion"),
      frecuencia_visita: texto(formData, "frecuencia_visita") ?? "mensual",
      cuota_mensual: Number(formData.get("cuota_mensual") ?? 0),
      dia_facturacion: Number(formData.get("dia_facturacion") ?? 1),
      incluye_insumos: texto(formData, "incluye_insumos"),
      fecha_inicio: texto(formData, "fecha_inicio"),
      fecha_fin: texto(formData, "fecha_fin"),
      estado: "vigente",
    })
    .select("id")
    .single();
  if (error || !data) redirect(`/igualas/contratos/nueva?error=${encodeURIComponent(error?.message ?? "No se pudo crear")}`);
  revalidatePath("/igualas/contratos");
  redirect(`/igualas/contratos/${data.id}?ok=${encodeURIComponent("Iguala creada. Marque los equipos que cubre.")}`);
}

export async function actualizarEstadoIguala(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("igualas").update({ estado: String(formData.get("estado")) }).eq("id", id);
  revalidatePath(`/igualas/contratos/${id}`);
  redirect(`/igualas/contratos/${id}?${error ? "error=" + encodeURIComponent(error.message) : "ok=" + encodeURIComponent("Estado actualizado.")}`);
}

export async function asignarEquipos(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("iguala_id"));
  const equipos = formData.getAll("equipo").map(String);
  const { error } = await supabase.rpc("asignar_equipos_iguala", { p_iguala: id, p_equipos: equipos });
  revalidatePath(`/igualas/contratos/${id}`);
  redirect(`/igualas/contratos/${id}?${error ? "error=" + encodeURIComponent(error.message) : "ok=" + encodeURIComponent("Equipos actualizados.")}`);
}

export async function registrarOrden(formData: FormData) {
  const supabase = await createClient();
  const insumos = [0, 1, 2, 3, 4, 5]
    .map((i) => ({
      producto_id: texto(formData, `insumo_${i}`),
      cantidad: Number(formData.get(`cantidad_${i}`) ?? 0),
      cobertura: texto(formData, `cobertura_${i}`) ?? "incluido",
    }))
    .filter((x) => x.producto_id && x.cantidad > 0);
  const { data, error } = await supabase.rpc("registrar_orden_servicio", {
    p: {
      cliente_id: texto(formData, "cliente_id"),
      iguala_id: texto(formData, "iguala_id"),
      equipo_id: texto(formData, "equipo_id"),
      visita_id: texto(formData, "visita_id"),
      tipo: texto(formData, "tipo"),
      fecha: texto(formData, "fecha"),
      tecnico_id: texto(formData, "tecnico_id"),
      trabajo_realizado: texto(formData, "trabajo_realizado"),
      observaciones: texto(formData, "observaciones"),
      insumos,
    },
  });
  if (error || !data) {
    const q = new URLSearchParams();
    const cliente = texto(formData, "cliente_id");
    if (cliente) q.set("cliente", cliente);
    q.set("error", error?.message ?? "No se pudo registrar");
    redirect(`/igualas/ordenes/nueva?${q.toString()}`);
  }
  revalidatePath("/igualas/ordenes");
  redirect(`/igualas/ordenes/${data}?ok=${encodeURIComponent("Orden de servicio registrada. El inventario y la base instalada se actualizaron.")}`);
}

export async function facturarOrden(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.rpc("facturar_orden_servicio", { p_os: id });
  revalidatePath(`/igualas/ordenes/${id}`);
  redirect(`/igualas/ordenes/${id}?${error ? "error=" + encodeURIComponent(error.message) : "ok=" + encodeURIComponent("Factura emitida.")}`);
}
