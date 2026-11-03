import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MODULOS, rutaSeccion } from "@/lib/modulos";
import { formatoDinero, formatoNumero } from "@/lib/formato";
import { Encabezado, Kpi } from "@/components/ui";

export const dynamic = "force-dynamic";

async function suma(promesa: PromiseLike<{ data: unknown; error: unknown }>, campo: string) {
  const { data, error } = await promesa;
  if (error || !Array.isArray(data)) return null;
  return (data as Record<string, unknown>[]).reduce((t, f) => t + Number(f[campo] ?? 0), 0);
}

export default async function Inicio() {
  const supabase = await createClient();

  const [porCobrar, porPagar, cuotas, prospectos, reposiciones] = await Promise.all([
    suma(supabase.from("facturas").select("saldo").gt("saldo", 0).not("estado", "in", "(anulada,borrador)"), "saldo"),
    suma(supabase.from("facturas_suplidor").select("saldo").gt("saldo", 0).neq("estado", "anulada"), "saldo"),
    supabase.from("igualas").select("cuota_mensual").in("estado", ["vigente", "por_renovar"]),
    supabase.from("prospectos").select("id", { count: "exact", head: true }).in("estado", ["nuevo", "contactado", "calificado"]),
    supabase.from("v_base_instalada").select("componente_id", { count: "exact", head: true }).in("estado_reposicion", ["vencido", "proximo"]),
  ]);

  const igualas = cuotas.data ?? [];
  const ingresoRecurrente = igualas.reduce((t, f) => t + Number(f.cuota_mensual ?? 0), 0);

  return (
    <>
      <Encabezado migas={[{ texto: "Osmos ERP" }, { texto: "Inicio" }]} titulo="Inicio" descripcion="Resumen de la empresa y acceso a todas las funciones del sistema" />

      <section aria-label="Indicadores" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <Kpi titulo="Cuentas por cobrar" valor={porCobrar === null ? "—" : formatoDinero(porCobrar)} tono="info" detalle="Saldo de facturas abiertas" />
        <Kpi titulo="Cuentas por pagar" valor={porPagar === null ? "—" : formatoDinero(porPagar)} tono="warn" detalle="Suplidores y vendedores externos" />
        <Kpi titulo="Ingreso recurrente (igualas)" valor={cuotas.error ? "—" : formatoDinero(ingresoRecurrente)} tono="ok" detalle={`${igualas.length} igualas activas`} />
        <Kpi titulo="Prospectos abiertos" valor={prospectos.error ? "—" : formatoNumero(prospectos.count ?? 0)} tono="info" detalle="Nuevos, contactados y calificados" />
        <Kpi titulo="Reposiciones pendientes" valor={reposiciones.error ? "—" : formatoNumero(reposiciones.count ?? 0)} tono="warn" detalle="Base instalada, próximos 60 días" />
      </section>

      {MODULOS.map((m) => (
        <section key={m.slug} className="flex flex-col gap-2.5">
          <h2 className="text-[15px] font-bold text-osmos-navy">{m.nombre}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-2.5">
            {m.secciones.map((s) => (
              <Link
                key={s.slug}
                href={rutaSeccion(m, s)}
                className="card flex min-h-[84px] flex-col justify-between gap-2 p-3.5 text-left hover:border-osmos-teal"
              >
                <span className="text-sm font-semibold leading-[18px]">{s.nombre}</span>
                <span className="text-xs text-osmos-muted">Abrir</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
