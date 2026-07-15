import { Outlet } from "react-router-dom";

import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

/**
 * Shell de la aplicación: navegación lateral + barra superior + área de contenido.
 * Las rutas hijas se renderizan en el `<Outlet/>`.
 */
export const AppLayout = () => (
  <div className="flex h-screen bg-secondary-200">
    <AppSidebar />

    <main className="flex flex-1 flex-col overflow-y-auto">
      <AppHeader />

      <div className="flex flex-col gap-6 p-8">
        <Outlet />
      </div>
    </main>
  </div>
);
