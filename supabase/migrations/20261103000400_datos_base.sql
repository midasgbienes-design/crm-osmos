-- =====================================================================
-- Osmos ERP · Datos base (configuración inicial)
-- Revise con su contador los porcentajes y el catálogo de cuentas.
-- =====================================================================

insert into public.empresa (id) values (1) on conflict do nothing;

insert into public.consecutivos (clave, prefijo, relleno) values
  ('cliente','CL-',4), ('prospecto','L-',4), ('oportunidad','OP-',4), ('cotizacion','COT-',4),
  ('pedido','PV-',4), ('iguala','IG-',4), ('orden_servicio','OS-',4), ('factura','FT-',4),
  ('recibo','RI-',4), ('nota_credito','NC-',4), ('factura_suplidor','PR-',4), ('pago','PG-',4),
  ('anticipo','AN-',4), ('solicitud_compra','SC-',4), ('orden_compra','OC-',4), ('recepcion','RM-',4),
  ('asiento','AD-',5), ('nomina','NM-',4), ('empleado','EM-',3), ('vendedor_interno','VD-',2),
  ('vendedor_externo','VE-',2), ('suplidor','SP-',3), ('producto','PRD-',4)
on conflict do nothing;

-- Parámetros de nómina e impuestos (verificar vigencia con TSS / DGII y su contador)
insert into public.parametros (clave, valor, descripcion) values
  ('itbis_pct',                18.00, 'Tasa general de ITBIS'),
  ('sfs_empleado_pct',          3.04, 'Seguro Familiar de Salud · aporte del empleado'),
  ('sfs_empleador_pct',         7.09, 'Seguro Familiar de Salud · aporte del empleador'),
  ('afp_empleado_pct',          2.87, 'Fondo de pensiones · aporte del empleado'),
  ('afp_empleador_pct',         7.10, 'Fondo de pensiones · aporte del empleador'),
  ('srl_empleador_pct',         1.10, 'Seguro de Riesgos Laborales · tasa asignada a la empresa'),
  ('infotep_empleador_pct',     1.00, 'INFOTEP · aporte del empleador'),
  ('retencion_isr_externos_pct',10.00,'Retención de ISR a vendedores externos (personas físicas)'),
  ('dias_alerta_reposicion',   60,    'Días de anticipación para alertas de base instalada'),
  ('dias_alerta_renovacion',   30,    'Días de anticipación para renovar igualas'),
  ('descuento_max_sin_aprobacion_pct', 10, 'Descuento máximo en cotizaciones sin aprobación de gerencia'),
  ('margen_minimo_cotizacion_pct',     25, 'Margen mínimo antes de requerir aprobación')
on conflict do nothing;

insert into public.esquemas_comision (codigo, nombre, aplica_a, base, porcentaje, condicion) values
  ('ESQ-01','Venta de equipos y sistemas','equipos','cobrado_sin_itbis',5.0,'Al cobrar la factura'),
  ('ESQ-02','Iguala nueva','iguala_nueva','cuota_x3',10.0,'Iguala activa por 90 días'),
  ('ESQ-03','Renovación de iguala','renovacion','cuota_x12',2.0,'Al firmar la renovación'),
  ('ESQ-04','Insumos y repuestos','insumos','cobrado_sin_itbis',3.0,'Margen mínimo de 25%'),
  ('ESQ-05','Bono por sobrecumplimiento','bono_meta','ventas_mes',1.0,'Cumplimiento mayor a 100%'),
  ('ESQ-06','Vendedor externo (comisionista)','externo','cobrado_sin_itbis',5.0,'Al cobrar; se paga por cuentas por pagar con retención ISR'),
  ('ESQ-07','Referidor externo','referidor','cobrado_sin_itbis',3.0,'Al cobrar la primera factura del referido')
on conflict do nothing;

insert into public.departamentos (nombre) values ('Operaciones'), ('Comercial'), ('Administración'), ('Logística')
on conflict do nothing;

insert into public.almacenes (nombre) values ('Almacén principal') on conflict do nothing;

