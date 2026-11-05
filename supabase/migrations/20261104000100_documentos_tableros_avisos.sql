-- =====================================================================
-- Osmos ERP · Documentos imprimibles, tableros, importación, auditoría,
-- usuarios y avisos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Datos de la empresa para los documentos
-- ---------------------------------------------------------------------
alter table public.empresa add column if not exists sitio_web text;
alter table public.empresa add column if not exists whatsapp text;
alter table public.empresa add column if not exists condiciones_cotizacion text
  default 'Precios en pesos dominicanos. Forma de pago: 50% de avance y 50% contra entrega. Garantía según fabricante. Tiempo de instalación a coordinar.';
alter table public.empresa add column if not exists condiciones_factura text
  default 'Favor emitir el pago a nombre de Osmos Tecnología del Agua.';
alter table public.empresa add column if not exists instrucciones_pago text;

update public.empresa
   set condiciones_cotizacion = coalesce(condiciones_cotizacion, 'Precios en pesos dominicanos. Forma de pago: 50% de avance y 50% contra entrega. Garantía según fabricante. Tiempo de instalación a coordinar.'),
       condiciones_factura = coalesce(condiciones_factura, 'Favor emitir el pago a nombre de Osmos Tecnología del Agua.')
 where id = 1;

-- ---------------------------------------------------------------------
-- 2. Tableros de gerencia
-- Una sola consulta que arma todos los indicadores. Respeta los permisos
-- del usuario (security invoker): cada rol ve solo lo que puede leer.
-- ---------------------------------------------------------------------
create or replace function public.tablero_gerencia(p_mes date default current_date)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_ini date := date_trunc('month', p_mes)::date;
  v_fin date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_lunes date := date_trunc('week', current_date)::date;
  v_itbis numeric := coalesce((select tasa_itbis from empresa where id = 1), 18) / 100;
  r jsonb := '{}'::jsonb;
