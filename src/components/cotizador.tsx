"use client";

import { useMemo, useState } from "react";

export type ProductoCot = {
  id: string;
  codigo: string;
  nombre: string;
  precio_venta: number;
  costo_promedio: number;
  aplica_itbis: boolean;
};

type Opcion = { id: string; nombre: string };

type Linea = { producto_id: string; descripcion: string; cantidad: string; precio: string; descuento_pct: string };

export type CotizacionInicial = {
  id?: string;
  cliente_id?: string | null;
  prospecto_id?: string | null;
  vendedor_id?: string | null;
  vence?: string | null;
  notas?: string | null;
  lineas?: { producto_id: string | null; descripcion: string; cantidad: number; precio: number; descuento_pct: number }[];
};

const dinero = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rd = (n: number) => `RD$ ${dinero.format(n)}`;
const r2 = (n: number) => Math.round(n * 100) / 100;

const lineaVacia = (): Linea => ({ producto_id: "", descripcion: "", cantidad: "1", precio: "", descuento_pct: "0" });

export function Cotizador({
  onGuardar,
  productos,
  clientes,
  prospectos,
  vendedores,
  tasaItbis,
  descuentoMax,
  margenMin,
  inicial,
}: {
  onGuardar: (formData: FormData) => Promise<void>;
  productos: ProductoCot[];
  clientes: Opcion[];
  prospectos: Opcion[];
  vendedores: Opcion[];
  tasaItbis: number;
  descuentoMax: number;
  margenMin: number;
  inicial?: CotizacionInicial;
}) {
  const [guardando, setGuardando] = useState(false);
  const [para, setPara] = useState<"cliente" | "prospecto">(inicial?.prospecto_id && !inicial?.cliente_id ? "prospecto" : "cliente");
  const [lineas, setLineas] = useState<Linea[]>(
    inicial?.lineas?.length
      ? inicial.lineas.map((l) => ({
          producto_id: l.producto_id ?? "",
          descripcion: l.descripcion,
          cantidad: String(l.cantidad),
          precio: String(l.precio),
          descuento_pct: String(l.descuento_pct),
        }))
      : [lineaVacia()],
  );

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  const calculo = useMemo(() => {
    let bruto = 0, neto = 0, itbis = 0, costo = 0, maxDesc = 0;
    const filas = lineas.map((l) => {
      const p = porId.get(l.producto_id);
      const cant = Number(l.cantidad) || 0;
      const precio = l.precio === "" ? p?.precio_venta ?? 0 : Number(l.precio) || 0;
      const dpct = Math.min(Math.max(Number(l.descuento_pct) || 0, 0), 100);
      const b = r2(cant * precio);
      const n = r2(b * (1 - dpct / 100));
      const i = p?.aplica_itbis === false ? 0 : r2((n * tasaItbis) / 100);
      const c = (p?.costo_promedio ?? 0) * cant;
      bruto += b; neto += n; itbis += i; costo += c; maxDesc = Math.max(maxDesc, dpct);
      return { total: n + i, margen: n > 0 ? ((n - c) / n) * 100 : null };
    });
    const margen = neto > 0 ? ((neto - costo) / neto) * 100 : null;
    const requiere = maxDesc > descuentoMax || (margen ?? 0) < margenMin;
    return { filas, bruto, descuento: bruto - neto, itbis, total: neto + itbis, margen, requiere, maxDesc };
  }, [lineas, porId, tasaItbis, descuentoMax, margenMin]);

  const set = (i: number, campo: keyof Linea, valor: string) =>
    setLineas((ls) =>
      ls.map((l, j) => {
        if (j !== i) return l;
        const nueva = { ...l, [campo]: valor };
        if (campo === "producto_id") {
          const p = porId.get(valor);
          nueva.descripcion = p?.nombre ?? "";
          nueva.precio = p ? String(p.precio_venta) : "";
        }
        return nueva;
      }),
    );

  const payload = JSON.stringify(
    lineas
      .filter((l) => l.producto_id || l.descripcion)
      .map((l) => ({
        producto_id: l.producto_id || null,
        descripcion: l.descripcion,
        cantidad: Number(l.cantidad) || 0,
        precio: l.precio === "" ? null : Number(l.precio),
        descuento_pct: Number(l.descuento_pct) || 0,
      })),
  );

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
          await onGuardar(new FormData(e.currentTarget));
        } finally {
          setGuardando(false);
        }
      }}
      className="flex flex-col gap-4"
    >
      {inicial?.id ? <input type="hidden" name="id" value={inicial.id} /> : null}
      <input type="hidden" name="lineas" value={payload} />

      <section className="card grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 p-4">
        <fieldset className="flex flex-col gap-1">
          <legend className="label">Cotizar a</legend>
          <div className="flex gap-2">
            {(["cliente", "prospecto"] as const).map((t) => (
              <label key={t} className={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm ${para === t ? "border-osmos-navy bg-osmos-navy font-bold text-white" : "border-[#B8C4DD] text-osmos-navy"}`}>
                <input type="radio" name="para" value={t} checked={para === t} onChange={() => setPara(t)} className="sr-only" />
                {t === "cliente" ? "Cliente" : "Prospecto"}
              </label>
            ))}
          </div>
        </fieldset>
        {para === "cliente" ? (
          <div>
            <label className="label" htmlFor="cliente_id">Cliente *</label>
            <select id="cliente_id" name="cliente_id" required defaultValue={inicial?.cliente_id ?? ""} className="input">
              <option value="">Seleccione…</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="prospecto_id">Prospecto *</label>
            <select id="prospecto_id" name="prospecto_id" required defaultValue={inicial?.prospecto_id ?? ""} className="input">
              <option value="">Seleccione…</option>
              {prospectos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="vendedor_id">Vendedor</label>
          <select id="vendedor_id" name="vendedor_id" defaultValue={inicial?.vendedor_id ?? ""} className="input">
            <option value="">— Sin asignar —</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="vence">Válida hasta</label>
          <input id="vence" name="vence" type="date" defaultValue={inicial?.vence ?? ""} className="input" />
        </div>
      </section>

      <section className="card flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F7F9FC]">
                {["Producto o servicio", "Descripción", "Cantidad", "Precio", "Desc. %", "Margen", "Total", ""].map((h) => (
                  <th key={h} scope="col" className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => {
                const f = calculo.filas[i];
                const bajo = f.margen !== null && f.margen < margenMin;
                return (
                  <tr key={i} className="align-top">
                    <td className="td min-w-[200px]">
                      <label className="sr-only" htmlFor={`prod-${i}`}>Producto</label>
                      <select id={`prod-${i}`} value={l.producto_id} onChange={(e) => set(i, "producto_id", e.target.value)} className="input">
                        <option value="">— Línea libre —</option>
                        {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
                      </select>
                    </td>
                    <td className="td min-w-[200px]">
                      <label className="sr-only" htmlFor={`desc-${i}`}>Descripción</label>
                      <input id={`desc-${i}`} value={l.descripcion} onChange={(e) => set(i, "descripcion", e.target.value)} className="input" />
                    </td>
                    <td className="td w-[90px]">
                      <label className="sr-only" htmlFor={`cant-${i}`}>Cantidad</label>
                      <input id={`cant-${i}`} type="number" min="0" step="any" value={l.cantidad} onChange={(e) => set(i, "cantidad", e.target.value)} className="input text-right" />
                    </td>
                    <td className="td w-[140px]">
                      <label className="sr-only" htmlFor={`precio-${i}`}>Precio</label>
                      <input id={`precio-${i}`} type="number" min="0" step="0.01" value={l.precio} onChange={(e) => set(i, "precio", e.target.value)} className="input text-right" />
                    </td>
                    <td className="td w-[90px]">
                      <label className="sr-only" htmlFor={`dpct-${i}`}>Descuento</label>
                      <input id={`dpct-${i}`} type="number" min="0" max="100" step="0.5" value={l.descuento_pct} onChange={(e) => set(i, "descuento_pct", e.target.value)} className={`input text-right ${Number(l.descuento_pct) > descuentoMax ? "border-[#A12020]" : ""}`} />
                    </td>
                    <td className={`td text-right tabular-nums ${bajo ? "font-bold text-[#A12020]" : ""}`}>
                      {f.margen === null ? "—" : `${f.margen.toFixed(1)}%`}
                    </td>
                    <td className="td text-right font-semibold tabular-nums">{rd(f.total)}</td>
                    <td className="td">
                      <button type="button" aria-label={`Quitar línea ${i + 1}`} onClick={() => setLineas((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [lineaVacia()]))} className="btn-secondary h-9 px-3">
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4 p-4">
          <button type="button" onClick={() => setLineas((ls) => [...ls, lineaVacia()])} className="btn-secondary">
            + Agregar línea
          </button>
          <dl className="grid min-w-[280px] grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-osmos-muted">Subtotal</dt><dd className="text-right tabular-nums">{rd(calculo.bruto)}</dd>
            <dt className="text-osmos-muted">Descuento</dt><dd className="text-right tabular-nums">-{rd(calculo.descuento)}</dd>
            <dt className="text-osmos-muted">ITBIS ({tasaItbis}%)</dt><dd className="text-right tabular-nums">{rd(calculo.itbis)}</dd>
            <dt className="font-bold text-osmos-navy">Total</dt><dd className="text-right text-lg font-bold tabular-nums text-osmos-navy">{rd(calculo.total)}</dd>
            <dt className="text-osmos-muted">Margen</dt>
            <dd className={`text-right font-bold tabular-nums ${calculo.margen !== null && calculo.margen < margenMin ? "text-[#A12020]" : "text-[#1D6B3A]"}`}>
              {calculo.margen === null ? "—" : `${calculo.margen.toFixed(1)}%`}
            </dd>
          </dl>
        </div>
      </section>

      {calculo.requiere ? (
        <div className="rounded-md bg-[#FFF4D6] px-3.5 py-2.5 text-sm text-[#7A5600]">
          Esta cotización necesitará aprobación de gerencia antes de enviarse
          {calculo.maxDesc > descuentoMax ? `: tiene un descuento mayor a ${descuentoMax}%` : ""}
          {(calculo.margen ?? 0) < margenMin ? `${calculo.maxDesc > descuentoMax ? " y" : ":"} el margen está por debajo de ${margenMin}%` : ""}.
        </div>
      ) : null}

      <section className="card p-4">
        <label className="label" htmlFor="notas">Notas y condiciones</label>
        <textarea id="notas" name="notas" rows={3} defaultValue={inicial?.notas ?? ""} className="input h-auto py-2" placeholder="Garantía, tiempo de entrega, forma de pago…" />
      </section>

      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className="btn-primary h-10">{guardando ? "Guardando…" : "Guardar cotización"}</button>
      </div>
    </form>
  );
}
