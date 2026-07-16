/**
 * Cliente de DocuWare Platform REST API.
 *
 * Flujo:
 *   1. POST /Account/Logon  (form-urlencoded)  -> cookie de sesión
 *   2. POST /FileCabinets/{id}/Documents (multipart) -> archiva el binario + índices
 *
 * NOTA: los nombres de los campos de índice (FieldName) deben coincidir
 * EXACTAMENTE con los definidos en tu archivador de DocuWare. Ajusta el
 * mapa `INDEX_FIELD_MAP` a tu configuración real.
 */
import { docuwareConfig } from "./config";
import type { ExtractedFields } from "../types";

/**
 * Mapa: clave de ExtractedFields -> FieldName del archivador DocuWare.
 * Renombra los valores de la derecha para que coincidan con tu file cabinet.
 */
const INDEX_FIELD_MAP: Partial<Record<keyof ExtractedFields, string>> = {
  fecha: "FECHA_EMISION",
  nroFactura: "NUMERO_FACTURA",
  proveedor: "PROVEEDOR",
  nit: "NIT",
  totalFactura: "TOTAL_FACTURA",
};

interface DocuwareField {
  FieldName: string;
  Item: string;
  ItemElementName: "String";
}

export interface ArchiveInput {
  fileName: string;
  fileType: string;
  /** Base64 (crudo o data URL). */
  fileBase64: string;
  fields: ExtractedFields;
  /** Campos de índice extra (p.ej. CECO). FieldName -> valor. */
  extraIndex?: Record<string, string>;
}

export interface ArchiveResult {
  documentId: number | string;
  fileCabinetId: string;
}

function normalizeBase64(input: string): string {
  const commaIdx = input.indexOf(",");
  if (input.startsWith("data:") && commaIdx !== -1) return input.slice(commaIdx + 1);
  return input;
}

function extractCookies(res: Response): string {
  // undici expone getSetCookie(); fallback al header plano.
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const list =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie") as string]
        : [];
  // Nos quedamos con "name=value" de cada cookie.
  return list.map((c) => c.split(";")[0]).join("; ");
}

/** 1) Autenticación -> devuelve la cookie de sesión. */
async function logon(): Promise<string> {
  const cfg = docuwareConfig();
  const body = new URLSearchParams({
    UserName: cfg.user,
    Password: cfg.password,
    RememberMe: "false",
    RedirectToMyselfInCaseOfError: "false",
  });
  if (cfg.organization) body.set("Organization", cfg.organization);

  const res = await fetch(`${cfg.baseUrl}/Account/Logon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    redirect: "manual",
  });

  if (!res.ok && res.status !== 302) {
    const detail = await res.text().catch(() => "");
    throw new Error(`DocuWare: fallo de autenticación (${res.status}). ${detail}`);
  }

  const cookies = extractCookies(res);
  if (!cookies) {
    throw new Error("DocuWare: el logon no devolvió cookie de sesión.");
  }
  return cookies;
}

/** Construye la lista de campos de índice a partir de los datos extraídos. */
function buildIndexFields(
  fields: ExtractedFields,
  extraIndex?: Record<string, string>,
): DocuwareField[] {
  const result: DocuwareField[] = [];

  (Object.keys(INDEX_FIELD_MAP) as (keyof ExtractedFields)[]).forEach((key) => {
    const fieldName = INDEX_FIELD_MAP[key];
    const value = fields[key];
    if (fieldName && value) {
      result.push({ FieldName: fieldName, Item: value, ItemElementName: "String" });
    }
  });

  if (extraIndex) {
    Object.entries(extraIndex).forEach(([fieldName, value]) => {
      if (value) result.push({ FieldName: fieldName, Item: value, ItemElementName: "String" });
    });
  }

  return result;
}

/** 2) Archiva el documento con sus índices en el file cabinet. */
export async function archiveDocument(input: ArchiveInput): Promise<ArchiveResult> {
  const cfg = docuwareConfig();
  const cookie = await logon();

  const indexFields = buildIndexFields(input.fields, input.extraIndex);
  const documentJson = JSON.stringify({ Fields: indexFields });

  const bytes = Buffer.from(normalizeBase64(input.fileBase64), "base64");

  // Multipart: parte "document" (índices JSON) + el binario.
  const form = new FormData();
  form.append("document", new Blob([documentJson], { type: "application/json" }), "index.json");
  form.append(
    "file",
    new Blob([bytes], { type: input.fileType || "application/octet-stream" }),
    input.fileName,
  );

  const url = `${cfg.baseUrl}/FileCabinets/${cfg.fileCabinetId}/Documents`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Accept: "application/json",
      // El boundary de multipart lo fija fetch automáticamente con FormData.
    },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`DocuWare: fallo al archivar (${res.status}). ${detail}`);
  }

  const stored = (await res.json().catch(() => ({}))) as { Id?: number | string };
  return {
    documentId: stored.Id ?? "desconocido",
    fileCabinetId: cfg.fileCabinetId,
  };
}
