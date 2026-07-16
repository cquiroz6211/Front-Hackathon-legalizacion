/**
 * Tipos públicos de la feature `auth`.
 *
 * Manténgalos separados del `Role` del dominio de legalización
 * (`conductor | personal`): la capa de auth es mock y de hackatón, mientras
 * que el rol de legalización modela un atributo del documento. El mapping
 * vive en `lib/auth.ts` (`mapAuthRoleToLegalizationRole`).
 */

export type AuthRole = "gestor-sap" | "colaborador";

export const AUTH_ROLES: readonly AuthRole[] = ["gestor-sap", "colaborador"] as const;

export interface AuthSession {
  role: AuthRole;
  identifier: string;
  signedInAt: string;
}

export interface SignInInput {
  identifier: string;
  password: string;
  role: AuthRole;
}
