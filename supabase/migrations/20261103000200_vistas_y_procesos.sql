-- =====================================================================
-- Osmos ERP · Vistas de consulta y procesos automáticos
-- =====================================================================

-- ---------------------------------------------------------------------
-- VISTAS (security_invoker: respetan los permisos del usuario)
-- ---------------------------------------------------------------------

-- Base instalada con alertas de reposición
create view public.v_base_instalada with (security_invoker = true) as
select
  c.id                       as componente_id,
  e.id                       as equipo_id,
  e.serie,
  e.cliente_id,
  cl.codigo                  as cliente_codigo,
  cl.nombre                  as cliente,
  e.descripcion              as equipo,
  e.fecha_instalacion,
  e.garantia_hasta,
  c.descripcion              as componente,
  c.cantidad,
  c.frecuencia_meses,
  c.ultimo_reemplazo,
  c.proximo_reemplazo,
  round(coalesce(p.precio_venta, 0) * c.cantidad * 1.18, 2) as venta_estimada,
  case
    when e.estado = 'en_instalacion' or e.garantia_hasta >= current_date and c.proximo_reemplazo is null then 'en_garantia'
    when c.proximo_reemplazo < current_date then 'vencido'
    when c.proximo_reemplazo <= current_date + 60 then 'proximo'
    else 'al_dia'
  end as estado_reposicion,
  cl.vendedor_id
from public.equipo_componentes c
join public.equipos_instalados e on e.id = c.equipo_id
join public.clientes cl on cl.id = e.cliente_id
left join public.productos p on p.id = c.producto_id
where e.estado <> 'retirado';

-- Antigüedad de saldos por cliente
create view public.v_antiguedad_saldos with (security_invoker = true) as
select
  cl.id as cliente_id,
  cl.codigo,
  cl.nombre as cliente,
  sum(f.saldo) filter (where coalesce(f.vence, f.fecha) >= current_date)                                   as corriente,
  sum(f.saldo) filter (where current_date - coalesce(f.vence, f.fecha) between 1 and 30)                   as d1_30,
  sum(f.saldo) filter (where current_date - coalesce(f.vence, f.fecha) between 31 and 60)                  as d31_60,
  sum(f.saldo) filter (where current_date - coalesce(f.vence, f.fecha) between 61 and 90)                  as d61_90,
  sum(f.saldo) filter (where current_date - coalesce(f.vence, f.fecha) > 90)                               as mas_90,
  sum(f.saldo)                                                                                             as total
from public.facturas f
join public.clientes cl on cl.id = f.cliente_id
where f.saldo > 0 and f.estado not in ('anulada','borrador')
group by cl.id, cl.codigo, cl.nombre;

-- Resumen financiero del cliente (para la ficha 360°)
create view public.v_cliente_resumen with (security_invoker = true) as
select
  cl.id as cliente_id,
  coalesce((select sum(saldo) from public.facturas f where f.cliente_id = cl.id and f.estado not in ('anulada','borrador')), 0) as balance,
  cl.limite_credito,
  coalesce((select sum(total) from public.facturas f where f.cliente_id = cl.id and f.estado not in ('anulada','borrador')), 0) as ventas_acumuladas,
  (select round(avg(r.fecha - f.fecha))
     from public.recibo_aplicaciones ra
     join public.recibos r on r.id = ra.recibo_id
     join public.facturas f on f.id = ra.factura_id
    where f.cliente_id = cl.id) as dias_promedio_pago,
  coalesce((select sum(cuota_mensual) from public.igualas i where i.cliente_id = cl.id and i.estado in ('vigente','por_renovar')), 0) as cuota_igualas
from public.clientes cl;

-- Conversión de prospectos por origen (últimos 90 días)
create view public.v_conversion_origen with (security_invoker = true) as
select
  p.origen,
  count(*)                                                           as prospectos,
  count(*) filter (where p.estado in ('calificado','convertido'))    as calificados,
  count(*) filter (where p.estado = 'convertido')                    as convertidos,
  round(100.0 * count(*) filter (where p.estado = 'convertido') / nullif(count(*), 0), 1) as conversion_pct,
  coalesce(sum((select sum(f.total) from public.facturas f
                 where f.cliente_id = p.cliente_id and f.estado not in ('anulada','borrador'))), 0) as ventas_generadas
