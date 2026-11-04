import { MODULOS } from "@/lib/modulos";
import { VistaSeccion } from "@/components/vista-seccion";

// Genera una página por cada función de cada módulo (excepto las que tienen pantalla propia).
export function generateStaticParams() {
  return MODULOS.flatMap((m) => m.secciones.filter((s) => !s.ruta).map((s) => ({ modulo: m.slug, seccion: s.slug })));
}

export default async function SeccionGenerica({ params }: { params: Promise<{ modulo: string; seccion: string }> }) {
  const { modulo, seccion } = await params;
  return <VistaSeccion modulo={modulo} seccion={seccion} />;
}
