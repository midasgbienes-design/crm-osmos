"use client";

import { useState } from "react";
import type { Campo, Formulario } from "@/lib/formularios";

export type Opciones = Record<string, { id: string; texto: string }[]>;

// Rellena "{a} · {b|c}" con los valores de la fila; "b|c" usa el primero que exista.
export function rellenar(plantilla: string, fila: Record<string, unknown>) {
  return plantilla
    .replace(/\{([\w|]+)\}/g, (_, k: string) => {
      for (const parte of k.split("|")) {
        const v = fila[parte];
        if (v !== null && v !== undefined && v !== "") return String(v);
      }
      return "";
    })
    .replace(/\s·\s*$/, "")
    .replace(/\(\)\s*$/, "")
    .trim();
}

// Convierte lo escrito en el formulario al tipo que espera la base de datos.
export function leerValores(campos: Campo[], f: FormData, esNuevo: boolean) {
  const fila: Record<string, unknown> = {};
  for (const c of campos) {
    if (c.tipo === "booleano") {
      fila[c.campo] = f.get(c.campo) === "on";
      continue;
    }
    const crudo = String(f.get(c.campo) ?? "").trim();
    let v: unknown = crudo === "" ? null : crudo;
    if (v !== null && ["numero", "dinero", "porcentaje"].includes(c.tipo)) v = Number(String(v).replace(/,/g, ""));
    // En un registro nuevo, los campos vacíos se omiten para que la base de datos use su valor por defecto.
    if (v === null && esNuevo) continue;
    fila[c.campo] = v;
  }
  return fila;
}

function Control({ c, valor, opciones }: { c: Campo; valor: unknown; opciones: Opciones }) {
  const id = `campo-${c.campo}`;
  const dv = valor === null || valor === undefined ? "" : String(valor);
  switch (c.tipo) {
    case "textarea":
      return <textarea id={id} name={c.campo} rows={3} required={c.requerido} defaultValue={dv} className="input h-auto py-2" />;
    case "seleccion":
      return (
        <select id={id} name={c.campo} required={c.requerido} defaultValue={dv} className="input">
          {!c.requerido || dv === "" ? <option value="">— Seleccione —</option> : null}
          {(c.opciones ?? []).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      );
    case "relacion":
      return (
        <select id={id} name={c.campo} required={c.requerido} defaultValue={dv} className="input">
          <option value="">— Ninguno —</option>
          {(opciones[c.campo] ?? []).map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
        </select>
      );
    case "booleano":
      return (
        <label className="flex h-9 items-center gap-2 text-sm">
          <input id={id} name={c.campo} type="checkbox" defaultChecked={valor === undefined ? Boolean(c.defecto) : Boolean(valor)} className="h-4 w-4 accent-osmos-navy" />
          Sí
        </label>
      );
    case "fecha":
      return <input id={id} name={c.campo} type="date" required={c.requerido} defaultValue={dv.slice(0, 10)} className="input" />;
    case "numero":
    case "dinero":
    case "porcentaje":
      return <input id={id} name={c.campo} type="number" step={c.tipo === "numero" ? "any" : "0.01"} min={c.tipo === "porcentaje" ? 0 : undefined} max={c.tipo === "porcentaje" ? 100 : undefined} required={c.requerido} defaultValue={dv} className="input text-right" />;
    case "email":
      return <input id={id} name={c.campo} type="email" required={c.requerido} defaultValue={dv} className="input" />;
    case "telefono":
      return <input id={id} name={c.campo} type="tel" required={c.requerido} defaultValue={dv} className="input" />;
    default:
      return <input id={id} name={c.campo} required={c.requerido} defaultValue={dv} className="input" />;
  }
}

export function Editor({
  formulario,
  inicial,
  opciones,
  onGuardar,
  onCancelar,
}: {
  formulario: Formulario;
  inicial: Record<string, unknown> | null;
  opciones: Opciones;
  onGuardar: (f: FormData) => Promise<void>;
  onCancelar: () => void;
}) {
  const [guardando, setGuardando] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
          await onGuardar(new FormData(e.currentTarget));
        } finally {
          setGuardando(false);
        }
      }}
      className="card grid max-w-4xl grid-cols-1 gap-4 p-5 sm:grid-cols-2"
    >
      {formulario.campos.map((c) => {
        const valor = inicial ? inicial[c.campo] : undefined;
        return (
          <div key={c.campo} className={c.ancho === "completo" ? "sm:col-span-2" : ""}>
            <label className="label" htmlFor={`campo-${c.campo}`}>
              {c.etiqueta}
              {c.requerido ? " *" : ""}
            </label>
            <Control c={c} valor={valor === undefined && !inicial?.id ? c.defecto : valor} opciones={opciones} />
            {c.ayuda ? <p className="mt-1 text-xs text-osmos-muted">{c.ayuda}</p> : null}
          </div>
        );
      })}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={guardando} className="btn-primary h-10">
          {guardando ? "Guardando…" : inicial?.id ? "Guardar cambios" : `Guardar ${formulario.singular}`}
        </button>
        <button type="button" onClick={onCancelar} className="btn-secondary h-10">
          Cancelar
        </button>
      </div>
    </form>
  );
}
