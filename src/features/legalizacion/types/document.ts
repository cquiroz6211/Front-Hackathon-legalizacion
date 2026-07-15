/**
 * Tipos del dominio de legalización de gastos.
 * Modelo equivalente al del diseño Next.js (`lib/store.ts`), adaptado al baseline Vite + React Router.
 */

export type Role = "conductor" | "personal";

export type LegalizationStatus = "draft" | "submitted";

export interface Legalization {
  id: string;
  period: string;
  status: LegalizationStatus;
  expenseIds: string[];
  createdAt: string;
  submittedAt?: string;
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

export interface DocumentRecord {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  role: Role;
  uploadedAt: string;
  ceco?: string;
  extracted?: ExtractedFields;
  duplicateOf?: string[];
  duplicateReason?: DuplicateReason;
}