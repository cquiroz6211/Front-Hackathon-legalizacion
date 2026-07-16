/**
 * GET /api/openapi
 *
 * Devuelve la especificación OpenAPI 3.0 del backend (JSON).
 */
import { Router, type Request, type Response } from "express";
import { openApiDocument } from "../lib/server/openapi";

export const openapiRouter = Router();

openapiRouter.get("/openapi", (_req: Request, res: Response) => {
  res.json(openApiDocument);
});
