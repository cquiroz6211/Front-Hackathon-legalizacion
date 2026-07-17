/**
 * POST /api/extract
 *
 * PROMPT 2 (Azure OpenAI): a partir del texto OCR, devuelve los campos
 * estructurados (model_key -> valor). No ejecuta OCR: recibe el texto ya extraído.
 */
import { Router, type Request, type Response } from "express";
import { extractFields } from "../lib/server/azureOpenAI";

export const extractRouter = Router();

interface ExtractBody {
  ocrText?: string;
}

extractRouter.post("/extract", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as ExtractBody;

  if (!body.ocrText || body.ocrText.trim() === "") {
    return res.status(400).json({ ok: false, error: 'Falta "ocrText" en el body.' });
  }

  const startedAt = Date.now();
  try {
    const fields = await extractFields(body.ocrText);
    console.log(`[extract] Terminado en ${Date.now() - startedAt}ms.`);
    return res.json({ ok: true, fields });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    console.log(`[extract] Falló tras ${Date.now() - startedAt}ms: ${message}`);
    return res.status(502).json({ ok: false, error: message });
  }
});
