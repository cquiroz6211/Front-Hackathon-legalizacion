# Migración Next.js → Monorepo (Vite + Express)

Registro de la migración del backend y su integración con el frontend Vite.

## Contexto

- El desarrollo original era una app **Next.js** (`hackaton/`) con la UI y el
  backend como **Route Handlers** (`app/api/**`).
- Por política de empresa, el frontend se rehízo sobre el **baseline Vite de
  Comfama** (`apps/web`).
- El backend ya existía y funcionaba, así que se **migró a un servidor Express
  autónomo** (`apps/api`) en lugar de reescribirlo, y se conservó como monorepo
  (npm workspaces) para que ambos convivan y el front lo consuma por HTTP.

## Qué se movió

| Origen (Next.js `hackaton/`)     | Destino (monorepo)                          |
|----------------------------------|---------------------------------------------|
| `app/api/<x>/route.ts` (×9)      | `apps/api/src/routes/<x>.ts`                |
| `lib/server/*`                   | `apps/api/src/lib/server/*` (**sin cambios de lógica**) |
| `ExtractedFields` de `lib/store` | `apps/api/src/lib/types.ts`                 |
| `lib/api.ts` (cliente)           | `apps/web/src/features/legalizacion/lib/api.ts` |
| Baseline Vite (raíz)             | `apps/web/`                                 |

## Capa HTTP: Next → Express

El acoplamiento a Next era mínimo: los handlers usaban `Request` web y
`NextResponse.json()`. La adaptación fue mecánica y **preserva el comportamiento
observable** (mismos status, misma forma de respuesta, mismas validaciones):

- `NextResponse.json(body, { status })` → `res.status(status).json(body)`.
- `new URL(req.url).searchParams` → `req.query`.
- `await req.json()` → `req.body` (con `express.json({ limit: '25mb' })`, porque
  los documentos viajan en base64).
- El parseo de JSON inválido, antes en cada handler, ahora lo centraliza un
  **manejador de errores** en `app.ts` (mismo mensaje `"JSON inválido en el body."`).
- `express.json({ type: () => true })` parsea el body sin depender del header
  `Content-Type` (paridad con `req.json()` de Next).
- Para métodos HTTP no soportados sobre una ruta existente, un middleware en
  `app.ts` responde **405** con header `Allow` (paridad con el App Router de
  Next, que devuelve 405 automático) en vez del 404 genérico.

## Cambios al código reusado de `lib/server`

`lib/server` NO tenía dependencias de Next.js (solo `process.env`, `fetch`,
`Buffer`), por lo que se copió tal cual salvo cuatro ajustes justificados:

1. **`azureOpenAI.ts` y `docuware.ts`** — el `import type { ExtractedFields }`
   pasó de `@/lib/store` (store del frontend) a `../types` (tipo propio del backend).
2. **`pdf.ts`** — `standardFontDataUrl()` ahora resuelve `pdfjs-dist` con
   `createRequire(import.meta.url).resolve(...)` en vez de
   `process.cwd()/node_modules`, porque con npm workspaces el paquete puede quedar
   *hoisteado* en la raíz.
3. **`docuware.ts`** — se quitó el cast DOM `as unknown as BlobPart` de
   `new Blob([bytes])`; bajo los tipos de Node, `Blob` acepta `Buffer` directamente.
4. **`comfama.ts`** — `pickToken()` ahora también busca el JWT **anidado** en
   `{ data: { id_token } }`, que es como responde el tokenizer de Comfama. Antes
   solo miraba el nivel superior y fallaba con "no se encontró el JWT" pese a
   recibirlo. **Este arreglo aplica también al original Next.js.**
5. **Tokenizer por servicio** — `getAccessToken(force, config?)` ahora acepta un
   tokenizer y cachea el JWT **por tokenizer** (`Map` con clave url+apikey). CECOs
   usa el tokenizer por defecto (PROD) y SAP usa `comfamaSapTokenizerConfig()`
   (QA), para operar CECOs y SAP en entornos distintos sin que sus tokens se
   pisen. Requiere `COMFAMA_SAP_TOKENIZER_URL/APIKEY/ORIGIN`.

## Integración con el frontend

- El cliente (`apps/web/.../legalizacion/lib/api.ts`) construye las URLs con
  `env.apiUrl` (`VITE_API_URL`, que **ya incluye** `/api`) y expone
  `validateDocument`, `ocrDocument`, `extractFromText`, `processDocument`,
  `archiveDocument`, `getCecos`, `postContabilizacion`, `getContabilizacion`,
  `getHealth` y el mapper `toExtractedFields`.
- `ExtractedFields` **difiere** entre back y front (el front añade `cuit`,
  `monto`, `kilometraje`, `propina`; el back usa `nitCliente`). Por eso el cliente
  devuelve el shape crudo del backend (`BackendExtractedFields`) y ofrece
  `toExtractedFields()` para mapear al modelo del front.
- Desarrollo sin proxy: el backend habilita **CORS** abierto; el front (5173)
  llama al API (3001) directo.

## Verificación realizada

- `tsc` del backend: **sin errores**.
- Backend en vivo (`tsx`): `GET /api/health` (todas las integraciones con
  credenciales presentes), `GET /api/openapi`, `404`, `405` (con `Allow`) y `400`
  de JSON inválido con respuesta JSON consistente, y cabecera **CORS** presente.
- **Azure OpenAI en vivo**: `POST /api/extract` devolvió `{ ok:true, fields }`
  → la extracción con IA funciona end-to-end.
- **CECOs en vivo (PROD)**: `GET /api/cecos` devuelve `{ ok:true, count:4108, cecos }`.
  Requisitos: tokenizer+CECOs en PROD y `COMFAMA_ORIGIN=https://www.comfama.com`
  (el JWT se acuña según el Origin; con origin de QA, PROD-CECOs da `403`).
- **SAP en vivo (QA)**: `GET /api/contabilizacion?numDocExterno=...` devuelve
  `{ ok:true, sapStatus:200, data }` usando el tokenizer QA propio de SAP.
  CECOs (PROD) y SAP (QA) funcionan simultáneamente.
- Verificación adversarial (workflow de 12 agentes): cliente frontend y edits a
  `lib/server` **sin problemas de contrato**; en las rutas, tras aplicar el 405 y
  el parseo independiente de `Content-Type`, no quedan divergencias observables
  relevantes para el flujo del frontend.

## Pendientes / acciones para el equipo

- **CECOs 403**: `COMFAMA_CECOS_URL` apunta a **producción**
  (`integraciones.comfama.com`) mientras el tokenizer y SAP usan **QA**
  (`integracionesqa.comfama.com`). Alinear el entorno.
- **DocuWare**: credenciales de ejemplo en `.env` — rellenar para probar `/api/archive`.
- **`apps/web`**: requiere el registro privado de Comfama (`.npmrc`) para instalar
  (`@comfama/*`); no se pudo buildear en el entorno de migración.
