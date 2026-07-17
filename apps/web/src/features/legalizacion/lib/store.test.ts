import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addDocument,
  addExpenseToLegalization,
  approveByLeader,
  approveLegalization,
  businessDaysBetween,
  canSubmitToGestorSap,
  CONSUMPTION_LIMIT,
  deleteDocument,
  duplicateKey,
  filterLegalizationsByDateRange,
  getActiveLegalization,
  getBlockingDuplicates,
  getDocument,
  getGestorDecision,
  getLegalization,
  getLegalizationAnticipo,
  getLegalizationConsumoDate,
  getLegalizationDiferencia,
  getLegalizationExcess,
  getLegalizationRegistroDate,
  getLegalizationTimeStatus,
  getLegalizationTotal,
  getOrCreateDraftLegalization,
  isLeaderApproved,
  listDocuments,
  listLegalizations,
  listLegalizationsForGestor,
  parseAmount,
  PROPINA_MAX_RATE,
  propinaCap,
  recomputeAllDuplicates,
  rejectLegalization,
  requiresLeaderApproval,
  submitLegalization,
  updateDocument,
  validatePropina,
} from "./store";
import type { DocumentRecord, ExtractedFields, Legalization } from "../types/document";

const KEYS = [
  "comfama.legalizacion.documents.v1",
  "comfama.legalizacion.legalizations.v1",
  "comfama.legalizacion.role.v1",
];

function clearStorage() {
  for (const k of KEYS) window.localStorage.removeItem(k);
}

beforeEach(clearStorage);
afterEach(clearStorage);

const SAMPLE_FIELDS: ExtractedFields = {
  fecha: "2024-03-01",
  nroFactura: "F-001",
  proveedor: "Acme",
  cliente: "Comfama",
  cuit: "30-71452896-1",
  nit: "900.123.456-7",
  direccion: "Calle 1",
  telefono: "+57 1 000 0000",
  departamento: "Antioquia",
  municipio: "Medellín",
  monto: "100.000,00",
  kilometraje: "0",
  iva19Base: "84.034,00",
  iva19Valor: "15.966,00",
  iva5Base: "0,00",
  iva5Valor: "0,00",
  iva0Base: "0,00",
  iva0Valor: "0,00",
  totalFactura: "100.000,00",
  propina: "0,00",
};

function seedDoc(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return addDocument({
    fileName: overrides.fileName ?? "doc.pdf",
    fileType: overrides.fileType ?? "application/pdf",
    fileSize: overrides.fileSize ?? 1024,
    role: overrides.role ?? "personal",
    status: overrides.status ?? "processing",
    ceco: overrides.ceco,
    extracted: overrides.extracted,
    purpose: overrides.purpose,
    relatedDocumentId: overrides.relatedDocumentId,
  });
}

const LEGALIZATIONS_KEY = "comfama.legalizacion.legalizations.v1";

/** Fecha de hoy en `yyyy-mm-dd` (hora local) para construir docs "a tiempo". */
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Escribe una legalización directamente en localStorage con timestamps
 * controlados (sin depender de `new Date()`), para que los filtros por fecha
 * sean deterministas. Mismo patrón que los tests de datos legacy.
 */
function seedLegalizationRaw(over: Partial<Legalization> & { id: string }): Legalization {
  const base: Legalization = {
    id: over.id,
    period: over.period ?? "Periodo",
    status: over.status ?? "draft",
    expenseIds: over.expenseIds ?? [],
    createdAt: over.createdAt ?? "2024-01-01T00:00:00.000Z",
    submittedAt: over.submittedAt,
    anticipo: over.anticipo ?? 1_500_000,
  };
  const raw = window.localStorage.getItem(LEGALIZATIONS_KEY);
  const list = raw ? (JSON.parse(raw) as Legalization[]) : [];
  list.push(base);
  window.localStorage.setItem(LEGALIZATIONS_KEY, JSON.stringify(list));
  return base;
}

describe("parseAmount", () => {
  it("interpreta formato colombiano con miles y decimales", () => {
    expect(parseAmount("559.625,00")).toBeCloseTo(559625);
    expect(parseAmount("100.000,50")).toBeCloseTo(100000.5);
  });

  it("devuelve 0 para vacío o NaN", () => {
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount("abc")).toBe(0);
    expect(parseAmount("")).toBe(0);
  });
});

describe("propina (validación 10% sobre total factura)", () => {
  it("propinaCap aplica exactamente la tasa del 10%", () => {
    expect(PROPINA_MAX_RATE).toBeCloseTo(0.1);
    expect(propinaCap("100.000,00")).toBeCloseTo(10000);
    expect(propinaCap(559625)).toBeCloseTo(55962.5);
  });

  it("considera válida una propina vacía o en cero", () => {
    expect(validatePropina("", "100.000,00").isValid).toBe(true);
    expect(validatePropina(undefined, "100.000,00").isValid).toBe(true);
    expect(validatePropina("0,00", "100.000,00").isValid).toBe(true);
  });

  it("acepta una propina exactamente igual al tope", () => {
    const result = validatePropina("10.000,00", "100.000,00");
    expect(result.isValid).toBe(true);
    expect(result.max).toBeCloseTo(10000);
  });

  it("rechaza una propina que supera el tope y devuelve el mensaje", () => {
    const result = validatePropina("15.000,00", "100.000,00");
    expect(result.isValid).toBe(false);
    expect(result.value).toBeCloseTo(15000);
    expect(result.max).toBeCloseTo(10000);
    expect(result.message).toMatch(/10%/);
  });

  it("funciona cuando el total es numérico o string formateado", () => {
    expect(validatePropina("5.000,00", 50000).isValid).toBe(true);
    expect(validatePropina("6.000,00", 50000).isValid).toBe(false);
  });
});

