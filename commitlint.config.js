/**
 * Estándar de mensajes de commit: Conventional Commits.
 * Fuente de verdad de los tipos permitidos (referenciada por AGENTS.md y .gitmessage).
 * Docs: https://www.conventionalcommits.org/
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // nueva funcionalidad
        "fix", // corrección de bug
        "docs", // solo documentación
        "style", // formato (sin cambios de lógica)
        "refactor", // refactor sin cambio de comportamiento
        "perf", // mejora de rendimiento
        "test", // agregar o ajustar tests
        "build", // build system o dependencias
        "ci", // configuración de CI
        "chore", // tareas varias (sin código de producción)
        "revert", // revertir un commit previo
      ],
    ],
  },
};
