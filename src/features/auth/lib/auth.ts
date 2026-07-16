/**
 * Mock de autenticación para el flujo de hackatón.
 *
 * No hay backend: persistimos la sesión en `localStorage` bajo una clave
 * independiente de las claves de legalización, y validamos credenciales con
 * una regla local trivial. Este módulo **no** debe usarse en producción.
 *
 * Contrato:
 * - `signIn(...)` valida y persiste la sesión.
 * - `signOut()` limpia la sesión.
 * - `getSession()` lee la sesión actual sincrónicamente.
 * - `isAuthenticated()` devuelve `true` cuando hay sesión válida.
 * - `subscribeAuth(fn)` notifica mutaciones a los componentes en la misma
 *   pestaña (mismo patrón que `legalizacion/lib/store.ts`).
 *
 * Mapping a legalización: la página `/upload` consume `getRole()` del store
 * de legalización, que solo conoce `conductor | personal`. Para que el flujo
 * existente siga funcionando, mapeamos el rol de auth al de legalización.
 * Esto está documentado y cubierto por tests.
 */

import { setRole } from "@/features/legalizacion";
import type { Role } from "@/features/legalizacion";

import type { AuthRole, AuthSession, SignInInput } from "../types";
import { AUTH_ROLES } from "../types";

const SESSION_KEY = "comfama.auth.session.v1";

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function safeGet(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // cuota / errores de privacidad no rompen el flujo
  }
}

function safeRemove(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function isAuthRole(value: unknown): value is AuthRole {
  return typeof value === "string" && (AUTH_ROLES as readonly string[]).includes(value);
}

/** Resultado de `validateCredentials`. */
export interface CredentialsValidation {
  isValid: boolean;
  message: string | null;
}

/**
 * Valida los datos del formulario antes de "autenticar".
 * - identifier: requerido, sin espacios al inicio/fin
 * - password: requerido, mínimo 4 caracteres
 *
 * Esta regla es **mock** y sirve solo para la demo de hackatón.
 */
export function validateCredentials(input: Partial<SignInInput>): CredentialsValidation {
  const identifier = (input.identifier ?? "").trim();
  const password = input.password ?? "";
  if (!identifier) {
    return { isValid: false, message: "Ingresa tu usuario." };
  }
  if (!password) {
    return { isValid: false, message: "Ingresa tu contraseña." };
  }
  if (password.length < 4) {
    return {
      isValid: false,
      message: "La contraseña debe tener al menos 4 caracteres.",
    };
  }
  if (!isAuthRole(input.role)) {
    return { isValid: false, message: "Selecciona un rol válido." };
  }
  return { isValid: true, message: null };
}

/**
 * Mapping entre el rol de auth (`AuthRole`) y el rol interno de
 * legalización (`Role`). El upload usa el `Role` interno para etiquetar
 * cada documento, y ese campo ya estaba poblado en la base de demos.
 *
 * Convención del hackatón:
 * - `gestor-sap`  → `personal`   (carga gastos administrativos del propio gestor)
 * - `colaborador` → `conductor`  (carga gastos en ruta como conductor)
 *
 * Si en el futuro se quiere desacoplar el mapping, conviene mover el `Role`
 * de `DocumentRecord` a un campo `authRole` separado.
 */
export function mapAuthRoleToLegalizationRole(role: AuthRole): Role {
  if (role === "gestor-sap") return "personal";
  return "conductor";
}

/** Etiqueta legible del rol para UI. */
export function authRoleLabel(role: AuthRole): string {
  return role === "gestor-sap" ? "Gestor SAP" : "Colaborador";
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // un listener que rompe no debe tumbar el resto
    }
  });
}

function readSession(): AuthSession | null {
  const raw = safeGet(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "role" in parsed &&
      "identifier" in parsed &&
      "signedInAt" in parsed
    ) {
      const candidate = parsed as Record<string, unknown>;
      if (
        isAuthRole(candidate.role) &&
        typeof candidate.identifier === "string" &&
        typeof candidate.signedInAt === "string"
      ) {
        return {
          role: candidate.role,
          identifier: candidate.identifier,
          signedInAt: candidate.signedInAt,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Devuelve la sesión actual o `null` si no hay sesión válida. */
export function getSession(): AuthSession | null {
  return readSession();
}

/** Atajo: ¿hay sesión activa? */
export function isAuthenticated(): boolean {
  return readSession() !== null;
}

/**
 * Persiste la sesión y mapea el rol a la capa de legalización para que el
 * upload siga funcionando con la menor cantidad de cambios. Devuelve la sesión
 * recién creada.
 *
 * **Mock**: cualquier combinación válida de identifier/password/role pasa.
 */
export function signIn(input: SignInInput): AuthSession {
  const validation = validateCredentials(input);
  if (!validation.isValid) {
    throw new Error(validation.message ?? "Credenciales inválidas.");
  }
  const session: AuthSession = {
    role: input.role,
    identifier: input.identifier.trim(),
    signedInAt: new Date().toISOString(),
  };
  safeSet(SESSION_KEY, JSON.stringify(session));
  setRole(mapAuthRoleToLegalizationRole(session.role));
  notify();
  return session;
}

/** Limpia la sesión persistida y notifica a los listeners. */
export function signOut(): void {
  safeRemove(SESSION_KEY);
  notify();
}

/**
 * Suscripción a cambios de sesión. Devuelve la función de desuscripción.
 * Mismo patrón pub/sub que el store de legalización.
 */
export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
