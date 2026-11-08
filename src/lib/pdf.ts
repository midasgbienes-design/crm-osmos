// Descarga un documento de la pantalla como archivo PDF (tamaño carta),
// sin pasar por el cuadro de impresión. Las librerías se cargan solo al usarlas.

const CARTA = { ancho: 612, alto: 792 }; // puntos
const ANCHO_HOJA = 816; // px: ancho de la hoja en pantalla (carta a 96 ppp)
const ALTO_HOJA = 1056; // px
const FRANJA = 34; // px: franja lateral con los colores de Osmos
const COLORES_FRANJA: [number, number, string][] = [[0, 0.82, "#00246A"], [0.82, 0.94, "#0093A5"], [0.94, 1, "#D3D200"]];

// Convierte una imagen de la página en datos para insertarla en el PDF.
async function imagenDatos(src: string): Promise<{ datos: string; ancho: number; alto: number } | null> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return { datos: c.toDataURL("image/png"), ancho: img.naturalWidth, alto: img.naturalHeight };
  } catch {
    return null;
  }
}

export async function descargarPdf(elemento: HTMLElement, nombre: string) {
  const [{ default: html2canvas }, { jsPDF, GState }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

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
      // La franja y la marca de agua se dibujan aparte en cada página del PDF.
      copia.querySelectorAll<HTMLElement>("[data-pdf=franja]").forEach((x) => (x.style.visibility = "hidden"));
      copia.querySelectorAll<HTMLElement>("[data-pdf=agua]").forEach((x) => (x.style.display = "none"));
      const base = copia.getBoundingClientRect().top;
      altoTotal = copia.getBoundingClientRect().height;
      cortes = [...copia.querySelectorAll("tr, header, section, footer, p, li, h2, dl > div, table")]
        .map((e) => e.getBoundingClientRect().bottom - base)
        .filter((y) => y > 0)
        .sort((a, b) => a - b);
    },
  });

  const anchoCss = canvas.width / 2;
  const k = CARTA.ancho / anchoCss; // puntos por px
  const total = altoTotal || canvas.height / 2;
  const unaPagina = total <= ALTO_HOJA + 4;

  // Páginas: si cabe en una, ocupa la hoja completa; si no, se corta entre filas o bloques.
  const ARRIBA = 34; // pt de margen superior desde la segunda página
  const ABAJO = 28; // pt de margen inferior (número de página)
  const tramos: { desde: number; hasta: number; y: number }[] = [];
  if (unaPagina) {
    tramos.push({ desde: 0, hasta: Math.min(total, ALTO_HOJA), y: 0 });
  } else {
    const altoCss = Math.min(total, cortes.length ? cortes[cortes.length - 1] + 24 : Infinity);
    let inicio = 0;
    while (altoCss - inicio > 4) {
      const y = tramos.length ? ARRIBA : 0;
      const altoPagina = (CARTA.alto - y - ABAJO) / k;
      const limite = inicio + altoPagina;
      let fin = altoCss;
      if (limite < altoCss) fin = cortes.filter((c) => c > inicio + altoPagina * 0.5 && c <= limite).pop() ?? limite;
      tramos.push({ desde: inicio, hasta: fin, y });
      inicio = fin;
    }
  }

  const agua = elemento.querySelector<HTMLImageElement>("[data-pdf=agua]");
  const marca = agua ? await imagenDatos(agua.currentSrc || agua.src) : null;
  const franja = elemento.querySelector("[data-pdf=franja]") ? FRANJA * k : 0;

  const pdf = new jsPDF({ unit: "pt", format: "letter", compress: true });
  tramos.forEach(({ desde, hasta, y }, i) => {
    const parte = document.createElement("canvas");
    parte.width = canvas.width;
    parte.height = Math.max(1, Math.round((hasta - desde) * 2));
    const ctx = parte.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, parte.width, parte.height);
    ctx.drawImage(canvas, 0, Math.round(desde * 2), canvas.width, parte.height, 0, 0, canvas.width, parte.height);
    if (i > 0) pdf.addPage();
    pdf.addImage(parte.toDataURL("image/jpeg", 0.92), "JPEG", 0, y, CARTA.ancho, (hasta - desde) * k);
    // Franja lateral de borde a borde en cada página
    if (franja) {
      for (const [a, b, color] of COLORES_FRANJA) {
        pdf.setFillColor(color);
        pdf.rect(0, CARTA.alto * a, franja, CARTA.alto * (b - a), "F");
      }
    }
    // Marca de agua centrada en el área de contenido
    if (marca) {
      const w = 600 * k;
      const h = (w * marca.alto) / marca.ancho;
      const cx = (ANCHO_HOJA / 2 + FRANJA / 2) * k;
      const cy = CARTA.alto * 0.55;
      pdf.saveGraphicsState();
      pdf.setGState(new GState({ opacity: 0.05 }));
      pdf.addImage(marca.datos, "PNG", cx - w / 2, cy - h / 2, w, h);
      pdf.restoreGraphicsState();
    }
    if (tramos.length > 1) {
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`Página ${i + 1} de ${tramos.length}`, (CARTA.ancho + franja) / 2, CARTA.alto - 12, { align: "center" });
    }
  });
  pdf.setProperties({ title: nombre, creator: "Osmos ERP" });
  // Nombre de archivo sin acentos ni símbolos, para que funcione en cualquier teléfono.
  const archivo = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w .-]+/g, "-").replace(/\s+/g, " ").trim();
  pdf.save(`${archivo || "documento"}.pdf`);
}