describe("documentos (store)", () => {
  it("siembra documentos demo en el primer arranque", () => {
    const docs = listDocuments();
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => typeof d.id === "string")).toBe(true);
  });

  it("agrega, actualiza y elimina preservando la persistencia", () => {
    const created = seedDoc({ fileName: "nuevo.pdf" });
    expect(getDocument(created.id)?.fileName).toBe("nuevo.pdf");

    const updated = updateDocument(created.id, { status: "processing" });
    expect(updated?.status).toBe("processing");

    deleteDocument(created.id);
    expect(getDocument(created.id)).toBeUndefined();
  });

  it("persiste el propósito y la relación explícita entre RUT y cuenta de cobro", () => {
    const rut = seedDoc({ fileName: "rut.pdf", purpose: "rut" });
    const account = seedDoc({
      fileName: "cuenta.pdf",
      purpose: "collection-account",
      relatedDocumentId: rut.id,
    });

    const relatedRut = updateDocument(rut.id, { relatedDocumentId: account.id });

    expect(getDocument(account.id)).toMatchObject({
      purpose: "collection-account",
      relatedDocumentId: rut.id,
    });
    expect(relatedRut).toMatchObject({ purpose: "rut", relatedDocumentId: account.id });
  });

  it("lee documentos legacy sin propósito ni relación", () => {
    window.localStorage.setItem(
      "comfama.legalizacion.documents.v1",
      JSON.stringify([
        {
          id: "legacy-document",
          fileName: "legacy.pdf",
          fileType: "application/pdf",
          fileSize: 100,
          status: "upload",
          role: "personal",
          uploadedAt: "2024-01-01T00:00:00.000Z",
        },
      ]),
    );

    expect(getDocument("legacy-document")).toMatchObject({
      id: "legacy-document",
      fileName: "legacy.pdf",
    });
    expect(getDocument("legacy-document")?.purpose).toBeUndefined();
    expect(getDocument("legacy-document")?.relatedDocumentId).toBeUndefined();
  });
});

describe("legalizaciones (store)", () => {
  it("getOrCreateDraftLegalization devuelve un único borrador activo", () => {
    const a = getOrCreateDraftLegalization();
    const b = getOrCreateDraftLegalization();
    expect(b.id).toBe(a.id);
  });

  it("addExpenseToLegalization es idempotente para el mismo documento", () => {
    const draft = getOrCreateDraftLegalization();
    const doc = seedDoc({});
    addExpenseToLegalization(draft.id, doc.id);
    addExpenseToLegalization(draft.id, doc.id);
    expect(listLegalizations().find((l) => l.id === draft.id)?.expenseIds).toEqual([doc.id]);
  });

  it("getLegalizationTotal suma totalFactura parseado de cada gasto", () => {
    const draft = getOrCreateDraftLegalization();
    const a = seedDoc({ fileName: "a.pdf", extracted: SAMPLE_FIELDS });
    const b = seedDoc({
      fileName: "b.pdf",
      extracted: { ...SAMPLE_FIELDS, totalFactura: "50.000,00" },
    });
    addExpenseToLegalization(draft.id, a.id);
    addExpenseToLegalization(draft.id, b.id);
    expect(getLegalizationTotal(draft.id)).toBeCloseTo(150000);
  });

  it("el borrador creado incluye un anticipo por defecto", () => {
    const draft = getOrCreateDraftLegalization();
    expect(typeof draft.anticipo).toBe("number");
    expect(draft.anticipo).toBeGreaterThan(0);
    expect(getLegalizationAnticipo(draft.id)).toBe(draft.anticipo);
  });

  it("getLegalizationDiferencia es anticipo - gastos (saldo a favor)", () => {
    const draft = getOrCreateDraftLegalization();
    const a = seedDoc({ fileName: "a.pdf", extracted: SAMPLE_FIELDS });
    addExpenseToLegalization(draft.id, a.id);
    const gastos = getLegalizationTotal(draft.id);
    const diferencia = getLegalizationDiferencia(draft.id);
    expect(diferencia).toBeCloseTo(draft.anticipo - gastos);
    expect(diferencia).toBeGreaterThan(0);
  });

  it("diferencia negativa cuando los gastos superan el anticipo (a reembolsar)", () => {
    const draft = getOrCreateDraftLegalization();
    const caro = seedDoc({
      fileName: "caro.pdf",
      extracted: { ...SAMPLE_FIELDS, totalFactura: "5.000.000,00" },
    });
    addExpenseToLegalization(draft.id, caro.id);
    expect(getLegalizationDiferencia(draft.id)).toBeLessThan(0);
  });

  it("migra legalizaciones viejas sin anticipo asignando el default", () => {
    window.localStorage.setItem(
      "comfama.legalizacion.legalizations.v1",
      JSON.stringify([
        {
          id: "legacy-1",
          period: "Legacy",
          status: "submitted",
          expenseIds: [],
          createdAt: new Date().toISOString(),
        },
      ]),
    );
    const anticipo = getLegalizationAnticipo("legacy-1");
    expect(anticipo).toBeGreaterThan(0);
  });

  it("submitLegalization persiste cuando hay al menos un gasto", () => {
    const draft = getOrCreateDraftLegalization();
    const a = seedDoc({
      fileName: "a.pdf",
      status: "processing",
      extracted: { ...SAMPLE_FIELDS, fecha: todayISO(), totalFactura: "100.000,00" },
    });
    addExpenseToLegalization(draft.id, a.id);
    const result = submitLegalization(draft.id);
    expect(result?.status).toBe("submitted");
    expect(result?.submittedAt).toBeDefined();
  });

  it("submitLegalization no persiste si el borrador está vacío", () => {
    const draft = getOrCreateDraftLegalization();
    expect(submitLegalization(draft.id)).toBeUndefined();
    expect(listLegalizations().find((l) => l.id === draft.id)?.status).toBe("draft");
  });

  it("getActiveLegalization devuelve la última enviada cuando no hay borrador", () => {
    const draft = getOrCreateDraftLegalization();
    const a = seedDoc({
      fileName: "a.pdf",
      status: "processing",
      extracted: { ...SAMPLE_FIELDS, fecha: todayISO(), totalFactura: "100.000,00" },
    });
    addExpenseToLegalization(draft.id, a.id);
    submitLegalization(draft.id);

    const active = getActiveLegalization();
    expect(active?.status).toBe("submitted");
    expect(active?.id).toBe(draft.id);
  });
});

