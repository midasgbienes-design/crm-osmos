import { createClient } from "@/lib/supabase/server";
import type { ProductoCot } from "@/components/cotizador";

// Datos que necesita el cotizador: catálogos y parámetros de aprobación.
export async function datosCotizador() {
  const supabase = await createClient();
  const [productos, clientes, prospectos, vendedores, empresa, parametros] = await Promise.all([
    supabase.from("productos").select("id,codigo,nombre,precio_venta,costo_promedio,aplica_itbis").eq("activo", true).order("nombre"),
    supabase.from("clientes").select("id,nombre").neq("estado", "inactivo").order("nombre").limit(1000),
    supabase.from("prospectos").select("id,nombre,empresa").in("estado", ["nuevo", "contactado", "calificado"]).order("fecha", { ascending: false }).limit(500),
    supabase.from("vendedores").select("id,nombre").eq("activo", true).order("nombre"),
    supabase.from("empresa").select("tasa_itbis").maybeSingle(),
    supabase.from("parametros").select("clave,valor").in("clave", ["descuento_max_sin_aprobacion_pct", "margen_minimo_cotizacion_pct"]),
  ]);
  const param = (k: string, d: number) => Number(parametros.data?.find((p) => p.clave === k)?.valor ?? d);
  return {
    productos: (productos.data ?? []).map((p) => ({
      ...p,
      precio_venta: Number(p.precio_venta),
      costo_promedio: Number(p.costo_promedio),
    })) as ProductoCot[],
    clientes: (clientes.data ?? []) as { id: string; nombre: string }[],
    prospectos: (prospectos.data ?? []).map((p) => ({ id: p.id as string, nombre: (p.empresa ?? p.nombre) as string })),
    vendedores: (vendedores.data ?? []) as { id: string; nombre: string }[],
    tasaItbis: Number(empresa.data?.tasa_itbis ?? 18),
    descuentoMax: param("descuento_max_sin_aprobacion_pct", 10),
    margenMin: param("margen_minimo_cotizacion_pct", 25),
  };
}
