-- =====================================================================
-- Osmos ERP · Apariencia de los documentos (logo, marca de agua, firma)
-- Se ajusta en Configuración → Apariencia de documentos.
-- =====================================================================

alter table public.empresa add column if not exists logo_url text;
alter table public.empresa add column if not exists marca_agua_url text;
alter table public.empresa add column if not exists firma_url text;
alter table public.empresa add column if not exists marca_agua_visible boolean not null default true;
alter table public.empresa add column if not exists marca_agua_opacidad numeric(4,1) not null default 6
  check (marca_agua_opacidad between 1 and 30);
alter table public.empresa add column if not exists lema text default 'Tecnología del Agua';
alter table public.empresa add column if not exists pie_documentos text default 'Gracias por confiar en Osmos.';
alter table public.empresa add column if not exists subtitulo_cotizacion text default 'Propuesta comercial';

-- Carpeta pública "marca" en Supabase Storage para el logo, la marca de agua y la firma.
-- Cualquiera puede ver las imágenes (salen en los PDF); solo el administrador las cambia.
-- Si el proyecto no tiene Storage (pruebas automáticas), esta parte se omite.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('marca', 'marca', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    drop policy if exists "marca: ver" on storage.objects;
    drop policy if exists "marca: subir" on storage.objects;
    drop policy if exists "marca: cambiar" on storage.objects;
    drop policy if exists "marca: borrar" on storage.objects;
    create policy "marca: ver" on storage.objects for select using (bucket_id = 'marca');
    create policy "marca: subir" on storage.objects for insert to authenticated with check (bucket_id = 'marca' and public.tiene_rol('admin'));
    create policy "marca: cambiar" on storage.objects for update to authenticated using (bucket_id = 'marca' and public.tiene_rol('admin'));
    create policy "marca: borrar" on storage.objects for delete to authenticated using (bucket_id = 'marca' and public.tiene_rol('admin'));
  end if;
end $$;

notify pgrst, 'reload schema';
