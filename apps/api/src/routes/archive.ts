/**
 * POST /api/archive
 *
 * Archiva el documento y sus datos en DocuWare (vía el gateway Comfama).
 *
 * Body JSON: { fileBase64, fileName, fileType?, fields, ceco?, numeroDocumentoSap? }
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
  ceco?: string;
  numeroDocumentoSap?: string | null;
}

archiveRouter.post("/archive", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as ArchiveBody;

  if (!body.fileBase64 || !body.fileName || !body.fields) {
    return res.status(400).json({
      ok: false,
      error: 'Faltan campos: se requieren "fileBase64", "fileName" y "fields".',
    });
  }

  const startedAt = Date.now();
  try {
    const result = await archiveDocument({
      fileBase64: body.fileBase64,
      fileName: body.fileName,
      fileType: body.fileType ?? "application/octet-stream",
      fields: body.fields,
      ceco: body.ceco,
      numeroDocumentoSap: body.numeroDocumentoSap,
    });
    console.log(`[archive] Terminado en ${Date.now() - startedAt}ms.`);
    return res.json({
      ok: true,
      status: result.status,
      documentId: result.documentId,
      documentUrl: result.documentUrl,
      data: result.data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    console.log(`[archive] Falló tras ${Date.now() - startedAt}ms: ${message}`);
    return res.status(502).json({ ok: false, error: message });
  }
});
