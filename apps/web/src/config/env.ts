/**
 * Punto único de acceso a las variables de entorno.
 *
 * - Centraliza la lectura de `import.meta.env` (no acceder a él directamente
 *   en el resto del código).
 * - Valida en tiempo de arranque que las variables requeridas existan, para
 *   fallar rápido y claro en vez de con un `undefined` silencioso.
 *
 * Los archivos .env viven en la carpeta `env/` (ver vite.config.ts -> envDir).
 */

export type AppEnv = "local" | "dev" | "qa" | "pdn";

const VALID_ENVS: readonly AppEnv[] = ["local", "dev", "qa", "pdn"];

function required(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key];
  if (value === undefined || value === "") {
    throw new Error(
      `[env] Falta la variable de entorno requerida "${key}". ` +
        `Revisa los archivos en la carpeta env/.`,
    );
  }
  return value;
}

function parseAppEnv(value: string): AppEnv {
  if (!VALID_ENVS.includes(value as AppEnv)) {
    throw new Error(
      `[env] VITE_APP_ENV="${value}" no es válido. ` +
        `Valores permitidos: ${VALID_ENVS.join(", ")}.`,
    );
  }
  return value as AppEnv;
}

const appEnv = parseAppEnv(required("VITE_APP_ENV"));

export const env = {
  appEnv,
  apiUrl: required("VITE_API_URL"),
  isLocal: appEnv === "local",
  isProduction: appEnv === "pdn",
} as const;

export type Env = typeof env;
