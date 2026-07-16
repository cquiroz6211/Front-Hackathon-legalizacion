import { Navigate } from "react-router-dom";

import { isAuthenticated } from "./lib/auth";
import { LoginPage } from "./pages/LoginPage";

/**
 * Resuelve la ruta raíz (`/`) y `/login`:
 * - Si hay sesión activa, redirige a `/upload` (replace).
 * - Si no, renderiza la página de login.
 *
 * Se modela como componente (no como función del router) para mantener
 * `isAuthenticated()` sincronizado con cada navegación.
 */
export const AuthEntryRoute = () => {
  if (isAuthenticated()) {
    return <Navigate to="/upload" replace />;
  }
  return <LoginPage />;
};
