/** Color admitido por el átomo `Chip` de la librería. */
export type ChipColor = "primary" | "error" | "warning" | "success" | "info";

/** Estado de una solicitud de afiliación. */
export type AffiliationStatus = "Aprobada" | "En revisión" | "Rechazada";

/** Categoría de aporte del afiliado (caja de compensación). */
export type AffiliationCategory = "A" | "B" | "C";

/** Solicitud de afiliación mostrada en las tablas de actividad. */
export interface Affiliation {
  /** Número de radicado. */
  id: string;
  afiliado: string;
  empresa: string;
  categoria: AffiliationCategory;
  estado: AffiliationStatus;
}
