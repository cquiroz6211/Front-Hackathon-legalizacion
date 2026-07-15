# shared/

Código **transversal** reutilizable por más de una feature. Si algo solo lo usa
una feature, va dentro de esa feature, no aquí.

```
shared/
├── components/   # composiciones/wrappers sobre la librería @comfama/comfama-ui-react
├── hooks/        # hooks genéricos (no atados a un dominio)
└── lib/          # utilidades, helpers, clientes (http, etc.)
```

## Reglas

- `shared/` **no depende** de `features/` (la dependencia va en un solo sentido:
  features → shared).
- No reimplementar átomos que ya existen en la librería de componentes; aquí solo
  se componen o extienden. Ver `AGENTS.md` y el skill `02-cfm-atoms-registry`.
