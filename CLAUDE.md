# Osmos ERP · Guía para el código

- Idioma: todo el texto visible, nombres de tablas, columnas y funciones van en **español**.
- Stack: Next.js 15 con `output: "export"` (sitio estático para Hostinger), Tailwind, `@supabase/supabase-js`
  en el navegador. No hay servidor: nada de Server Actions, `cookies()`, middleware ni rutas dinámicas sin
  `generateStaticParams`. Las pantallas de detalle usan `?id=` (ej. `/cliente/?id=...`).
- La clave de Supabase se lee en tiempo de ejecución desde `public/config.js` (no se sube a git).
- La base de datos es la fuente de verdad: lógica de negocio en funciones SQL (`supabase/migrations`),
  permisos con RLS y `public.tiene_rol(...)`. Nunca usar la clave `service_role` en la app.
- Cambios de base de datos: crear un archivo nuevo en `supabase/migrations/` con prefijo de fecha
  (`AAAAMMDDhhmmss_descripcion.sql`); no editar migraciones ya aplicadas en producción.
- Módulos y pestañas se declaran en `src/lib/modulos.ts`; las pantallas genéricas salen de ahí.
  Pantallas propias viven en `src/app/(app)/<modulo>/...` y se enlazan con `ruta`.
- Colores y tipografía de Osmos: `tailwind.config.ts` (navy #00246A, turquesa #0093A5, amarillo #D3D200;
  Michroma para títulos, Barlow para texto).
- Antes de subir: `npm run build` debe pasar.
