/**
 * GET /api/health
 *
 * Reporta qué integraciones tienen sus variables de entorno configuradas.
 * No hace llamadas de red: solo comprueba presencia de credenciales.
 */
import { Router, type Request, type Response } from "express";

export const healthRouter = Router();

function has(...names: string[]): boolean {
  return names.every((n) => !!process.env[n] && process.env[n]!.trim() !== "");
}

healthRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    services: {
      documentIntelligence: has("AZURE_DI_ENDPOINT", "AZURE_DI_KEY"),
      azureOpenAI: has("AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_KEY", "AZURE_OPENAI_DEPLOYMENT"),
      docuware: has(
        "COMFAMA_DOCUWARE_URL",
        "COMFAMA_DOCUWARE_APIKEY",
        "COMFAMA_DOCUWARE_ARCHIVADOR_ID",
      ),
      comfamaCecos: has("COMFAMA_TOKENIZER_APIKEY", "COMFAMA_CECOS_APIKEY"),
      sapContabilizacion: has("COMFAMA_SAP_TOKENIZER_APIKEY", "COMFAMA_SAP_APIKEY"),
    },
  });
});
