import { createBrowserRouter } from "react-router-dom";

import { AfiliacionesPage } from "@/features/afiliaciones";
import { DashboardPage } from "@/features/dashboard";
import { AppLayout } from "@/shared/components/layout";
import type { RouteHandle } from "@/shared/components/layout";

/**
 * Rutas internas de la SPA. Cada ruta declara su título en `handle` (tipado con
 * `RouteHandle`), que la barra superior lee vía `useMatches`. Al agregar una
 * feature, expón su página en el `index.ts` de la feature y regístrala aquí.
 */
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
        handle: {
          title: "Panel",
          subtitle: "Resumen de actividad · agosto 2026",
        } satisfies RouteHandle,
      },
      {
        path: "afiliaciones",
        element: <AfiliacionesPage />,
        handle: {
          title: "Afiliaciones",
          subtitle: "Solicitudes y afiliados",
        } satisfies RouteHandle,
      },
    ],
  },
]);
