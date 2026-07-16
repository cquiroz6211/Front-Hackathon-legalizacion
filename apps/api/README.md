# apps/api — Backend de Legalización de Gastos (Express)

Servidor HTTP autónomo que orquesta las integraciones del portal. Migrado desde
los Route Handlers de Next.js, reutilizando **intacta** la lógica de integración
en `src/lib/server/`.

## Stack

- **Express 4** + **CORS** + **dotenv**.
- **TypeScript** ejecutado con **tsx** (sin paso de build en dev).
- `pdf-to-img` para convertir PDFs a imagen (compuerta de validación con visión).

## Ejecutar

```bash
# desde la raíz del monorepo
npm run dev:api            # tsx watch → http://localhost:3001

# o de forma autónoma (sin el registro privado de Comfama)
cd apps/api
npm install --no-workspaces
npm run dev
```

Requiere `apps/api/.env` (copia de `.env.example`) con credenciales reales.

## Arquitectura

```
src/
├── index.ts              # carga .env (dotenv) + app.listen(PORT)
├── app.ts                # express(): CORS, json(25mb), monta routers en /api,
│                         #            404 JSON y manejador de errores JSON
├── routes/               # una capa HTTP fina por endpoint
│   ├── health.ts  process.ts  ocr.ts  extract.ts  validate.ts
│   └── cecos.ts   contabilizacion.ts  archive.ts   openapi.ts
└── lib/
    ├── types.ts          # ExtractedFields (shape que produce el backend)
    └── server/           # integración (reusada de Next.js, ver MIGRACION.md)
        ├── config.ts             # lee credenciales de process.env
        ├── documentIntelligence.ts   # Azure DI (OCR prebuilt-layout)
        ├── azureOpenAI.ts            # Azure OpenAI (validación visión + extracción)
        ├── prompts.ts                # prompts de validación y extracción
        ├── pdf.ts                    # PDF → PNG (pdf-to-img)
        ├── comfama.ts                # tokenizer JWT + CECOs
        ├── sap.ts                    # Contabilización de Legados FI
        ├── docuware.ts               # archivado documental
        └── openapi.ts                # spec OpenAPI 3.0
```

Los routers solo hacen: parsear entrada → llamar a `lib/server` → responder
`{ ok, ... }`. Toda la lógica de negocio/red vive en `lib/server`.

## Endpoints (todos bajo `/api`)

| Método | Ruta                 | Body / Query                                   | Respuesta OK |
|--------|----------------------|------------------------------------------------|--------------|
| GET    | `/health`            | —                                              | `{ ok, services }` (qué integraciones tienen credenciales) |
| POST   | `/process`           | `{ fileBase64, fileName?, fileType? }`         | `{ ok, fields, ocr:{ content } }` (OCR + extracción IA) |
| POST   | `/ocr`               | `{ fileBase64, fileName?, fileType? }`         | `{ ok, ocr:{ content, tables } }` (solo OCR) |
| POST   | `/extract`           | `{ ocrText }`                                  | `{ ok, fields }` (extracción desde texto) |
| POST   | `/validate`          | `{ fileBase64, fileType? }`                    | `{ ok, quality, convertedFromPdf }` (legibilidad, visión) |
| GET    | `/cecos`             | `?dateto=YYYYMMDD` (opcional)                  | `{ ok, count, cecos }` (Centros de Costo) |
| POST   | `/contabilizacion`   | documento SAP (pass-through)                   | `{ ok, sapStatus, data }` |
| GET    | `/contabilizacion`   | `?numDocExterno=...`                           | `{ ok, sapStatus, numeroDocumento, data }` |
| POST   | `/archive`           | `{ fileBase64, fileName, fileType?, fields, extraIndex? }` | `{ ok, documentId, fileCabinetId }` (DocuWare) |
| GET    | `/openapi`           | —                                              | Spec OpenAPI 3.0 (JSON) |

Errores: `{ ok:false, error }` con status `400` (entrada inválida / JSON
inválido), `405` (método no permitido, con header `Allow`), `415` (tipo no
soportado en validate), `422` (OCR sin texto), `502` (fallo de la integración
externa), `404` (ruta no encontrada), `500` (error interno).

## Variables de entorno

Ver `.env.example`. Grupos: `AZURE_DI_*` (Document Intelligence),
`AZURE_OPENAI_*` (validación + extracción), `DOCUWARE_*` (archivado),
`COMFAMA_*` (tokenizer JWT, CECOs, SAP). `PORT` por defecto `3001`.

`GET /api/health` reporta qué grupos tienen credenciales **presentes** (no valida
que sean correctas).
