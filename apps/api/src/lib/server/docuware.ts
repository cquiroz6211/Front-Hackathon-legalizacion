/**
 * Archivado documental (DocuWare vía el gateway de integraciones Comfama).
 *
 * No es el DocuWare Platform REST API directo: es un endpoint propio de
 * Comfama (mismo patrón que CECOs/SAP) que internamente guarda en DocuWare.
 *
 *   POST /tran/TRA-SC-GestionDocumentos/api/documento/almacenardocumentobytearray
 *   multipart/form-data:
 *     idArchivador             -> GUID del archivador (COMFAMA_DOCUWARE_ARCHIVADOR_ID)
 *     jsonCamposDelArchivador  -> JSON.stringify([{ campo, valor, tipoCampo }, ...])
 *     documento                -> el archivo en BASE64 (texto, no un Blob binario)
 *   headers: Apikey + Authorization: Bearer <JWT del tokenizer QA de SAP>
 */
import { comfamaDocuwareConfig, comfamaSapTokenizerConfig } from "./config";
import { getAccessToken } from "./comfama";
import type { ExtractedFields } from "../types";

interface CampoArchivador {
  campo: string;
  valor: string;
  tipoCampo: number;
}

export interface ArchiveInput {
  fileName: string;
  fileType: string;
  /** Base64 (crudo o data URL). */
  fileBase64: string;
  fields: ExtractedFields;
  /** CECO elegido en el front (rellena CODIGO_SAP). */
  ceco?: string;
  /** Número de documento de SAP (rellena NUMERO_DE_DOCUMENTO_CONTABLE + IDDOCUMENTO_SAP). */
  numeroDocumentoSap?: string | null;
}

export interface ArchiveResult {
  status: number;
  ok: boolean;
  /** Id del documento archivado, si se pudo identificar en la respuesta. */
  documentId: string | null;
  data: unknown;
}

function normalizeBase64(input: string): string {
  const commaIdx = input.indexOf(",");
  if (input.startsWith("data:") && commaIdx !== -1) return input.slice(commaIdx + 1);
  return input;
}