from public.prospectos p
where p.fecha >= current_date - 90
group by p.origen;

-- Inventario valorizado con alertas de mínimo
create view public.v_inventario with (security_invoker = true) as
select
  p.id as producto_id, p.codigo, p.nombre, p.tipo, p.categoria, p.unidad,
  coalesce(sum(e.cantidad), 0)                          as existencia,
  p.existencia_minima,
  p.costo_promedio,
  round(coalesce(sum(e.cantidad), 0) * p.costo_promedio, 2) as valor,
  coalesce(sum(e.cantidad), 0) < p.existencia_minima    as bajo_minimo
from public.productos p
left join public.inventario_existencias e on e.producto_id = p.id
where p.tipo <> 'servicio' and p.activo
group by p.id;

-- Rentabilidad de igualas (mes en curso): cuota vs. insumos incluidos
create view public.v_rentabilidad_igualas with (security_invoker = true) as
select
  i.id as iguala_id, i.codigo, cl.nombre as cliente, i.cuota_mensual,
  coalesce(sum(osi.cantidad * osi.costo_unitario) filter (where osi.cobertura = 'incluido'), 0) as costo_insumos,
  i.cuota_mensual - coalesce(sum(osi.cantidad * osi.costo_unitario) filter (where osi.cobertura = 'incluido'), 0) as margen_antes_mano_obra
from public.igualas i
join public.clientes cl on cl.id = i.cliente_id
left join public.ordenes_servicio os on os.iguala_id = i.id and date_trunc('month', os.fecha) = date_trunc('month', current_date)
left join public.orden_servicio_insumos osi on osi.orden_servicio_id = os.id
where i.estado in ('vigente','por_renovar')
group by i.id, cl.nombre;

-- Directorio de empleados sin datos sensibles (visible para todos los usuarios)
create view public.v_directorio as
select e.id, e.codigo, e.nombre, e.cargo, d.nombre as departamento, e.estado
from public.empleados e
left join public.departamentos d on d.id = e.departamento_id;

-- ---------------------------------------------------------------------
-- PROCESOS
-- ---------------------------------------------------------------------

