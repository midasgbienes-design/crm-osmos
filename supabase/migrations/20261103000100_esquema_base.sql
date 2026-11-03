-- =====================================================================
-- Osmos ERP · Esquema base
-- Comercial, Igualas, Comisiones, Compras e inventario, Suplidores,
-- Cobros, Pagos, Contabilidad y Recursos Humanos.
-- Diseñado para Supabase (PostgreSQL 15+).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Consecutivos para códigos legibles (CL-0001, FT-0001, etc.)
create table public.consecutivos (
  clave      text primary key,
  prefijo    text not null,
  ultimo     integer not null default 0,
  relleno    integer not null default 4
);

create or replace function public.siguiente_codigo(p_clave text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_prefijo text; v_ultimo integer; v_relleno integer;
begin
  update consecutivos set ultimo = ultimo + 1
   where clave = p_clave
   returning prefijo, ultimo, relleno into v_prefijo, v_ultimo, v_relleno;
  if not found then
    raise exception 'Consecutivo % no existe', p_clave;
  end if;
  return v_prefijo || lpad(v_ultimo::text, v_relleno, '0');
end $$;

-- ---------------------------------------------------------------------
-- Usuarios, roles y configuración
-- ---------------------------------------------------------------------

create table public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  email       text,
  rol         text not null default 'consulta'
              check (rol in ('admin','gerencia','ventas','vendedor_externo','tecnico',
                             'cobros','pagos','compras','almacen','contabilidad','rrhh','consulta')),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.rol_actual()
returns text language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid() and activo
$$;

-- admin y gerencia siempre tienen acceso.
-- Procesos internos (pg_cron, SQL editor) y la clave service_role también pasan.
create or replace function public.tiene_rol(variadic p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when session_user not in ('authenticator','anon','authenticated') then true
    when coalesce(auth.jwt() ->> 'role', '') = 'service_role' then true
    else coalesce(
      (select rol = any(p_roles) or rol in ('admin','gerencia')
         from perfiles where id = auth.uid() and activo),
      false)
  end
$$;

-- Crea el perfil automáticamente cuando se registra un usuario.
create or replace function public.tg_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_nuevo_usuario();

create table public.empresa (
  id              integer primary key default 1 check (id = 1),
  razon_social    text not null default 'Osmos Tecnología del Agua',
  nombre_comercial text not null default 'Osmos',
  rnc             text,
  direccion       text,
  ciudad          text default 'Santiago de los Caballeros',
  telefono        text,
  email           text,
  moneda          text not null default 'DOP',
  tasa_itbis      numeric(5,2) not null default 18.00
);

-- Parámetros configurables (tasas TSS, escalas ISR, etc.)
create table public.parametros (
  clave        text primary key,
  valor        numeric,
  texto        text,
  descripcion  text,
  vigente_desde date default current_date
);

create table public.auditoria (
  id          bigint generated always as identity primary key,
  tabla       text not null,
  registro_id uuid,
  accion      text not null,
  usuario_id  uuid default auth.uid(),
  antes       jsonb,
  despues     jsonb,
  creado_en   timestamptz not null default now()
);

create or replace function public.tg_auditar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (tabla, registro_id, accion, antes, despues)
  values (tg_table_name,
          coalesce((case when tg_op = 'DELETE' then old.id else new.id end), null),
          tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
-- RECURSOS HUMANOS (va primero: técnicos y vendedores internos son empleados)
-- ---------------------------------------------------------------------

create table public.departamentos (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique
);

create table public.empleados (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null unique,
  nombre               text not null,
  cedula               text unique,
  cargo                text,
  departamento_id      uuid references public.departamentos(id),
  fecha_ingreso        date,
  periodo_prueba_hasta date,
  tipo_contrato        text default 'indefinido' check (tipo_contrato in ('indefinido','temporal','prueba')),
  salario_mensual      numeric(14,2) not null default 0,
  forma_pago           text default 'transferencia',
  banco                text,
  cuenta_bancaria      text,
  afp                  text,
  ars                  text,
  telefono             text,
  email                text,
  perfil_id            uuid references public.perfiles(id),
  estado               text not null default 'activo' check (estado in ('activo','vacaciones','licencia','inactivo')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.asistencia (
  id              uuid primary key default gen_random_uuid(),
  empleado_id     uuid not null references public.empleados(id),
  fecha           date not null,
  entrada         time,
  salida          time,
  horas_normales  numeric(5,2) default 0,
  horas_extras    numeric(5,2) default 0,
  estado          text default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  unique (empleado_id, fecha)
);

create table public.solicitudes_ausencia (
  id           uuid primary key default gen_random_uuid(),
  empleado_id  uuid not null references public.empleados(id),
  tipo         text not null check (tipo in ('vacaciones','permiso','licencia_medica','licencia_maternidad','otro')),
  desde        date not null,
  hasta        date not null,
  dias         numeric(5,1) not null,
  motivo       text,
  aprobador_id uuid references public.perfiles(id),
  estado       text not null default 'por_aprobar' check (estado in ('por_aprobar','aprobada','rechazada','cancelada')),
  created_at   timestamptz not null default now()
);

create table public.nominas (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique,
  periodo_desde  date not null,
  periodo_hasta  date not null,
  tipo           text not null check (tipo in ('quincenal','mensual','complementaria','comisiones','regalia','bonificacion')),
  bruto          numeric(14,2) not null default 0,
  deducciones    numeric(14,2) not null default 0,
  neto           numeric(14,2) not null default 0,
  estado         text not null default 'borrador' check (estado in ('borrador','por_aprobar','aprobada','pagada','anulada')),
  fecha_pago     date,
  created_at     timestamptz not null default now()
);

create table public.nomina_detalle (
  id                 uuid primary key default gen_random_uuid(),
  nomina_id          uuid not null references public.nominas(id) on delete cascade,
  empleado_id        uuid not null references public.empleados(id),
  salario            numeric(14,2) not null default 0,
  horas_extras_monto numeric(14,2) not null default 0,
  comisiones         numeric(14,2) not null default 0,
  otros_ingresos     numeric(14,2) not null default 0,
  sfs                numeric(14,2) not null default 0,
  afp                numeric(14,2) not null default 0,
  isr                numeric(14,2) not null default 0,
  otros_descuentos   numeric(14,2) not null default 0,
  neto               numeric(14,2) not null default 0,
  unique (nomina_id, empleado_id)
);

create table public.vacantes (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  departamento_id  uuid references public.departamentos(id),
  responsable_id   uuid references public.perfiles(id),
  fecha_objetivo   date,
  estado           text not null default 'abierta' check (estado in ('abierta','entrevistas','cubierta','cancelada')),
  created_at       timestamptz not null default now()
);

create table public.candidatos (
  id          uuid primary key default gen_random_uuid(),
  vacante_id  uuid not null references public.vacantes(id) on delete cascade,
  nombre      text not null,
  telefono    text,
  email       text,
  etapa       text not null default 'recibido' check (etapa in ('recibido','entrevista','prueba','oferta','contratado','descartado')),
  notas       text
);

-- ---------------------------------------------------------------------
-- VENDEDORES Y COMISIONES (internos = empleados; externos = comisionistas)
-- ---------------------------------------------------------------------

create table public.esquemas_comision (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  nombre      text not null,
  aplica_a    text not null check (aplica_a in ('equipos','iguala_nueva','renovacion','insumos','bono_meta','externo','referidor')),
  base        text not null check (base in ('cobrado_sin_itbis','cuota_x3','cuota_x12','ventas_mes')),
  porcentaje  numeric(6,3) not null,
  condicion   text,
  activo      boolean not null default true
);

create table public.vendedores (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique,
  nombre              text not null,
  tipo                text not null check (tipo in ('interno','externo','referidor')),
  empleado_id         uuid references public.empleados(id),
  perfil_id           uuid references public.perfiles(id),
  zona                text,
  meta_mensual        numeric(14,2),
  -- Datos de vendedores externos (no empleados)
  cedula_rnc          text,
  comprobante         text check (comprobante in ('B01','B11')),
  retencion_isr_pct   numeric(5,2) default 10.00,
  banco               text,
  cuenta_pago         text,
  esquema_id          uuid references public.esquemas_comision(id),
  acuerdo_firmado_en  date,
  acuerdo_url         text,
  activo              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint vendedor_interno_es_empleado check (tipo <> 'interno' or empleado_id is not null)
);

-- ---------------------------------------------------------------------
-- PRODUCTOS (equipos, insumos, repuestos y servicios)
-- ---------------------------------------------------------------------

create table public.productos (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,
  nombre             text not null,
  tipo               text not null check (tipo in ('equipo','insumo','repuesto','servicio')),
  categoria          text,
  unidad             text not null default 'unidad',
  precio_venta       numeric(14,2) not null default 0,
  costo_promedio     numeric(14,2) not null default 0,
  aplica_itbis       boolean not null default true,
  existencia_minima  numeric(12,2) not null default 0,
  vida_util_meses    integer,          -- para componentes con reemplazo periódico
  activo             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- COMERCIAL (CRM)
-- ---------------------------------------------------------------------

create table public.clientes (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null unique,
  nombre               text not null,
  tipo_persona         text not null default 'juridica' check (tipo_persona in ('fisica','juridica')),
  rnc_cedula           text,
  segmento             text not null check (segmento in ('residencial','comercial','industrial')),
  sector               text,
  direccion            text,
  ciudad               text,
  telefono             text,
  email                text,
  vendedor_id          uuid references public.vendedores(id),
  origen               text check (origen in ('web','whatsapp','vendedor_externo','referido_cliente','base_instalada','llamada','evento','otro')),
  prospecto_id         uuid,
  limite_credito       numeric(14,2) not null default 0,
  condicion_pago_dias  integer not null default 30,
  tipo_ncf             text not null default 'B01' check (tipo_ncf in ('B01','B02','B14','B15','E31','E32')),
  estado               text not null default 'activo' check (estado in ('activo','inactivo','bloqueado')),
  notas                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.contactos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  nombre      text not null,
  rol         text,
  telefono    text,
  email       text,
  principal   boolean not null default false
);

create table public.prospectos (
  id                        uuid primary key default gen_random_uuid(),
  codigo                    text not null unique,
  fecha                     date not null default current_date,
  nombre                    text not null,
  empresa                   text,
  telefono                  text,
  email                     text,
  ciudad                    text,
  segmento                  text check (segmento in ('residencial','comercial','industrial')),
  origen                    text not null check (origen in ('web','whatsapp','vendedor_externo','referido_cliente','base_instalada','llamada','evento','otro')),
  referido_por_vendedor_id  uuid references public.vendedores(id),
  referido_por_cliente_id   uuid references public.clientes(id),
  equipo_origen_id          uuid,
  interes                   text,
  asignado_a                uuid references public.vendedores(id),
  proxima_accion            text,
  proxima_fecha             date,
  estado                    text not null default 'nuevo' check (estado in ('nuevo','contactado','calificado','convertido','descartado')),
  motivo_descarte           text,
  cliente_id                uuid references public.clientes(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.clientes
  add constraint clientes_prospecto_fk foreign key (prospecto_id) references public.prospectos(id);

create table public.oportunidades (
  id                     uuid primary key default gen_random_uuid(),
  codigo                 text not null unique,
  titulo                 text not null,
  cliente_id             uuid references public.clientes(id),
  prospecto_id           uuid references public.prospectos(id),
  vendedor_id            uuid references public.vendedores(id),
  etapa                  text not null default 'prospecto'
                         check (etapa in ('prospecto','visita_tecnica','analisis_agua','cotizacion_enviada','negociacion','ganada','perdida')),
  valor_estimado         numeric(14,2) not null default 0,
  probabilidad           integer check (probabilidad between 0 and 100),
  fecha_cierre_estimada  date,
  proxima_accion         text,
  motivo_perdida         text check (motivo_perdida in ('precio','competidor','tiempo','sin_presupuesto','sin_respuesta','otro')),
  competidor             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint oportunidad_tiene_cliente_o_prospecto check (cliente_id is not null or prospecto_id is not null)
);

create table public.actividades (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('llamada','visita','correo','whatsapp','tarea','nota','reunion')),
  asunto          text not null,
  descripcion     text,
  fecha           timestamptz not null default now(),
  vence           timestamptz,
  completada      boolean not null default false,
  cliente_id      uuid references public.clientes(id) on delete cascade,
  prospecto_id    uuid references public.prospectos(id) on delete cascade,
  oportunidad_id  uuid references public.oportunidades(id) on delete cascade,
  usuario_id      uuid references public.perfiles(id) default auth.uid(),
  created_at      timestamptz not null default now()
);

create table public.analisis_agua (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid references public.clientes(id),
  prospecto_id    uuid references public.prospectos(id),
  oportunidad_id  uuid references public.oportunidades(id),
  fecha           date not null default current_date,
  laboratorio     text,
  fuente          text,       -- pozo, red pública, cisterna, camión
  archivo_url     text,
  notas           text,
  created_at      timestamptz not null default now()
);

create table public.analisis_parametros (
  id            uuid primary key default gen_random_uuid(),
  analisis_id   uuid not null references public.analisis_agua(id) on delete cascade,
  parametro     text not null,
  unidad        text,
  valor_crudo   text,
  valor_tratado text,
  cumple        boolean
);

create table public.cotizaciones (
  id              uuid primary key default gen_random_uuid(),
  numero          text not null unique,
  cliente_id      uuid references public.clientes(id),
  prospecto_id    uuid references public.prospectos(id),
  oportunidad_id  uuid references public.oportunidades(id),
  vendedor_id     uuid references public.vendedores(id),
  fecha           date not null default current_date,
  vence           date,
  subtotal        numeric(14,2) not null default 0,
  descuento       numeric(14,2) not null default 0,
  itbis           numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  margen_pct      numeric(6,2),
  requiere_aprobacion boolean not null default false,
  aprobado_por    uuid references public.perfiles(id),
  estado          text not null default 'borrador' check (estado in ('borrador','por_aprobar','enviada','en_negociacion','aprobada','rechazada','vencida')),
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.cotizacion_lineas (
  id              uuid primary key default gen_random_uuid(),
  cotizacion_id   uuid not null references public.cotizaciones(id) on delete cascade,
  producto_id     uuid references public.productos(id),
  descripcion     text not null,
  cantidad        numeric(12,2) not null default 1,
  precio          numeric(14,2) not null default 0,
  costo           numeric(14,2) not null default 0,
  descuento_pct   numeric(5,2) not null default 0,
  itbis           numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0
);

create table public.pedidos_venta (
  id              uuid primary key default gen_random_uuid(),
  numero          text not null unique,
  cotizacion_id   uuid references public.cotizaciones(id),
  cliente_id      uuid not null references public.clientes(id),
  vendedor_id     uuid references public.vendedores(id),
  fecha           date not null default current_date,
  fecha_entrega   date,
  tecnico_id      uuid references public.empleados(id),
  total           numeric(14,2) not null default 0,
  estado          text not null default 'abierto' check (estado in ('abierto','en_instalacion','entregado','facturado','cancelado')),
  created_at      timestamptz not null default now()
);

-- Base instalada
create table public.equipos_instalados (
  id                 uuid primary key default gen_random_uuid(),
  serie              text not null unique,
  cliente_id         uuid not null references public.clientes(id),
  producto_id        uuid references public.productos(id),
  descripcion        text not null,
  capacidad          text,
  ubicacion          text,
  fecha_instalacion  date,
  garantia_hasta     date,
  pedido_id          uuid references public.pedidos_venta(id),
  estado             text not null default 'operativo' check (estado in ('en_instalacion','operativo','fuera_de_servicio','retirado')),
  created_at         timestamptz not null default now()
);

create table public.equipo_componentes (
  id                 uuid primary key default gen_random_uuid(),
  equipo_id          uuid not null references public.equipos_instalados(id) on delete cascade,
  producto_id        uuid references public.productos(id),
  descripcion        text not null,
  cantidad           numeric(8,2) not null default 1,
  frecuencia_meses   integer not null,
  ultimo_reemplazo   date,
  proximo_reemplazo  date
);

alter table public.prospectos
  add constraint prospectos_equipo_fk foreign key (equipo_origen_id) references public.equipos_instalados(id);

create or replace function public.tg_componente_proximo()
returns trigger language plpgsql as $$
begin
  if new.ultimo_reemplazo is not null then
    new.proximo_reemplazo := (new.ultimo_reemplazo + make_interval(months => new.frecuencia_meses))::date;
  end if;
  return new;
end $$;

create trigger componente_proximo before insert or update of ultimo_reemplazo, frecuencia_meses
  on public.equipo_componentes for each row execute function public.tg_componente_proximo();

-- ---------------------------------------------------------------------
-- IGUALAS DE MANTENIMIENTO
-- ---------------------------------------------------------------------

create table public.igualas (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,
  cliente_id         uuid not null references public.clientes(id),
  vendedor_id        uuid references public.vendedores(id),
  descripcion        text,
  frecuencia_visita  text not null check (frecuencia_visita in ('semanal','quincenal','mensual','bimestral','trimestral')),
  cuota_mensual      numeric(14,2) not null,
  dia_facturacion    integer not null default 1 check (dia_facturacion between 1 and 28),
  incluye_insumos    text,      -- descripción de lo que cubre la cuota
  fecha_inicio       date not null,
  fecha_fin          date,
  estado             text not null default 'vigente' check (estado in ('borrador','vigente','por_renovar','suspendida','cancelada')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.iguala_equipos (
  iguala_id  uuid not null references public.igualas(id) on delete cascade,
  equipo_id  uuid not null references public.equipos_instalados(id),
  primary key (iguala_id, equipo_id)
);

create table public.ordenes_servicio (
  id                 uuid primary key default gen_random_uuid(),
  numero             text not null unique,
  cliente_id         uuid not null references public.clientes(id),
  iguala_id          uuid references public.igualas(id),
  equipo_id          uuid references public.equipos_instalados(id),
  tipo               text not null check (tipo in ('preventivo','correctivo','instalacion','garantia','analisis')),
  fecha              date not null default current_date,
  tecnico_id         uuid references public.empleados(id),
  trabajo_realizado  text,
  observaciones      text,
  firma_url          text,
  fotos              text[],
  estado             text not null default 'abierta' check (estado in ('abierta','en_proceso','completada','por_facturar','facturada','cancelada')),
  created_at         timestamptz not null default now()
);

create table public.visitas (
  id                 uuid primary key default gen_random_uuid(),
  iguala_id          uuid references public.igualas(id) on delete cascade,
  cliente_id         uuid not null references public.clientes(id),
  fecha_programada   date not null,
  tecnico_id         uuid references public.empleados(id),
  ruta               text,
  servicio           text,
  orden_servicio_id  uuid references public.ordenes_servicio(id),
  estado             text not null default 'programada' check (estado in ('programada','completada','reprogramada','cancelada'))
);

create table public.orden_servicio_insumos (
  id                 uuid primary key default gen_random_uuid(),
  orden_servicio_id  uuid not null references public.ordenes_servicio(id) on delete cascade,
  producto_id        uuid not null references public.productos(id),
  cantidad           numeric(12,2) not null,
  costo_unitario     numeric(14,2) not null default 0,
  precio_unitario    numeric(14,2) not null default 0,
  cobertura          text not null default 'incluido' check (cobertura in ('incluido','facturable')),
  facturado          boolean not null default false
);

create table public.facturacion_corridas (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique,
  periodo             date not null unique,   -- primer día del mes
  igualas             integer not null default 0,
  facturas_generadas  integer not null default 0,
  subtotal            numeric(14,2) not null default 0,
  itbis               numeric(14,2) not null default 0,
  total               numeric(14,2) not null default 0,
  estado              text not null default 'en_proceso' check (estado in ('en_proceso','procesada','anulada')),
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SUPLIDORES, COMPRAS E INVENTARIO
-- ---------------------------------------------------------------------

create table public.suplidores (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null unique,
  nombre               text not null,
  rnc                  text,
  categoria            text,
  condicion_pago_dias  integer not null default 30,
  retencion            text,      -- ej. 'ISR 10%', 'ITBIS 30%'
  contacto             text,
  telefono             text,
  email                text,
  banco                text,
  cuenta_bancaria      text,
  insumo_critico       boolean not null default false,
  activo               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.precios_suplidor (
  id               uuid primary key default gen_random_uuid(),
  suplidor_id      uuid not null references public.suplidores(id) on delete cascade,
  producto_id      uuid not null references public.productos(id),
  precio           numeric(14,2) not null,
  precio_anterior  numeric(14,2),
  actualizado_en   date not null default current_date,
  unique (suplidor_id, producto_id)
);

create table public.evaluaciones_suplidor (
  id                  uuid primary key default gen_random_uuid(),
  suplidor_id         uuid not null references public.suplidores(id) on delete cascade,
  periodo             date not null,
  entregas_a_tiempo   numeric(5,2),
  calidad             numeric(3,1) check (calidad between 0 and 5),
  precio              numeric(3,1) check (precio between 0 and 5),
  servicio            numeric(3,1) check (servicio between 0 and 5),
  calificacion        numeric(3,1) generated always as (round((coalesce(calidad,0) + coalesce(precio,0) + coalesce(servicio,0)) / 3.0, 1)) stored,
  comentario          text
);

create table public.almacenes (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique
);

create table public.solicitudes_compra (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique,
  fecha         date not null default current_date,
  solicitante   uuid references public.perfiles(id) default auth.uid(),
  producto_id   uuid references public.productos(id),
  descripcion   text,
  cantidad      numeric(12,2) not null,
  motivo        text,
  estado        text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada','convertida')),
  orden_compra_id uuid
);

create table public.ordenes_compra (
  id             uuid primary key default gen_random_uuid(),
  numero         text not null unique,
  suplidor_id    uuid not null references public.suplidores(id),
  solicitante    uuid references public.perfiles(id) default auth.uid(),
  fecha          date not null default current_date,
  centro_costo   text,
  subtotal       numeric(14,2) not null default 0,
  itbis          numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  aprobado_por   uuid references public.perfiles(id),
  estado         text not null default 'borrador' check (estado in ('borrador','por_aprobar','aprobada','parcial','recibida','cancelada')),
  created_at     timestamptz not null default now()
);

alter table public.solicitudes_compra
  add constraint solicitudes_oc_fk foreign key (orden_compra_id) references public.ordenes_compra(id);

create table public.orden_compra_lineas (
  id               uuid primary key default gen_random_uuid(),
  orden_compra_id  uuid not null references public.ordenes_compra(id) on delete cascade,
  producto_id      uuid not null references public.productos(id),
  cantidad         numeric(12,2) not null,
  recibido         numeric(12,2) not null default 0,
  costo_unitario   numeric(14,2) not null,
  itbis            numeric(14,2) not null default 0
);

create table public.recepciones (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,
  orden_compra_id  uuid references public.ordenes_compra(id),
  almacen_id       uuid references public.almacenes(id),
  fecha            date not null default current_date,
  recibido_por     uuid references public.perfiles(id) default auth.uid(),
  estado           text not null default 'completa' check (estado in ('completa','parcial')),
  notas            text
);

create table public.recepcion_lineas (
  id              uuid primary key default gen_random_uuid(),
  recepcion_id    uuid not null references public.recepciones(id) on delete cascade,
  producto_id     uuid not null references public.productos(id),
  cantidad        numeric(12,2) not null,
  costo_unitario  numeric(14,2) not null
);

create table public.inventario_existencias (
  producto_id     uuid not null references public.productos(id),
  almacen_id      uuid not null references public.almacenes(id),
  cantidad        numeric(12,2) not null default 0,
  primary key (producto_id, almacen_id)
);

create table public.movimientos_inventario (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null default current_date,
  tipo            text not null check (tipo in ('entrada','salida','ajuste','transferencia')),
  producto_id     uuid not null references public.productos(id),
  almacen_id      uuid not null references public.almacenes(id),
  cantidad        numeric(12,2) not null,  -- positiva entra, negativa sale
  costo_unitario  numeric(14,2) not null default 0,
  documento_tipo  text,   -- recepcion, orden_servicio, ajuste, factura
  documento_id    uuid,
  nota            text,
  usuario_id      uuid references public.perfiles(id) default auth.uid(),
  created_at      timestamptz not null default now()
);

-- Actualiza existencias y costo promedio con cada movimiento.
create or replace function public.tg_movimiento_inventario()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_exist numeric; v_costo numeric;
begin
  select coalesce(sum(cantidad),0) into v_exist from inventario_existencias where producto_id = new.producto_id;
  if new.cantidad > 0 and new.costo_unitario > 0 then
    select costo_promedio into v_costo from productos where id = new.producto_id;
    update productos
       set costo_promedio = case when v_exist + new.cantidad > 0
             then round(((greatest(v_exist,0) * coalesce(v_costo,0)) + (new.cantidad * new.costo_unitario)) / (greatest(v_exist,0) + new.cantidad), 2)
             else new.costo_unitario end
     where id = new.producto_id;
  end if;
  insert into inventario_existencias (producto_id, almacen_id, cantidad)
  values (new.producto_id, new.almacen_id, new.cantidad)
  on conflict (producto_id, almacen_id) do update set cantidad = inventario_existencias.cantidad + excluded.cantidad;
  return new;
end $$;

create trigger movimiento_inventario after insert on public.movimientos_inventario
  for each row execute function public.tg_movimiento_inventario();

-- ---------------------------------------------------------------------
-- CONTABILIDAD (antes de cobros/pagos por las cuentas bancarias)
-- ---------------------------------------------------------------------

create table public.cuentas_contables (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique,
  nombre              text not null,
  tipo                text not null check (tipo in ('activo','pasivo','patrimonio','ingreso','costo','gasto')),
  naturaleza          text not null check (naturaleza in ('deudora','acreedora')),
  nivel               integer not null default 1,
  padre_id            uuid references public.cuentas_contables(id),
  acepta_movimientos  boolean not null default true,
  activa              boolean not null default true
);

create table public.periodos_contables (
  id      uuid primary key default gen_random_uuid(),
  anio    integer not null,
  mes     integer not null check (mes between 1 and 12),
  estado  text not null default 'abierto' check (estado in ('abierto','en_cierre','cerrado')),
  cerrado_por uuid references public.perfiles(id),
  cerrado_en  timestamptz,
  unique (anio, mes)
);

create table public.cuentas_bancarias (
  id                  uuid primary key default gen_random_uuid(),
  banco               text not null,
  numero              text not null,
  tipo                text not null default 'corriente' check (tipo in ('corriente','ahorro')),
  moneda              text not null default 'DOP' check (moneda in ('DOP','USD','EUR')),
  cuenta_contable_id  uuid references public.cuentas_contables(id),
  activa              boolean not null default true
);

create table public.asientos (
  id           uuid primary key default gen_random_uuid(),
  numero       text not null unique,
  fecha        date not null default current_date,
  tipo         text not null check (tipo in ('venta','ingreso','compra','pago','nomina','ajuste','depreciacion','apertura','cierre','otro')),
  descripcion  text not null,
  origen_tabla text,
  origen_id    uuid,
  periodo_id   uuid references public.periodos_contables(id),
  estado       text not null default 'borrador' check (estado in ('borrador','por_contabilizar','contabilizado','anulado')),
  created_at   timestamptz not null default now(),
  created_by   uuid references public.perfiles(id) default auth.uid()
);

create table public.asiento_lineas (
  id            uuid primary key default gen_random_uuid(),
  asiento_id    uuid not null references public.asientos(id) on delete cascade,
  cuenta_id     uuid not null references public.cuentas_contables(id),
  debito        numeric(14,2) not null default 0 check (debito >= 0),
  credito       numeric(14,2) not null default 0 check (credito >= 0),
  centro_costo  text,
  descripcion   text,
  constraint linea_debito_o_credito check ((debito = 0) <> (credito = 0))
);

-- No permite contabilizar un asiento descuadrado ni en un período cerrado.
create or replace function public.tg_validar_asiento()
returns trigger language plpgsql as $$
declare v_deb numeric; v_cre numeric; v_estado_periodo text;
begin
  if new.estado = 'contabilizado' and (tg_op = 'INSERT' or old.estado <> 'contabilizado') then
    select coalesce(sum(debito),0), coalesce(sum(credito),0) into v_deb, v_cre
      from asiento_lineas where asiento_id = new.id;
    if v_deb = 0 or v_deb <> v_cre then
      raise exception 'El asiento % no cuadra (débitos %, créditos %)', new.numero, v_deb, v_cre;
    end if;
  end if;
  if new.periodo_id is not null then
    select estado into v_estado_periodo from periodos_contables where id = new.periodo_id;
    if v_estado_periodo = 'cerrado' then
      raise exception 'El período contable está cerrado';
    end if;
  end if;
  return new;
end $$;

create trigger validar_asiento before insert or update on public.asientos
  for each row execute function public.tg_validar_asiento();

create table public.conciliaciones (
  id                      uuid primary key default gen_random_uuid(),
  cuenta_bancaria_id      uuid not null references public.cuentas_bancarias(id),
  periodo                 date not null,
  saldo_banco             numeric(14,2) not null,
  saldo_libros            numeric(14,2) not null,
  depositos_transito      numeric(14,2) not null default 0,
  cheques_circulacion     numeric(14,2) not null default 0,
  diferencia              numeric(14,2) generated always as (saldo_banco + depositos_transito - cheques_circulacion - saldo_libros) stored,
  estado                  text not null default 'en_proceso' check (estado in ('en_proceso','conciliado','diferencia')),
  unique (cuenta_bancaria_id, periodo)
);

create table public.declaraciones_fiscales (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('606','607','608','609','IT-1','IR-17','IR-3','IR-2','TSS')),
  periodo         date not null,
  fecha_limite    date not null,
  monto           numeric(14,2),
  preparado_por   uuid references public.perfiles(id),
  presentado_en   date,
  archivo_url     text,
  estado          text not null default 'por_presentar' check (estado in ('por_presentar','preparado','presentado','pagado')),
  unique (tipo, periodo)
);

create table public.tareas_cierre (
  id              uuid primary key default gen_random_uuid(),
  periodo_id      uuid not null references public.periodos_contables(id) on delete cascade,
  tarea           text not null,
  modulo          text,
  responsable_id  uuid references public.perfiles(id),
  fecha_limite    date,
  avance          integer not null default 0 check (avance between 0 and 100),
  estado          text not null default 'pendiente' check (estado in ('pendiente','en_proceso','completada'))
);

-- ---------------------------------------------------------------------
-- COBROS (facturación y cuentas por cobrar)
-- ---------------------------------------------------------------------

create table public.secuencias_ncf (
  id        uuid primary key default gen_random_uuid(),
  tipo      text not null check (tipo in ('B01','B02','B04','B11','B14','B15','E31','E32','E33','E34','E41','E43','E44','E45')),
  prefijo   text not null,
  desde     bigint not null,
  hasta     bigint not null,
  actual    bigint not null,
  vence     date,
  activa    boolean not null default true
);

create or replace function public.siguiente_ncf(p_tipo text)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_prefijo text; v_actual bigint; v_hasta bigint; v_vence date; v_largo integer;
begin
  select id, prefijo, actual, hasta, vence into v_id, v_prefijo, v_actual, v_hasta, v_vence
    from secuencias_ncf where tipo = p_tipo and activa order by vence nulls last limit 1 for update;
  if not found then raise exception 'No hay secuencia NCF activa para %', p_tipo; end if;
  if v_vence is not null and v_vence < current_date then raise exception 'La secuencia NCF % está vencida', p_tipo; end if;
  if v_actual > v_hasta then raise exception 'Secuencia NCF % agotada', p_tipo; end if;
  update secuencias_ncf set actual = actual + 1 where id = v_id;
  v_largo := case when left(p_tipo,1) = 'E' then 10 else 8 end;
  return v_prefijo || lpad(v_actual::text, v_largo, '0');
end $$;

create table public.facturas (
  id                 uuid primary key default gen_random_uuid(),
  numero             text not null unique,
  ncf                text unique,
  tipo_ncf           text not null default 'B01',
  cliente_id         uuid not null references public.clientes(id),
  fecha              date not null default current_date,
  vence              date,
  origen             text not null default 'manual' check (origen in ('manual','iguala','pedido','servicio','cotizacion')),
  iguala_id          uuid references public.igualas(id),
  pedido_id          uuid references public.pedidos_venta(id),
  orden_servicio_id  uuid references public.ordenes_servicio(id),
  corrida_id         uuid references public.facturacion_corridas(id),
  vendedor_id        uuid references public.vendedores(id),
  subtotal           numeric(14,2) not null default 0,
  descuento          numeric(14,2) not null default 0,
  itbis              numeric(14,2) not null default 0,
  total              numeric(14,2) not null default 0,
  saldo              numeric(14,2) not null default 0,
  estado             text not null default 'borrador' check (estado in ('borrador','emitida','parcial','pagada','vencida','anulada')),
  notas              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.factura_lineas (
  id            uuid primary key default gen_random_uuid(),
  factura_id    uuid not null references public.facturas(id) on delete cascade,
  producto_id   uuid references public.productos(id),
  descripcion   text not null,
  cantidad      numeric(12,2) not null default 1,
  precio        numeric(14,2) not null default 0,
  descuento_pct numeric(5,2) not null default 0,
  itbis         numeric(14,2) not null default 0,
  total         numeric(14,2) not null default 0
);

create table public.recibos (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,
  fecha               date not null default current_date,
  cliente_id          uuid not null references public.clientes(id),
  forma_pago          text not null check (forma_pago in ('efectivo','transferencia','cheque','tarjeta','deposito')),
  cuenta_bancaria_id  uuid references public.cuentas_bancarias(id),
  referencia          text,
  monto               numeric(14,2) not null check (monto > 0),
  aplicado            numeric(14,2) not null default 0,
  estado              text not null default 'por_aplicar' check (estado in ('por_aplicar','aplicado','parcial','anulado')),
  created_at          timestamptz not null default now()
);

create table public.recibo_aplicaciones (
  id          uuid primary key default gen_random_uuid(),
  recibo_id   uuid not null references public.recibos(id) on delete cascade,
  factura_id  uuid not null references public.facturas(id),
  monto       numeric(14,2) not null check (monto > 0)
);

-- Al aplicar un recibo: baja el saldo de la factura y actualiza estados.
create or replace function public.tg_aplicar_recibo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update facturas
     set saldo = saldo - new.monto,
         estado = case when saldo - new.monto <= 0 then 'pagada' else 'parcial' end
   where id = new.factura_id;
  update recibos
     set aplicado = aplicado + new.monto,
         estado = case when aplicado + new.monto >= monto then 'aplicado' else 'parcial' end
   where id = new.recibo_id;
  return new;
end $$;

create trigger aplicar_recibo after insert on public.recibo_aplicaciones
  for each row execute function public.tg_aplicar_recibo();

create table public.notas_credito (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null unique,
  ncf         text unique,
  factura_id  uuid not null references public.facturas(id),
  cliente_id  uuid not null references public.clientes(id),
  fecha       date not null default current_date,
  motivo      text not null,
  monto       numeric(14,2) not null,
  itbis       numeric(14,2) not null default 0,
  estado      text not null default 'borrador' check (estado in ('borrador','aplicada','anulada'))
);

create table public.gestiones_cobro (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid not null references public.clientes(id),
  factura_id         uuid references public.facturas(id),
  fecha              date not null default current_date,
  contacto           text,
  medio              text check (medio in ('llamada','whatsapp','correo','visita')),
  resultado          text,
  compromiso_fecha   date,
  compromiso_monto   numeric(14,2),
  gestor_id          uuid references public.perfiles(id) default auth.uid(),
  estado             text not null default 'prometido' check (estado in ('sin_compromiso','prometido','cumplido','incumplido'))
);

-- ---------------------------------------------------------------------
-- PAGOS (cuentas por pagar: suplidores y vendedores externos)
-- ---------------------------------------------------------------------

create table public.facturas_suplidor (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,
  ncf              text,
  tipo_ncf         text default 'B01' check (tipo_ncf in ('B01','B11','B13','B14','B15','B17','E31','E41','E43','E47')),
  suplidor_id      uuid references public.suplidores(id),
  vendedor_id      uuid references public.vendedores(id),     -- comisiones de vendedores externos
  orden_compra_id  uuid references public.ordenes_compra(id),
  concepto         text,
  fecha            date not null default current_date,
  vence            date,
  subtotal         numeric(14,2) not null default 0,
  itbis            numeric(14,2) not null default 0,
  retencion_isr    numeric(14,2) not null default 0,
  retencion_itbis  numeric(14,2) not null default 0,
  total            numeric(14,2) not null default 0,
  saldo            numeric(14,2) not null default 0,
  estado           text not null default 'pendiente' check (estado in ('por_aprobar','pendiente','parcial','pagada','anulada')),
  created_at       timestamptz not null default now(),
  constraint factura_suplidor_beneficiario check ((suplidor_id is not null) <> (vendedor_id is not null))
);

create table public.pagos (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,
  fecha               date not null default current_date,   -- fecha programada o de emisión
  suplidor_id         uuid references public.suplidores(id),
  vendedor_id         uuid references public.vendedores(id),
  metodo              text not null check (metodo in ('transferencia','cheque','efectivo','debito_automatico','tarjeta')),
  cuenta_bancaria_id  uuid references public.cuentas_bancarias(id),
  referencia          text,
  monto               numeric(14,2) not null check (monto > 0),
  aprobado_por        uuid references public.perfiles(id),
  estado              text not null default 'programado' check (estado in ('programado','por_aprobar','aprobado','emitido','conciliado','anulado')),
  created_at          timestamptz not null default now()
);

create table public.pago_aplicaciones (
  id                   uuid primary key default gen_random_uuid(),
  pago_id              uuid not null references public.pagos(id) on delete cascade,
  factura_suplidor_id  uuid not null references public.facturas_suplidor(id),
  monto                numeric(14,2) not null check (monto > 0)
);

create or replace function public.tg_aplicar_pago()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update facturas_suplidor
     set saldo = saldo - new.monto,
         estado = case when saldo - new.monto <= 0 then 'pagada' else 'parcial' end
   where id = new.factura_suplidor_id;
  return new;
end $$;

create trigger aplicar_pago after insert on public.pago_aplicaciones
  for each row execute function public.tg_aplicar_pago();

create table public.anticipos_suplidor (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,
  fecha            date not null default current_date,
  suplidor_id      uuid not null references public.suplidores(id),
  orden_compra_id  uuid references public.ordenes_compra(id),
  monto            numeric(14,2) not null,
  aplicado         numeric(14,2) not null default 0,
  estado           text not null default 'por_aplicar' check (estado in ('por_aplicar','aplicado','anulado'))
);

-- ---------------------------------------------------------------------
-- COMISIONES (cálculo y liquidación)
-- ---------------------------------------------------------------------

create table public.liquidaciones_comision (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique,
  periodo               date not null,
  tipo                  text not null check (tipo in ('interno','externo')),
  total_bruto           numeric(14,2) not null default 0,
  retencion_isr         numeric(14,2) not null default 0,
  neto                  numeric(14,2) not null default 0,
  forma_pago            text not null check (forma_pago in ('nomina','cuentas_por_pagar')),
  fecha_pago            date,
  nomina_id             uuid references public.nominas(id),
  aprobado_por          uuid references public.perfiles(id),
  estado                text not null default 'por_aprobar' check (estado in ('por_aprobar','aprobada','pagada','anulada')),
  unique (periodo, tipo)
);

create table public.comisiones (
  id               uuid primary key default gen_random_uuid(),
  vendedor_id      uuid not null references public.vendedores(id),
  periodo          date not null,
  esquema_id       uuid references public.esquemas_comision(id),
  factura_id       uuid references public.facturas(id),
  iguala_id        uuid references public.igualas(id),
  base             numeric(14,2) not null,
  porcentaje       numeric(6,3) not null,
  monto            numeric(14,2) not null,
  retencion_isr    numeric(14,2) not null default 0,
  liquidacion_id   uuid references public.liquidaciones_comision(id),
  estado           text not null default 'calculada' check (estado in ('calculada','retenida','aprobada','liquidada','anulada')),
  nota             text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Triggers de updated_at y auditoría
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['perfiles','empleados','vendedores','productos','clientes','prospectos','oportunidades',
                           'cotizaciones','igualas','suplidores','facturas']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.tg_set_updated_at()', t);
  end loop;

  foreach t in array array['facturas','recibos','notas_credito','facturas_suplidor','pagos','asientos',
                           'comisiones','liquidaciones_comision','nominas','igualas','cotizaciones']
  loop
    execute format('create trigger auditar after insert or update or delete on public.%I for each row execute function public.tg_auditar()', t);
  end loop;
end $$;

-- Índices útiles
create index on public.clientes (vendedor_id);
create index on public.prospectos (estado, asignado_a);
create index on public.prospectos (origen);
create index on public.oportunidades (etapa);
create index on public.actividades (cliente_id, fecha desc);
create index on public.equipo_componentes (proximo_reemplazo);
create index on public.igualas (cliente_id, estado);
create index on public.visitas (fecha_programada, tecnico_id);
create index on public.facturas (cliente_id, estado);
create index on public.facturas (vence) where saldo > 0;
create index on public.facturas_suplidor (vence) where saldo > 0;
create index on public.comisiones (vendedor_id, periodo);
create index on public.movimientos_inventario (producto_id, fecha);
create index on public.asiento_lineas (cuenta_id);
