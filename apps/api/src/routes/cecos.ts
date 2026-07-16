/**
 * GET /api/cecos
 *
 * Lista los Centros de Costo (CECOs) desde la API de Comfama. Internamente pide
 * un JWT al tokenizer (con caché) y llama al endpoint OData de CECOs.
 *
 * Query params:
 *   dateto (opcional): fecha YYYYMMDD del filtro. Por defecto, hoy.
 */
import { Router, type Request, type Response } from "express";
import { getCecos } from "../lib/server/comfama";

export const cecosRouter = Router();

cecosRouter.get("/cecos", async (req: Request, res: Response) => {
  const dateto = typeof req.query.dateto === "string" ? req.query.dateto : undefined;

  try {
    const { cecos } = await getCecos(dateto);
    return res.json({ ok: true, count: cecos.length, cecos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    return res.status(502).json({ ok: false, error: message });
  }
});
