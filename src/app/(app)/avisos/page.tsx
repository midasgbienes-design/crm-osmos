"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { formatoDinero, formatoFecha } from "@/lib/formato";
import { Aviso, Encabezado } from "@/components/ui";
import { Cargando } from "@/components/mensajes";
import { cargarAvisos, type AvisoFila } from "@/lib/avisos";

const CATEGORIAS: Record<string, string> = {
  cobro: "Cobros", iguala: "Igualas", servicio: "Servicio técnico", reposicion: "Base instalada", ventas: "Ventas",
  inventario: "Inventario", pago: "Pagos", fiscal: "Fiscal (NCF)",
};
const PRIORIDAD: Record<number, [string, string]> = {
  1: ["Urgente", "bg-[#FDE7E7] text-[#A12020]"],
  2: ["Importante", "bg-[#FFF4D6] text-[#7A5600]"],
  3: ["Próximo", "bg-[#E0F3F5] text-[#005A66]"],
};

// Número dominicano para WhatsApp: 809/829/849 + 7 dígitos → 1 + número.
function whatsapp(tel: string | null) {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length === 10 && /^(809|829|849)/.test(d)) return `1${d}`;
  if (d.length === 11 && d.startsWith("1")) return d;
  return d.length >= 10 ? d : null;
}

// Mensaje sugerido para el cliente. Lo revisa y envía la persona, no el sistema.
function mensaje(a: AvisoFila, empresa: string) {
  const saludo = `Saludos${a.cliente ? `, ${a.cliente}` : ""}.`;
  const firma = `\n\n${empresa}`;
  switch (a.categoria) {
    case "cobro":
      return `${saludo} Le recordamos que tiene pendiente ${a.titulo.replace(/^Factura/, "la factura").replace(/ vencida hace.*| vence.*/, "")} por ${formatoDinero(a.monto)}, con vencimiento el ${formatoFecha(a.fecha)}. Si ya realizó el pago, favor enviarnos el comprobante. ¡Gracias!${firma}`;
    case "iguala":
      return `${saludo} Su contrato de mantenimiento (${a.titulo.replace(/^Iguala /, "").replace(/ venc.*/, "")}) vence el ${formatoFecha(a.fecha)}. Nos gustaría coordinar la renovación para que su sistema siga protegido.${firma}`;
    case "reposicion":
      return `${saludo} Según nuestro registro, a su equipo le corresponde el reemplazo de ${a.titulo.split(" · ")[0].replace(/^Garantía por vencer: /, "")} (${formatoFecha(a.fecha)}). ¿Le parece si coordinamos la visita?${firma}`;
    case "servicio":
      return `${saludo} Le escribimos para coordinar la visita de mantenimiento de su sistema de agua. ¿Qué día y hora le queda bien?${firma}`;
    case "ventas":
      return `${saludo} Le damos seguimiento a nuestra propuesta. ¿Tiene alguna pregunta o desea que ajustemos algo?${firma}`;
    default:
      return `${saludo}${firma}`;
  }
}

export default function Avisos() {
  const [categoria, setCategoria] = useState("");
  const { datos, error, cargando } = useDatos(async () => {
    const [avisos, empresa] = await Promise.all([cargarAvisos(), supabase().from("empresa").select("razon_social").eq("id", 1).maybeSingle()]);
    return { avisos, empresa: (empresa.data?.razon_social as string | undefined) ?? "Osmos Tecnología del Agua" };
  }, []);

  const todos = datos?.avisos ?? [];
  const conteo = todos.reduce<Record<string, number>>((t, a) => ({ ...t, [a.categoria]: (t[a.categoria] ?? 0) + 1 }), {});
  const lista = categoria ? todos.filter((a) => a.categoria === categoria) : todos;
  const urgentes = todos.filter((a) => a.prioridad === 1).length;

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Avisos" }]}
        titulo="Avisos"
        descripcion="Lo que necesita atención hoy: cobros, renovaciones, visitas, reemplazos, inventario y NCF. Cada persona ve los avisos de su área."
      />
      {error ? <Aviso tono="bad">{error}</Aviso> : null}
      {cargando && !datos ? <Cargando /> : null}
      {datos && todos.length === 0 ? <Aviso tono="ok">No hay avisos pendientes. Todo al día.</Aviso> : null}

      {todos.length ? (
        <div role="tablist" aria-label="Categorías" className="flex flex-wrap gap-2">
          <button type="button" role="tab" aria-selected={!categoria} onClick={() => setCategoria("")} className={!categoria ? "btn-primary" : "btn-secondary"}>
            Todos ({todos.length}){urgentes ? ` · ${urgentes} urgente(s)` : ""}
          </button>
          {Object.entries(CATEGORIAS).filter(([k]) => conteo[k]).map(([k, v]) => (
            <button key={k} type="button" role="tab" aria-selected={categoria === k} onClick={() => setCategoria(k)} className={categoria === k ? "btn-primary" : "btn-secondary"}>
              {v} ({conteo[k]})
            </button>
          ))}
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {lista.map((a) => {
          const [prioridad, clase] = PRIORIDAD[a.prioridad] ?? PRIORIDAD[3];
          const wa = whatsapp(a.telefono);
          const texto = mensaje(a, datos?.empresa ?? "Osmos");
          const contactable = ["cobro", "iguala", "reposicion", "servicio", "ventas"].includes(a.categoria);
          return (
            <li key={`${a.categoria}-${a.registro_id}-${a.titulo}`} className="card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span className={`w-[86px] rounded px-2 py-0.5 text-center text-xs font-bold ${clase}`}>{prioridad}</span>
              <div className="flex min-w-[240px] flex-1 flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-osmos-muted">{CATEGORIAS[a.categoria] ?? a.categoria} · {formatoFecha(a.fecha)}</span>
                <strong className="text-sm text-osmos-navy">{a.titulo}</strong>
                {a.detalle ? <span className="text-[13px] text-osmos-muted">{a.detalle}</span> : null}
              </div>
              {a.monto !== null && Number(a.monto) > 0 ? <span className="text-sm font-bold tabular-nums">{formatoDinero(a.monto)}</span> : null}
              <span className="flex flex-wrap gap-2">
                {a.enlace ? <Link href={a.enlace} className="btn-secondary h-8">Abrir</Link> : null}
                {contactable && wa ? (
                  <a href={`https://wa.me/${wa}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8" title="Abre WhatsApp con un mensaje sugerido que usted revisa y envía">
                    WhatsApp
                  </a>
                ) : null}
                {contactable && a.email ? (
                  <a href={`mailto:${a.email}?subject=${encodeURIComponent(a.titulo)}&body=${encodeURIComponent(texto)}`} className="btn-secondary h-8">Correo</a>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {todos.length ? <p className="text-xs text-osmos-muted">WhatsApp y Correo abren un mensaje sugerido para que usted lo revise y lo envíe.</p> : null}
    </>
  );
}
