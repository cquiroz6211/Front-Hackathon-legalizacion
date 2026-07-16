import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { isAuthenticated } from "./auth";

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Protege una sub-ruta: si no hay sesión activa, redirige a `/login`
 * preservando la ruta de origen en `state.from` para poder volver después.
 *
 * La decisión se hace en cada render para mantenerse sincronizada con
 * `signOut()` ejecutado desde otras pestañas/vistas.
 */
export const AuthGuard = ({ children }: AuthGuardProps) => {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
};
