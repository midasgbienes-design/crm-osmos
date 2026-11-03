-- =====================================================================
-- Osmos ERP · Fase 2: cotizador, pedidos, órdenes de servicio y su facturación
-- =====================================================================

alter table public.cotizaciones add column if not exists aprobado_en timestamptz;
alter table public.pedidos_venta add column if not exists factura_id uuid references public.facturas(id);
alter table public.ordenes_servicio add column if not exists factura_id uuid references public.facturas(id);
alter table public.ordenes_servicio add column if not exists visita_id uuid references public.visitas(id);

-- ---------------------------------------------------------------------
-- Cotizaciones
-- ---------------------------------------------------------------------

-- Crea o actualiza una cotización con sus líneas y calcula totales, ITBIS y margen.
-- p = { id?, cliente_id?, prospecto_id?, oportunidad_id?, vendedor_id?, vence?, notas?,
--       lineas: [{ producto_id?, descripcion, cantidad, precio, descuento_pct }] }
create or replace function public.guardar_cotizacion(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_estado text;
  v_tasa numeric := coalesce((select tasa_itbis from empresa where id = 1), 18);
  v_desc_max numeric := coalesce((select valor from parametros where clave = 'descuento_max_sin_aprobacion_pct'), 10);
  v_margen_min numeric := coalesce((select valor from parametros where clave = 'margen_minimo_cotizacion_pct'), 25);
  l jsonb; v_prod productos%rowtype;
  v_cant numeric; v_precio numeric; v_dpct numeric; v_bruto numeric; v_neto numeric; v_itbis numeric; v_costo numeric;
  t_bruto numeric := 0; t_neto numeric := 0; t_itbis numeric := 0; t_costo numeric := 0; v_max_desc numeric := 0;
  v_margen numeric; v_requiere boolean;
begin
  if not tiene_rol('ventas') then raise exception 'Sin permiso'; end if;
  if nullif(p->>'cliente_id','') is null and nullif(p->>'prospecto_id','') is null then
    raise exception 'Seleccione un cliente o un prospecto';
  end if;
  if jsonb_array_length(coalesce(p->'lineas','[]'::jsonb)) = 0 then
    raise exception 'La cotización debe tener al menos una línea';
  end if;

  if v_id is null then
    insert into cotizaciones (cliente_id, prospecto_id, oportunidad_id, vendedor_id, vence, notas)
    values (nullif(p->>'cliente_id','')::uuid, nullif(p->>'prospecto_id','')::uuid, nullif(p->>'oportunidad_id','')::uuid,
            nullif(p->>'vendedor_id','')::uuid, coalesce(nullif(p->>'vence','')::date, current_date + 15), nullif(p->>'notas',''))
    returning id into v_id;
  else
    select estado into v_estado from cotizaciones where id = v_id for update;
    if not found then raise exception 'Cotización no encontrada'; end if;
    if v_estado not in ('borrador','por_aprobar','en_negociacion') then
      raise exception 'Solo se pueden editar cotizaciones en borrador, por aprobar o en negociación';
    end if;
    update cotizaciones set
      cliente_id = nullif(p->>'cliente_id','')::uuid, prospecto_id = nullif(p->>'prospecto_id','')::uuid,
      oportunidad_id = nullif(p->>'oportunidad_id','')::uuid, vendedor_id = nullif(p->>'vendedor_id','')::uuid,
      vence = coalesce(nullif(p->>'vence','')::date, vence), notas = nullif(p->>'notas',''),
      aprobado_por = null, aprobado_en = null
    where id = v_id;
    delete from cotizacion_lineas where cotizacion_id = v_id;
  end if;

  for l in select * from jsonb_array_elements(p->'lineas') loop
    v_prod := null;
    if nullif(l->>'producto_id','') is not null then
      select * into v_prod from productos where id = (l->>'producto_id')::uuid;
    end if;
    v_cant   := coalesce((l->>'cantidad')::numeric, 1);
    v_precio := coalesce(nullif(l->>'precio','')::numeric, v_prod.precio_venta, 0);
    v_dpct   := least(greatest(coalesce(nullif(l->>'descuento_pct','')::numeric, 0), 0), 100);
    v_costo  := coalesce(v_prod.costo_promedio, 0);
    v_bruto  := round(v_cant * v_precio, 2);
    v_neto   := round(v_bruto * (1 - v_dpct / 100), 2);
    v_itbis  := case when coalesce(v_prod.aplica_itbis, true) then round(v_neto * v_tasa / 100, 2) else 0 end;

    insert into cotizacion_lineas (cotizacion_id, producto_id, descripcion, cantidad, precio, costo, descuento_pct, itbis, total)
    values (v_id, v_prod.id, coalesce(nullif(l->>'descripcion',''), v_prod.nombre, 'Artículo'), v_cant, v_precio, v_costo, v_dpct, v_itbis, v_neto + v_itbis);

    t_bruto := t_bruto + v_bruto; t_neto := t_neto + v_neto; t_itbis := t_itbis + v_itbis; t_costo := t_costo + v_costo * v_cant;
    v_max_desc := greatest(v_max_desc, v_dpct);
  end loop;

  v_margen := case when t_neto > 0 then round((t_neto - t_costo) / t_neto * 100, 2) end;
  v_requiere := v_max_desc > v_desc_max or coalesce(v_margen, 0) < v_margen_min;

  update cotizaciones set
    subtotal = t_bruto, descuento = t_bruto - t_neto, itbis = t_itbis, total = t_neto + t_itbis,
    margen_pct = v_margen, requiere_aprobacion = v_requiere,
    estado = case when estado = 'en_negociacion' and not v_requiere then 'en_negociacion'
                  when v_requiere then 'por_aprobar' else 'borrador' end
  where id = v_id;

  return v_id;
end $$;

-- Acciones del ciclo de la cotización.
--   aprobar   → gerencia autoriza descuento o margen bajo
--   enviar    → enviada al cliente (requiere aprobación previa si aplica)
--   negociar  → el cliente pidió cambios
--   aceptar   → el cliente aceptó: se crea el pedido de venta (y el cliente, si era prospecto)
--   rechazar  → el cliente la rechazó
create or replace function public.accion_cotizacion(p_id uuid, p_accion text, p_motivo text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare c cotizaciones%rowtype; v_cliente uuid; v_pedido uuid;
begin
  select * into c from cotizaciones where id = p_id for update;
  if not found then raise exception 'Cotización no encontrada'; end if;

  if p_accion = 'aprobar' then
    if not tiene_rol('gerencia') then raise exception 'Solo gerencia puede aprobar descuentos o márgenes bajos'; end if;
    update cotizaciones set aprobado_por = auth.uid(), aprobado_en = now(),
           estado = case when estado = 'por_aprobar' then 'borrador' else estado end
     where id = p_id;
    return p_id;
  end if;

  if not tiene_rol('ventas') then raise exception 'Sin permiso'; end if;

  if p_accion = 'enviar' then
    if c.requiere_aprobacion and c.aprobado_en is null then
      raise exception 'Esta cotización necesita aprobación de gerencia antes de enviarse';
    end if;
    update cotizaciones set estado = 'enviada' where id = p_id;
    update oportunidades set etapa = 'cotizacion_enviada' where id = c.oportunidad_id and etapa not in ('ganada','perdida','negociacion');
    return p_id;

  elsif p_accion = 'negociar' then
    update cotizaciones set estado = 'en_negociacion' where id = p_id;
    update oportunidades set etapa = 'negociacion' where id = c.oportunidad_id and etapa not in ('ganada','perdida');
    return p_id;

  elsif p_accion = 'rechazar' then
    update cotizaciones set estado = 'rechazada', notas = concat_ws(E'\n', notas, 'Rechazada: ' || p_motivo) where id = p_id;
    update oportunidades set etapa = 'perdida', motivo_perdida = coalesce(motivo_perdida, 'otro') where id = c.oportunidad_id;
    return p_id;

  elsif p_accion = 'aceptar' then
    if c.estado not in ('enviada','en_negociacion') then raise exception 'Solo se puede aceptar una cotización enviada'; end if;
    v_cliente := c.cliente_id;
    if v_cliente is null then
      v_cliente := convertir_prospecto(c.prospecto_id);
      update cotizaciones set cliente_id = v_cliente where id = p_id;
    end if;
    update cotizaciones set estado = 'aprobada' where id = p_id;
    update oportunidades set etapa = 'ganada' where id = c.oportunidad_id;
    insert into pedidos_venta (cotizacion_id, cliente_id, vendedor_id, total, estado)
    values (p_id, v_cliente, c.vendedor_id, c.total, 'abierto')
    returning id into v_pedido;
    return v_pedido;
  end if;

  raise exception 'Acción no reconocida: %', p_accion;
end $$;

-- Factura un pedido de venta a partir de las líneas de su cotización.
create or replace function public.facturar_pedido(p_pedido uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare pv pedidos_venta%rowtype; c cotizaciones%rowtype; cl clientes%rowtype; v_fact uuid;
begin
  if not tiene_rol('cobros','contabilidad') then raise exception 'Sin permiso'; end if;
  select * into pv from pedidos_venta where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if pv.factura_id is not null then raise exception 'El pedido ya está facturado'; end if;
  select * into c from cotizaciones where id = pv.cotizacion_id;
  select * into cl from clientes where id = pv.cliente_id;

  insert into facturas (ncf, tipo_ncf, cliente_id, fecha, vence, origen, pedido_id, vendedor_id,
                        subtotal, descuento, itbis, total, saldo, estado)
  values (siguiente_ncf(cl.tipo_ncf), cl.tipo_ncf, cl.id, current_date, current_date + cl.condicion_pago_dias, 'pedido', pv.id,
          pv.vendedor_id, c.subtotal, c.descuento, c.itbis, c.total, c.total, 'emitida')
  returning id into v_fact;

  insert into factura_lineas (factura_id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis, total)
  select v_fact, producto_id, descripcion, cantidad, precio, descuento_pct, itbis, total
    from cotizacion_lineas where cotizacion_id = c.id;

  update pedidos_venta set factura_id = v_fact, estado = 'facturado' where id = pv.id;
  return v_fact;
end $$;

-- ---------------------------------------------------------------------
-- Órdenes de servicio
-- ---------------------------------------------------------------------

-- Registra una orden de servicio con sus insumos:
--  · descuenta el inventario (salida al costo promedio),
--  · actualiza la fecha de reemplazo del componente del equipo,
--  · marca la visita como completada.
-- p = { cliente_id, iguala_id?, equipo_id?, visita_id?, tipo, fecha?, tecnico_id?, trabajo_realizado?, observaciones?,
--       insumos: [{ producto_id, cantidad, cobertura: 'incluido'|'facturable' }] }
create or replace function public.registrar_orden_servicio(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_os uuid; v_cliente uuid := (p->>'cliente_id')::uuid;
  v_iguala uuid := nullif(p->>'iguala_id','')::uuid;
  v_equipo uuid := nullif(p->>'equipo_id','')::uuid;
  v_visita uuid := nullif(p->>'visita_id','')::uuid;
  v_fecha date := coalesce(nullif(p->>'fecha','')::date, current_date);
  v_alm uuid := (select id from almacenes order by nombre limit 1);
  i jsonb; v_prod productos%rowtype; v_cant numeric; v_cob text; v_facturable boolean := false;
begin
  if not tiene_rol('ventas','tecnico') then raise exception 'Sin permiso'; end if;
  if v_cliente is null then raise exception 'Seleccione el cliente'; end if;
  if v_iguala is not null and not exists (select 1 from igualas where id = v_iguala and cliente_id = v_cliente) then
    raise exception 'La iguala no pertenece a este cliente';
  end if;
  if v_equipo is not null and not exists (select 1 from equipos_instalados where id = v_equipo and cliente_id = v_cliente) then
    raise exception 'El equipo no pertenece a este cliente';
  end if;

  insert into ordenes_servicio (cliente_id, iguala_id, equipo_id, visita_id, tipo, fecha, tecnico_id, trabajo_realizado, observaciones, estado)
  values (v_cliente, v_iguala, v_equipo, v_visita, coalesce(nullif(p->>'tipo',''), 'preventivo'), v_fecha,
          nullif(p->>'tecnico_id','')::uuid, nullif(p->>'trabajo_realizado',''), nullif(p->>'observaciones',''), 'completada')
  returning id into v_os;

  for i in select * from jsonb_array_elements(coalesce(p->'insumos','[]'::jsonb)) loop
    continue when nullif(i->>'producto_id','') is null;
    v_cant := coalesce(nullif(i->>'cantidad','')::numeric, 0);
    continue when v_cant <= 0;
    select * into v_prod from productos where id = (i->>'producto_id')::uuid;
    v_cob := case when i->>'cobertura' = 'facturable' or v_iguala is null then 'facturable' else 'incluido' end;
    v_facturable := v_facturable or v_cob = 'facturable';

    insert into orden_servicio_insumos (orden_servicio_id, producto_id, cantidad, costo_unitario, precio_unitario, cobertura)
    values (v_os, v_prod.id, v_cant, v_prod.costo_promedio, v_prod.precio_venta, v_cob);

    if v_prod.tipo <> 'servicio' and v_alm is not null then
      insert into movimientos_inventario (fecha, tipo, producto_id, almacen_id, cantidad, costo_unitario, documento_tipo, documento_id, nota)
      values (v_fecha, 'salida', v_prod.id, v_alm, -v_cant, v_prod.costo_promedio, 'orden_servicio', v_os, 'Consumo en orden de servicio');
    end if;

    if v_equipo is not null then
      update equipo_componentes set ultimo_reemplazo = v_fecha
       where equipo_id = v_equipo and producto_id = v_prod.id;
    end if;
  end loop;

  if v_facturable then
    update ordenes_servicio set estado = 'por_facturar' where id = v_os;
  end if;
  if v_visita is not null then
    update visitas set estado = 'completada', orden_servicio_id = v_os where id = v_visita;
  end if;
  return v_os;
end $$;

-- Factura los insumos facturables (y servicios) de una orden de servicio.
create or replace function public.facturar_orden_servicio(p_os uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare os ordenes_servicio%rowtype; cl clientes%rowtype; v_fact uuid; v_tasa numeric := coalesce((select tasa_itbis from empresa where id = 1), 18);
begin
  if not tiene_rol('cobros','contabilidad') then raise exception 'Sin permiso'; end if;
  select * into os from ordenes_servicio where id = p_os for update;
  if not found then raise exception 'Orden no encontrada'; end if;
  if os.factura_id is not null then raise exception 'La orden ya está facturada'; end if;
  if not exists (select 1 from orden_servicio_insumos where orden_servicio_id = p_os and cobertura = 'facturable' and not facturado) then
    raise exception 'La orden no tiene insumos facturables';
  end if;
  select * into cl from clientes where id = os.cliente_id;

  insert into facturas (ncf, tipo_ncf, cliente_id, fecha, vence, origen, orden_servicio_id, iguala_id, estado)
  values (siguiente_ncf(cl.tipo_ncf), cl.tipo_ncf, cl.id, current_date, current_date + cl.condicion_pago_dias, 'servicio', os.id, os.iguala_id, 'emitida')
  returning id into v_fact;

  insert into factura_lineas (factura_id, producto_id, descripcion, cantidad, precio, itbis, total)
  select v_fact, osi.producto_id, pr.nombre || ' · ' || os.numero, osi.cantidad, osi.precio_unitario,
         case when pr.aplica_itbis then round(osi.cantidad * osi.precio_unitario * v_tasa / 100, 2) else 0 end,
         round(osi.cantidad * osi.precio_unitario, 2) + case when pr.aplica_itbis then round(osi.cantidad * osi.precio_unitario * v_tasa / 100, 2) else 0 end
    from orden_servicio_insumos osi join productos pr on pr.id = osi.producto_id
   where osi.orden_servicio_id = p_os and osi.cobertura = 'facturable' and not osi.facturado;

  update facturas f set
    subtotal = s.sub, itbis = s.itb, total = s.sub + s.itb, saldo = s.sub + s.itb
  from (select coalesce(sum(cantidad * precio),0) sub, coalesce(sum(itbis),0) itb from factura_lineas where factura_id = v_fact) s
  where f.id = v_fact;

  update orden_servicio_insumos set facturado = true where orden_servicio_id = p_os and cobertura = 'facturable';
  update ordenes_servicio set factura_id = v_fact, estado = 'facturada' where id = p_os;
  return v_fact;
end $$;

-- Equipos cubiertos por una iguala (reemplaza la lista completa).
create or replace function public.asignar_equipos_iguala(p_iguala uuid, p_equipos uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare v_cliente uuid;
begin
  if not tiene_rol('ventas') then raise exception 'Sin permiso'; end if;
  select cliente_id into v_cliente from igualas where id = p_iguala;
  if v_cliente is null then raise exception 'Iguala no encontrada'; end if;
  delete from iguala_equipos where iguala_id = p_iguala;
  insert into iguala_equipos (iguala_id, equipo_id)
  select p_iguala, e.id from equipos_instalados e where e.id = any(coalesce(p_equipos, '{}')) and e.cliente_id = v_cliente;
  return (select count(*) from iguala_equipos where iguala_id = p_iguala);
end $$;

revoke execute on function public.guardar_cotizacion(jsonb), public.accion_cotizacion(uuid, text, text),
  public.facturar_pedido(uuid), public.registrar_orden_servicio(jsonb), public.facturar_orden_servicio(uuid),
  public.asignar_equipos_iguala(uuid, uuid[]) from public, anon;
grant execute on function public.guardar_cotizacion(jsonb), public.accion_cotizacion(uuid, text, text),
  public.facturar_pedido(uuid), public.registrar_orden_servicio(jsonb), public.facturar_orden_servicio(uuid),
  public.asignar_equipos_iguala(uuid, uuid[]) to authenticated;
