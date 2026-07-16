import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuCamera, LuCircleX, LuFileText, LuRefreshCw, LuUpload } from "react-icons/lu";

import { Alert, Button, Input, Typography, useToast } from "@comfama/comfama-ui-react";

import {
  addDocument,
  addExpenseToLegalization,
  getOrCreateDraftLegalization,
  getRole,
} from "./lib/store";
import { LegalizacionHeader } from "./components/LegalizacionHeader";

const ACCEPTED_TYPES = ".pdf,.jpg,.png";

/**
 * Vista de carga de gastos (ruta `/upload`).
 * Dropzone + botón cámara; al confirmar, persiste el documento y crea un borrador
 * de legalización si no existe, navegando a `/review?doc=<id>` para validar
 * los datos extraídos.
 */
export const UploadPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [ceco, setCeco] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleContinue = () => {
    if (!file) return;
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const role = getRole();
        const trimmedCeco = ceco.trim();
        const draft = getOrCreateDraftLegalization();
        const record = addDocument({
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          role,
          status: "upload",
          ...(trimmedCeco ? { ceco: trimmedCeco } : {}),
        });
        addExpenseToLegalization(draft.id, record.id);
        navigate(`/review?doc=${encodeURIComponent(record.id)}`);
      } catch (err) {
        setIsProcessing(false);
        toast({
          type: "error",
          title: "No pudimos guardar el documento",
          description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
          showIcon: true,
          showCloseButton: true,
        });
      }
    }, 1200);
  };

  return (
    <div className="flex min-h-screen flex-col bg-secondary-100">
      <LegalizacionHeader variant="upload" />

      <main className="flex flex-1 flex-col items-center justify-center px-6 pt-8 pb-32">
        <div className="w-full max-w-4xl space-y-8">
          <header className="text-center space-y-2">
            <Typography variant="h4" className="text-primary">
              Carga de gastos
            </Typography>
            <Typography variant="body1" className="text-secondary-600">
              Realizar la carga individual de facturas para iniciar el proceso de legalización.
            </Typography>
          </header>

          <div
            className={`h-[480px] rounded-2xl bg-white flex flex-col items-center justify-center transition-all duration-300 relative group cursor-pointer overflow-hidden border-2 border-secondary-400 hover:border-primary ${
              isDragging ? "!border-primary !bg-primary-50" : ""
            } ${file ? "!border-primary" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            <div
              className="absolute top-0 left-0 right-0 z-20 px-6 pt-5 pb-3 flex items-center gap-3 bg-white/80 backdrop-blur-sm border-b border-secondary-400"
              onClick={(e) => e.stopPropagation()}
            >
              <label
                htmlFor="legalizacion-upload-ceco"
                className="text-xs font-bold text-secondary-600 uppercase tracking-widest whitespace-nowrap"
              >
                Centro de costo (CECO)
              </label>
              <Input
                id="legalizacion-upload-ceco"
                value={ceco}
                onChange={(e) => setCeco(e.target.value)}
                placeholder="700-OP-24"
                className="flex-1"
              />
            </div>

            {!file ? (
              <div
                className="flex flex-col items-center text-center px-6 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 text-primary">
                  <LuUpload className="w-8 h-8" />
                </div>
                <Typography variant="h3" className="text-secondary-900">
                  Arrastre y <span className="font-bold">Suelte</span>
                </Typography>
                <Typography variant="body2" className="text-secondary-600 max-w-md mt-2">
                  Seleccione archivos de su ordenador o arrástrelos directamente a esta zona para
                  comenzar el procesamiento.
                </Typography>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Button action={() => fileInputRef.current?.click()} className="px-6">
                    <LuUpload className="w-4 h-4 mr-2" />
                    Seleccionar archivo
                  </Button>
                  <Button
                    variant="outlined"
                    action={() => cameraInputRef.current?.click()}
                    className="px-6"
                  >
                    <LuCamera className="w-4 h-4 mr-2" />
                    Tomar foto
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md px-6 z-10" onClick={(e) => e.stopPropagation()}>
                <div className="bg-secondary-100 border border-secondary-400 rounded-md p-3 flex items-center gap-4">
                  <LuFileText className="w-6 h-6 text-primary" />
                  <span className="font-mono text-sm flex-grow truncate text-secondary-900">
                    {file.name}
                  </span>
                  <Button
                    variant="ghost"
                    isIcon
                    size="sm"
                    aria-label="Quitar archivo"
                    action={() => setFile(null)}
                    className="text-error hover:bg-primary-50"
                  >
                    <LuCircleX className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              accept={ACCEPTED_TYPES}
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <Alert
            variant="outline"
            type="info"
            title="Formatos soportados"
            description="PDF, JPG o PNG. Tamaño máximo sugerido: 10 MB."
            showIcon
          />
        </div>
      </main>

      <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-4xl bg-white border border-secondary-400 h-20 flex items-center justify-center px-6 z-50 rounded-full shadow-lg">
        <div className="w-full flex items-center justify-end gap-3">
          <Button variant="outlined" className="px-8" action={() => navigate("/me")}>
            <LuCircleX className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button disabled={!file || isProcessing} className="px-8" action={handleContinue}>
            {isProcessing ? (
              <>
                <LuRefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Procesando…
              </>
            ) : (
              "Continuar"
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
};
