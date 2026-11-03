import { VistaSeccion } from "@/components/vista-seccion";

export const dynamic = "force-dynamic";

export default async function SeccionComercial({
  params,
  searchParams,
}: {
  params: Promise<{ seccion: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { seccion } = await params;
  const { ok, error } = await searchParams;
  return <VistaSeccion modulo="comercial" seccion={seccion} ok={ok} errorAccion={error} />;
}
