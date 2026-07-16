import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@comfama/comfama-ui-react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RoleGuard } from "./RoleGuard";
import { signIn, signOut } from "./auth";

/** Mini-router con destinos para ambos roles, para observar la redirección. */
const renderGuard = (initialPath: string) =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<span>Página de login</span>} />
          <Route path="/gestor" element={<span>Home del gestor</span>} />
          <Route path="/upload" element={<span>Home del colaborador</span>} />
          <Route
            path="/gestor-protegido"
            element={
              <RoleGuard allowedRoles={["gestor-sap"]}>
                <span>Bandeja del gestor</span>
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );

describe("RoleGuard", () => {
  beforeEach(() => signOut());
  afterEach(() => signOut());

  it("renderiza children cuando el rol está permitido", () => {
    signIn({ identifier: "gestor.demo", password: "demo1234", role: "gestor-sap" });
    renderGuard("/gestor-protegido");
    expect(screen.getByText("Bandeja del gestor")).toBeInTheDocument();
  });

  it("redirige a /login cuando NO hay sesión activa", () => {
    renderGuard("/gestor-protegido");
    expect(screen.getByText("Página de login")).toBeInTheDocument();
    expect(screen.queryByText("Bandeja del gestor")).not.toBeInTheDocument();
  });

  it("redirige a la home del colaborador (/upload) si un colaborador entra a la ruta del gestor", () => {
    signIn({ identifier: "colaborador.demo", password: "demo1234", role: "colaborador" });
    renderGuard("/gestor-protegido");
    expect(screen.getByText("Home del colaborador")).toBeInTheDocument();
    expect(screen.queryByText("Bandeja del gestor")).not.toBeInTheDocument();
  });
});
