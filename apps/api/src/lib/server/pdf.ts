/**
 * Conversión de PDF a PNG (para poder validar legibilidad con visión).
 *
 * Document Intelligence acepta PDF nativo, así que el OCR NO necesita esto.
 * Solo la compuerta de visión (/api/validate) requiere una imagen, y por eso
 * convertimos la primera página del PDF a PNG antes de mandarla al modelo.
 *
 * Usa `pdf-to-img` (JS puro sobre pdfjs, sin Ghostscript ni ImageMagick).
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function normalizeBase64(input: string): string {
  const commaIdx = input.indexOf(",");
  if (input.startsWith("data:") && commaIdx !== -1) return input.slice(commaIdx + 1);
  return input;
}

/** Resolución del render. 2 = buena nitidez sin archivos gigantes. */
const RENDER_SCALE = 2;

/**
 * Ruta a las fuentes estándar de pdfjs. Sin esto, los PDF que usan fuentes
 * no embebidas (Helvetica, Times, etc.) se renderizarían sin texto.
 */
function standardFontDataUrl(): string {
  // Con npm workspaces, pdfjs-dist puede quedar hoisteado en la raíz del
  // monorepo (no en apps/api/node_modules). Resolvemos su ubicación real en vez
  // de asumir process.cwd()/node_modules.
  try {
    const pkgJson = require.resolve("pdfjs-dist/package.json").replace(/\\/g, "/");
    const dir = pkgJson.replace(/\/package\.json$/, "");
    return `${dir}/standard_fonts/`;
  } catch {
    const root = process.cwd().replace(/\\/g, "/");
    return `${root}/node_modules/pdfjs-dist/standard_fonts/`;
  }
}

function docInitParams() {
  return { standardFontDataUrl: standardFontDataUrl() };
}

/**
 * Convierte la PRIMERA página de un PDF (base64) a PNG y devuelve su base64.
 */
export async function pdfFirstPageToPngBase64(pdfBase64: string): Promise<string> {
  const bytes = Buffer.from(normalizeBase64(pdfBase64), "base64");
  const { pdf } = await import("pdf-to-img");

  const doc = await pdf(bytes as unknown as Buffer, {
    scale: RENDER_SCALE,
    docInitParams: docInitParams(),
  });
  if (doc.length < 1) {
    throw new Error("El PDF no contiene páginas.");
  }
  const pngBuffer = await doc.getPage(1);
  await doc.destroy();
  return pngBuffer.toString("base64");
}

/**
 * Convierte TODAS las páginas de un PDF (base64) a PNG (base64 por página).
 */
export async function pdfToPngBase64Pages(pdfBase64: string): Promise<string[]> {
  const bytes = Buffer.from(normalizeBase64(pdfBase64), "base64");
  const { pdf } = await import("pdf-to-img");

  const doc = await pdf(bytes as unknown as Buffer, {
    scale: RENDER_SCALE,
    docInitParams: docInitParams(),
  });
  const pages: string[] = [];
  for await (const page of doc) {
    pages.push(page.toString("base64"));
  }
  await doc.destroy();
  return pages;
}
