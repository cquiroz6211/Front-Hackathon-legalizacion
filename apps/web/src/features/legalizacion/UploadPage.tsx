import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuArrowLeft,
  LuCamera,
  LuCircleX,
  LuFileCheck,
  LuFileText,
  LuFiles,
  LuReceiptText,
  LuRefreshCw,
  LuUpload,
} from "react-icons/lu";

import { Alert, Button, Select, Typography, useToast } from "@comfama/comfama-ui-react";

import {
  addDocument,
  addExpenseToLegalization,
  getOrCreateDraftLegalization,
  getRole,
  updateDocument,
} from "./lib/store";
import { getCecos, validateDocument, processDocument, toExtractedFields } from "./lib/api";
import { LegalizacionHeader } from "./components/LegalizacionHeader";

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png";
type UploadFlow = "invoice" | "collection-account";

interface CecoOption {
  value: string;
  label: string;
}

export const UploadPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [flow, setFlow] = useState<UploadFlow | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [rutFile, setRutFile] = useState<File | null>(null);
  const [accountFile, setAccountFile] = useState<File | null>(null);
  const [ceco, setCeco] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cecoOptions, setCecoOptions] = useState<CecoOption[]>([]);
  const [cecosLoading, setCecosLoading] = useState(false);
  const [cecosError, setCecosError] = useState<string | null>(null);

  const loadCecos = () => {
    setCecosLoading(true);
    setCecosError(null);
    getCecos()
      .then((res) => {
        if (!res.ok || !res.cecos) {
          setCecoOptions([]);
          setCecosError(res.error ?? "No se pudieron cargar los centros de costo.");
          return;
        }
        interface RawCecoOption {
          value: string;
          label: string;
          dateto: string;
          langu: string;
        }

        const rawOptions: RawCecoOption[] = res.cecos
          .map((raw) => {
            const c = raw as Record<string, unknown>;
            const code = String(c.kostl ?? "").trim();
            const cleanCode = code.replace(/^0+/, "");
            const desc = String(c.txtmd ?? c.txtsh ?? c.txtmc ?? "").trim();
            const dateto = String(c.dateto ?? "").trim();
            const langu = String(c.langu ?? "").trim();
            return {
              value: code,
              label: desc ? `${cleanCode} — ${desc}` : cleanCode,
              dateto,
              langu,
            };
          })
          .filter((option) => option.value !== "");

        // Desduplica por código de CECO para evitar claves duplicadas en React
        const uniqueOptionsMap = new Map<string, RawCecoOption>();
        for (const opt of rawOptions) {
          const existing = uniqueOptionsMap.get(opt.value);
          if (!existing) {
            uniqueOptionsMap.set(opt.value, opt);
          } else {
            // Prioriza registros vigentes ('9999-12-31') y preferiblemente en español ('S')
            const isOptBetter =
              (opt.dateto === "9999-12-31" && existing.dateto !== "9999-12-31") ||
              (opt.dateto === "9999-12-31" && opt.langu === "S" && existing.langu !== "S");
            if (isOptBetter) {
              uniqueOptionsMap.set(opt.value, opt);
            }
          }
        }

        const options = Array.from(uniqueOptionsMap.values()).map((o) => ({
          value: o.value,
          label: o.label,
        }));

        setCecoOptions(options);
      })
      .catch((error: unknown) => {
        setCecoOptions([]);
        setCecosError(error instanceof Error ? error.message : "Error al consultar los CECOs.");
      })
      .finally(() => setCecosLoading(false));
  };

  // Consulta los CECOs al backend al montar la vista.
  useEffect(() => {
    loadCecos();
  }, []);

  const handleContinue = () => {
    if (flow === "invoice" && !invoiceFile) return;
    if (flow === "collection-account" && (!rutFile || !accountFile)) return;
    setIsProcessing(true);

    const draft = getOrCreateDraftLegalization();

    if (flow === "invoice" && invoiceFile) {
      // 1. Ejecuta la validación de calidad y cumplimiento de la norma de viajes
      validateDocument(invoiceFile)
        .then((valRes) => {
          if (!valRes.ok || !valRes.quality || !valRes.quality.legible) {
            toast({
              type: "error",
              title: "Documento no válido para legalización",
              description:
                valRes.quality?.recomendacion ??
                valRes.error ??
                "El soporte no cumple con la norma de viajes o no es legible. Por favor, sube un documento válido.",
              showIcon: true,
              showCloseButton: true,
            });
            setIsProcessing(false);
            return;
          }

          // 2. Si cumple, ejecuta el procesamiento con OCR + extracción estructurada con IA
          processDocument(invoiceFile)
            .then((procRes) => {
              if (!procRes.ok || !procRes.fields) {
                toast({
                  type: "error",
                  title: "Error al extraer datos",
                  description:
                    procRes.error ??
                    "No pudimos procesar los datos del documento. Por favor, intenta de nuevo.",
                  showIcon: true,
                  showCloseButton: true,
                });
                setIsProcessing(false);
                return;
              }

              // Mapeamos al formato del frontend
              const mappedFields = toExtractedFields(procRes.fields);

              // 3. Guardamos el documento con el estado "processing" y los datos extraídos
              const invoice = addDocument({
                fileName: invoiceFile.name,
                fileType: invoiceFile.type || "application/octet-stream",
                fileSize: invoiceFile.size,
                role: getRole(),
                status: "processing",
                purpose: "invoice",
                extracted: mappedFields,
                ...(ceco.trim() ? { ceco: ceco.trim() } : {}),
              });

              addExpenseToLegalization(draft.id, invoice.id);
              setIsProcessing(false);
              navigate(`/review?doc=${encodeURIComponent(invoice.id)}`);
            })
            .catch((err: unknown) => {
              toast({
                type: "error",
                title: "Error de procesamiento",
                description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
                showIcon: true,
                showCloseButton: true,
              });
              setIsProcessing(false);
            });
        })
        .catch((err: unknown) => {
          toast({
            type: "error",
            title: "Error al validar la norma",
            description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
            showIcon: true,
            showCloseButton: true,
          });
          setIsProcessing(false);
        });
      return;
    }

    // Flujo para cuenta de cobro (RUT + Cuenta)
    if (flow === "collection-account" && rutFile && accountFile) {
      // 1. Validamos la calidad y norma de ambos documentos en paralelo
      Promise.all([validateDocument(rutFile), validateDocument(accountFile)])
        .then(([rutVal, accountVal]) => {
          if (!rutVal.ok || !rutVal.quality || !rutVal.quality.legible) {
            toast({
              type: "error",
              title: "RUT no válido o legible",
              description:
                rutVal.quality?.recomendacion ??
                rutVal.error ??
                "Por favor, sube un documento de RUT válido.",
              showIcon: true,
              showCloseButton: true,
            });
            setIsProcessing(false);
            return;
          }

          if (!accountVal.ok || !accountVal.quality || !accountVal.quality.legible) {
            toast({
              type: "error",
              title: "Cuenta de cobro no válida o legible",
              description:
                accountVal.quality?.recomendacion ??
                accountVal.error ??
                "La cuenta de cobro no cumple la norma o no es legible.",
              showIcon: true,
              showCloseButton: true,
            });
            setIsProcessing(false);
            return;
          }

          // 2. Si ambos pasan la validación, procesamos la extracción de ambos en paralelo
          Promise.all([processDocument(rutFile), processDocument(accountFile)])
            .then(([rutProc, accountProc]) => {
              if (!rutProc.ok || !rutProc.fields) {
                toast({
                  type: "error",
                  title: "Error al extraer datos del RUT",
                  description: rutProc.error ?? "No pudimos procesar los datos del RUT.",
                  showIcon: true,
                  showCloseButton: true,
                });
                setIsProcessing(false);
                return;
              }

              if (!accountProc.ok || !accountProc.fields) {
                toast({
                  type: "error",
                  title: "Error al extraer datos de la Cuenta de Cobro",
                  description:
                    accountProc.error ?? "No pudimos procesar los datos de la Cuenta de Cobro.",
                  showIcon: true,
                  showCloseButton: true,
                });
                setIsProcessing(false);
                return;
              }

              const rutMapped = toExtractedFields(rutProc.fields);
              const accountMapped = toExtractedFields(accountProc.fields);

              // 3. Consolidamos los datos
              // Datos del emisor vienen del RUT, datos financieros e identificadores de la cuenta de cobro
              const consolidatedFields = {
                ...accountMapped,
                proveedor: rutMapped.proveedor || accountMapped.proveedor,
                nit: rutMapped.nit || accountMapped.nit,
                direccion: rutMapped.direccion || accountMapped.direccion,
                telefono: rutMapped.telefono || accountMapped.telefono,
                departamento: rutMapped.departamento || accountMapped.departamento,
                municipio: rutMapped.municipio || accountMapped.municipio,
              };

              // 4. Guardamos ambos documentos en el local store
              const rutDoc = addDocument({
                fileName: rutFile.name,
                fileType: rutFile.type || "application/octet-stream",
                fileSize: rutFile.size,
                role: getRole(),
                status: "processing",
                purpose: "rut",
                extracted: rutMapped,
                ...(ceco.trim() ? { ceco: ceco.trim() } : {}),
              });

              const accountDoc = addDocument({
                fileName: accountFile.name,
                fileType: accountFile.type || "application/octet-stream",
                fileSize: accountFile.size,
                role: getRole(),
                status: "processing",
                purpose: "collection-account",
                relatedDocumentId: rutDoc.id,
                extracted: consolidatedFields,
                ...(ceco.trim() ? { ceco: ceco.trim() } : {}),
              });

              updateDocument(rutDoc.id, { relatedDocumentId: accountDoc.id });

              addExpenseToLegalization(draft.id, rutDoc.id);
              addExpenseToLegalization(draft.id, accountDoc.id);

              setIsProcessing(false);
              navigate(`/review?doc=${encodeURIComponent(accountDoc.id)}`);
            })
            .catch((err: unknown) => {
              toast({
                type: "error",
                title: "Error de procesamiento",
                description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
                showIcon: true,
                showCloseButton: true,
              });
              setIsProcessing(false);
            });
        })
        .catch((err: unknown) => {
          toast({
            type: "error",
            title: "Error al validar documentos",
            description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
            showIcon: true,
            showCloseButton: true,
          });
          setIsProcessing(false);
        });
    }
  };

  const canContinue = flow === "invoice" ? Boolean(invoiceFile) : Boolean(rutFile && accountFile);

  return (
    <div className="flex min-h-screen flex-col bg-secondary-100">
      <LegalizacionHeader variant="upload" />
      {flow === null ? (
        <UploadSelection onSelect={setFlow} />
      ) : (
        <main className="flex flex-1 flex-col items-center px-6 pt-8 pb-32">
          <div className="w-full max-w-4xl space-y-6">
            <Button variant="ghost" action={() => setFlow(null)} className="min-h-12 px-4">
              <LuArrowLeft className="mr-2 h-5 w-5" />
              Volver
            </Button>

            <header className="space-y-2 text-center">
              <Typography variant="h4" className="text-primary">
                {flow === "invoice" ? "Cargar facturas" : "Cargar cuenta de cobro"}
              </Typography>
              <Typography variant="body1" className="text-secondary-600">
                {flow === "invoice"
                  ? "Adjunta una factura o foto para iniciar su revisión."
                  : "Adjunta el RUT y la cuenta de cobro para continuar."}
              </Typography>
            </header>

            {flow === "invoice" ? (
              <div className="space-y-5 rounded-2xl border border-secondary-400 bg-white p-6 md:p-8">
                <div className="space-y-2">
                  <Select
                    showSearch
                    label="Centro de costo (CECO)"
                    placeholder={
                      cecosLoading ? "Cargando centros de costo…" : "Busca por código o nombre"
                    }
                    options={cecoOptions}
                    value={ceco}
                    onChange={(value) => setCeco(Array.isArray(value) ? (value[0] ?? "") : value)}
                    disabled={cecosLoading || cecoOptions.length === 0}
                    color={cecosError ? "error" : "default"}
                    helperText={
                      cecosError ?? "Selecciona el centro de costo al que se facturará este gasto."
                    }
                  />
                  {cecosError && (
                    <Button
                      variant="ghost"
                      action={loadCecos}
                      disabled={cecosLoading}
                      className="min-h-10 px-3"
                    >
                      <LuRefreshCw className="mr-2 h-4 w-4" />
                      Reintentar cargar CECOs
                    </Button>
                  )}
                </div>
                <FileUploader
                  label="Factura"
                  description="PDF, JPG o PNG"
                  file={invoiceFile}
                  onChange={setInvoiceFile}
                  allowCamera
                />
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                <FileUploader
                  label="RUT"
                  description="Documento obligatorio en PDF, JPG o PNG"
                  file={rutFile}
                  onChange={setRutFile}
                  allowCamera
                />
                <FileUploader
                  label="Cuenta de cobro"
                  description="Documento principal en PDF, JPG o PNG"
                  file={accountFile}
                  onChange={setAccountFile}
                  allowCamera
                />
              </div>
            )}

            <Alert
              variant="outline"
              type="info"
              title="Formatos soportados"
              description="PDF, JPG o PNG. Tamaño máximo sugerido: 10 MB por archivo."
              showIcon
            />
          </div>
        </main>
      )}

      {flow !== null && (
        <footer className="fixed bottom-6 left-1/2 z-50 flex h-20 w-full max-w-4xl -translate-x-1/2 items-center justify-end gap-3 rounded-full border border-secondary-400 bg-white px-6 shadow-lg">
          <Button variant="outlined" className="px-8" action={() => navigate("/me")}>
            <LuCircleX className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button disabled={!canContinue || isProcessing} className="px-8" action={handleContinue}>
            {isProcessing ? (
              <>
                <LuRefreshCw className="mr-2 h-5 w-5 animate-spin" />
                Procesando…
              </>
            ) : (
              "Continuar"
            )}
          </Button>
        </footer>
      )}
    </div>
  );
};

