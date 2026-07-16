/**
 * POST /api/archive
 *
 * Archiva el documento y sus datos en DocuWare.
 *
 * Body JSON: { fileBase64, fileName, fileType?, fields, extraIndex? }
 */
import { Router, type Request, type Response } from "express";
import { archiveDocument } from "../lib/server/docuware";
import type { ExtractedFields } from "../lib/types";

export const archiveRouter = Router();

interface ArchiveBody {
  fileBase64?: string;
  fileName?: string;
  fileType?: string;
  fields?: ExtractedFields;
  extraIndex?: Record<string, string>;
}

archiveRouter.post("/archive", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as ArchiveBody;

  if (!body.fileBase64 || !body.fileName || !body.fields) {
    return res.status(400).json({
      ok: false,
      error: 'Faltan campos: se requieren "fileBase64", "fileName" y "fields".',
    });
  }

  try {
    const result = await archiveDocument({
      fileBase64: body.fileBase64,
      fileName: body.fileName,
      fileType: body.fileType ?? "application/octet-stream",
      fields: body.fields,
      extraIndex: body.extraIndex,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    return res.status(502).json({ ok: false, error: message });
  }
});
