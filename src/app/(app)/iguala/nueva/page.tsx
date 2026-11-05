"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { Aviso, Encabezado } from "@/components/ui";
import { Cargando } from "@/components/mensajes";

export default function NuevaIguala() {
  const router = useRouter();
  const cliente = useSearchParams().get("cliente") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { datos } = useDatos(async () => {
    const sb = supabase();
    const [c, v] = await Promise.all([
      sb.from("clientes").select("id,nombre").neq("estado", "inactivo").order("nombre").limit(1000),
      sb.from("vendedores").select("id,nombre").eq("activo", true).order("nombre"),
    ]);
    return { clientes: (c.data ?? []) as { id: string; nombre: string }[], vendedores: (v.data ?? []) as { id: string; nombre: string }[] };
  }, []);

  const hoy = new Date().toLocaleDateString("sv-SE");
  const enUnAnio = new Date(Date.now() + 365 * 86400000).toLocaleDateString("sv-SE");

  const crear = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const val = (k: string) => {
      const x = String(f.get(k) ?? "").trim();
      return x === "" ? null : x;
    };
    setGuardando(true);
    const { data, error } = await supabase()
      .from("igualas")
      .insert({
        cliente_id: val("cliente_id"), vendedor_id: val("vendedor_id"), descripcion: val("descripcion"),
        frecuencia_visita: val("frecuencia_visita") ?? "mensual", cuota_mensual: Number(f.get("cuota_mensual") ?? 0),
        dia_facturacion: Number(f.get("dia_facturacion") ?? 1), incluye_insumos: val("incluye_insumos"),
        fecha_inicio: val("fecha_inicio"), fecha_fin: val("fecha_fin"), estado: "vigente",
      })
      .select("id")
      .single();
    setGuardando(false);
    if (error || !data) return setError(error?.message ?? "No se pudo crear");
    router.push(`/iguala/?id=${data.id}&ok=${encodeURIComponent("Iguala creada. Marque los equipos que cubre.")}`);
  };

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Igualas", href: "/igualas/" }, { texto: "Contratos de iguala", href: "/igualas/contratos/" }, { texto: "Nueva" }]}
        titulo="Nueva iguala de mantenimiento"
        descripcion="La cuota se registra sin ITBIS; la facturación mensual agrega el ITBIS automáticamente."
      />
      {error ? <Aviso tono="bad">{error}</Aviso> : null}
      {!datos ? <Cargando /> : (
        <form onSubmit={crear} className="card grid max-w-3xl grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="cliente_id">Cliente *</label>
            <select id="cliente_id" name="cliente_id" required defaultValue={cliente} className="input">
              <option value="">Seleccione…</option>
              {datos.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="descripcion">Sistema cubierto *</label>
            <input id="descripcion" name="descripcion" required placeholder="Ej. Ósmosis inversa 2,000 GPD + UV" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="cuota_mensual">Cuota mensual (sin ITBIS) *</label>
            <input id="cuota_mensual" name="cuota_mensual" type="number" min="0" step="0.01" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="frecuencia_visita">Frecuencia de visitas *</label>
            <select id="frecuencia_visita" name="frecuencia_visita" defaultValue="mensual" className="input">
              {["semanal", "quincenal", "mensual", "bimestral", "trimestral"].map((x) => <option key={x} value={x}>{x.charAt(0).toUpperCase() + x.slice(1)}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="fecha_inicio">Inicio *</label><input id="fecha_inicio" name="fecha_inicio" type="date" required defaultValue={hoy} className="input" /></div>
          <div><label className="label" htmlFor="fecha_fin">Vence</label><input id="fecha_fin" name="fecha_fin" type="date" defaultValue={enUnAnio} className="input" /></div>
          <div><label className="label" htmlFor="dia_facturacion">Día de facturación (1–28)</label><input id="dia_facturacion" name="dia_facturacion" type="number" min="1" max="28" defaultValue="1" className="input" /></div>
          <div>
            <label className="label" htmlFor="vendedor_id">Vendedor (para comisión)</label>
            <select id="vendedor_id" name="vendedor_id" className="input">
              <option value="">— Sin vendedor —</option>
              {datos.vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="incluye_insumos">Qué incluye la cuota</label>
            <textarea id="incluye_insumos" name="incluye_insumos" rows={2} placeholder="Ej. Cartuchos de prefiltración, sal y sanitización. Membranas y lámparas UV se facturan aparte." className="input h-auto py-2" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={guardando} className="btn-primary h-10">{guardando ? "Guardando…" : "Crear iguala"}</button>
          </div>
        </form>
      )}
    </>
  );
}
