/**
 * Configuración central del backend.
 *
 * Todas las credenciales se leen de variables de entorno (nunca del cliente).
 * Estos módulos SOLO deben importarse desde Route Handlers (`app/api/**`) u
 * otro código de servidor: nunca desde componentes `'use client'`.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Falta la variable de entorno "${name}". Agrégala a tu .env.local (revisa el README).`,
    );
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

/** Azure Document Intelligence (prebuilt-layout, OCR asíncrono). */
export function diConfig() {
  return {
    // p.ej. https://di-hackathon2026.cognitiveservices.azure.com
    endpoint: required("AZURE_DI_ENDPOINT").replace(/\/+$/, ""),
    key: required("AZURE_DI_KEY"),
    apiVersion: optional("AZURE_DI_API_VERSION", "2024-11-30"),
    model: optional("AZURE_DI_MODEL", "prebuilt-layout"),
  };
}

/** Azure OpenAI (Chat Completions con deployment/engine). */
export function openAiConfig() {
  return {
    // api_base -> p.ej. https://mi-recurso.openai.azure.com
    endpoint: required("AZURE_OPENAI_ENDPOINT").replace(/\/+$/, ""),
    key: required("AZURE_OPENAI_KEY"),
    apiVersion: optional("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
    // engine -> nombre del deployment (p.ej. gpt-4o)
    deployment: required("AZURE_OPENAI_DEPLOYMENT"),
    maxTokens: Number(optional("AZURE_OPENAI_MAX_TOKENS", "1500")),
    temperature: Number(optional("AZURE_OPENAI_TEMPERATURE", "0")),
  };
}

/**
 * Comfama tokenizer: emite el JWT (Bearer) que usan CECOs y SAP.
 * Config separada por servicio para no acoplar credenciales entre ellos.
 */
export function comfamaTokenizerConfig() {
  return {
    tokenizerUrl: optional(
      "COMFAMA_TOKENIZER_URL",
      "https://integracionesqa.comfama.com/tokenizer/accessToken",
    ),
    tokenizerApiKey: required("COMFAMA_TOKENIZER_APIKEY"),
    origin: optional("COMFAMA_ORIGIN", "https://qa.comfama.com"),
  };
}

/**
 * Tokenizer para SAP, independiente del de CECOs para permitir entornos
 * distintos (p.ej. CECOs en PROD y SAP en QA). Sin variables COMFAMA_SAP_*
 * definidas, usa los valores de QA por defecto.
 */
export function comfamaSapTokenizerConfig() {
  return {
    tokenizerUrl: optional(
      "COMFAMA_SAP_TOKENIZER_URL",
      "https://integracionesqa.comfama.com/tokenizer/accessToken",
    ),
    tokenizerApiKey: required("COMFAMA_SAP_TOKENIZER_APIKEY"),
    origin: optional("COMFAMA_SAP_ORIGIN", "https://qa.comfama.com"),
  };
}

/** Comfama CECOs (Centros de Costos): endpoint OData. */
export function comfamaCecosConfig() {
  return {
    cecosUrl: optional(
      "COMFAMA_CECOS_URL",
      "https://integraciones.comfama.com/tran/TRA-TRA-CentrosCostos/get_cecos_textSet",
    ),
    cecosApiKey: required("COMFAMA_CECOS_APIKEY"),
  };
}

/** Comfama SAP (Contabilización de legados FI). */
export function comfamaSapConfig() {
  return {
    sapUrl: optional(
      "COMFAMA_SAP_URL",
      "https://integracionesqa.comfama.com/tran/TRA-FIN-ContabilizacionLegados/FI/Contabilizacion",
    ),
    sapApiKey: required("COMFAMA_SAP_APIKEY"),
    idFuente: optional("COMFAMA_ID_FUENTE", "POWER_CM"),
  };
}

/** DocuWare Platform REST API (archivado documental). */
export function docuwareConfig() {
  return {
    // p.ej. https://mi-host/DocuWare/Platform
    baseUrl: required("DOCUWARE_BASE_URL").replace(/\/+$/, ""),
    user: required("DOCUWARE_USER"),
    password: required("DOCUWARE_PASSWORD"),
    // GUID del archivador destino
    fileCabinetId: required("DOCUWARE_FILE_CABINET_ID"),
    organization: optional("DOCUWARE_ORGANIZATION", ""),
  };
}