-- Catálogo de cuentas base (ajustar con el contador)
insert into public.cuentas_contables (codigo, nombre, tipo, naturaleza, nivel, acepta_movimientos) values
  ('1',      'Activos',                                   'activo',     'deudora',   1, false),
  ('1101',   'Efectivo y equivalentes',                   'activo',     'deudora',   2, false),
  ('1101-01','Caja general',                              'activo',     'deudora',   3, true),
  ('1101-02','Caja chica',                                'activo',     'deudora',   3, true),
  ('1102',   'Bancos',                                    'activo',     'deudora',   2, false),
  ('1102-01','Banco · cuenta corriente',                  'activo',     'deudora',   3, true),
  ('1201-01','Cuentas por cobrar clientes',               'activo',     'deudora',   3, true),
  ('1202-01','Anticipos a suplidores',                    'activo',     'deudora',   3, true),
  ('1203-01','ITBIS pagado en compras',                   'activo',     'deudora',   3, true),
  ('1204-01','Retenciones que nos efectuaron',            'activo',     'deudora',   3, true),
  ('1301-01','Inventario de equipos, insumos y repuestos','activo',     'deudora',   3, true),
  ('1501-01','Vehículos',                                 'activo',     'deudora',   3, true),
  ('1502-01','Herramientas y equipos de trabajo',         'activo',     'deudora',   3, true),
  ('1509-01','Depreciación acumulada',                    'activo',     'acreedora', 3, true),
  ('2',      'Pasivos',                                   'pasivo',     'acreedora', 1, false),
  ('2101-01','Cuentas por pagar suplidores',              'pasivo',     'acreedora', 3, true),
  ('2102-01','Comisiones por pagar',                      'pasivo',     'acreedora', 3, true),
  ('2103-01','Retenciones de ISR por pagar',              'pasivo',     'acreedora', 3, true),
  ('2104-01','Retenciones de ITBIS por pagar',            'pasivo',     'acreedora', 3, true),
  ('2105-01','ITBIS por pagar',                           'pasivo',     'acreedora', 3, true),
  ('2106-01','TSS por pagar',                             'pasivo',     'acreedora', 3, true),
  ('2107-01','Nómina por pagar',                          'pasivo',     'acreedora', 3, true),
  ('2108-01','Anticipos de clientes',                     'pasivo',     'acreedora', 3, true),
  ('3',      'Patrimonio',                                'patrimonio', 'acreedora', 1, false),
  ('3101-01','Capital',                                   'patrimonio', 'acreedora', 3, true),
  ('3201-01','Resultados acumulados',                     'patrimonio', 'acreedora', 3, true),
  ('3202-01','Resultado del período',                     'patrimonio', 'acreedora', 3, true),
  ('4',      'Ingresos',                                  'ingreso',    'acreedora', 1, false),
  ('4101-01','Venta de sistemas de tratamiento',          'ingreso',    'acreedora', 3, true),
  ('4102-01','Ingresos por igualas de mantenimiento',     'ingreso',    'acreedora', 3, true),
  ('4103-01','Venta de insumos y repuestos',              'ingreso',    'acreedora', 3, true),
  ('4104-01','Servicios técnicos y análisis',             'ingreso',    'acreedora', 3, true),
  ('5',      'Costos',                                    'costo',      'deudora',   1, false),
  ('5101-01','Costo de equipos vendidos',                 'costo',      'deudora',   3, true),
  ('5102-01','Costo de insumos en servicios',             'costo',      'deudora',   3, true),
  ('6',      'Gastos',                                    'gasto',      'deudora',   1, false),
  ('6101-01','Sueldos y salarios',                        'gasto',      'deudora',   3, true),
  ('6102-01','Comisiones a vendedores',                   'gasto',      'deudora',   3, true),
  ('6103-01','Aportes patronales TSS e INFOTEP',          'gasto',      'deudora',   3, true),
  ('6201-01','Alquiler',                                  'gasto',      'deudora',   3, true),
  ('6202-01','Energía, agua y telecomunicaciones',        'gasto',      'deudora',   3, true),
  ('6203-01','Combustible y transporte',                  'gasto',      'deudora',   3, true),
  ('6204-01','Depreciación',                              'gasto',      'deudora',   3, true),
  ('6299-01','Otros gastos generales',                    'gasto',      'deudora',   3, true)
on conflict do nothing;

-- Período contable actual
insert into public.periodos_contables (anio, mes)
values (extract(year from current_date)::int, extract(month from current_date)::int)
on conflict do nothing;

-- Secuencias de NCF: registrar los rangos autorizados por la DGII, por ejemplo:
--   insert into public.secuencias_ncf (tipo, prefijo, desde, hasta, actual, vence)
--   values ('B01','B01', 1, 500, 1, '2027-12-31');
