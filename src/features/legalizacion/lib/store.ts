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
  DocumentPurpose,
  DocumentStatus,
  DuplicateReason,
  ExtractedFields,
  Legalization,
  Role,
} from "../types/document";

const DOCUMENTS_KEY = "comfama.legalizacion.documents.v1";
const LEGALIZATIONS_KEY = "comfama.legalizacion.legalizations.v1";
const ROLE_KEY = "comfama.legalizacion.role.v1";

/**
 * Anticipo demo sembrado por defecto al crear una legalización nueva.
 * En producción vendría del backend (definido por RRHH/finanzas por periodo).
 * Valor representativo para que la diferencia frente a los gastos de seed sea
 * visible en el demo.
 */
const DEFAULT_ANTICIPO = 1_500_000;

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
    if (Array.isArray(parsed)) {
      return (parsed as Legalization[]).map((l) =>
        typeof l.anticipo === "number" && Number.isFinite(l.anticipo)
          ? l
          : { ...l, anticipo: DEFAULT_ANTICIPO },
      );
    }
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
  purpose?: DocumentPurpose;
  relatedDocumentId?: string;
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
    purpose: input.purpose,
    relatedDocumentId: input.relatedDocumentId,
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
  relatedDocumentId?: string;
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
    ...(patch.relatedDocumentId !== undefined
      ? { relatedDocumentId: patch.relatedDocumentId }
      : {}),
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
    anticipo: DEFAULT_ANTICIPO,
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
      anticipo: DEFAULT_ANTICIPO,
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
  // HU-0011: canSubmitToGestorSap reúne duplicados, aprobación del líder
  // (exceso/tiempo) y el requisito de tener al menos un gasto.
  const { can } = canSubmitToGestorSap(id);
  if (!can) return undefined;
  const at = new Date().toISOString();
  const next: Legalization = {
    ...current,
    status: "submitted",
    submittedAt: at,
    auditLog: [
      ...(current.auditLog ?? []),
      {
        at,
        fromStatus: current.status,
        toStatus: "submitted",
        reason: "submit-to-gestor-sap",
        actor: "user",
      },
    ],
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

/** Anticipo en COP del periodo de legalización (default DEFAULT_ANTICIPO). */
export function getLegalizationAnticipo(id: string): number {
  const leg = getLegalization(id);
  return leg?.anticipo ?? DEFAULT_ANTICIPO;
}

/**
 * Diferencia = anticipo - gastos justificados. Positiva → saldo a favor del
 * anticipo (por devolver). Negativa → la empresa debe reembolsar.
 */
export function getLegalizationDiferencia(id: string): number {
  return getLegalizationAnticipo(id) - getLegalizationTotal(id);
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

/* ───────────────────────────────────────────────────────────────────────────
 * HU-0010 — Historial de gastos con filtro por fecha
 *
 * Decisiones de modelo (documentadas junto al código):
 * - "Fecha de registro" = `submittedAt` si la legalización fue enviada; si no,
 *   `createdAt` (cuando se creó el borrador).
 * - "Fecha de consumo" = la `extracted.fecha` más temprana entre los documentos
 *   de la legalización. El modelo NO tiene un campo explícito de consumo, así
 *   que la fecha de emisión de la factura más antigua es el proxy. Si la
 *   legalización no tiene documentos con fecha → null, y queda fuera de
 *   cualquier filtro por consumo.
 * - Helpers de SOLO LECTURA: no mutan la forma persistida en localStorage.
 * ─────────────────────────────────────────────────────────────────────────── */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Normaliza un valor de fecha a su parte `yyyy-mm-dd`. Null si es inválida. */
function toDateOnly(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const part = raw.slice(0, 10);
  return DATE_ONLY_PATTERN.test(part) ? part : null;
}

/**
 * Fecha de consumo (proxy HU-0010): la `extracted.fecha` más temprana entre los
 * documentos de la legalización, en `yyyy-mm-dd`. Null si no hay documentos con
 * fecha válida (queda fuera del filtro por consumo).
 */
export function getLegalizationConsumoDate(id: string): string | null {
  const leg = getLegalization(id);
  if (!leg) return null;
  let earliest: string | null = null;
  for (const docId of leg.expenseIds) {
    const raw = getDocument(docId)?.extracted?.fecha;
    const dateOnly = toDateOnly(raw);
    if (!dateOnly) continue;
    if (earliest === null || dateOnly < earliest) earliest = dateOnly;
  }
  return earliest;
}

/**
 * Fecha de registro (HU-0010): `submittedAt ?? createdAt`, en `yyyy-mm-dd`.
 * El borrador no tiene `submittedAt`, así que usa `createdAt`.
 */
export function getLegalizationRegistroDate(id: string): string {
  const leg = getLegalization(id);
  const iso = leg?.submittedAt ?? leg?.createdAt;
  return toDateOnly(iso) ?? new Date().toISOString().slice(0, 10);
}

export interface DateRangeFilter {
  /** Inicio del rango inclusive, `yyyy-mm-dd`. */
  from?: string;
  /** Fin del rango inclusive, `yyyy-mm-dd`. */
  to?: string;
}

export interface LegalizationDateFilters {
  /** Rango de fechas de consumo. */
  consumo?: DateRangeFilter;
  /** Rango de fechas de registro. */
  registro?: DateRangeFilter;
}

/**
 * Filtra legalizaciones por rangos de fecha (HU-0010). Rangos inclusivos en
 * ambos extremos; `from` y `to` son opcionales de forma independiente. El
 * filtro de consumo excluye cualquier legalización sin fecha de consumo (null).
 * Ambos filtros se combinan con AND. No muta la entrada.
 */
export function filterLegalizationsByDateRange(
  items: Legalization[],
  filters: LegalizationDateFilters,
): Legalization[] {
  const consumo = filters.consumo;
  const registro = filters.registro;
  const hasConsumo = Boolean(consumo?.from || consumo?.to);
  const hasRegistro = Boolean(registro?.from || registro?.to);
  if (!hasConsumo && !hasRegistro) return items.slice();

  const cFrom = consumo?.from;
  const cTo = consumo?.to;
  const rFrom = registro?.from;
  const rTo = registro?.to;

  return items.filter((leg) => {
    if (hasConsumo) {
      const consumoDate = getLegalizationConsumoDate(leg.id);
      if (consumoDate === null) return false;
      if (cFrom && consumoDate < cFrom) return false;
      if (cTo && consumoDate > cTo) return false;
    }
    if (hasRegistro) {
      const registroDate = getLegalizationRegistroDate(leg.id);
      if (rFrom && registroDate < rFrom) return false;
      if (rTo && registroDate > rTo) return false;
    }
    return true;
  });
}

/* ───────────────────────────────────────────────────────────────────────────
 * HU-0008 / HU-0009 / HU-0011 — límite de consumo, control de tiempo y
 * flujo a Gestor SAP con aprobación del líder (SIMULADA, sin backend).
 *
 * Decisiones de modelo (documentadas junto al código):
 * - El "líder" es un flag local: `leaderApproval` + un evento en `auditLog`.
 *   No existe rol líder ni endpoint; es una simulación para el hackatón.
 * - HU-0008: tope ÚNICO GLOBAL por factura (`CONSUMPTION_LIMIT`). Si el
 *   `totalFactura` de un documento lo supera → exceso → requiere aprobación.
 *   El guardado (draft) NUNCA se bloquea; solo el envío al Gestor SAP.
 * - HU-0009: días hábiles = Lunes a Viernes (sin sábados, domingos ni
 *   festivos). Fecha de consumo = `getLegalizationConsumoDate` (proxy existente).
 *   > 5 días hábiles → fuera de tiempo → requiere aprobación.
 * - HU-0011: reutilizamos el estado `submitted` como equivalente a
 *   "En revisión Gestor SAP" para no romper datos legacy; el label en UI refleja
 *   ese significado.
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Tope ÚNICO GLOBAL de consumo por factura (HU-0008), en COP. Si el
 * `totalFactura` de un documento supera este valor, la legalización queda con
 * exceso y requiere aprobación del líder. Configurable: ajustar este valor para
 * cambiar la política (en el futuro, leerlo del backend).
 */
export const CONSUMPTION_LIMIT = 500_000;

/** Días hábiles máximos para legalizar sin incumplimiento (HU-0009). */
export const LEGALIZATION_MAX_BUSINESS_DAYS = 5;

export interface LegalizationExcess {
  hasExcess: boolean;
  exceededDocIds: string[];
  totalExcess: number;
}

/**
 * Recorre los gastos de la legalización comparando `parseAmount(totalFactura)`
 * con `CONSUMPTION_LIMIT` (tope por factura, HU-0008). `totalExcess` acumula la
 * suma de los montos excedidos (amount - tope) solo de los documentos excedidos.
 */
export function getLegalizationExcess(id: string): LegalizationExcess {
  const leg = getLegalization(id);
  if (!leg) return { hasExcess: false, exceededDocIds: [], totalExcess: 0 };
  const exceededDocIds: string[] = [];
  let totalExcess = 0;
  for (const docId of leg.expenseIds) {
    const doc = getDocument(docId);
    if (!doc) continue;
    const amount = parseAmount(doc.extracted?.totalFactura);
    if (amount > CONSUMPTION_LIMIT) {
      exceededDocIds.push(docId);
      totalExcess += amount - CONSUMPTION_LIMIT;
    }
  }
  return {
    hasExcess: exceededDocIds.length > 0,
    exceededDocIds,
    totalExcess,
  };
}

/** Convierte un `Date` a `yyyy-mm-dd` en hora local (sin offset de zona). */
function toLocalDateOnlyISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Cuenta días hábiles (Lunes a Viernes) entre dos fechas (HU-0009).
 * Convención: rango [from, to) — incluye `from` y excluye `to`. Se excluyen
 * Sábado (6) y Domingo (0); no se consideran festivos. Devuelve 0 si alguna
 * fecha es inválida o si `to` <= `from`.
 */
export function businessDaysBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00`);
  const to = new Date(`${toISO}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  if (to.getTime() <= from.getTime()) return 0;
  let count = 0;
  const cursor = new Date(from);
  while (cursor.getTime() < to.getTime()) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export interface LegalizationTimeStatus {
  outOfTime: boolean;
  daysElapsed: number;
  consumoDate: string | null;
}

/**
 * Días hábiles transcurridos desde la fecha de consumo (proxy =
 * `getLegalizationConsumoDate`) hasta `now` (HU-0009). `outOfTime` cuando
 * `daysElapsed` supera `LEGALIZATION_MAX_BUSINESS_DAYS`. Sin fecha de consumo →
 * no hay incumplimiento detectable ({ outOfTime: false, daysElapsed: 0 }).
 */
export function getLegalizationTimeStatus(
  id: string,
  now: Date = new Date(),
): LegalizationTimeStatus {
  const consumoDate = getLegalizationConsumoDate(id);
  if (!consumoDate) return { outOfTime: false, daysElapsed: 0, consumoDate: null };
  const daysElapsed = businessDaysBetween(consumoDate, toLocalDateOnlyISO(now));
  return {
    outOfTime: daysElapsed > LEGALIZATION_MAX_BUSINESS_DAYS,
    daysElapsed,
    consumoDate,
  };
}

export interface LeaderApprovalRequirement {
  excess: boolean;
  time: boolean;
  any: boolean;
}

/**
 * Combina los motivos que requieren aprobación del líder (HU-0008 exceso +
 * HU-0009 tiempo). `any` = excess || time. `now` se propaga para tests
 * deterministas; por defecto usa la fecha actual.
 */
export function requiresLeaderApproval(
  id: string,
  now: Date = new Date(),
): LeaderApprovalRequirement {
  const excess = getLegalizationExcess(id).hasExcess;
  const time = getLegalizationTimeStatus(id, now).outOfTime;
  return { excess, time, any: excess || time };
}

/**
 * ¿La aprobación del líder cubre todos los motivos requeridos? Si no se
 * requiere ningún motivo → no hay nada pendiente (true). Si se requiere y no
 * existe `leaderApproval`, o no cubre algún motivo requerido → false.
 */
export function isLeaderApproved(id: string, now: Date = new Date()): boolean {
  const req = requiresLeaderApproval(id, now);
  if (!req.any) return true;
  const leg = getLegalization(id);
  const approval = leg?.leaderApproval;
  if (!approval) return false;
  if (req.excess && !approval.excess) return false;
  if (req.time && !approval.time) return false;
  return true;
}

/**
 * Simula la aprobación del líder (no hay backend ni rol líder): fija
 * `leaderApproval` con los motivos que requería en el momento, timestamp y
 * registra un evento de auditoría. Llama a `notify()`.
 */
export function approveByLeader(id: string): Legalization | undefined {
  const all = readLegalizations();
  const idx = all.findIndex((l) => l.id === id);
  if (idx === -1) return undefined;
  const current = all[idx];
  const req = requiresLeaderApproval(id);
  const at = new Date().toISOString();
  const motives: string[] = [];
  if (req.excess) motives.push("excess");
  if (req.time) motives.push("time");
  const reason =
    motives.length > 0 ? `leader-approval:${motives.join(",")}` : "leader-approval";
  const next: Legalization = {
    ...current,
    leaderApproval: { approvedAt: at, excess: req.excess, time: req.time },
    auditLog: [
      ...(current.auditLog ?? []),
      { at, fromStatus: current.status, toStatus: current.status, reason, actor: "leader" },
    ],
  };
  all[idx] = next;
  writeLegalizations(all);
  notify();
  return next;
}

export interface SubmitToGestorSapResult {
  can: boolean;
  blockers: string[];
}

/**
 * ¿Se puede enviar al Gestor SAP (HU-0011)? Bloqueadores: duplicados,
 * aprobación del líder pendiente por exceso y aprobación del líder pendiente por
 * tiempo. `can` = sin bloqueadores Y con al menos un gasto. `now` opcional para
 * tests deterministas.
 */
export function canSubmitToGestorSap(
  id: string,
  now: Date = new Date(),
): SubmitToGestorSapResult {
  const blockers: string[] = [];
  const leg = getLegalization(id);
  if (getBlockingDuplicates(id).length > 0) blockers.push("duplicates");
  const req = requiresLeaderApproval(id, now);
  if (req.any && !isLeaderApproved(id, now)) {
    if (req.excess) blockers.push("leader-approval:excess");
    if (req.time) blockers.push("leader-approval:time");
  }
  const can = blockers.length === 0 && (leg?.expenseIds.length ?? 0) > 0;
  return { can, blockers };
}
