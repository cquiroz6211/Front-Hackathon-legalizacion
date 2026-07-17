/**
 * POST /api/ocr
 *
 * Azure Document Intelligence (modelo prebuilt-layout). Ejecuta SOLO el OCR:
 * recibe un documento en base64 y devuelve el texto reconstruido y las tablas.
 */
import { Router, type Request, type Response } from "express";
import { analyzeLayout } from "../lib/server/documentIntelligence";

export const ocrRouter = Router();

interface OcrBody {
  fileBase64?: string;
  fileName?: string;
  fileType?: string;
}

ocrRouter.post("/ocr", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as OcrBody;

  if (!body.fileBase64) {
    return res.status(400).json({ ok: false, error: 'Falta "fileBase64" en el body.' });
  }

  const startedAt = Date.now();
  try {
    const ocr = await analyzeLayout(body.fileBase64);
    console.log(`[ocr] Document Intelligence terminado en ${Date.now() - startedAt}ms.`);
    return res.json({ ok: true, ocr: { content: ocr.content, tables: ocr.tables } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    console.log(`[ocr] Falló tras ${Date.now() - startedAt}ms: ${message}`);
    return res.status(502).json({ ok: false, error: message });
  }
});
