"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos, o } from "@/lib/usar-datos";
import { buscarModulo, rutaSeccion } from "@/lib/modulos";
import { etiqueta, formatoFecha } from "@/lib/formato";
import { Aviso, Encabezado, Estado, Pestanas } from "@/components/ui";
import { MensajesUrl } from "@/components/mensajes";

const ORIGENES = ["web", "whatsapp", "vendedor_externo", "referido_cliente", "base_instalada", "llamada", "evento", "otro"];
const ESTADOS = ["nuevo", "contactado", "calificado", "descartado"];

type Prospecto = {
  id: string; codigo: string; fecha: string; nombre: string; empresa: string | null; origen: string; interes: string | null;
  proxima_accion: string | null; proxima_fecha: string | null; estado: string; cliente_id: string | null;
  asignado: { nombre: string } | null; referidor: { nombre: string } | null; cliente_ref: { nombre: string } | null;
};

const val = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export default function Prospectos() {
  const router = useRouter();
  const m = buscarModulo("comercial")!;
  const [filtro, setFiltro] = useState("");
  const [aviso, setAviso] = useState<{ tono: "ok" | "bad"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { datos, error, cargando, recargar } = useDatos(async () => {
    const sb = supabase();
    let q = sb
      .from("prospectos")
      .select(
        "id,codigo,fecha,nombre,empresa,origen,interes,proxima_accion,proxima_fecha,estado,cliente_id," +
          "asignado:vendedores!prospectos_asignado_a_fkey(nombre)," +
          "referidor:vendedores!prospectos_referido_por_vendedor_id_fkey(nombre)," +
          "cliente_ref:clientes!prospectos_referido_por_cliente_id_fkey(nombre)",
      )
      .order("fecha", { ascending: false })
      .limit(300);
    if (filtro) q = q.eq("estado", filtro);
    const [p, v, c] = await Promise.all([
      q,
      sb.from("vendedores").select("id,nombre,tipo").eq("activo", true).order("nombre"),
      sb.from("clientes").select("id,nombre").eq("estado", "activo").order("nombre").limit(500),
    ]);
    return {
      prospectos: o(p) as unknown as Prospecto[],
      vendedores: (v.data ?? []) as { id: string; nombre: string; tipo: string }[],
      clientes: (c.data ?? []) as { id: string; nombre: string }[],
    };
  }, [filtro]);

  const crear = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setGuardando(true);
    const { error } = await supabase().from("prospectos").insert({
      nombre: val(f, "nombre"), empresa: val(f, "empresa"), telefono: val(f, "telefono"), email: val(f, "email"),
      ciudad: val(f, "ciudad"), segmento: val(f, "segmento"), origen: val(f, "origen"),
      referido_por_vendedor_id: val(f, "referido_por_vendedor_id"), referido_por_cliente_id: val(f, "referido_por_cliente_id"),
      interes: val(f, "interes"), asignado_a: val(f, "asignado_a"), proxima_accion: val(f, "proxima_accion"), proxima_fecha: val(f, "proxima_fecha"),
    });
    setGuardando(false);
    if (error) return setAviso({ tono: "bad", texto: error.message });
    form.reset();
    setAviso({ tono: "ok", texto: "Prospecto registrado." });
    recargar();
  };

  const cambiarEstado = async (id: string, estado: string) => {
    const { error } = await supabase().from("prospectos").update({ estado }).eq("id", id);
    setAviso(error ? { tono: "bad", texto: error.message } : { tono: "ok", texto: "Estado actualizado." });
    recargar();
  };

  const convertir = async (id: string) => {
    const { data, error } = await supabase().rpc("convertir_prospecto", { p_prospecto: id });
    if (error || !data) return setAviso({ tono: "bad", texto: error?.message ?? "No se pudo convertir" });
    router.push(`/cliente/?id=${data}&ok=${encodeURIComponent("Prospecto convertido en cliente.")}`);
  };

  const filas = datos?.prospectos ?? [];

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: m.nombre, href: "/comercial/" }, { texto: "Prospectos" }]}
        titulo="Prospectos"
        descripcion="Registre cada prospecto con su origen para medir qué canal trae más ventas."
      />
      <Pestanas items={m.secciones.map((x) => ({ slug: x.slug, nombre: x.nombre, href: rutaSeccion(m, x) }))} activa="prospectos" />
      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : <MensajesUrl />}

      <div className="flex flex-wrap items-start gap-4">
        <section className="card flex min-w-0 flex-[999_1_640px] flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-osmos-line px-3.5 py-3 text-[13px]">
            <span className="text-osmos-muted">Estado:</span>
            {["", ...ESTADOS, "convertido"].map((e) => (
              <button
                key={e || "todos"}
                type="button"
                onClick={() => setFiltro(e)}
                className={`rounded-full border px-3 py-1 ${filtro === e ? "border-osmos-navy bg-osmos-navy font-bold text-white" : "border-[#B8C4DD] text-osmos-navy"}`}
              >
                {e ? etiqueta(e) : "Todos"}
              </button>
            ))}
            <span className="ml-auto text-osmos-muted">{cargando ? "Cargando…" : `${filas.length} registros`}</span>
          </div>
          {error ? (
            <div className="p-4"><Aviso tono="bad">No se pudo cargar: {error}</Aviso></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#F7F9FC]">
                    {["Prospecto", "Fecha", "Nombre / empresa", "Origen", "Referido por", "Interés", "Asignado a", "Próxima acción", "Estado", ""].map((h) => (
                      <th key={h} scope="col" className="th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.length === 0 ? (
                    <tr><td colSpan={10} className="td text-osmos-muted">{cargando ? "Cargando…" : "No hay prospectos todavía. Registre el primero con el formulario."}</td></tr>
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
                        <td className="td"><Estado valor={p.estado} /></td>
                        <td className="td">
                          {p.estado === "convertido" && p.cliente_id ? (
                            <Link href={`/cliente/?id=${p.cliente_id}`} className="font-bold text-osmos-navy2 underline">Ver cliente</Link>
                          ) : (
                            <div className="flex gap-2">
                              <label className="sr-only" htmlFor={`estado-${p.id}`}>Cambiar estado</label>
                              <select id={`estado-${p.id}`} value={p.estado} onChange={(e) => cambiarEstado(p.id, e.target.value)} className="input h-8 w-[120px] px-2 text-xs">
                                {ESTADOS.map((e) => <option key={e} value={e}>{etiqueta(e)}</option>)}
                              </select>
                              <button type="button" onClick={() => convertir(p.id)} className="btn-primary h-8 px-2 text-xs">Convertir en cliente</button>
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
          <form onSubmit={crear} className="flex flex-col gap-3">
            <div><label className="label" htmlFor="nombre">Nombre del contacto *</label><input id="nombre" name="nombre" required className="input" /></div>
            <div><label className="label" htmlFor="empresa">Empresa / condominio</label><input id="empresa" name="empresa" className="input" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label" htmlFor="telefono">Teléfono</label><input id="telefono" name="telefono" className="input" /></div>
              <div><label className="label" htmlFor="ciudad">Ciudad</label><input id="ciudad" name="ciudad" className="input" /></div>
            </div>
            <div><label className="label" htmlFor="email">Correo</label><input id="email" name="email" type="email" className="input" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="origen">Origen *</label>
                <select id="origen" name="origen" required className="input">{ORIGENES.map((x) => <option key={x} value={x}>{etiqueta(x)}</option>)}</select>
              </div>
              <div>
                <label className="label" htmlFor="segmento">Segmento</label>
                <select id="segmento" name="segmento" className="input">
                  <option value="residencial">Residencial</option><option value="comercial">Comercial</option><option value="industrial">Industrial</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="referido_por_vendedor_id">Vendedor externo o referidor</label>
              <select id="referido_por_vendedor_id" name="referido_por_vendedor_id" className="input">
                <option value="">— Ninguno —</option>
                {(datos?.vendedores ?? []).filter((v) => v.tipo !== "interno").map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="referido_por_cliente_id">Cliente que lo refirió</label>
              <select id="referido_por_cliente_id" name="referido_por_cliente_id" className="input">
                <option value="">— Ninguno —</option>
                {(datos?.clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="interes">Interés</label><input id="interes" name="interes" placeholder="Ej. ósmosis inversa residencial" className="input" /></div>
            <div>
              <label className="label" htmlFor="asignado_a">Asignar a</label>
              <select id="asignado_a" name="asignado_a" className="input">
                <option value="">— Sin asignar —</option>
                {(datos?.vendedores ?? []).map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label" htmlFor="proxima_accion">Próxima acción</label><input id="proxima_accion" name="proxima_accion" className="input" /></div>
              <div><label className="label" htmlFor="proxima_fecha">Fecha</label><input id="proxima_fecha" name="proxima_fecha" type="date" className="input" /></div>
            </div>
            <button type="submit" disabled={guardando} className="btn-primary h-10">{guardando ? "Guardando…" : "Registrar prospecto"}</button>
          </form>
        </section>
      </div>
    </>
  );
}
