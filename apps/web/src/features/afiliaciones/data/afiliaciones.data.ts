import type { Affiliation, AffiliationStatus, ChipColor } from "../types/afiliacion";

/**
 * Datos de demostración del dominio de afiliación. En un caso real vendrían de
 * `services/` (API). Aquí son estáticos solo para ilustrar el baseline.
 */

export const statusColor: Record<AffiliationStatus, ChipColor> = {
  Aprobada: "success",
  "En revisión": "warning",
  Rechazada: "error",
};

export const affiliations: Affiliation[] = [
  {
    id: "AF-1042",
    afiliado: "Ana Restrepo",
    empresa: "Textiles del Valle",
    categoria: "B",
    estado: "Aprobada",
  },
  {
    id: "AF-1041",
    afiliado: "Carlos Mesa",
    empresa: "Logística Andina",
    categoria: "A",
    estado: "En revisión",
  },
  {
    id: "AF-1040",
    afiliado: "Laura Gómez",
    empresa: "Comercial El Poblado",
    categoria: "C",
    estado: "Aprobada",
  },
  {
    id: "AF-1039",
    afiliado: "Julián Torres",
    empresa: "Constructora Sur",
    categoria: "A",
    estado: "Rechazada",
  },
  {
    id: "AF-1038",
    afiliado: "María Uribe",
    empresa: "Alimentos Frescos",
    categoria: "B",
    estado: "Aprobada",
  },
  {
    id: "AF-1037",
    afiliado: "Pedro Salazar",
    empresa: "Transportes Norte",
    categoria: "C",
    estado: "En revisión",
  },
  {
    id: "AF-1036",
    afiliado: "Diana Ochoa",
    empresa: "Servicios Integrales",
    categoria: "A",
    estado: "Aprobada",
  },
  {
    id: "AF-1035",
    afiliado: "Andrés Vélez",
    empresa: "Manufacturas Sofía",
    categoria: "B",
    estado: "Aprobada",
  },
];

/** Subconjunto reciente para el resumen del panel general. */
export const recentAffiliations: Affiliation[] = affiliations.slice(0, 5);
