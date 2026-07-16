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
  approveByLeader,
  canSubmitToGestorSap,
  CONSUMPTION_LIMIT,
  deleteDocument,
  findLegalizationContainingDoc,
  getActiveLegalization,
  getLegalizationAnticipo,
  getLegalizationDiferencia,
  getLegalizationExcess,
  getLegalizationTimeStatus,
  getLegalizationTotal,
  getRole,
  isLeaderApproved,
  listDocuments,
  listLegalizations,
  recomputeAllDuplicates,
  requiresLeaderApproval,
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

  const draft = useMemo<Legalization | undefined>(() => {
    void active;
    return listLegalizations().find((l) => l.status === "draft");
  }, [active]);

  const anticipo = draft ? getLegalizationAnticipo(draft.id) : 0;
  const gastos = draft ? getLegalizationTotal(draft.id) : 0;
  const diferencia = draft ? getLegalizationDiferencia(draft.id) : 0;

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
    // HU-0011: el envío al Gestor SAP valida duplicados y aprobación del líder.
    const { can, blockers } = canSubmitToGestorSap(draft.id);
    if (!can) {
      toast({
        type: "warning",
        title: "No se puede enviar todavía",
        description: blockerMessage(blockers),
        showIcon: true,
        showCloseButton: true,
      });
      return;
    }
    const updated = submitLegalization(draft.id);
    if (updated && updated.status === "submitted") {
      toast({
        type: "success",
        title: "Legalización enviada",
        description: "Quedó en revisión por el Gestor SAP.",
        showIcon: true,
        showCloseButton: true,
      });
    }
  };

  const handleApproveByLeader = () => {
    if (!draft) return;
    const updated = approveByLeader(draft.id);
    if (updated?.leaderApproval) {
      toast({
        type: "success",
        title: "Aprobación del líder registrada",
        description: "Ya podés enviar la legalización al Gestor SAP.",
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
              onSubmit={handleSubmitLegalization}
              onApprove={handleApproveByLeader}
            />
          ) : (
            <EmptyLegalizationCard />
          )}

          {draft ? (
            <FinancialSummary
              anticipo={anticipo}
              gastos={gastos}
              diferencia={diferencia}
            />
          ) : null}

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

                              <div className="flex items-center gap-2 flex-wrap sm:justify-end">
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

interface FinancialSummaryProps {
  anticipo: number;
  gastos: number;
  diferencia: number;
}

/**
 * Resumen financiero del periodo: anticipo entregado, gastos justificados con
 * facturas y la diferencia. La diferencia es la cifra de negocio clave: dice si
 * queda saldo a favor del anticipo (por devolver) o si hay monto a reembolsar.
 */
const FinancialSummary = ({ anticipo, gastos, diferencia }: FinancialSummaryProps) => {
  const state =
    diferencia > 0 ? "aFavor" : diferencia < 0 ? "aReembolsar" : "cuadrado";

  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <FinancialCard
        icon={<LuWallet className="w-5 h-5 text-primary" />}
        label="Anticipo"
        value={formatCurrencyARS(anticipo)}
        caption="Adelanto del periodo"
      />
      <FinancialCard
        icon={<LuFileText className="w-5 h-5 text-primary" />}
        label="Total gastos"
        value={formatCurrencyARS(gastos)}
        caption="Facturas justificadas"
      />
      <FinancialCard
        icon={
          state === "aReembolsar" ? (
            <LuCircleAlert className="w-5 h-5 text-primary-foreground" />
          ) : (
            <LuCircleCheck className="w-5 h-5 text-primary-foreground" />
          )
        }
        label="Diferencia"
        value={formatCurrencyARS(Math.abs(diferencia))}
        caption={
          state === "aFavor"
            ? "Saldo a favor · por devolver"
            : state === "aReembolsar"
              ? "Supera el anticipo · a reembolsar"
              : "Anticipo y gastos cuadran"
        }
        highlight={state}
      />
    </section>
  );
};

interface FinancialCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
  highlight?: "aFavor" | "aReembolsar" | "cuadrado";
}

