"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { Aviso, Encabezado } from "@/components/ui";
import { Cargando } from "@/components/mensajes";
import { useSesion } from "@/components/sesion";

type Registro = { id: number; tabla: string; registro_id: string | null; accion: string; usuario_id: string | null; antes: Record<string, unknown> | null; despues: Record<string, unknown> | null; creado_en: string };

const TABLAS: Record<string, string> = {
  clientes: "Clientes", contactos: "Contactos", prospectos: "Prospectos", oportunidades: "Oportunidades", cotizaciones: "Cotizaciones",
  pedidos_venta: "Pedidos de venta", equipos_instalados: "Equipos instalados", equipo_componentes: "Componentes", igualas: "Igualas",
  ordenes_servicio: "Órdenes de servicio", vendedores: "Vendedores", esquemas_comision: "Esquemas de comisión", comisiones: "Comisiones",
  liquidaciones_comision: "Liquidaciones de comisión", productos: "Productos", suplidores: "Suplidores", ordenes_compra: "Órdenes de compra",
  facturas: "Facturas", recibos: "Recibos", notas_credito: "Notas de crédito", secuencias_ncf: "Secuencias NCF", facturas_suplidor: "Facturas de suplidor",
  pagos: "Pagos", asientos: "Asientos", cuentas_bancarias: "Cuentas bancarias", empleados: "Colaboradores", nominas: "Nóminas",
  solicitudes_ausencia: "Ausencias", perfiles: "Usuarios",
};
const ACCIONES: Record<string, [string, string]> = { INSERT: ["Creó", "bg-[#E3F4E8] text-[#1D6B3A]"], UPDATE: ["Modificó", "bg-[#E0F3F5] text-[#005A66]"], DELETE: ["Borró", "bg-[#FDE7E7] text-[#A12020]"] };
const IGNORAR = new Set(["updated_at", "created_at", "id"]);
const POR_PAGINA = 50;

