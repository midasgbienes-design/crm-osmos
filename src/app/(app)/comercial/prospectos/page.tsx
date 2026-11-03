import { createClient } from "@/lib/supabase/server";
import { buscarModulo, rutaSeccion } from "@/lib/modulos";
import { etiqueta, formatoFecha } from "@/lib/formato";
import { Aviso, Encabezado, Estado, Pestanas } from "@/components/ui";
import { cambiarEstadoProspecto, convertirProspecto, crearProspecto } from "../acciones";

export const dynamic = "force-dynamic";

const ORIGENES = ["web", "whatsapp", "vendedor_externo", "referido_cliente", "base_instalada", "llamada", "evento", "otro"];
const ESTADOS = ["nuevo", "contactado", "calificado", "descartado"];

type Prospecto = {
  id: string;
  codigo: string;
  fecha: string;
  nombre: string;
  empresa: string | null;
  origen: string;
  interes: string | null;
  proxima_accion: string | null;
  proxima_fecha: string | null;
  estado: string;
  cliente_id: string | null;
  asignado: { nombre: string } | null;
  referidor: { nombre: string } | null;
  cliente_ref: { nombre: string } | null;
};

export default async function Prospectos({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; estado?: string }> }) {
  const { ok, error: errorMsg, estado } = await searchParams;
  const m = buscarModulo("comercial")!;
  const supabase = await createClient();

  let q = supabase
    .from("prospectos")
    .select(
      "id,codigo,fecha,nombre,empresa,origen,interes,proxima_accion,proxima_fecha,estado,cliente_id," +
        "asignado:vendedores!prospectos_asignado_a_fkey(nombre)," +
        "referidor:vendedores!prospectos_referido_por_vendedor_id_fkey(nombre)," +
        "cliente_ref:clientes!prospectos_referido_por_cliente_id_fkey(nombre)",
    )
    .order("fecha", { ascending: false })
    .limit(300);
  if (estado) q = q.eq("estado", estado);

  const [{ data, error }, vendedores, clientes] = await Promise.all([
    q,
    supabase.from("vendedores").select("id,nombre,tipo").eq("activo", true).order("nombre"),
    supabase.from("clientes").select("id,nombre").eq("estado", "activo").order("nombre").limit(500),
  ]);
  const filas = (data ?? []) as unknown as Prospecto[];
  const s = m.secciones.find((x) => x.slug === "prospectos")!;

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: m.nombre, href: "/comercial" }, { texto: s.nombre }]}
        titulo="Prospectos"
        descripcion="Registre cada prospecto con su origen para medir qué canal trae más ventas."
      />
      <Pestanas items={m.secciones.map((x) => ({ slug: x.slug, nombre: x.nombre, href: rutaSeccion(m, x) }))} activa="prospectos" />

      {ok ? <Aviso tono="ok">{ok}</Aviso> : null}
      {errorMsg ? <Aviso tono="bad">{errorMsg}</Aviso> : null}

      <div className="flex flex-wrap items-start gap-4">
        <section className="card flex min-w-0 flex-[999_1_640px] flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-osmos-line px-3.5 py-3 text-[13px]">
            <span className="text-osmos-muted">Estado:</span>
            {["", ...ESTADOS, "convertido"].map((e) => (
              <a
                key={e || "todos"}
                href={e ? `/comercial/prospectos?estado=${e}` : "/comercial/prospectos"}
                className={`rounded-full border px-3 py-1 ${
                  (estado ?? "") === e ? "border-osmos-navy bg-osmos-navy font-bold text-white" : "border-[#B8C4DD] text-osmos-navy"
                }`}
              >
                {e ? etiqueta(e) : "Todos"}
              </a>
            ))}
            <span className="ml-auto text-osmos-muted">{filas.length} registros</span>
          </div>
          {error ? (
            <div className="p-4">
              <Aviso tono="bad">No se pudo cargar: {error.message}</Aviso>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#F7F9FC]">
                    {["Prospecto", "Fecha", "Nombre / empresa", "Origen", "Referido por", "Interés", "Asignado a", "Próxima acción", "Estado", ""].map((h) => (
                      <th key={h} scope="col" className="th">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="td text-osmos-muted">
                        No hay prospectos todavía. Registre el primero con el formulario.
                      </td>
                    </tr>
                  ) : (
                    filas.map((p) => (
                      <tr key={p.id} className="align-top hover:bg-[#FAFBFD]">
                        <td className="td font-semibold text-osmos-navy2">{p.codigo}</td>
                        <td className="td">{formatoFecha(p.fecha)}</td>
                        <td className="td">
                          <div className="font-semibold">{p.empresa ?? p.nombre}</div>
                          {p.empresa ? <div className="text-xs text-osmos-muted">{p.nombre}</div> : null}
                        </td>
                        <td className="td">{etiqueta(p.origen)}</td>
                        <td className="td">{p.referidor?.nombre ?? p.cliente_ref?.nombre ?? "—"}</td>
                        <td className="td">{p.interes ?? "—"}</td>
                        <td className="td">{p.asignado?.nombre ?? "—"}</td>
                        <td className="td">
                          {p.proxima_accion ?? "—"}
                          {p.proxima_fecha ? <div className="text-xs text-osmos-muted">{formatoFecha(p.proxima_fecha)}</div> : null}
                        </td>
                        <td className="td">
                          <Estado valor={p.estado} />
                        </td>
                        <td className="td">
                          {p.estado === "convertido" && p.cliente_id ? (
                            <a href={`/comercial/clientes/${p.cliente_id}`} className="font-bold text-osmos-navy2 underline">
                              Ver cliente
                            </a>
                          ) : (
                            <div className="flex gap-2">
                              <form action={cambiarEstadoProspecto} className="flex gap-1">
                                <input type="hidden" name="id" value={p.id} />
                                <label className="sr-only" htmlFor={`estado-${p.id}`}>
                                  Cambiar estado
                                </label>
                                <select id={`estado-${p.id}`} name="estado" defaultValue={p.estado} className="input h-8 w-[120px] px-2 text-xs">
                                  {ESTADOS.map((e) => (
                                    <option key={e} value={e}>
                                      {etiqueta(e)}
                                    </option>
                                  ))}
                                </select>
                                <button type="submit" className="btn-secondary h-8 px-2 text-xs">
                                  Guardar
                                </button>
                              </form>
                              <form action={convertirProspecto}>
                                <input type="hidden" name="id" value={p.id} />
                                <button type="submit" className="btn-primary h-8 px-2 text-xs">
                                  Convertir en cliente
                                </button>
                              </form>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card flex flex-[1_1_300px] flex-col gap-3 p-4">
          <h2 className="text-sm font-bold text-osmos-navy">Nuevo prospecto</h2>
          <form action={crearProspecto} className="flex flex-col gap-3">
            <div>
              <label className="label" htmlFor="nombre">
                Nombre del contacto *
              </label>
              <input id="nombre" name="nombre" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="empresa">
                Empresa / condominio
              </label>
              <input id="empresa" name="empresa" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="telefono">
                  Teléfono
                </label>
                <input id="telefono" name="telefono" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="ciudad">
                  Ciudad
                </label>
                <input id="ciudad" name="ciudad" className="input" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="email">
                Correo
              </label>
              <input id="email" name="email" type="email" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="origen">
                  Origen *
                </label>
                <select id="origen" name="origen" required className="input">
                  {ORIGENES.map((o) => (
                    <option key={o} value={o}>
                      {etiqueta(o)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="segmento">
                  Segmento
                </label>
                <select id="segmento" name="segmento" className="input">
                  <option value="residencial">Residencial</option>
                  <option value="comercial">Comercial</option>
                  <option value="industrial">Industrial</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="referido_por_vendedor_id">
                Vendedor externo o referidor
              </label>
              <select id="referido_por_vendedor_id" name="referido_por_vendedor_id" className="input">
                <option value="">— Ninguno —</option>
                {(vendedores.data ?? [])
                  .filter((v) => v.tipo !== "interno")
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="referido_por_cliente_id">
                Cliente que lo refirió
              </label>
              <select id="referido_por_cliente_id" name="referido_por_cliente_id" className="input">
                <option value="">— Ninguno —</option>
                {(clientes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="interes">
                Interés
              </label>
              <input id="interes" name="interes" placeholder="Ej. ósmosis inversa residencial" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="asignado_a">
                Asignar a
              </label>
              <select id="asignado_a" name="asignado_a" className="input">
                <option value="">— Sin asignar —</option>
                {(vendedores.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="proxima_accion">
                  Próxima acción
                </label>
                <input id="proxima_accion" name="proxima_accion" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="proxima_fecha">
                  Fecha
                </label>
                <input id="proxima_fecha" name="proxima_fecha" type="date" className="input" />
              </div>
            </div>
            <button type="submit" className="btn-primary h-10">
              Registrar prospecto
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
