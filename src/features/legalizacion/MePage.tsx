import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  LuArrowLeft,
  LuChevronDown,
  LuChevronRight,
  LuCircleAlert,
  LuCircleCheck,
  LuFile,
  LuFileImage,
  LuFileSpreadsheet,
  LuFileText,
  LuTrash2,
  LuUpload,
  LuWallet,
} from "react-icons/lu";

import { Alert, Button, Chip, Typography, useToast } from "@comfama/comfama-ui-react";

import {
  deleteDocument,
  findLegalizationContainingDoc,
  getActiveLegalization,
  getBlockingDuplicates,
  getLegalizationTotal,
  getRole,
  listDocuments,
  listLegalizations,
  parseAmount,
  recomputeAllDuplicates,
  submitLegalization,
  subscribe,
} from "./lib/store";
import type {
  DocumentRecord,
  DocumentStatus,
  Legalization,
  LegalizationStatus,
  Role,
} from "./types/document";
import { InvoicePreview } from "./components/InvoicePreview";
import { LegalizacionHeader } from "./components/LegalizacionHeader";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  upload: "Subido",
  processing: "Procesado",
};

const STATUS_COLOR: Record<DocumentStatus, "warning" | "info"> = {
  upload: "warning",
  processing: "info",
};

const USER_NAME = "Juan Pérez";
const USER_ID = "12.345.678";

type Group = "Hoy" | "Esta semana" | "Anterior";

function iconForType(type: string) {
  if (type.startsWith("image/")) return LuFileImage;
  if (type.includes("spreadsheet") || type.includes("excel") || type === "text/csv")
    return LuFileSpreadsheet;
  if (type.includes("pdf") || type.includes("text")) return LuFileText;
  return LuFile;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - diff);
  return start;
}

function groupOf(uploadedAt: string): Group {
  const d = new Date(uploadedAt);
  const now = new Date();
  if (isSameDay(d, now)) return "Hoy";
  const weekStart = startOfWeek(now);
  if (d.getTime() >= weekStart.getTime()) return "Esta semana";
  return "Anterior";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role: Role): string {
  return role === "conductor" ? "Conductor" : "Personal";
}

