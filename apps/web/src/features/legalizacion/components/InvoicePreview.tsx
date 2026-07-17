import type { ExtractedFields } from "../types/document";

interface InvoicePreviewProps {
  fields: ExtractedFields;
  fileName?: string;
}

const DEFAULT_INVOICE_NUMBER = "0001-00002834";
const DEFAULT_AMOUNT = "559.625,00";

/** Facsímil sintético de factura usado en /review y en la fila expandida de /me. */
export const InvoicePreview = ({ fields, fileName }: InvoicePreviewProps) => {
  const nroFactura = fields.nroFactura || DEFAULT_INVOICE_NUMBER;
  const monto = fields.monto || DEFAULT_AMOUNT;

  return (
    <div className="flex-1 flex p-8 overflow-auto bg-secondary-100">
      <div className="m-auto bg-white shadow-lg w-full max-w-2xl aspect-[1/1.41] p-8 flex flex-col gap-6 border border-secondary-400 text-secondary-900">
        <div className="flex justify-between items-start border-b border-secondary-400 pb-4">
          <div className="space-y-2">
            <div className="h-8 w-32 bg-secondary-400 rounded" />
            <div className="h-4 w-48 bg-secondary-100 rounded" />
          </div>
          <div className="text-right">
            <p className="font-bold text-lg">FACTURA</p>
            <p className="text-secondary-600">N° {nroFactura}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="h-3 w-full bg-secondary-100 rounded" />
            <div className="h-3 w-3/4 bg-secondary-100 rounded" />
            <div className="h-3 w-5/6 bg-secondary-100 rounded" />
          </div>
          <div className="space-y-4">
            <div className="h-3 w-full bg-secondary-100 rounded" />
            <div className="h-3 w-3/4 bg-secondary-100 rounded" />
            <div className="h-3 w-5/6 bg-secondary-100 rounded" />
          </div>
        </div>

        <div className="flex-1 border-y border-secondary-400 py-4 mt-8">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-secondary-400">
                <th className="pb-2">DESCRIPCIÓN</th>
                <th className="pb-2 text-right">CANT.</th>
                <th className="pb-2 text-right">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-secondary-100">
                <td className="py-2">Servicio Flete Larga Distancia</td>
                <td className="py-2 text-right">1</td>
                <td className="py-2 text-right">$450.000,00</td>
              </tr>
              <tr className="border-b border-secondary-100">
                <td className="py-2">Peajes Consolidado</td>
                <td className="py-2 text-right">1</td>
                <td className="py-2 text-right">$12.500,00</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-4">
          <div className="w-1/2 space-y-2">
            <div className="flex justify-between">
              <span className="text-xs font-semibold">IVA (21%):</span>
              <span className="font-mono text-sm">$97.125,00</span>
            </div>
            <div className="flex justify-between border-t border-secondary-400 pt-2">
              <span className="font-bold">TOTAL:</span>
              <span className="font-bold font-mono text-sm">${monto}</span>
            </div>
          </div>
        </div>

        {fileName ? <p className="text-xs text-secondary-600 truncate">{fileName}</p> : null}
      </div>
    </div>
  );
};
