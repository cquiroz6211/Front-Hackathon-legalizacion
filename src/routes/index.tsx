import { createBrowserRouter } from "react-router-dom";

import { AuthEntryRoute, AuthGuard } from "@/features/auth";
import { MePage, ReviewPage, UploadPage } from "@/features/legalizacion";

/**
 * Rutas internas de la SPA. Cada ruta declara su título en `handle` (tipado con
 * `RouteHandle`), que la barra superior lee vía `useMatches`. Al agregar una
 * feature, expón su página en el `index.ts` de la feature y regístrala aquí.
 *
 * Auth (hackatón):
 * - `/` y `/login` → `AuthEntryRoute` (login o redirect a `/upload`).
 * - `/me`, `/upload`, `/review` → protegidas por `AuthGuard`. Si no hay sesión
 *   activa, redirigen a `/login` con `state.from`.
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
]);
