import { useMemo } from "react";
import { LuFileX } from "react-icons/lu";

import { getDocumentFileBase64 } from "../lib/store";

interface DocumentFilePreviewProps {
  docId: string;
  fileName: string;
  fileType: string;
  /** Alto del contenedor de la previsualización (Tailwind, p.ej. "h-96"). */
  heightClassName?: string;
}

function toDataUrl(base64: string, fileType: string): string {
  return `data:${fileType || "application/octet-stream"};base64,${base64}`;
}

/**
 * Previsualiza el archivo REAL subido (PDF o imagen), leyendo el base64
 * persistido en el store (`setDocumentFileBase64`, ver `UploadPage`). Usado en
 * `/me` (el colaborador revisa lo que subió) y `/gestor` (el gestor SAP
 * revisa el soporte antes de aprobar/rechazar).
 *
 * Si el base64 no está disponible (subido en otro navegador/sesión, o
 * expulsado del localStorage por cuota), se muestra un aviso honesto en vez
 * de un facsímil sintético que podría confundirse con el documento real.
 */
export const DocumentFilePreview = ({
  docId,
  fileName,
  fileType,
  heightClassName = "h-96",
}: DocumentFilePreviewProps) => {
  const dataUrl = useMemo(() => {
    const base64 = getDocumentFileBase64(docId);
    return base64 ? toDataUrl(base64, fileType) : null;
  }, [docId, fileType]);

  if (!dataUrl) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-secondary-400 bg-secondary-100 p-6 text-center text-xs text-secondary-600 ${heightClassName}`}
      >
        <LuFileX className="h-6 w-6 text-secondary-600" aria-hidden="true" />
        <p>Vista previa no disponible: el archivo no quedó guardado en este navegador.</p>
      </div>
    );
  }

  if (fileType === "application/pdf") {
    return (
      <iframe
        title={`Previsualización de ${fileName}`}
        src={dataUrl}
        className={`w-full rounded-xl border border-secondary-400 bg-secondary-100 ${heightClassName}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center overflow-auto rounded-xl border border-secondary-400 bg-secondary-100 p-2 ${heightClassName}`}
    >
      <img
        src={dataUrl}
        alt={`Previsualización de ${fileName}`}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
};
