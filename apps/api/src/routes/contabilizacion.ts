/**
 * /api/contabilizacion  (SAP · Contabilización de Legados FI)
 *
 * POST  -> crea la contabilización. Body = documento SAP completo (pass-through).
 * GET   -> consulta por número de documento externo. Query: ?numDocExterno=CGI0043-prueba
 *
 * La respuesta incluye `sapStatus` (código HTTP que devolvió SAP) y `data`.
 */
import { Router, type Request, type Response } from "express";
import { postContabilizacion, getContabilizacion, extractNumeroDocumento } from "../lib/server/sap";

export const contabilizacionRouter = Router();

contabilizacionRouter.post("/contabilizacion", async (req: Request, res: Response) => {
  try {
    const result = await postContabilizacion(req.body);
    return res
      .status(result.ok ? 200 : 502)
      .json({ ok: result.ok, sapStatus: result.status, data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    return res.status(502).json({ ok: false, error: message });
  }
});

contabilizacionRouter.get("/contabilizacion", async (req: Request, res: Response) => {
  const raw = req.query.numDocExterno ?? req.query.NUM_DOC_EXTERNO;
  const numDocExterno = typeof raw === "string" ? raw : null;

  if (!numDocExterno) {
    return res.status(400).json({ ok: false, error: 'Falta el query param "numDocExterno".' });
  }

  try {
    const result = await getContabilizacion(numDocExterno);
    return res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      sapStatus: result.status,
      numeroDocumento: extractNumeroDocumento(result.data),
      data: result.data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    return res.status(502).json({ ok: false, error: message });
  }
});
