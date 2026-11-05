-- Pruebas rápidas después de aplicar migraciones y datos de demostración.
-- Cualquier error detiene la verificación (psql -v ON_ERROR_STOP=1).
\set ON_ERROR_STOP 1
select 'tablero' as prueba, jsonb_typeof(public.tablero_gerencia()) = 'object' as ok;
select 'avisos' as prueba, count(*) >= 0 as ok from public.avisos();
select 'usuarios' as prueba, count(*) >= 0 as ok from public.usuarios_sistema();
do $$
begin
  if (select count(*) from public.clientes) = 0 then raise exception 'Los datos de demostración no cargaron clientes'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'auditar' and tgrelid = 'public.clientes'::regclass) then
    raise exception 'Falta la auditoría en clientes';
  end if;
end $$;
