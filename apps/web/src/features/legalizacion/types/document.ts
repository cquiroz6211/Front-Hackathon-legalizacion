/**
 * Tipos del dominio de legalización de gastos.
 * Modelo equivalente al del diseño Next.js (`lib/store.ts`), adaptado al baseline Vite + React Router.
 */

export type Role = "conductor" | "personal";

/**
 * Estados del ciclo de vida de una legalización.
 * - draft:     borrador editable por el colaborador.
 * - submitted: enviada al Gestor SAP ("En revisión Gestor SAP").
 * - approved:  decisión terminal del Gestor SAP ("Aprobado").
 * - rejected:  decisión terminal del Gestor SAP ("Rechazado").
 *
 * HU-0011 (lado gestor): `approved`/`rejected` son el resultado de la revisión
 * del Gestor SAP. Ambos son terminales en esta versión: una legalización
 * rechazada NO vuelve a `draft` (se documenta el motivo y termina ahí).
 */
export type LegalizationStatus = "draft" | "submitted" | "approved" | "rejected";

/**
 * Decisión registrada por el Gestor SAP sobre una legalización enviada
 * (HU-0011 lado gestor). Opcional para no romper localStorage legacy: una
 * legalización sin este campo aún no fue decidida por el gestor.
 */
export interface GestorDecision {
  decision: "approved" | "rejected";
  /** ISO 8601 del momento de la decisión. */
  at: string;
  /** Identificador del gestor que decidió (de `AuthSession.identifier`). */
  gestor: string;
  /** Motivo obligatorio cuando la decisión es "rejected". */
  reason?: string;
}

/**
 * Evento de auditoría del ciclo de vida de una legalización (HU-0008/0009/0011).
 * `at` es ISO 8601; `fromStatus`/`toStatus` registran la transición de estado;
 * `reason` describe el motivo (p. ej. "submit-to-gestor-sap",
 * "leader-approval:excess,time"); `actor` es quién disparó el evento.
 */
export interface AuditEvent {
  at: string;
  fromStatus?: LegalizationStatus;
  toStatus: LegalizationStatus;
  reason?: string;
  actor?: string;
}

export interface Legalization {
  id: string;
  period: string;
  status: LegalizationStatus;
  expenseIds: string[];
  createdAt: string;
  submittedAt?: string;
  /**
   * Anticipo en COP entregado a la persona para este periodo de legalización.
   * Es la plata que la empresa adelanta; contra ella se descuentan los gastos
   * justificados con facturas. La diferencia (anticipo - gastos) indica si hay
   * saldo por devolver o un monto a reembolsar.
   */
  anticipo: number;
  /**
   * Evidencia de la aprobación del líder (SIMULADA, sin backend ni rol líder).
   * `excess`/`time` indican qué motivos cubre la aprobación (HU-0008 exceso de
   * límite, HU-0009 fuera de tiempo). Opcional para no romper localStorage
   * legacy: una legalización sin este campo aún no fue aprobada por el líder.
   */
  leaderApproval?: {
    approvedAt: string;
    excess: boolean;
    time: boolean;
  };
  /**
   * Decisión del Gestor SAP (HU-0011 lado gestor). Opcional para no romper
   * localStorage legacy: ausente mientras la legalización está pendiente
   * (`submitted`) o es un borrador. Se setea al aprobar/rechazar.
   */
  gestorDecision?: GestorDecision;
  /**
   * Historial de eventos del ciclo de vida (envío a Gestor SAP, aprobación del
   * líder, etc.). Opcional para no romper localStorage legacy.
   */
  auditLog?: AuditEvent[];
}

/**
 * Estados del documento (HU-0006):
 * - upload:     recién subido, sin datos extraídos.
 * - processing: abierto en /review con datos confirmados.
 */
export type DocumentStatus = "upload" | "processing";

export interface ExtractedFields {
  fecha: string;
  nroFactura: string;
  proveedor: string;
  cliente: string;
  cuit: string;
  nit: string;
  direccion: string;
  telefono: string;
  departamento: string;
  municipio: string;
  monto: string;
  kilometraje: string;
  iva19Base: string;
  iva19Valor: string;
  iva5Base: string;
  iva5Valor: string;
  iva0Base: string;
  iva0Valor: string;
  totalFactura: string;
  /**
   * Propina opcional. No se imprime en el facsimile de la factura (ese usa
   * `totalFactura` como TOTAL). Regla de validación: `propina <= 10% del totalFactura`
   * (incluido IVA). El cálculo y la UI de error viven en el store.
   */
  propina: string;
}

export type DuplicateReason = "same-legalization" | "history" | "indeterminate";

export type DocumentPurpose = "invoice" | "rut" | "collection-account";

export interface DocumentRecord {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  role: Role;
  uploadedAt: string;
  ceco?: string;
  purpose?: DocumentPurpose;
  relatedDocumentId?: string;
  extracted?: ExtractedFields;
  duplicateOf?: string[];
  duplicateReason?: DuplicateReason;
}