describe("detección de duplicados (HU-0007)", () => {
  it("duplicateKey devuelve null si falta nroFactura o nit", () => {
    const doc = seedDoc({
      fileName: "sin.pdf",
      extracted: { ...SAMPLE_FIELDS, nroFactura: "" },
    });
    expect(duplicateKey(doc)).toBeNull();
  });

  it("duplicateKey normaliza mayúsculas y espacios", () => {
    const doc = seedDoc({
      fileName: "x.pdf",
      extracted: {
        ...SAMPLE_FIELDS,
        nroFactura: "  F-001 ",
        nit: "Nit 900.123.456-7",
      },
    });
    expect(duplicateKey(doc)).toBe("f-001|nit 900.123.456-7");
  });

  it("getBlockingDuplicates detecta colisiones dentro de la misma legalización", () => {
    const draft = getOrCreateDraftLegalization();
    const a = seedDoc({
      fileName: "a.pdf",
      extracted: { ...SAMPLE_FIELDS, nroFactura: "F-001" },
    });
    const b = seedDoc({
      fileName: "b.pdf",
      extracted: { ...SAMPLE_FIELDS, nroFactura: "F-001" },
    });
    addExpenseToLegalization(draft.id, a.id);
    addExpenseToLegalization(draft.id, b.id);
    recomputeAllDuplicates();
    const blocking = getBlockingDuplicates(draft.id);
    expect(blocking).toContain(a.id);
    expect(blocking).toContain(b.id);
  });
});

describe("HU-0010 — fechas de consumo/registro", () => {
  it("getLegalizationConsumoDate devuelve la extracted.fecha más temprana", () => {
    const early = seedDoc({
      fileName: "early.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: "2024-03-01" },
    });
    const late = seedDoc({
      fileName: "late.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: "2024-03-15" },
    });
    seedLegalizationRaw({ id: "leg-consumo", expenseIds: [late.id, early.id] });

    expect(getLegalizationConsumoDate("leg-consumo")).toBe("2024-03-01");
  });

  it("getLegalizationConsumoDate es null cuando no hay documentos con fecha", () => {
    const sinFecha = seedDoc({ fileName: "nofecha.pdf", extracted: undefined });
    seedLegalizationRaw({ id: "leg-null", expenseIds: [sinFecha.id] });

    expect(getLegalizationConsumoDate("leg-null")).toBeNull();
  });

  it("getLegalizationConsumoDate es null para una legalización inexistente o sin gastos", () => {
    seedLegalizationRaw({ id: "leg-vacia", expenseIds: [] });
    expect(getLegalizationConsumoDate("leg-vacia")).toBeNull();
    expect(getLegalizationConsumoDate("no-existe")).toBeNull();
  });

  it("getLegalizationRegistroDate usa submittedAt si existe, si no createdAt", () => {
    seedLegalizationRaw({
      id: "leg-enviada",
      status: "submitted",
      createdAt: "2024-01-01T00:00:00.000Z",
      submittedAt: "2024-05-10T12:30:00.000Z",
    });
    seedLegalizationRaw({ id: "leg-borrador", createdAt: "2024-01-15T08:00:00.000Z" });

    expect(getLegalizationRegistroDate("leg-enviada")).toBe("2024-05-10");
    expect(getLegalizationRegistroDate("leg-borrador")).toBe("2024-01-15");
  });
});