function texto(v: unknown) {
  if (v === null || v === undefined || v === "") return "vacío";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

// Lista de campos que cambiaron entre el antes y el después.
function cambios(r: Registro): [string, unknown, unknown][] {
  if (r.accion === "UPDATE" && r.antes && r.despues) {
    return Object.keys(r.despues)
      .filter((k) => !IGNORAR.has(k) && JSON.stringify(r.antes![k]) !== JSON.stringify(r.despues![k]))
      .map((k) => [k, r.antes![k], r.despues![k]]);
  }
  const base = r.despues ?? r.antes ?? {};
  return Object.keys(base).filter((k) => !IGNORAR.has(k) && base[k] !== null && base[k] !== "").map((k) => [k, r.accion === "DELETE" ? base[k] : undefined, r.accion === "DELETE" ? undefined : base[k]]);
}

function nombreRegistro(r: Registro) {
  const d = (r.despues ?? r.antes ?? {}) as Record<string, unknown>;
  return [d.codigo ?? d.numero ?? d.serie, d.nombre ?? d.titulo ?? d.descripcion ?? d.email].filter(Boolean).map(String).join(" · ") || r.registro_id?.slice(0, 8) || "—";
}

export default function Auditoria() {
  const { perfil } = useSesion();
  const registro = useSearchParams().get("registro");
  const [tabla, setTabla] = useState("");
  const [usuario, setUsuario] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(0);
  const [abierto, setAbierto] = useState<number | null>(null);

  const { datos, error, cargando } = useDatos(async () => {
    const sb = supabase();
    let q = sb.from("auditoria").select("*", { count: "exact" }).order("creado_en", { ascending: false });
    if (registro) q = q.eq("registro_id", registro);
    if (tabla) q = q.eq("tabla", tabla);
    if (usuario) q = q.eq("usuario_id", usuario);
    if (desde) q = q.gte("creado_en", `${desde}T00:00:00`);
    if (hasta) q = q.lte("creado_en", `${hasta}T23:59:59`);
    const [r, p] = await Promise.all([q.range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1), sb.from("perfiles").select("id,nombre,email").order("nombre")]);
    if (r.error) throw new Error(r.error.message);
    return { filas: (r.data ?? []) as Registro[], total: r.count ?? 0, usuarios: (p.data ?? []) as { id: string; nombre: string; email: string | null }[] };
  }, [registro, tabla, usuario, desde, hasta, pagina]);

  if (perfil?.rol !== "admin") return <Aviso tono="warn">Solo el administrador puede ver el historial de cambios.</Aviso>;
  const nombres = new Map((datos?.usuarios ?? []).map((u) => [u.id, u.nombre]));
  const paginas = Math.max(1, Math.ceil((datos?.total ?? 0) / POR_PAGINA));
  const filtrar = (fn: () => void) => { fn(); setPagina(0); };

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Configuración", href: "/configuracion/" }, { texto: "Historial de cambios" }]}
        titulo="Historial de cambios"
        descripcion={registro ? "Cambios de un registro." : "Quién creó, modificó o borró cada registro. El historial no se puede editar."}
      />
      {error ? <Aviso tono="bad">{error}</Aviso> : null}
      <section className="card flex flex-col">
        <div className="flex flex-wrap items-end gap-2 border-b border-osmos-line px-3.5 py-3">
          <label className="flex flex-col">
            <span className="label mb-0.5">Sección</span>
            <select value={tabla} onChange={(e) => filtrar(() => setTabla(e.target.value))} className="input w-auto min-w-[170px]">
              <option value="">Todas</option>
              {Object.entries(TABLAS).sort((a, b) => a[1].localeCompare(b[1], "es")).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-col">
            <span className="label mb-0.5">Usuario</span>
            <select value={usuario} onChange={(e) => filtrar(() => setUsuario(e.target.value))} className="input w-auto min-w-[170px]">
              <option value="">Todos</option>
              {(datos?.usuarios ?? []).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </label>
          <label className="flex flex-col">
            <span className="label mb-0.5">Desde</span>
            <input type="date" value={desde} onChange={(e) => filtrar(() => setDesde(e.target.value))} className="input w-auto" />
          </label>
          <label className="flex flex-col">
            <span className="label mb-0.5">Hasta</span>
            <input type="date" value={hasta} onChange={(e) => filtrar(() => setHasta(e.target.value))} className="input w-auto" />
          </label>
          <span className="ml-auto text-[13px] text-osmos-muted">{cargando ? "Cargando…" : `${datos?.total ?? 0} cambios`}</span>
        </div>
        {cargando && !datos ? <div className="p-4"><Cargando /></div> : null}
        <ul className="flex flex-col">
          {(datos?.filas ?? []).length === 0 && !cargando ? <li className="p-4 text-sm text-osmos-muted">No hay cambios registrados con estos filtros.</li> : null}
          {(datos?.filas ?? []).map((r) => {
            const [verbo, clase] = ACCIONES[r.accion] ?? [r.accion, ""];
            const lista = cambios(r);
            const abiertoAqui = abierto === r.id;
            return (
              <li key={r.id} className="border-b border-osmos-soft px-3.5 py-2.5 text-[13px]">
                <button type="button" onClick={() => setAbierto(abiertoAqui ? null : r.id)} aria-expanded={abiertoAqui} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left">
                  <span className="w-[130px] tabular-nums text-osmos-muted">{new Date(r.creado_en).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}</span>
                  <strong className="min-w-[120px]">{r.usuario_id ? nombres.get(r.usuario_id) ?? "Usuario" : "Proceso automático"}</strong>
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${clase}`}>{verbo}</span>
                  <span className="text-osmos-muted">{TABLAS[r.tabla] ?? r.tabla}</span>
                  <span className="font-semibold text-osmos-navy">{nombreRegistro(r)}</span>
                  {r.accion === "UPDATE" ? <span className="text-xs text-osmos-muted">{lista.length} campo(s): {lista.slice(0, 3).map(([k]) => k.replace(/_/g, " ")).join(", ")}{lista.length > 3 ? "…" : ""}</span> : null}
                  <span className="ml-auto text-xs font-bold text-osmos-navy2 underline">{abiertoAqui ? "Ocultar" : "Ver detalle"}</span>
                </button>
                {abiertoAqui ? (
                  <table className="mt-2 w-full text-[12px]">
                    <thead><tr><th className="th">Campo</th><th className="th">Antes</th><th className="th">Después</th></tr></thead>
                    <tbody>
                      {lista.map(([k, a, d]) => (
                        <tr key={k}>
                          <td className="td font-semibold">{k.replace(/_/g, " ")}</td>
                          <td className="td whitespace-normal text-[#A12020]">{a === undefined ? "" : texto(a)}</td>
                          <td className="td whitespace-normal text-[#1D6B3A]">{d === undefined ? "" : texto(d)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </li>
            );
          })}
        </ul>
        {paginas > 1 ? (
          <nav aria-label="Páginas" className="flex items-center justify-end gap-2 px-3.5 py-3 text-[13px]">
            <button type="button" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} className="btn-secondary h-8">Más recientes</button>
            <span className="text-osmos-muted">Página {pagina + 1} de {paginas}</span>
            <button type="button" disabled={pagina >= paginas - 1} onClick={() => setPagina(pagina + 1)} className="btn-secondary h-8">Más antiguos</button>
          </nav>
        ) : null}
      </section>
    </>
  );
}
