// Descarga un documento de la pantalla como archivo PDF (tamaño carta),
// sin pasar por el cuadro de impresión. Las librerías se cargan solo al usarlas.

const CARTA = { ancho: 612, alto: 792 }; // puntos
const MARGEN = 24; // puntos arriba y abajo en cada página
const ANCHO_HOJA = 816; // px: ancho de la hoja en pantalla de escritorio

export async function descargarPdf(elemento: HTMLElement, nombre: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

  // Posibles cortes de página: el final de cada fila, párrafo o bloque, para no partir líneas.
  let cortes: number[] = [];
  let altoTotal = 0;
  const canvas = await html2canvas(elemento, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    windowWidth: 1200,
    onclone: (doc, copia) => {
      // Copia los estilos ya cargados a la copia, para no depender de que vuelvan a descargarse.
      const css = [...document.styleSheets]
        .map((h) => {
          try {
            return [...h.cssRules].map((r) => r.cssText).join("\n");
          } catch {
            return "";
          }
        })
        .join("\n");
      const estilo = doc.createElement("style");
      estilo.textContent = css;
      doc.head.appendChild(estilo);
      copia.style.width = `${ANCHO_HOJA}px`;
      copia.style.minWidth = `${ANCHO_HOJA}px`;
      copia.style.maxWidth = `${ANCHO_HOJA}px`;
      copia.style.boxShadow = "none";
      const base = copia.getBoundingClientRect().top;
      altoTotal = copia.getBoundingClientRect().height;
      cortes = [...copia.querySelectorAll("tr, header, section, footer, p, li, h2, dl > div, table")]
        .map((e) => e.getBoundingClientRect().bottom - base)
        .filter((y) => y > 0)
        .sort((a, b) => a - b);
    },
  });

  const anchoCss = canvas.width / 2;
  // Se corta después del último contenido, para no generar una página final en blanco con el margen.
  const altoCss = Math.min(altoTotal || canvas.height / 2, cortes.length ? cortes[cortes.length - 1] + 24 : Infinity);
  const k = CARTA.ancho / anchoCss; // puntos por px
  const altoPagina = (CARTA.alto - 2 * MARGEN) / k; // px de contenido por página

  // Calcula dónde termina cada página.
  const tramos: [number, number][] = [];
  let inicio = 0;
  while (altoCss - inicio > 4) {
    const limite = inicio + altoPagina;
    let fin = altoCss;
    if (limite < altoCss) {
      const candidato = cortes.filter((y) => y > inicio + altoPagina * 0.5 && y <= limite).pop();
      fin = candidato ?? limite;
    }
    tramos.push([inicio, fin]);
    inicio = fin;
  }

  const pdf = new jsPDF({ unit: "pt", format: "letter", compress: true });
  tramos.forEach(([desde, hasta], i) => {
    const parte = document.createElement("canvas");
    parte.width = canvas.width;
    parte.height = Math.max(1, Math.round((hasta - desde) * 2));
    const ctx = parte.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, parte.width, parte.height);
    ctx.drawImage(canvas, 0, Math.round(desde * 2), canvas.width, parte.height, 0, 0, canvas.width, parte.height);
    if (i > 0) pdf.addPage();
    pdf.addImage(parte.toDataURL("image/jpeg", 0.92), "JPEG", 0, MARGEN, CARTA.ancho, (hasta - desde) * k);
    if (tramos.length > 1) {
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`Página ${i + 1} de ${tramos.length}`, CARTA.ancho / 2, CARTA.alto - 10, { align: "center" });
    }
  });
  pdf.setProperties({ title: nombre, creator: "Osmos ERP" });
  // Nombre de archivo sin acentos ni símbolos, para que funcione en cualquier teléfono.
  const archivo = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w .-]+/g, "-").replace(/\s+/g, " ").trim();
  pdf.save(`${archivo || "documento"}.pdf`);
}
