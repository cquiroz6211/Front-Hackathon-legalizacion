/**
 * POST /api/process
 *
 * Recibe un documento (base64) y devuelve los campos extraídos:
 *   1. OCR con Azure Document Intelligence (prebuilt-layout)
 *   2. Extracción estructurada con Azure OpenAI
 */
import { Router, type Request, type Response } from "express";
import { analyzeLayout } from "../lib/server/documentIntelligence";
import { extractFields } from "../lib/server/azureOpenAI";

export const processRouter = Router();

interface ProcessBody {
  fileBase64?: string;
  fileName?: string;
  fileType?: string;
}

processRouter.post("/process", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as ProcessBody;

  if (!body.fileBase64) {
    return res.status(400).json({ ok: false, error: 'Falta "fileBase64" en el body.' });
  }

  const startedAt = Date.now();
  console.log(`[process] Inicio del flujo completo (${body.fileName ?? "sin nombre"}).`);

  try {
    const ocrStartedAt = Date.now();
    const ocr = await analyzeLayout(body.fileBase64);
    console.log(`[process] OCR (Document Intelligence): ${Date.now() - ocrStartedAt}ms`);
    if (!ocr.content) {
      return res.status(422).json({ ok: false, error: "El OCR no devolvió texto legible." });
    }

    const extractStartedAt = Date.now();
    const fields = await extractFields(ocr.content);
    console.log(`[process] Extracción (Azure OpenAI): ${Date.now() - extractStartedAt}ms`);

    console.log(`[process] Flujo completo terminado en ${Date.now() - startedAt}ms.`);
    return res.json({ ok: true, fields, ocr: { content: ocr.content } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    console.log(`[process] Flujo completo falló tras ${Date.now() - startedAt}ms: ${message}`);
    return res.status(502).json({ ok: false, error: message });
  }
});
