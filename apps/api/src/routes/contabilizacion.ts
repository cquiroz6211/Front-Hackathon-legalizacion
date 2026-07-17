/**
 * /api/contabilizacion  (SAP · Contabilización de Legados FI)
 *
 * POST  -> crea la contabilización. Body = documento SAP completo (pass-through).
 * GET   -> consulta por número de documento externo. Query: ?numDocExterno=CGI0043-prueba
 *
 * La respuesta incluye `sapStatus` (código HTTP que devolvió SAP) y `data`.
 */
import { Router, type Request, type Response } from "express";
import {
  postContabilizacion,
  getContabilizacion,
  extractNumeroDocumento,
  interpretSapConsulta,
} from "../lib/server/sap";

export const contabilizacionRouter = Router();

contabilizacionRouter.post("/contabilizacion", async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const result = await postContabilizacion(req.body);
    console.log(`[contabilizacion] POST terminado en ${Date.now() - startedAt}ms.`);
    return res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      sapStatus: result.status,
      // SAP no siempre devuelve el número de documento en el POST (a veces
      // solo confirma con `req_id` + advertencias); si no viene, el front debe
      // consultarlo después con GET /contabilizacion?numDocExterno=...
      numeroDocumento: extractNumeroDocumento(result.data),
      data: result.data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    console.log(`[contabilizacion] POST falló tras ${Date.now() - startedAt}ms: ${message}`);
    return res.status(502).json({ ok: false, error: message });
  }
});

contabilizacionRouter.get("/contabilizacion", async (req: Request, res: Response) => {
  const raw = req.query.numDocExterno ?? req.query.NUM_DOC_EXTERNO;
  const numDocExterno = typeof raw === "string" ? raw : null;

  if (!numDocExterno) {
    return res.status(400).json({ ok: false, error: 'Falta el query param "numDocExterno".' });
  }

  const startedAt = Date.now();
  try {
    const result = await getContabilizacion(numDocExterno);
    const resumen = interpretSapConsulta(result.data);
    console.log(`[contabilizacion] GET terminado en ${Date.now() - startedAt}ms.`);
    return res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      sapStatus: result.status,
      numeroDocumento: resumen.numeroDocumento,
      sapEstado: resumen.status,
      sapErrores: resumen.errorMessages,
      data: result.data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    console.log(`[contabilizacion] GET falló tras ${Date.now() - startedAt}ms: ${message}`);
    return res.status(502).json({ ok: false, error: message });
  }
});
