# features/

Cada subcarpeta es un **dominio de negocio** (caso de uso) y es lo que hace que
la arquitectura "grite" su propósito (Screaming Architecture).

## Estructura de una feature

```
features/
└── <dominio>/            # p. ej. afiliaciones, subsidios, citas-medicas
    ├── components/       # UI propia de la feature (ensambla átomos de la libui)
    ├── hooks/            # lógica de UI reutilizable dentro de la feature
    ├── services/         # llamadas a API / casos de uso de la feature
    ├── types/            # tipos del dominio
    └── index.ts          # API pública de la feature (lo único que importan otros)
```

## Reglas

- Una feature **no importa** archivos internos de otra feature; solo a través de
  su `index.ts` (API pública).
- Lo transversal (UI/utilidades compartidas entre features) vive en `src/shared/`.
- Los componentes de UI se construyen reutilizando la librería
  `@comfama/comfama-ui-react` (ver `AGENTS.md`).
