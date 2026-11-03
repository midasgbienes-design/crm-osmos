-- =====================================================================
-- Osmos ERP · Permisos por rol (Row Level Security)
--
-- Roles: admin, gerencia (acceso total) · ventas · vendedor_externo · tecnico
--        cobros · pagos · compras · almacen · contabilidad · rrhh · consulta
-- =====================================================================

-- Activa RLS en todas las tablas del esquema público.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Crea políticas de lectura y escritura por grupo de tablas.
create or replace function public._politicas(p_tablas text[], p_lectura text[], p_escritura text[])
returns void language plpgsql as $$
declare t text;
begin
  foreach t in array p_tablas loop
    execute format('create policy lectura on public.%I for select to authenticated using (public.tiene_rol(variadic %L::text[]))',
                   t, p_lectura || p_escritura);
    execute format('create policy escritura on public.%I for all to authenticated using (public.tiene_rol(variadic %L::text[])) with check (public.tiene_rol(variadic %L::text[]))',
                   t, p_escritura, p_escritura);
  end loop;
end $$;

-- COMERCIAL
select public._politicas(
  array['clientes','contactos','prospectos','oportunidades','actividades','analisis_agua','analisis_parametros',
        'cotizaciones','cotizacion_lineas','pedidos_venta','equipos_instalados','equipo_componentes'],
  array['cobros','contabilidad','tecnico','consulta'],
  array['ventas']);

-- IGUALAS Y SERVICIO TÉCNICO
select public._politicas(
  array['igualas','iguala_equipos','visitas','ordenes_servicio','orden_servicio_insumos'],
  array['cobros','contabilidad','almacen','consulta'],
  array['ventas','tecnico']);
select public._politicas(array['facturacion_corridas'], array['ventas','contabilidad','consulta'], array['cobros']);

-- VENDEDORES Y COMISIONES
select public._politicas(array['esquemas_comision','vendedores'], array['ventas','pagos','rrhh','consulta'], array['contabilidad']);
select public._politicas(array['comisiones','liquidaciones_comision'], array['pagos','rrhh'], array['contabilidad']);

-- COMPRAS E INVENTARIO
select public._politicas(array['productos'], array['ventas','tecnico','cobros','pagos','contabilidad','consulta'], array['compras','almacen']);
select public._politicas(
  array['almacenes','solicitudes_compra','ordenes_compra','orden_compra_lineas','recepciones','recepcion_lineas','inventario_existencias'],
  array['tecnico','pagos','contabilidad','consulta'],
  array['compras','almacen']);
select public._politicas(array['movimientos_inventario'], array['pagos','contabilidad','consulta'], array['compras','almacen','tecnico']);

-- SUPLIDORES
select public._politicas(array['suplidores','precios_suplidor','evaluaciones_suplidor'], array['pagos','contabilidad','almacen','consulta'], array['compras']);

-- COBROS
select public._politicas(
  array['secuencias_ncf','facturas','factura_lineas','recibos','recibo_aplicaciones','notas_credito','gestiones_cobro'],
  array['ventas','consulta'],
  array['cobros','contabilidad']);

-- PAGOS
select public._politicas(array['facturas_suplidor','pagos','pago_aplicaciones','anticipos_suplidor'], array['compras','consulta'], array['pagos','contabilidad']);

-- CONTABILIDAD
select public._politicas(
  array['cuentas_contables','periodos_contables','cuentas_bancarias','asientos','asiento_lineas','conciliaciones','declaraciones_fiscales','tareas_cierre'],
  array['cobros','pagos','consulta'],
  array['contabilidad']);

-- RECURSOS HUMANOS (salarios: solo rrhh, contabilidad y gerencia)
select public._politicas(array['departamentos'], array['ventas','tecnico','cobros','pagos','compras','almacen','consulta'], array['rrhh']);
select public._politicas(array['empleados','nominas','nomina_detalle','vacantes','candidatos'], array['contabilidad'], array['rrhh']);
select public._politicas(array['asistencia','solicitudes_ausencia'], array['contabilidad'], array['rrhh']);

-- CONFIGURACIÓN
select public._politicas(array['empresa','parametros','consecutivos'],
  array['ventas','vendedor_externo','tecnico','cobros','pagos','compras','almacen','contabilidad','rrhh','consulta'],
  array['admin']);
select public._politicas(array['auditoria'], array[]::text[], array['admin']);

drop function public._politicas(text[], text[], text[]);

-- ---------------------------------------------------------------------
-- Políticas específicas
-- ---------------------------------------------------------------------

-- Perfiles: cada quien ve el suyo; admin/gerencia/rrhh ven todos; solo admin modifica.
create policy lectura on public.perfiles for select to authenticated
  using (id = auth.uid() or public.tiene_rol('rrhh'));
create policy escritura on public.perfiles for all to authenticated
  using (public.tiene_rol('admin')) with check (public.tiene_rol('admin'));

-- Vendedor asociado al usuario actual (para vendedores externos e internos).
create or replace function public.mi_vendedor()
returns uuid language sql stable security definer set search_path = public as $$
  select id from vendedores where perfil_id = auth.uid() and activo limit 1
$$;

-- Vendedores externos: solo ven y registran sus propios prospectos y clientes.
create policy externo_lectura on public.prospectos for select to authenticated
  using (public.rol_actual() = 'vendedor_externo'
         and (asignado_a = public.mi_vendedor() or referido_por_vendedor_id = public.mi_vendedor()));
create policy externo_registro on public.prospectos for insert to authenticated
  with check (public.rol_actual() = 'vendedor_externo'
              and referido_por_vendedor_id = public.mi_vendedor()
              and origen = 'vendedor_externo');
create policy externo_lectura on public.clientes for select to authenticated
  using (public.rol_actual() = 'vendedor_externo' and vendedor_id = public.mi_vendedor());

-- Cada vendedor ve sus propias comisiones y su ficha.
create policy propias on public.comisiones for select to authenticated
  using (vendedor_id = public.mi_vendedor());
create policy propia on public.vendedores for select to authenticated
  using (perfil_id = auth.uid());

-- Técnicos: ven su propio registro de asistencia y sus ausencias.
create policy propia on public.asistencia for select to authenticated
  using (empleado_id in (select id from public.empleados where perfil_id = auth.uid()));
create policy propias on public.solicitudes_ausencia for select to authenticated
  using (empleado_id in (select id from public.empleados where perfil_id = auth.uid()));
create policy solicitar on public.solicitudes_ausencia for insert to authenticated
  with check (empleado_id in (select id from public.empleados where perfil_id = auth.uid()) and estado = 'por_aprobar');

-- Directorio de empleados disponible para todos los usuarios autenticados.
revoke all on public.v_directorio from anon;
grant select on public.v_directorio to authenticated;

-- Funciones: ningún acceso para visitantes sin sesión.
-- Los NCF solo se asignan desde los procesos de facturación.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on function public.siguiente_ncf(text) from authenticated;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.siguiente_ncf(text) from authenticated;
