import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { getSession, isAuthenticated } from "./auth";
import { homePathForRole } from "./auth";
import type { AuthRole } from "../types";

interface RoleGuardProps {
  /** Roles que pueden acceder a la sub-ruta protegida. */
  allowedRoles: AuthRole[];
  children: ReactNode;
}

/**
 * Guard de autorización por rol (HU-0011 lado gestor).
 *
 * - Si NO hay sesión activa → redirige a `/login` preservando el origen en
 *   `state.from` (mismo contrato que `AuthGuard`).
 * - Si hay sesión pero el rol NO está en `allowedRoles` → redirige a la home
 *   del rol del usuario (`/gestor` para gestor-sap, `/upload` para
 *   colaborador) con `replace`, para que nadie aterrice en una vista que no
 *   le corresponde.
 *
 * La decisión se reevalúa en cada render para mantenerse sincronizada con
 * `signIn`/`signOut` ejecutados desde otras vistas o pestañas.
 */
export const RoleGuard = ({ allowedRoles, children }: RoleGuardProps) => {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  const session = getSession();
  if (!session || !allowedRoles.includes(session.role)) {
    return <Navigate to={homePathForRole(session?.role ?? "colaborador")} replace />;
  }
  return <>{children}</>;
};
