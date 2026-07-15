import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addDocument,
  addExpenseToLegalization,
  deleteDocument,
  duplicateKey,
  getActiveLegalization,
  getBlockingDuplicates,
  getDocument,
  getLegalizationTotal,
  getOrCreateDraftLegalization,
  listDocuments,
  listLegalizations,
  parseAmount,
  recomputeAllDuplicates,
  submitLegalization,
  updateDocument,
} from "./store";
import type { DocumentRecord, ExtractedFields } from "../types/document";

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
  });
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
    expect(
      listLegalizations().find((l) => l.id === draft.id)?.expenseIds,
    ).toEqual([doc.id]);
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
    expect(
      listLegalizations().find((l) => l.id === draft.id)?.status,
    ).toBe("draft");
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