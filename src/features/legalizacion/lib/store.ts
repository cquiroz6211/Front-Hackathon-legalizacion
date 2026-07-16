/**
 * Store de legalización basado en `localStorage`. Equivalente al `lib/store.ts`
 * del diseño Next.js, pero recortado a las primitivas que las vistas consumen
 * (HU-0006: carga + revisión + envío a aprobación).
 *
 * Patrón pub/sub: `subscribe(fn)` notifica mutaciones a los componentes en la
 * misma pestaña; `/me` se re-renderiza automáticamente al subir o confirmar
 * documentos desde otras rutas.
 *
 * No hay backend: decisión temporal del hackatón. Plan: mover a API + BD.
 */

import { SEED_DOCUMENTS } from "../data/seed";
import type {
  DocumentRecord,
  DocumentStatus,
  DuplicateReason,
  ExtractedFields,
  Legalization,
  Role,
} from "../types/document";

const DOCUMENTS_KEY = "comfama.legalizacion.documents.v1";
const LEGALIZATIONS_KEY = "comfama.legalizacion.legalizations.v1";
const ROLE_KEY = "comfama.legalizacion.role.v1";

const SPANISH_MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function safeGet(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // quota / privacy errors no rompen el flujo
  }
}

function readDocuments(): DocumentRecord[] {
  const raw = safeGet(DOCUMENTS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as DocumentRecord[];
    } catch {
      // cae al seed inicial
    }
  }
  // Primer arranque: sembrar documentos demo.
  const seeded: DocumentRecord[] = SEED_DOCUMENTS.map((d) => ({
    id: generateId(),
    ...d,
  }));
  safeSet(DOCUMENTS_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeDocuments(records: DocumentRecord[]): void {
  safeSet(DOCUMENTS_KEY, JSON.stringify(records));
}

function readLegalizations(): Legalization[] {
  const raw = safeGet(LEGALIZATIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Legalization[];
  } catch {
    return [];
  }
  return [];
}

function writeLegalizations(list: Legalization[]): void {
  safeSet(LEGALIZATIONS_KEY, JSON.stringify(list));
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // cae al fallback
    }
  }
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // un listener que rompe no debe tumbar el resto
    }
  });
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentMonthLabel(now: Date = new Date()): string {
  const month = SPANISH_MONTHS[now.getMonth()] ?? "";
  return `${month} ${now.getFullYear()}`;
}

export function listDocuments(): DocumentRecord[] {
  return readDocuments()
    .slice()
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export function getDocument(id: string): DocumentRecord | undefined {
  return readDocuments().find((d) => d.id === id);
}

export interface AddDocumentInput {
  fileName: string;
  fileType: string;
  fileSize: number;
  role: Role;
  status?: DocumentStatus;
  ceco?: string;
  extracted?: ExtractedFields;
}

export function addDocument(input: AddDocumentInput): DocumentRecord {
  const record: DocumentRecord = {
    id: generateId(),
    fileName: input.fileName,
    fileType: input.fileType,
    fileSize: input.fileSize,
    status: input.status ?? "upload",
    role: input.role,
    uploadedAt: new Date().toISOString(),
    ceco: input.ceco,
    extracted: input.extracted,
  };
  const all = readDocuments();
  all.push(record);
  writeDocuments(all);
  notify();
  return record;
}

export interface UpdateDocumentPatch {
  status?: DocumentStatus;
  ceco?: string;
  extracted?: ExtractedFields;
  duplicateOf?: string[];
  duplicateReason?: DuplicateReason;
}

export function updateDocument(id: string, patch: UpdateDocumentPatch): DocumentRecord | undefined {
  const all = readDocuments();
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) return undefined;
  const current = all[idx];
  const next: DocumentRecord = {
    ...current,
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.ceco !== undefined ? { ceco: patch.ceco } : {}),
    ...(patch.extracted !== undefined ? { extracted: patch.extracted } : {}),
    ...(patch.duplicateOf !== undefined ? { duplicateOf: patch.duplicateOf } : {}),
    ...(patch.duplicateReason !== undefined ? { duplicateReason: patch.duplicateReason } : {}),
  };
  all[idx] = next;
  writeDocuments(all);
  notify();
  if (patch.extracted !== undefined) {
    recomputeAllDuplicates();
  }
  return next;
}

export function deleteDocument(id: string): void {
  const all = readDocuments().filter((d) => d.id !== id);
  writeDocuments(all);
  notify();
  recomputeAllDuplicates();
}

export function setDocumentCeco(id: string, ceco: string): DocumentRecord | undefined {
  const all = readDocuments();
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) return undefined;
  const next: DocumentRecord = { ...all[idx], ceco };
  all[idx] = next;
  writeDocuments(all);
  notify();
  return next;
}

export function getRole(): Role {
  const raw = safeGet(ROLE_KEY);
  if (raw === "conductor" || raw === "personal") return raw;
  return "personal";
}

