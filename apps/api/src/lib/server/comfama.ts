/**
 * Cliente de la API de Comfama.
 *
 * Flujo:
 *   1. POST /tokenizer/accessToken  { "action": "getJWT" }  -> JWT
 *   2. GET  .../get_cecos_textSet?$filter=dateto eq 'YYYYMMDD'&$format=json
 *      con headers `Authorization: Bearer <jwt>` + `apiKey`.
 *
 * El JWT se cachea en memoria hasta poco antes de expirar (leído de su `exp`),
 * para no pedir token en cada llamada.
 */
import { comfamaTokenizerConfig, comfamaCecosConfig } from "./config";

export interface TokenizerConfig {
  tokenizerUrl: string;
  tokenizerApiKey: string;
  origin: string;
}

interface TokenCache {
  token: string;
  expiresAtMs: number;
}

// Una caché de token por tokenizer (clave = url+apikey), para que CECOs (PROD) y
// SAP (QA) usen tokens distintos sin pisarse mutuamente.
const tokenCaches = new Map<string, TokenCache>();

/** Decodifica el payload de un JWT para leer `exp` (segundos epoch). */
function jwtExpiryMs(jwt: string): number | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Extrae el token de la respuesta del tokenizer, tolerando varios shapes. */
function pickToken(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const direct =
      obj.access_token ?? obj.accessToken ?? obj.token ?? obj.jwt ?? obj.JWT ?? obj.id_token;
    if (typeof direct === "string") return direct;
    // El tokenizer de Comfama anida el token bajo `data`:
    //   { "data": { "id_token": "eyJ...", "statusReason": "OK", ... } }
    if (obj.data && typeof obj.data === "object") {
      const inner = obj.data as Record<string, unknown>;
      const nested =
        inner.access_token ??
        inner.accessToken ??
        inner.token ??
        inner.jwt ??
        inner.JWT ??
        inner.id_token;
      if (typeof nested === "string") return nested;
    }
  }
  return null;
}

/**
 * Obtiene un JWT válido (usa caché por tokenizer si aún no expira).
 * @param config tokenizer a usar; por defecto el de CECOs (`comfamaTokenizerConfig`).
 */
export async function getAccessToken(force = false, config?: TokenizerConfig): Promise<string> {
  const cfg = config ?? comfamaTokenizerConfig();
  const cacheKey = `${cfg.tokenizerUrl}::${cfg.tokenizerApiKey}`;
  const now = Date.now();
  const cached = tokenCaches.get(cacheKey);
  if (!force && cached && cached.expiresAtMs > now + 60_000) {
    return cached.token;
  }

  const res = await fetch(cfg.tokenizerUrl, {
    method: "POST",
    headers: {
      apikey: cfg.tokenizerApiKey,
      Origin: cfg.origin,
      Referer: `${cfg.origin}/`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ action: "getJWT" }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Comfama tokenizer: error ${res.status}. ${detail}`);
  }

  const raw = await res.text();
  let token: string | null;
  try {
    token = pickToken(JSON.parse(raw));
  } catch {
    // respuesta no-JSON: puede ser el token en texto plano
    token = raw.trim() || null;
  }
  if (!token) {
    throw new Error(
      `Comfama tokenizer: no se encontró el JWT en la respuesta. ${raw.slice(0, 300)}`,
    );
  }

  const exp = jwtExpiryMs(token);
  tokenCaches.set(cacheKey, {
    token,
    // si no hay exp legible, cachea 5 minutos por defecto
    expiresAtMs: exp ?? now + 5 * 60_000,
  });
  return token;
}

export interface Ceco {
  [key: string]: unknown;
}

/** Normaliza la respuesta OData a un array de registros. */
function extractRecords(data: unknown): Ceco[] {
  if (Array.isArray(data)) return data as Ceco[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    // OData v2 (SAP Gateway): { d: { results: [...] } } o { d: [...] }
    const d = obj.d as Record<string, unknown> | unknown[] | undefined;
    if (Array.isArray(d)) return d as Ceco[];
    if (d && typeof d === "object" && Array.isArray((d as Record<string, unknown>).results)) {
      return (d as Record<string, unknown>).results as Ceco[];
    }
    // OData v4: { value: [...] }
    if (Array.isArray(obj.value)) return obj.value as Ceco[];
  }
  return [];
}

/** Fecha YYYYMMDD (por defecto la de hoy) para el filtro `dateto`. */
function toYyyyMmDd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Lista los CECOs vigentes a la fecha `dateto` (formato YYYYMMDD).
 * Si no se pasa, usa la fecha actual.
 */
export async function getCecos(dateto?: string): Promise<{ cecos: Ceco[]; raw: unknown }> {
  const cfg = comfamaCecosConfig();
  const token = await getAccessToken();
  const fecha = dateto && /^\d{8}$/.test(dateto) ? dateto : toYyyyMmDd(new Date());

  // $filter=dateto eq 'YYYYMMDD' & $format=json (codificados).
  const url =
    `${cfg.cecosUrl}?$filter=${encodeURIComponent(`dateto eq '${fecha}'`)}` + `&$format=json`;

  const doRequest = (bearer: string) =>
    fetch(url, {
      headers: {
        apiKey: cfg.cecosApiKey,
        Authorization: `Bearer ${bearer}`,
        Accept: "application/json",
      },
    });

  let res = await doRequest(token);

  // Si el token expiró/invalidó, reintenta una vez con token fresco.
  if (res.status === 401 || res.status === 403) {
    const fresh = await getAccessToken(true);
    res = await doRequest(fresh);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Comfama CECOs: error ${res.status}. ${detail}`);
  }

  const data = (await res.json()) as unknown;
  return { cecos: extractRecords(data), raw: data };
}
