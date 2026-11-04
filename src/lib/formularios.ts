// Formularios de alta y edición. Cada uno se asocia a una sección "modulo/seccion"
// de src/lib/modulos.ts y escribe en su tabla. Los permisos los decide la base de datos.

export type TipoCampo = "texto" | "textarea" | "numero" | "dinero" | "porcentaje" | "fecha" | "email" | "telefono" | "seleccion" | "relacion" | "booleano";

export type Relacion = {
  tabla: string;
  select: string; // columnas necesarias para la etiqueta, incluyendo id
  etiqueta: string; // plantilla, ej. "{codigo} · {nombre}"
  orden?: string;
  filtro?: [string, string | boolean];
};

export type Campo = {
  campo: string;
  etiqueta: string;
  tipo: TipoCampo;
  requerido?: boolean;
  opciones?: [string, string][];
  relacion?: Relacion;
  ayuda?: string;
  ancho?: "completo";
  defecto?: string | number | boolean;
};

export type Formulario = {
  tabla: string;
  singular: string; // "cliente", "vendedor"…
  femenino?: boolean; // "Nueva oportunidad", "creada"
  campos: Campo[];
  // A dónde volver después de guardar (por defecto, a la lista de la sección).
  despues?: (id: string) => string;
};

const SEGMENTOS: [string, string][] = [["residencial", "Residencial"], ["comercial", "Comercial"], ["industrial", "Industrial"]];
const ORIGENES: [string, string][] = [
  ["web", "Página web"], ["whatsapp", "WhatsApp"], ["vendedor_externo", "Vendedor externo"], ["referido_cliente", "Referido de cliente"],
  ["base_instalada", "Base instalada"], ["llamada", "Llamada entrante"], ["evento", "Evento / feria"], ["otro", "Otro"],
];

const VENDEDOR: Relacion = { tabla: "vendedores", select: "id,codigo,nombre", etiqueta: "{nombre} ({codigo})", orden: "nombre", filtro: ["activo", true] };
const CLIENTE: Relacion = { tabla: "clientes", select: "id,codigo,nombre", etiqueta: "{nombre} ({codigo})", orden: "nombre" };
const PRODUCTO: Relacion = { tabla: "productos", select: "id,codigo,nombre", etiqueta: "{codigo} · {nombre}", orden: "nombre", filtro: ["activo", true] };

