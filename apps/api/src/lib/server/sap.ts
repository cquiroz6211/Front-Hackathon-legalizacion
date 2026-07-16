/**
 * Cliente de SAP (Contabilización de Legados FI) vía integraciones Comfama.
 *
 *   POST .../FI/Contabilizacion              -> crea la contabilización
 *   GET  .../FI/Contabilizacion?NUM_DOC_EXTERNO=xxx -> consulta el estado
 *
 * Autenticación: mismo JWT del tokenizer (getAccessToken) como Bearer, más los
 * headers `apikey` e `id_fuente`. El cuerpo de la contabilización es un JSON
 * complejo que arma el consumidor (front); aquí se reenvía tal cual.
 */
import { comfamaSapConfig, comfamaSapTokenizerConfig } from "./config";
import { getAccessToken } from "./comfama";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface SapResult {
  status: number;
  ok: boolean;
  data: unknown;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Busca (recursivamente) el número de documento SAP en la respuesta.
 * Como el shape exacto no está fijado, prueba claves comunes: numero_documento,
 * num_documento, num_doc, belnr, documento, doc_number, etc. Ajusta la lista
 * cuando conozcas el nombre real del campo.
 */
const DOC_NUMBER_KEYS = [
  /^numero_documento$/i,
  /^num_documento$/i,
  /^num_doc$/i,
  /^numero_doc$/i,
  /^n_documento$/i,
  /^belnr$/i,
  /^doc_?number$/i,
  /^documento$/i,
  /num.*doc/i,
  /doc.*num/i,
];

export function extractNumeroDocumento(data: unknown): string | null {
  const visit = (node: unknown): string | null => {
    if (node === null || node === undefined) return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        if (
          DOC_NUMBER_KEYS.some((re) => re.test(key)) &&
          value !== null &&
          value !== undefined &&
          String(value).trim() !== "" &&
          typeof value !== "object"
        ) {
          return String(value).trim();
        }
      }
      // no encontrado en este nivel: baja recursivo
      for (const value of Object.values(obj)) {
        const found = visit(value);
        if (found) return found;
      }
    }
    return null;
  };
  return visit(data);
}

/** Contabiliza (POST). `payload` es el documento SAP completo (pass-through). */
export async function postContabilizacion(payload: unknown): Promise<SapResult> {
  const cfg = comfamaSapConfig();

  const doRequest = (bearer: string) =>
    fetch(cfg.sapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: cfg.sapApiKey,
        id_fuente: cfg.idFuente,
        Authorization: `Bearer ${bearer}`,
        "User-Agent": BROWSER_UA,
      },
      body: JSON.stringify(payload),
    });

  const tokenizer = comfamaSapTokenizerConfig();
  let res = await doRequest(await getAccessToken(false, tokenizer));
  if (res.status === 401 || res.status === 403) {
    res = await doRequest(await getAccessToken(true, tokenizer));
  }

  return { status: res.status, ok: res.ok, data: await parseBody(res) };
}

/** Consulta el estado de una contabilización por su número de documento externo. */
export async function getContabilizacion(numDocExterno: string): Promise<SapResult> {
  const cfg = comfamaSapConfig();
  const url = `${cfg.sapUrl}?NUM_DOC_EXTERNO=${encodeURIComponent(numDocExterno)}`;

  const doRequest = (bearer: string) =>
    fetch(url, {
      headers: {
        Accept: "application/json",
        apikey: cfg.sapApiKey,
        id_fuente: cfg.idFuente,
        Authorization: `Bearer ${bearer}`,
        "User-Agent": BROWSER_UA,
      },
    });

  const tokenizer = comfamaSapTokenizerConfig();
  let res = await doRequest(await getAccessToken(false, tokenizer));
  if (res.status === 401 || res.status === 403) {
    res = await doRequest(await getAccessToken(true, tokenizer));
  }

  return { status: res.status, ok: res.ok, data: await parseBody(res) };
}
