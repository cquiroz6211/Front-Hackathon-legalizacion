/**
 * API pública de la feature `auth`.
 *
 * La feature encapsula todo el flujo de autenticación mock del hackatón:
 * - Página de login (rutas `/` y `/login`).
 * - Componente de entrada (`AuthEntryRoute`) que combina la página con el
 *   redirect a `/upload` para usuarios ya autenticados.
 * - Guard de rutas protegidas (`AuthGuard`).
 * - Helpers de sesión (signIn/signOut/getSession/isAuthenticated/subscribe).
 * - Mapping entre el rol de auth y el `Role` interno de legalización.
 */

export { AuthEntryRoute } from "./AuthEntryRoute";
export { LoginPage } from "./pages/LoginPage";
export { LoginForm } from "./components/LoginForm";
export { AuthGuard } from "./lib/AuthGuard";
export { RoleGuard } from "./lib/RoleGuard";

export {
  authRoleLabel,
  getSession,
  homePathForRole,
  isAuthenticated,
  mapAuthRoleToLegalizationRole,
  signIn,
  signOut,
  subscribeAuth,
  validateCredentials,
} from "./lib/auth";
export type { CredentialsValidation } from "./lib/auth";

export type { AuthRole, AuthSession, SignInInput } from "./types";
export { AUTH_ROLES } from "./types";
