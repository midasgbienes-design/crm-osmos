// Importación desde Excel usando las mismas definiciones de los formularios:
// cada columna de la plantilla es un campo del formulario.
import { FORMULARIOS, type Campo, type Formulario } from "./formularios";
import { rellenar } from "@/components/editor";

export type Importable = {
  clave: string;
  titulo: string;
  descripcion: string;
  // Combinaciones de campos que identifican un registro que ya existe (se omite).
  duplicado: string[][];
  excluir?: string[];
};

export const IMPORTABLES: Importable[] = [
  { clave: "comercial/clientes", titulo: "Clientes", descripcion: "Cartera de clientes con su RNC, segmento y condiciones de crédito.", duplicado: [["rnc_cedula"], ["nombre"]] },
  { clave: "comercial/contactos", titulo: "Contactos de clientes", descripcion: "Personas de contacto. El cliente se indica por su código (CL-0001) o su nombre.", duplicado: [["cliente_id", "nombre"]] },
  { clave: "comercial/equipos", titulo: "Equipos instalados", descripcion: "Base instalada: equipos por cliente con serie, instalación y garantía.", duplicado: [["serie"]] },
  { clave: "comercial/componentes", titulo: "Componentes y reemplazos", descripcion: "Membranas, filtros y repuestos de cada equipo, con su frecuencia de cambio. El equipo se indica por su serie.", duplicado: [["equipo_id", "descripcion"]] },
  { clave: "igualas/contratos", titulo: "Igualas de mantenimiento", descripcion: "Contratos vigentes con su cuota mensual y frecuencia de visitas.", duplicado: [["cliente_id", "fecha_inicio", "cuota_mensual"]] },
  { clave: "compras/catalogo", titulo: "Catálogo de productos", descripcion: "Equipos, insumos, repuestos y servicios con precio y costo.", duplicado: [["codigo"], ["nombre"]] },
  { clave: "suplidores/listado", titulo: "Suplidores", descripcion: "Proveedores con RNC, días de crédito y datos bancarios.", duplicado: [["rnc"], ["nombre"]] },
  { clave: "rrhh/empleados", titulo: "Colaboradores", descripcion: "Empleados con cédula, cargo y salario.", duplicado: [["cedula"], ["nombre"]], excluir: ["perfil_id"] },
];

export const quitarAcentos = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function camposDe(imp: Importable): Campo[] {
  return FORMULARIOS[imp.clave].campos.filter((c) => !(imp.excluir ?? []).includes(c.campo));
}

export function tituloColumna(c: Campo) {
  return `${c.etiqueta}${c.requerido ? " *" : ""}`;
}

// Valores aceptados por cada campo de lista, para las instrucciones.
export function ayudaCampo(c: Campo): string | null {
  if (c.tipo === "seleccion") return (c.opciones ?? []).map(([, t]) => t).join(" · ");
  if (c.tipo === "booleano") return "Sí o No";
  if (c.tipo === "fecha") return "Fecha (dd/mm/aaaa)";
  if (c.tipo === "relacion") return c.relacion?.tabla === "equipos_instalados" ? "Serie del equipo" : "Código o nombre exacto";
  if (["numero", "dinero", "porcentaje"].includes(c.tipo)) return "Número";
  return null;
}

export type Indice = Map<string, string>; // texto normalizado → id

// Índice para buscar una relación por código, nombre, serie o la etiqueta completa.
export function indiceRelacion(c: Campo, filas: Record<string, unknown>[]): Indice {
  const ind: Indice = new Map();
  for (const f of filas) {
    const id = String(f.id);
    for (const k of ["codigo", "nombre", "serie", "email"]) {
      if (f[k]) ind.set(quitarAcentos(String(f[k])), id);
    }
    if (c.relacion) ind.set(quitarAcentos(rellenar(c.relacion.etiqueta, f)), id);
  }
  return ind;
}

function aFechaIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  // Número de serie de fecha de Excel
  if (/^\d{5}$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000).toISOString().slice(0, 10);
  return null;
}

