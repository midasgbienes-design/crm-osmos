import { Cotizador } from "@/components/cotizador";
import { Aviso, Encabezado } from "@/components/ui";
import { datosCotizador } from "@/lib/datos-cotizacion";
import { guardarCotizacion } from "../../acciones";

export const dynamic = "force-dynamic";

export default async function NuevaCotizacion({ searchParams }: { searchParams: Promise<{ error?: string; cliente?: string; prospecto?: string }> }) {
  const { error, cliente, prospecto } = await searchParams;
  const d = await datosCotizador();
  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Comercial", href: "/comercial" }, { texto: "Cotizaciones", href: "/comercial/cotizaciones" }, { texto: "Nueva" }]}
        titulo="Nueva cotización"
        descripcion="Los precios salen del catálogo. El margen se calcula con el costo promedio de inventario."
      />
      {error ? <Aviso tono="bad">{error}</Aviso> : null}
      <Cotizador accion={guardarCotizacion} {...d} inicial={{ cliente_id: cliente ?? null, prospecto_id: prospecto ?? null }} />
    </>
  );
}
