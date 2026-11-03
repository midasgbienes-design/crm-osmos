import { VistaSeccion } from "@/components/vista-seccion";

export const dynamic = "force-dynamic";

export default async function SeccionGenerica({
  params,
  searchParams,
}: {
  params: Promise<{ modulo: string; seccion: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { modulo, seccion } = await params;
  const { ok, error } = await searchParams;
  return <VistaSeccion modulo={modulo} seccion={seccion} ok={ok} errorAccion={error} />;
}
