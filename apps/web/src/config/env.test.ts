import { describe, expect, it } from "vitest";
import { env } from "./env";

describe("env", () => {
  it("expone las variables requeridas", () => {
    expect(env.apiUrl).toBeTruthy();
  });

  it("appEnv es uno de los valores válidos", () => {
    expect(["local", "dev", "qa", "pdn"]).toContain(env.appEnv);
  });

  it("los flags derivados son coherentes con appEnv", () => {
    expect(env.isLocal).toBe(env.appEnv === "local");
    expect(env.isProduction).toBe(env.appEnv === "pdn");
  });
});
