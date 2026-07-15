/**
 * API pública de la feature `legalizacion` (HU-0006 + HU-0007).
 * Solo lo exportado aquí puede ser consumido por el router u otras features.
 */

export { MePage } from "./MePage";
export { UploadPage } from "./UploadPage";
export { ReviewPage } from "./ReviewPage";

export {
  addDocument,
  addExpenseToLegalization,
  currentMonthLabel,
  deleteDocument,
  duplicateKey,
  findLegalizationContainingDoc,
  getActiveLegalization,
  getBlockingDuplicates,
  getDocument,
  getLegalization,
  getLegalizationTotal,
  getOrCreateDraftLegalization,
  getRole,
  listDocuments,
  listLegalizations,
  parseAmount,
  PROPINA_MAX_RATE,
  propinaCap,
  recomputeAllDuplicates,
  setDocumentCeco,
  setRole,
  submitLegalization,
  subscribe,
  updateDocument,
  validatePropina,
} from "./lib/store";

export type {
  DocumentRecord,
  DocumentStatus,
  DuplicateReason,
  ExtractedFields,
  Legalization,
  LegalizationStatus,
  Role,
} from "./types/document";
export type { PropinaValidation } from "./lib/store";