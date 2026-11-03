import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarModulo, rutaSeccion } from "@/lib/modulos";
import { Aviso, Encabezado, Pestanas } from "@/components/ui";
import { Tabla } from "@/components/tabla";
import { ejecutarAccion } from "@/app/(app)/[modulo]/acciones";

export async function VistaSeccion({
  modulo,
  seccion,
  ok,
  errorAccion,
}: {
  modulo: string;
  seccion: string;
  ok?: string;
  errorAccion?: string;
}) {
  const m = buscarModulo(modulo);
  const s = m?.secciones.find((x) => x.slug === seccion);
  if (!m || !s) notFound();
  if (s.ruta && s.ruta !== `/${modulo}/${seccion}`) redirect(s.ruta);

  const supabase = await createClient();
  let consulta = supabase.from(s.tabla!).select(s.select ?? "*").limit(500);
  if (s.orden) consulta = consulta.order(s.orden.campo, { ascending: s.orden.asc ?? true, nullsFirst: false });
  const { data, error } = await consulta;

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: m.nombre, href: `/${m.slug}` }, { texto: s.nombre }]}
        titulo={s.nombre}
        descripcion={s.descripcion ?? m.descripcion}
      >
        {s.acciones?.map((a) => (
          <form key={a.rpc} action={ejecutarAccion}>
            <input type="hidden" name="modulo" value={m.slug} />
            <input type="hidden" name="seccion" value={s.slug} />
            <input type="hidden" name="rpc" value={a.rpc} />
            <button type="submit" className="btn-primary">
              {a.etiqueta}
            </button>
          </form>
        ))}
      </Encabezado>

      <Pestanas items={m.secciones.map((x) => ({ slug: x.slug, nombre: x.nombre, href: rutaSeccion(m, x) }))} activa={s.slug} />

      {ok ? <Aviso tono="ok">{ok}</Aviso> : null}
      {errorAccion ? <Aviso tono="bad">{errorAccion}</Aviso> : null}

      <section className="card flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-osmos-line px-3.5 py-3 text-[13px] text-osmos-muted">
          <span>{error ? "No se pudo cargar la información" : `${data?.length ?? 0} registros`}</span>
        </div>
        {error ? (
          <div className="p-4">
            <Aviso tono="bad">
              {error.code === "42501" || error.message.includes("permission")
                ? "Su rol no tiene acceso a esta sección."
                : `Error al consultar: ${error.message}`}
            </Aviso>
          </div>
        ) : (
          <Tabla columnas={s.columnas ?? []} filas={(data ?? []) as unknown as Record<string, unknown>[]} />
        )}
      </section>
    </>
  );
}
