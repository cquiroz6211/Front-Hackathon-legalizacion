/**
 * App Express: middlewares + montaje de rutas.
 *
 * Todas las rutas cuelgan de `/api` (equivalente a los Route Handlers de Next.js
 * en `app/api/**`). El body JSON admite hasta 25 MB porque los documentos viajan
 * como base64 (facturas escaneadas / PDFs).
 */
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";

import { healthRouter } from "./routes/health";
import { processRouter } from "./routes/process";
import { ocrRouter } from "./routes/ocr";
import { extractRouter } from "./routes/extract";
import { validateRouter } from "./routes/validate";
import { cecosRouter } from "./routes/cecos";
import { contabilizacionRouter } from "./routes/contabilizacion";
import { archiveRouter } from "./routes/archive";
import { openapiRouter } from "./routes/openapi";

export function createApp() {
  const app = express();

  // CORS abierto para desarrollo (el frontend Vite corre en otro origen/puerto).
  // En producción, restringir `origin` al dominio del portal.
  app.use(cors());
  // `type: () => true` parsea el body como JSON sin depender del header
  // Content-Type (equivalente a `req.json()` de Next.js). 25 MB porque los
  // documentos viajan en base64.
  app.use(express.json({ limit: "25mb", type: () => true }));

  const routers = [
    healthRouter,
    processRouter,
    ocrRouter,
    extractRouter,
    validateRouter,
    cecosRouter,
    contabilizacionRouter,
    archiveRouter,
    openapiRouter,
  ];
  for (const router of routers) {
    app.use("/api", router);
  }

  // Métodos permitidos por ruta. Si la ruta existe pero el método no está
  // permitido, se responde 405 (paridad con el App Router de Next.js) en vez de
  // caer en el 404 genérico.
  const ALLOWED: Record<string, string[]> = {
    "/api/health": ["GET"],
    "/api/process": ["POST"],
    "/api/ocr": ["POST"],
    "/api/extract": ["POST"],
    "/api/validate": ["POST"],
    "/api/cecos": ["GET"],
    "/api/contabilizacion": ["GET", "POST"],
    "/api/archive": ["POST"],
    "/api/openapi": ["GET"],
  };
  app.use((req: Request, res: Response, next: NextFunction) => {
    const methods = ALLOWED[req.path];
    if (methods && !methods.includes(req.method)) {
      res.set("Allow", methods.join(", "));
      return res.status(405).json({ ok: false, error: "Método no permitido." });
    }
    next();
  });

  // 404 en JSON para cualquier ruta /api no encontrada.
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: "Ruta no encontrada." });
  });

  // Manejador de errores: convierte fallos de parseo de body y errores no
  // controlados en respuestas JSON consistentes (mismo contrato { ok, error }).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const type =
      typeof err === "object" && err !== null && "type" in err
        ? (err as { type?: string }).type
        : undefined;
    if (type === "entity.parse.failed") {
      return res.status(400).json({ ok: false, error: "JSON inválido en el body." });
    }
    const message = err instanceof Error ? err.message : "Error interno del servidor.";
    return res.status(500).json({ ok: false, error: message });
  });

  return app;
}
