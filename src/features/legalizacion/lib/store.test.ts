import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addDocument,
  addExpenseToLegalization,
  deleteDocument,
  duplicateKey,
  filterLegalizationsByDateRange,
  getActiveLegalization,
  getBlockingDuplicates,
  getDocument,
  getLegalizationAnticipo,
  getLegalizationConsumoDate,
  getLegalizationDiferencia,
  getLegalizationRegistroDate,
  getLegalizationTotal,
  getOrCreateDraftLegalization,
  listDocuments,
  listLegalizations,
  parseAmount,
  PROPINA_MAX_RATE,
  propinaCap,
  recomputeAllDuplicates,
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
      extracted: SAMPLE_FIELDS,
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
      extracted: SAMPLE_FIELDS,
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
