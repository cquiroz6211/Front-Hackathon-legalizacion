/**
 * Arma el payload de `/contabilizacion` (SAP · Contabilización de Legados FI)
 * a partir de un `DocumentRecord` ya aprobado por el Gestor SAP.
 *
 * Reglas de negocio (definidas por el equipo, no derivables del código):
 * - Persona Natural (PN) vs Jurídica (PJ): lo determina el flujo de carga.
 *   `purpose === "collection-account"` (RUT + Cuenta de cobro) → PN, el titular
 *   es una persona natural. `purpose === "invoice"` → PJ, el proveedor es una
 *   razón social.
 * - `cuenta_contable` depende de `expenseCategory` (selector en Upload).
 * - `indicador_iva`: los gastos de viaje se tratan siempre como "Servicio"
 *   (no "Compras"), según definición del negocio.
 * - Multi-impuesto: una factura puede traer varios impuestos a la vez (p.ej.
 *   alojamiento con IVA 19% + INC 8%). Siempre se traen TODOS los impuestos
 *   presentes, sin importar la cuenta mayor: se genera una posición de
 *   `ctas_de_mayor` por cada impuesto con base/valor > 0 (misma
 *   `cuenta_contable` de la categoría en todas), cada una con su propia base
 *   e `indicador_iva`. Si no hay ningún impuesto, se manda una sola posición
 *   exenta (V0) por el total.
 * - Campos fijos (`sociedad`, `clase_documento`, `condicion_pago`,
 *   `cuenta_divergente`, `bloqueo_pago`, `via_pago`, `region`, `pais`) vienen
 *   de un único ejemplo de referencia de SAP; ajustar si SAP define variantes.
 */
import type { DocumentRecord, ExpenseCategory, Legalization } from "../types/document";
import { parseAmount } from "./store";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  alimentacion: "Alimentación",
  alojamiento: "Alojamiento",
  otros: "Otros",
};

/** `cuenta_contable` de `ctas_de_mayor` según la categoría de gasto. */
const EXPENSE_CATEGORY_ACCOUNTS: Record<ExpenseCategory, string> = {
  alimentacion: "5155051500",
  alojamiento: "5155050500",
  otros: "5155950500",
};

const SOCIEDAD = "CF01";
const CLASE_DOCUMENTO = "Z4";
const CONDICION_PAGO = "A001";
const CUENTA_DIVERGENTE = "2335059707";
const REGION = "05";
/** Fija: la clase de documento Z4 exige "Referencia" no vacía (ver ADR 0001). */
const REFERENCIA_CABECERA = "12305100-024VL";