function formatCurrencyARS(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Vista `/me`: perfil + legalización activa + estadísticas + lista de
 * documentos (agrupados por Hoy/Esta semana/Anterior) + legalizaciones enviadas.
 */
export const MePage = () => (
  <Suspense fallback={<MeFallback />}>
    <MePageInner />
  </Suspense>
);

const MePageInner = () => {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight") ?? null;
  const { toast } = useToast();

  const [docs, setDocs] = useState<DocumentRecord[]>(() => listDocuments());
  const [role, setRoleState] = useState<Role>(() => getRole());
  const [active, setActive] = useState<Legalization | undefined>(() => getActiveLegalization());
  const [submitted, setSubmitted] = useState<Legalization[]>(() =>
    listLegalizations().filter((l) => l.status === "submitted"),
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const highlightRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    recomputeAllDuplicates();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setDocs(listDocuments());
      setRoleState(getRole());
      setActive(getActiveLegalization());
      setSubmitted(listLegalizations().filter((l) => l.status === "submitted"));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => {
      highlightRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
    return () => clearTimeout(t);
  }, [highlightId, docs]);

  const stats = useMemo(() => {
    let processing = 0;
    let gastos = 0;
    for (const d of docs) {
      if (d.status === "processing") {
        processing += 1;
        gastos += parseAmount(d.extracted?.totalFactura);
      }
    }
    return { total: docs.length, processing, gastos };
  }, [docs]);

  const draft = useMemo<Legalization | undefined>(() => {
    void active;
    return listLegalizations().find((l) => l.status === "draft");
  }, [active]);

  const visibleDocs = useMemo(() => {
    if (!draft) return [];
    const inActive = new Set(draft.expenseIds);
    const allExpenseIds = new Set<string>();
    for (const l of listLegalizations()) {
      for (const id of l.expenseIds) allExpenseIds.add(id);
    }
    const orphans = docs.filter((d) => !allExpenseIds.has(d.id));
    const inAct = docs.filter((d) => inActive.has(d.id));
    return [...orphans, ...inAct];
  }, [docs, draft]);

  const grouped = useMemo(() => {
    const out: Record<Group, DocumentRecord[]> = {
      Hoy: [],
      "Esta semana": [],
      Anterior: [],
    };
    for (const d of visibleDocs) {
      out[groupOf(d.uploadedAt)].push(d);
    }
    return out;
  }, [visibleDocs]);

  const totalInLegalization = draft?.expenseIds.length ?? 0;
  const confirmedCount = useMemo(() => {
    if (!draft) return 0;
    const inActive = new Set(draft.expenseIds);
    return docs.filter((d) => inActive.has(d.id) && d.status === "processing").length;
  }, [docs, draft]);

  const blockingDuplicates = useMemo(() => (draft ? getBlockingDuplicates(draft.id) : []), [draft]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = (doc: DocumentRecord) => {
    const ok =
      typeof window !== "undefined"
        ? window.confirm(
            doc.status === "processing"
              ? `¿Eliminar el documento procesado "${doc.fileName}"? Esta acción no se puede deshacer.`
              : `¿Eliminar "${doc.fileName}"?`,
          )
        : true;
    if (!ok) return;
    deleteDocument(doc.id);
  };

  const handleSubmitLegalization = () => {
    if (!draft) return;
    const blocking = getBlockingDuplicates(draft.id);
    if (blocking.length > 0) {
      toast({
        type: "warning",
        title: "Hay gastos duplicados",
        description: "No se puede enviar la legalización mientras existan facturas duplicadas.",
        showIcon: true,
        showCloseButton: true,
      });
      return;
    }
    const updated = submitLegalization(draft.id);
    if (updated && updated.status === "submitted") {
      toast({
        type: "success",
        title: "Legalización enviada a aprobación",
        showIcon: true,
        showCloseButton: true,
      });
    }
  };

  const groupOrder: Group[] = ["Hoy", "Esta semana", "Anterior"];

  return (
    <div className="flex min-h-screen flex-col bg-secondary-100">
      <LegalizacionHeader variant="me" />

      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto space-y-8">
          <section className="relative overflow-hidden rounded-2xl border border-secondary-400 bg-white p-6 sm:p-10">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary-50 border border-secondary-400 flex items-center justify-center text-primary font-semibold text-xl">
                  JP
                </div>
                <div>
                  <Typography
                    variant="body2"
                    className="text-primary uppercase tracking-widest font-bold"
                  >
                    Perfil
                  </Typography>
                  <Typography variant="h2" className="text-secondary-900 mt-1">
                    {USER_NAME.split(" ")[0]}{" "}
                    <span className="font-bold">{USER_NAME.split(" ").slice(1).join(" ")}</span>
                  </Typography>
                  <Typography
                    variant="body2"
                    className="text-secondary-600 mt-1 uppercase tracking-widest"
                  >
                    ID {USER_ID} · {roleLabel(role)}
                  </Typography>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outlined" action={() => undefined} className="px-4">
                  <LuArrowLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
                <Link to="/upload" className="contents">
                  <Button action={() => undefined} className="px-4">
                    <LuUpload className="w-4 h-4 mr-2" />
                    Subir documento
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {draft ? (
            <ActiveLegalizationCard
              draft={draft}
              confirmedCount={confirmedCount}
              totalInLegalization={totalInLegalization}
              blockingDuplicates={blockingDuplicates}
              onSubmit={handleSubmitLegalization}
            />
          ) : (
            <EmptyLegalizationCard />
          )}

          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={<LuFileText className="w-5 h-5 text-primary" />}
              label="Total"
              value={stats.total}
              accent="primary"
            />
            <StatCard
              icon={<LuCircleCheck className="w-5 h-5 text-info" />}
              label="Procesados"
              value={stats.processing}
              accent="info"
            />
            <StatCard
              icon={<LuWallet className="w-5 h-5 text-primary" />}
              label="Total de la legalización"
              value={formatCurrencyARS(stats.gastos)}
              accent="primary"
            />
          </section>

          {submitted.length > 0 ? <SubmittedLegalizationsList items={submitted} /> : null}

          <section className="space-y-8">
            {visibleDocs.length === 0 ? (
              <div className="rounded-2xl border border-secondary-400 bg-white p-10 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-50 border border-secondary-400 flex items-center justify-center text-primary">
                  <LuUpload className="w-7 h-7" />
                </div>
                <Typography variant="h3" className="text-secondary-900">
                  Aún no tenés <span className="font-bold">documentos</span>
                </Typography>
                <Typography variant="body2" className="text-secondary-600 max-w-md mx-auto">
                  Subí tu primera factura o remito para empezar a gestionarlos desde acá.
                </Typography>
                <Link to="/upload" className="inline-block">
                  <Button action={() => undefined}>
                    <LuUpload className="w-4 h-4 mr-2" />
                    Subir mi primer documento
                  </Button>
                </Link>
              </div>
            ) : (
              groupOrder.map((group) => {
                const list = grouped[group];
                if (list.length === 0) return null;
                return (
                  <div key={group} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Typography
                        variant="body2"
                        className="text-secondary-600 uppercase tracking-widest font-bold"
                      >
                        {group}
                      </Typography>
                      <div className="h-px flex-1 bg-secondary-400" />
                      <span className="text-xs font-semibold text-secondary-600">
                        {list.length}
                      </span>
                    </div>

                    <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_18rem] gap-4 px-5 pb-2 text-xs font-bold text-secondary-600 uppercase tracking-widest">
                      <span>Documento</span>
                      <span>Fecha de subida</span>
                      <span>NIT</span>
                      <span>Valor</span>
                      <span aria-hidden="true"></span>
                    </div>

                    <ul className="space-y-3">
                      {list.map((doc) => {
                        const Icon = iconForType(doc.fileType);
                        const isExpanded = !!expanded[doc.id];
                        const isHighlighted = highlightId === doc.id;
                        const showRef = isHighlighted ? highlightRef : null;
                        const nit = doc.extracted?.nit ?? "—";
                        const valor = doc.extracted?.totalFactura ?? "—";
                        return (
                          <li
                            key={doc.id}
                            ref={showRef}
                            className={`rounded-2xl border bg-white transition-all ${
                              isHighlighted
                                ? "border-primary ring-2 ring-primary/40 shadow-lg"
                                : "border-secondary-400 hover:border-primary/60"
                            }`}
                          >
                            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_18rem] gap-x-4 gap-y-3 sm:items-center">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-primary-50 border border-secondary-400 flex items-center justify-center text-primary flex-shrink-0">
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-mono text-sm text-secondary-900 truncate">
                                    {doc.fileName}
                                  </p>
                                  <p className="text-xs text-secondary-600 mt-1 sm:hidden">
                                    {formatDate(doc.uploadedAt)} · {formatTime(doc.uploadedAt)}
                                  </p>
                                </div>
                              </div>

                              <div className="hidden sm:block text-xs text-secondary-600">
                                <p>{formatDate(doc.uploadedAt)}</p>
                                <p className="text-secondary-600/70 mt-0.5">
                                  {formatTime(doc.uploadedAt)}
                                </p>
                              </div>

                              <div className="text-xs">
                                <span className="sm:hidden text-xs font-bold uppercase tracking-widest text-secondary-600 mr-2">
                                  NIT
                                </span>
                                <span className="font-mono text-secondary-900">{nit}</span>
                                {doc.ceco ? (
                                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-secondary-600">
                                    <span className="sm:hidden">CECO</span>
                                    <span
                                      className={`font-mono normal-case tracking-normal ${
                                        doc.ceco ? "text-secondary-900" : "text-secondary-600"
                                      }`}
                                    >
                                      {doc.ceco}
                                    </span>
                                  </span>
                                ) : null}
                              </div>

                              <div className="text-xs">
                                <span className="sm:hidden text-xs font-bold uppercase tracking-widest text-secondary-600 mr-2">
                                  Valor
                                </span>
                                <span className="font-mono text-secondary-900">{valor}</span>
                              </div>

                              <div className="flex items-center gap-2 sm:justify-end flex-wrap sm:flex-nowrap">
                                <Chip color={STATUS_COLOR[doc.status]} hoverable={false}>
                                  {STATUS_LABEL[doc.status]}
                                </Chip>
                                {doc.duplicateOf && doc.duplicateOf.length > 0 ? (
                                  <Chip color="warning" hoverable={false}>
                                    <span className="inline-flex items-center gap-1">
                                      <LuCircleAlert className="w-3 h-3" aria-hidden="true" />
                                      Duplicado
                                    </span>
                                  </Chip>
                                ) : doc.duplicateReason === "indeterminate" ? (
                                  <Chip color="warning" hoverable={false}>
                                    <span className="inline-flex items-center gap-1">
                                      <LuCircleAlert className="w-3 h-3" aria-hidden="true" />
                                      Sin datos para validar
                                    </span>
                                  </Chip>
                                ) : null}
                                <Link
                                  to={`/review?doc=${encodeURIComponent(doc.id)}`}
                                  className="h-9 px-4 rounded-full bg-white border border-secondary-400 text-secondary-900 hover:bg-secondary-100 text-xs font-semibold uppercase tracking-widest flex items-center gap-1"
                                >
                                  Revisar
                                </Link>
                                <Button
                                  variant="ghost"
                                  isIcon
                                  size="sm"
                                  aria-label={isExpanded ? "Ocultar detalle" : "Ver detalle"}
                                  action={() => toggleExpanded(doc.id)}
                                >
                                  {isExpanded ? (
                                    <LuChevronDown className="w-4 h-4 text-secondary-600" />
                                  ) : (
                                    <LuChevronRight className="w-4 h-4 text-secondary-600" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  isIcon
                                  size="sm"
                                  aria-label="Eliminar documento"
                                  action={() => handleDelete(doc)}
                                  className="text-primary hover:bg-primary hover:text-primary-foreground"
                                >
                                  <LuTrash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-secondary-400">
                                <Preview doc={doc} />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: "primary" | "info";
}

const StatCard = ({ icon, label, value, accent }: StatCardProps) => {
  const accentBg: Record<typeof accent, string> = {
    primary: "from-primary/15",
    info: "from-info/15",
  };
  const isAmount = typeof value === "string";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-secondary-400 bg-white p-5">
      <div
        className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${accentBg[accent]} to-transparent blur-2xl pointer-events-none`}
      />
      <div className="relative z-10 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-primary-50 border border-secondary-400 flex items-center justify-center">
          {icon}
        </div>
        <div className="min-w-0">
          <Typography
            variant="body2"
            className="text-secondary-600 uppercase tracking-widest font-bold"
          >
            {label}
          </Typography>
          <p
            className={`mt-1 font-semibold text-secondary-900 ${isAmount ? "text-xl truncate" : "text-2xl"}`}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};

const Preview = ({ doc }: { doc: DocumentRecord }) => {
  const duplicateMessage = useMemo<string | null>(() => {
    if (!doc.duplicateOf || doc.duplicateOf.length === 0) return null;
    if (doc.duplicateReason === "same-legalization") {
      return "Duplicada dentro de esta legalización";
    }
    if (doc.duplicateReason === "history") {
      const source = findLegalizationContainingDoc(doc.duplicateOf[0]);
      const iso = source?.submittedAt ?? source?.createdAt;
      const date = iso ? formatDate(iso) : "una legalización anterior";
      return `Duplicada contra historial (legalización enviada el ${date})`;
    }
    return null;
  }, [doc]);

  if (!doc.extracted) {
    return (
      <div className="pt-4 flex items-start gap-3 text-xs text-secondary-600">
        <LuCircleAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>Este documento aún no tiene datos extraídos. Abrilo en revisión para procesarlo.</p>
      </div>
    );
  }

  const e = doc.extracted;
  return (
    <div className="pt-4 space-y-4">
      {duplicateMessage ? (
        <Alert variant="filled" type="warning" title={duplicateMessage} showIcon />
      ) : null}
      <InvoicePreview fields={e} fileName={doc.fileName} />
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
        <PreviewRow label="Fecha de Emisión" value={e.fecha} />
        <PreviewRow label="N° Factura" value={e.nroFactura} mono />
        <PreviewRow label="Proveedor" value={e.proveedor} />
        <PreviewRow label="CUIT" value={e.cuit} mono />
        <PreviewRow label="NIT" value={e.nit} mono />
        <PreviewRow label="Dirección" value={e.direccion} />
        <PreviewRow label="Teléfono" value={e.telefono} mono />
        <PreviewRow label="Departamento" value={e.departamento} />
        <PreviewRow label="Municipio" value={e.municipio} />
        <PreviewRow label="Monto Total" value={e.monto} mono />
        <PreviewRow label="Kilometraje" value={e.kilometraje} mono />
        <PreviewRow label="IVA 19% Base" value={e.iva19Base} mono />
        <PreviewRow label="IVA 19% Valor" value={e.iva19Valor} mono />
        <PreviewRow label="IVA 5% Base" value={e.iva5Base} mono />
        <PreviewRow label="IVA 5% Valor" value={e.iva5Valor} mono />
        <PreviewRow label="IVA 0% Base" value={e.iva0Base} mono />
        <PreviewRow label="IVA 0% Valor" value={e.iva0Valor} mono />
        <PreviewRow label="Total Factura" value={e.totalFactura} mono />
        <PreviewRow label="Propina" value={e.propina} mono />
        {doc.ceco ? <PreviewRow label="CECO" value={doc.ceco} mono /> : null}
      </dl>
    </div>
  );
};

const PreviewRow = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="flex flex-col">
    <dt className="text-xs font-bold text-secondary-600 uppercase tracking-widest">{label}</dt>
    <dd className={`mt-1 text-secondary-900 ${mono ? "font-mono" : ""}`}>{value}</dd>
  </div>
);

const ActiveLegalizationCard = ({
  draft,
  confirmedCount,
  totalInLegalization,
  blockingDuplicates,
  onSubmit,
}: {
  draft: Legalization;
  confirmedCount: number;
  totalInLegalization: number;
  blockingDuplicates: string[];
  onSubmit: () => void;
}) => {
  const total = getLegalizationTotal(draft.id);
  const blockingCount = blockingDuplicates.length;
  const canSubmit = confirmedCount > 0 && blockingCount === 0;
  const caption = `${confirmedCount} gasto${confirmedCount === 1 ? "" : "s"} confirmado${confirmedCount === 1 ? "" : "s"} de ${totalInLegalization} en la legalización`;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-secondary-400 bg-white p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Typography variant="body2" className="text-primary uppercase tracking-widest font-bold">
            Legalización activa
          </Typography>
          <Typography variant="h2" className="text-secondary-900 mt-1">
            <span className="font-bold">{draft.period}</span>
          </Typography>
        </div>
        <LegalizationStatusChip status={draft.status} />
      </div>
      <div className="mt-6 sm:mt-8">
        <Typography
          variant="body2"
          className="text-secondary-600 uppercase tracking-widest font-bold"
        >
          Total consolidado
        </Typography>
        <Typography variant="h1" className="text-secondary-900 mt-2 font-light">
          {formatCurrencyARS(total)}
        </Typography>
        <Typography variant="body2" className="text-secondary-600 mt-2">
          {caption}
        </Typography>
      </div>
      {blockingCount > 0 ? (
        <div className="mt-4">
          <Alert
            variant="filled"
            type="warning"
            title={`${blockingCount} gasto${blockingCount === 1 ? "" : "s"} con factura duplicada`}
            description={`Impide${blockingCount === 1 ? "" : "n"} el envío a aprobación.`}
            showIcon
          />
        </div>
      ) : null}
      <Button disabled={!canSubmit} className="mt-6 w-full" action={onSubmit}>
        Enviar a aprobación
      </Button>
    </section>
  );
};

const LegalizationStatusChip = ({ status }: { status: LegalizationStatus }) =>
  status === "draft" ? (
    <Chip color="warning" hoverable={false}>
      Borrador
    </Chip>
  ) : (
    <Chip color="info" hoverable={false}>
      En aprobación
    </Chip>
  );

const EmptyLegalizationCard = () => (
  <section className="rounded-2xl border border-secondary-400 bg-white p-10 text-center space-y-4">
    <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-50 border border-secondary-400 flex items-center justify-center text-primary">
      <LuUpload className="w-7 h-7" />
    </div>
    <Typography variant="h3" className="text-secondary-900">
      Aún no tenés una <span className="font-bold">legalización activa</span>
    </Typography>
    <Typography variant="body2" className="text-secondary-600 max-w-md mx-auto">
      Subí tu primera factura para iniciar una nueva legalización.
    </Typography>
    <Link to="/upload" className="inline-block">
      <Button action={() => undefined}>
        <LuUpload className="w-4 h-4 mr-2" />
        Subir mi primer documento
      </Button>
    </Link>
  </section>
);

const SubmittedLegalizationsList = ({ items }: { items: Legalization[] }) => {
  const sorted = useMemo(
    () =>
      items.slice().sort((a, b) => {
        const ta = a.submittedAt
          ? new Date(a.submittedAt).getTime()
          : new Date(a.createdAt).getTime();
        const tb = b.submittedAt
          ? new Date(b.submittedAt).getTime()
          : new Date(b.createdAt).getTime();
        return tb - ta;
      }),
    [items],
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <Typography
          variant="body2"
          className="text-secondary-600 uppercase tracking-widest font-bold"
        >
          Legalizaciones enviadas
        </Typography>
        <div className="h-px flex-1 bg-secondary-400" />
        <span className="text-xs font-semibold text-secondary-600">{sorted.length}</span>
      </div>
      <ul className="space-y-3">
        {sorted.map((l) => {
          const total = getLegalizationTotal(l.id);
          const submittedAt = l.submittedAt ?? l.createdAt;
          return (
            <li
              key={l.id}
              className="rounded-2xl border border-secondary-400 bg-white p-4 sm:p-5 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-secondary-900 truncate">{l.period}</p>
                <p className="text-xs text-secondary-600 mt-1">
                  {formatDate(submittedAt)} · {formatTime(submittedAt)}
                </p>
              </div>
              <Chip color="info" hoverable={false} className="flex-shrink-0">
                En aprobación
              </Chip>
              <span className="text-sm font-mono text-secondary-900 flex-shrink-0">
                {formatCurrencyARS(total)}
              </span>
              <LuChevronRight
                className="w-4 h-4 text-secondary-600 flex-shrink-0"
                aria-hidden="true"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const MeFallback = () => (
  <div className="flex min-h-screen flex-col bg-secondary-100">
    <LegalizacionHeader variant="me" />
    <main className="flex-1 px-6 py-12">
      <div className="max-w-5xl mx-auto text-center text-secondary-600 text-sm">
        Cargando perfil…
      </div>
    </main>
  </div>
);
