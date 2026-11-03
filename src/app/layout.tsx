import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Osmos · Sistema de gestión empresarial",
  description: "CRM y ERP de Osmos Tecnología del Agua",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
