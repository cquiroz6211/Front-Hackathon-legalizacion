/**
 * Cliente de Azure Document Intelligence (modelo prebuilt-layout).
 *
 * Patrón asíncrono:
 *   1. POST .../{model}:analyze     -> 202 Accepted + header `operation-location`
 *   2. GET  operation-location      -> poll hasta status === 'succeeded'
 *   3. devolvemos analyzeResult.content (texto OCR plano listo para el LLM)
 */
import { diConfig } from "./config";

export interface DiTable {
  rowCount: number;
  columnCount: number;
  cells: { rowIndex: number; columnIndex: number; content: string }[];
}

export interface AnalyzeLayoutResult {
  /** Texto plano reconstruido del documento. */
  content: string;
  /** Tablas detectadas (útil para totales/IVA). */
  tables: DiTable[];
  /** Resultado crudo por si el consumidor necesita más detalle. */
  raw: unknown;
}

const POLL_INTERVAL_MS = 1200;
const POLL_TIMEOUT_MS = 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Normaliza el base64: acepta tanto un data URL (`data:...;base64,XXXX`)
 * como el base64 crudo, y devuelve solo la carga útil.
 */
function normalizeBase64(input: string): string {
  const commaIdx = input.indexOf(",");
  if (input.startsWith("data:") && commaIdx !== -1) {
    return input.slice(commaIdx + 1);
  }
  return input;
}

/**
 * Analiza un documento (imagen o PDF) codificado en base64 y devuelve el OCR.
 */
export async function analyzeLayout(base64Source: string): Promise<AnalyzeLayoutResult> {
  const cfg = diConfig();
  const analyzeUrl =
    `${cfg.endpoint}/documentintelligence/documentModels/` +
    `${cfg.model}:analyze?api-version=${cfg.apiVersion}`;

  // 1) Disparar el análisis.
  const submit = await fetch(analyzeUrl, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": cfg.key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base64Source: normalizeBase64(base64Source) }),
  });

  if (submit.status !== 202 && !submit.ok) {
    const detail = await submit.text().catch(() => "");
    throw new Error(
      `Document Intelligence: fallo al iniciar el análisis (${submit.status}). ${detail}`,
    );
  }

  const operationLocation = submit.headers.get("operation-location");
  if (!operationLocation) {
    throw new Error('Document Intelligence: no se recibió el header "operation-location".');
  }

  // 2) Poll hasta que termine.
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  // Bucle acotado por tiempo; el poll a Azure no ocurre en tiempo de build.
  for (;;) {
    if (Date.now() > deadline) {
      throw new Error("Document Intelligence: timeout esperando el resultado del OCR.");
    }
    await sleep(POLL_INTERVAL_MS);

    const poll = await fetch(operationLocation, {
      headers: { "Ocp-Apim-Subscription-Key": cfg.key },
    });
    if (!poll.ok) {
      const detail = await poll.text().catch(() => "");
      throw new Error(
        `Document Intelligence: fallo al consultar el resultado (${poll.status}). ${detail}`,
      );
    }

    const payload = (await poll.json()) as {
      status?: string;
      error?: { message?: string };
      analyzeResult?: {
        content?: string;
        tables?: {
          rowCount: number;
          columnCount: number;
          cells: { rowIndex: number; columnIndex: number; content: string }[];
        }[];
      };
    };

    const status = payload.status;
    if (status === "succeeded") {
      const analyze = payload.analyzeResult ?? {};
      return {
        content: analyze.content ?? "",
        tables: (analyze.tables ?? []).map((t) => ({
          rowCount: t.rowCount,
          columnCount: t.columnCount,
          cells:
            t.cells?.map((c) => ({
              rowIndex: c.rowIndex,
              columnIndex: c.columnIndex,
              content: c.content,
            })) ?? [],
        })),
        raw: payload,
      };
    }
    if (status === "failed") {
      throw new Error(`Document Intelligence: análisis fallido. ${payload.error?.message ?? ""}`);
    }
    // status 'running' | 'notStarted' -> seguir esperando.
  }
}
