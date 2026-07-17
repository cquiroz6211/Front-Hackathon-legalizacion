/**
 * Cliente HTTP del backend de legalización (`apps/api`).
 *
 * La base sale de `VITE_API_URL` (ver `@/config/env`), que por convención YA
 * incluye el prefijo `/api` (p. ej. `http://localhost:3001/api`). Aquí solo se
 * concatenan las rutas de cada recurso.
 *
 * El backend devuelve los campos con el shape `BackendExtractedFields`; usa
 * `toExtractedFields()` para mapearlos al modelo del frontend (`ExtractedFields`).
 */
import { env } from "@/config/env";
import type { ExtractedFields } from "../types/document";

/** Construye la URL completa. `VITE_API_URL` ya trae el prefijo `/api`. */
function apiUrl(path: string): string {
  const base = env.apiUrl.replace(/\/+$/, "");
  return `${base}${path}`;
}

/** Convierte un File a base64 crudo (sin el prefijo data URL). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(",");
      resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/** Shape de campos que devuelve el backend (extracción Azure OpenAI). */
export interface BackendExtractedFields {
  fecha: string;
  nroFactura: string;
  cliente: string;
  nitCliente: string;
  proveedor: string;
  nit: string;
  direccion: string;
  telefono: string;
  departamento: string;
  municipio: string;
  iva19Base: string;
  iva19Valor: string;
  iva5Base: string;
  iva5Valor: string;
  iva0Base: string;
  iva0Valor: string;
  totalFactura: string;
}

/**
 * Mapea la respuesta cruda del backend al `ExtractedFields` del frontend.
 * Los campos que el backend no produce (kilometraje, propina) quedan vacíos y
 * `cuit` se completa con el NIT del cliente; ajústalo según la fuente real.
 */
export function toExtractedFields(b: Partial<BackendExtractedFields>): ExtractedFields {
  return {
    fecha: b.fecha ?? "",
    nroFactura: b.nroFactura ?? "",
    proveedor: b.proveedor ?? "",
    cliente: b.cliente ?? "",
    cuit: b.nitCliente ?? "",
    nit: b.nit ?? "",
    direccion: b.direccion ?? "",
    telefono: b.telefono ?? "",
    departamento: b.departamento ?? "",
    municipio: b.municipio ?? "",
    monto: b.totalFactura ?? "",
    kilometraje: "",
    iva19Base: b.iva19Base ?? "",
    iva19Valor: b.iva19Valor ?? "",
    iva5Base: b.iva5Base ?? "",
    iva5Valor: b.iva5Valor ?? "",
    iva0Base: b.iva0Base ?? "",
    iva0Valor: b.iva0Valor ?? "",
    totalFactura: b.totalFactura ?? "",
    propina: "",
  };
}

/**
 * Mapea el `ExtractedFields` del frontend al shape `BackendExtractedFields` que
 * espera el backend (p.ej. para archivar en DocuWare). Es el inverso de
 * `toExtractedFields`: `cuit` (frontend) vuelve a `nitCliente` (backend).
 */
export function toBackendExtractedFields(f: Partial<ExtractedFields>): BackendExtractedFields {
  return {
    fecha: f.fecha ?? "",
    nroFactura: f.nroFactura ?? "",
    cliente: f.cliente ?? "",
    nitCliente: f.cuit ?? "",
    proveedor: f.proveedor ?? "",
    nit: f.nit ?? "",
    direccion: f.direccion ?? "",
    telefono: f.telefono ?? "",
    departamento: f.departamento ?? "",
    municipio: f.municipio ?? "",
    iva19Base: f.iva19Base ?? "",
    iva19Valor: f.iva19Valor ?? "",
    iva5Base: f.iva5Base ?? "",
    iva5Valor: f.iva5Valor ?? "",
    iva0Base: f.iva0Base ?? "",
    iva0Valor: f.iva0Valor ?? "",
    totalFactura: f.totalFactura ?? "",
  };
}

export interface HealthResponse {
  ok: boolean;
  services?: Record<string, boolean>;
  error?: string;
}

/** GET /health — reporta qué integraciones tienen credenciales configuradas. */
export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(apiUrl("/health"));
  return (await res.json()) as HealthResponse;
}

export interface QualityCheck {
  legible: boolean;
  calidad: "buena" | "regular" | "mala";
  confianza: number;
  problemas: string[];
  recomendacion: string;
}

export interface ValidateResponse {
  ok: boolean;
  quality?: QualityCheck;
  convertedFromPdf?: boolean;
  error?: string;
}

/** POST /validate — Prompt 1: legibilidad de la imagen (previo al OCR). */
export async function validateDocument(file: File): Promise<ValidateResponse> {
  const fileBase64 = await fileToBase64(file);
  const res = await fetch(apiUrl("/validate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, fileType: file.type || "image/jpeg" }),
  });
  return (await res.json()) as ValidateResponse;
}