const FinancialCard = ({ icon, label, value, caption, highlight }: FinancialCardProps) => {
  const isHighlight = !!highlight;
  const highlightWrap =
    highlight === "aReembolsar"
      ? "bg-primary text-primary-foreground border-primary"
      : highlight === "aFavor"
        ? "bg-primary-50 border-primary"
        : highlight === "cuadrado"
          ? "bg-primary-50 border-primary"
          : "";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 ${
        isHighlight ? highlightWrap : "border-secondary-400 bg-white"
      }`}
    >
      <div className="relative z-10 flex items-start gap-4">
        <div
          className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${
            highlight === "aReembolsar"
              ? "bg-primary-foreground/15 border-primary-foreground/30"
              : "bg-primary-50 border-secondary-400"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <Typography
            variant="body2"
            className={`uppercase tracking-widest font-bold ${
              highlight === "aReembolsar" ? "text-primary-foreground/80" : "text-secondary-600"
            }`}
          >
            {label}
          </Typography>
          <p className="mt-1 text-xl font-semibold truncate">{value}</p>
          <p
            className={`mt-1 text-xs ${
              highlight === "aReembolsar" ? "text-primary-foreground/70" : "text-secondary-600"
            }`}
          >
            {caption}
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

/** Traduce los bloqueadores de `canSubmitToGestorSap` a un mensaje legible. */
function blockerMessage(blockers: string[]): string {
  const parts: string[] = [];
  if (blockers.includes("duplicates")) parts.push("hay facturas duplicadas");
  if (blockers.includes("leader-approval:excess"))
    parts.push("falta aprobación del líder por exceso de límite");
  if (blockers.includes("leader-approval:time"))
    parts.push("falta aprobación del líder por fuera de tiempo");
  if (parts.length === 0) return "Revisá la legalización antes de enviar.";
  const text = parts.join(" y ");
  return `No se puede enviar: ${text}.`;
}

const ActiveLegalizationCard = ({
  draft,
  confirmedCount,
  totalInLegalization,
  onSubmit,
  onApprove,
}: {
  draft: Legalization;
  confirmedCount: number;
  totalInLegalization: number;
  onSubmit: () => void;
  onApprove: () => void;
}) => {
  const total = getLegalizationTotal(draft.id);
  const excess = getLegalizationExcess(draft.id);
  const timeStatus = getLegalizationTimeStatus(draft.id);
  const req = requiresLeaderApproval(draft.id);
  const approved = isLeaderApproved(draft.id);
  const submit = canSubmitToGestorSap(draft.id);
  const canSubmit = submit.can;
  const hasExpenses = confirmedCount > 0;
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

      {/* HU-0008 — exceso de límite (alerta NO bloqueante para guardar) */}
      {excess.hasExcess ? (
        <div className="mt-4">
          <Alert
            variant="filled"
            type="warning"
            title="Exceso de límite de consumo"
            description={`${excess.exceededDocIds.length} factura${excess.exceededDocIds.length === 1 ? "" : "s"} supera${excess.exceededDocIds.length === 1 ? "" : "n"} el tope de ${formatCurrencyARS(CONSUMPTION_LIMIT)}. Excedido: ${formatCurrencyARS(excess.totalExcess)}. Podés guardar; para enviar requiere aprobación del líder.`}
            showIcon
          />
        </div>
      ) : null}

      {/* HU-0009 — fuera de tiempo (alerta NO bloqueante para guardar) */}
      {timeStatus.outOfTime ? (
        <div className="mt-4">
          <Alert
            variant="filled"
            type="warning"
            title="Legalización fuera de tiempo"
            description={`Han pasado ${timeStatus.daysElapsed} días hábiles desde el consumo (máximo ${5}). Podés guardar; para enviar requiere aprobación del líder.`}
            showIcon
          />
        </div>
      ) : null}

      {/* HU-0008/0009 — aprobación del líder (simulada) cuando hay motivos */}
      {req.any ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-secondary-400 bg-secondary-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Typography
              variant="body2"
              className="font-bold uppercase tracking-widest text-secondary-900"
            >
              Aprobación del líder
            </Typography>
            <Typography variant="body2" className="text-secondary-600">
              {approved
                ? `Aprobada el ${formatDate(draft.leaderApproval?.approvedAt ?? "")}`
                : "Pendiente de aprobación"}
            </Typography>
          </div>
          {approved ? (
            <Chip color="success" hoverable={false}>
              <span className="inline-flex items-center gap-1">
                <LuCircleCheck className="w-3 h-3" aria-hidden="true" />
                Aprobada por el líder
              </span>
            </Chip>
          ) : (
            <Button variant="contained" action={onApprove} className="min-h-11">
              <LuCircleCheck className="w-4 h-4 mr-2" />
              Aprobar como líder
            </Button>
          )}
        </div>
      ) : null}

      {/* HU-0011 — bloqueos del envío al Gestor SAP */}
      {!canSubmit && hasExpenses ? (
        <div className="mt-4">
          <Alert
            variant="outline"
            type="info"
            title="El envío está bloqueado"
            description={blockerMessage(submit.blockers)}
            showIcon
          />
        </div>
      ) : null}

      <Button disabled={!canSubmit} className="mt-6 w-full min-h-12" action={onSubmit}>
        Enviar a Gestor SAP
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
      En revisión Gestor SAP
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
                En revisión Gestor SAP
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
