import type { NextConfig } from "next";

// Sitio estático: `npm run build` genera la carpeta `out/`, que se sube tal cual
// a public_html/crm en Hostinger. Toda la lógica vive en Supabase.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
