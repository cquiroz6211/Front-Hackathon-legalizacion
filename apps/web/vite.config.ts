import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  // Carga los archivos .env desde la carpeta env/ en vez de la raíz.
  envDir: "env",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Alias absoluto al código fuente: import x from '@/shared/...'
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
