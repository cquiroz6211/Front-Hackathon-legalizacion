import { createBrowserRouter } from "react-router-dom";

import { AfiliacionesPage } from "@/features/afiliaciones";
import { DashboardPage } from "@/features/dashboard";
import {
  MePage,
  ReviewPage,
  UploadPage,
} from "@/features/legalizacion";
import { AppLayout } from "@/shared/components/layout";
import type { RouteHandle } from "@/shared/components/layout";

/**
 * Rutas internas de la SPA. Cada ruta declara su título en `handle` (tipado con
 * `RouteHandle`), que la barra superior lee vía `useMatches`. Al agregar una
 * feature, expón su página en el `index.ts` de la feature y regístrala aquí.
 *
 * Las rutas `/me`, `/upload` y `/review` (feature `legalizacion`) viven fuera
 * del `AppLayout` global porque su identidad visual es distinta: traen su
 * propio header dedicado y un layout full-width (sin sidebar del panel
 * administrativo).
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
  {
    path: "/me",
    element: <MePage />,
    handle: {
      title: "Mis documentos",
      subtitle: "Legalización de gastos",
    } satisfies RouteHandle,
  },
  {
    path: "/upload",
    element: <UploadPage />,
    handle: {
      title: "Carga de gastos",
      subtitle: "Adjuntar soportes",
    } satisfies RouteHandle,
  },
  {
    path: "/review",
    element: <ReviewPage />,
    handle: {
      title: "Revisión de datos",
      subtitle: "Validar información extraída",
    } satisfies RouteHandle,
  },
]);