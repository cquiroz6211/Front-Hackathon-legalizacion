/**
 * API pública de la feature `legalizacion` (HU-0006 + HU-0007 + HU-0010).
 * Solo lo exportado aquí puede ser consumido por el router u otras features.
 */

export { MePage } from "./MePage";
export { UploadPage } from "./UploadPage";
export { ReviewPage } from "./ReviewPage";
export { HistorialPage } from "./HistorialPage";

export {
  addDocument,
  addExpenseToLegalization,
  currentMonthLabel,
  deleteDocument,
  duplicateKey,
  filterLegalizationsByDateRange,
  findLegalizationContainingDoc,
  getActiveLegalization,
  getBlockingDuplicates,
  getDocument,
  getLegalization,
  getLegalizationAnticipo,
  getLegalizationConsumoDate,
  getLegalizationDiferencia,
  getLegalizationRegistroDate,
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
  DocumentPurpose,
  DocumentStatus,
  DuplicateReason,
  ExtractedFields,
  Legalization,
  LegalizationStatus,
  Role,
} from "./types/document";
export type { PropinaValidation, DateRangeFilter, LegalizationDateFilters } from "./lib/store";
