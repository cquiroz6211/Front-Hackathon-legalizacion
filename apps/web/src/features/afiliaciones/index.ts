/**
 * API pública de la feature `afiliaciones`.
 * Solo lo exportado aquí puede ser consumido por otras features o por el router.
 */
export { AfiliacionesPage } from "./AfiliacionesPage";
export { SolicitudesTable } from "./components/SolicitudesTable";
export { affiliations, recentAffiliations, statusColor } from "./data/afiliaciones.data";
export type { Affiliation, AffiliationCategory, AffiliationStatus } from "./types/afiliacion";
