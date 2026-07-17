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
 * Shape real observado de `GET /FI/Contabilizacion?NUM_DOC_EXTERNO=...`:
 *
 *   { documentos: [
 *       { req_id, num_doc_ext, status: "OK"|"EI"|..., num_doc?, fecha_creacion, mensajes?: [{tipo:"E"|"W", texto}] },
 *       ... // intentos anteriores, MÁS RECIENTE PRIMERO
 *   ]}
 *
 * Cada `num_doc_externo` puede tener varios intentos (reprocesos); solo el/los
 * que tengan `status: "OK"` traen `num_doc` (el número de documento SAP real).
 * El `POST` de creación es un shape DISTINTO (`{ req_id, mensajes }`, sin
 * `documentos`) — normalmente no trae número de documento todavía.
 */
interface SapConsultaIntento {
  req_id?: string;
  num_doc_ext?: string;
  status?: string;
  num_doc?: string;
  fecha_creacion?: number;
  mensajes?: { tipo?: string; texto?: string }[];
}

/** Claves que SÍ identifican el número de documento SAP (exactas, sin "ext"). */
const DOC_NUMBER_KEYS = [
  /^num_doc$/i,
  /^numero_documento$/i,
  /^num_documento$/i,
  /^numero_doc$/i,
  /^n_documento$/i,
  /^belnr$/i,
  /^doc_?number$/i,
  /^documento$/i,
];

/**
 * Búsqueda recursiva genérica (fallback para shapes no documentados). Excluye
 * cualquier clave que contenga "ext" (p.ej. `num_doc_ext`, `numDocExterno`)
 * para no confundir la referencia externa que NOSOTROS enviamos con el número
 * de documento que asigna SAP.
 */
function genericSearch(data: unknown): string | null {
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
          !/ext/i.test(key) &&
          DOC_NUMBER_KEYS.some((re) => re.test(key)) &&
          value !== null &&
          value !== undefined &&
          String(value).trim() !== "" &&
          typeof value !== "object"
        ) {
          return String(value).trim();
        }
      }
      for (const value of Object.values(obj)) {
        const found = visit(value);
        if (found) return found;
      }
    }
    return null;
  };
  return visit(data);
}

export interface SapConsultaResumen {
  numeroDocumento: string | null;
  /** `status` del intento más reciente ("OK", "EI", ...), o null si no hay historial. */
  status: string | null;
  /** Mensajes de error (`tipo: "E"`) del intento más reciente. */
  errorMessages: string[];
}

/**
 * Interpreta la respuesta de SAP, ya sea la del `GET` (`{documentos: [...]}`,
 * histórico de intentos) o la del `POST` (`{req_id, mensajes}`, plana, sin
 * número de documento todavía). Extrae número de documento + errores en
 * cualquiera de los dos shapes.
 */
export function interpretSapConsulta(data: unknown): SapConsultaResumen {
  const documentos = (data as { documentos?: unknown })?.documentos;
  if (Array.isArray(documentos) && documentos.length > 0) {
    const intentos = documentos as SapConsultaIntento[];
    const latest = intentos[0];
    const ok = intentos.find((d) => d.status === "OK" && d.num_doc);
    const errorMessages = (latest.mensajes ?? [])
      .filter((m) => m.tipo === "E" && m.texto)
      .map((m) => m.texto as string);
    return {
      numeroDocumento: ok?.num_doc ?? null,
      status: latest.status ?? null,
      errorMessages,
    };
  }

  // Shape del POST: mensajes al nivel raíz, sin `documentos`.
  const mensajesRaiz = (data as { mensajes?: { tipo?: string; texto?: string }[] })?.mensajes;
  const errorMessages = Array.isArray(mensajesRaiz)
    ? mensajesRaiz.filter((m) => m.tipo === "E" && m.texto).map((m) => m.texto as string)
    : [];
  return { numeroDocumento: genericSearch(data), status: null, errorMessages };
}

/** Contabiliza (POST). `payload` es el documento SAP completo (pass-through). */
export async function postContabilizacion(payload: unknown): Promise<SapResult> {
  const cfg = comfamaSapConfig();
  console.log("[postContabilizacion] Payload enviado a SAP:\n", JSON.stringify(payload, null, 2));

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

  const result: SapResult = { status: res.status, ok: res.ok, data: await parseBody(res) };
  console.log(
    `[postContabilizacion] Respuesta de SAP (status ${result.status}):\n`,
    JSON.stringify(result.data, null, 2),
  );
  return result;
}

/** Consulta el estado de una contabilización por su número de documento externo. */
export async function getContabilizacion(numDocExterno: string): Promise<SapResult> {
  const cfg = comfamaSapConfig();
  console.log(`[getContabilizacion] Consultando num_doc_externo="${numDocExterno}"`);
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

  const result: SapResult = { status: res.status, ok: res.ok, data: await parseBody(res) };
  console.log(
    `[getContabilizacion] Respuesta de SAP (status ${result.status}):\n`,
    JSON.stringify(result.data, null, 2),
  );
  return result;
}
