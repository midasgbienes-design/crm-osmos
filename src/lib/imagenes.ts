// Preparación de imágenes de marca en el navegador antes de subirlas:
// reduce el tamaño y crea la versión de marca de agua en un solo tono.
import { supabase } from "@/lib/supabase/cliente";

const AZUL_OSMOS: [number, number, number] = [0, 36, 106];

export async function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Se libera después de dibujar; el navegador ya tiene la imagen decodificada.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function lienzo(img: HTMLImageElement, maxAncho: number) {
  const escala = Math.min(1, maxAncho / (img.naturalWidth || maxAncho));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round((img.naturalWidth || maxAncho) * escala));
  c.height = Math.max(1, Math.round((img.naturalHeight || maxAncho) * escala));
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { c, ctx };
}

// Recorta los bordes vacíos (transparentes o blancos) para que el logo quede ajustado.
function recortar(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const vacio = data[i + 3] < 10 || (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245);
      if (!vacio) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return c;
  const r = document.createElement("canvas");
  r.width = x1 - x0 + 1;
  r.height = y1 - y0 + 1;
  r.getContext("2d")!.drawImage(c, x0, y0, r.width, r.height, 0, 0, r.width, r.height);
  return r;
}

const aBlob = (c: HTMLCanvasElement) => new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo preparar la imagen"))), "image/png"));

// Logo o firma: tal cual, sin bordes vacíos y con un ancho máximo.
export async function prepararLogo(img: HTMLImageElement, maxAncho = 900) {
  const { c } = lienzo(img, maxAncho);
  return aBlob(recortar(c));
}

// Marca de agua: la forma del logo en azul Osmos. Si la imagen tiene fondo transparente
// se usa su contorno; si tiene fondo blanco, las partes oscuras pesan más que las claras.
export async function prepararMarcaDeAgua(img: HTMLImageElement, colores = false) {
  const base = recortar(lienzo(img, 900).c);
  if (colores) return aBlob(base);
  const ctx = base.getContext("2d")!;
  const datos = ctx.getImageData(0, 0, base.width, base.height);
  const d = datos.data;
  let transparente = false;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) { transparente = true; break; }
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const alfa = transparente ? d[i + 3] : Math.round(255 * Math.max(0, 1 - lum) ** 0.8);
    d[i] = AZUL_OSMOS[0];
    d[i + 1] = AZUL_OSMOS[1];
    d[i + 2] = AZUL_OSMOS[2];
    d[i + 3] = alfa;
  }
  ctx.putImageData(datos, 0, 0);
  return aBlob(base);
}

// Sube una imagen a la carpeta pública "marca" y devuelve su dirección.
export async function subirMarca(nombre: string, blob: Blob) {
  const ruta = `${nombre}-${Date.now()}.png`;
  const { error } = await supabase()
    .storage.from("marca")
    .upload(ruta, await blob.arrayBuffer(), { contentType: "image/png", cacheControl: "31536000", upsert: true });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("bucket not found")) throw new Error("Falta la carpeta de imágenes en Supabase. Ejecute la actualización 8-apariencia-documentos.sql.");
    if (m.includes("row-level security") || m.includes("unauthorized")) throw new Error("Solo el administrador puede cambiar las imágenes.");
    if (m.includes("size")) throw new Error("La imagen es muy grande (máximo 2 MB).");
    throw new Error(error.message);
  }
  return supabase().storage.from("marca").getPublicUrl(ruta).data.publicUrl;
}
