/**
 * POST /api/validate
 *
 * PROMPT 1 (Azure OpenAI · visión): valida si la IMAGEN es legible/apta para OCR
 * ANTES de procesarla. Los PDF se convierten a PNG (primera página) antes de validar.
 */
import { Router, type Request, type Response } from "express";
import { validateDocumentQuality } from "../lib/server/azureOpenAI";
import { pdfFirstPageToPngBase64 } from "../lib/server/pdf";

export const validateRouter = Router();

interface ValidateBody {
  fileBase64?: string;
  fileType?: string;
}

function isPdf(fileType: string, fileBase64: string): boolean {
  if (fileType === "application/pdf") return true;
  if (fileBase64.startsWith("data:application/pdf")) return true;
  return false;
}

validateRouter.post("/validate", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as ValidateBody;

  if (!body.fileBase64) {
    return res.status(400).json({ ok: false, error: 'Falta "fileBase64" en el body.' });
  }

  const fileType = body.fileType ?? "image/jpeg";

  try {
    // El modelo de visión solo acepta imágenes. Si es PDF, convertimos la
    // primera página a PNG antes de validar. Las imágenes pasan tal cual.
    let imageBase64 = body.fileBase64;
    let imageMime = fileType;
    let convertedFromPdf = false;

    if (isPdf(fileType, body.fileBase64)) {
      imageBase64 = await pdfFirstPageToPngBase64(body.fileBase64);
      imageMime = "image/png";
      convertedFromPdf = true;
    } else if (!fileType.startsWith("image/")) {
      return res.status(415).json({
        ok: false,
        error: `Tipo de archivo no soportado para validación: "${fileType}". Usa JPG, PNG o PDF.`,
      });
    }

    const quality = await validateDocumentQuality(imageBase64, imageMime);
    return res.json({ ok: true, quality, convertedFromPdf });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    return res.status(502).json({ ok: false, error: message });
  }
});
