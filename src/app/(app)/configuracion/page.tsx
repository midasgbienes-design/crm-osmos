"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { Aviso, Encabezado } from "@/components/ui";
import { MensajesUrl } from "@/components/mensajes";
import { useSesion } from "@/components/sesion";

const OPCIONES = [
  { href: "/editar/?f=config/empresa&id=1", titulo: "Datos de la empresa", texto: "RNC, dirección, teléfonos y condiciones que salen en cotizaciones y facturas.", solo: "admin" },
  { href: "/configuracion/usuarios/", titulo: "Usuarios y roles", texto: "Quién entra al sistema y qué puede ver o modificar cada persona.", solo: "admin" },
  { href: "/configuracion/auditoria/", titulo: "Historial de cambios", texto: "Quién creó, modificó o borró cada registro, con el antes y el después.", solo: "admin" },
  { href: "/configuracion/importar/", titulo: "Importar desde Excel", texto: "Cargue clientes, equipos, igualas, productos y suplidores desde una plantilla.", solo: "gerencia" },
  { href: "/configuracion/parametros/", titulo: "Parámetros", texto: "Tasas, días de alerta, descuento máximo y margen mínimo.", solo: "admin" },
];

export default function Configuracion() {
  const { perfil } = useSesion();
  const rol = perfil?.rol ?? "";
  const { datos } = useDatos(async () => (await supabase().from("empresa").select("rnc,telefono").eq("id", 1).maybeSingle()).data, []);
  const visibles = OPCIONES.filter((o) => rol === "admin" || (o.solo === "gerencia" && rol === "gerencia"));

  return (
    <>
      <Encabezado migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Configuración" }]} titulo="Configuración" descripcion="Ajustes generales del sistema." />
      <MensajesUrl />
      {rol === "admin" && datos && (!datos.rnc || !datos.telefono) ? <Aviso tono="warn">Complete el RNC y el teléfono de la empresa: aparecen en las facturas.</Aviso> : null}
      {visibles.length === 0 ? <Aviso tono="warn">Esta sección es solo para el administrador.</Aviso> : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {visibles.map((o) => (
          <Link key={o.href} href={o.href} className="card flex flex-col gap-1 p-4 hover:border-osmos-teal">
            <strong className="text-osmos-navy">{o.titulo}</strong>
            <span className="text-sm text-osmos-muted">{o.texto}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