function aNumero(v: unknown): number | null {
  if (typeof v === "number") return v;
  const s = String(v).replace(/RD\$|US\$|\$|%|\s/g, "").replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// "6000.00" y 6000 deben compararse igual.
function normalizarClave(v: unknown) {
  const s = String(v).trim();
  return /^-?\d+(\.\d+)?$/.test(s) ? String(Number(s)) : quitarAcentos(s);
}

export type FilaImportada = {
  numero: number; // fila de Excel
  valores: Record<string, unknown>;
  errores: string[];
  duplicado: boolean;
};

// Convierte las filas de la hoja en registros listos para guardar, con sus errores.
export function interpretar(
  imp: Importable,
  hoja: unknown[][],
  indices: Record<string, Indice>,
  existentes: Record<string, unknown>[],
): { filas: FilaImportada[]; faltan: string[]; desconocidas: string[] } {
  const campos = camposDe(imp);
  const [cab = [], ...resto] = hoja;
  const porTitulo = new Map<string, Campo>();
  for (const c of campos) {
    porTitulo.set(quitarAcentos(c.etiqueta), c);
    porTitulo.set(quitarAcentos(c.campo), c);
  }
  const mapa: (Campo | null)[] = cab.map((t) => porTitulo.get(quitarAcentos(String(t ?? "").replace(/\*/g, ""))) ?? null);
  const presentes = new Set(mapa.filter(Boolean).map((c) => c!.campo));
  const faltan = campos.filter((c) => c.requerido && !presentes.has(c.campo)).map((c) => c.etiqueta);
  const desconocidas = cab.filter((t, i) => String(t ?? "").trim() && !mapa[i]).map((t) => String(t));

  const claves = (f: Record<string, unknown>, grupo: string[]) =>
    grupo.every((k) => f[k] !== null && f[k] !== undefined && f[k] !== "") ? grupo.map((k) => normalizarClave(f[k])).join("|") : null;
  const yaExisten = imp.duplicado.map((g) => new Set(existentes.map((f) => claves(f, g)).filter(Boolean)));
  const enArchivo = imp.duplicado.map(() => new Set<string>());

  const filas: FilaImportada[] = [];
  resto.forEach((celdas, i) => {
    if (!celdas || celdas.every((v) => v === null || v === undefined || String(v).trim() === "")) return;
    const valores: Record<string, unknown> = {};
    const errores: string[] = [];
    mapa.forEach((c, j) => {
      if (!c) return;
      const crudo = celdas[j];
      if (crudo === null || crudo === undefined || String(crudo).trim() === "") return;
      switch (c.tipo) {
        case "numero":
        case "dinero":
        case "porcentaje": {
          const n = aNumero(crudo);
          if (n === null) errores.push(`${c.etiqueta}: «${crudo}» no es un número`);
          else valores[c.campo] = n;
          break;
        }
        case "fecha": {
          const f = aFechaIso(crudo);
          if (!f) errores.push(`${c.etiqueta}: «${crudo}» no es una fecha válida`);
          else valores[c.campo] = f;
          break;
        }
        case "booleano": {
          const t = quitarAcentos(String(crudo));
          if (["si", "s", "yes", "true", "1", "x", "verdadero"].includes(t)) valores[c.campo] = true;
          else if (["no", "n", "false", "0", "falso"].includes(t)) valores[c.campo] = false;
          else errores.push(`${c.etiqueta}: escriba Sí o No`);
          break;
        }
        case "seleccion": {
          const t = quitarAcentos(String(crudo));
          const op = (c.opciones ?? []).find(([v, e]) => quitarAcentos(v) === t || quitarAcentos(e) === t || quitarAcentos(e).startsWith(t + " "));
          if (!op) errores.push(`${c.etiqueta}: «${crudo}» no es válido (use ${(c.opciones ?? []).map(([, e]) => e).join(", ")})`);
          else valores[c.campo] = op[0];
          break;
        }
        case "relacion": {
          const id = indices[c.campo]?.get(quitarAcentos(String(crudo)));
          if (!id) errores.push(`${c.etiqueta}: no se encontró «${crudo}»`);
          else valores[c.campo] = id;
          break;
        }
        default:
          valores[c.campo] = typeof crudo === "number" && !Number.isInteger(crudo) ? String(crudo) : String(crudo).trim();
      }
    });
    for (const c of campos) {
      if (c.requerido && (valores[c.campo] === undefined || valores[c.campo] === "") && !errores.some((e) => e.startsWith(c.etiqueta))) {
        errores.push(`Falta ${c.etiqueta}`);
      }
    }
    let duplicado = false;
    imp.duplicado.forEach((g, k) => {
      const clave = claves(valores, g);
      if (!clave) return;
      if (yaExisten[k].has(clave) || enArchivo[k].has(clave)) duplicado = true;
      enArchivo[k].add(clave);
    });
    filas.push({ numero: i + 2, valores, errores, duplicado });
  });
  return { filas, faltan, desconocidas };
}

export function formularioDe(imp: Importable): Formulario {
  return FORMULARIOS[imp.clave];
}
