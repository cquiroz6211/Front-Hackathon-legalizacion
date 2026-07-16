/**
 * Especificación OpenAPI 3.0 del backend, escrita a mano.
 * Se sirve en GET /api/openapi y se renderiza en /docs con Swagger UI.
 *
 * Al agregar/cambiar un endpoint, actualiza este documento.
 */

const extractedFieldsSchema = {
  type: "object",
  description: 'Campos extraídos de la factura (todos string; "" si no aplica).',
  properties: {
    fecha: { type: "string", example: "2023-10-25" },
    nroFactura: { type: "string", example: "0001-00002834" },
    cliente: { type: "string", example: "Comfama" },
    nitCliente: { type: "string", example: "890.900.840-9" },
    proveedor: { type: "string", example: "Logística del Sur S.A." },
    nit: { type: "string", example: "900.123.456-7" },
    direccion: { type: "string", example: "Calle 100 #15-20" },
    telefono: { type: "string", example: "+57 (601) 742 8593" },
    departamento: { type: "string", example: "Cundinamarca" },
    municipio: { type: "string", example: "Bogotá D.C." },
    iva19Base: { type: "string", example: "420.000,00" },
    iva19Valor: { type: "string", example: "79.800,00" },
    iva5Base: { type: "string", example: "50.000,00" },
    iva5Valor: { type: "string", example: "2.500,00" },
    iva0Base: { type: "string", example: "0,00" },
    iva0Valor: { type: "string", example: "0,00" },
    totalFactura: { type: "string", example: "559.625,00" },
  },
} as const;

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "API — Legalización de Gastos",
    version: "1.0.0",
    description:
      "Backend de legalización de gastos de viaje. Orquesta Azure Document " +
      "Intelligence (OCR), Azure OpenAI (extracción estructurada) y DocuWare (archivado).",
  },
  servers: [{ url: "/", description: "Servidor actual" }],
  tags: [
    {
      name: "IA · Validación",
      description: "Prompt 1 · Azure OpenAI (visión): legibilidad de la imagen",
    },
    {
      name: "OCR · Document Intelligence",
      description: "Azure Document Intelligence (prebuilt-layout): texto y tablas",
    },
    {
      name: "IA · Extracción",
      description: "Prompt 2 · Azure OpenAI: campos estructurados desde el OCR",
    },
    { name: "Orquestación", description: "OCR + extracción en una sola llamada" },
    { name: "Archivado", description: "Almacenamiento documental en DocuWare" },
    { name: "Comfama", description: "Datos maestros de Comfama (CECOs)" },
    { name: "SAP", description: "Contabilización de Legados FI (crear/consultar)" },
    { name: "Estado", description: "Salud del servicio" },
  ],
  paths: {
    "/api/cecos": {
      get: {
        tags: ["Comfama"],
        summary: "Lista de Centros de Costo (CECOs)",
        description:
          "Obtiene los CECOs desde la API de Comfama. Internamente pide un JWT al " +
          "tokenizer (con caché) y consulta el endpoint OData de CECOs.",
        parameters: [
          {
            name: "dateto",
            in: "query",
            required: false,
            schema: { type: "string", example: "20250915" },
            description: "Fecha YYYYMMDD del filtro. Por defecto, la fecha actual.",
          },
        ],
        responses: {
          "200": {
            description: "Listado de CECOs",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    count: { type: "integer", example: 42 },
                    cecos: {
                      type: "array",
                      items: { type: "object", additionalProperties: true },
                    },
                  },
                },
              },
            },
          },
          "502": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/contabilizacion": {
      post: {
        tags: ["SAP"],
        summary: "Crea la contabilización en SAP",
        description:
          "Reenvía el documento SAP (FI) a integraciones Comfama, agregando el JWT " +
          "(Bearer), apikey e id_fuente. El body es el documento completo (pass-through).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                description: "Documento SAP (info_mensaje + documentos[...]).",
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          "200": { $ref: "#/components/responses/SapResult" },
          "400": { $ref: "#/components/responses/Error" },
          "502": { $ref: "#/components/responses/SapResult" },
        },
      },
      get: {
        tags: ["SAP"],
        summary: "Consulta una contabilización por documento externo",
        description: "Verifica si la contabilización se creó, filtrando por NUM_DOC_EXTERNO.",
        parameters: [
          {
            name: "numDocExterno",
            in: "query",
            required: true,
            schema: { type: "string", example: "CGI0043-prueba" },
            description: "Número de documento externo (NUM_DOC_EXTERNO).",
          },
        ],
        responses: {
          "200": { $ref: "#/components/responses/SapResult" },
          "400": { $ref: "#/components/responses/Error" },
          "502": { $ref: "#/components/responses/SapResult" },
        },
      },
    },
    "/api/health": {
      get: {
        tags: ["Estado"],
        summary: "Estado de las integraciones",
        description:
          "Reporta qué integraciones tienen credenciales configuradas. No hace llamadas de red.",
        responses: {
          "200": {
            description: "Estado de credenciales por servicio",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    services: {
                      type: "object",
                      properties: {
                        documentIntelligence: { type: "boolean" },
                        azureOpenAI: { type: "boolean" },
                        docuware: { type: "boolean" },
                        comfamaCecos: { type: "boolean" },
                        sapContabilizacion: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/validate": {
      post: {
        tags: ["IA · Validación"],
        summary: "Prompt 1 · Valida legibilidad de la imagen (Azure OpenAI visión)",
        description:
          "Compuerta previa al OCR: envía la imagen a Azure OpenAI (visión) para " +
          "evaluar legibilidad, iluminación, enfoque y encuadre. Si legible=false, " +
          "pide recapturar. Acepta JPG/PNG y también PDF (se convierte la primera " +
          "página a PNG automáticamente antes de validar).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fileBase64"],
                properties: {
                  fileBase64: {
                    type: "string",
                    description: "Imagen o PDF en base64 (crudo o data URL).",
                  },
                  fileType: { type: "string", example: "application/pdf" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Resultado de la validación",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    quality: { $ref: "#/components/schemas/QualityCheck" },
                    convertedFromPdf: {
                      type: "boolean",
                      description: "true si el input era PDF y se convirtió a PNG.",
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/Error" },
          "415": { $ref: "#/components/responses/Error" },
          "502": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/ocr": {
      post: {
        tags: ["OCR · Document Intelligence"],
        summary: "OCR con Azure Document Intelligence (prebuilt-layout)",
        description:
          "Ejecuta SOLO el OCR: recibe un documento (imagen o PDF) en base64 y " +
          "devuelve el texto reconstruido y las tablas detectadas. No llama a OpenAI. " +
          "Patrón asíncrono interno: submit → operation-location → poll.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fileBase64"],
                properties: {
                  fileBase64: {
                    type: "string",
                    description: "Contenido del archivo en base64 (crudo o data URL).",
                  },
                  fileName: { type: "string", example: "factura.pdf" },
                  fileType: { type: "string", example: "application/pdf" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Texto y tablas del OCR",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    ocr: { $ref: "#/components/schemas/OcrResult" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/Error" },
          "502": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/extract": {
      post: {
        tags: ["IA · Extracción"],
        summary: "Prompt 2 · Extrae campos desde el texto OCR (Azure OpenAI)",
        description:
          "Recibe el texto OCR (p.ej. la salida de /api/ocr) y devuelve el objeto " +
          "de campos estructurados. No ejecuta OCR.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["ocrText"],
                properties: {
                  ocrText: { type: "string", description: "Texto plano del OCR." },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Campos extraídos",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    fields: { $ref: "#/components/schemas/ExtractedFields" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/Error" },
          "502": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/process": {
      post: {
        tags: ["Orquestación"],
        summary: "Todo en uno · OCR (Document Intelligence) + extracción (Azure OpenAI)",
        description:
          "Atajo que ejecuta /api/ocr y /api/extract en una sola llamada: recibe un " +
          "documento en base64 y devuelve los campos ya extraídos.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fileBase64"],
                properties: {
                  fileBase64: {
                    type: "string",
                    description: "Contenido del archivo en base64 (crudo o data URL).",
                  },
                  fileName: { type: "string", example: "factura.pdf" },
                  fileType: { type: "string", example: "application/pdf" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Campos extraídos",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    fields: { $ref: "#/components/schemas/ExtractedFields" },
                    ocr: {
                      type: "object",
                      properties: { content: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/Error" },
          "422": { $ref: "#/components/responses/Error" },
          "502": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/archive": {
      post: {
        tags: ["Archivado"],
        summary: "Archivar en DocuWare",
        description: "Guarda el binario y sus índices en el file cabinet configurado.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fileBase64", "fileName", "fields"],
                properties: {
                  fileBase64: { type: "string" },
                  fileName: { type: "string", example: "factura.pdf" },
                  fileType: { type: "string", example: "application/pdf" },
                  fields: { $ref: "#/components/schemas/ExtractedFields" },
                  extraIndex: {
                    type: "object",
                    additionalProperties: { type: "string" },
                    example: { CECO: "12345" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Documento archivado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    documentId: { oneOf: [{ type: "number" }, { type: "string" }] },
                    fileCabinetId: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/Error" },
          "502": { $ref: "#/components/responses/Error" },
        },
      },
    },
  },
  components: {
    schemas: {
      ExtractedFields: extractedFieldsSchema,
      OcrResult: {
        type: "object",
        description: "Salida del OCR de Document Intelligence.",
        properties: {
          content: { type: "string", description: "Texto plano reconstruido del documento." },
          tables: {
            type: "array",
            description: "Tablas detectadas.",
            items: {
              type: "object",
              properties: {
                rowCount: { type: "integer" },
                columnCount: { type: "integer" },
                cells: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      rowIndex: { type: "integer" },
                      columnIndex: { type: "integer" },
                      content: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      QualityCheck: {
        type: "object",
        description: "Resultado de la validación de legibilidad (Prompt 1).",
        properties: {
          legible: { type: "boolean", example: true },
          calidad: { type: "string", enum: ["buena", "regular", "mala"], example: "buena" },
          confianza: { type: "number", format: "float", example: 0.92 },
          problemas: {
            type: "array",
            items: { type: "string" },
            example: ["Reflejo en la esquina superior derecha"],
          },
          recomendacion: {
            type: "string",
            example: "Imagen apta. Puedes continuar con la extracción.",
          },
        },
      },
    },
    responses: {
      Error: {
        description: "Error",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                ok: { type: "boolean", example: false },
                error: { type: "string" },
              },
            },
          },
        },
      },
      SapResult: {
        description: "Resultado de SAP (incluye el status HTTP y el cuerpo devueltos por SAP).",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                ok: { type: "boolean", example: true },
                sapStatus: { type: "integer", example: 200 },
                numeroDocumento: {
                  type: "string",
                  nullable: true,
                  description: "Número de documento SAP extraído (solo en el GET de consulta).",
                  example: "1900012345",
                },
                data: { description: "Cuerpo devuelto por SAP (objeto o texto)." },
              },
            },
          },
        },
      },
    },
  },
} as const;
