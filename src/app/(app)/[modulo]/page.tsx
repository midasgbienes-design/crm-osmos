import { MODULOS } from "@/lib/modulos";
import { RedirigirModulo } from "./redirigir";

export function generateStaticParams() {
  return MODULOS.map((m) => ({ modulo: m.slug }));
}

export default async function ModuloInicio({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  return <RedirigirModulo modulo={modulo} />;
}
