import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatoFecha } from "@/lib/formato";
import { Aviso, Encabezado } from "@/components/ui";
import { registrarOrden } from "../../acciones";

export const dynamic = "force-dynamic";

const FILAS_INSUMOS = [0, 1, 2, 3, 4, 5];

export default async function NuevaOrden({ searchParams }: { searchParams: Promise<{ error?: string; cliente?: string; iguala?: string; visita?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Determina el cliente a partir de la visita, la iguala o el parámetro directo.
  let clienteId = sp.cliente ?? null;
  let igualaId = sp.iguala ?? null;
  let visita: { id: string; fecha_programada: string; servicio: string | null; iguala_id: string | null; cliente_id: string } | null = null;
  if (sp.visita) {
    const { data } = await supabase.from("visitas").select("id,fecha_programada,servicio,iguala_id,cliente_id").eq("id", sp.visita).maybeSingle();
    visita = data;
    clienteId = data?.cliente_id ?? clienteId;
    igualaId = data?.iguala_id ?? igualaId;
  }
  if (igualaId && !clienteId) {
    const { data } = await supabase.from("igualas").select("cliente_id").eq("id", igualaId).maybeSingle();
    clienteId = data?.cliente_id ?? null;
  }

  const [clientes, productos, tecnicos, igualas, equipos, visitas] = await Promise.all([
    supabase.from("clientes").select("id,nombre").neq("estado", "inactivo").order("nombre").limit(1000),
    supabase.from("productos").select("id,codigo,nombre,tipo").eq("activo", true).neq("tipo", "equipo").order("nombre"),
    supabase.from("v_directorio").select("id,nombre,cargo").eq("estado", "activo").order("nombre"),
    clienteId ? supabase.from("igualas").select("id,codigo,descripcion").eq("cliente_id", clienteId).in("estado", ["vigente", "por_renovar"]) : Promise.resolve({ data: [] as { id: string; codigo: string; descripcion: string | null }[] }),
    clienteId ? supabase.from("equipos_instalados").select("id,serie,descripcion").eq("cliente_id", clienteId).neq("estado", "retirado") : Promise.resolve({ data: [] as { id: string; serie: string; descripcion: string }[] }),
    clienteId ? supabase.from("visitas").select("id,fecha_programada,servicio").eq("cliente_id", clienteId).eq("estado", "programada").order("fecha_programada") : Promise.resolve({ data: [] as { id: string; fecha_programada: string; servicio: string | null }[] }),
  ]);
  const nombreCliente = (clientes.data ?? []).find((c) => c.id === clienteId)?.nombre;

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Igualas", href: "/igualas" }, { texto: "Órdenes de servicio", href: "/igualas/ordenes" }, { texto: "Nueva" }]}
        titulo="Nueva orden de servicio"
        descripcion="Los insumos usados se descuentan del inventario y actualizan la fecha de reemplazo del equipo."
      />
      {sp.error ? <Aviso tono="bad">{sp.error}</Aviso> : null}

      {!clienteId ? (
        <form className="card flex max-w-xl flex-col gap-3 p-5">
          <label className="label" htmlFor="cliente">Primero seleccione el cliente</label>
          <select id="cliente" name="cliente" required className="input">
            <option value="">Seleccione…</option>
            {(clientes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <button type="submit" className="btn-primary self-start">Continuar</button>
        </form>
      ) : (
        <form action={registrarOrden} className="flex flex-col gap-4">
          <input type="hidden" name="cliente_id" value={clienteId} />
          <section className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-0.5 sm:col-span-2 lg:col-span-3">
              <span className="text-xs text-osmos-muted">Cliente</span>
              <span className="text-base font-bold text-osmos-navy">
                {nombreCliente} <Link href="/igualas/ordenes/nueva" className="ml-2 text-xs font-semibold text-osmos-navy2 underline">cambiar</Link>
              </span>
            </div>
            <div>
              <label className="label" htmlFor="iguala_id">Iguala</label>
              <select id="iguala_id" name="iguala_id" defaultValue={igualaId ?? ""} className="input">
                <option value="">— Servicio sin iguala —</option>
                {(igualas.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.codigo} · {i.descripcion}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="equipo_id">Equipo atendido</label>
              <select id="equipo_id" name="equipo_id" className="input">
                <option value="">— No aplica —</option>
                {(equipos.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.descripcion} · {e.serie}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="visita_id">Visita programada</label>
              <select id="visita_id" name="visita_id" defaultValue={visita?.id ?? ""} className="input">
                <option value="">— Ninguna —</option>
                {(visitas.data ?? []).map((v) => <option key={v.id} value={v.id}>{formatoFecha(v.fecha_programada)} · {v.servicio}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="tipo">Tipo *</label>
              <select id="tipo" name="tipo" defaultValue="preventivo" className="input">
                {[["preventivo", "Preventivo"], ["correctivo", "Correctivo"], ["instalacion", "Instalación"], ["garantia", "Garantía"], ["analisis", "Toma de muestra / análisis"]].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="fecha">Fecha</label>
              <input id="fecha" name="fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="tecnico_id">Técnico</label>
              <select id="tecnico_id" name="tecnico_id" className="input">
                <option value="">— Sin asignar —</option>
                {(tecnicos.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.nombre}{t.cargo ? ` · ${t.cargo}` : ""}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label" htmlFor="trabajo_realizado">Trabajo realizado *</label>
              <textarea id="trabajo_realizado" name="trabajo_realizado" required rows={2} className="input h-auto py-2" placeholder="Ej. Cambio de prefiltros, sanitización, medición de TDS y presiones." />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label" htmlFor="observaciones">Observaciones</label>
              <input id="observaciones" name="observaciones" className="input" placeholder="Recomendaciones para el cliente" />
            </div>
          </section>

          <section className="card flex flex-col">
            <h2 className="border-b border-osmos-line px-4 py-3 text-sm font-bold text-osmos-navy">Insumos y repuestos usados</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#F7F9FC]">
                    <th scope="col" className="th">Artículo</th>
                    <th scope="col" className="th">Cantidad</th>
                    <th scope="col" className="th">Cobertura</th>
                  </tr>
                </thead>
                <tbody>
                  {FILAS_INSUMOS.map((i) => (
                    <tr key={i}>
                      <td className="td min-w-[260px]">
                        <label className="sr-only" htmlFor={`insumo_${i}`}>Artículo {i + 1}</label>
                        <select id={`insumo_${i}`} name={`insumo_${i}`} className="input">
                          <option value="">—</option>
                          {(productos.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
                        </select>
                      </td>
                      <td className="td w-[110px]">
                        <label className="sr-only" htmlFor={`cantidad_${i}`}>Cantidad {i + 1}</label>
                        <input id={`cantidad_${i}`} name={`cantidad_${i}`} type="number" min="0" step="any" className="input text-right" />
                      </td>
                      <td className="td w-[220px]">
                        <label className="sr-only" htmlFor={`cobertura_${i}`}>Cobertura {i + 1}</label>
                        <select id={`cobertura_${i}`} name={`cobertura_${i}`} defaultValue="incluido" className="input">
                          <option value="incluido">Incluido en la iguala</option>
                          <option value="facturable">Facturable al cliente</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-xs text-osmos-muted">Si el servicio no tiene iguala, todos los insumos se consideran facturables.</p>
          </section>

          <button type="submit" className="btn-primary h-10 self-start">Registrar orden de servicio</button>
        </form>
      )}
    </>
  );
}
