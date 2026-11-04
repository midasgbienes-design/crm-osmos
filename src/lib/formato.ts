const dinero = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const entero = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 });

export function formatoDinero(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return (n < 0 ? "-RD$ " : "RD$ ") + dinero.format(Math.abs(n));
}

export function formatoNumero(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : entero.format(n);
}

export function formatoFecha(v: unknown): string {
  if (!v) return "—";
  const s = String(v);
  const [y, m, d] = s.slice(0, 10).split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

export function formatoMes(v: unknown): string {
  if (!v) return "—";
  const [y, m] = String(v).slice(0, 7).split("-");
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${meses[Number(m) - 1] ?? m} ${y}`;
}

// Monto en letras para facturas y recibos: "Mil doscientos pesos con 50/100".
const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function menosDeMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  let t = "";
  if (r < 30) t = UNIDADES[r];
  else t = DECENAS[Math.floor(r / 10)] + (r % 10 ? " y " + UNIDADES[r % 10] : "");
  return [CENTENAS[c], t].filter(Boolean).join(" ");
}

// "veintiuno mil" → "veintiún mil", "treinta y uno mil" → "treinta y un mil"
const apocope = (t: string) => t.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");

export function numeroEnLetras(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  const cent = Math.round((Math.abs(valor) - n) * 100);
  if (n === 0) return `Cero pesos con ${String(cent).padStart(2, "0")}/100`;
  const partes: string[] = [];
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  if (millones) partes.push(millones === 1 ? "un millón" : `${apocope(menosDeMil(millones))} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${apocope(menosDeMil(miles))} mil`);
  if (resto) partes.push(menosDeMil(resto));
  const texto = apocope(partes.join(" "));
  const de = !miles && !resto && millones ? " de" : "";
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}${de} ${n === 1 ? "peso" : "pesos"} con ${String(cent).padStart(2, "0")}/100`;
}

// Etiquetas legibles para valores guardados en la base de datos.
const ETIQUETAS: Record<string, string> = {
  web: "Página web",
  whatsapp: "WhatsApp",
  vendedor_externo: "Vendedor externo",
  referido_cliente: "Referido de cliente",
  base_instalada: "Base instalada",
  llamada: "Llamada entrante",
  evento: "Evento / feria",
  otro: "Otro",
  cotizacion: "Cotización",
  conduce: "Conduce",
  interno: "Interno (empleado)",
  externo: "Externo (comisionista)",
  referidor: "Referidor",
  cuentas_por_pagar: "Cuentas por pagar",
  nomina: "Vía nómina",
  en_garantia: "En garantía",
  al_dia: "Al día",
  proximo: "Próximo",
  vencido: "Vencido",
  visita_tecnica: "Visita técnica",
  analisis_agua: "Análisis de agua",
  cotizacion_enviada: "Cotización enviada",
  negociacion: "Negociación",
  ganada: "Ganada",
  perdida: "Perdida",
  por_aprobar: "Por aprobar",
  por_aplicar: "Por aplicar",
  por_renovar: "Por renovar",
  por_presentar: "Por presentar",
  por_facturar: "Por facturar",
  por_contabilizar: "Por contabilizar",
  en_proceso: "En proceso",
  en_instalacion: "En instalación",
  en_negociacion: "En negociación",
  en_cierre: "En cierre",
  sin_compromiso: "Sin compromiso",
  debito_automatico: "Débito automático",
  licencia_medica: "Licencia médica",
  licencia_maternidad: "Licencia de maternidad",
  iguala_nueva: "Iguala nueva",
  renovacion: "Renovación",
  bono_meta: "Bono por meta",
  cobrado_sin_itbis: "Cobrado sin ITBIS",
  cuota_x3: "Cuota × 3",
  cuota_x12: "Cuota × 12",
  ventas_mes: "Ventas del mes",
  fuera_de_servicio: "Fuera de servicio",
};

export function etiqueta(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  const s = String(v);
  if (ETIQUETAS[s]) return ETIQUETAS[s];
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export type Tono = "ok" | "warn" | "bad" | "info" | "off";

const TONOS: Record<string, Tono> = {
  activo: "ok", vigente: "ok", aprobada: "ok", aprobado: "ok", pagada: "ok", pagado: "ok", aplicado: "ok", aplicada: "ok",
  contabilizado: "ok", conciliado: "ok", emitido: "ok", presentado: "ok", completada: "ok", completa: "ok", convertido: "ok",
  calificado: "ok", ganada: "ok", al_dia: "ok", en_garantia: "ok", procesada: "ok", cumplido: "ok", facturada: "ok",
  entregado: "ok", recibida: "ok", liquidada: "ok", cubierta: "ok", operativo: "ok", true: "ok",
  nuevo: "info", contactado: "info", emitida: "info", programado: "info", programada: "info", enviada: "info",
  en_proceso: "info", abierta: "info", abierto: "info", en_instalacion: "info", por_aplicar: "info", calculada: "info",
  visita_tecnica: "info", analisis_agua: "info", cotizacion_enviada: "info", prospecto: "info", entrevistas: "info",
  parcial: "warn", por_aprobar: "warn", por_renovar: "warn", por_presentar: "warn", por_facturar: "warn", proximo: "warn",
  prometido: "warn", negociacion: "warn", en_negociacion: "warn", por_contabilizar: "warn", retenida: "warn", licencia: "warn",
  vencida: "bad", vencido: "bad", rechazada: "bad", incumplido: "bad", diferencia: "bad", suspendida: "bad", perdida: "bad",
  bloqueado: "bad", fuera_de_servicio: "bad",
  borrador: "off", cancelada: "off", cancelado: "off", anulada: "off", anulado: "off", inactivo: "off", descartado: "off",
  cerrado: "off", false: "off",
};

export function tono(v: unknown): Tono {
  return TONOS[String(v)] ?? "off";
}
