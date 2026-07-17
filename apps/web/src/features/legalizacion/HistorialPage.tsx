import { Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuArchive,
  LuChevronDown,
  LuChevronRight,
  LuCircleAlert,
  LuClock,
  LuFileText,
  LuFilter,
  LuHistory,
  LuInbox,
  LuShieldCheck,
} from "react-icons/lu";

import { Alert, Button, Chip, DateField, Typography } from "@comfama/comfama-ui-react";

import {
  filterLegalizationsByDateRange,
  getDocument,
  getLegalizationAnticipo,
  getLegalizationConsumoDate,
  getLegalizationDiferencia,
  getLegalizationRegistroDate,
  getLegalizationTotal,
  listLegalizations,
  subscribe,
} from "./lib/store";
import type { DocumentRecord, Legalization, LegalizationStatus } from "./types/document";
import { LegalizacionHeader } from "./components/LegalizacionHeader";

/**
 * Estados que el modelo conoce hoy (HU-0010/0011). El estado `submitted` se
 * reutiliza como equivalente de "En revisión Gestor SAP"; `approved`/`rejected`
 * son la decisión terminal del Gestor SAP (HU-0011 lado gestor).
 */
const STATUS_LABEL: Record<LegalizationStatus, string> = {
  draft: "Borrador",
  submitted: "En revisión Gestor SAP",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const STATUS_COLOR: Record<LegalizationStatus, "warning" | "info" | "success" | "error"> = {
  draft: "warning",
  submitted: "info",
  approved: "success",
  rejected: "error",
};

/**
 * Identificador de solicitud legible (HU-0010): los primeros 8 caracteres
 * alfanuméricos del `id` de la legalización, en mayúsculas. Se eligió un
 * derivado corto porque el UUID completo no es cómodo para el seguimiento.
 */
function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Convierte un `Date` local a `yyyy-mm-dd` (sin depender de la zona horaria). */
function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Vista `/history` (HU-0010): historial de legalizaciones con filtros por
 * rango de fechas de consumo y de registro. Cada registro muestra fecha de
 * consumo, fecha de registro, total, estado e identificador; al seleccionarlo
 * se despliega el detalle con sus soportes asociados.
 */
export const HistorialPage = () => (
  <Suspense fallback={<HistorialFallback />}>
    <HistorialPageInner />
  </Suspense>
);

const HistorialPageInner = () => {
  const [all, setAll] = useState<Legalization[]>(() => listLegalizations());

  const [consumoFrom, setConsumoFrom] = useState<Date | undefined>(undefined);
  const [consumoTo, setConsumoTo] = useState<Date | undefined>(undefined);
  const [registroFrom, setRegistroFrom] = useState<Date | undefined>(undefined);
  const [registroTo, setRegistroTo] = useState<Date | undefined>(undefined);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubscribe = subscribe(() => setAll(listLegalizations()));
    return () => {
      unsubscribe();
    };
  }, []);

  const filters = useMemo(
    () => ({
      consumo: {
        from: consumoFrom ? dateToISO(consumoFrom) : undefined,
        to: consumoTo ? dateToISO(consumoTo) : undefined,
      },
      registro: {
        from: registroFrom ? dateToISO(registroFrom) : undefined,
        to: registroTo ? dateToISO(registroTo) : undefined,
      },
    }),
    [consumoFrom, consumoTo, registroFrom, registroTo],
  );

  const hasActiveFilters = Boolean(
    filters.consumo?.from || filters.consumo?.to || filters.registro?.from || filters.registro?.to,
  );

  const rows = useMemo(() => {
    const filtered = filterLegalizationsByDateRange(all, filters);
    return filtered.slice().sort((a, b) => {
      const ta = new Date(getLegalizationRegistroDate(a.id)).getTime();
      const tb = new Date(getLegalizationRegistroDate(b.id)).getTime();
      return tb - ta;
    });
  }, [all, filters]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const clearFilters = () => {
    setConsumoFrom(undefined);
    setConsumoTo(undefined);
    setRegistroFrom(undefined);
    setRegistroTo(undefined);
  };

  return (
    <div className="flex min-h-screen flex-col bg-secondary-100">
      <LegalizacionHeader variant="history" />

      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-5xl space-y-8">
          <section className="rounded-2xl border border-secondary-400 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary">
                <LuHistory className="h-6 w-6" />
              </div>
              <div>
                <Typography
                  variant="body2"
                  className="font-bold uppercase tracking-widest text-primary"
                >
                  Historial
                </Typography>
                <Typography variant="h2" className="text-secondary-900">
                  Historial de <span className="font-bold">gastos</span>
                </Typography>
              </div>
            </div>
            <Typography variant="body2" className="mt-3 text-secondary-600">
              Consultá y hacé seguimiento a tus legalizaciones. Filtrá por fecha de consumo o de
              registro.
            </Typography>
          </section>

          <section className="rounded-2xl border border-secondary-400 bg-white p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2">
              <LuFilter className="h-5 w-5 text-primary" />
              <Typography
                variant="body2"
                className="font-bold uppercase tracking-widest text-secondary-600"
              >
                Filtros
              </Typography>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold uppercase tracking-widest text-secondary-900">
                  Fecha de consumo
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <DateField
                    id="consumo-desde"
                    label="Desde"
                    value={consumoFrom}
                    onChange={setConsumoFrom}
                    enableDay
                    enableMonth
                    enableYear
                  />
                  <DateField
                    id="consumo-hasta"
                    label="Hasta"
                    value={consumoTo}
                    onChange={setConsumoTo}
                    enableDay
                    enableMonth
                    enableYear
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-bold uppercase tracking-widest text-secondary-900">
                  Fecha de registro
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <DateField
                    id="registro-desde"
                    label="Desde"
                    value={registroFrom}
                    onChange={setRegistroFrom}
                    enableDay
                    enableMonth
                    enableYear
                  />
                  <DateField
                    id="registro-hasta"
                    label="Hasta"
                    value={registroTo}
                    onChange={setRegistroTo}
                    enableDay
                    enableMonth
                    enableYear
                  />
                </div>
              </fieldset>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outlined"
                className="min-h-12"
                disabled={!hasActiveFilters}
                action={clearFilters}
              >
                Limpiar filtros
              </Button>
            </div>
          </section>

          <Alert
            variant="outline"
            type="info"
            title="Estados disponibles"
            description="Borrador, En revisión Gestor SAP, Aprobado y Rechazado. Las legalizaciones enviadas quedan en revisión hasta que el Gestor SAP las aprueba o rechaza."
            showIcon
          />

          {all.length === 0 ? (
            <NoRecords
              icon={<LuInbox className="h-7 w-7" />}
              title="Aún no tenés legalizaciones"
              description="Subí tu primera factura para iniciar una legalización y verla acá."
              cta={
                <Link to="/upload" className="inline-block">
                  <Button className="min-h-12">
                    <LuFileText className="mr-2 h-4 w-4" />
                    Subir documento
                  </Button>
                </Link>
              }
            />
          ) : rows.length === 0 ? (
            <NoRecords
              icon={<LuInbox className="h-7 w-7" />}
              title="No hay registros para el criterio seleccionado"
              description="Ajustá o limpiá los filtros para ver tus legalizaciones."
            />
          ) : (
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <Typography
                  variant="body2"
                  className="font-bold uppercase tracking-widest text-secondary-600"
                >
                  Resultados
                </Typography>
                <div className="h-px flex-1 bg-secondary-400" />
                <span className="text-xs font-semibold text-secondary-600">{rows.length}</span>
              </div>

              <ul className="space-y-3">
                {rows.map((leg) => (
                  <HistorialRow
                    key={leg.id}
                    legalization={leg}
                    isExpanded={!!expanded[leg.id]}
                    onToggle={() => toggleExpanded(leg.id)}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

interface HistorialRowProps {
  legalization: Legalization;
  isExpanded: boolean;
  onToggle: () => void;
}

const HistorialRow = ({ legalization, isExpanded, onToggle }: HistorialRowProps) => {
  const consumo = getLegalizationConsumoDate(legalization.id);
  const registro = getLegalizationRegistroDate(legalization.id);
  const total = getLegalizationTotal(legalization.id);

  return (
    <li className="rounded-2xl border border-secondary-400 bg-white">
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] sm:items-center sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-secondary-400 bg-primary-50 text-primary">
            <LuFileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-secondary-900">
              SOL-{shortId(legalization.id)}
            </p>
            <p className="text-xs text-secondary-600">{legalization.period}</p>
          </div>
        </div>

        <RowField label="Consumo" value={consumo ? formatDate(consumo) : "Sin fecha"} />
        <RowField label="Registro" value={formatDate(registro)} />
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-widest text-secondary-600">
            Total
          </span>
          <span className="mt-1 font-mono text-sm font-semibold text-secondary-900">
            {formatCurrency(total)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Chip color={STATUS_COLOR[legalization.status]} hoverable={false}>
            {STATUS_LABEL[legalization.status]}
          </Chip>
          {legalization.gestorDecision ? (
            <Chip
              color={legalization.gestorDecision.decision === "approved" ? "success" : "error"}
              hoverable={false}
            >
              <span className="inline-flex items-center gap-1">
                <LuShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {legalization.gestorDecision.decision === "approved"
                  ? "Aprobado por Gestor SAP"
                  : "Rechazado por Gestor SAP"}
              </span>
            </Chip>
          ) : null}
          <Button
            variant="ghost"
            isIcon
            size="sm"
            aria-label={isExpanded ? "Ocultar detalle" : "Ver detalle"}
            aria-expanded={isExpanded}
            action={onToggle}
          >
            {isExpanded ? (
              <LuChevronDown className="h-5 w-5 text-secondary-600" />
            ) : (
              <LuChevronRight className="h-5 w-5 text-secondary-600" />
            )}
          </Button>
        </div>
      </div>

      {isExpanded && <LegalizationDetail legalization={legalization} />}
    </li>
  );
};

const RowField = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col">
    <span className="text-xs font-bold uppercase tracking-widest text-secondary-600">{label}</span>
    <span className="mt-1 flex items-center gap-1 text-sm text-secondary-900">
      <LuClock className="h-3.5 w-3.5 text-secondary-600" />
      {value}
    </span>
  </div>
);

/**
 * Detalle de la legalización (E5): información financiera + soportes asociados.
 * Se despliega inline al seleccionar el registro (no hay ruta de detalle
 * dedicada; se reutilizan `/review?doc=` y el modelo existente).
 */
const LegalizationDetail = ({ legalization }: { legalization: Legalization }) => {
  const anticipo = getLegalizationAnticipo(legalization.id);
  const gastos = getLegalizationTotal(legalization.id);
  const diferencia = getLegalizationDiferencia(legalization.id);
  const docs: DocumentRecord[] = [];
  for (const docId of legalization.expenseIds) {
    const doc = getDocument(docId);
    if (doc) docs.push(doc);
  }

  return (
    <div className="space-y-5 border-t border-secondary-400 p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DetailMetric label="Anticipo" value={formatCurrency(anticipo)} />
        <DetailMetric label="Total gastos" value={formatCurrency(gastos)} />
        <DetailMetric
          label="Diferencia"
          value={formatCurrency(Math.abs(diferencia))}
          caption={
            diferencia > 0
              ? "Saldo a favor · por devolver"
              : diferencia < 0
                ? "Supera el anticipo · a reembolsar"
                : "Anticipo y gastos cuadran"
          }
        />
      </div>

      {legalization.status === "rejected" && legalization.gestorDecision?.reason ? (
        <Alert
          variant="outline"
          type="error"
          title="Motivo del rechazo (Gestor SAP)"
          description={legalization.gestorDecision.reason}
          showIcon
        />
      ) : null}

      <div className="space-y-3">
        <Typography
          variant="body2"
          className="font-bold uppercase tracking-widest text-secondary-600"
        >
          Soportes asociados
        </Typography>
        {docs.length === 0 ? (
          <div className="flex items-start gap-2 rounded-xl border border-secondary-400 bg-secondary-100 p-4 text-xs text-secondary-600">
            <LuCircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>Esta legalización no tiene soportes asociados.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-2 rounded-xl border border-secondary-400 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <LuFileText className="h-4 w-4 flex-shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-secondary-900">{doc.fileName}</p>
                    <p className="text-xs text-secondary-600">
                      {doc.extracted?.fecha ? formatDate(doc.extracted.fecha) : "Sin fecha"}
                      {doc.extracted?.totalFactura ? ` · ${doc.extracted.totalFactura}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {doc.sapContabilizacion?.numeroDocumento ? (
                    <Chip color="success" hoverable={false}>
                      N° SAP: {doc.sapContabilizacion.numeroDocumento}
                    </Chip>
                  ) : doc.sapContabilizacion ? (
                    <Chip color="warning" hoverable={false}>
                      {doc.sapContabilizacion.error ?? "Sin número SAP"}
                    </Chip>
                  ) : null}
                  {doc.docuwareArchive?.ok ? (
                    <Chip color="success" hoverable={false}>
                      <span className="inline-flex items-center gap-1">
                        <LuArchive className="h-3.5 w-3.5" aria-hidden="true" />
                        {doc.docuwareArchive.documentId
                          ? `DocuWare: ${doc.docuwareArchive.documentId}`
                          : "Archivado en DocuWare"}
                      </span>
                    </Chip>
                  ) : doc.docuwareArchive ? (
                    <Chip color="warning" hoverable={false}>
                      <span className="inline-flex items-center gap-1">
                        <LuArchive className="h-3.5 w-3.5" aria-hidden="true" />
                        DocuWare: no archivado
                      </span>
                    </Chip>
                  ) : null}
                  <Link
                    to={`/review?doc=${encodeURIComponent(doc.id)}`}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-secondary-400 bg-white px-4 text-xs font-semibold uppercase tracking-widest text-secondary-900 hover:bg-secondary-100"
                  >
                    Revisar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const DetailMetric = ({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) => (
  <div className="rounded-xl border border-secondary-400 bg-secondary-100 p-4">
    <span className="text-xs font-bold uppercase tracking-widest text-secondary-600">{label}</span>
    <p className="mt-1 text-lg font-semibold text-secondary-900">{value}</p>
    {caption ? <p className="mt-1 text-xs text-secondary-600">{caption}</p> : null}
  </div>
);

interface NoRecordsProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta?: React.ReactNode;
}

const NoRecords = ({ icon, title, description, cta }: NoRecordsProps) => (
  <section className="space-y-4 rounded-2xl border border-secondary-400 bg-white p-10 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-secondary-400 bg-primary-50 text-primary">
      {icon}
    </div>
    <Typography variant="h3" className="text-secondary-900">
      {title}
    </Typography>
    <Typography variant="body2" className="mx-auto max-w-md text-secondary-600">
      {description}
    </Typography>
    {cta}
  </section>
);

const HistorialFallback = () => (
  <div className="flex min-h-screen flex-col bg-secondary-100">
    <LegalizacionHeader variant="history" />
    <main className="flex-1 px-6 py-12">
      <div className="mx-auto max-w-5xl text-center text-sm text-secondary-600">
        Cargando historial…
      </div>
    </main>
  </div>
);