interface UploadSelectionProps {
  onSelect: (flow: UploadFlow) => void;
}

const UploadSelection = ({ onSelect }: UploadSelectionProps) => (
  <main className="flex flex-1 items-center justify-center px-6 py-12">
    <div className="w-full max-w-5xl space-y-10">
      <header className="space-y-3 text-center">
        <Typography variant="h2" className="text-secondary-900">
          Bienvenido al portal de legalización
        </Typography>
        <Typography variant="body1" className="text-secondary-600">
          Selecciona el tipo de documento que deseas cargar.
        </Typography>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        <SelectionCard
          title="Cargar facturas"
          description="Carga una factura o toma una foto para revisar sus datos."
          icon={<LuReceiptText className="h-10 w-10" />}
          action={() => onSelect("invoice")}
        />
        <SelectionCard
          title="Cargar cuenta de cobro"
          description="Adjunta el RUT y la cuenta de cobro en un mismo proceso."
          icon={<LuFiles className="h-10 w-10" />}
          action={() => onSelect("collection-account")}
        />
      </div>
    </div>
  </main>
);

interface SelectionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
}

const SelectionCard = ({ title, description, icon, action }: SelectionCardProps) => (
  <div className="flex min-h-72 flex-col items-start justify-between rounded-2xl border border-secondary-400 bg-white p-8 shadow-sm transition-shadow hover:shadow-lg">
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary">
      {icon}
    </div>
    <div className="space-y-3">
      <Typography variant="h3" className="text-secondary-900">
        {title}
      </Typography>
      <Typography variant="body1" className="text-secondary-600">
        {description}
      </Typography>
    </div>
    <Button className="min-h-12 w-full" action={action}>
      Seleccionar
    </Button>
  </div>
);