/** `YYYY-MM-DD HH:mm:ss` en hora local, formato que espera FECHA_MODIFICACION. */
function nowFormatted(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

const INT32_MAX_DIGITS = 9; // 999.999.999 < 2.147.483.647 (Int32 max): siempre cabe.

/**
 * Recorta un número de documento SAP para que quepa en un campo Int32 del
 * archivador DocuWare (ver ADR 0002: `NUMERO_DE_DOCUMENTO_CONTABLE` está
 * tipado Int32 y los números reales de SAP, ~6 mil millones, lo exceden).
 * Se conservan los últimos 9 dígitos (siempre < Int32 max). Es una decisión
 * explícita de negocio para no bloquear el archivado mientras Comfama ajusta
 * el tipo de campo; no se usa en IDDOCUMENTO_SAP (texto, sin este límite).
 */
function truncateForInt32Field(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return value;
  return digits.length <= INT32_MAX_DIGITS ? digits : digits.slice(-INT32_MAX_DIGITS);
}

const DIGIT_CHARS = "0123456789";
const UPPER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER_CHARS = "abcdefghijklmnopqrstuvwxyz";

function randomFrom(chars: string, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Placeholders para campos que el archivador puede exigir como obligatorios
 * pero para los que la app no tiene una fuente de datos real (decisión de
 * negocio: mejor un valor aleatorio no vacío que arriesgar un rechazo por
 * campo requerido faltante). Formato calcado del curl de referencia que sí
 * funciona contra el archivador (ver ADR 0002).
 */
function randomPlaceholders() {
  const today = nowFormatted().slice(0, 10).replace(/-/g, "");
  return {
    libroDeCaja: randomFrom(DIGIT_CHARS, 4),
    identificadorSap: `SAP-${today}-${randomFrom(DIGIT_CHARS, 6)}`,
    descripcionTipoDocumental: `Documento de Legalización ${randomFrom(UPPER_CHARS, 4)}`,
    usuarioSap: randomFrom(UPPER_CHARS, 8),
    codigoTipoDocumental: `FE${randomFrom(DIGIT_CHARS, 2)}`,
    digitador: randomFrom(LOWER_CHARS, 6),
    nroDocumento: randomFrom(DIGIT_CHARS, 9),
  };
}

/**
 * Construye los 16 campos del archivador. `NUMERO_DE_DOCUMENTO_CONTABLE` se
 * recorta a 9 dígitos para no romper el tipo Int32 del archivador (ver ADR
 * 0002). Los campos sin una fuente clara en la app (LIBRO_DE_CAJA,
 * CODIGO_DEL_TIPO_DOCUMENTAL, DESCRIPCION_TIPO_DOCUMENTAL, DIGITADOR,
 * USUARIO_SAP, NRODOCUMENTO, IDENTIFICADOR_SAP) se rellenan con datos
 * aleatorios (no vacíos) por si el archivador los exige como obligatorios.
 */
function buildCampos(input: ArchiveInput, byteLength: number): CampoArchivador[] {
  const numDoc = input.numeroDocumentoSap ?? "";
  const campo = (campo: string, valor: string): CampoArchivador => ({ campo, valor, tipoCampo: 0 });
  const placeholders = randomPlaceholders();

  return [
    campo("NUMERO_DE_DOCUMENTO_CONTABLE", truncateForInt32Field(numDoc)),
    campo("FECHA", input.fields.fecha ?? ""),
    campo("VALOR_DE_COMPROBANTE", input.fields.totalFactura ?? ""),
    campo("LIBRO_DE_CAJA", placeholders.libroDeCaja),
    campo("TIPO_DOCUMENTAL", "Factura"),
    campo("FECHA_MODIFICACION", nowFormatted()),
    campo("FILE_SIZE", String(byteLength)),
    campo("IDENTIFICADOR_SAP", placeholders.identificadorSap),
    campo("DESCRIPCION_TIPO_DOCUMENTAL", placeholders.descripcionTipoDocumental),
    campo("CODIGO_SAP", input.ceco ?? ""),
    campo("NOMBRE_ARCHIVO", input.fileName),
    campo("USUARIO_SAP", placeholders.usuarioSap),
    campo("IDDOCUMENTO_SAP", numDoc),
    campo("CODIGO_DEL_TIPO_DOCUMENTAL", placeholders.codigoTipoDocumental),
    campo("DIGITADOR", placeholders.digitador),
    campo("NRODOCUMENTO", placeholders.nroDocumento),
  ];
}

const ID_KEYS = [/^id$/i, /^iddocumento$/i, /id.*documento/i, /documento.*id/i, /^dwdocid$/i];

/** Busca (recursivamente) un identificador de documento en la respuesta. */
function extractDocumentId(data: unknown): string | null {
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
          ID_KEYS.some((re) => re.test(key)) &&
          value !== null &&
          value !== undefined &&
          typeof value !== "object" &&
          String(value).trim() !== ""
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

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  // El gateway devuelve el body doblemente codificado como JSON (una cadena
  // que a su vez contiene JSON, p.ej. `"{\"codigoerror\":0,...}"`). Si el
  // primer parseo dio un string, se intenta desanidar una vez más.
  if (typeof parsed === "string") {
    try {
      return JSON.parse(parsed);
    } catch {
      return parsed;
    }
  }
  return parsed;
}

/** Archiva el documento (guarda en DocuWare vía el gateway Comfama). */
export async function archiveDocument(input: ArchiveInput): Promise<ArchiveResult> {
  const cfg = comfamaDocuwareConfig();
  const tokenizer = comfamaSapTokenizerConfig();
  const bytes = Buffer.from(normalizeBase64(input.fileBase64), "base64");
  const campos = buildCampos(input, bytes.length);
  console.log(
    `[docuware] Archivando "${input.fileName}" (${bytes.length} bytes) en archivador ${cfg.archivadorId}.\n`,
    JSON.stringify(campos, null, 2),
  );

  const doRequest = (bearer: string) => {
    const form = new FormData();
    form.append("idArchivador", cfg.archivadorId);
    form.append("jsonCamposDelArchivador", JSON.stringify(campos));
    // `documento` va como TEXTO base64 plano (campo de formulario normal, sin
    // Blob ni filename): el "El documento no tiene nombre!" no era por falta
    // de filename en esta parte, sino porque falta el campo `nombreDocumento`
    // (separado), que el gateway exige explícitamente.
    form.append("documento", normalizeBase64(input.fileBase64));
    form.append("nombreDocumento", input.fileName);

    return fetch(cfg.url, {
      method: "POST",
      headers: {
        Apikey: cfg.apiKey,
        Authorization: `Bearer ${bearer}`,
        Accept: "application/json",
      },
      body: form,
    });
  };

  let res = await doRequest(await getAccessToken(false, tokenizer));
  if (res.status === 401 || res.status === 403) {
    res = await doRequest(await getAccessToken(true, tokenizer));
  }

  const data = await parseBody(res);
  console.log(
    `[docuware] Respuesta (status ${res.status}):\n`,
    JSON.stringify(data, null, 2).slice(0, 1000),
  );
  if (!res.ok) {
    throw new Error(
      `DocuWare (Comfama): error ${res.status}. ${JSON.stringify(data).slice(0, 500)}`,
    );
  }

  return { status: res.status, ok: res.ok, documentId: extractDocumentId(data), data };
}