/** `YYYY-MM-DD` (u otro ISO) -> `DD.MM.YYYY`, formato que espera SAP. */
function formatSapDate(iso: string | undefined, fallback: Date = new Date()): string {
  const source = iso && iso.trim() ? iso : fallback.toISOString();
  const datePart = source.slice(0, 10);
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(fallback.getDate())}.${pad(fallback.getMonth() + 1)}.${fallback.getFullYear()}`;
  }
  return `${d}.${m}.${y}`;
}

/** Separa un nombre completo en nombres/apellidos (mitad/mitad) para PN. */
function splitPersonName(fullName: string): { name3: string; name4: string } {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const mid = Math.ceil(words.length / 2);
  return {
    name3: words.slice(0, mid).join(","),
    name4: words.slice(mid).join(","),
  };
}

/**
 * Dígito de verificación del NIT (algoritmo módulo 11 de la DIAN). SAP
 * rechaza el acreedor si el NIT de una persona jurídica llega sin su dígito
 * (ej. "900064236" -> error "no existe"; debe ir "900064236-0").
 */
function nitCheckDigit(nit: string): number {
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const digits = nit.split("").reverse();
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (weights[i] ?? 0);
  }
  const remainder = sum % 11;
  return remainder > 1 ? 11 - remainder : remainder;
}

/**
 * NIT formateado para SAP: persona jurídica (PJ) va con dígito de
 * verificación concatenado, sin guion ("9000642360"); persona natural
 * (cédula) no tiene DV y va tal cual.
 */
function formatNitForSap(rawNit: string, isPersonaNatural: boolean): string {
  const digitsOnly = rawNit.replace(/\D/g, "");
  if (!digitsOnly || isPersonaNatural) return rawNit;
  return `${digitsOnly}${nitCheckDigit(digitsOnly)}`;
}

interface TaxLine {
  /**
   * Importe de la posición: el TOTAL del concepto (base + su impuesto), no
   * solo la base. SAP no calcula el impuesto automáticamente sobre la base al
   * contabilizar (`clave_contabilizacion` "40"): si se manda solo la base, el
   * documento queda descuadrado exactamente por el valor del impuesto
   * ("Interfase RW: Saldo en moneda de transacción"). Confirmado en QA.
   */
  importe: number;
  /** Código de indicador de IVA (siempre "Servicio", ver reglas del módulo). */
  indicador: string;
}

/**
 * Impuestos presentes en la factura (Servicio, no Compras): IVA 19% ("MM"),
 * INC 8% ("QE") y exento ("V0"). Una factura puede traer varios a la vez
 * (p.ej. alojamiento con IVA 19% + INC 8%) — se incluyen TODOS los que tengan
 * base o valor > 0, sin importar la cuenta mayor. Si no hay ninguno, se cae a
 * una sola línea exenta por el total de la factura.
 */
function buildTaxLines(doc: DocumentRecord): TaxLine[] {
  const extracted = doc.extracted;
  const lines: TaxLine[] = [];

  const iva19Base = parseAmount(extracted?.iva19Base);
  const iva19Valor = parseAmount(extracted?.iva19Valor);
  if (iva19Base > 0 || iva19Valor > 0) {
    lines.push({ importe: iva19Base + iva19Valor, indicador: "MM" });
  }

  // Campo `iva5*` = INC (Impuesto Nacional al Consumo) 8%, no IVA 5%.
  const inc8Base = parseAmount(extracted?.iva5Base);
  const inc8Valor = parseAmount(extracted?.iva5Valor);
  if (inc8Base > 0 || inc8Valor > 0) {
    lines.push({ importe: inc8Base + inc8Valor, indicador: "QE" });
  }

  const exentoBase = parseAmount(extracted?.iva0Base);
  if (exentoBase > 0) {
    lines.push({ importe: exentoBase, indicador: "V0" });
  }

  if (lines.length === 0) {
    lines.push({ importe: parseAmount(extracted?.totalFactura), indicador: "V0" });
  }

  return lines;
}

export interface SapContabilizacionPayload {
  info_mensaje: { version: string };
  documentos: Array<{
    acreedores: Array<Record<string, unknown>>;
    cabecera: Record<string, unknown>;
    ctas_de_mayor: Array<Record<string, unknown>>;
    deudores: Array<Record<string, unknown>>;
    num_doc_externo: string;
  }>;
}

/** `num_doc_externo` único por documento, para poder consultarlo luego. */
export function buildNumDocExterno(doc: DocumentRecord): string {
  return `LEG-${doc.id}`;
}

/**
 * Arma el documento SAP (Contabilización de Legados FI) para un gasto
 * aprobado. `doc` debe ser un gasto contabilizable (`purpose` "invoice" o
 * "collection-account"), no el RUT de soporte.
 */
export function buildSapContabilizacionPayload(doc: DocumentRecord): SapContabilizacionPayload {
  const isPersonaNatural = doc.purpose === "collection-account";
  const extracted = doc.extracted;
  const nit = formatNitForSap((extracted?.nit ?? "").trim(), isPersonaNatural);
  const nombre = (extracted?.proveedor ?? "").trim();
  const totalFactura = String(Math.round(parseAmount(extracted?.totalFactura)));
  const ceco = doc.ceco ?? "";
  const category = doc.expenseCategory ?? "otros";
  const now = new Date();
  const fechaContabilizacion = formatSapDate(undefined, now);
  const fechaDocumento = formatSapDate(extracted?.fecha, now);

  const { name3, name4 } = isPersonaNatural ? splitPersonName(nombre) : { name3: "", name4: "" };

  // Una posición de ctas_de_mayor por impuesto presente; el acreedor toma el
  // siguiente número de posición en la misma secuencia.
  const taxLines = buildTaxLines(doc);
  const acreedorPosicion = String(taxLines.length + 1).padStart(3, "0");

  const acreedorEsporadico = {
    calle: "",
    clase_impuesto: isPersonaNatural ? "PN" : "",
    clave_bco: "",
    control_banco: "",
    cuenta_bancaria: "",
    n_identificacion: nit,
    name1: nombre,
    name2: "",
    name3,
    name4,
    pais: "CO",
    pais_bco: "",
    persona_fisica: isPersonaNatural ? "X" : "",
    poblacion: "",
    region: REGION,
    tipo_nif: isPersonaNatural ? "C" : "N",
  };

  const adicAcreedores = [
    { clave: "numero_id", valor: nit },
    { clave: "tipo_id", valor: isPersonaNatural ? "CO1C" : "CO1N" },
    { clave: "nombre_id", valor: nombre },
    { clave: "adicional_1", valor: "" },
    { clave: "adicional_2", valor: "" },
    { clave: "adicional_3", valor: "" },
  ];

  const acreedor = {
    acreedor_esporadico: acreedorEsporadico,
    adic_acreedores: adicAcreedores,
    asignacion: nit,
    bloqueo_pago: "G",
    centro_beneficio: ceco,
    centro_costo: "",
    clave_contabilizacion: "31",
    condicion_pago: CONDICION_PAGO,
    cuenta_contable: "",
    cuenta_divergente: CUENTA_DIVERGENTE,
    fecha_base: fechaContabilizacion,
    fecha_valor: "",
    importes_acreedores: { importe_moneda_documento: totalFactura },
    indicador_cme: "",
    indicador_iva: "",
    numero_posicion: acreedorPosicion,
    orden_interna: "",
    referencia_1: nit,
    referencia_2: "",
    referencia_3: nombre,
    texto_posicion: nombre,
    via_pago: "T",
  };

  const cabecera = {
    clase_documento: CLASE_DOCUMENTO,
    ejercicio_contable: "",
    fecha_contabilizacion: fechaContabilizacion,
    fecha_documento: fechaDocumento,
    moneda_documento: "COP",
    periodo_contable: "",
    referencia: REFERENCIA_CABECERA,
    sociedad: SOCIEDAD,
    tasa_cambio: "",
    texto_cabecera: `Gastos Viaje ${EXPENSE_CATEGORY_LABELS[category]}`,
  };

  const ctasMayor = taxLines.map((tax, idx) => ({
    adic_ctas_de_mayor: [{ clave: "", valor: "" }],
    asignacion: nit,
    bloqueo_pago: "",
    centro_beneficio: "",
    centro_costo: ceco,
    clave_contabilizacion: "40",
    condicion_pago: "",
    cuenta_contable: EXPENSE_CATEGORY_ACCOUNTS[category],
    cuenta_divergente: "",
    fecha_base: "",
    fecha_valor: "",
    importes_ctas_de_mayor: { importe_moneda_documento: String(Math.round(tax.importe)) },
    indicador_cme: "",
    indicador_iva: tax.indicador,
    numero_posicion: String(idx + 1).padStart(3, "0"),
    orden_interna: "",
    referencia_1: nit,
    referencia_2: "",
    referencia_3: nombre,
    texto_posicion: nombre,
    via_pago: "",
  }));

  const deudor = {
    adic_deudores: [{ clave: "", valor: "" }],
    asignacion: "",
    bloqueo_pago: "",
    centro_beneficio: "",
    centro_costo: "",
    clave_contabilizacion: "",
    condicion_pago: "",
    cuenta_contable: "",
    cuenta_divergente: "",
    fecha_base: "",
    fecha_valor: "",
    importes_deudores: { importe_moneda_documento: "" },
    indicador_cme: "",
    indicador_iva: "",
    numero_posicion: "",
    orden_interna: "",
    referencia_1: "",
    referencia_2: "",
    referencia_3: "",
    texto_posicion: "",
    via_pago: "",
  };

  return {
    info_mensaje: { version: "1.0" },
    documentos: [
      {
        acreedores: [acreedor],
        cabecera,
        ctas_de_mayor: ctasMayor,
        deudores: [deudor],
        num_doc_externo: buildNumDocExterno(doc),
      },
    ],
  };
}

/** Gastos contabilizables de una legalización (excluye el RUT de soporte). */
export function getSapEligibleDocuments(
  legalization: Legalization,
  getDocument: (id: string) => DocumentRecord | undefined,
): DocumentRecord[] {
  const docs: DocumentRecord[] = [];
  for (const id of legalization.expenseIds) {
    const doc = getDocument(id);
    if (doc && (doc.purpose === "invoice" || doc.purpose === "collection-account")) {
      docs.push(doc);
    }
  }
  return docs;
}
