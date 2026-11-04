"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Cotizador } from "@/components/cotizador";
import { Aviso, Encabezado } from "@/components/ui";
import { Cargando } from "@/components/mensajes";
import { useDatos } from "@/lib/usar-datos";
import { datosCotizador, guardarCotizacion } from "@/lib/cotizacion";

export default function NuevaCotizacion() {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { datos, error: errCarga } = useDatos(datosCotizador, []);

  const guardar = async (f: FormData) => {
    const r = await guardarCotizacion(f);
    if (r.error) {
      setError(r.error);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push(`/cotizacion/?id=${r.id}&ok=${encodeURIComponent("Cotización guardada.")}`);
  };

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Comercial", href: "/comercial/" }, { texto: "Cotizaciones", href: "/comercial/cotizaciones/" }, { texto: "Nueva" }]}
        titulo="Nueva cotización"
        descripcion="Los precios salen del catálogo. El margen se calcula con el costo promedio de inventario."
      />
      {error ?? errCarga ? <Aviso tono="bad">{error ?? errCarga}</Aviso> : null}
      {!datos ? (
        <Cargando />
      ) : (
        <Cotizador onGuardar={guardar} {...datos} inicial={{ cliente_id: sp.get("cliente"), prospecto_id: sp.get("prospecto") }} />
      )}
    </>
  );
}
