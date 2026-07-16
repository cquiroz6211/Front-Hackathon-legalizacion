/**
 * Punto de entrada del backend (Express).
 *
 * Carga variables de entorno desde `apps/api/.env` (dotenv) y levanta el
 * servidor HTTP. Los Route Handlers viven en `src/routes/*` y toda la lógica de
 * integración (Azure DI/OpenAI, Comfama CECOs, SAP, DocuWare) en `src/lib/server/*`.
 */
import "dotenv/config";
import { createApp } from "./app";

const PORT = Number(process.env.PORT ?? 3001);

const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] Backend escuchando en http://localhost:${PORT}`);
  console.log(`[api] Health:  http://localhost:${PORT}/api/health`);
  console.log(`[api] OpenAPI: http://localhost:${PORT}/api/openapi`);
});