export const FORMULARIOS: Record<string, Formulario> = {
  "comercial/clientes": {
    tabla: "clientes",
    singular: "cliente",
    despues: (id) => `/cliente/?id=${id}`,
    campos: [
      { campo: "nombre", etiqueta: "Nombre o razón social", tipo: "texto", requerido: true, ancho: "completo" },
      { campo: "tipo_persona", etiqueta: "Tipo de persona", tipo: "seleccion", opciones: [["juridica", "Jurídica (empresa)"], ["fisica", "Física (persona)"]], defecto: "juridica" },
      { campo: "rnc_cedula", etiqueta: "RNC / Cédula", tipo: "texto" },
      { campo: "segmento", etiqueta: "Segmento", tipo: "seleccion", opciones: SEGMENTOS, requerido: true, defecto: "residencial" },
      { campo: "sector", etiqueta: "Sector o actividad", tipo: "texto", ayuda: "Ej. salud, hotelería, condominio" },
      { campo: "telefono", etiqueta: "Teléfono", tipo: "telefono" },
      { campo: "email", etiqueta: "Correo", tipo: "email" },
      { campo: "direccion", etiqueta: "Dirección", tipo: "texto", ancho: "completo" },
      { campo: "ciudad", etiqueta: "Ciudad", tipo: "texto", defecto: "Santiago" },
      { campo: "vendedor_id", etiqueta: "Vendedor asignado", tipo: "relacion", relacion: VENDEDOR },
      { campo: "origen", etiqueta: "¿Cómo llegó?", tipo: "seleccion", opciones: ORIGENES },
      { campo: "tipo_ncf", etiqueta: "Comprobante (NCF)", tipo: "seleccion", defecto: "B01", opciones: [["B01", "B01 · Crédito fiscal"], ["B02", "B02 · Consumidor final"], ["B14", "B14 · Régimen especial"], ["B15", "B15 · Gubernamental"], ["E31", "E31 · e-CF crédito fiscal"], ["E32", "E32 · e-CF consumo"]] },
      { campo: "limite_credito", etiqueta: "Límite de crédito", tipo: "dinero", defecto: 0 },
      { campo: "condicion_pago_dias", etiqueta: "Días de crédito", tipo: "numero", defecto: 30 },
      { campo: "estado", etiqueta: "Estado", tipo: "seleccion", opciones: [["activo", "Activo"], ["inactivo", "Inactivo"], ["bloqueado", "Bloqueado"]], defecto: "activo" },
      { campo: "notas", etiqueta: "Notas", tipo: "textarea", ancho: "completo" },
    ],
  },

  "comercial/contactos": {
    tabla: "contactos",
    singular: "contacto",
    despues: () => "",
    campos: [
      { campo: "cliente_id", etiqueta: "Cliente", tipo: "relacion", relacion: CLIENTE, requerido: true },
      { campo: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true },
      { campo: "rol", etiqueta: "Rol", tipo: "texto", ayuda: "Ej. decisión de compra, contacto técnico, pagos" },
      { campo: "telefono", etiqueta: "Teléfono", tipo: "telefono" },
      { campo: "email", etiqueta: "Correo", tipo: "email" },
      { campo: "principal", etiqueta: "Contacto principal", tipo: "booleano", defecto: false },
    ],
  },

  "comercial/oportunidades": {
    tabla: "oportunidades",
    singular: "oportunidad", femenino: true,
    campos: [
      { campo: "titulo", etiqueta: "Oportunidad", tipo: "texto", requerido: true, ancho: "completo", ayuda: "Ej. Ósmosis inversa para el residencial" },
      { campo: "cliente_id", etiqueta: "Cliente", tipo: "relacion", relacion: CLIENTE },
      { campo: "prospecto_id", etiqueta: "o Prospecto", tipo: "relacion", relacion: { tabla: "prospectos", select: "id,codigo,nombre,empresa", etiqueta: "{codigo} · {empresa|nombre}", orden: "fecha" }, ayuda: "Use cliente o prospecto" },
      { campo: "vendedor_id", etiqueta: "Vendedor", tipo: "relacion", relacion: VENDEDOR },
      { campo: "etapa", etiqueta: "Etapa", tipo: "seleccion", defecto: "prospecto", opciones: [["prospecto", "Prospecto"], ["visita_tecnica", "Visita técnica"], ["analisis_agua", "Análisis de agua"], ["cotizacion_enviada", "Cotización enviada"], ["negociacion", "Negociación"], ["ganada", "Ganada"], ["perdida", "Perdida"]] },
      { campo: "valor_estimado", etiqueta: "Valor estimado", tipo: "dinero", defecto: 0 },
      { campo: "probabilidad", etiqueta: "Probabilidad (%)", tipo: "porcentaje" },
      { campo: "fecha_cierre_estimada", etiqueta: "Cierre estimado", tipo: "fecha" },
      { campo: "proxima_accion", etiqueta: "Próxima acción", tipo: "texto", ancho: "completo" },
      { campo: "motivo_perdida", etiqueta: "Motivo de pérdida", tipo: "seleccion", opciones: [["precio", "Precio"], ["competidor", "Competidor"], ["tiempo", "Tiempo"], ["sin_presupuesto", "Sin presupuesto"], ["sin_respuesta", "Sin respuesta"], ["otro", "Otro"]] },
      { campo: "competidor", etiqueta: "Competidor", tipo: "texto" },
    ],
  },

  "comercial/equipos": {
    tabla: "equipos_instalados",
    singular: "equipo instalado",
    campos: [
      { campo: "cliente_id", etiqueta: "Cliente", tipo: "relacion", relacion: CLIENTE, requerido: true },
      { campo: "serie", etiqueta: "Serie", tipo: "texto", requerido: true, ayuda: "Ej. OI-2026-001" },
      { campo: "descripcion", etiqueta: "Equipo", tipo: "texto", requerido: true, ayuda: "Ej. Ósmosis inversa 2,000 GPD" },
      { campo: "producto_id", etiqueta: "Producto del catálogo", tipo: "relacion", relacion: PRODUCTO },
      { campo: "capacidad", etiqueta: "Capacidad", tipo: "texto" },
      { campo: "ubicacion", etiqueta: "Ubicación", tipo: "texto", ayuda: "Ej. cuarto de bombas, cocina" },
      { campo: "fecha_instalacion", etiqueta: "Fecha de instalación", tipo: "fecha" },
      { campo: "garantia_hasta", etiqueta: "Garantía hasta", tipo: "fecha" },
      { campo: "estado", etiqueta: "Estado", tipo: "seleccion", defecto: "operativo", opciones: [["en_instalacion", "En instalación"], ["operativo", "Operativo"], ["fuera_de_servicio", "Fuera de servicio"], ["retirado", "Retirado"]] },
    ],
  },

  "comercial/componentes": {
    tabla: "equipo_componentes",
    singular: "componente",
    campos: [
      { campo: "equipo_id", etiqueta: "Equipo", tipo: "relacion", requerido: true, relacion: { tabla: "equipos_instalados", select: "id,serie,descripcion", etiqueta: "{serie} · {descripcion}", orden: "serie" } },
      { campo: "descripcion", etiqueta: "Componente", tipo: "texto", requerido: true, ayuda: "Ej. Membranas RO, lámpara UV, resina" },
      { campo: "producto_id", etiqueta: "Repuesto del catálogo", tipo: "relacion", relacion: PRODUCTO, ayuda: "Para calcular el valor de la reposición" },
      { campo: "cantidad", etiqueta: "Cantidad", tipo: "numero", defecto: 1 },
      { campo: "frecuencia_meses", etiqueta: "Reemplazo cada (meses)", tipo: "numero", requerido: true },
      { campo: "ultimo_reemplazo", etiqueta: "Último reemplazo", tipo: "fecha", ayuda: "La próxima fecha se calcula sola" },
    ],
  },

  "comisiones/vendedores": {
    tabla: "vendedores",
    singular: "vendedor",
    campos: [
      { campo: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true },
      { campo: "tipo", etiqueta: "Tipo", tipo: "seleccion", requerido: true, defecto: "externo", opciones: [["interno", "Interno (empleado)"], ["externo", "Externo (comisionista)"], ["referidor", "Referidor"]] },
      { campo: "empleado_id", etiqueta: "Empleado (solo internos)", tipo: "relacion", relacion: { tabla: "v_directorio", select: "id,codigo,nombre", etiqueta: "{nombre} ({codigo})", orden: "nombre" }, ayuda: "Los vendedores internos deben estar registrados en Recursos Humanos" },
      { campo: "zona", etiqueta: "Zona", tipo: "texto" },
      { campo: "meta_mensual", etiqueta: "Meta mensual", tipo: "dinero" },
      { campo: "esquema_id", etiqueta: "Esquema de comisión", tipo: "relacion", relacion: { tabla: "esquemas_comision", select: "id,codigo,nombre", etiqueta: "{codigo} · {nombre}", orden: "codigo", filtro: ["activo", true] }, ayuda: "Para externos y referidores" },
      { campo: "cedula_rnc", etiqueta: "Cédula / RNC", tipo: "texto" },
      { campo: "comprobante", etiqueta: "Comprobante", tipo: "seleccion", opciones: [["B01", "B01 · lo emite el vendedor (tiene RNC)"], ["B11", "B11 · lo emite Osmos (sin RNC)"]] },
      { campo: "retencion_isr_pct", etiqueta: "Retención ISR (%)", tipo: "porcentaje", defecto: 10 },
      { campo: "banco", etiqueta: "Banco", tipo: "texto" },
      { campo: "cuenta_pago", etiqueta: "Cuenta para pagos", tipo: "texto" },
      { campo: "acuerdo_firmado_en", etiqueta: "Acuerdo firmado el", tipo: "fecha" },
      { campo: "perfil_id", etiqueta: "Usuario del sistema", tipo: "relacion", relacion: { tabla: "perfiles", select: "id,nombre,email", etiqueta: "{nombre} · {email}", orden: "nombre" }, ayuda: "Si el vendedor entra al CRM" },
      { campo: "activo", etiqueta: "Activo", tipo: "booleano", defecto: true },
    ],
  },

  "comisiones/esquemas": {
    tabla: "esquemas_comision",
    singular: "esquema de comisión",
    campos: [
      { campo: "codigo", etiqueta: "Código", tipo: "texto", requerido: true, ayuda: "Ej. ESQ-08" },
      { campo: "nombre", etiqueta: "Concepto", tipo: "texto", requerido: true },
      { campo: "aplica_a", etiqueta: "Aplica a", tipo: "seleccion", requerido: true, opciones: [["equipos", "Venta de equipos"], ["iguala_nueva", "Iguala nueva"], ["renovacion", "Renovación de iguala"], ["insumos", "Insumos y repuestos"], ["bono_meta", "Bono por meta"], ["externo", "Vendedor externo"], ["referidor", "Referidor"]] },
      { campo: "base", etiqueta: "Base de cálculo", tipo: "seleccion", requerido: true, opciones: [["cobrado_sin_itbis", "Cobrado sin ITBIS"], ["cuota_x3", "Cuota × 3"], ["cuota_x12", "Cuota × 12"], ["ventas_mes", "Ventas del mes"]] },
      { campo: "porcentaje", etiqueta: "Porcentaje", tipo: "porcentaje", requerido: true },
      { campo: "condicion", etiqueta: "Condición", tipo: "texto", ancho: "completo" },
      { campo: "activo", etiqueta: "Activo", tipo: "booleano", defecto: true },
    ],
  },

  "compras/catalogo": {
    tabla: "productos",
    singular: "producto",
    campos: [
      { campo: "codigo", etiqueta: "Código", tipo: "texto", ayuda: "Déjelo vacío para asignarlo automáticamente" },
      { campo: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true },
      { campo: "tipo", etiqueta: "Tipo", tipo: "seleccion", requerido: true, defecto: "insumo", opciones: [["equipo", "Equipo / sistema"], ["insumo", "Insumo"], ["repuesto", "Repuesto"], ["servicio", "Servicio"]] },
      { campo: "categoria", etiqueta: "Categoría", tipo: "texto", ayuda: "Ej. Membranas, Filtros, Químicos y sal" },
      { campo: "unidad", etiqueta: "Unidad", tipo: "texto", defecto: "unidad" },
      { campo: "precio_venta", etiqueta: "Precio de venta (sin ITBIS)", tipo: "dinero", defecto: 0 },
      { campo: "costo_promedio", etiqueta: "Costo", tipo: "dinero", defecto: 0, ayuda: "Se actualiza solo con cada compra recibida" },
      { campo: "aplica_itbis", etiqueta: "Lleva ITBIS", tipo: "booleano", defecto: true },
      { campo: "existencia_minima", etiqueta: "Existencia mínima", tipo: "numero", defecto: 0 },
      { campo: "vida_util_meses", etiqueta: "Vida útil (meses)", tipo: "numero", ayuda: "Para repuestos que se reemplazan periódicamente" },
      { campo: "activo", etiqueta: "Activo", tipo: "booleano", defecto: true },
    ],
  },

  "suplidores/listado": {
    tabla: "suplidores",
    singular: "suplidor",
    campos: [
      { campo: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true },
      { campo: "rnc", etiqueta: "RNC", tipo: "texto" },
      { campo: "categoria", etiqueta: "Categoría", tipo: "texto", ayuda: "Ej. Equipos y membranas" },
      { campo: "condicion_pago_dias", etiqueta: "Días de crédito", tipo: "numero", defecto: 30 },
      { campo: "retencion", etiqueta: "Retención", tipo: "texto", ayuda: "Ej. ISR 10%, ITBIS 30%" },
      { campo: "contacto", etiqueta: "Contacto", tipo: "texto" },
      { campo: "telefono", etiqueta: "Teléfono", tipo: "telefono" },
      { campo: "email", etiqueta: "Correo", tipo: "email" },
      { campo: "banco", etiqueta: "Banco", tipo: "texto" },
      { campo: "cuenta_bancaria", etiqueta: "Cuenta bancaria", tipo: "texto" },
      { campo: "insumo_critico", etiqueta: "Suple insumos críticos", tipo: "booleano", defecto: false },
      { campo: "activo", etiqueta: "Activo", tipo: "booleano", defecto: true },
    ],
  },

  "cobros/ncf": {
    tabla: "secuencias_ncf",
    singular: "secuencia de NCF", femenino: true,
    campos: [
      { campo: "tipo", etiqueta: "Tipo", tipo: "seleccion", requerido: true, opciones: [["B01", "B01 · Crédito fiscal"], ["B02", "B02 · Consumidor final"], ["B04", "B04 · Nota de crédito"], ["B11", "B11 · Comprobante de compras"], ["B14", "B14 · Régimen especial"], ["B15", "B15 · Gubernamental"], ["E31", "E31"], ["E32", "E32"], ["E33", "E33"], ["E34", "E34"], ["E41", "E41"]] },
      { campo: "prefijo", etiqueta: "Prefijo", tipo: "texto", requerido: true, ayuda: "Normalmente igual al tipo, ej. B01" },
      { campo: "desde", etiqueta: "Desde", tipo: "numero", requerido: true },
      { campo: "hasta", etiqueta: "Hasta", tipo: "numero", requerido: true },
      { campo: "actual", etiqueta: "Próximo a usar", tipo: "numero", requerido: true, ayuda: "Al registrar un rango nuevo, igual a “Desde”" },
      { campo: "vence", etiqueta: "Vence", tipo: "fecha" },
      { campo: "activa", etiqueta: "Activa", tipo: "booleano", defecto: true },
    ],
  },

  "contabilidad/bancos": {
    tabla: "cuentas_bancarias",
    singular: "cuenta bancaria", femenino: true,
    campos: [
      { campo: "banco", etiqueta: "Banco", tipo: "texto", requerido: true },
      { campo: "numero", etiqueta: "Número de cuenta", tipo: "texto", requerido: true },
      { campo: "tipo", etiqueta: "Tipo", tipo: "seleccion", defecto: "corriente", opciones: [["corriente", "Corriente"], ["ahorro", "Ahorro"]] },
      { campo: "moneda", etiqueta: "Moneda", tipo: "seleccion", defecto: "DOP", opciones: [["DOP", "Pesos (DOP)"], ["USD", "Dólares (USD)"], ["EUR", "Euros (EUR)"]] },
      { campo: "cuenta_contable_id", etiqueta: "Cuenta contable", tipo: "relacion", relacion: { tabla: "cuentas_contables", select: "id,codigo,nombre", etiqueta: "{codigo} · {nombre}", orden: "codigo", filtro: ["acepta_movimientos", true] } },
      { campo: "activa", etiqueta: "Activa", tipo: "booleano", defecto: true },
    ],
  },

  "rrhh/empleados": {
    tabla: "empleados",
    singular: "colaborador",
    campos: [
      { campo: "nombre", etiqueta: "Nombre completo", tipo: "texto", requerido: true },
      { campo: "cedula", etiqueta: "Cédula", tipo: "texto" },
      { campo: "cargo", etiqueta: "Cargo", tipo: "texto" },
      { campo: "departamento_id", etiqueta: "Departamento", tipo: "relacion", relacion: { tabla: "departamentos", select: "id,nombre", etiqueta: "{nombre}", orden: "nombre" } },
      { campo: "fecha_ingreso", etiqueta: "Fecha de ingreso", tipo: "fecha" },
      { campo: "periodo_prueba_hasta", etiqueta: "Período de prueba hasta", tipo: "fecha" },
      { campo: "tipo_contrato", etiqueta: "Contrato", tipo: "seleccion", defecto: "indefinido", opciones: [["indefinido", "Indefinido"], ["temporal", "Temporal"], ["prueba", "Prueba"]] },
      { campo: "salario_mensual", etiqueta: "Salario mensual", tipo: "dinero", defecto: 0 },
      { campo: "banco", etiqueta: "Banco", tipo: "texto" },
      { campo: "cuenta_bancaria", etiqueta: "Cuenta bancaria", tipo: "texto" },
      { campo: "afp", etiqueta: "AFP", tipo: "texto" },
      { campo: "ars", etiqueta: "ARS", tipo: "texto" },
      { campo: "telefono", etiqueta: "Teléfono", tipo: "telefono" },
      { campo: "email", etiqueta: "Correo", tipo: "email" },
      { campo: "perfil_id", etiqueta: "Usuario del sistema", tipo: "relacion", relacion: { tabla: "perfiles", select: "id,nombre,email", etiqueta: "{nombre} · {email}", orden: "nombre" } },
      { campo: "estado", etiqueta: "Estado", tipo: "seleccion", defecto: "activo", opciones: [["activo", "Activo"], ["vacaciones", "Vacaciones"], ["licencia", "Licencia"], ["inactivo", "Inactivo"]] },
    ],
  },
};

export function nuevoTexto(f: Formulario) {
  return `${f.femenino ? "Nueva" : "Nuevo"} ${f.singular}`;
}

export function creadoTexto(f: Formulario) {
  const t = `${f.singular} ${f.femenino ? "creada" : "creado"}.`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function buscarFormulario(modulo: string, seccion: string) {
  return FORMULARIOS[`${modulo}/${seccion}`];
}