-- Convierte un prospecto en cliente conservando el origen.
create or replace function public.convertir_prospecto(p_prospecto uuid, p_segmento text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_p prospectos%rowtype; v_cliente uuid;
begin
  if not tiene_rol('ventas') then raise exception 'Sin permiso'; end if;
  select * into v_p from prospectos where id = p_prospecto for update;
  if not found then raise exception 'Prospecto no encontrado'; end if;
  if v_p.cliente_id is not null then return v_p.cliente_id; end if;

  insert into clientes (codigo, nombre, segmento, telefono, email, ciudad, vendedor_id, origen, prospecto_id)
  values (siguiente_codigo('cliente'), coalesce(v_p.empresa, v_p.nombre),
          coalesce(p_segmento, v_p.segmento, 'residencial'), v_p.telefono, v_p.email, v_p.ciudad,
          v_p.asignado_a, v_p.origen, v_p.id)
  returning id into v_cliente;

  if v_p.empresa is not null then
    insert into contactos (cliente_id, nombre, telefono, email, principal)
    values (v_cliente, v_p.nombre, v_p.telefono, v_p.email, true);
  end if;

  update prospectos set estado = 'convertido', cliente_id = v_cliente where id = p_prospecto;
  update oportunidades set cliente_id = v_cliente where prospecto_id = p_prospecto and cliente_id is null;
  return v_cliente;
end $$;

-- Facturación recurrente de igualas para un mes (p_periodo = cualquier día del mes).
-- La cuota mensual se registra sin ITBIS; el ITBIS se calcula con la tasa de la empresa.
create or replace function public.generar_facturacion_igualas(p_periodo date default current_date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_mes date := date_trunc('month', p_periodo)::date;
  v_fin date := (date_trunc('month', p_periodo) + interval '1 month - 1 day')::date;
  v_tasa numeric := (select tasa_itbis from empresa where id = 1);
  v_corrida uuid; v_factura uuid; v_ncf text; v_itbis numeric;
  r record; v_n int := 0; v_ok int := 0;
begin
  if not tiene_rol('cobros','contabilidad') then raise exception 'Sin permiso'; end if;

  insert into facturacion_corridas (codigo, periodo)
  values ('FR-' || to_char(v_mes, 'YYYY-MM'), v_mes)
  on conflict (periodo) do update set estado = 'en_proceso'
  returning id into v_corrida;

  for r in
    select i.*, c.tipo_ncf, c.condicion_pago_dias
      from igualas i join clientes c on c.id = i.cliente_id
     where i.estado in ('vigente','por_renovar')
       and i.fecha_inicio <= v_fin
       and (i.fecha_fin is null or i.fecha_fin >= v_mes)
       and not exists (select 1 from facturas f where f.iguala_id = i.id and f.fecha between v_mes and v_fin and f.estado <> 'anulada')
  loop
    v_n := v_n + 1;
    begin
      v_ncf := siguiente_ncf(r.tipo_ncf);
      v_itbis := round(r.cuota_mensual * v_tasa / 100, 2);
      insert into facturas (numero, ncf, tipo_ncf, cliente_id, fecha, vence, origen, iguala_id, corrida_id, vendedor_id,
                            subtotal, itbis, total, saldo, estado)
      values (siguiente_codigo('factura'), v_ncf, r.tipo_ncf, r.cliente_id,
              greatest(v_mes + (r.dia_facturacion - 1), v_mes), v_mes + (r.dia_facturacion - 1) + r.condicion_pago_dias,
              'iguala', r.id, v_corrida, r.vendedor_id,
              r.cuota_mensual, v_itbis, r.cuota_mensual + v_itbis, r.cuota_mensual + v_itbis, 'emitida')
      returning id into v_factura;
      insert into factura_lineas (factura_id, descripcion, cantidad, precio, itbis, total)
      values (v_factura, 'Iguala de mantenimiento ' || r.codigo || ' · ' || to_char(v_mes, 'MM/YYYY'),
              1, r.cuota_mensual, v_itbis, r.cuota_mensual + v_itbis);
      v_ok := v_ok + 1;
    exception when others then
      raise notice 'Iguala % no facturada: %', r.codigo, sqlerrm;
    end;
  end loop;

  update facturacion_corridas fc set
    igualas = v_n + (select count(*) from facturas where corrida_id = v_corrida) - v_ok,
    facturas_generadas = (select count(*) from facturas where corrida_id = v_corrida),
    subtotal = (select coalesce(sum(subtotal),0) from facturas where corrida_id = v_corrida),
    itbis    = (select coalesce(sum(itbis),0) from facturas where corrida_id = v_corrida),
    total    = (select coalesce(sum(total),0) from facturas where corrida_id = v_corrida),
    estado   = case when v_ok = v_n then 'procesada' else 'en_proceso' end
  where fc.id = v_corrida;

  return v_corrida;
end $$;

-- Programa las visitas del mes según la frecuencia de cada iguala.
create or replace function public.programar_visitas(p_periodo date default current_date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_mes date := date_trunc('month', p_periodo)::date;
  v_fin date := (date_trunc('month', p_periodo) + interval '1 month - 1 day')::date;
  r record; d date; v_total int := 0; v_meses int;
begin
  if not tiene_rol('ventas','tecnico') then raise exception 'Sin permiso'; end if;
  for r in select * from igualas where estado in ('vigente','por_renovar') and fecha_inicio <= v_fin loop
    v_meses := (extract(year from age(v_mes, date_trunc('month', r.fecha_inicio)::date)) * 12
              + extract(month from age(v_mes, date_trunc('month', r.fecha_inicio)::date)))::int;
    for d in
      select x::date from generate_series(v_mes, v_fin, case r.frecuencia_visita
                                                          when 'semanal' then interval '7 days'
                                                          when 'quincenal' then interval '14 days'
                                                          else interval '1 month' end) x
    loop
      continue when r.frecuencia_visita = 'bimestral' and v_meses % 2 <> 0;
      continue when r.frecuencia_visita = 'trimestral' and v_meses % 3 <> 0;
      if not exists (select 1 from visitas v where v.iguala_id = r.id and v.fecha_programada = d) then
        insert into visitas (iguala_id, cliente_id, fecha_programada, servicio)
        values (r.id, r.cliente_id, d, 'Mantenimiento preventivo ' || r.frecuencia_visita);
        v_total := v_total + 1;
      end if;
    end loop;
  end loop;
  return v_total;
end $$;

-- Calcula comisiones del mes:
--  · Ventas cobradas (equipos, insumos, servicios) según el esquema del vendedor.
--  · Igualas nuevas del mes (cuota × 3 × porcentaje) para vendedores internos.
--  · Bono por sobrecumplimiento de meta (internos).
--  · Retención de ISR para vendedores externos (no empleados).
create or replace function public.calcular_comisiones(p_periodo date default current_date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_mes date := date_trunc('month', p_periodo)::date;
  v_fin date := (date_trunc('month', p_periodo) + interval '1 month - 1 day')::date;
  v_n int;
begin
  if not tiene_rol('contabilidad') then raise exception 'Sin permiso'; end if;

  delete from comisiones where periodo = v_mes and estado = 'calculada';

  -- 1. Cobros aplicados en el mes (base sin ITBIS, proporcional a lo cobrado)
  insert into comisiones (vendedor_id, periodo, esquema_id, factura_id, base, porcentaje, monto, retencion_isr, nota)
  select v.id, v_mes, es.id, f.id,
         round(sum(ra.monto) * (f.subtotal - f.descuento) / nullif(f.total, 0), 2),
         es.porcentaje,
         round(sum(ra.monto) * (f.subtotal - f.descuento) / nullif(f.total, 0) * es.porcentaje / 100, 2),
         case when v.tipo <> 'interno'
              then round(sum(ra.monto) * (f.subtotal - f.descuento) / nullif(f.total, 0) * es.porcentaje / 100 * coalesce(v.retencion_isr_pct, 10) / 100, 2)
              else 0 end,
         'Cobro de ' || f.numero
    from recibo_aplicaciones ra
    join recibos r   on r.id = ra.recibo_id and r.fecha between v_mes and v_fin and r.estado <> 'anulado'
    join facturas f  on f.id = ra.factura_id and f.origen <> 'iguala'
    join vendedores v on v.id = f.vendedor_id and v.activo
    join esquemas_comision es on es.id = coalesce(v.esquema_id, (select id from esquemas_comision where aplica_a = 'equipos' and activo limit 1))
   group by v.id, v.tipo, v.retencion_isr_pct, es.id, es.porcentaje, f.id, f.subtotal, f.descuento, f.total;

  -- 2. Igualas nuevas del mes (internos)
  insert into comisiones (vendedor_id, periodo, esquema_id, iguala_id, base, porcentaje, monto, nota)
  select v.id, v_mes, es.id, i.id, i.cuota_mensual * 3, es.porcentaje, round(i.cuota_mensual * 3 * es.porcentaje / 100, 2),
         'Iguala nueva ' || i.codigo
    from igualas i
    join vendedores v on v.id = i.vendedor_id and v.tipo = 'interno' and v.activo
    join esquemas_comision es on es.aplica_a = 'iguala_nueva' and es.activo
   where i.fecha_inicio between v_mes and v_fin and i.estado <> 'cancelada';

  -- 3. Bono por sobrecumplimiento (internos con meta)
  insert into comisiones (vendedor_id, periodo, esquema_id, base, porcentaje, monto, nota)
  select v.id, v_mes, es.id, ventas.total, es.porcentaje, round(ventas.total * es.porcentaje / 100, 2), 'Bono por meta'
    from vendedores v
    join esquemas_comision es on es.aplica_a = 'bono_meta' and es.activo
    join lateral (select coalesce(sum(f.subtotal - f.descuento), 0) as total
                    from facturas f
                   where f.vendedor_id = v.id and f.fecha between v_mes and v_fin and f.estado not in ('anulada','borrador')) ventas on true
   where v.tipo = 'interno' and v.activo and v.meta_mensual > 0 and ventas.total > v.meta_mensual;

  select count(*) into v_n from comisiones where periodo = v_mes and estado = 'calculada';
  return v_n;
end $$;

-- Liquida comisiones aprobadas:
--  · internos  → se pagan vía nómina (se crea la liquidación para la nómina complementaria).
--  · externos  → se crea una cuenta por pagar por vendedor, neta de retención ISR.
create or replace function public.liquidar_comisiones(p_periodo date, p_tipo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_mes date := date_trunc('month', p_periodo)::date;
  v_liq uuid; r record;
begin
  if not tiene_rol('contabilidad') then raise exception 'Sin permiso'; end if;
  if p_tipo not in ('interno','externo') then raise exception 'Tipo inválido'; end if;

  insert into liquidaciones_comision (codigo, periodo, tipo, forma_pago)
  values ('LC-' || case when p_tipo = 'externo' then 'EXT-' else '' end || to_char(v_mes, 'YYYY-MM'),
          v_mes, p_tipo, case when p_tipo = 'externo' then 'cuentas_por_pagar' else 'nomina' end)
  returning id into v_liq;

  update comisiones c set liquidacion_id = v_liq, estado = 'liquidada'
    from vendedores v
   where v.id = c.vendedor_id and c.periodo = v_mes and c.estado = 'aprobada'
     and ((p_tipo = 'interno' and v.tipo = 'interno') or (p_tipo = 'externo' and v.tipo <> 'interno'));

  update liquidaciones_comision l set
    total_bruto   = coalesce((select sum(monto) from comisiones where liquidacion_id = v_liq), 0),
    retencion_isr = coalesce((select sum(retencion_isr) from comisiones where liquidacion_id = v_liq), 0),
    neto          = coalesce((select sum(monto - retencion_isr) from comisiones where liquidacion_id = v_liq), 0)
  where l.id = v_liq;

  if p_tipo = 'externo' then
    for r in
      select vendedor_id, sum(monto) as bruto, sum(retencion_isr) as ret
        from comisiones where liquidacion_id = v_liq group by vendedor_id
    loop
      insert into facturas_suplidor (numero, tipo_ncf, vendedor_id, concepto, fecha, vence, subtotal, retencion_isr, total, saldo, estado)
      select siguiente_codigo('factura_suplidor'), coalesce(v.comprobante, 'B11'), v.id,
             'Comisiones ' || to_char(v_mes, 'MM/YYYY'), current_date, current_date + 7,
             r.bruto, r.ret, r.bruto - r.ret, r.bruto - r.ret, 'por_aprobar'
        from vendedores v where v.id = r.vendedor_id;
    end loop;
  end if;

  return v_liq;
end $$;

-- Crea prospectos de reposición a partir de la base instalada (vencidos o en los próximos 30 días).
create or replace function public.generar_prospectos_reposicion()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  if not tiene_rol('ventas') then raise exception 'Sin permiso'; end if;
  for r in
    select b.*, cl.telefono, cl.email, cl.segmento
      from v_base_instalada b join clientes cl on cl.id = b.cliente_id
     where b.proximo_reemplazo <= current_date + 30
       and not exists (select 1 from prospectos p
                        where p.equipo_origen_id = b.equipo_id and p.estado in ('nuevo','contactado','calificado'))
  loop
    insert into prospectos (codigo, nombre, empresa, telefono, email, segmento, origen, equipo_origen_id,
                            referido_por_cliente_id, cliente_id, interes, asignado_a, proxima_accion, estado)
    values (siguiente_codigo('prospecto'), r.cliente, r.cliente, r.telefono, r.email, r.segmento, 'base_instalada',
            r.equipo_id, null, r.cliente_id, 'Reposición: ' || r.componente || ' (' || r.equipo || ')',
            r.vendedor_id, 'Cotizar reposición', 'calificado');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Tareas diarias: vencimientos, renovaciones y reposiciones.
create or replace function public.tareas_diarias()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_venc int; v_ren int; v_rep int;
begin
  if not tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  update facturas set estado = 'vencida'
   where vence < current_date and saldo > 0 and estado in ('emitida','parcial');
  get diagnostics v_venc = row_count;

  update igualas set estado = 'por_renovar'
   where estado = 'vigente' and fecha_fin is not null and fecha_fin <= current_date + 30;
  get diagnostics v_ren = row_count;

  v_rep := generar_prospectos_reposicion();

  return jsonb_build_object('facturas_vencidas', v_venc, 'igualas_por_renovar', v_ren, 'prospectos_reposicion', v_rep);
end $$;

-- Programación automática (requiere habilitar la extensión pg_cron en Supabase):
--   select cron.schedule('osmos-tareas-diarias', '0 10 * * *', $$select public.tareas_diarias()$$);
--   select cron.schedule('osmos-facturacion-igualas', '0 11 1 * *', $$select public.generar_facturacion_igualas(current_date)$$);
-- Las tareas programadas corren como el dueño de la base de datos, y tiene_rol()
-- las reconoce como procesos internos, por lo que no requieren un usuario.