export interface DiTable {
  rowCount: number;
  columnCount: number;
  cells: { rowIndex: number; columnIndex: number; content: string }[];
}

export interface OcrResponse {
  ok: boolean;
  ocr?: { content: string; tables: DiTable[] };
  error?: string;
}

/** POST /ocr — solo Document Intelligence (texto + tablas). */
export async function ocrDocument(file: File): Promise<OcrResponse> {
  const fileBase64 = await fileToBase64(file);
  const res = await fetch(apiUrl("/ocr"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
    }),
  });
  return (await res.json()) as OcrResponse;
}

export interface ExtractResponse {
  ok: boolean;
  fields?: BackendExtractedFields;
  error?: string;
}

/** POST /extract — Prompt 2: extrae campos desde texto OCR. */
export async function extractFromText(ocrText: string): Promise<ExtractResponse> {
  const res = await fetch(apiUrl("/extract"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ocrText }),
  });
  return (await res.json()) as ExtractResponse;
}

export interface ProcessResponse {
  ok: boolean;
  fields?: BackendExtractedFields;
  ocr?: { content: string };
  error?: string;
}

/** POST /process — OCR + extracción con IA en un solo paso. */
export async function processDocument(file: File): Promise<ProcessResponse> {
  const fileBase64 = await fileToBase64(file);
  const res = await fetch(apiUrl("/process"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
    }),
  });
  return (await res.json()) as ProcessResponse;
}

export interface CecosResponse {
  ok: boolean;
  count?: number;
  cecos?: Record<string, unknown>[];
  error?: string;
}

/** GET /cecos — lista de Centros de Costo (Comfama). dateto opcional (YYYYMMDD). */
export async function getCecos(dateto?: string): Promise<CecosResponse> {
  const qs = dateto ? `?dateto=${encodeURIComponent(dateto)}` : "";
  const res = await fetch(apiUrl(`/cecos${qs}`));
  return (await res.json()) as CecosResponse;
}

export interface SapResponse {
  ok: boolean;
  sapStatus?: number;
  numeroDocumento?: string | null;
  /** Estado del intento más reciente en SAP (p.ej. "OK", "EI"). Solo en GET. */
  sapEstado?: string | null;
  /** Mensajes de error (tipo "E") del intento más reciente en SAP. Solo en GET. */
  sapErrores?: string[];
  data?: unknown;
  error?: string;
}

/** POST /contabilizacion — crea la contabilización en SAP (payload pass-through). */
export async function postContabilizacion(payload: unknown): Promise<SapResponse> {
  const res = await fetch(apiUrl("/contabilizacion"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as SapResponse;
}

/** GET /contabilizacion — consulta una contabilización por documento externo. */
export async function getContabilizacion(numDocExterno: string): Promise<SapResponse> {
  const res = await fetch(
    apiUrl(`/contabilizacion?numDocExterno=${encodeURIComponent(numDocExterno)}`),
  );
  return (await res.json()) as SapResponse;
}

export interface ArchiveResponse {
  ok: boolean;
  status?: number;
  documentId?: string | null;
  /** URL para abrir el documento en DocuWare Web Client. */
  documentUrl?: string | null;
  data?: unknown;
  error?: string;
}

export interface ArchiveOptions {
  /** CECO elegido en el front (rellena CODIGO_SAP en el archivador). */
  ceco?: string;
  /** Número de documento de SAP (rellena NUMERO_DE_DOCUMENTO_CONTABLE + IDDOCUMENTO_SAP). */
  numeroDocumentoSap?: string | null;
}

export interface ArchiveByBase64Input {
  fileBase64: string;
  fileName: string;
  fileType: string;
  fields: BackendExtractedFields;
  ceco?: string;
  numeroDocumentoSap?: string | null;
}

/**
 * POST /archive con el base64 ya disponible (sin necesidad del objeto `File`).
 * Lo usa el Gestor SAP al aprobar: el binario se lee del store persistido, no
 * de un input de archivo. `archiveDocument(file, ...)` es un envoltorio de esta.
 */
export async function archiveDocumentByBase64(
  input: ArchiveByBase64Input,
): Promise<ArchiveResponse> {
  const res = await fetch(apiUrl("/archive"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64: input.fileBase64,
      fileName: input.fileName,
      fileType: input.fileType || "application/octet-stream",
      fields: input.fields,
      ceco: input.ceco,
      numeroDocumentoSap: input.numeroDocumentoSap,
    }),
  });
  return (await res.json()) as ArchiveResponse;
}

/** POST /archive — guarda el documento y sus datos en DocuWare (vía gateway Comfama). */
export async function archiveDocument(
  file: File,
  fields: BackendExtractedFields,
  options?: ArchiveOptions,
): Promise<ArchiveResponse> {
  const fileBase64 = await fileToBase64(file);
  return archiveDocumentByBase64({
    fileBase64,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fields,
    ceco: options?.ceco,
    numeroDocumentoSap: options?.numeroDocumentoSap,
  });
}
