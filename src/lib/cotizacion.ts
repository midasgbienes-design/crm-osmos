"use client";

import { supabase } from "@/lib/supabase/cliente";
import type { ProductoCot } from "@/components/cotizador";

// Catálogos y parámetros de aprobación que usa el cotizador.
export async function datosCotizador() {
  const sb = supabase();
  const [productos, clientes, prospectos, vendedores, empresa, parametros] = await Promise.all([
    sb.from("productos").select("id,codigo,nombre,precio_venta,costo_promedio,aplica_itbis").eq("activo", true).order("nombre"),
    sb.from("clientes").select("id,nombre").neq("estado", "inactivo").order("nombre").limit(1000),
    sb.from("prospectos").select("id,nombre,empresa").in("estado", ["nuevo", "contactado", "calificado"]).order("fecha", { ascending: false }).limit(500),
    sb.from("vendedores").select("id,nombre").eq("activo", true).order("nombre"),
    sb.from("empresa").select("tasa_itbis").maybeSingle(),
    sb.from("parametros").select("clave,valor").in("clave", ["descuento_max_sin_aprobacion_pct", "margen_minimo_cotizacion_pct"]),
  ]);
  const param = (k: string, d: number) => Number(parametros.data?.find((p) => p.clave === k)?.valor ?? d);
  return {
    productos: (productos.data ?? []).map((p) => ({ ...p, precio_venta: Number(p.precio_venta), costo_promedio: Number(p.costo_promedio) })) as ProductoCot[],
    clientes: (clientes.data ?? []) as { id: string; nombre: string }[],
    prospectos: (prospectos.data ?? []).map((p) => ({ id: p.id as string, nombre: (p.empresa ?? p.nombre) as string })),
    vendedores: (vendedores.data ?? []) as { id: string; nombre: string }[],
    tasaItbis: Number(empresa.data?.tasa_itbis ?? 18),
    descuentoMax: param("descuento_max_sin_aprobacion_pct", 10),
    margenMin: param("margen_minimo_cotizacion_pct", 25),
  };
}

// Envía el formulario del cotizador a la base de datos (guardar_cotizacion).
export async function guardarCotizacion(f: FormData): Promise<{ id?: string; error?: string }> {
  const val = (k: string) => {
    const v = String(f.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const para = val("para") ?? "cliente";
  let lineas: unknown = [];
  try {
    lineas = JSON.parse(String(f.get("lineas") ?? "[]"));
  } catch {
    lineas = [];
  }
  const { data, error } = await supabase().rpc("guardar_cotizacion", {
    p: {
      id: val("id"),
      cliente_id: para === "cliente" ? val("cliente_id") : null,
      prospecto_id: para === "prospecto" ? val("prospecto_id") : null,
      vendedor_id: val("vendedor_id"),
      vence: val("vence"),
      notas: val("notas"),
      lineas,
    },
  });
  if (error || !data) return { error: error?.message ?? "No se pudo guardar" };
  return { id: String(data) };
}
