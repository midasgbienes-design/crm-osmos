-- =====================================================================
-- Osmos ERP · Datos de demostración (OPCIONAL)
-- Solo para probar el sistema. No ejecutar en producción con datos reales.
-- Para borrarlos, ejecute supabase/limpiar_demo.sql
-- =====================================================================

do $$
declare
  d_ops uuid := (select id from departamentos where nombre = 'Operaciones');
  d_com uuid := (select id from departamentos where nombre = 'Comercial');
  alm uuid := (select id from almacenes limit 1);
  e1 uuid; e2 uuid; e3 uuid; t1 uuid; t2 uuid;
  v1 uuid; v2 uuid; v3 uuid; ve1 uuid; ve2 uuid;
  p_mem uuid; p_sed uuid; p_cb uuid; p_sal uuid; p_uv uuid; p_bom uuid; p_ro2k uuid; p_suav uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid;
  eq1 uuid; eq2 uuid; eq3 uuid; eq4 uuid;
  s1 uuid; s2 uuid; s3 uuid;
  f1 uuid; r1 uuid;
begin
  -- Empleados
  insert into empleados (codigo, nombre, cargo, departamento_id, fecha_ingreso, salario_mensual)
  values (siguiente_codigo('empleado'), '[Vendedor 1]', 'Ejecutivo de ventas', d_com, '2025-07-14', 28000) returning id into e1;
  insert into empleados (codigo, nombre, cargo, departamento_id, fecha_ingreso, salario_mensual)
  values (siguiente_codigo('empleado'), '[Vendedor 2]', 'Ejecutivo de ventas', d_com, '2025-08-01', 28000) returning id into e2;
  insert into empleados (codigo, nombre, cargo, departamento_id, fecha_ingreso, salario_mensual)
  values (siguiente_codigo('empleado'), '[Vendedor 3]', 'Ejecutivo de ventas', d_com, '2026-01-10', 26000) returning id into e3;
  insert into empleados (codigo, nombre, cargo, departamento_id, fecha_ingreso, salario_mensual)
  values (siguiente_codigo('empleado'), '[Técnico 1]', 'Técnico de tratamiento de agua', d_ops, '2025-03-10', 32000) returning id into t1;
  insert into empleados (codigo, nombre, cargo, departamento_id, fecha_ingreso, salario_mensual)
  values (siguiente_codigo('empleado'), '[Técnico 2]', 'Técnico de tratamiento de agua', d_ops, '2025-05-05', 30000) returning id into t2;

  -- Vendedores internos y externos
  insert into vendedores (codigo, nombre, tipo, empleado_id, zona, meta_mensual)
  values (siguiente_codigo('vendedor_interno'), '[Vendedor 1]', 'interno', e1, 'Santiago centro y norte', 450000) returning id into v1;
  insert into vendedores (codigo, nombre, tipo, empleado_id, zona, meta_mensual)
  values (siguiente_codigo('vendedor_interno'), '[Vendedor 2]', 'interno', e2, 'Santiago sur y Moca', 450000) returning id into v2;
  insert into vendedores (codigo, nombre, tipo, empleado_id, zona, meta_mensual)
  values (siguiente_codigo('vendedor_interno'), '[Vendedor 3]', 'interno', e3, 'La Vega y Jarabacoa', 400000) returning id into v3;
  insert into vendedores (codigo, nombre, tipo, zona, cedula_rnc, comprobante, esquema_id, acuerdo_firmado_en)
  values (siguiente_codigo('vendedor_externo'), '[Vendedor externo 1]', 'externo', 'Puerto Plata', '[RNC]', 'B01',
          (select id from esquemas_comision where codigo = 'ESQ-06'), '2026-03-15') returning id into ve1;
  insert into vendedores (codigo, nombre, tipo, zona, cedula_rnc, comprobante, esquema_id, acuerdo_firmado_en)
  values (siguiente_codigo('vendedor_externo'), '[Vendedor externo 2]', 'referidor', 'Santiago', '[Cédula]', 'B11',
          (select id from esquemas_comision where codigo = 'ESQ-07'), '2026-07-02') returning id into ve2;

  -- Productos
  insert into productos (codigo, nombre, tipo, categoria, precio_venta, costo_promedio, existencia_minima, vida_util_meses)
  values ('MEM-4040','Membrana RO 4"x40"','repuesto','Membranas', 9500, 6800, 10, 24) returning id into p_mem;
  insert into productos (codigo, nombre, tipo, categoria, precio_venta, costo_promedio, existencia_minima, vida_util_meses)
  values ('FIL-S05','Cartucho de sedimento 5 µm 20"','insumo','Filtros', 450, 285, 60, 3) returning id into p_sed;
  insert into productos (codigo, nombre, tipo, categoria, precio_venta, costo_promedio, existencia_minima, vida_util_meses)
  values ('FIL-CB10','Cartucho de carbón en bloque 10"','insumo','Filtros', 650, 420, 40, 6) returning id into p_cb;
  insert into productos (codigo, nombre, tipo, categoria, precio_venta, costo_promedio, existencia_minima, unidad)
  values ('SAL-25','Sal en pellets 25 kg','insumo','Químicos y sal', 950, 650, 30, 'saco') returning id into p_sal;
  insert into productos (codigo, nombre, tipo, categoria, precio_venta, costo_promedio, existencia_minima, vida_util_meses)
  values ('UV-12G','Lámpara UV 12 GPM','repuesto','Repuestos UV', 4950, 3400, 6, 12) returning id into p_uv;
  insert into productos (codigo, nombre, tipo, categoria, precio_venta, costo_promedio, existencia_minima)
  values ('BOM-1HP','Bomba multietapa 1 HP','equipo','Equipos', 26500, 18500, 2) returning id into p_bom;
  insert into productos (codigo, nombre, tipo, categoria, precio_venta, costo_promedio)
  values ('SIS-RO2K','Sistema de ósmosis inversa 2,000 GPD','equipo','Sistemas', 355932.20, 240000) returning id into p_ro2k;
  insert into productos (codigo, nombre, tipo, categoria, precio_venta, costo_promedio)
  values ('SIS-SUA25','Suavizador 2.5 pies³','equipo','Sistemas', 68000, 41000) returning id into p_suav;

  -- Existencias iniciales
  insert into movimientos_inventario (tipo, producto_id, almacen_id, cantidad, costo_unitario, documento_tipo, nota) values
    ('entrada', p_mem, alm, 18, 6800, 'ajuste', 'Inventario inicial'),
    ('entrada', p_sed, alm, 24, 285, 'ajuste', 'Inventario inicial'),
    ('entrada', p_cb,  alm, 48, 420, 'ajuste', 'Inventario inicial'),
    ('entrada', p_sal, alm, 12, 650, 'ajuste', 'Inventario inicial'),
    ('entrada', p_uv,  alm, 3, 3400, 'ajuste', 'Inventario inicial'),
    ('entrada', p_bom, alm, 4, 18500, 'ajuste', 'Inventario inicial');

  -- Clientes
  insert into clientes (codigo, nombre, rnc_cedula, segmento, sector, ciudad, vendedor_id, origen, limite_credito, condicion_pago_dias)
  values (siguiente_codigo('cliente'), 'Clínica Santa Ana', '1-30-00000-2', 'comercial', 'Salud', 'Santiago', v2, 'referido_cliente', 800000, 30) returning id into c1;
  insert into clientes (codigo, nombre, rnc_cedula, segmento, ciudad, vendedor_id, origen, limite_credito, condicion_pago_dias)
  values (siguiente_codigo('cliente'), 'Residencial Monte Claro', '1-31-00000-1', 'residencial', 'Santiago', v1, 'web', 500000, 30) returning id into c2;
  insert into clientes (codigo, nombre, rnc_cedula, segmento, sector, ciudad, vendedor_id, origen, limite_credito)
  values (siguiente_codigo('cliente'), 'Hotel Valle Verde', '1-01-00000-3', 'comercial', 'Hotelería', 'Jarabacoa', v3, 'llamada', 600000) returning id into c3;
  insert into clientes (codigo, nombre, rnc_cedula, segmento, ciudad, vendedor_id, origen, limite_credito)
  values (siguiente_codigo('cliente'), 'Condominio Vista Sur', '4-30-00000-5', 'residencial', 'Santiago', v1, 'whatsapp', 300000) returning id into c4;
  insert into clientes (codigo, nombre, rnc_cedula, segmento, sector, ciudad, vendedor_id, origen, limite_credito, tipo_ncf)
  values (siguiente_codigo('cliente'), 'Colegio San Rafael', '1-01-00000-9', 'comercial', 'Educación', 'Santiago', v3, 'evento', 200000, 'B01') returning id into c5;

  insert into contactos (cliente_id, nombre, rol, telefono, principal) values
    (c1, '[Director administrativo]', 'Decisión de compra', '[Teléfono]', true),
    (c1, '[Encargado de mantenimiento]', 'Contacto técnico', '[Teléfono]', false),
    (c2, '[Administrador]', 'Decisión de compra', '[Teléfono]', true),
    (c3, '[Gerente]', 'Decisión de compra', '[Teléfono]', true);

  -- Base instalada
  insert into equipos_instalados (serie, cliente_id, producto_id, descripcion, fecha_instalacion, garantia_hasta)
  values ('OI-2024-031', c1, p_ro2k, 'Ósmosis inversa 2,000 GPD', '2024-03-12', '2026-03-12') returning id into eq1;
  insert into equipos_instalados (serie, cliente_id, descripcion, fecha_instalacion, garantia_hasta)
  values ('UV-2024-032', c1, 'Esterilizador UV 12 GPM', '2024-03-12', '2026-03-12') returning id into eq2;
  insert into equipos_instalados (serie, cliente_id, producto_id, descripcion, fecha_instalacion, garantia_hasta)
  values ('SU-2023-014', c3, p_suav, 'Suavizador 2.5 pies³', '2023-06-20', '2025-06-20') returning id into eq3;
  insert into equipos_instalados (serie, cliente_id, producto_id, descripcion, fecha_instalacion, garantia_hasta, estado)
  values ('OI-2026-088', c2, p_ro2k, 'Ósmosis inversa 2,000 GPD', null, '2027-11-30', 'en_instalacion') returning id into eq4;

  insert into equipo_componentes (equipo_id, producto_id, descripcion, cantidad, frecuencia_meses, ultimo_reemplazo) values
    (eq1, p_mem, 'Membranas RO', 2, 24, '2025-03-12'),
    (eq1, p_sed, 'Cartucho de sedimento', 1, 3, current_date - 80),
    (eq2, p_uv,  'Lámpara UV', 1, 12, '2025-10-01'),
    (eq3, null,  'Resina', 1, 42, '2023-06-20');

  -- Igualas
  insert into igualas (codigo, cliente_id, vendedor_id, descripcion, frecuencia_visita, cuota_mensual, fecha_inicio, fecha_fin, incluye_insumos)
  values (siguiente_codigo('iguala'), c1, v2, 'Ósmosis inversa + UV', 'quincenal', 18000, '2024-04-01', '2027-01-31', 'Cartuchos de prefiltración y sanitización');
  insert into igualas (codigo, cliente_id, vendedor_id, descripcion, frecuencia_visita, cuota_mensual, fecha_inicio, fecha_fin, incluye_insumos)
  values (siguiente_codigo('iguala'), c3, v3, 'Suavizador + UV', 'mensual', 12000, '2023-07-01', current_date + 25, 'Sal y cartuchos');
  insert into igualas (codigo, cliente_id, vendedor_id, descripcion, frecuencia_visita, cuota_mensual, fecha_inicio, fecha_fin)
  values (siguiente_codigo('iguala'), c4, v1, 'Ósmosis inversa 1,000 GPD', 'mensual', 9500, '2025-03-15', '2027-03-15');
  insert into igualas (codigo, cliente_id, vendedor_id, descripcion, frecuencia_visita, cuota_mensual, fecha_inicio, fecha_fin)
  values (siguiente_codigo('iguala'), c2, v1, 'Ósmosis inversa 2,000 GPD', 'mensual', 12500, date_trunc('month', current_date)::date, current_date + 390);

  -- Prospectos
  insert into prospectos (codigo, nombre, empresa, origen, interes, asignado_a, proxima_accion, estado, segmento) values
    (siguiente_codigo('prospecto'), '[Contacto]', 'Condominio Altos del Cerro', 'web', 'Ósmosis inversa residencial', v1, 'Llamar hoy', 'nuevo', 'residencial'),
    (siguiente_codigo('prospecto'), '[Contacto]', 'Panadería La Espiga', 'whatsapp', 'Suavizador', v2, 'Enviar información', 'nuevo', 'comercial'),
    (siguiente_codigo('prospecto'), '[Contacto]', 'Clínica Odontológica Sonrisa', 'referido_cliente', 'Ósmosis inversa', v2, 'Tomar muestra de agua', 'contactado', 'comercial');
  insert into prospectos (codigo, nombre, empresa, origen, referido_por_vendedor_id, interes, asignado_a, proxima_accion, estado, segmento)
  values (siguiente_codigo('prospecto'), '[Contacto]', 'Hostal Brisas del Atlántico', 'vendedor_externo', ve1, 'Ósmosis inversa + UV', ve1, 'Visita técnica', 'calificado', 'comercial');
  update prospectos set referido_por_cliente_id = c1 where empresa = 'Clínica Odontológica Sonrisa';

  -- Oportunidades
  insert into oportunidades (codigo, titulo, cliente_id, vendedor_id, etapa, valor_estimado, probabilidad) values
    (siguiente_codigo('oportunidad'), 'Segunda línea de ósmosis + UV', c1, v2, 'negociacion', 485000, 60),
    (siguiente_codigo('oportunidad'), 'Reposición de resina', c3, v3, 'cotizacion_enviada', 28500, 70);

  -- Análisis de agua
  insert into analisis_agua (cliente_id, fecha, laboratorio, fuente) values (c1, '2026-09-15', 'Laboratorio AguaLab', 'Pozo')
  returning id into s1;
  insert into analisis_parametros (analisis_id, parametro, unidad, valor_crudo, valor_tratado, cumple) values
    (s1, 'TDS', 'mg/L', '620', '18', true), (s1, 'Dureza total', 'mg/L', '310', '4', true),
    (s1, 'Hierro', 'mg/L', '0.42', '< 0.05', true), (s1, 'pH', '', '7.6', '6.9', true),
    (s1, 'Coliformes totales', '', 'Presencia', 'Ausencia', true);

  -- Actividades
  insert into actividades (tipo, asunto, descripcion, cliente_id, fecha) values
    ('llamada', 'Gestión de cobranza', 'Compromiso de pago para la próxima semana', c1, now() - interval '2 days'),
    ('visita', 'Visita técnica', 'Revisión de presiones y caudal', c2, now() - interval '1 day');

  -- Suplidores
  insert into suplidores (codigo, nombre, rnc, categoria, condicion_pago_dias, insumo_critico)
  values (siguiente_codigo('suplidor'), 'Puradom, SRL', '[RNC]', 'Equipos y membranas', 10, true) returning id into s2;
  insert into suplidores (codigo, nombre, rnc, categoria, condicion_pago_dias, insumo_critico)
  values (siguiente_codigo('suplidor'), 'Distribuidora de Membranas del Caribe', '[RNC]', 'Membranas y cartuchos', 10, true) returning id into s3;
  insert into suplidores (codigo, nombre, rnc, categoria, condicion_pago_dias, retencion)
  values (siguiente_codigo('suplidor'), 'Laboratorio AguaLab', '[RNC]', 'Análisis de agua', 30, 'ISR 10%');
  insert into precios_suplidor (suplidor_id, producto_id, precio, precio_anterior, actualizado_en) values
    (s2, p_mem, 6800, 6450, '2026-08-05'), (s3, p_mem, 6950, 6950, '2026-10-20'), (s3, p_sed, 285, 270, '2026-10-20');

  -- Secuencias NCF de demostración (reemplazar por los rangos reales autorizados por la DGII)
  insert into secuencias_ncf (tipo, prefijo, desde, hasta, actual, vence) values
    ('B01','B01', 900001, 900500, 900001, '2027-12-31'),
    ('B02','B02', 900001, 900500, 900001, '2027-12-31'),
    ('B04','B04', 900001, 900100, 900001, '2027-12-31');

  -- Una factura con pago parcial
  insert into facturas (numero, ncf, cliente_id, fecha, vence, origen, vendedor_id, subtotal, itbis, total, saldo, estado)
  values (siguiente_codigo('factura'), siguiente_ncf('B01'), c1, current_date - 34, current_date - 4, 'cotizacion', v2,
          264745.76, 47654.24, 312400, 312400, 'emitida') returning id into f1;
  insert into factura_lineas (factura_id, descripcion, cantidad, precio, itbis, total)
  values (f1, 'Ampliación de sistema de ósmosis inversa', 1, 264745.76, 47654.24, 312400);
  insert into recibos (numero, cliente_id, forma_pago, referencia, monto)
  values (siguiente_codigo('recibo'), c1, 'transferencia', 'TRF-0001', 144000) returning id into r1;
  insert into recibo_aplicaciones (recibo_id, factura_id, monto) values (r1, f1, 144000);
end $$;

-- Facturación de igualas y visitas del mes en curso
select public.generar_facturacion_igualas(current_date);
select public.programar_visitas(current_date);
select public.tareas_diarias();
