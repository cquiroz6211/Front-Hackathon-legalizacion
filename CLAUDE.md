# CLAUDE.md

Contexto para Claude Code al trabajar en este repositorio. La **fuente de verdad
completa** es [`AGENTS.md`](./AGENTS.md); este archivo resume lo crítico y lo que
NO debes olvidar en cada tarea.

## Qué es este repo

Plantilla base (baseline) de frontends de Comfama: **React 19 + TypeScript + Vite**,
con **Screaming Architecture** y alineada al Sistema de Diseño de Comfama a través
de la librería `@comfama/comfama-ui-react`.

**Orientación: SPA con rutas internas** (navegación cliente con React Router). NO es
para generar estáticos desde un CMS (Contentful, etc.).

## Reglas innegociables

### Arquitectura — organiza por dominio, no por tipo técnico
- **Funcionalidad nueva ⇒ nueva feature** en `src/features/<dominio>/`. NO pongas
  lógica de dominio en `App.tsx` ni en `shared/`. `App.tsx` solo monta el router.
- **Nombra la feature por su dominio, no por su forma de UI.** Evita `dashboard`/`home`
  para features de negocio (usa `afiliaciones`, `empresas`, ...). La única feature que
  legítimamente se llama `dashboard` es la vista de inicio/panel general.
- Estructura de cada feature: la **page** (`<Nombre>Page.tsx`, objetivo de ruta) va
  en la **raíz** de la feature (visible); los componentes hoja en `components/`.
  Además `hooks/ services/ data/ types/` + un `index.ts` que es su **única API
  pública**. Prohibido importar archivos internos de otra feature; consúmela por su
  `index.ts` (feature→feature vía API pública sí se permite, p. ej. `dashboard` reusa
  `SolicitudesTable` de `afiliaciones`).
- Dependencia en un solo sentido: `features → shared`. `shared/` no importa de
  `features/`.
- El **shell/layout** transversal (Sidebar + Header + `<Outlet/>`) vive en
  `shared/components/layout/`, no en una feature de negocio.
- Imports absolutos con el alias **`@/`** (→ `src/`), p. ej.
  `import { DashboardPage } from '@/features/dashboard'`. Dentro de una misma feature
  usa imports relativos.
- El `*.test.tsx` va **junto** al archivo que prueba.

### Ruteo (SPA)
- `react-router-dom` con `createBrowserRouter` en `src/routes/`.
- Navegación **siempre cliente**: `useNavigate`/`<Link>`/`<NavLink>`. Si un componente
  de la librería (p. ej. `Sidebar`) usaría `href`, recargaría la página; para SPA
  pásale una función (`onClick`/`action`) que llame a `navigate(path)`.
- Cada ruta declara `handle: { title, subtitle }` (tipo `RouteHandle`); `AppHeader`
  lo lee con `useMatches`. Al agregar una feature: exponer su página en su `index.ts`
  y registrarla como ruta en `src/routes/`.

### Sistema de Diseño — este es un proyecto IMPLEMENTADOR
- Importa desde el paquete npm: `import { Button } from '@comfama/comfama-ui-react'`.
  NUNCA uses el alias interno `@/main` (ese es solo para desarrollo de la librería).
- **Tailwind SIN prefijo** `cfm:`. Clases nativas: `flex`, `p-4`, `bg-primary-50`.
- **Cero HTML nativo para UI** (`<button>`, `<input>`, `<a>`, `<h1>`–`<h6>`, `<p>`,
  `<span>`, `<select>`, `<form>`): usa el átomo/componente equivalente de la librería.
  Excepción: si no existe equivalente, HTML semántico + tokens; los sub-elementos
  que sí tengan átomo se importan igual.
- Solo escala nativa de Tailwind + tokens del theme. Prohibido valores arbitrarios
  con corchetes (`w-[300px]`) y `style={{ ... }}` para color/espaciado.
- No inventes props: los componentes están fuertemente tipados; respeta el contrato.

### Antes de usar componentes de la librería — consulta los skills (obligatorio)
- `01-cfm-design-tokens` — tokens, colores, radius, breakpoints, reglas de Tailwind.
- `02-cfm-atoms-registry` — átomos (Button, Chip, Typography, Alert, inputs...).
- `03-cfm-component-registry` — ensamblajes (Sidebar, DataTable, AuthWidget, Modal...).
- `05-cfm-figma-libui-mapping` — traducción de capas de Figma a componentes.

## Verificación antes de entregar (deja todo en verde)

```
npm run typecheck
npm run lint
npm run test:run
```

## Commits

Conventional Commits validados por commitlint (hook `commit-msg`). Ver la tabla de
tipos y ejemplos en `AGENTS.md`. El hook `pre-commit` corre `oxfmt --write` y
`oxlint --fix`.

## Estado actual del `src/`

```
main.tsx                       Bootstrap. Envuelve <App/> con <ToastProvider/>.
App.tsx                        Raíz mínima: <RouterProvider router={router}/>.
routes/index.tsx               createBrowserRouter: '/' → DashboardPage,
                               '/afiliaciones' → AfiliacionesPage. Título por `handle`.
config/env.ts                  Acceso único y validado a variables de entorno.
shared/components/layout/      Shell transversal de la app:
  AppLayout.tsx                Sidebar + Header + <Outlet/>.
  AppSidebar.tsx               Navegación cliente (useNavigate/useLocation).
  AppHeader.tsx                Título por ruta (useMatches) + búsqueda + campana + AuthWidget.
features/dashboard/            Panel general de inicio (ruta '/').
  DashboardPage.tsx            Page (objetivo de ruta) en la raíz de la feature.
  components/                  MetricsGrid, MetricCard.
  hooks/useAportesReminder.ts  Toast de recordatorio al montar (useToast de la libui).
  data/dashboard.data.tsx      KPIs demo (en real irían en services/ vía API).
  types/metric.ts              Tipo Metric.
  index.ts                     API pública (DashboardPage).
features/afiliaciones/         Dominio de afiliación (ruta '/afiliaciones').
  AfiliacionesPage.tsx         Page (objetivo de ruta) en la raíz de la feature.
  components/                  SolicitudesTable (tabla reutilizable).
  data/afiliaciones.data.ts    Solicitudes demo + statusColor.
  types/afiliacion.ts          Tipos del dominio.
  index.ts                     API pública (AfiliacionesPage, SolicitudesTable, datos, tipos).
styles/index.css               Tailwind + theme + estilos de la librería.
```
