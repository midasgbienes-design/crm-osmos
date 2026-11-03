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
