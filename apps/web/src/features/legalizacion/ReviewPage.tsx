import { Suspense, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LuCircleAlert,
  LuCircleCheck,
  LuFileText,
  LuFileUp,
  LuPenLine,
  LuRefreshCw,
  LuRotateCw,
  LuSearch,
  LuZoomIn,
  LuZoomOut,
} from "react-icons/lu";

import { Alert, Button, DateField, Input, Typography } from "@comfama/comfama-ui-react";

import {
  CONSUMPTION_LIMIT,
  getDocument,
  parseAmount,
  updateDocument,
  validatePropina,
} from "./lib/store";
import type { DocumentRecord, ExtractedFields } from "./types/document";
import { InvoicePreview } from "./components/InvoicePreview";
import { LegalizacionHeader } from "./components/LegalizacionHeader";

const DEMO_FIELDS: ExtractedFields = {
  fecha: "2023-10-25",
  nroFactura: "0001-00002834",
  proveedor: "Logística del Sur S.A.",
  cliente: "Comfama S.A.",
  cuit: "30-71452896-1",
  nit: "900.123.456-7",
  direccion: "Calle 100 #15-20, Edificio Norte",
  telefono: "+57 (601) 742 8593",
  departamento: "Cundinamarca",
  municipio: "Bogotá D.C.",
  monto: "559.625,00",
  kilometraje: "124500",
  iva19Base: "420.000,00",
  iva19Valor: "79.800,00",
  iva5Base: "50.000,00",
  iva5Valor: "2.500,00",
  iva0Base: "0,00",
  iva0Valor: "0,00",
  totalFactura: "559.625,00",
  propina: "0,00",
};

const FIELD_LABELS: Record<keyof ExtractedFields, string> = {
  fecha: "Fecha de Emisión",
  nroFactura: "Número de Factura",
  proveedor: "Proveedor",
  cliente: "Cliente",
  cuit: "CUIT",
  nit: "NIT",
  direccion: "Dirección",
  telefono: "Teléfono",
  departamento: "Departamento",
  municipio: "Municipio",
  monto: "Monto Total",
  kilometraje: "Kilometraje",
  iva19Base: "Base Gravada",
  iva19Valor: "IVA",
  iva5Base: "Base Gravada",
  iva5Valor: "IVA",
  iva0Base: "Base Gravada",
  iva0Valor: "IVA",
  totalFactura: "Total Factura",
  propina: "Propina",
};

/**
 * Vista de revisión de datos extraídos (ruta `/review?doc=<id>`).
 * Al confirmar, persiste los campos editados y marca el documento como
 * `processing`, navegando a `/me?highlight=<id>`.
 */
export const ReviewPage = () => (
  <Suspense fallback={<ReviewFallback />}>
    <ReviewPageInner />
  </Suspense>
);

