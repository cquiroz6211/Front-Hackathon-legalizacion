import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getRole, setRole } from "@/features/legalizacion";

import {
  authRoleLabel,
  getSession,
  isAuthenticated,
  mapAuthRoleToLegalizationRole,
  signIn,
  signOut,
  subscribeAuth,
  validateCredentials,
} from "./auth";
import type { AuthRole } from "../types";

const SESSION_KEY = "comfama.auth.session.v1";
const LEGALIZATION_ROLE_KEY = "comfama.legalizacion.role.v1";

function clearStorage() {
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(LEGALIZATION_ROLE_KEY);
  // Limpia también cualquier basura residual que pueda contaminar otros tests.
  window.localStorage.removeItem("comfama.legalizacion.documents.v1");
  window.localStorage.removeItem("comfama.legalizacion.legalizations.v1");
}

beforeEach(clearStorage);
afterEach(clearStorage);

describe("validateCredentials", () => {
  it("rechaza identifier vacío", () => {
    expect(
      validateCredentials({
        identifier: "",
        password: "abcd",
        role: "gestor-sap",
      }).isValid,
    ).toBe(false);
  });

  it("rechaza identifier sólo con espacios", () => {
    const result = validateCredentials({
      identifier: "   ",
      password: "abcd",
      role: "gestor-sap",
    });
    expect(result.isValid).toBe(false);
    expect(result.message).toMatch(/usuario/i);
  });

  it("rechaza password vacío", () => {
    const result = validateCredentials({
      identifier: "demo",
      password: "",
      role: "gestor-sap",
    });
    expect(result.isValid).toBe(false);
    expect(result.message).toMatch(/contraseña/i);
  });

  it("rechaza password de menos de 4 caracteres", () => {
    const result = validateCredentials({
      identifier: "demo",
      password: "ab",
      role: "gestor-sap",
    });
    expect(result.isValid).toBe(false);
    expect(result.message).toMatch(/4 caracteres/i);
  });

  it("rechaza cuando falta el rol", () => {
    expect(
      validateCredentials({
        identifier: "demo",
        password: "abcd",
        role: "" as unknown as AuthRole,
      }).isValid,
    ).toBe(false);
  });

  it("acepta identifier + password >=4 + rol válido", () => {
    expect(
      validateCredentials({
        identifier: "demo",
        password: "abcd",
        role: "gestor-sap",
      }).isValid,
    ).toBe(true);
    expect(
      validateCredentials({
        identifier: "demo",
        password: "abcd",
        role: "colaborador",
      }).isValid,
    ).toBe(true);
  });
});

describe("signIn / signOut / getSession / isAuthenticated", () => {
  it("persiste la sesión con identifier normalizado (trim)", () => {
    const session = signIn({
      identifier: "  demo  ",
      password: "demo1234",
      role: "gestor-sap",
    });
    expect(session.identifier).toBe("demo");
    expect(session.role).toBe("gestor-sap");
    expect(typeof session.signedInAt).toBe("string");
    expect(isAuthenticated()).toBe(true);
    expect(getSession()).toEqual(session);
  });

  it("lanza un error si las credenciales no son válidas", () => {
    expect(() =>
      signIn({
        identifier: "demo",
        password: "x",
        role: "gestor-sap",
      }),
    ).toThrow(/4 caracteres/i);
    expect(isAuthenticated()).toBe(false);
  });

  it("signOut limpia la sesión y notifica a los suscriptores", () => {
    signIn({ identifier: "demo", password: "demo1234", role: "gestor-sap" });
    expect(isAuthenticated()).toBe(true);
    signOut();
    expect(isAuthenticated()).toBe(false);
    expect(getSession()).toBeNull();
  });

  it("getSession devuelve null ante un payload corrupto", () => {
    window.localStorage.setItem(SESSION_KEY, "{not-json");
    expect(getSession()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it("getSession devuelve null si el rol persistido no es válido", () => {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ role: "hacker", identifier: "x", signedInAt: "2026" }),
    );
    expect(getSession()).toBeNull();
  });
});

describe("subscribeAuth", () => {
  it("notifica a los listeners en signIn y signOut", () => {
    let calls = 0;
    const unsubscribe = subscribeAuth(() => {
      calls += 1;
    });
    signIn({ identifier: "demo", password: "demo1234", role: "gestor-sap" });
    signOut();
    unsubscribe();
    signIn({ identifier: "demo", password: "demo1234", role: "colaborador" });
    expect(calls).toBe(2);
  });
});

describe("mapping auth → legalización", () => {
  it("gestor-sap mapea a personal en el store de legalización", () => {
    signIn({ identifier: "demo", password: "demo1234", role: "gestor-sap" });
    expect(getRole()).toBe("personal");
  });

  it("colaborador mapea a conductor en el store de legalización", () => {
    signIn({ identifier: "demo", password: "demo1234", role: "colaborador" });
    expect(getRole()).toBe("conductor");
  });

  it("mapAuthRoleToLegalizationRole es una función pura", () => {
    expect(mapAuthRoleToLegalizationRole("gestor-sap")).toBe("personal");
    expect(mapAuthRoleToLegalizationRole("colaborador")).toBe("conductor");
  });

  it("no altera el rol de legalización si ya estaba seteado por otra vía", () => {
    setRole("conductor");
    expect(mapAuthRoleToLegalizationRole("gestor-sap")).toBe("personal");
    expect(getRole()).toBe("conductor");
  });

  it("authRoleLabel devuelve etiquetas legibles", () => {
    expect(authRoleLabel("gestor-sap")).toBe("Gestor SAP");
    expect(authRoleLabel("colaborador")).toBe("Colaborador");
  });
});
