import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Variables de entorno para los tests. Se definen aquí (en vez de en un
// archivo env/.env.test) para que sean deterministas y no dependan de
// .env.local. El setup corre antes de importar los módulos, por lo que
// env.ts las ve al validar al arranque.
vi.stubEnv("VITE_APP_ENV", "local");
vi.stubEnv("VITE_API_URL", "http://localhost/api");

afterEach(() => {
  cleanup();
});
