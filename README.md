# Legalización de Gastos — Monorepo

Portal de legalización de gastos de viaje. Monorepo con **frontend** (Vite + React,
baseline Comfama) y **backend** (Express) que orquesta OCR, extracción con IA,
Centros de Costo, SAP y DocuWare.

> El backend nació como Route Handlers de Next.js. Por política de empresa el
> frontend se movió a Vite; el backend se migró a un **servidor Express autónomo**
> reutilizando intacta la lógica de integración (`lib/server`). Ver
> [`apps/api/README.md`](./apps/api/README.md) y [`docs/MIGRACION.md`](./docs/MIGRACION.md).

## Estructura

```
.
├── apps/
│   ├── web/          # Frontend Vite + React 19 + React Router (baseline Comfama)
│   │   ├── src/
│   │   │   └── features/legalizacion/
│   │   │       └── lib/api.ts      # ← cliente HTTP que consume el backend
│   │   └── env/                    # VITE_APP_ENV, VITE_API_URL (envDir de Vite)
│   └── api/          # Backend Express (OCR + IA + CECOs + SAP + DocuWare)
│       ├── src/
│       │   ├── index.ts            # bootstrap + listen
│       │   ├── app.ts              # middlewares + montaje de rutas /api/*
│       │   ├── routes/             # 9 endpoints (health, process, ocr, ...)
│       │   └── lib/server/         # lógica de integración (reusada tal cual)
│       └── .env.example
├── package.json      # npm workspaces + scripts de orquestación
├── lefthook.yml      # git hooks (raíz)
└── Pipeline/         # CI
```

## Requisitos

- **Node.js 20+** (probado con Node 25 / npm 11).
- Para `apps/web`: acceso al **registro privado de Comfama (Artifactory)**, porque
  usa `@comfama/comfama-ui-react` y `@comfama/frontend-utils`. Necesitas un
  `.npmrc` (gitignored) con el scope `@comfama` apuntando a ese registro y su token.
  Sin él, `npm install` falla con `404 @comfama/...` — es esperado fuera de la red
  corporativa.

## Instalación

```bash
# En una máquina con el .npmrc de Comfama configurado:
npm install --ignore-scripts   # instala ambos workspaces (lockfile único en la raíz)
```

> **Por qué `--ignore-scripts`:** el `postinstall.cjs` de `@comfama/comfama-ui-react`
> crashea con Node 25 (código `3221226505`). Saltarlo no afecta a Vite/runtime (el
> paquete ya trae su `dist/`). El baseline pide **Node 22.x**; con Node 22 podrías
> omitir el flag. La primera vez, si una instalación previa dejó `node_modules` a
> medias, corre con el server detenido para evitar `EPERM` por archivos en uso.

Solo el backend (deps 100 % públicas, no requiere el registro de Comfama):

```bash
cd apps/api && npm install --no-workspaces
```

## Variables de entorno

| Workspace  | Archivo                         | Cómo crearlo                              |
|------------|---------------------------------|-------------------------------------------|
| `apps/api` | `apps/api/.env`                 | `cp apps/api/.env.example apps/api/.env`  |
| `apps/web` | `apps/web/env/.env.local`       | `cp apps/web/env/.env.local.example apps/web/env/.env.local` |

- `apps/web` → `VITE_API_URL` **ya incluye** el prefijo `/api`
  (por defecto `http://localhost:3001/api`).
- `apps/api` → credenciales de Azure / Comfama / DocuWare. **Nunca** se commitea
  (`.env` está en `.gitignore`); solo se versiona `.env.example`.

## Ejecutar

```bash
npm run dev        # levanta API (3001) y Web (5173) juntos (concurrently)
npm run dev:api    # solo backend  → http://localhost:3001
npm run dev:web    # solo frontend → http://localhost:5173
```

Otros scripts: `npm run build`, `npm run typecheck`, `npm run build:web`,
`npm run build:api`, `npm run start:api`.

## Cómo consume el frontend al backend

El cliente vive en `apps/web/src/features/legalizacion/lib/api.ts` y se exporta
desde la feature:

```ts
import { processDocument, getCecos, toExtractedFields } from "@/features/legalizacion";

const res = await processDocument(file);          // OCR + extracción IA
if (res.ok && res.fields) {
  const fields = toExtractedFields(res.fields);   // mapea al modelo del front
}
```

La base sale de `VITE_API_URL` (`@/config/env`). El backend habilita **CORS**
abierto en desarrollo, así que el front (5173) llama al API (3001) sin proxy.

## Estado y pendientes

- ✅ Backend migrado a Express y **verificado en vivo**: `health`, `openapi`,
  ruteo, manejo de errores y CORS OK. Tokenizer JWT de Comfama funcionando
  end-to-end.
- ✅ **CECOs funcionando end-to-end en PROD** (`{ ok:true, count, cecos }`). Clave:
  `COMFAMA_ORIGIN=https://www.comfama.com` — el JWT se acuña según ese Origin y
  PROD-CECOs devuelve `403` si el token se acuñó con un origin de QA.
- ✅ **SAP funcionando end-to-end en QA** (`/api/contabilizacion` → `sapStatus:200`).
  CECOs y SAP usan **tokenizers independientes** (CECOs PROD, SAP QA) con cachés
  separadas: `COMFAMA_SAP_TOKENIZER_URL/APIKEY/ORIGIN` para SAP.
- ⚠️ **DocuWare** trae valores de ejemplo (`MI-HOST`, `PEGA_AQUI_...`). Rellénalos
  para probar `/api/archive`.
- ⚠️ `apps/web` no se pudo instalar/buildear en este entorno por el registro
  privado de Comfama; el cliente API es type-safe frente a `env.ts` y el contrato
  del backend.
