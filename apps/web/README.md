# baseline-front-comfama

Plantilla **base (baseline)** para frontends de Comfama. Provee una configuración
estándar y opinada para arrancar nuevos proyectos con:

- **React 19 + TypeScript + Vite** como stack base.
- **Screaming Architecture**: la estructura de carpetas grita el dominio de negocio.
- Alineación al **Sistema de Diseño de Comfama** mediante la librería de componentes
  [`@comfama/comfama-ui-react`](https://github.com/comfama/comfama-ui-react).
- Tooling estándar: Oxlint + Oxfmt, Vitest, Lefthook + Commitlint, y pipeline de
  Azure DevOps con 3 ambientes (dev, qa, pdn).

## Stack

| Área           | Herramienta                                    |
| -------------- | ---------------------------------------------- |
| UI             | React 19, `@comfama/comfama-ui-react`          |
| Lenguaje       | TypeScript                                     |
| Bundler / dev  | Vite 8                                         |
| Estilos        | Tailwind CSS v4 + tokens del theme de la libui |
| Lint / formato | Oxlint, Oxfmt                                  |
| Pruebas        | Vitest + Testing Library (jsdom)               |
| Git hooks      | Lefthook (+ Commitlint)                        |
| CI/CD          | Azure DevOps (`Pipeline/`)                     |

## Arquitectura (Screaming Architecture)

La organización por **dominio de negocio**, no por tipo técnico. Al abrir `src/`
se debe entender _qué hace la aplicación_, no con qué framework está hecha.

```
src/
├── main.tsx        # Punto de entrada (bootstrap de React)
├── App.tsx         # Componente raíz / layout inicial
├── config/         # Configuración transversal (variables de entorno, constantes)
│   └── env.ts      # Acceso único y validado a import.meta.env
├── features/       # ← EL DOMINIO GRITA AQUÍ. Una carpeta por caso de uso.
│   └── <dominio>/  #   p. ej. afiliaciones, subsidios, citas-medicas
│       ├── components/   # UI propia de la feature (ensambla átomos de la libui)
│       ├── hooks/
│       ├── services/     # llamadas a API / casos de uso
│       ├── types/
│       └── index.ts      # API pública de la feature
├── shared/         # Reutilizable entre features (no depende de features/)
│   ├── components/ # composiciones/wrappers sobre la libui
│   ├── hooks/
│   └── lib/        # utilidades, helpers, clientes http
└── styles/         # Estilos globales + import del theme de la libui
    └── index.css
```

**Reglas:**

- Una feature solo se consume a través de su `index.ts`; no se importan archivos
  internos de otra feature.
- La dependencia va en un sentido: `features → shared`. `shared/` nunca importa de
  `features/`.
- Alias de importación: `@/` apunta a `src/` (ej. `import { env } from '@/config/env'`).

Ver `src/features/README.md` y `src/shared/README.md` para el detalle de cada zona.

## Sistema de Diseño de Comfama

Este es un **proyecto implementador** de la librería. Por tanto:

- **Componentes:** importa desde el paquete npm:
  `import { Button } from '@comfama/comfama-ui-react'`.
- **Cero HTML nativo para UI**: usa los átomos/componentes de la librería en vez de
  `<button>`, `<input>`, `<h1>`, `<p>`, etc.
- **Tailwind sin prefijo**: las clases se escriben nativas (`flex`, `p-4`), **sin**
  el prefijo `cfm:` (ese prefijo es solo para desarrollo interno de la librería).
- **Tokens del theme**: colores, radios y breakpoints vienen del theme de la
  librería (importado en `src/styles/index.css`). No uses valores arbitrarios
  (`w-[300px]`) ni estilos en línea.

Los detalles y catálogos viven en los skills `01-cfm-design-tokens`,
`02-cfm-atoms-registry` y `03-cfm-component-registry`, y las reglas para agentes en
[`AGENTS.md`](./AGENTS.md).

## Requisitos

- Node.js **22.x** (ver `engines` en `package.json`).

## Primeros pasos

```bash
npm install              # instala dependencias y configura hooks de git (prepare)
cp env/.env.local.example env/.env.local   # crea tu config local
npm run dev              # levanta el servidor de desarrollo
```

La configuración autenticada de npm para el paquete privado `@comfama` es local y no se versiona. Cada colaborador debe configurar sus credenciales de acceso al registro antes de ejecutar `npm install`.

## Variables de entorno

Los archivos `.env` viven en la carpeta `env/` (configurado vía `envDir` en
`vite.config.ts`). Solo las variables con prefijo `VITE_` se exponen al cliente.

| Archivo                  | Uso                                           | Versionado |
| ------------------------ | --------------------------------------------- | ---------- |
| `env/.env.local`         | Trabajo local (`npm run dev`)                 | ❌ no      |
| `env/.env.local.example` | Plantilla de `.env.local`                     | ✅ sí      |
| `env/.env.dev`           | Ambiente DEV (`npm run build:dev`)            | ❌ no      |
| `env/.env.qa`            | Ambiente QA (`npm run build:qa`)              | ❌ no      |
| `env/.env.pdn`           | Ambiente PDN/producción (`npm run build:pdn`) | ❌ no      |

Los archivos de ambiente por entorno se crean localmente o se inyectan desde CI/CD. Solo deben contener configuración pública; los secretos deben gestionarse fuera del repositorio.

Acceso en código vía `src/config/env.ts` (valida al arranque):

```ts
import { env } from "@/config/env";

fetch(`${env.apiUrl}/usuarios`);
if (env.isProduction) {
  /* ... */
}
```

## Scripts

| Script                       | Descripción                                           |
| ---------------------------- | ----------------------------------------------------- |
| `dev`                        | Servidor de desarrollo                                |
| `build`                      | Build de producción (modo por defecto)                |
| `build:dev` / `:qa` / `:pdn` | Build por ambiente (carga `env/.env.<modo>`)          |
| `preview`                    | Sirve el build localmente                             |
| `lint` / `lint:fix`          | Oxlint (con `--fix`)                                  |
| `format` / `format:check`    | Oxfmt                                                 |
| `typecheck`                  | Type-check con `tsc -b --noEmit`                      |
| `test` / `test:run`          | Vitest (watch / una pasada)                           |
| `test:coverage`              | Tests con cobertura                                   |
| `test:junit`                 | Reporte JUnit (`coverage/junit.xml`) para el pipeline |
| `test:lcov` / `test:sonar`   | Cobertura lcov para SonarQube                         |

## Pruebas

Vitest + Testing Library con entorno `jsdom`. El setup global está en
`src/setupTest.ts`. Los archivos de prueba se ubican junto al código (`*.test.tsx`).

```bash
npm run test:run        # una pasada
npm run test:coverage   # con cobertura
```

## Calidad de código y hooks

[Lefthook](https://lefthook.dev) gestiona los hooks de git (se instalan solos con
`npm install` vía el script `prepare`):

- **pre-commit**: `oxfmt --write` + `oxlint --fix` sobre los archivos en stage.
- **pre-push**: `vitest run --changed` (tests de lo modificado).
- **commit-msg**: `commitlint` valida [Conventional Commits](https://www.conventionalcommits.org/).

## Build y despliegue

El pipeline de Azure DevOps está en `Pipeline/`, con variables por ambiente en
`Pipeline/variables/`. La rama determina el ambiente: `Develop`→dev,
`Integration`→qa, `master`→pdn. El build de cada ambiente usa `npm run build:<modo>`
y publica el contenido de `dist/`.

## Convenciones de commits

Conventional Commits, validado por commitlint. Detalle y ejemplos en
[`AGENTS.md`](./AGENTS.md). Hay una plantilla en `.gitmessage` (registrada como
`commit.template`).
