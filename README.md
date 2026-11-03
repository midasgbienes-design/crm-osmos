# Osmos · Sistema de gestión empresarial

CRM y ERP de **Osmos Tecnología del Agua**: comercial, igualas de mantenimiento, vendedores y comisiones,
compras e inventario, suplidores, cobros, pagos, contabilidad y recursos humanos.

- **Aplicación:** Next.js 15 (App Router) + Tailwind, en `src/`.
- **Base de datos:** Supabase (PostgreSQL), en `supabase/migrations/`.
- **Publicación:** Vercel (recomendado).

---

## Puesta en marcha (una sola vez)

### 1. Crear la base de datos en Supabase

En el proyecto de Supabase (`https://oshmqvbvwlvjsecyoxaw.supabase.co`):

1. Abra **SQL Editor → New query**.
2. Copie, pegue y ejecute **en este orden** cada archivo de `supabase/migrations/`:
   1. `20261103000100_esquema_base.sql`
   2. `20261103000200_vistas_y_procesos.sql`
   3. `20261103000300_permisos.sql`
   4. `20261103000400_datos_base.sql`
   5. `20261103000500_codigos_automaticos.sql`
   6. `20261103000600_fase2_cotizaciones_y_servicio.sql`
3. *(Opcional, para probar)* ejecute `supabase/seed_demo.sql`, que carga clientes, igualas, equipos y facturas de ejemplo.
   Para borrarlos después, ejecute `supabase/limpiar_demo.sql`.

> Alternativa automática: en GitHub, **Settings → Secrets and variables → Actions**, cree los secretos
> `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD`, y luego ejecute **Actions → Aplicar migraciones a Supabase → Run workflow**.

### 2. Crear el primer usuario (administrador)

1. Supabase → **Authentication → Users → Add user → Create new user** (correo y contraseña).
2. En **SQL Editor**, asígnele el rol de administrador:

   ```sql
   update public.perfiles set rol = 'admin', nombre = 'Luis De León' where email = 'su-correo@ejemplo.com';
   ```

Repita para cada usuario con el rol que le corresponda (ver tabla de roles).

### 3. Publicar la aplicación en Vercel

1. En [vercel.com](https://vercel.com), **Add New → Project** e importe el repositorio `crm-osmos`.
2. En **Environment Variables** agregue:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://oshmqvbvwlvjsecyoxaw.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → **Project Settings → API → anon public** |

3. **Deploy.** Cada cambio que se suba a `main` se publica solo.

> La clave `service_role` **nunca** se coloca en la aplicación ni en Vercel.

### 4. Tareas automáticas (opcional, recomendado)

En Supabase → **Database → Extensions**, active `pg_cron` y ejecute en el SQL Editor:

```sql
-- Todos los días: marca facturas vencidas, igualas por renovar y crea prospectos de reposición
select cron.schedule('osmos-tareas-diarias', '0 10 * * *', $$select public.tareas_diarias()$$);
-- El día 1 de cada mes: factura todas las igualas vigentes
select cron.schedule('osmos-facturacion-igualas', '0 11 1 * *', $$select public.generar_facturacion_igualas(current_date)$$);
```

### 5. Comprobantes fiscales (NCF)

Registre los rangos autorizados por la DGII antes de facturar:

```sql
insert into public.secuencias_ncf (tipo, prefijo, desde, hasta, actual, vence)
values ('B01', 'B01', 1, 500, 1, '2027-12-31');
```

---

## Roles y permisos

Los permisos se aplican en la base de datos (Row Level Security), no solo en la pantalla.

| Rol | Puede ver | Puede modificar |
|---|---|---|
| `admin`, `gerencia` | Todo | Todo |
| `ventas` | Comercial, igualas, productos, cobros | Comercial, igualas, prospectos |
| `vendedor_externo` | Solo sus prospectos y clientes | Registrar sus prospectos |
| `tecnico` | Clientes, igualas, inventario | Órdenes de servicio, visitas, consumos |
| `cobros` | Comercial, igualas, contabilidad | Facturación, recibos, cobranza |
| `pagos` | Compras, suplidores, comisiones | Cuentas por pagar, pagos |
| `compras`, `almacen` | Inventario, suplidores, pagos | Compras, inventario, suplidores |
| `contabilidad` | Todo lo financiero, nómina | Contabilidad, comisiones, cobros, pagos |
| `rrhh` | Recursos humanos | Recursos humanos |
| `consulta` | Lectura de comercial y finanzas | Nada |

Los salarios solo los ven `rrhh`, `contabilidad`, `gerencia` y `admin`.

---

## Procesos incluidos en la base de datos

| Proceso | Qué hace |
|---|---|
| `generar_facturacion_igualas(fecha)` | Factura todas las igualas vigentes del mes, con NCF e ITBIS. La cuota mensual se registra **sin ITBIS**. |
| `programar_visitas(fecha)` | Crea las visitas del mes según la frecuencia de cada iguala. |
| `calcular_comisiones(fecha)` | Comisiones por cobros, igualas nuevas y bono por meta; retención ISR a vendedores externos. |
| `liquidar_comisiones(fecha, 'interno'\|'externo')` | Internos: para nómina. Externos: crea la cuenta por pagar neta de ISR. |
| `convertir_prospecto(id)` | Crea el cliente y conserva el origen del prospecto. |
| `generar_prospectos_reposicion()` | Crea prospectos desde la base instalada cuando un componente vence. |
| `tareas_diarias()` | Vencimientos, renovaciones y reposiciones. |
| `guardar_cotizacion(p)` | Guarda la cotización con sus líneas; calcula ITBIS y margen, y la envía a aprobación si el descuento o el margen están fuera de los límites. |
| `accion_cotizacion(id, accion)` | aprobar (gerencia), enviar, negociar, aceptar (crea el pedido y, si era prospecto, el cliente) o rechazar. |
| `facturar_pedido(id)` | Emite la factura del pedido con NCF. |
| `registrar_orden_servicio(p)` | Registra el servicio, descuenta inventario, actualiza el reemplazo del componente y completa la visita. |
| `facturar_orden_servicio(id)` | Factura los insumos marcados como facturables. |

Los códigos (CL-0001, FT-0001, IG-0001…) se asignan solos. Inventario, saldos de facturas y
cuentas por pagar se actualizan automáticamente con cada movimiento, recibo o pago.

**Revisar con el contador:** tasas de TSS, retención de ISR a vendedores externos, catálogo de cuentas
y porcentajes de comisión (tabla `parametros`, `esquemas_comision` y `cuentas_contables`).

---

## Desarrollo local

```bash
cp .env.example .env.local   # y complete la clave anon
npm install
npm run dev                  # http://localhost:3000
```

## Estado del proyecto

**Fase 1 (lista):** base de datos completa, permisos, procesos automáticos, inicio de sesión,
menú de módulos, Inicio, Comercial (prospectos con registro y conversión, ficha 360° del cliente,
base instalada, origen y conversión) y consulta de todas las funciones de los demás módulos.

**Fase 2 (lista):** cotizador con márgenes y aprobación de gerencia, ciclo de la cotización hasta
pedido y factura; igualas (alta, equipos cubiertos, visitas, órdenes y facturas); órdenes de servicio
con insumos que descuentan inventario y actualizan la base instalada, y facturación de insumos.

**Próximas fases:** recibos y cobranza, compras y recepción, cuentas por pagar y pagos, nómina,
asientos contables automáticos, reportes DGII 606/607, facturación electrónica e-CF, aplicación
móvil para técnicos y mensajes por WhatsApp.
