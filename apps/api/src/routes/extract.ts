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

  try {
    const fields = await extractFields(body.ocrText);
    return res.json({ ok: true, fields });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    return res.status(502).json({ ok: false, error: message });
  }
});
