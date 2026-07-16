/**
 * Cliente de Azure OpenAI (Chat Completions) para extracción estructurada.
 *
 * Equivalente al snippet Python provisto:
 *   openai.api_base   -> AZURE_OPENAI_ENDPOINT
 *   openai.api_key    -> AZURE_OPENAI_KEY
 *   engine            -> AZURE_OPENAI_DEPLOYMENT
 *   api_version       -> AZURE_OPENAI_API_VERSION
 */
import { openAiConfig } from "./config";
import type { ExtractedFields } from "../types";
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
  QUALITY_VALIDATION_SYSTEM_PROMPT,
  buildQualityUserPrompt,
} from "./prompts";

const EMPTY_FIELDS: ExtractedFields = {
  fecha: "",
  nroFactura: "",
  cliente: "",
  nitCliente: "",
  proveedor: "",
  nit: "",
  direccion: "",
  telefono: "",
  departamento: "",
  municipio: "",
  iva19Base: "",
  iva19Valor: "",
  iva5Base: "",
  iva5Valor: "",
  iva0Base: "",
  iva0Valor: "",
  totalFactura: "",
};

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

/** URL del endpoint de chat completions del deployment configurado. */
function chatCompletionsUrl(): string {
  const cfg = openAiConfig();
  return (
    `${cfg.endpoint}/openai/deployments/${cfg.deployment}/chat/completions` +
    `?api-version=${cfg.apiVersion}`
  );
}

/** Construye un data URL a partir de base64 crudo (o lo devuelve si ya lo es). */
function toDataUrl(base64: string, mimeType: string): string {
  if (base64.startsWith("data:")) return base64;
  const mime = mimeType && mimeType.trim() !== "" ? mimeType : "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

/**
 * POST a chat completions con tolerancia a parámetros no soportados.
 *
 * Los modelos nuevos de Azure OpenAI rechazan algunos parámetros con
 * `code: "unsupported_parameter"` (p.ej. `max_tokens` → usar
 * `max_completion_tokens`, o `temperature` fija). Si eso ocurre, quitamos el
 * parámetro señalado y reintentamos, en vez de fallar.
 */
async function postChatCompletion(
  body: Record<string, unknown>,
  contextLabel: string,
): Promise<string> {
  const cfg = openAiConfig();
  const url = chatCompletionsUrl();
  const payload: Record<string, unknown> = { ...body };

  // Reintentos acotados: uno por cada parámetro no soportado que aparezca.
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "api-key": cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = (await res.json()) as ChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error(`${contextLabel}: respuesta vacía del modelo.`);
      return content;
    }

    const detail = await res.text().catch(() => "");

    // ¿Parámetro no soportado? Lo quitamos y reintentamos.
    if (res.status === 400) {
      let param: string | undefined;
      let code: string | undefined;
      try {
        const parsed = JSON.parse(detail) as { error?: { param?: string; code?: string } };
        param = parsed.error?.param;
        code = parsed.error?.code;
      } catch {
        /* respuesta no-JSON: no se puede reintentar */
      }
      if (code === "unsupported_parameter" && param && param in payload) {
        delete payload[param];
        continue;
      }
    }

    throw new Error(`${contextLabel}: error ${res.status}. ${detail}`);
  }

  throw new Error(`${contextLabel}: no se pudo completar la solicitud tras varios reintentos.`);
}

/** Fuerza a string cualquier valor devuelto por el modelo. */
function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** Toma el JSON del modelo y lo mapea al shape estricto de ExtractedFields. */
function coerceFields(parsed: Record<string, unknown>): ExtractedFields {
  const out: ExtractedFields = { ...EMPTY_FIELDS };
  (Object.keys(EMPTY_FIELDS) as (keyof ExtractedFields)[]).forEach((k) => {
    if (k in parsed) out[k] = toStr(parsed[k]);
  });
  return out;
}

/** Intenta parsear el contenido; tolera que el modelo envuelva en ```json. */
function parseJsonLoose(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const json = start !== -1 && end !== -1 ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(json) as Record<string, unknown>;
}

/**
 * Extrae los campos estructurados a partir del texto OCR usando Azure OpenAI.
 */
export async function extractFields(ocrText: string): Promise<ExtractedFields> {
  const cfg = openAiConfig();
  const content = await postChatCompletion(
    {
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: buildExtractionUserPrompt(ocrText) },
      ],
      max_completion_tokens: cfg.maxTokens,
      temperature: cfg.temperature,
      response_format: { type: "json_object" },
    },
    "Azure OpenAI",
  );

  try {
    return coerceFields(parseJsonLoose(content));
  } catch {
    throw new Error(
      `Azure OpenAI: no se pudo parsear la respuesta como JSON. Respuesta: ${content.slice(0, 500)}`,
    );
  }
}

/* ---------------------------------------------------------------------------
 * PROMPT 1 · Validación de legibilidad (visión, previo al OCR)
 * ------------------------------------------------------------------------- */

export interface QualityCheck {
  legible: boolean;
  calidad: "buena" | "regular" | "mala";
  confianza: number;
  problemas: string[];
  recomendacion: string;
}

const DEFAULT_QUALITY: QualityCheck = {
  legible: false,
  calidad: "mala",
  confianza: 0,
  problemas: [],
  recomendacion: "",
};

function coerceQuality(parsed: Record<string, unknown>): QualityCheck {
  const calidad = String(parsed.calidad ?? "").toLowerCase();
  return {
    legible: parsed.legible === true,
    calidad: calidad === "buena" || calidad === "regular" ? calidad : "mala",
    confianza: typeof parsed.confianza === "number" ? parsed.confianza : 0,
    problemas: Array.isArray(parsed.problemas) ? parsed.problemas.map((p) => String(p)) : [],
    recomendacion: toStr(parsed.recomendacion),
  };
}

/**
 * Valida (con visión) si la imagen es legible/apta para OCR ANTES de procesarla.
 * `imageBase64` puede ser base64 crudo o un data URL; `mimeType` p.ej. image/jpeg.
 */
export async function validateDocumentQuality(
  imageBase64: string,
  mimeType: string,
): Promise<QualityCheck> {
  const dataUrl = toDataUrl(imageBase64, mimeType);

  const content = await postChatCompletion(
    {
      messages: [
        { role: "system", content: QUALITY_VALIDATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: buildQualityUserPrompt() },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_completion_tokens: 500,
      temperature: 0,
      response_format: { type: "json_object" },
    },
    "Azure OpenAI (visión)",
  );

  try {
    return coerceQuality(parseJsonLoose(content));
  } catch {
    return {
      ...DEFAULT_QUALITY,
      recomendacion: `No se pudo interpretar la respuesta del validador: ${content.slice(0, 300)}`,
    };
  }
}