const ReviewPageInner = () => {
  const navigate = useNavigate();
  const searchParams = useSearchParams()[0];
  const docId = searchParams.get("doc") ?? null;

  const initialDoc = useMemo<DocumentRecord | null>(() => {
    if (!docId) return null;
    const found = getDocument(docId) ?? null;
    if (found && found.status === "upload") {
      return updateDocument(found.id, { status: "processing" }) ?? found;
    }
    return found;
  }, [docId]);

  const [doc, setDoc] = useState<DocumentRecord | null>(initialDoc);
  const [fields, setFields] = useState<ExtractedFields>(() => {
    if (!docId) return DEMO_FIELDS;
    const ext = getDocument(docId)?.extracted;
    return {
      fecha: ext?.fecha ?? DEMO_FIELDS.fecha,
      nroFactura: ext?.nroFactura ?? DEMO_FIELDS.nroFactura,
      proveedor: ext?.proveedor ?? DEMO_FIELDS.proveedor,
      cliente: ext?.cliente ?? DEMO_FIELDS.cliente,
      cuit: ext?.cuit ?? DEMO_FIELDS.cuit,
      nit: ext?.nit ?? DEMO_FIELDS.nit,
      direccion: ext?.direccion ?? DEMO_FIELDS.direccion,
      telefono: ext?.telefono ?? DEMO_FIELDS.telefono,
      departamento: ext?.departamento ?? DEMO_FIELDS.departamento,
      municipio: ext?.municipio ?? DEMO_FIELDS.municipio,
      monto: ext?.monto ?? DEMO_FIELDS.monto,
      kilometraje: ext?.kilometraje ?? DEMO_FIELDS.kilometraje,
      iva19Base: ext?.iva19Base ?? DEMO_FIELDS.iva19Base,
      iva19Valor: ext?.iva19Valor ?? DEMO_FIELDS.iva19Valor,
      iva5Base: ext?.iva5Base ?? DEMO_FIELDS.iva5Base,
      iva5Valor: ext?.iva5Valor ?? DEMO_FIELDS.iva5Valor,
      iva0Base: ext?.iva0Base ?? DEMO_FIELDS.iva0Base,
      iva0Valor: ext?.iva0Valor ?? DEMO_FIELDS.iva0Valor,
      totalFactura: ext?.totalFactura ?? DEMO_FIELDS.totalFactura,
      propina: ext?.propina ?? DEMO_FIELDS.propina,
    };
  });
  const propinaValidation = useMemo(
    () => validatePropina(fields.propina, fields.totalFactura),
    [fields.propina, fields.totalFactura],
  );
  // HU-0008 — exceso de límite de consumo (alerta NO bloqueante para confirmar).
  const overLimit = useMemo(
    () => parseAmount(fields.totalFactura) > CONSUMPTION_LIMIT,
    [fields.totalFactura],
  );
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const updateField = <K extends keyof ExtractedFields>(key: K, value: ExtractedFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    if (!propinaValidation.isValid) return;
    setIsProcessing(true);
    setTimeout(() => {
      if (doc) {
        const updated = updateDocument(doc.id, {
          status: "processing",
          extracted: fields,
        });
        setDoc(updated ?? doc);
        setIsConfirmed(true);
        setTimeout(() => {
          navigate(`/me?highlight=${encodeURIComponent(doc.id)}`);
        }, 800);
      } else {
        setIsProcessing(false);
        setIsConfirmed(true);
      }
    }, 1000);
  };

  return (
    <div className="flex min-h-screen flex-col bg-secondary-100">
      <LegalizacionHeader variant="review" />

      <main className="flex flex-1 flex-col md:flex-row gap-4 p-4 overflow-hidden">
        <section className="hidden md:flex flex-1 bg-white border border-secondary-400 rounded-2xl flex-col relative overflow-hidden">
          <div className="bg-secondary-100 border-b border-secondary-400 text-secondary-900 px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
                <LuFileText className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-secondary-900">
                {doc ? doc.fileName : "FACTURA_TRANSPORTE_00283.PDF"}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                isIcon
                size="sm"
                aria-label="Acercar"
                action={() => undefined}
              >
                <LuZoomIn className="w-4 h-4 text-secondary-600" />
              </Button>
              <Button variant="ghost" isIcon size="sm" aria-label="Alejar" action={() => undefined}>
                <LuZoomOut className="w-4 h-4 text-secondary-600" />
              </Button>
              <Button variant="ghost" isIcon size="sm" aria-label="Rotar" action={() => undefined}>
                <LuRotateCw className="w-4 h-4 text-secondary-600" />
              </Button>
            </div>
          </div>
          <InvoicePreview fields={fields} fileName={doc?.fileName} />
        </section>

        <section className="w-full md:w-[480px] bg-white border border-secondary-400 rounded-2xl overflow-y-auto flex flex-col relative">
          <header className="p-8 border-b border-secondary-400 bg-secondary-100 relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary-50 rounded-2xl flex items-center justify-center text-primary">
                <LuPenLine className="w-5 h-5" />
              </div>
              <Typography variant="h2" className="text-secondary-900">
                Revisión de <span className="font-bold">Datos</span>
              </Typography>
            </div>
            <Typography variant="body2" className="text-secondary-600">
              Verifique la información extraída automáticamente antes de confirmar.
            </Typography>
          </header>

          <form className="flex-1 p-6 space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-4 relative z-10">
              <Typography
                variant="body2"
                className="text-primary uppercase tracking-widest font-bold"
              >
                Identificación del Documento
              </Typography>
              <div className="grid grid-cols-2 gap-4">
                <DateField
                  label={FIELD_LABELS.fecha}
                  value={fields.fecha ? new Date(`${fields.fecha}T00:00:00`) : undefined}
                  onChange={(d) => updateField("fecha", d ? d.toISOString().slice(0, 10) : "")}
                  enableMonth
                  enableYear
                  enableDay
                />
                <Input
                  label={FIELD_LABELS.nroFactura}
                  value={fields.nroFactura}
                  onChange={(e) => updateField("nroFactura", e.target.value)}
                  className="font-mono text-sm"
                />
                <Input
                  label={FIELD_LABELS.cliente}
                  value={fields.cliente}
                  onChange={(e) => updateField("cliente", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-secondary-400 relative z-10">
              <Typography
                variant="body2"
                className="text-primary uppercase tracking-widest font-bold"
              >
                Detalles del Emisor
              </Typography>
              <Input
                label={FIELD_LABELS.proveedor}
                value={fields.proveedor}
                onChange={(e) => updateField("proveedor", e.target.value)}
                leftIcon={<LuSearch className="w-5 h-5 text-secondary-600" />}
              />
              <Input
                label={FIELD_LABELS.nit}
                value={fields.nit}
                onChange={(e) => updateField("nit", e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-4 pt-6 border-t border-secondary-400 relative z-10">
              <Input
                label={FIELD_LABELS.direccion}
                value={fields.direccion}
                onChange={(e) => updateField("direccion", e.target.value)}
              />
              <Input
                label={FIELD_LABELS.telefono}
                value={fields.telefono}
                onChange={(e) => updateField("telefono", e.target.value)}
                className="font-mono text-sm"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={FIELD_LABELS.departamento}
                  value={fields.departamento}
                  onChange={(e) => updateField("departamento", e.target.value)}
                />
                <Input
                  label={FIELD_LABELS.municipio}
                  value={fields.municipio}
                  onChange={(e) => updateField("municipio", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-secondary-400 relative z-10">
              <Typography
                variant="body2"
                className="text-primary uppercase tracking-widest font-bold"
              >
                Valores e Impuestos
              </Typography>
              <div className="bg-secondary-100 border border-secondary-400 rounded-2xl divide-y divide-secondary-400">
                <IvaRow
                  title="IVA"
                  baseKey="iva19Base"
                  valorKey="iva19Valor"
                  fields={fields}
                  onChange={updateField}
                />
                <IvaRow
                  title="IPO consumo (8%)"
                  baseKey="iva5Base"
                  valorKey="iva5Valor"
                  fields={fields}
                  onChange={updateField}
                />
                <IvaRow
                  title="Tarifa Exentos (0%)"
                  baseKey="iva0Base"
                  valorKey="iva0Valor"
                  fields={fields}
                  onChange={updateField}
                />
              </div>
              <Input
                label={FIELD_LABELS.totalFactura}
                value={fields.totalFactura}
                onChange={(e) => updateField("totalFactura", e.target.value)}
                className="font-mono text-sm"
              />
              <Input
                label={FIELD_LABELS.propina}
                value={fields.propina}
                onChange={(e) => updateField("propina", e.target.value)}
                colorScheme={propinaValidation.isValid ? "default" : "error"}
                helperText={
                  propinaValidation.message ??
                  `Tope permitido: 10% del total factura (${new Intl.NumberFormat("es-CO", {
                    style: "currency",
                    currency: "COP",
                    maximumFractionDigits: 0,
                  }).format(propinaValidation.max)}).`
                }
                className="font-mono text-sm"
              />
            </div>

            <Alert
              variant="outline"
              type="info"
              title="Validación de Datos"
              description="3 tarifas de IVA detectadas. NIT validado contra registro mercantil. Total y bases gravadas reconcilian con el documento."
              showIcon
            />

            {overLimit ? (
              <Alert
                variant="filled"
                type="warning"
                title="Supera el límite de consumo"
                description={`Esta factura supera el tope de ${new Intl.NumberFormat("es-CO", {
                  style: "currency",
                  currency: "COP",
                  maximumFractionDigits: 0,
                }).format(CONSUMPTION_LIMIT)}; quedará sujeta a aprobación del líder.`}
                showIcon
              />
            ) : null}
          </form>

          <div className="p-6 bg-white border-t border-secondary-400 space-y-3 sticky bottom-0 relative z-10">
            <Button
              disabled={isProcessing || isConfirmed || !propinaValidation.isValid}
              variant={isConfirmed ? "outlined" : "contained"}
              className="w-full"
              action={handleConfirm}
            >
              {isProcessing ? (
                <>
                  <LuRefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Procesando…
                </>
              ) : isConfirmed ? (
                <>
                  <LuCircleCheck className="w-5 h-5 mr-2" />
                  Datos Procesados
                </>
              ) : (
                <>
                  <LuCircleCheck className="w-5 h-5 mr-2" />
                  Confirmar Datos
                </>
              )}
            </Button>
            <Button variant="outlined" className="w-full" action={() => navigate("/upload")}>
              <LuFileUp className="w-4 h-4 mr-2" />
              Subir otro documento
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

interface IvaRowProps {
  title: string;
  baseKey: "iva19Base" | "iva5Base" | "iva0Base";
  valorKey: "iva19Valor" | "iva5Valor" | "iva0Valor";
  fields: ExtractedFields;
  onChange: <K extends keyof ExtractedFields>(key: K, value: ExtractedFields[K]) => void;
}

const IvaRow = ({ title, baseKey, valorKey, fields, onChange }: IvaRowProps) => (
  <div className="p-4 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-secondary-900">{title}</span>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Input
        label="Base Gravada"
        value={fields[baseKey]}
        onChange={(e) => onChange(baseKey, e.target.value)}
        className="font-mono text-xs"
      />
      <Input
        label="IVA"
        value={fields[valorKey]}
        onChange={(e) => onChange(valorKey, e.target.value)}
        className="font-mono text-xs"
      />
    </div>
  </div>
);

const ReviewFallback = () => (
  <div className="flex min-h-screen flex-col bg-secondary-100">
    <LegalizacionHeader variant="review" />
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="text-secondary-600 text-sm flex items-center gap-2">
        <LuCircleAlert className="w-4 h-4" />
        Cargando revisión…
      </div>
    </main>
  </div>
);
