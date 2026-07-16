import { mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(viteConfig, {
  test: {
    coverage: {
      clean: false,
      enabled: true,
      exclude: [
        "node_modules/**",
        "dist/**",
        "coverage/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "src/main.tsx",
        "src/setupTest.ts",
        "**/*.d.ts",
        "**/types/**",
        "**/index.ts",
      ],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reportOnFailure: true,
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
    environment: "jsdom",
    exclude: ["node_modules/**", "dist/**", "coverage/**"],
    globals: true,
    // Red de seguridad ante timeouts flaky por contención de CPU al correr
    // muchos workers en paralelo (flujos pesados de userEvent). El default es 5s.
    hookTimeout: 15000,
    setupFiles: ["./src/setupTest.ts"],
    testTimeout: 15000,
  },
});
