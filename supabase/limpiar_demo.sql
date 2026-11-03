-- =====================================================================
-- Osmos ERP · Borrar datos de demostración
-- Deja intactos la configuración, el catálogo de cuentas, los esquemas de
-- comisión, departamentos, almacenes y usuarios. Borra todo lo operativo.
-- ¡Cuidado! También borra datos reales si ya los registró.
-- =====================================================================

truncate table
  public.comisiones, public.liquidaciones_comision,
  public.pago_aplicaciones, public.pagos, public.anticipos_suplidor, public.facturas_suplidor,
  public.recibo_aplicaciones, public.recibos, public.notas_credito, public.gestiones_cobro,
  public.factura_lineas, public.facturas, public.facturacion_corridas, public.secuencias_ncf,
  public.orden_servicio_insumos, public.visitas, public.ordenes_servicio, public.iguala_equipos, public.igualas,
  public.equipo_componentes, public.equipos_instalados,
  public.cotizacion_lineas, public.cotizaciones, public.pedidos_venta,
  public.analisis_parametros, public.analisis_agua, public.actividades, public.oportunidades,
  public.contactos, public.prospectos, public.clientes,
  public.movimientos_inventario, public.inventario_existencias, public.recepcion_lineas, public.recepciones,
  public.orden_compra_lineas, public.solicitudes_compra, public.ordenes_compra,
  public.precios_suplidor, public.evaluaciones_suplidor, public.suplidores, public.productos,
  public.vendedores, public.nomina_detalle, public.nominas, public.asistencia, public.solicitudes_ausencia,
  public.candidatos, public.vacantes, public.empleados,
  public.asiento_lineas, public.asientos, public.conciliaciones, public.declaraciones_fiscales, public.tareas_cierre,
  public.auditoria
cascade;

update public.consecutivos set ultimo = 0;
