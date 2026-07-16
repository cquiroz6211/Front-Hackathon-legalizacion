/**
 * Tipos compartidos del backend.
 *
 * `ExtractedFields` es el shape que devuelve la extracción con Azure OpenAI
 * (`lib/server/azureOpenAI.ts`) y que consume el archivado en DocuWare
 * (`lib/server/docuware.ts`). Se mantiene aquí, en el paquete `api`, para que el
 * backend compile de forma autónoma sin depender del store del frontend.
 *
 * NOTA: el frontend (`apps/web`) tiene su propio `ExtractedFields` con algunos
 * campos adicionales (cuit, monto, kilometraje, propina). El cliente API del
 * front mapea la respuesta cruda a su modelo; este tipo describe lo que el
 * backend produce.
 */
export interface ExtractedFields {
  fecha: string;
  nroFactura: string;
  cliente: string;
  nitCliente: string;
  proveedor: string;
  nit: string;
  direccion: string;
  telefono: string;
  departamento: string;
  municipio: string;
  iva19Base: string;
  iva19Valor: string;
  iva5Base: string;
  iva5Valor: string;
  iva0Base: string;
  iva0Valor: string;
  totalFactura: string;
}
