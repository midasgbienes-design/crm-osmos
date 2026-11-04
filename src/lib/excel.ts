// Exportar e importar hojas de Excel (.xlsx) en el navegador.
// Las librerías se cargan solo cuando se usan, para no hacer más pesada la aplicación.

export type TipoExcel = "texto" | "dinero" | "numero" | "fecha";
export type ColumnaExcel = { titulo: string; tipo?: TipoExcel; ancho?: number };

function aFecha(v: unknown): Date | null {
  if (!v) return null;
  const [y, m, d] = String(v).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export async function exportarExcel(archivo: string, hoja: string, columnas: ColumnaExcel[], filas: unknown[][]) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const cabecera = columnas.map((c) => ({ value: c.titulo, fontWeight: "bold" as const, color: "#FFFFFF", backgroundColor: "#00246A" }));
  const datos = filas.map((fila) =>
    fila.map((v, i) => {
      const t = columnas[i]?.tipo ?? "texto";
      if (v === null || v === undefined || v === "") return null;
      if (t === "dinero") return { value: Number(v), type: Number, format: "#,##0.00" };
      if (t === "numero") return { value: Number(v), type: Number };
      if (t === "fecha") {
        const f = aFecha(v);
        return f ? { value: f, type: Date, format: "dd/mm/yyyy" } : { value: String(v), type: String };
      }
      return { value: String(v), type: String };
    }),
  );
  await writeXlsxFile([cabecera, ...datos] as never, {
    sheet: hoja.slice(0, 31).replace(/[\\/?*[\]:]/g, " "),
    columns: columnas.map((c) => ({ width: c.ancho ?? Math.min(48, Math.max(10, c.titulo.length + 4)) })),
    stickyRowsCount: 1,
  }).toFile(`${archivo}.xlsx`);
}

// Devuelve las filas de la primera hoja como arreglos de valores.
export async function leerExcel(archivo: File): Promise<unknown[][]> {
  const { readSheet } = await import("read-excel-file/browser");
  return (await readSheet(archivo)) as unknown[][];
}

export function nombreArchivo(texto: string) {
  const hoy = new Date().toISOString().slice(0, 10);
  return `${texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_")}_${hoy}`;
}
