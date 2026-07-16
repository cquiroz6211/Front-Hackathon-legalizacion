import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ToastProvider } from "@comfama/comfama-ui-react";
import { describe, expect, it } from "vitest";

import { LegalizacionHeader } from "./LegalizacionHeader";
import { getSession, signIn, signOut } from "@/features/auth";

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
};

const renderHeader = (initialPath = "/upload") =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <LegalizacionHeader variant="upload" />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );

beforeEach(() => {
  signOut();
  window.localStorage.removeItem("comfama.auth.session.v1");
  window.localStorage.removeItem("comfama.legalizacion.role.v1");
});

afterEach(() => {
  signOut();
});

describe("LegalizacionHeader", () => {
  it("renderiza el botón de cerrar sesión accesible", () => {
    signIn({ identifier: "demo", password: "demo1234", role: "gestor-sap" });
    renderHeader();
    expect(screen.getByRole("button", { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it("al cerrar sesión limpia la sesión y navega a /login", async () => {
    const user = userEvent.setup();
    signIn({ identifier: "demo", password: "demo1234", role: "colaborador" });
    expect(getSession()).not.toBeNull();

    renderHeader();
    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    expect(getSession()).toBeNull();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
  });
});
