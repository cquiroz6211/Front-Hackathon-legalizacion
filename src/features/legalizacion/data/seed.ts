import type { ExtractedFields, DocumentStatus, Role } from "../types/document";

/** Datos demo persistidos solo si el localStorage está vacío (primer arranque). */
export const SEED_DOCUMENTS: Array<{
  fileName: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  role: Role;
  uploadedAt: string;
  ceco?: string;
  extracted?: ExtractedFields;
}> = [
  {
    fileName: "FACTURA_TRANSPORTE_00283.PDF",
    fileType: "application/pdf",
    fileSize: 184_320,
    status: "processing",
    role: "conductor",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    ceco: "700-OP-24",
    extracted: {
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
      propina: "20.000,00",
    },
  },
  {
    fileName: "REMITO_HOTEL_117.JPG",
    fileType: "image/jpeg",
    fileSize: 92_160,
    status: "processing",
    role: "personal",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    ceco: "700-OP-24",
    extracted: {
      fecha: "2023-10-27",
      nroFactura: "FE-1199",
      proveedor: "Hotel Plaza Mayor",
      cliente: "Comfama S.A.",
      cuit: "30-71452896-1",
      nit: "800.221.999-3",
      direccion: "Cra 43A #8-12",
      telefono: "+57 (604) 555 1010",
      departamento: "Antioquia",
      municipio: "Medellín",
      monto: "412.000,00",
      kilometraje: "0",
      iva19Base: "320.000,00",
      iva19Valor: "60.800,00",
      iva5Base: "0,00",
      iva5Valor: "0,00",
      iva0Base: "31.200,00",
      iva0Valor: "0,00",
      totalFactura: "412.000,00",
      propina: "0,00",
    },
  },
  {
    fileName: "RUT_BENEFICIARIO.PDF",
    fileType: "application/pdf",
    fileSize: 56_320,
    status: "upload",
    role: "personal",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
];
