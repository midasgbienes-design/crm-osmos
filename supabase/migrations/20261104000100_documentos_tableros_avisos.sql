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
