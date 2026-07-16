/**
 * API pública de la feature `legalizacion` (HU-0006 + HU-0007 + HU-0008 +
 * HU-0009 + HU-0010 + HU-0011). Solo lo exportado aquí puede ser consumido por
 * el router u otras features.
 */

export { MePage } from "./MePage";
export { UploadPage } from "./UploadPage";
export { ReviewPage } from "./ReviewPage";
export { HistorialPage } from "./HistorialPage";

export {
  addDocument,
  addExpenseToLegalization,
  approveByLeader,
  businessDaysBetween,
  canSubmitToGestorSap,
  CONSUMPTION_LIMIT,
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
  getLegalizationExcess,
  getLegalizationRegistroDate,
  getLegalizationTimeStatus,
  getLegalizationTotal,
  getOrCreateDraftLegalization,
  getRole,
  isLeaderApproved,
  listDocuments,
  listLegalizations,
  parseAmount,
  PROPINA_MAX_RATE,
  propinaCap,
  recomputeAllDuplicates,
  requiresLeaderApproval,
  setDocumentCeco,
  setRole,
  submitLegalization,
  subscribe,
  updateDocument,
  validatePropina,
} from "./lib/store";

export type {
  AuditEvent,
  DocumentRecord,
  DocumentPurpose,
  DocumentStatus,
  DuplicateReason,
  ExtractedFields,
  Legalization,
  LegalizationStatus,
  Role,
} from "./types/document";
export type {
  DateRangeFilter,
  LeaderApprovalRequirement,
  LegalizationDateFilters,
  LegalizationExcess,
  LegalizationTimeStatus,
  PropinaValidation,
  SubmitToGestorSapResult,
} from "./lib/store";

// Cliente HTTP del backend (apps/api). Permite a las vistas consumir OCR,
// extracción IA, CECOs, SAP y DocuWare vía el server Express.
export {
  archiveDocument,
  extractFromText,
  fileToBase64,
  getCecos,
  getContabilizacion,
  getHealth,
  ocrDocument,
  postContabilizacion,
  processDocument,
  toExtractedFields,
  validateDocument,
} from "./lib/api";
export type {
  ArchiveResponse,
  BackendExtractedFields,
  CecosResponse,
  DiTable,
  ExtractResponse,
  HealthResponse,
  OcrResponse,
  ProcessResponse,
  QualityCheck,
  SapResponse,
  ValidateResponse,
} from "./lib/api";
