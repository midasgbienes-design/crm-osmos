import { notFound, redirect } from "next/navigation";
import { buscarModulo, rutaSeccion } from "@/lib/modulos";

export default async function ModuloInicio({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  const m = buscarModulo(modulo);
  if (!m) notFound();
  redirect(rutaSeccion(m, m.secciones[0]));
}