describe("HU-0010 — filterLegalizationsByDateRange", () => {
  function buildFixtures() {
    // consumo 2024-02-01, registro 2024-02-01
    const docFeb = seedDoc({
      fileName: "feb.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: "2024-02-01" },
    });
    seedLegalizationRaw({
      id: "leg-feb",
      createdAt: "2024-02-01T00:00:00.000Z",
      expenseIds: [docFeb.id],
    });
    // consumo 2024-03-10, registro 2024-03-12 (enviada)
    const docMar = seedDoc({
      fileName: "mar.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: "2024-03-10" },
    });
    seedLegalizationRaw({
      id: "leg-mar",
      status: "submitted",
      createdAt: "2024-03-10T00:00:00.000Z",
      submittedAt: "2024-03-12T00:00:00.000Z",
      expenseIds: [docMar.id],
    });
    // sin fecha de consumo
    const docSin = seedDoc({ fileName: "sin.pdf", extracted: undefined });
    seedLegalizationRaw({
      id: "leg-sin-consumo",
      createdAt: "2024-03-20T00:00:00.000Z",
      expenseIds: [docSin.id],
    });
    return listLegalizations();
  }

  it("sin filtros devuelve todos los elementos (copia, sin mutar la entrada)", () => {
    const items = buildFixtures();
    const filtered = filterLegalizationsByDateRange(items, {});
    expect(filtered.length).toBe(items.length);
    expect(filtered).not.toBe(items);
  });

  it("filtra por rango de consumo incluyendo límites (inclusive)", () => {
    const items = buildFixtures();
    const soloMar = filterLegalizationsByDateRange(items, {
      consumo: { from: "2024-03-01", to: "2024-03-31" },
    });
    expect(soloMar.map((l) => l.id)).toEqual(["leg-mar"]);

    const ambos = filterLegalizationsByDateRange(items, {
      consumo: { from: "2024-02-01", to: "2024-03-10" },
    });
    expect(ambos.map((l) => l.id).sort()).toEqual(["leg-feb", "leg-mar"]);
  });

  it("una legalización sin fecha de consumo queda fuera del filtro por consumo", () => {
    const items = buildFixtures();
    const res = filterLegalizationsByDateRange(items, {
      consumo: { from: "2020-01-01", to: "2030-12-31" },
    });
    expect(res.map((l) => l.id).sort()).toEqual(["leg-feb", "leg-mar"]);
    expect(res.map((l) => l.id)).not.toContain("leg-sin-consumo");
  });

  it("filtra por rango de registro (usa submittedAt ?? createdAt)", () => {
    const items = buildFixtures();
    const res = filterLegalizationsByDateRange(items, {
      registro: { from: "2024-03-11", to: "2024-03-13" },
    });
    expect(res.map((l) => l.id)).toEqual(["leg-mar"]);
  });

  it("combina consumo y registro con AND", () => {
    const items = buildFixtures();
    const res = filterLegalizationsByDateRange(items, {
      consumo: { from: "2024-03-01", to: "2024-03-31" },
      registro: { from: "2024-03-11", to: "2024-03-13" },
    });
    expect(res.map((l) => l.id)).toEqual(["leg-mar"]);
  });

  it("acepta from y to de forma independiente (solo from, solo to)", () => {
    const items = buildFixtures();
    const soloFrom = filterLegalizationsByDateRange(items, { consumo: { from: "2024-03-01" } });
    expect(soloFrom.map((l) => l.id)).toEqual(["leg-mar"]);

    const soloTo = filterLegalizationsByDateRange(items, { consumo: { to: "2024-02-28" } });
    expect(soloTo.map((l) => l.id)).toEqual(["leg-feb"]);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * HU-0008 / HU-0009 / HU-0011 — límite de consumo, tiempo y flujo a Gestor SAP
 * ───────────────────────────────────────────────────────────────────────── */

describe("HU-0009 — businessDaysBetween (días hábiles Lun-Vie)", () => {
  // Convención: [from, to) — incluye `from`, excluye `to`. Solo L-V.

  it("mismo día (from === to) cuenta 0 días", () => {
    expect(businessDaysBetween("2024-03-04", "2024-03-04")).toBe(0);
  });

  it("salta el fin de semana (Lun a Lun siguiente = 5 hábiles)", () => {
    // 2024-03-04 = Lunes; 2024-03-11 = Lunes siguiente
    expect(businessDaysBetween("2024-03-04", "2024-03-11")).toBe(5);
  });

  it("frontera: Lunes a Sábado de la misma semana = 5 hábiles (Sábado excluido)", () => {
    // 2024-03-04 = Lunes; 2024-03-09 = Sábado
    expect(businessDaysBetween("2024-03-04", "2024-03-09")).toBe(5);
  });

  it("Viernes a Lunes siguiente = 1 hábil (solo el Viernes)", () => {
    // 2024-03-08 = Viernes; 2024-03-11 = Lunes
    expect(businessDaysBetween("2024-03-08", "2024-03-11")).toBe(1);
  });

  it("cuenta un único día entre fechas consecutivas entre semana", () => {
    // Lunes a Martes = 1 hábil (el Lunes)
    expect(businessDaysBetween("2024-03-04", "2024-03-05")).toBe(1);
  });

  it("devuelve 0 cuando `to` es anterior a `from`", () => {
    expect(businessDaysBetween("2024-03-11", "2024-03-04")).toBe(0);
  });

  it("devuelve 0 para fechas inválidas", () => {
    expect(businessDaysBetween("no-es-fecha", "2024-03-04")).toBe(0);
    expect(businessDaysBetween("2024-03-04", "no-es-fecha")).toBe(0);
    expect(businessDaysBetween("2024-13-40", "2024-03-04")).toBe(0);
  });
});

describe("HU-0008 — CONSUMPTION_LIMIT y getLegalizationExcess", () => {
  it("CONSUMPTION_LIMIT es 500.000 COP", () => {
    expect(CONSUMPTION_LIMIT).toBe(500_000);
  });

  it("sin exceso cuando ningún totalFactura supera el tope", () => {
    const doc = seedDoc({
      fileName: "ok.pdf",
      extracted: { ...SAMPLE_FIELDS, totalFactura: "100.000,00" },
    });
    seedLegalizationRaw({ id: "leg-ok", expenseIds: [doc.id] });

    const excess = getLegalizationExcess("leg-ok");
    expect(excess.hasExcess).toBe(false);
    expect(excess.exceededDocIds).toEqual([]);
    expect(excess.totalExcess).toBe(0);
  });

  it("detecta exceso y acumula el monto excedido por documento", () => {
    const caro = seedDoc({
      fileName: "caro.pdf",
      extracted: { ...SAMPLE_FIELDS, totalFactura: "600.000,00" },
    });
    seedLegalizationRaw({ id: "leg-exceso", expenseIds: [caro.id] });

    const excess = getLegalizationExcess("leg-exceso");
    expect(excess.hasExcess).toBe(true);
    expect(excess.exceededDocIds).toEqual([caro.id]);
    expect(excess.totalExcess).toBeCloseTo(100_000);
  });

  it("suma el exceso de varios documentos y respeta el tope global", () => {
    const a = seedDoc({
      fileName: "a.pdf",
      extracted: { ...SAMPLE_FIELDS, totalFactura: "600.000,00" },
    });
    const b = seedDoc({
      fileName: "b.pdf",
      extracted: { ...SAMPLE_FIELDS, totalFactura: "700.000,00" },
    });
    const ok = seedDoc({
      fileName: "ok.pdf",
      extracted: { ...SAMPLE_FIELDS, totalFactura: "100.000,00" },
    });
    seedLegalizationRaw({ id: "leg-multi", expenseIds: [a.id, b.id, ok.id] });

    const excess = getLegalizationExcess("leg-multi");
    expect(excess.hasExcess).toBe(true);
    expect(excess.exceededDocIds.sort()).toEqual([a.id, b.id].sort());
    expect(excess.totalExcess).toBeCloseTo(300_000); // 100k + 200k
  });

  it("legalización inexistente o sin gastos no tiene exceso", () => {
    expect(getLegalizationExcess("no-existe").hasExcess).toBe(false);
    seedLegalizationRaw({ id: "leg-vacia", expenseIds: [] });
    expect(getLegalizationExcess("leg-vacia").hasExcess).toBe(false);
  });
});

describe("HU-0009 — getLegalizationTimeStatus (días hábiles desde el consumo)", () => {
  it("sin consumoDate no está fuera de tiempo", () => {
    const sinFecha = seedDoc({ fileName: "sin.pdf", extracted: undefined });
    seedLegalizationRaw({ id: "leg-sin", expenseIds: [sinFecha.id] });

    const status = getLegalizationTimeStatus("leg-sin", new Date("2024-03-10T12:00:00"));
    expect(status).toEqual({ outOfTime: false, daysElapsed: 0, consumoDate: null });
  });

  it("dentro de tiempo (<= 5 días hábiles) no marca incumplimiento", () => {
    const doc = seedDoc({
      fileName: "d.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: "2024-03-04" },
    });
    seedLegalizationRaw({ id: "leg-dentro", expenseIds: [doc.id] });

    // Lun 2024-03-04 → Lun 2024-03-11 = 5 hábiles (límite, aún a tiempo)
    const status = getLegalizationTimeStatus("leg-dentro", new Date("2024-03-11T12:00:00"));
    expect(status.outOfTime).toBe(false);
    expect(status.daysElapsed).toBe(5);
    expect(status.consumoDate).toBe("2024-03-04");
  });

  it("fuera de tiempo (> 5 días hábiles) marca incumplimiento", () => {
    const doc = seedDoc({
      fileName: "d.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: "2024-03-04" },
    });
    seedLegalizationRaw({ id: "leg-fuera", expenseIds: [doc.id] });

    // Lun 2024-03-04 → Mar 2024-03-12 = 6 hábiles
    const status = getLegalizationTimeStatus("leg-fuera", new Date("2024-03-12T12:00:00"));
    expect(status.outOfTime).toBe(true);
    expect(status.daysElapsed).toBe(6);
  });
});

describe("requiresLeaderApproval / isLeaderApproved / approveByLeader", () => {
  it("requiresLeaderApproval combina exceso y tiempo", () => {
    const caro = seedDoc({
      fileName: "caro.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: "2024-03-04", totalFactura: "600.000,00" },
    });
    seedLegalizationRaw({ id: "leg-ambos", expenseIds: [caro.id] });

    const req = requiresLeaderApproval("leg-ambos", new Date("2024-03-12T12:00:00"));
    expect(req.excess).toBe(true);
    expect(req.time).toBe(true);
    expect(req.any).toBe(true);
  });

  it("sin exceso ni fuera de tiempo no requiere aprobación del líder", () => {
    const doc = seedDoc({
      fileName: "ok.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: todayISO(), totalFactura: "100.000,00" },
    });
    seedLegalizationRaw({ id: "leg-ok", expenseIds: [doc.id] });

    const req = requiresLeaderApproval("leg-ok");
    expect(req.any).toBe(false);
  });

  it("isLeaderApproved es false mientras falte la aprobación requerida", () => {
    const caro = seedDoc({
      fileName: "caro.pdf",
      extracted: { ...SAMPLE_FIELDS, totalFactura: "600.000,00" },
    });
    seedLegalizationRaw({ id: "leg-pend", expenseIds: [caro.id] });

    expect(isLeaderApproved("leg-pend")).toBe(false);
  });

  it("approveByLeader deja evidencia (leaderApproval + audit) y desbloquea", () => {
    const caro = seedDoc({
      fileName: "caro.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: "2024-03-04", totalFactura: "600.000,00" },
    });
    seedLegalizationRaw({ id: "leg-aprobar", expenseIds: [caro.id] });

    const before = requiresLeaderApproval("leg-aprobar", new Date("2024-03-12T12:00:00"));
    expect(before.any).toBe(true);

    const approved = approveByLeader("leg-aprobar");
    expect(approved?.leaderApproval).toBeDefined();
    expect(approved?.leaderApproval?.excess).toBe(true);
    expect(approved?.leaderApproval?.time).toBe(true);
    expect(approved?.leaderApproval?.approvedAt).toBeDefined();

    // Auditoría: un evento con actor líder y motivo que menciona exceso y tiempo
    const audit = approved?.auditLog ?? [];
    expect(audit.length).toBe(1);
    expect(audit[0].actor).toBe("leader");
    expect(audit[0].reason).toMatch(/leader-approval/);
    expect(audit[0].reason).toMatch(/excess/);
    expect(audit[0].reason).toMatch(/time/);

    // Ya cubierto → desbloqueado
    expect(isLeaderApproved("leg-aprobar")).toBe(true);
  });

  it("approveByLeader de una legalización inexistente devuelve undefined", () => {
    expect(approveByLeader("no-existe")).toBeUndefined();
  });
});

describe("HU-0011 — canSubmitToGestorSap (bloqueos combinados)", () => {
  function doc(over = false, fecha = todayISO()) {
    return seedDoc({
      fileName: "d.pdf",
      extracted: {
        ...SAMPLE_FIELDS,
        fecha,
        totalFactura: over ? "600.000,00" : "100.000,00",
      },
    });
  }

  it("sin gastos no puede enviar (can false)", () => {
    seedLegalizationRaw({ id: "leg-vacia", expenseIds: [] });
    const res = canSubmitToGestorSap("leg-vacia");
    expect(res.can).toBe(false);
  });

  it("no bloquea por exceso (lo decide el Gestor SAP, no hay rol líder)", () => {
    const d = doc(true);
    seedLegalizationRaw({ id: "leg-exceso", expenseIds: [d.id] });
    const res = canSubmitToGestorSap("leg-exceso");
    expect(res.can).toBe(true);
    expect(res.blockers).toEqual([]);
  });

  it("no bloquea por fuera de tiempo (lo decide el Gestor SAP, no hay rol líder)", () => {
    const d = doc(false, "2024-03-04");
    seedLegalizationRaw({ id: "leg-tiempo", expenseIds: [d.id] });
    const res = canSubmitToGestorSap("leg-tiempo", new Date("2024-03-12T12:00:00"));
    expect(res.can).toBe(true);
    expect(res.blockers).toEqual([]);
  });

  it("bloquea por duplicados", () => {
    const a = seedDoc({
      fileName: "a.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: todayISO(), nroFactura: "F-001" },
    });
    const b = seedDoc({
      fileName: "b.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: todayISO(), nroFactura: "F-001" },
    });
    seedLegalizationRaw({ id: "leg-dup", expenseIds: [a.id, b.id] });
    recomputeAllDuplicates();
    const res = canSubmitToGestorSap("leg-dup");
    expect(res.can).toBe(false);
    expect(res.blockers).toContain("duplicates");
  });

  it("aprueba al líder y habilita el envío (sin otros bloqueos)", () => {
    const d = doc(true, "2024-03-04");
    seedLegalizationRaw({ id: "leg-ok", expenseIds: [d.id] });
    approveByLeader("leg-ok");
    const res = canSubmitToGestorSap("leg-ok", new Date("2024-03-12T12:00:00"));
    expect(res.can).toBe(true);
    expect(res.blockers).toEqual([]);
  });
});

describe("HU-0011 — submitLegalization respeta aprobación del líder y audita", () => {
  it("permite el envío con exceso sin aprobación del líder (no hay rol líder)", () => {
    const caro = seedDoc({
      fileName: "caro.pdf",
      extracted: { ...SAMPLE_FIELDS, totalFactura: "600.000,00" },
    });
    seedLegalizationRaw({ id: "leg-pend", expenseIds: [caro.id] });

    const result = submitLegalization("leg-pend");
    expect(result?.status).toBe("submitted");
  });

  it("permite el envío tras la aprobación del líder y registra auditoría", () => {
    const caro = seedDoc({
      fileName: "caro.pdf",
      extracted: { ...SAMPLE_FIELDS, totalFactura: "600.000,00" },
    });
    seedLegalizationRaw({ id: "leg-apr", expenseIds: [caro.id] });
    approveByLeader("leg-apr");

    const result = submitLegalization("leg-apr");
    expect(result?.status).toBe("submitted");
    expect(result?.submittedAt).toBeDefined();

    // Auditoría del envío: draft → submitted con motivo de Gestor SAP
    const submitEvent = result?.auditLog?.find((e) => e.toStatus === "submitted");
    expect(submitEvent).toBeDefined();
    expect(submitEvent?.fromStatus).toBe("draft");
    expect(submitEvent?.reason).toMatch(/gestor-sap/i);
    // Conserva el evento previo de aprobación del líder
    expect(result?.auditLog?.some((e) => e.actor === "leader")).toBe(true);
  });

  it("mantiene el bloqueo por duplicados existente", () => {
    const a = seedDoc({
      fileName: "a.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: todayISO(), nroFactura: "F-001" },
    });
    const b = seedDoc({
      fileName: "b.pdf",
      extracted: { ...SAMPLE_FIELDS, fecha: todayISO(), nroFactura: "F-001" },
    });
    seedLegalizationRaw({ id: "leg-dup", expenseIds: [a.id, b.id] });
    recomputeAllDuplicates();

    expect(submitLegalization("leg-dup")).toBeUndefined();
    expect(getLegalization("leg-dup")?.status).toBe("draft");
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * HU-0011 (lado Gestor SAP) — bandeja, aprobación y rechazo
 * ───────────────────────────────────────────────────────────────────────── */

describe("HU-0011 — listLegalizationsForGestor (bandeja del gestor)", () => {
  it("devuelve solo las enviadas (submitted), excluyendo draft/approved/rejected", () => {
    seedLegalizationRaw({ id: "leg-draft", status: "draft" });
    seedLegalizationRaw({
      id: "leg-sub-1",
      status: "submitted",
      createdAt: "2024-03-10T00:00:00.000Z",
      submittedAt: "2024-03-12T00:00:00.000Z",
    });
    seedLegalizationRaw({
      id: "leg-sub-2",
      status: "submitted",
      createdAt: "2024-03-01T00:00:00.000Z",
      submittedAt: "2024-03-15T00:00:00.000Z",
    });
    seedLegalizationRaw({ id: "leg-aprobada", status: "approved" });
    seedLegalizationRaw({ id: "leg-rechazada", status: "rejected" });

    const pending = listLegalizationsForGestor();
    expect(pending.map((l) => l.id).sort()).toEqual(["leg-sub-1", "leg-sub-2"]);
  });

  it("ordena por submittedAt descendente (la más reciente primero)", () => {
    seedLegalizationRaw({
      id: "leg-vieja",
      status: "submitted",
      submittedAt: "2024-03-01T00:00:00.000Z",
    });
    seedLegalizationRaw({
      id: "leg-nueva",
      status: "submitted",
      submittedAt: "2024-03-15T00:00:00.000Z",
    });

    const pending = listLegalizationsForGestor();
    expect(pending.map((l) => l.id)).toEqual(["leg-nueva", "leg-vieja"]);
  });

  it("usa createdAt como fallback cuando submittedAt falta", () => {
    seedLegalizationRaw({
      id: "leg-sin-submit-at",
      status: "submitted",
      createdAt: "2024-03-20T00:00:00.000Z",
    });
    const pending = listLegalizationsForGestor();
    expect(pending.map((l) => l.id)).toEqual(["leg-sin-submit-at"]);
  });

  it("devuelve un arreglo vacío (copia) cuando no hay pendientes", () => {
    seedLegalizationRaw({ id: "leg-draft", status: "draft" });
    const pending = listLegalizationsForGestor();
    expect(pending).toEqual([]);
  });
});

describe("HU-0011 — approveLegalization (gestor aprueba)", () => {
  it("cambia el estado a approved, registra gestorDecision y audita", () => {
    seedLegalizationRaw({
      id: "leg-pend",
      status: "submitted",
      submittedAt: "2024-03-12T00:00:00.000Z",
    });

    const result = approveLegalization("leg-pend", "gestor.demo");
    expect(result?.status).toBe("approved");
    expect(result?.gestorDecision?.decision).toBe("approved");
    expect(result?.gestorDecision?.gestor).toBe("gestor.demo");
    expect(result?.gestorDecision?.at).toBeDefined();

    const persisted = getLegalization("leg-pend");
    expect(persisted?.status).toBe("approved");
    expect(persisted?.gestorDecision?.decision).toBe("approved");

    const approveEvent = persisted?.auditLog?.find((e) => e.toStatus === "approved");
    expect(approveEvent).toBeDefined();
    expect(approveEvent?.fromStatus).toBe("submitted");
    expect(approveEvent?.reason).toMatch(/gestor-approval/);
    expect(approveEvent?.actor).toBe("gestor.demo");
  });

  it("getGestorDecision devuelve la decisión registrada", () => {
    seedLegalizationRaw({ id: "leg-x", status: "submitted" });
    approveLegalization("leg-x", "gestor.demo");
    const decision = getGestorDecision("leg-x");
    expect(decision?.decision).toBe("approved");
    expect(decision?.gestor).toBe("gestor.demo");
  });

  it("no muta y devuelve undefined si la legalización no está pendiente", () => {
    seedLegalizationRaw({ id: "leg-draft", status: "draft" });
    expect(approveLegalization("leg-draft", "gestor.demo")).toBeUndefined();
    expect(getLegalization("leg-draft")?.status).toBe("draft");
    expect(getLegalization("leg-draft")?.gestorDecision).toBeUndefined();
  });

  it("no muta y devuelve undefined si el id no existe", () => {
    expect(approveLegalization("no-existe", "gestor.demo")).toBeUndefined();
  });

  it("saca la legalización de la bandeja del gestor tras aprobar", () => {
    seedLegalizationRaw({ id: "leg-pend", status: "submitted" });
    approveLegalization("leg-pend", "gestor.demo");
    expect(listLegalizationsForGestor().map((l) => l.id)).not.toContain("leg-pend");
  });
});

describe("HU-0011 — rejectLegalization (gestor rechaza)", () => {
  it("requiere motivo: reason vacío no muta y devuelve undefined", () => {
    seedLegalizationRaw({ id: "leg-pend", status: "submitted" });
    expect(rejectLegalization("leg-pend", "gestor.demo", "")).toBeUndefined();
    expect(rejectLegalization("leg-pend", "gestor.demo", "   ")).toBeUndefined();
    expect(getLegalization("leg-pend")?.status).toBe("submitted");
    expect(getLegalization("leg-pend")?.gestorDecision).toBeUndefined();
  });

  it("cambia el estado a rejected, registra gestorDecision con motivo y audita", () => {
    seedLegalizationRaw({ id: "leg-pend", status: "submitted" });
    const motivo = "Falta soporte de la factura";

    const result = rejectLegalization("leg-pend", "gestor.demo", motivo);
    expect(result?.status).toBe("rejected");
    expect(result?.gestorDecision?.decision).toBe("rejected");
    expect(result?.gestorDecision?.reason).toBe(motivo);
    expect(result?.gestorDecision?.gestor).toBe("gestor.demo");

    const persisted = getLegalization("leg-pend");
    expect(persisted?.status).toBe("rejected");

    const rejectEvent = persisted?.auditLog?.find((e) => e.toStatus === "rejected");
    expect(rejectEvent).toBeDefined();
    expect(rejectEvent?.fromStatus).toBe("submitted");
    expect(rejectEvent?.actor).toBe("gestor.demo");
    expect(rejectEvent?.reason).toContain("gestor-rejection");
    expect(rejectEvent?.reason).toContain(motivo);
  });

  it("no muta y devuelve undefined si no está pendiente", () => {
    seedLegalizationRaw({ id: "leg-draft", status: "draft" });
    expect(rejectLegalization("leg-draft", "gestor.demo", "motivo")).toBeUndefined();
    expect(getLegalization("leg-draft")?.status).toBe("draft");
  });

  it("no muta y devuelve undefined si el id no existe", () => {
    expect(rejectLegalization("no-existe", "gestor.demo", "motivo")).toBeUndefined();
  });

  it("saca la legalización de la bandeja del gestor tras rechazar", () => {
    seedLegalizationRaw({ id: "leg-pend", status: "submitted" });
    rejectLegalization("leg-pend", "gestor.demo", "mal");
    expect(listLegalizationsForGestor().map((l) => l.id)).not.toContain("leg-pend");
  });
});
