import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuChevronDown,
  LuChevronRight,
  LuCircleAlert,
  LuClipboardCheck,
  LuClock,
  LuFileText,
  LuInbox,
  LuShieldCheck,
} from "react-icons/lu";

import { Alert, Button, Chip, Input, Typography, useToast } from "@comfama/comfama-ui-react";

import { authRoleLabel, getSession, signOut } from "@/features/auth";

import {
  approveLegalization,
  getDocument,
  getLegalizationAnticipo,
  getLegalizationDiferencia,
  getLegalizationExcess,
  getLegalizationTimeStatus,
  getLegalizationTotal,
  isLeaderApproved,
  listLegalizationsForGestor,
  parseAmount,
  rejectLegalization,
  subscribe,
} from "./lib/store";
import type { DocumentRecord, Legalization } from "./types/document";
import { LegalizacionHeader } from "./components/LegalizacionHeader";

function formatCurrencyARS(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Vista `/gestor` (HU-0011 lado Gestor SAP): bandeja de legalizaciones enviadas
 * (`submitted`) pendientes de decisión. El gestor puede aprobar (terminal) o
 * rechazar con motivo obligatorio (terminal).
 *
 * La lista se alimenta de `listLegalizationsForGestor` y se refresca por
 * suscripción al store (pub/sub) al decidir sobre un ítem.
 */
export const GestorPage = () => (
  <Suspense fallback={<GestorFallback />}>
    <GestorPageInner />
  </Suspense>
);

const GestorPageInner = () => {
  const session = getSession();
  const gestorId = session?.identifier ?? "Gestor SAP";
  const gestorRole = session ? authRoleLabel(session.role) : "Gestor SAP";
  const { toast } = useToast();
  const navigate = useNavigate();

  const [pending, setPending] = useState<Legalization[]>(() => listLegalizationsForGestor());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const unsubscribe = subscribe(() => setPending(listLegalizationsForGestor()));
    return () => {
      unsubscribe();
    };
  }, []);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApprove = (leg: Legalization) => {
    const updated = approveLegalization(leg.id, gestorId);
    if (updated?.status === "approved") {
      toast({
        type: "success",
        title: "Legalización aprobada",
        description: `${leg.period} quedó aprobada.`,
        showIcon: true,
        showCloseButton: true,
      });
    }
  };

  const startReject = (id: string) => {
    setRejectingId(id);
    setRejectReason("");
  };

  const cancelReject = () => {
    setRejectingId(null);
    setRejectReason("");
  };

  const confirmReject = (leg: Legalization) => {
    const reason = rejectReason.trim();
    if (!reason) {
      toast({
        type: "warning",
        title: "Motivo requerido",
        description: "Indicá el motivo del rechazo.",
        showIcon: true,
        showCloseButton: true,
      });
      return;
    }
    const updated = rejectLegalization(leg.id, gestorId, reason);
    if (updated?.status === "rejected") {
      cancelReject();
      toast({
        type: "info",
        title: "Legalización rechazada",
        description: `${leg.period} quedó rechazada.`,
        showIcon: true,
        showCloseButton: true,
      });
    }
  };

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-secondary-100">
      <LegalizacionHeader variant="gestor" />

      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-5xl space-y-8">
          <section className="rounded-2xl border border-secondary-400 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary">
                <LuClipboardCheck className="h-6 w-6" />
              </div>
              <div>
                <Typography
                  variant="body2"
                  className="font-bold uppercase tracking-widest text-primary"
                >
                  Bandeja Gestor SAP
                </Typography>
                <Typography variant="h2" className="text-secondary-900">
                  Aprobación de <span className="font-bold">legalizaciones</span>
                </Typography>
              </div>
            </div>
            <Typography variant="body2" className="mt-3 text-secondary-600">
              Revisá y decidí sobre las legalizaciones enviadas. La aprobación es definitiva; el
              rechazo requiere un motivo y también es terminal.
            </Typography>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-secondary-400 bg-secondary-100 px-4 py-2">
              <span className="text-xs font-bold uppercase tracking-widest text-secondary-600">
                Sesión
              </span>
              <span className="text-sm font-semibold text-secondary-900">{gestorId}</span>
              <Chip color="primary" hoverable={false}>
                {gestorRole}
              </Chip>
            </div>
          </section>

          {pending.length === 0 ? (
            <EmptyInbox onSignOut={handleSignOut} />
          ) : (
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <Typography
                  variant="body2"
                  className="font-bold uppercase tracking-widest text-secondary-600"
                >
                  Pendientes de aprobación
                </Typography>
                <div className="h-px flex-1 bg-secondary-400" />
                <span className="text-xs font-semibold text-secondary-600">{pending.length}</span>
              </div>

              <ul className="space-y-3">
                {pending.map((leg) => (
                  <GestorRow
                    key={leg.id}
                    legalization={leg}
                    gestorId={gestorId}
                    isExpanded={!!expanded[leg.id]}
                    isRejecting={rejectingId === leg.id}
                    rejectReason={rejectReason}
                    onToggle={() => toggleExpanded(leg.id)}
                    onApprove={() => handleApprove(leg)}
                    onStartReject={() => startReject(leg.id)}
                    onCancelReject={cancelReject}
                    onReasonChange={setRejectReason}
                    onConfirmReject={() => confirmReject(leg)}
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

interface GestorRowProps {
  legalization: Legalization;
  gestorId: string;
  isExpanded: boolean;
  isRejecting: boolean;
  rejectReason: string;
  onToggle: () => void;
  onApprove: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onReasonChange: (value: string) => void;
  onConfirmReject: () => void;
}

const GestorRow = ({
  legalization,
  isExpanded,
  isRejecting,
  rejectReason,
  onToggle,
  onApprove,
  onStartReject,
  onCancelReject,
  onReasonChange,
  onConfirmReject,
}: GestorRowProps) => {
  const total = getLegalizationTotal(legalization.id);
  const anticipo = getLegalizationAnticipo(legalization.id);
  const diferencia = getLegalizationDiferencia(legalization.id);
  const excess = getLegalizationExcess(legalization.id);
  const timeStatus = getLegalizationTimeStatus(legalization.id);
  const leaderOk = isLeaderApproved(legalization.id);
  const docs: DocumentRecord[] = [];
  for (const docId of legalization.expenseIds) {
    const doc = getDocument(docId);
    if (doc) docs.push(doc);
  }

  return (
    <li className="rounded-2xl border border-secondary-400 bg-white">
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-secondary-400 bg-primary-50 text-primary">
            <LuFileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-secondary-900 truncate">{legalization.period}</p>
            <p className="text-xs text-secondary-600">
              {legalization.expenseIds.length} soporte{legalization.expenseIds.length === 1 ? "" : "s"}
              {legalization.submittedAt ? ` · enviado ${formatDate(legalization.submittedAt)}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-widest text-secondary-600">
            Total
          </span>
          <span className="mt-1 font-mono text-sm font-semibold text-secondary-900">
            {formatCurrencyARS(total)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip color="info" hoverable={false}>
            En revisión Gestor SAP
          </Chip>
          {excess.hasExcess ? (
            <Chip color="warning" hoverable={false}>
              <span className="inline-flex items-center gap-1">
                <LuCircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Exceso
              </span>
            </Chip>
          ) : null}
          {timeStatus.outOfTime ? (
            <Chip color="warning" hoverable={false}>
              <span className="inline-flex items-center gap-1">
                <LuClock className="h-3.5 w-3.5" aria-hidden="true" />
                Fuera de tiempo
              </span>
            </Chip>
          ) : null}
          {leaderOk ? (
            <Chip color="success" hoverable={false}>
              <span className="inline-flex items-center gap-1">
                <LuShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Aprobación líder
              </span>
            </Chip>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2">
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

      {isExpanded && (
        <div className="space-y-5 border-t border-secondary-400 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DetailMetric label="Anticipo" value={formatCurrencyARS(anticipo)} />
            <DetailMetric label="Total gastos" value={formatCurrencyARS(total)} />
            <DetailMetric
              label="Diferencia"
              value={formatCurrencyARS(Math.abs(diferencia))}
              caption={
                diferencia > 0
                  ? "Saldo a favor · por devolver"
                  : diferencia < 0
                    ? "Supera el anticipo · a reembolsar"
                    : "Anticipo y gastos cuadran"
              }
            />
          </div>

          {(excess.hasExcess || timeStatus.outOfTime) && (
            <div className="space-y-2">
              <Typography
                variant="body2"
                className="font-bold uppercase tracking-widest text-secondary-600"
              >
                Alertas del envío
              </Typography>
              {excess.hasExcess ? (
                <Alert
                  variant="outline"
                  type="warning"
                  title="Exceso de límite de consumo"
                  description={`${excess.exceededDocIds.length} factura${excess.exceededDocIds.length === 1 ? "" : "s"} supera${excess.exceededDocIds.length === 1 ? "" : "n"} el tope. Excedido: ${formatCurrencyARS(excess.totalExcess)}.`}
                  showIcon
                />
              ) : null}
              {timeStatus.outOfTime ? (
                <Alert
                  variant="outline"
                  type="warning"
                  title="Legalización fuera de tiempo"
                  description={`Han pasado ${timeStatus.daysElapsed} días hábiles desde el consumo.`}
                  showIcon
                />
              ) : null}
            </div>
          )}

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
                    className="flex flex-col gap-1 rounded-xl border border-secondary-400 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <LuFileText className="h-4 w-4 flex-shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-secondary-900">{doc.fileName}</p>
                        <p className="text-xs text-secondary-600">
                          {doc.extracted?.fecha ? formatDate(doc.extracted.fecha) : "Sin fecha"}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-secondary-900">
                      {formatCurrencyARS(parseAmount(doc.extracted?.totalFactura))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isRejecting ? (
            <div className="space-y-3 rounded-2xl border border-error/40 bg-error/5 p-4">
              <Input
                id={`reject-reason-${legalization.id}`}
                name={`reject-reason-${legalization.id}`}
                type="text"
                label="Motivo del rechazo"
                placeholder="Ej: faltan soportes, monto no corresponde…"
                required
                value={rejectReason}
                onChange={(event) => onReasonChange(event.target.value)}
                autoFocus
              />
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button variant="text" className="min-h-11" action={onCancelReject}>
                  Cancelar
                </Button>
                <Button variant="outlined" className="min-h-11" action={onConfirmReject}>
                  Confirmar rechazo
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button variant="outlined" className="min-h-11" action={onStartReject}>
                Rechazar
              </Button>
              <Button className="min-h-11" action={onApprove}>
                Aprobar
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
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

const EmptyInbox = ({ onSignOut }: { onSignOut: () => void }) => (
  <section className="space-y-4 rounded-2xl border border-secondary-400 bg-white p-10 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-secondary-400 bg-primary-50 text-primary">
      <LuInbox className="h-7 w-7" />
    </div>
    <Typography variant="h3" className="text-secondary-900">
      No hay legalizaciones pendientes de aprobación
    </Typography>
    <Typography variant="body2" className="mx-auto max-w-md text-secondary-600">
      Cuando un colaborador envíe una legalización, aparecerá acá para que la revises y decidas.
    </Typography>
    <div className="flex justify-center">
      <Button variant="outlined" className="min-h-11" action={onSignOut}>
        Cerrar sesión
      </Button>
    </div>
  </section>
);

const GestorFallback = () => (
  <div className="flex min-h-screen flex-col bg-secondary-100">
    <LegalizacionHeader variant="gestor" />
    <main className="flex-1 px-6 py-12">
      <div className="mx-auto max-w-5xl text-center text-sm text-secondary-600">
        Cargando bandeja del gestor…
      </div>
    </main>
  </div>
);
