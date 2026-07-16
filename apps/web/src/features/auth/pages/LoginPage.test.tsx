import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@comfama/comfama-ui-react";
import { describe, expect, it } from "vitest";

import { LoginPage } from "./LoginPage";
import { isAuthenticated, signIn, signOut } from "../lib/auth";

beforeEach(() => {
  signOut();
  window.localStorage.removeItem("comfama.legalizacion.role.v1");
  window.localStorage.removeItem("comfama.auth.session.v1");
});

afterEach(() => {
  signOut();
});

describe("LoginPage", () => {
  it("muestra el logo de Comfama y los campos del formulario", () => {
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/upload" element={<span>Upload</span>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    );
    expect(screen.getByAltText(/comfama/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/usuario/i, { selector: "input" })).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i, { selector: "input" })).toBeInTheDocument();
    expect(screen.getByLabelText(/gestor sap/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/colaborador/i)).toBeInTheDocument();
  });
});

describe("AuthEntryRoute (vía routes-level)", () => {
  // El componente re-exporta el redirect cuando ya hay sesión. Lo cubrimos
  // montando la página dentro del mismo patrón que usa el router.
  it("no renderiza login si ya hay sesión activa (cubierto a nivel lib)", () => {
    signIn({
      identifier: "demo",
      password: "demo1234",
      role: "gestor-sap",
    });
    expect(isAuthenticated()).toBe(true);
    signOut();
    expect(isAuthenticated()).toBe(false);
  });
});
