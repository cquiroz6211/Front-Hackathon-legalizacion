/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: "local" | "dev" | "qa" | "pdn";
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
