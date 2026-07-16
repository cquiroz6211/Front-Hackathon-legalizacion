import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { isAuthenticated, signIn, signOut } from "./auth";
import { AuthGuard } from "./AuthGuard";

describe("AuthGuard", () => {
  it("renderiza children cuando hay sesión activa", () => {
    signIn({
      identifier: "demo",
      password: "demo1234",
      role: "gestor-sap",
    });
    expect(isAuthenticated()).toBe(true);
    render(
      <MemoryRouter initialEntries={["/upload"]}>
        <Routes>
          <Route path="/login" element={<span>Página de login</span>} />
          <Route
            path="/upload"
            element={
              <AuthGuard>
                <span>Contenido protegido</span>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    expect(screen.queryByText("Página de login")).not.toBeInTheDocument();
    signOut();
  });

  it("redirige a /login cuando NO hay sesión activa", () => {
    expect(isAuthenticated()).toBe(false);
    render(
      <MemoryRouter initialEntries={["/upload"]}>
        <Routes>
          <Route path="/login" element={<span>Página de login</span>} />
          <Route
            path="/upload"
            element={
              <AuthGuard>
                <span>Contenido protegido</span>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Página de login")).toBeInTheDocument();
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });
});
