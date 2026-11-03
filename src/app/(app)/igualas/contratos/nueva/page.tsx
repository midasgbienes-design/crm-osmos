import { createClient } from "@/lib/supabase/server";
import { Aviso, Encabezado } from "@/components/ui";
import { crearIguala } from "../../acciones";

export const dynamic = "force-dynamic";

export default async function NuevaIguala({ searchParams }: { searchParams: Promise<{ error?: string; cliente?: string }> }) {
  const { error, cliente } = await searchParams;
  const supabase = await createClient();
  const [clientes, vendedores] = await Promise.all([
    supabase.from("clientes").select("id,nombre,vendedor_id").neq("estado", "inactivo").order("nombre").limit(1000),
    supabase.from("vendedores").select("id,nombre").eq("activo", true).order("nombre"),
  ]);
  const hoy = new Date().toISOString().slice(0, 10);
  const enUnAnio = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Igualas", href: "/igualas" }, { texto: "Contratos de iguala", href: "/igualas/contratos" }, { texto: "Nueva" }]}
        titulo="Nueva iguala de mantenimiento"
        descripcion="La cuota se registra sin ITBIS; la facturación mensual agrega el ITBIS automáticamente."
      />
      {error ? <Aviso tono="bad">{error}</Aviso> : null}
      <form action={crearIguala} className="card grid max-w-3xl grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="cliente_id">Cliente *</label>
          <select id="cliente_id" name="cliente_id" required defaultValue={cliente ?? ""} className="input">
            <option value="">Seleccione…</option>
            {(clientes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
            {["semanal", "quincenal", "mensual", "bimestral", "trimestral"].map((f) => (
              <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="fecha_inicio">Inicio *</label>
          <input id="fecha_inicio" name="fecha_inicio" type="date" required defaultValue={hoy} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="fecha_fin">Vence</label>
          <input id="fecha_fin" name="fecha_fin" type="date" defaultValue={enUnAnio} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="dia_facturacion">Día de facturación (1–28)</label>
          <input id="dia_facturacion" name="dia_facturacion" type="number" min="1" max="28" defaultValue="1" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="vendedor_id">Vendedor (para comisión)</label>
          <select id="vendedor_id" name="vendedor_id" className="input">
            <option value="">— Sin vendedor —</option>
            {(vendedores.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="incluye_insumos">Qué incluye la cuota</label>
          <textarea id="incluye_insumos" name="incluye_insumos" rows={2} placeholder="Ej. Cartuchos de prefiltración, sal y sanitización. Membranas y lámparas UV se facturan aparte." className="input h-auto py-2" />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary h-10">Crear iguala</button>
        </div>
      </form>
    </>
  );
}
