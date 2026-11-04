// Mapa de módulos y funciones del sistema. Cada sección se muestra como una
// tabla de la base de datos; algunas tienen pantallas propias (ver `ruta`).

export type TipoColumna = "texto" | "codigo" | "dinero" | "fecha" | "mes" | "numero" | "pct" | "estado" | "etiqueta" | "enlace";

export type Columna = {
  campo: string; // admite rutas a relaciones: "clientes.nombre"
  etiqueta: string;
  tipo?: TipoColumna;
  enlace?: string; // plantilla, ej. "/cliente/?id={id}"
};

export type Accion = {
  etiqueta: string;
  rpc: string;
  parametros?: "periodo" | "ninguno";
};

export type Seccion = {
  slug: string;
  nombre: string;
  tabla?: string;
  select?: string;
  orden?: { campo: string; asc?: boolean };
  columnas?: Columna[];
  acciones?: Accion[];
  ruta?: string; // pantalla propia
  descripcion?: string;
  nuevo?: { etiqueta: string; href: string };
};

export type Modulo = {
  slug: string;
  nombre: string;
  grupo: "Operaciones" | "Finanzas" | "Personas";
  descripcion: string;
  icono: string;
  secciones: Seccion[];
};

export const MODULOS: Modulo[] = [
  {
    slug: "comercial",
    nombre: "Comercial",
    grupo: "Operaciones",
    icono: "comercial",
    descripcion: "Prospectos, oportunidades, clientes, base instalada, cotizaciones y pedidos",
    secciones: [
      { slug: "prospectos", nombre: "Prospectos", ruta: "/prospectos/" },
      {
        slug: "origen", nombre: "Origen y conversión", tabla: "v_conversion_origen", select: "*",
        orden: { campo: "conversion_pct", asc: false },
        descripcion: "Prospectos de los últimos 90 días por origen.",
        columnas: [
          { campo: "origen", etiqueta: "Origen", tipo: "etiqueta" },
          { campo: "prospectos", etiqueta: "Prospectos", tipo: "numero" },
          { campo: "calificados", etiqueta: "Calificados", tipo: "numero" },
          { campo: "convertidos", etiqueta: "Convertidos", tipo: "numero" },
          { campo: "conversion_pct", etiqueta: "Conversión", tipo: "pct" },
          { campo: "ventas_generadas", etiqueta: "Ventas generadas", tipo: "dinero" },
        ],
      },
      {
        slug: "oportunidades", nombre: "Oportunidades", tabla: "oportunidades",
        select: "id,codigo,titulo,etapa,valor_estimado,probabilidad,fecha_cierre_estimada,proxima_accion,clientes(nombre),vendedores(nombre)",
        orden: { campo: "created_at", asc: false },
        columnas: [
          { campo: "codigo", etiqueta: "Código", tipo: "codigo" },
          { campo: "titulo", etiqueta: "Oportunidad" },
          { campo: "clientes.nombre", etiqueta: "Cliente" },
          { campo: "vendedores.nombre", etiqueta: "Vendedor" },
          { campo: "valor_estimado", etiqueta: "Valor estimado", tipo: "dinero" },
          { campo: "probabilidad", etiqueta: "Probabilidad", tipo: "pct" },
          { campo: "fecha_cierre_estimada", etiqueta: "Cierre estimado", tipo: "fecha" },
          { campo: "etapa", etiqueta: "Etapa", tipo: "estado" },
        ],
      },
      {
        slug: "clientes", nombre: "Clientes", tabla: "clientes",
        select: "id,codigo,nombre,rnc_cedula,segmento,ciudad,limite_credito,origen,estado,vendedores(nombre)",
        orden: { campo: "nombre", asc: true },
        columnas: [
          { campo: "codigo", etiqueta: "Código", tipo: "enlace", enlace: "/cliente/?id={id}" },
          { campo: "nombre", etiqueta: "Cliente" },
          { campo: "rnc_cedula", etiqueta: "RNC / Cédula" },
          { campo: "segmento", etiqueta: "Segmento", tipo: "etiqueta" },
          { campo: "ciudad", etiqueta: "Ciudad" },
          { campo: "vendedores.nombre", etiqueta: "Vendedor" },
          { campo: "origen", etiqueta: "Origen", tipo: "etiqueta" },
          { campo: "limite_credito", etiqueta: "Límite de crédito", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "base", nombre: "Base instalada", tabla: "v_base_instalada", select: "*",
        orden: { campo: "proximo_reemplazo", asc: true },
        descripcion: "Equipos instalados y próximos reemplazos de componentes.",
        columnas: [
          { campo: "serie", etiqueta: "Serie", tipo: "codigo" },
          { campo: "cliente", etiqueta: "Cliente", tipo: "enlace", enlace: "/cliente/?id={cliente_id}" },
          { campo: "equipo", etiqueta: "Equipo" },
          { campo: "componente", etiqueta: "Componente" },
          { campo: "garantia_hasta", etiqueta: "Garantía hasta", tipo: "fecha" },
          { campo: "proximo_reemplazo", etiqueta: "Próximo reemplazo", tipo: "fecha" },
          { campo: "venta_estimada", etiqueta: "Venta estimada", tipo: "dinero" },
          { campo: "estado_reposicion", etiqueta: "Estado", tipo: "estado" },
        ],
        acciones: [{ etiqueta: "Crear prospectos de reposición", rpc: "generar_prospectos_reposicion", parametros: "ninguno" }],
      },
      {
        slug: "equipos", nombre: "Equipos instalados", tabla: "equipos_instalados",
        select: "id,serie,descripcion,capacidad,fecha_instalacion,garantia_hasta,estado,cliente_id,clientes(nombre)",
        orden: { campo: "serie", asc: true },
        descripcion: "Registre cada sistema instalado; sus componentes alimentan las alertas de reposición.",
        columnas: [
          { campo: "serie", etiqueta: "Serie", tipo: "codigo" },
          { campo: "clientes.nombre", etiqueta: "Cliente", tipo: "enlace", enlace: "/cliente/?id={cliente_id}" },
          { campo: "descripcion", etiqueta: "Equipo" },
          { campo: "capacidad", etiqueta: "Capacidad" },
          { campo: "fecha_instalacion", etiqueta: "Instalado", tipo: "fecha" },
          { campo: "garantia_hasta", etiqueta: "Garantía hasta", tipo: "fecha" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "componentes", nombre: "Componentes y reemplazos", tabla: "equipo_componentes",
        select: "id,descripcion,cantidad,frecuencia_meses,ultimo_reemplazo,proximo_reemplazo,equipos_instalados(serie,descripcion,clientes(nombre))",
        orden: { campo: "proximo_reemplazo", asc: true },
        descripcion: "Membranas, lámparas, resinas y cartuchos de cada equipo, con su frecuencia de reemplazo.",
        columnas: [
          { campo: "equipos_instalados.serie", etiqueta: "Equipo", tipo: "codigo" },
          { campo: "equipos_instalados.clientes.nombre", etiqueta: "Cliente" },
          { campo: "descripcion", etiqueta: "Componente" },
          { campo: "cantidad", etiqueta: "Cantidad", tipo: "numero" },
          { campo: "frecuencia_meses", etiqueta: "Cada (meses)", tipo: "numero" },
          { campo: "ultimo_reemplazo", etiqueta: "Último reemplazo", tipo: "fecha" },
          { campo: "proximo_reemplazo", etiqueta: "Próximo", tipo: "fecha" },
        ],
      },
      {
        slug: "cotizaciones", nombre: "Cotizaciones", tabla: "cotizaciones",
        nuevo: { etiqueta: "Nueva cotización", href: "/cotizacion/nueva/" },
        select: "id,numero,fecha,vence,total,margen_pct,estado,clientes(nombre),vendedores(nombre)",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "numero", etiqueta: "Cotización", tipo: "enlace", enlace: "/cotizacion/?id={id}" },
          { campo: "clientes.nombre", etiqueta: "Cliente" },
          { campo: "vendedores.nombre", etiqueta: "Vendedor" },
          { campo: "fecha", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "vence", etiqueta: "Vence", tipo: "fecha" },
          { campo: "margen_pct", etiqueta: "Margen", tipo: "pct" },
          { campo: "total", etiqueta: "Total", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "pedidos", nombre: "Pedidos de venta", tabla: "pedidos_venta",
        select: "id,numero,fecha,fecha_entrega,total,estado,cotizacion_id,clientes(nombre),cotizaciones(numero)",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "numero", etiqueta: "Pedido (conduce)", tipo: "enlace", enlace: "/imprimir/?doc=conduce&id={id}" },
          { campo: "cotizaciones.numero", etiqueta: "Cotización", tipo: "enlace", enlace: "/cotizacion/?id={cotizacion_id}" },
          { campo: "clientes.nombre", etiqueta: "Cliente" },
          { campo: "fecha", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "fecha_entrega", etiqueta: "Entrega", tipo: "fecha" },
          { campo: "total", etiqueta: "Monto", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
    ],
  },
  {
    slug: "igualas",
    nombre: "Igualas",
    grupo: "Operaciones",
    icono: "igualas",
    descripcion: "Contratos de mantenimiento, facturación recurrente, visitas y órdenes de servicio",
    secciones: [
      {
        slug: "contratos", nombre: "Contratos de iguala", tabla: "igualas",
        nuevo: { etiqueta: "Nueva iguala", href: "/iguala/nueva/" },
        select: "id,codigo,descripcion,frecuencia_visita,cuota_mensual,fecha_inicio,fecha_fin,estado,cliente_id,clientes(nombre),vendedores(nombre)",
        orden: { campo: "codigo", asc: false },
        columnas: [
          { campo: "codigo", etiqueta: "Iguala", tipo: "enlace", enlace: "/iguala/?id={id}" },
          { campo: "clientes.nombre", etiqueta: "Cliente", tipo: "enlace", enlace: "/cliente/?id={cliente_id}" },
          { campo: "descripcion", etiqueta: "Sistema" },
          { campo: "frecuencia_visita", etiqueta: "Visitas", tipo: "etiqueta" },
          { campo: "cuota_mensual", etiqueta: "Cuota mensual", tipo: "dinero" },
          { campo: "vendedores.nombre", etiqueta: "Vendedor" },
          { campo: "fecha_fin", etiqueta: "Vence", tipo: "fecha" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "facturacion", nombre: "Facturación recurrente", tabla: "facturacion_corridas", select: "*",
        orden: { campo: "periodo", asc: false },
        columnas: [
          { campo: "codigo", etiqueta: "Corrida", tipo: "codigo" },
          { campo: "periodo", etiqueta: "Período", tipo: "mes" },
          { campo: "facturas_generadas", etiqueta: "Facturas generadas", tipo: "numero" },
          { campo: "subtotal", etiqueta: "Subtotal", tipo: "dinero" },
          { campo: "itbis", etiqueta: "ITBIS", tipo: "dinero" },
          { campo: "total", etiqueta: "Total", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
        acciones: [{ etiqueta: "Generar facturación del mes", rpc: "generar_facturacion_igualas", parametros: "periodo" }],
      },
      {
        slug: "visitas", nombre: "Programación de visitas", tabla: "visitas",
        select: "id,fecha_programada,servicio,ruta,estado,clientes(nombre),igualas(codigo)",
        orden: { campo: "fecha_programada", asc: true },
        columnas: [
          { campo: "fecha_programada", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "igualas.codigo", etiqueta: "Iguala", tipo: "codigo" },
          { campo: "clientes.nombre", etiqueta: "Cliente" },
          { campo: "servicio", etiqueta: "Servicio" },
          { campo: "ruta", etiqueta: "Ruta" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
        acciones: [{ etiqueta: "Programar visitas del mes", rpc: "programar_visitas", parametros: "periodo" }],
      },
      {
        slug: "ordenes", nombre: "Órdenes de servicio", tabla: "ordenes_servicio",
        nuevo: { etiqueta: "Nueva orden de servicio", href: "/orden/nueva/" },
        select: "id,numero,fecha,tipo,trabajo_realizado,estado,clientes(nombre)",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "numero", etiqueta: "Orden", tipo: "enlace", enlace: "/orden/?id={id}" },
          { campo: "fecha", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "clientes.nombre", etiqueta: "Cliente" },
          { campo: "tipo", etiqueta: "Tipo", tipo: "etiqueta" },
          { campo: "trabajo_realizado", etiqueta: "Trabajo realizado" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "rentabilidad", nombre: "Rentabilidad por iguala", tabla: "v_rentabilidad_igualas", select: "*",
        orden: { campo: "margen_antes_mano_obra", asc: true },
        descripcion: "Cuota del mes frente al costo de los insumos incluidos.",
        columnas: [
          { campo: "codigo", etiqueta: "Iguala", tipo: "codigo" },
          { campo: "cliente", etiqueta: "Cliente" },
          { campo: "cuota_mensual", etiqueta: "Cuota mensual", tipo: "dinero" },
          { campo: "costo_insumos", etiqueta: "Insumos del mes", tipo: "dinero" },
          { campo: "margen_antes_mano_obra", etiqueta: "Margen antes de mano de obra", tipo: "dinero" },
        ],
      },
    ],
  },
  {
    slug: "comisiones",
    nombre: "Vendedores y comisiones",
    grupo: "Operaciones",
    icono: "comisiones",
    descripcion: "Vendedores internos y externos, esquemas, cálculo y liquidación de comisiones",
    secciones: [
      {
        slug: "vendedores", nombre: "Vendedores", tabla: "vendedores", select: "*",
        orden: { campo: "codigo", asc: true },
        columnas: [
          { campo: "codigo", etiqueta: "Código", tipo: "codigo" },
          { campo: "nombre", etiqueta: "Vendedor" },
          { campo: "tipo", etiqueta: "Tipo", tipo: "etiqueta" },
          { campo: "zona", etiqueta: "Zona" },
          { campo: "meta_mensual", etiqueta: "Meta mensual", tipo: "dinero" },
          { campo: "comprobante", etiqueta: "Comprobante" },
          { campo: "acuerdo_firmado_en", etiqueta: "Acuerdo firmado", tipo: "fecha" },
          { campo: "activo", etiqueta: "Activo", tipo: "estado" },
        ],
      },
      {
        slug: "esquemas", nombre: "Esquemas de comisión", tabla: "esquemas_comision", select: "*",
        orden: { campo: "codigo", asc: true },
        columnas: [
          { campo: "codigo", etiqueta: "Esquema", tipo: "codigo" },
          { campo: "nombre", etiqueta: "Concepto" },
          { campo: "aplica_a", etiqueta: "Aplica a", tipo: "etiqueta" },
          { campo: "base", etiqueta: "Base de cálculo", tipo: "etiqueta" },
          { campo: "porcentaje", etiqueta: "Porcentaje", tipo: "pct" },
          { campo: "condicion", etiqueta: "Condición" },
          { campo: "activo", etiqueta: "Activo", tipo: "estado" },
        ],
      },
      {
        slug: "calculo", nombre: "Cálculo del período", tabla: "comisiones",
        select: "id,periodo,nota,base,porcentaje,monto,retencion_isr,estado,vendedores(nombre,tipo)",
        orden: { campo: "periodo", asc: false },
        columnas: [
          { campo: "periodo", etiqueta: "Período", tipo: "mes" },
          { campo: "vendedores.nombre", etiqueta: "Vendedor" },
          { campo: "vendedores.tipo", etiqueta: "Tipo", tipo: "etiqueta" },
          { campo: "nota", etiqueta: "Concepto" },
          { campo: "base", etiqueta: "Base", tipo: "dinero" },
          { campo: "porcentaje", etiqueta: "%", tipo: "pct" },
          { campo: "monto", etiqueta: "Comisión", tipo: "dinero" },
          { campo: "retencion_isr", etiqueta: "Retención ISR", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
        acciones: [{ etiqueta: "Calcular comisiones del mes", rpc: "calcular_comisiones", parametros: "periodo" }],
      },
      {
        slug: "liquidaciones", nombre: "Liquidación y pago", tabla: "liquidaciones_comision", select: "*",
        orden: { campo: "periodo", asc: false },
        columnas: [
          { campo: "codigo", etiqueta: "Liquidación", tipo: "codigo" },
          { campo: "periodo", etiqueta: "Período", tipo: "mes" },
          { campo: "tipo", etiqueta: "Tipo", tipo: "etiqueta" },
          { campo: "total_bruto", etiqueta: "Bruto", tipo: "dinero" },
          { campo: "retencion_isr", etiqueta: "Retención ISR", tipo: "dinero" },
          { campo: "neto", etiqueta: "Neto", tipo: "dinero" },
          { campo: "forma_pago", etiqueta: "Forma de pago", tipo: "etiqueta" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
    ],
  },
  {
    slug: "compras",
    nombre: "Compras e inventario",
    grupo: "Operaciones",
    icono: "compras",
    descripcion: "Solicitudes, órdenes de compra, recepción de mercancía e inventario de insumos",
    secciones: [
      {
        slug: "catalogo", nombre: "Catálogo de productos", tabla: "productos", select: "*",
        orden: { campo: "nombre", asc: true },
        descripcion: "Equipos, insumos, repuestos y servicios con su precio y costo. El cotizador usa este catálogo.",
        columnas: [
          { campo: "codigo", etiqueta: "Código", tipo: "codigo" },
          { campo: "nombre", etiqueta: "Nombre" },
          { campo: "tipo", etiqueta: "Tipo", tipo: "etiqueta" },
          { campo: "categoria", etiqueta: "Categoría" },
          { campo: "precio_venta", etiqueta: "Precio", tipo: "dinero" },
          { campo: "costo_promedio", etiqueta: "Costo", tipo: "dinero" },
          { campo: "existencia_minima", etiqueta: "Mínimo", tipo: "numero" },
          { campo: "activo", etiqueta: "Activo", tipo: "estado" },
        ],
      },
      {
        slug: "inventario", nombre: "Inventario de insumos", tabla: "v_inventario", select: "*",
        orden: { campo: "nombre", asc: true },
        columnas: [
          { campo: "codigo", etiqueta: "Código", tipo: "codigo" },
          { campo: "nombre", etiqueta: "Artículo" },
          { campo: "categoria", etiqueta: "Categoría" },
          { campo: "existencia", etiqueta: "Existencia", tipo: "numero" },
          { campo: "existencia_minima", etiqueta: "Mínimo", tipo: "numero" },
          { campo: "costo_promedio", etiqueta: "Costo promedio", tipo: "dinero" },
          { campo: "valor", etiqueta: "Valor", tipo: "dinero" },
          { campo: "bajo_minimo", etiqueta: "Bajo mínimo", tipo: "etiqueta" },
        ],
      },
      {
        slug: "solicitudes", nombre: "Solicitudes de compra", tabla: "solicitudes_compra",
        select: "id,numero,fecha,descripcion,cantidad,motivo,estado,productos(nombre)",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "numero", etiqueta: "Solicitud", tipo: "codigo" },
          { campo: "fecha", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "productos.nombre", etiqueta: "Artículo" },
          { campo: "cantidad", etiqueta: "Cantidad", tipo: "numero" },
          { campo: "motivo", etiqueta: "Motivo" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "ordenes", nombre: "Órdenes de compra", tabla: "ordenes_compra",
        select: "id,numero,fecha,centro_costo,total,estado,suplidores(nombre)",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "numero", etiqueta: "Orden", tipo: "codigo" },
          { campo: "suplidores.nombre", etiqueta: "Suplidor" },
          { campo: "fecha", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "centro_costo", etiqueta: "Centro de costo" },
          { campo: "total", etiqueta: "Monto", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "recepciones", nombre: "Recepción de mercancía", tabla: "recepciones",
        select: "id,numero,fecha,estado,notas,ordenes_compra(numero)",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "numero", etiqueta: "Recepción", tipo: "codigo" },
          { campo: "fecha", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "ordenes_compra.numero", etiqueta: "Orden" },
          { campo: "notas", etiqueta: "Notas" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "movimientos", nombre: "Movimientos y consumos", tabla: "movimientos_inventario",
        select: "id,fecha,tipo,cantidad,costo_unitario,documento_tipo,nota,productos(nombre)",
        orden: { campo: "created_at", asc: false },
        columnas: [
          { campo: "fecha", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "tipo", etiqueta: "Tipo", tipo: "etiqueta" },
          { campo: "productos.nombre", etiqueta: "Artículo" },
          { campo: "cantidad", etiqueta: "Cantidad", tipo: "numero" },
          { campo: "costo_unitario", etiqueta: "Costo unitario", tipo: "dinero" },
          { campo: "documento_tipo", etiqueta: "Documento", tipo: "etiqueta" },
          { campo: "nota", etiqueta: "Nota" },
        ],
      },
    ],
  },
  {
    slug: "suplidores",
    nombre: "Suplidores",
    grupo: "Operaciones",
    icono: "suplidores",
    descripcion: "Suplidores, listas de precios y evaluación de desempeño",
    secciones: [
      {
        slug: "listado", nombre: "Suplidores", tabla: "suplidores", select: "*",
        orden: { campo: "nombre", asc: true },
        columnas: [
          { campo: "codigo", etiqueta: "Código", tipo: "codigo" },
          { campo: "nombre", etiqueta: "Suplidor" },
          { campo: "rnc", etiqueta: "RNC" },
          { campo: "categoria", etiqueta: "Categoría" },
          { campo: "condicion_pago_dias", etiqueta: "Días de crédito", tipo: "numero" },
          { campo: "retencion", etiqueta: "Retención" },
          { campo: "activo", etiqueta: "Activo", tipo: "estado" },
        ],
      },
      {
        slug: "precios", nombre: "Listas de precios", tabla: "precios_suplidor",
        select: "id,precio,precio_anterior,actualizado_en,productos(nombre),suplidores(nombre)",
        orden: { campo: "actualizado_en", asc: true },
        columnas: [
          { campo: "productos.nombre", etiqueta: "Artículo" },
          { campo: "suplidores.nombre", etiqueta: "Suplidor" },
          { campo: "precio", etiqueta: "Precio actual", tipo: "dinero" },
          { campo: "precio_anterior", etiqueta: "Precio anterior", tipo: "dinero" },
          { campo: "actualizado_en", etiqueta: "Actualizado", tipo: "fecha" },
        ],
      },
      {
        slug: "evaluacion", nombre: "Evaluación de desempeño", tabla: "evaluaciones_suplidor",
        select: "id,periodo,entregas_a_tiempo,calidad,precio,servicio,calificacion,suplidores(nombre)",
        orden: { campo: "periodo", asc: false },
        columnas: [
          { campo: "suplidores.nombre", etiqueta: "Suplidor" },
          { campo: "periodo", etiqueta: "Período", tipo: "mes" },
          { campo: "entregas_a_tiempo", etiqueta: "Entregas a tiempo", tipo: "pct" },
          { campo: "calidad", etiqueta: "Calidad", tipo: "numero" },
          { campo: "precio", etiqueta: "Precio", tipo: "numero" },
          { campo: "servicio", etiqueta: "Servicio", tipo: "numero" },
          { campo: "calificacion", etiqueta: "Calificación", tipo: "numero" },
        ],
      },
    ],
  },
  {
    slug: "cobros",
    nombre: "Cobros",
    grupo: "Finanzas",
    icono: "cobros",
    descripcion: "Facturas, antigüedad de saldos, recibos, notas de crédito y gestión de cobranza",
    secciones: [
      {
        slug: "facturas", nombre: "Facturas por cobrar", tabla: "facturas",
        select: "id,numero,ncf,fecha,vence,total,saldo,estado,origen,cliente_id,clientes(nombre)",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "numero", etiqueta: "Factura", tipo: "enlace", enlace: "/imprimir/?doc=factura&id={id}" },
          { campo: "ncf", etiqueta: "NCF" },
          { campo: "clientes.nombre", etiqueta: "Cliente", tipo: "enlace", enlace: "/cliente/?id={cliente_id}" },
          { campo: "origen", etiqueta: "Origen", tipo: "etiqueta" },
          { campo: "fecha", etiqueta: "Emisión", tipo: "fecha" },
          { campo: "vence", etiqueta: "Vencimiento", tipo: "fecha" },
          { campo: "total", etiqueta: "Monto", tipo: "dinero" },
          { campo: "saldo", etiqueta: "Saldo", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "antiguedad", nombre: "Antigüedad de saldos", tabla: "v_antiguedad_saldos", select: "*",
        orden: { campo: "total", asc: false },
        columnas: [
          { campo: "cliente", etiqueta: "Cliente", tipo: "enlace", enlace: "/cliente/?id={cliente_id}" },
          { campo: "corriente", etiqueta: "Corriente", tipo: "dinero" },
          { campo: "d1_30", etiqueta: "1 – 30", tipo: "dinero" },
          { campo: "d31_60", etiqueta: "31 – 60", tipo: "dinero" },
          { campo: "d61_90", etiqueta: "61 – 90", tipo: "dinero" },
          { campo: "mas_90", etiqueta: "Más de 90", tipo: "dinero" },
          { campo: "total", etiqueta: "Total", tipo: "dinero" },
        ],
      },
      {
        slug: "recibos", nombre: "Recibos de ingreso", tabla: "recibos",
        select: "id,numero,fecha,forma_pago,referencia,monto,aplicado,estado,clientes(nombre)",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "numero", etiqueta: "Recibo", tipo: "enlace", enlace: "/imprimir/?doc=recibo&id={id}" },
          { campo: "fecha", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "clientes.nombre", etiqueta: "Cliente" },
          { campo: "forma_pago", etiqueta: "Forma de pago", tipo: "etiqueta" },
          { campo: "referencia", etiqueta: "Referencia" },
          { campo: "monto", etiqueta: "Monto", tipo: "dinero" },
          { campo: "aplicado", etiqueta: "Aplicado", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "notas", nombre: "Notas de crédito", tabla: "notas_credito",
        select: "id,numero,ncf,fecha,motivo,monto,estado,clientes(nombre),facturas(numero)",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "numero", etiqueta: "Nota", tipo: "codigo" },
          { campo: "ncf", etiqueta: "NCF" },
          { campo: "clientes.nombre", etiqueta: "Cliente" },
          { campo: "facturas.numero", etiqueta: "Factura afectada" },
          { campo: "motivo", etiqueta: "Motivo" },
          { campo: "monto", etiqueta: "Monto", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "gestion", nombre: "Gestión de cobranza", tabla: "gestiones_cobro",
        select: "id,fecha,contacto,medio,resultado,compromiso_fecha,compromiso_monto,estado,clientes(nombre)",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "clientes.nombre", etiqueta: "Cliente" },
          { campo: "fecha", etiqueta: "Gestión", tipo: "fecha" },
          { campo: "medio", etiqueta: "Medio", tipo: "etiqueta" },
          { campo: "resultado", etiqueta: "Resultado" },
          { campo: "compromiso_fecha", etiqueta: "Compromiso", tipo: "fecha" },
          { campo: "compromiso_monto", etiqueta: "Monto comprometido", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "ncf", nombre: "Secuencias NCF", tabla: "secuencias_ncf", select: "*",
        orden: { campo: "tipo", asc: true },
        columnas: [
          { campo: "tipo", etiqueta: "Tipo" },
          { campo: "prefijo", etiqueta: "Prefijo" },
          { campo: "desde", etiqueta: "Desde", tipo: "numero" },
          { campo: "hasta", etiqueta: "Hasta", tipo: "numero" },
          { campo: "actual", etiqueta: "Próximo", tipo: "numero" },
          { campo: "vence", etiqueta: "Vence", tipo: "fecha" },
          { campo: "activa", etiqueta: "Activa", tipo: "estado" },
        ],
      },
    ],
  },
  {
    slug: "pagos",
    nombre: "Pagos",
    grupo: "Finanzas",
    icono: "pagos",
    descripcion: "Cuentas por pagar a suplidores y vendedores externos, pagos y anticipos",
    secciones: [
      {
        slug: "facturas", nombre: "Cuentas por pagar", tabla: "facturas_suplidor",
        select: "id,numero,ncf,tipo_ncf,concepto,fecha,vence,subtotal,itbis,retencion_isr,total,saldo,estado,suplidores(nombre),vendedores(nombre)",
        orden: { campo: "vence", asc: true },
        columnas: [
          { campo: "numero", etiqueta: "Documento", tipo: "codigo" },
          { campo: "ncf", etiqueta: "NCF" },
          { campo: "suplidores.nombre", etiqueta: "Suplidor" },
          { campo: "vendedores.nombre", etiqueta: "Vendedor externo" },
          { campo: "concepto", etiqueta: "Concepto" },
          { campo: "vence", etiqueta: "Vence", tipo: "fecha" },
          { campo: "retencion_isr", etiqueta: "Retención ISR", tipo: "dinero" },
          { campo: "saldo", etiqueta: "Saldo", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "pagos", nombre: "Programación y pagos emitidos", tabla: "pagos",
        select: "id,numero,fecha,metodo,referencia,monto,estado,suplidores(nombre),vendedores(nombre)",
        orden: { campo: "fecha", asc: true },
        columnas: [
          { campo: "numero", etiqueta: "Pago", tipo: "codigo" },
          { campo: "fecha", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "suplidores.nombre", etiqueta: "Suplidor" },
          { campo: "vendedores.nombre", etiqueta: "Vendedor externo" },
          { campo: "metodo", etiqueta: "Método", tipo: "etiqueta" },
          { campo: "referencia", etiqueta: "Referencia" },
          { campo: "monto", etiqueta: "Monto", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "anticipos", nombre: "Anticipos a suplidores", tabla: "anticipos_suplidor",
        select: "id,numero,fecha,monto,aplicado,estado,suplidores(nombre),ordenes_compra(numero)",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "numero", etiqueta: "Anticipo", tipo: "codigo" },
          { campo: "fecha", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "suplidores.nombre", etiqueta: "Suplidor" },
          { campo: "ordenes_compra.numero", etiqueta: "Orden de compra" },
          { campo: "monto", etiqueta: "Monto", tipo: "dinero" },
          { campo: "aplicado", etiqueta: "Aplicado", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
    ],
  },
  {
    slug: "contabilidad",
    nombre: "Contabilidad",
    grupo: "Finanzas",
    icono: "contabilidad",
    descripcion: "Asientos, catálogo de cuentas, conciliación bancaria, impuestos y cierre",
    secciones: [
      {
        slug: "asientos", nombre: "Asientos de diario", tabla: "asientos", select: "*",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "numero", etiqueta: "Asiento", tipo: "codigo" },
          { campo: "fecha", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "tipo", etiqueta: "Tipo", tipo: "etiqueta" },
          { campo: "descripcion", etiqueta: "Descripción" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "catalogo", nombre: "Catálogo de cuentas", tabla: "cuentas_contables", select: "*",
        orden: { campo: "codigo", asc: true },
        columnas: [
          { campo: "codigo", etiqueta: "Cuenta", tipo: "codigo" },
          { campo: "nombre", etiqueta: "Nombre" },
          { campo: "tipo", etiqueta: "Tipo", tipo: "etiqueta" },
          { campo: "naturaleza", etiqueta: "Naturaleza", tipo: "etiqueta" },
          { campo: "nivel", etiqueta: "Nivel", tipo: "numero" },
          { campo: "acepta_movimientos", etiqueta: "Acepta movimientos", tipo: "etiqueta" },
        ],
      },
      {
        slug: "bancos", nombre: "Cuentas bancarias", tabla: "cuentas_bancarias", select: "*",
        orden: { campo: "banco", asc: true },
        columnas: [
          { campo: "banco", etiqueta: "Banco" },
          { campo: "numero", etiqueta: "Número" },
          { campo: "tipo", etiqueta: "Tipo", tipo: "etiqueta" },
          { campo: "moneda", etiqueta: "Moneda" },
          { campo: "activa", etiqueta: "Activa", tipo: "estado" },
        ],
      },
      {
        slug: "conciliacion", nombre: "Conciliación bancaria", tabla: "conciliaciones",
        select: "id,periodo,saldo_banco,saldo_libros,depositos_transito,cheques_circulacion,diferencia,estado,cuentas_bancarias(banco,numero)",
        orden: { campo: "periodo", asc: false },
        columnas: [
          { campo: "cuentas_bancarias.banco", etiqueta: "Banco" },
          { campo: "periodo", etiqueta: "Período", tipo: "mes" },
          { campo: "saldo_banco", etiqueta: "Saldo banco", tipo: "dinero" },
          { campo: "saldo_libros", etiqueta: "Saldo libros", tipo: "dinero" },
          { campo: "depositos_transito", etiqueta: "Depósitos en tránsito", tipo: "dinero" },
          { campo: "cheques_circulacion", etiqueta: "Cheques en circulación", tipo: "dinero" },
          { campo: "diferencia", etiqueta: "Diferencia", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "impuestos", nombre: "Impuestos DGII", tabla: "declaraciones_fiscales", select: "*",
        orden: { campo: "fecha_limite", asc: true },
        columnas: [
          { campo: "tipo", etiqueta: "Declaración" },
          { campo: "periodo", etiqueta: "Período", tipo: "mes" },
          { campo: "fecha_limite", etiqueta: "Fecha límite", tipo: "fecha" },
          { campo: "monto", etiqueta: "Monto", tipo: "dinero" },
          { campo: "presentado_en", etiqueta: "Presentado", tipo: "fecha" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "cierre", nombre: "Cierre de período", tabla: "tareas_cierre", select: "*",
        orden: { campo: "fecha_limite", asc: true },
        columnas: [
          { campo: "tarea", etiqueta: "Tarea" },
          { campo: "modulo", etiqueta: "Módulo" },
          { campo: "fecha_limite", etiqueta: "Fecha límite", tipo: "fecha" },
          { campo: "avance", etiqueta: "Avance", tipo: "pct" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
    ],
  },
  {
    slug: "rrhh",
    nombre: "Recursos Humanos",
    grupo: "Personas",
    icono: "rrhh",
    descripcion: "Colaboradores, nómina, asistencia, vacaciones y reclutamiento",
    secciones: [
      {
        slug: "empleados", nombre: "Colaboradores", tabla: "empleados",
        select: "id,codigo,nombre,cargo,fecha_ingreso,salario_mensual,estado,departamentos(nombre)",
        orden: { campo: "codigo", asc: true },
        columnas: [
          { campo: "codigo", etiqueta: "Código", tipo: "codigo" },
          { campo: "nombre", etiqueta: "Nombre" },
          { campo: "cargo", etiqueta: "Cargo" },
          { campo: "departamentos.nombre", etiqueta: "Departamento" },
          { campo: "fecha_ingreso", etiqueta: "Ingreso", tipo: "fecha" },
          { campo: "salario_mensual", etiqueta: "Salario mensual", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "nomina", nombre: "Nómina", tabla: "nominas", select: "*",
        orden: { campo: "periodo_desde", asc: false },
        columnas: [
          { campo: "codigo", etiqueta: "Nómina", tipo: "codigo" },
          { campo: "periodo_desde", etiqueta: "Desde", tipo: "fecha" },
          { campo: "periodo_hasta", etiqueta: "Hasta", tipo: "fecha" },
          { campo: "tipo", etiqueta: "Tipo", tipo: "etiqueta" },
          { campo: "bruto", etiqueta: "Bruto", tipo: "dinero" },
          { campo: "deducciones", etiqueta: "Deducciones", tipo: "dinero" },
          { campo: "neto", etiqueta: "Neto", tipo: "dinero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "asistencia", nombre: "Asistencia y horas extras", tabla: "asistencia",
        select: "id,fecha,entrada,salida,horas_normales,horas_extras,estado,empleados(nombre)",
        orden: { campo: "fecha", asc: false },
        columnas: [
          { campo: "empleados.nombre", etiqueta: "Colaborador" },
          { campo: "fecha", etiqueta: "Fecha", tipo: "fecha" },
          { campo: "entrada", etiqueta: "Entrada" },
          { campo: "salida", etiqueta: "Salida" },
          { campo: "horas_normales", etiqueta: "Horas normales", tipo: "numero" },
          { campo: "horas_extras", etiqueta: "Horas extras", tipo: "numero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "ausencias", nombre: "Vacaciones y permisos", tabla: "solicitudes_ausencia",
        select: "id,tipo,desde,hasta,dias,estado,empleados(nombre)",
        orden: { campo: "desde", asc: false },
        columnas: [
          { campo: "empleados.nombre", etiqueta: "Colaborador" },
          { campo: "tipo", etiqueta: "Tipo", tipo: "etiqueta" },
          { campo: "desde", etiqueta: "Desde", tipo: "fecha" },
          { campo: "hasta", etiqueta: "Hasta", tipo: "fecha" },
          { campo: "dias", etiqueta: "Días", tipo: "numero" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
      {
        slug: "reclutamiento", nombre: "Reclutamiento", tabla: "vacantes",
        select: "id,titulo,fecha_objetivo,estado,departamentos(nombre)",
        orden: { campo: "fecha_objetivo", asc: true },
        columnas: [
          { campo: "titulo", etiqueta: "Vacante" },
          { campo: "departamentos.nombre", etiqueta: "Departamento" },
          { campo: "fecha_objetivo", etiqueta: "Fecha objetivo", tipo: "fecha" },
          { campo: "estado", etiqueta: "Estado", tipo: "estado" },
        ],
      },
    ],
  },
];

export function buscarModulo(slug: string) {
  return MODULOS.find((m) => m.slug === slug);
}

export function rutaSeccion(m: Modulo, s: Seccion) {
  return s.ruta ?? `/${m.slug}/${s.slug}/`;
}

// Pantallas propias que pertenecen a un módulo (para resaltar el menú).
export const PANTALLAS_DE_MODULO: Record<string, string> = {
  "/prospectos": "comercial",
  "/cliente": "comercial",
  "/cotizacion": "comercial",
  "/iguala": "igualas",
  "/orden": "igualas",
};

export function moduloDeRuta(path: string) {
  const base = "/" + (path.split("/")[1] ?? "");
  return PANTALLAS_DE_MODULO[base] ?? base.slice(1);
}
