"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { formatoFecha } from "@/lib/formato";
import { Aviso, Encabezado } from "@/components/ui";
import { Cargando } from "@/components/mensajes";

const FILAS = [0, 1, 2, 3, 4, 5];
type Op = { id: string; [k: string]: unknown };

export default function NuevaOrden() {
  const router = useRouter();
  const sp = useSearchParams();
  const [clienteElegido, setClienteElegido] = useState<string | null>(sp.get("cliente"));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { datos } = useDatos(async () => {
    const sb = supabase();
    let clienteId = clienteElegido;
    let igualaId = sp.get("iguala");
    let visitaId: string | null = null;
    const visitaParam = sp.get("visita");
    if (visitaParam) {
      const { data } = await sb.from("visitas").select("id,iguala_id,cliente_id").eq("id", visitaParam).maybeSingle();
      if (data) {
        visitaId = data.id;
        clienteId = clienteId ?? data.cliente_id;
        igualaId = igualaId ?? data.iguala_id;
      }
    }
    if (igualaId && !clienteId) {
      const { data } = await sb.from("igualas").select("cliente_id").eq("id", igualaId).maybeSingle();
      clienteId = data?.cliente_id ?? null;
    }
    const vacio = Promise.resolve({ data: [] as Op[] });
    const [clientes, productos, tecnicos, igualas, equipos, visitas] = await Promise.all([
      sb.from("clientes").select("id,nombre").neq("estado", "inactivo").order("nombre").limit(1000),
      sb.from("productos").select("id,codigo,nombre").eq("activo", true).neq("tipo", "equipo").order("nombre"),
      sb.from("v_directorio").select("id,nombre,cargo").eq("estado", "activo").order("nombre"),
      clienteId ? sb.from("igualas").select("id,codigo,descripcion").eq("cliente_id", clienteId).in("estado", ["vigente", "por_renovar"]) : vacio,
      clienteId ? sb.from("equipos_instalados").select("id,serie,descripcion").eq("cliente_id", clienteId).neq("estado", "retirado") : vacio,
      clienteId ? sb.from("visitas").select("id,fecha_programada,servicio").eq("cliente_id", clienteId).eq("estado", "programada").order("fecha_programada") : vacio,
    ]);
    return {
      clienteId, igualaId, visitaId,
      clientes: (clientes.data ?? []) as Op[], productos: (productos.data ?? []) as Op[], tecnicos: (tecnicos.data ?? []) as Op[],
      igualas: (igualas.data ?? []) as Op[], equipos: (equipos.data ?? []) as Op[], visitas: (visitas.data ?? []) as Op[],
    };
  }, [clienteElegido]);

  const registrar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const val = (k: string) => {
      const x = String(f.get(k) ?? "").trim();
      return x === "" ? null : x;
    };
    const insumos = FILAS.map((i) => ({ producto_id: val(`insumo_${i}`), cantidad: Number(f.get(`cantidad_${i}`) ?? 0), cobertura: val(`cobertura_${i}`) ?? "incluido" }))
      .filter((x) => x.producto_id && x.cantidad > 0);
    setGuardando(true);
    const { data, error } = await supabase().rpc("registrar_orden_servicio", {
      p: {
        cliente_id: datos?.clienteId, iguala_id: val("iguala_id"), equipo_id: val("equipo_id"), visita_id: val("visita_id"),
        tipo: val("tipo"), fecha: val("fecha"), tecnico_id: val("tecnico_id"), trabajo_realizado: val("trabajo_realizado"),
        observaciones: val("observaciones"), insumos,
      },
    });
    setGuardando(false);
    if (error || !data) {
      setError(error?.message ?? "No se pudo registrar");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push(`/orden/?id=${data}&ok=${encodeURIComponent("Orden de servicio registrada. El inventario y la base instalada se actualizaron.")}`);
  };

  const nombreCliente = datos?.clientes.find((c) => c.id === datos.clienteId)?.nombre as string | undefined;

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Igualas", href: "/igualas/" }, { texto: "Órdenes de servicio", href: "/igualas/ordenes/" }, { texto: "Nueva" }]}
        titulo="Nueva orden de servicio"
        descripcion="Los insumos usados se descuentan del inventario y actualizan la fecha de reemplazo del equipo."
      />
      {error ? <Aviso tono="bad">{error}</Aviso> : null}

      {!datos ? <Cargando /> : !datos.clienteId ? (
        <div className="card flex max-w-xl flex-col gap-3 p-5">
          <label className="label" htmlFor="cliente">Primero seleccione el cliente</label>
          <select id="cliente" defaultValue="" onChange={(e) => e.target.value && setClienteElegido(e.target.value)} className="input">
            <option value="">Seleccione…</option>
            {datos.clientes.map((c) => <option key={c.id} value={c.id}>{String(c.nombre)}</option>)}
          </select>
        </div>
      ) : (
        <form onSubmit={registrar} className="flex flex-col gap-4">
          <section className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-0.5 sm:col-span-2 lg:col-span-3">
              <span className="text-xs text-osmos-muted">Cliente</span>
              <span className="text-base font-bold text-osmos-navy">
                {nombreCliente}
                <button type="button" onClick={() => setClienteElegido(null)} className="ml-2 text-xs font-semibold text-osmos-navy2 underline">cambiar</button>
              </span>
            </div>
            <div>
              <label className="label" htmlFor="iguala_id">Iguala</label>
              <select id="iguala_id" name="iguala_id" defaultValue={datos.igualaId ?? ""} className="input">
                <option value="">— Servicio sin iguala —</option>
                {datos.igualas.map((i) => <option key={i.id} value={i.id}>{String(i.codigo)} · {String(i.descripcion ?? "")}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="equipo_id">Equipo atendido</label>
              <select id="equipo_id" name="equipo_id" className="input">
                <option value="">— No aplica —</option>
                {datos.equipos.map((e) => <option key={e.id} value={e.id}>{String(e.descripcion)} · {String(e.serie)}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="visita_id">Visita programada</label>
              <select id="visita_id" name="visita_id" defaultValue={datos.visitaId ?? ""} className="input">
                <option value="">— Ninguna —</option>
                {datos.visitas.map((v) => <option key={v.id} value={v.id}>{formatoFecha(v.fecha_programada)} · {String(v.servicio ?? "")}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="tipo">Tipo *</label>
              <select id="tipo" name="tipo" defaultValue="preventivo" className="input">
                {[["preventivo", "Preventivo"], ["correctivo", "Correctivo"], ["instalacion", "Instalación"], ["garantia", "Garantía"], ["analisis", "Toma de muestra / análisis"]].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="fecha">Fecha</label><input id="fecha" name="fecha" type="date" defaultValue={new Date().toLocaleDateString("sv-SE")} className="input" /></div>
            <div>
              <label className="label" htmlFor="tecnico_id">Técnico</label>
              <select id="tecnico_id" name="tecnico_id" className="input">
                <option value="">— Sin asignar —</option>
                {datos.tecnicos.map((t) => <option key={t.id} value={t.id}>{String(t.nombre)}{t.cargo ? ` · ${t.cargo}` : ""}</option>)}
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
                <thead><tr className="bg-[#F7F9FC]"><th scope="col" className="th">Artículo</th><th scope="col" className="th">Cantidad</th><th scope="col" className="th">Cobertura</th></tr></thead>
                <tbody>
                  {FILAS.map((i) => (
                    <tr key={i}>
                      <td className="td min-w-[260px]">
                        <label className="sr-only" htmlFor={`insumo_${i}`}>Artículo {i + 1}</label>
                        <select id={`insumo_${i}`} name={`insumo_${i}`} className="input">
                          <option value="">—</option>
                          {datos.productos.map((p) => <option key={p.id} value={p.id}>{String(p.codigo)} · {String(p.nombre)}</option>)}
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

          <button type="submit" disabled={guardando} className="btn-primary h-10 self-start">{guardando ? "Guardando…" : "Registrar orden de servicio"}</button>
        </form>
      )}
    </>
  );
}