export function setRole(role: Role): void {
  safeSet(ROLE_KEY, role);
  notify();
}

export function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/[^\d.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Tasa máxima permitida para la propina, expresada como fracción del total
 *  (incluye IVA). Configurable vía constante para futuro ajuste por política
 *  de la empresa. */
export const PROPINA_MAX_RATE = 0.1;

/** Tope absoluto de propina para un totalFactura dado (incluye IVA). */
export function propinaCap(totalFactura: string | number): number {
  const total = typeof totalFactura === "number" ? totalFactura : parseAmount(totalFactura);
  return total * PROPINA_MAX_RATE;
}

export interface PropinaValidation {
  /** Indica si la propina cumple con la regla del 10%. */
  isValid: boolean;
  /** Tope máximo permitido (mismo número, ya parseado). 0 si no hay total. */
  max: number;
  /** Monto de la propina parseado. 0 si está vacía o es inválida. */
  value: number;
  /** Mensaje listo para mostrar en `helperText` o en un toast. */
  message: string | null;
}

/**
 * Valida la propina contra el tope del 10% del total factura (IVA incluido).
 * Una propina vacía o "0" se considera válida (campo opcional). Cualquier valor
 * estrictamente mayor al tope produce `isValid: false`.
 */
export function validatePropina(
  propina: string | undefined,
  totalFactura: string | number,
): PropinaValidation {
  const value = parseAmount(propina);
  const max = propinaCap(totalFactura);
  if (!propina || value === 0) {
    return { isValid: true, max, value, message: null };
  }
  if (value > max) {
    const formatter = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
    return {
      isValid: false,
      max,
      value,
      message: `La propina no puede superar el 10% del total (${formatter.format(max)}).`,
    };
  }
  return { isValid: true, max, value, message: null };
}

export function listLegalizations(): Legalization[] {
  return readLegalizations()
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getLegalization(id: string): Legalization | undefined {
  return readLegalizations().find((l) => l.id === id);
}

export function getOrCreateDraftLegalization(): Legalization {
  const all = readLegalizations();
  const existingDraft = all.find((l) => l.status === "draft");
  if (existingDraft) return existingDraft;
  const next: Legalization = {
    id: generateId(),
    period: currentMonthLabel(),
    status: "draft",
    expenseIds: [],
    createdAt: new Date().toISOString(),
  };
  writeLegalizations([...all, next]);
  notify();
  return next;
}

export function getActiveLegalization(): Legalization | undefined {
  const all = readLegalizations();
  const draft = all.find((l) => l.status === "draft");
  if (draft) return draft;
  const submittedSorted = all
    .filter((l) => l.status === "submitted")
    .sort((a, b) => {
      const ta = a.submittedAt
        ? new Date(a.submittedAt).getTime()
        : new Date(a.createdAt).getTime();
      const tb = b.submittedAt
        ? new Date(b.submittedAt).getTime()
        : new Date(b.createdAt).getTime();
      return tb - ta;
    });
  if (submittedSorted.length > 0) return submittedSorted[0];
  const docs = readDocuments();
  if (docs.length > 0) {
    const migrated: Legalization = {
      id: generateId(),
      period: currentMonthLabel(),
      status: "draft",
      expenseIds: docs.map((d) => d.id),
      createdAt: new Date().toISOString(),
    };
    writeLegalizations([...all, migrated]);
    notify();
    return migrated;
  }
  return undefined;
}

export function addExpenseToLegalization(
  legalizationId: string,
  docId: string,
): Legalization | undefined {
  const all = readLegalizations();
  const idx = all.findIndex((l) => l.id === legalizationId);
  if (idx === -1) return undefined;
  const current = all[idx];
  if (current.status !== "draft") return current;
  if (current.expenseIds.includes(docId)) return current;
  const next: Legalization = {
    ...current,
    expenseIds: [...current.expenseIds, docId],
  };
  all[idx] = next;
  writeLegalizations(all);
  notify();
  recomputeDuplicatesForLegalization(legalizationId);
  return next;
}

export function submitLegalization(id: string): Legalization | undefined {
  const all = readLegalizations();
  const idx = all.findIndex((l) => l.id === id);
  if (idx === -1) return undefined;
  const current = all[idx];
  if (current.status === "submitted") return current;
  if (current.expenseIds.length === 0) return undefined;
  const blocking = getBlockingDuplicates(id);
  if (blocking.length > 0) return undefined;
  const next: Legalization = {
    ...current,
    status: "submitted",
    submittedAt: new Date().toISOString(),
  };
  all[idx] = next;
  writeLegalizations(all);
  notify();
  return next;
}

export function getLegalizationTotal(id: string): number {
  const leg = getLegalization(id);
  if (!leg) return 0;
  let total = 0;
  for (const docId of leg.expenseIds) {
    const doc = getDocument(docId);
    if (doc) total += parseAmount(doc.extracted?.totalFactura);
  }
  return total;
}

export function findLegalizationContainingDoc(docId: string): Legalization | undefined {
  return listLegalizations().find((l) => l.expenseIds.includes(docId));
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Clave dedupe = `(nroFactura, nit)` normalizados. Null si falta alguno. */
export function duplicateKey(doc: DocumentRecord): string | null {
  const nro = doc.extracted?.nroFactura;
  const nit = doc.extracted?.nit;
  if (!nro || !nit) return null;
  const trimmedNro = nro.trim();
  const trimmedNit = nit.trim();
  if (!trimmedNro || !trimmedNit) return null;
  return `${normalizeKey(trimmedNro)}|${normalizeKey(trimmedNit)}`;
}

function bucketDocsByKey(docs: DocumentRecord[]): Map<string, string[]> {
  const buckets = new Map<string, string[]>();
  for (const doc of docs) {
    const key = duplicateKey(doc);
    if (!key) continue;
    const arr = buckets.get(key);
    if (arr) arr.push(doc.id);
    else buckets.set(key, [doc.id]);
  }
  return buckets;
}

function pairwiseDuplicates(buckets: Map<string, string[]>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const ids of buckets.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      const others = ids.filter((x) => x !== id);
      out.set(id, others);
    }
  }
  return out;
}

export function findDuplicatesWithinLegalization(legalizationId: string): Map<string, string[]> {
  const leg = getLegalization(legalizationId);
  if (!leg) return new Map();
  const docs: DocumentRecord[] = [];
  for (const id of leg.expenseIds) {
    const doc = getDocument(id);
    if (doc) docs.push(doc);
  }
  return pairwiseDuplicates(bucketDocsByKey(docs));
}

export function findDuplicatesAgainstHistory(legalizationId: string): Map<string, string[]> {
  const target = getLegalization(legalizationId);
  if (!target) return new Map();
  const targetDocs: DocumentRecord[] = [];
  for (const id of target.expenseIds) {
    const doc = getDocument(id);
    if (doc) targetDocs.push(doc);
  }
  if (targetDocs.length === 0) return new Map();
  const allSubmitted = listLegalizations().filter((l) => l.status === "submitted");
  const historyIds = new Set<string>();
  for (const l of allSubmitted) {
    for (const id of l.expenseIds) historyIds.add(id);
  }
  const historyDocs: DocumentRecord[] = [];
  for (const id of historyIds) {
    const doc = getDocument(id);
    if (doc) historyDocs.push(doc);
  }
  const historyBuckets = bucketDocsByKey(historyDocs);
  const out = new Map<string, string[]>();
  for (const doc of targetDocs) {
    const key = duplicateKey(doc);
    if (!key) continue;
    const match = historyBuckets.get(key);
    if (!match || match.length === 0) continue;
    const others = match.filter((id) => id !== doc.id);
    if (others.length > 0) out.set(doc.id, others);
  }
  return out;
}

export function getBlockingDuplicates(legalizationId: string): string[] {
  const within = findDuplicatesWithinLegalization(legalizationId);
  const history = findDuplicatesAgainstHistory(legalizationId);
  const out = new Set<string>();
  for (const id of within.keys()) out.add(id);
  for (const id of history.keys()) out.add(id);
  return Array.from(out);
}

function sameStringSet(a: string[] | undefined, b: string[] | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  const sa = aa.slice().sort();
  const sb = bb.slice().sort();
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

export function recomputeDuplicatesForLegalization(legalizationId: string): void {
  const leg = getLegalization(legalizationId);
  if (!leg) return;
  const within = findDuplicatesWithinLegalization(legalizationId);
  const history = findDuplicatesAgainstHistory(legalizationId);
  const all = readDocuments();
  let changed = false;
  for (const id of leg.expenseIds) {
    const idx = all.findIndex((d) => d.id === id);
    if (idx === -1) continue;
    const doc = all[idx];
    const w = within.get(id) ?? [];
    const h = history.get(id) ?? [];
    let duplicateOf: string[] = [];
    let reason: DuplicateReason | undefined;
    if (w.length > 0) {
      duplicateOf = Array.from(new Set([...w, ...h]));
      reason = "same-legalization";
    } else if (h.length > 0) {
      duplicateOf = h;
      reason = "history";
    } else {
      const key = duplicateKey(doc);
      if (!key) reason = "indeterminate";
    }
    const wantOf = duplicateOf.length > 0 ? duplicateOf : undefined;
    const wantReason = duplicateOf.length > 0 ? reason : reason;
    if (
      !sameStringSet(doc.duplicateOf, wantOf) ||
      (doc.duplicateReason ?? undefined) !== wantReason
    ) {
      all[idx] = { ...doc, duplicateOf: wantOf, duplicateReason: wantReason };
      changed = true;
    }
  }
  if (changed) {
    writeDocuments(all);
    notify();
  }
}

export function recomputeAllDuplicates(): void {
  for (const l of listLegalizations()) {
    recomputeDuplicatesForLegalization(l.id);
  }
}
