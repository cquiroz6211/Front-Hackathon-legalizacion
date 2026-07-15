# AGENTS.md

Instrucciones para asistentes de IA / IDEs agénticos (Antigravity, Cursor, Claude Code, Copilot, etc.) que trabajen en este repositorio.

Es la plantilla base de frontends de Comfama: **React + TypeScript + Vite**, con
**Screaming Architecture** y alineada al **Sistema de Diseño de Comfama** vía la
librería de componentes `@comfama/comfama-ui-react`.

**Orientación: SPA con rutas internas.** Este baseline está pensado para
aplicaciones de una sola página (SPA) con navegación cliente vía **React Router**.
NO está orientado a generación de estáticos desde un CMS (p. ej. Contentful); para
ese caso usa otra plantilla.

## Arquitectura (Screaming Architecture) — OBLIGATORIO

El código se organiza por **dominio de negocio**, no por tipo técnico. Estructura
en `src/`:

```
main.tsx    Punto de entrada. Bootstrap de React + providers globales (ToastProvider).
App.tsx     Raíz mínima: monta el router (<RouterProvider/>). Sin lógica de dominio.
routes/     Configuración de rutas de la SPA (createBrowserRouter). Registra las
            páginas expuestas por cada feature y su título de ruta (`handle`).
config/     Configuración transversal. env.ts = acceso único y validado a las envs.
features/   Un subdirectorio por dominio/caso de uso (dashboard, afiliaciones, ...).
            Cada feature: <Nombre>Page.tsx en la RAÍZ (objetivo de ruta, visible),
            + components/ hooks/ services/ data/ types/ + index.ts (API pública).
shared/     Reutilizable entre features: components/ (incl. layout/) hooks/ lib/.
styles/     Estilos globales + theme de la librería.
```

Reglas que DEBES respetar al crear o mover archivos:

- **Funcionalidad nueva ⇒ nueva feature** en `src/features/<dominio>/`. No metas
  lógica de dominio en `App.tsx` ni en `shared/`. Nombra la feature por su dominio,
  no por su forma de UI (evita `dashboard`/`home` para features de negocio; usa el
  nombre del dominio, p. ej. `afiliaciones`). La vista de inicio/panel general es la
  única feature legítimamente llamada `dashboard`.
- Una feature se consume **solo** por su `index.ts` (API pública). Prohibido importar
  archivos internos de otra feature. Una feature PUEDE consumir la API pública de
  otra vía su `index.ts` (p. ej. `dashboard` reusa `SolicitudesTable` de `afiliaciones`).
- Dependencia en un solo sentido: `features → shared`. `shared/` **no** importa de
  `features/`.
- El **shell/layout** transversal (Sidebar + Header + `<Outlet/>`) vive en
  `shared/components/layout/`, no en una feature de negocio.
- Usa el alias **`@/`** (→ `src/`) para imports absolutos entre módulos: `import { env } from '@/config/env'`.
  Dentro de una misma feature usa imports relativos.
- Colateral: ubica el `*.test.tsx` junto al archivo que prueba.

### Ruteo (SPA)

- Router: **`react-router-dom`** con `createBrowserRouter` en `src/routes/`.
- Navegación **siempre cliente**: usa `useNavigate`/`<Link>`/`<NavLink>`. Si un ítem
  de un componente de la librería (p. ej. `Sidebar`) recibe una URL como `href`,
  provocará recarga completa; para SPA pásale una función (`onClick`/`action`) que
  llame a `navigate(path)`.
- Cada ruta declara `handle: { title, subtitle }` (tipado con `RouteHandle`); el
  `AppHeader` lo lee con `useMatches` para pintar el título de la página.
- Al agregar una feature: expón su página en el `index.ts` de la feature y regístrala
  como ruta en `src/routes/`.

## Sistema de Diseño de Comfama — OBLIGATORIO

Este repo es un **proyecto implementador** de la librería (el `name` en
`package.json` NO es `@comfama/comfama-ui-react`). Por lo tanto:

- **Importa componentes del paquete npm:**
  `import { Button } from '@comfama/comfama-ui-react'`. (NO uses el alias interno
  `@/main`; eso es solo para desarrollo dentro de la librería.)
