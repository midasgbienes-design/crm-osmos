-- =====================================================================
-- Osmos ERP · Códigos automáticos
-- Cada registro nuevo recibe su código (CL-0001, FT-0001, ...) sin que la
-- aplicación tenga que generarlo.
-- =====================================================================

alter table public.clientes            alter column codigo set default public.siguiente_codigo('cliente');
alter table public.prospectos          alter column codigo set default public.siguiente_codigo('prospecto');
alter table public.oportunidades       alter column codigo set default public.siguiente_codigo('oportunidad');
alter table public.cotizaciones        alter column numero set default public.siguiente_codigo('cotizacion');
alter table public.pedidos_venta       alter column numero set default public.siguiente_codigo('pedido');
alter table public.igualas             alter column codigo set default public.siguiente_codigo('iguala');
alter table public.ordenes_servicio    alter column numero set default public.siguiente_codigo('orden_servicio');
alter table public.facturas            alter column numero set default public.siguiente_codigo('factura');
alter table public.recibos             alter column numero set default public.siguiente_codigo('recibo');
alter table public.notas_credito       alter column numero set default public.siguiente_codigo('nota_credito');
alter table public.facturas_suplidor   alter column numero set default public.siguiente_codigo('factura_suplidor');
alter table public.pagos               alter column numero set default public.siguiente_codigo('pago');
alter table public.anticipos_suplidor  alter column numero set default public.siguiente_codigo('anticipo');
alter table public.solicitudes_compra  alter column numero set default public.siguiente_codigo('solicitud_compra');
alter table public.ordenes_compra      alter column numero set default public.siguiente_codigo('orden_compra');
alter table public.recepciones         alter column numero set default public.siguiente_codigo('recepcion');
alter table public.asientos            alter column numero set default public.siguiente_codigo('asiento');
alter table public.nominas             alter column codigo set default public.siguiente_codigo('nomina');
alter table public.empleados           alter column codigo set default public.siguiente_codigo('empleado');
alter table public.suplidores          alter column codigo set default public.siguiente_codigo('suplidor');
alter table public.productos           alter column codigo set default public.siguiente_codigo('producto');

-- Vendedores: el prefijo depende del tipo (VD- internos, VE- externos y referidores).
create or replace function public.tg_codigo_vendedor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.codigo is null or new.codigo = '' then
    new.codigo := siguiente_codigo(case when new.tipo = 'interno' then 'vendedor_interno' else 'vendedor_externo' end);
  end if;
  return new;
end $$;

alter table public.vendedores alter column codigo drop not null;
create trigger codigo_vendedor before insert on public.vendedores
  for each row execute function public.tg_codigo_vendedor();
alter table public.vendedores add constraint vendedores_codigo_requerido check (codigo is not null) not valid;