interface FileUploaderProps {
  label: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
  allowCamera?: boolean;
}

const FileUploader = ({ label, description, file, onChange, allowCamera }: FileUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.files?.[0] ?? null);
    event.target.value = "";
  };

  return (
    <section className="flex min-h-72 flex-col justify-between rounded-2xl border border-secondary-400 bg-white p-6">
      <div className="space-y-2">
        <Typography variant="h4" className="text-secondary-900">
          {label}
        </Typography>
        <Typography variant="body2" className="text-secondary-600">
          {description}
        </Typography>
      </div>

      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary bg-primary-50 p-4">
          <LuFileCheck className="h-6 w-6 shrink-0 text-primary" />
          <Typography variant="body2" className="min-w-0 flex-1 truncate text-secondary-900">
            {file.name}
          </Typography>
          <Button
            variant="ghost"
            isIcon
            aria-label={`Quitar ${label}`}
            action={() => onChange(null)}
          >
            <LuCircleX className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-5 text-center text-secondary-600">
          <LuFileText className="h-10 w-10 text-primary" />
          <Typography variant="body2">Ningún archivo seleccionado</Typography>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant={file ? "outlined" : "contained"}
          className="min-h-12 flex-1"
          action={() => inputRef.current?.click()}
        >
          <LuUpload className="mr-2 h-4 w-4" />
          {file ? "Reemplazar documento" : "Subir documento"}
        </Button>
        {allowCamera && (
          <Button
            variant="outlined"
            className="min-h-12 flex-1"
            action={() => cameraRef.current?.click()}
          >
            <LuCamera className="mr-2 h-4 w-4" />
            Tomar foto
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFile}
        className="hidden"
        aria-label={`Seleccionar ${label}`}
      />
      {allowCamera && (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
          aria-label={`Tomar foto de ${label}`}
        />
      )}
    </section>
  );
};