begin
  -- Indicadores principales del mes
  r := r || jsonb_build_object('indicadores', jsonb_build_object(
    'facturado_mes', coalesce((select sum(subtotal - descuento) from facturas
                                where fecha >= v_ini and fecha < v_fin and estado not in ('anulada','borrador')), 0),
    'facturado_mes_anterior', coalesce((select sum(subtotal - descuento) from facturas
                                where fecha >= (v_ini - interval '1 month')::date and fecha < v_ini and estado not in ('anulada','borrador')), 0),
    'cobrado_mes', coalesce((select sum(monto) from recibos where fecha >= v_ini and fecha < v_fin and estado <> 'anulado'), 0),
    'cartera_total', coalesce((select sum(saldo) from facturas where saldo > 0 and estado not in ('anulada','borrador')), 0),
    'cartera_vencida', coalesce((select sum(saldo) from facturas where saldo > 0 and estado not in ('anulada','borrador')
                                   and coalesce(vence, fecha) < current_date), 0),
    'igualas_vigentes', (select count(*) from igualas where estado in ('vigente','por_renovar')),
    'ingreso_recurrente', coalesce((select sum(cuota_mensual) from igualas where estado in ('vigente','por_renovar')), 0),
    'pipeline', coalesce((select sum(valor_estimado) from oportunidades where etapa not in ('ganada','perdida')), 0),
    'pipeline_ponderado', coalesce((select sum(valor_estimado * probabilidad / 100.0) from oportunidades where etapa not in ('ganada','perdida')), 0),
    'cotizaciones_abiertas', coalesce((select sum(total) from cotizaciones where estado in ('borrador','por_aprobar','enviada','en_negociacion')), 0),
    'por_pagar', coalesce((select sum(saldo) from facturas_suplidor where saldo > 0 and estado not in ('anulada','pagada')), 0)
  ));

  -- Ventas del mes contra la meta de cada vendedor (montos sin ITBIS)
  r := r || jsonb_build_object('vendedores', coalesce((
    select jsonb_agg(x order by x.facturado desc) from (
      select v.nombre, v.tipo, v.meta_mensual as meta,
             coalesce(sum(f.subtotal - f.descuento), 0) as facturado,
             count(f.id) as facturas,
             coalesce(sum(f.total - f.saldo), 0) as cobrado
        from vendedores v
        left join facturas f on f.vendedor_id = v.id and f.fecha >= v_ini and f.fecha < v_fin
                            and f.estado not in ('anulada','borrador')
       where v.activo
       group by v.id
    ) x), '[]'::jsonb));

  -- Facturado y cobrado de los últimos 12 meses
  r := r || jsonb_build_object('meses', coalesce((
    select jsonb_agg(jsonb_build_object(
             'mes', m::date,
             'facturado', coalesce((select sum(total) from facturas where date_trunc('month', fecha) = m and estado not in ('anulada','borrador')), 0),
             'cobrado', coalesce((select sum(monto) from recibos where date_trunc('month', fecha) = m and estado <> 'anulado'), 0)
           ) order by m)
      from generate_series(date_trunc('month', p_mes) - interval '11 months', date_trunc('month', p_mes), interval '1 month') m
  ), '[]'::jsonb));

  -- Cartera por antigüedad
  r := r || jsonb_build_object('cartera', (
    select jsonb_build_object(
      'corriente', coalesce(sum(corriente), 0), 'd1_30', coalesce(sum(d1_30), 0), 'd31_60', coalesce(sum(d31_60), 0),
      'd61_90', coalesce(sum(d61_90), 0), 'mas_90', coalesce(sum(mas_90), 0), 'total', coalesce(sum(total), 0))
      from v_antiguedad_saldos));
  r := r || jsonb_build_object('deudores', coalesce((
    select jsonb_agg(x) from (
      select cliente_id, cliente, total, coalesce(d1_30,0) + coalesce(d31_60,0) + coalesce(d61_90,0) + coalesce(mas_90,0) as vencido
        from v_antiguedad_saldos order by total desc limit 8) x), '[]'::jsonb));

  -- Rentabilidad de igualas: cuota contra insumos incluidos (promedio mensual de los últimos 90 días)
  r := r || jsonb_build_object('igualas', coalesce((
    select jsonb_agg(x order by x.margen_pct nulls last) from (
      select i.id, i.codigo, c.nombre as cliente, i.cuota_mensual as cuota,
             round(coalesce(sum(osi.cantidad * osi.costo_unitario) filter (where osi.cobertura = 'incluido'), 0) / 3, 2) as costo_mensual,
             count(distinct os.id) as servicios_90d,
             round(i.cuota_mensual - coalesce(sum(osi.cantidad * osi.costo_unitario) filter (where osi.cobertura = 'incluido'), 0) / 3, 2) as margen,
             round(100 * (i.cuota_mensual - coalesce(sum(osi.cantidad * osi.costo_unitario) filter (where osi.cobertura = 'incluido'), 0) / 3)
                   / nullif(i.cuota_mensual, 0), 1) as margen_pct
        from igualas i
        join clientes c on c.id = i.cliente_id
        left join ordenes_servicio os on os.iguala_id = i.id and os.fecha >= current_date - 90 and os.estado <> 'cancelada'
        left join orden_servicio_insumos osi on osi.orden_servicio_id = os.id
       where i.estado in ('vigente','por_renovar')
       group by i.id, c.nombre
    ) x), '[]'::jsonb));

  -- Flujo de caja proyectado: 8 semanas
  r := r || jsonb_build_object('flujo', coalesce((
    with entradas as (
      -- Facturas por vencer (lo ya vencido se muestra aparte: no es seguro cobrarlo en fecha)
      select coalesce(vence, fecha) as dia, saldo as monto, 'facturas' as origen
        from facturas where saldo > 0 and estado not in ('anulada','borrador') and coalesce(vence, fecha) >= current_date
      union all
      -- Igualas: próxima facturación de cada mes, cobrada según la condición de pago del cliente
      select (make_date(extract(year from m)::int, extract(month from m)::int, i.dia_facturacion) + c.condicion_pago_dias)::date,
             round(i.cuota_mensual * (1 + v_itbis), 2), 'igualas'
        from igualas i
        join clientes c on c.id = i.cliente_id
        cross join generate_series(date_trunc('month', current_date), date_trunc('month', current_date) + interval '2 months', interval '1 month') m
       where i.estado in ('vigente','por_renovar')
         and make_date(extract(year from m)::int, extract(month from m)::int, i.dia_facturacion) > current_date
         and not exists (select 1 from facturas f where f.iguala_id = i.id and date_trunc('month', f.fecha) = m and f.estado <> 'anulada')
    ),
    salidas as (
      select greatest(coalesce(vence, fecha), current_date) as dia, saldo as monto, 'suplidores' as origen
        from facturas_suplidor where saldo > 0 and estado not in ('anulada','pagada')
      union all
      select greatest((periodo + interval '1 month')::date, current_date), neto, 'comisiones'
        from liquidaciones_comision where estado in ('por_aprobar','aprobada')
      union all
      select greatest(coalesce(fecha_pago, periodo_hasta), current_date), neto, 'nomina'
        from nominas where estado in ('borrador','por_aprobar','aprobada')
    ),
    semanas as (select generate_series(0, 7) as n)
    select jsonb_agg(jsonb_build_object(
             'semana', (v_lunes + s.n * 7),
             'entradas', coalesce((select sum(monto) from entradas e where e.dia >= v_lunes + s.n * 7 and e.dia < v_lunes + s.n * 7 + 7), 0),
             'entradas_igualas', coalesce((select sum(monto) from entradas e where e.origen = 'igualas' and e.dia >= v_lunes + s.n * 7 and e.dia < v_lunes + s.n * 7 + 7), 0),
             'salidas', coalesce((select sum(monto) from salidas e where e.dia >= v_lunes + s.n * 7 and e.dia < v_lunes + s.n * 7 + 7), 0)
           ) order by s.n)
      from semanas s
  ), '[]'::jsonb));

  return r;
