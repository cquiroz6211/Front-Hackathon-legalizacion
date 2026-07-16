import { Navigate } from "react-router-dom";

import { getSession, homePathForRole, isAuthenticated } from "./lib/auth";
import { LoginPage } from "./pages/LoginPage";

/**
 * Resuelve la ruta raíz (`/`) y `/login`:
 * - Si hay sesión activa, redirige a la home del rol (replace):
 *   `gestor-sap` → `/gestor`, `colaborador` → `/upload` (HU-0011 lado gestor).
 * - Si no, renderiza la página de login.
 *
 * Se modela como componente (no como función del router) para mantener
 * `isAuthenticated()` sincronizado con cada navegación.
 */
export const AuthEntryRoute = () => {
  const session = getSession();
  if (session && isAuthenticated()) {
    return <Navigate to={homePathForRole(session.role)} replace />;
  }
  return <LoginPage />;
};