- **Cero HTML nativo para UI:** está prohibido usar `<button>`, `<input>`, `<a>`,
  `<select>`, `<form>`, `<h1>`–`<h6>`, `<p>`, `<span>` para interfaz. Usa el átomo
  o componente equivalente de la librería. Excepción: si no existe equivalente,
  usa HTML semántico + tokens; los sub-elementos que sí tengan átomo se importan.
- **Tailwind SIN prefijo:** escribe clases nativas (`flex`, `p-4`, `bg-primary-500`).
  El prefijo `cfm:` es exclusivo del desarrollo interno de la librería.
- **Solo escala nativa de Tailwind + tokens del theme:** prohibido valores
  arbitrarios con corchetes (`w-[300px]`, `mt-[17px]`) y estilos en línea
  (`style={{ ... }}`) para color/espaciado.
- **No inventes props:** los componentes están fuertemente tipados; respeta su
  contrato.

Antes de construir UI, consulta los skills del repo (fuente de verdad):

- `01-cfm-design-tokens` — tokens, colores, radius, breakpoints, reglas de Tailwind.
- `02-cfm-atoms-registry` — átomos (botones, inputs, textos, alertas, selects...).
- `03-cfm-component-registry` — ensamblajes (pantallas, formularios, cards, modales...).
- `05-cfm-figma-libui-mapping` — traducción de capas de Figma a componentes de LibUI.

## Verificación antes de entregar

Ejecuta y deja en verde: `npm run typecheck`, `npm run lint`, `npm run test:run`.

## Mensajes de commit (OBLIGATORIO)

Este repo valida los mensajes con **commitlint** (`@commitlint/config-conventional`) en el hook `commit-msg` de lefthook. Todo commit DEBE cumplir el estándar **Conventional Commits** o será rechazado.

### Formato

```
<type>(<scope opcional>): <descripción>

[cuerpo opcional]

[footer opcional]
```

Reglas que aplica commitlint:

- **type** es obligatorio y debe ser uno de la lista de abajo (en minúscula).
- **scope** es opcional, entre paréntesis, en minúscula (ej. `feat(auth):`).
- **descripción** (subject) es obligatoria, no vacía, y NO termina en punto.
- El **header** (primera línea completa) no debe superar los **100 caracteres**.
- Para cambios incompatibles: usa `!` después del type/scope (ej. `feat!:`) o un footer `BREAKING CHANGE: ...`.

### Tipos permitidos (`type-enum`)

| type       | Uso                                                  |
| ---------- | ---------------------------------------------------- |
| `feat`     | Nueva funcionalidad                                  |
| `fix`      | Corrección de bug                                    |
| `docs`     | Solo documentación                                   |
| `style`    | Formato (sin cambios de lógica)                      |
| `refactor` | Refactor sin cambio de comportamiento                |
| `perf`     | Mejora de rendimiento                                |
| `test`     | Agregar o ajustar tests                              |
| `build`    | Build system o dependencias                          |
| `ci`       | Configuración de CI                                  |
| `chore`    | Tareas varias (sin código de producción)             |
| `revert`   | Revertir un commit previo                            |

> Fuente de verdad: `commitlint.config.js`. Si cambian los tipos ahí, actualizar esta tabla.

### Ejemplos válidos

```
feat: agrega login con correo corporativo
fix(carrito): corrige cálculo de total con descuentos
docs: actualiza guía de setup de tests
refactor(api): extrae cliente http a módulo propio
chore(deps): actualiza vite a 8.0.12
feat!: cambia el contrato de la respuesta de /usuarios
```

### Ejemplos inválidos

```
arregle un bug            # sin type
Feat: nueva pantalla      # type en mayúscula
feat: Agrega login.       # subject termina en punto (warning) y/o capitalizado
update                    # sin type ni descripción
```

## Calidad de código

Antes de commitear, el hook `pre-commit` corre automáticamente:

- `oxfmt --write` (formato)
- `oxlint --fix` (lint)

Comandos útiles: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:run`.