end $$;

grant execute on function public.tablero_gerencia(date) to authenticated;
revoke execute on function public.tablero_gerencia(date) from anon, public;

-- ---------------------------------------------------------------------
-- 3. Historial de cambios en más tablas
-- (facturas, recibos, pagos, asientos, comisiones, nóminas, igualas y
--  cotizaciones ya se auditaban desde el esquema base)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['perfiles','clientes','contactos','prospectos','oportunidades','vendedores','esquemas_comision',
                           'productos','suplidores','empleados','equipos_instalados','equipo_componentes','pedidos_venta',
                           'ordenes_servicio','secuencias_ncf','cuentas_bancarias','ordenes_compra','solicitudes_ausencia']
  loop
    if not exists (select 1 from pg_trigger where tgname = 'auditar' and tgrelid = ('public.' || t)::regclass) then
      execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function public.tg_auditar()', t);
    end if;
  end loop;
end $$;

create index if not exists auditoria_tabla_fecha on public.auditoria (tabla, creado_en desc);
create index if not exists auditoria_registro on public.auditoria (registro_id);
create index if not exists auditoria_usuario on public.auditoria (usuario_id, creado_en desc);

-- ---------------------------------------------------------------------
-- 4. Usuarios del sistema (solo administrador)
-- ---------------------------------------------------------------------
create or replace function public.usuarios_sistema()
returns table (id uuid, nombre text, email text, rol text, activo boolean, creado timestamptz,
               ultimo_acceso timestamptz, confirmado boolean, vendedor text, empleado text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not tiene_rol('admin') then raise exception 'Solo el administrador puede ver los usuarios'; end if;
  return query
    select p.id, p.nombre, coalesce(p.email, u.email::text), p.rol, p.activo, p.created_at,
           u.last_sign_in_at, u.email_confirmed_at is not null,
           (select v.nombre from vendedores v where v.perfil_id = p.id limit 1),
           (select e.nombre from empleados e where e.perfil_id = p.id limit 1)
      from perfiles p
      left join auth.users u on u.id = p.id
     order by p.activo desc, p.nombre;
end $$;

grant execute on function public.usuarios_sistema() to authenticated;
revoke execute on function public.usuarios_sistema() from anon, public;

-- Nadie puede quitarse a sí mismo el rol de administrador ni desactivarse
-- (evita quedarse sin acceso al sistema).
create or replace function public.tg_proteger_admin()
returns trigger language plpgsql as $$
begin
  if old.id = auth.uid() and old.rol = 'admin' and (new.rol <> 'admin' or not new.activo) then
    raise exception 'No puede quitarse su propio rol de administrador ni desactivar su usuario';
  end if;
  return new;
end $$;

drop trigger if exists proteger_admin on public.perfiles;
create trigger proteger_admin before update on public.perfiles
  for each row execute function public.tg_proteger_admin();
