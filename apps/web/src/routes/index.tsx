import { createBrowserRouter } from "react-router-dom";

import { AuthEntryRoute, AuthGuard, RoleGuard } from "@/features/auth";
import { GestorPage, HistorialPage, MePage, ReviewPage, UploadPage } from "@/features/legalizacion";

/**
 * Rutas internas de la SPA. Cada ruta declara su título en `handle` (tipado con
 * `RouteHandle`), que la barra superior lee vía `useMatches`. Al agregar una
 * feature, expón su página en el `index.ts` de la feature y regístrala aquí.
 *
 * Auth (hackatón):
 * - `/` y `/login` → `AuthEntryRoute` (login o redirect a la home del rol).
 * - `/me`, `/upload`, `/review`, `/history` → protegidas por `AuthGuard`.
 * - `/gestor` → protegida por `AuthGuard` + `RoleGuard` (solo `gestor-sap`).
 *
 * Navegación por rol (HU-0011 lado gestor): `gestor-sap` aterriza en `/gestor`
 * (bandeja de aprobación) y `colaborador` en `/upload`.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <AuthEntryRoute />,
    handle: {
      title: "Iniciar sesión",
      subtitle: "Acceso a la plataforma",
    },
  },
  {
    path: "/login",
    element: <AuthEntryRoute />,
    handle: {
      title: "Iniciar sesión",
      subtitle: "Acceso a la plataforma",
    },
  },
  {
    path: "/me",
    element: (
      <AuthGuard>
        <MePage />
      </AuthGuard>
    ),
    handle: {
      title: "Mis documentos",
      subtitle: "Legalización de gastos",
    },
  },
  {
    path: "/upload",
    element: (
      <AuthGuard>
        <UploadPage />
      </AuthGuard>
    ),
    handle: {
      title: "Carga de gastos",
      subtitle: "Adjuntar soportes",
    },
  },
  {
    path: "/review",
    element: (
      <AuthGuard>
        <ReviewPage />
      </AuthGuard>
    ),
    handle: {
      title: "Revisión de datos",
      subtitle: "Validar información extraída",
    },
  },
  {
    path: "/gestor",
    element: (
      <AuthGuard>
        <RoleGuard allowedRoles={["gestor-sap"]}>
          <GestorPage />
        </RoleGuard>
      </AuthGuard>
    ),
    handle: {
      title: "Bandeja Gestor SAP",
      subtitle: "Aprobación de legalizaciones",
    },
  },
  {
    path: "/history",
    element: (
      <AuthGuard>
        <HistorialPage />
      </AuthGuard>
    ),
    handle: {
      title: "Historial de gastos",
      subtitle: "Consulta y seguimiento de legalizaciones",
    },
  },
]);
