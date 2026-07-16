import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@comfama/comfama-ui-react";
import { describe, expect, it } from "vitest";

import { AuthEntryRoute } from "./AuthEntryRoute";
import { LoginForm } from "./components/LoginForm";
import { signOut } from "./lib/auth";
import { AuthGuard } from "./lib/AuthGuard";

beforeEach(() => {
  signOut();
  window.localStorage.removeItem("comfama.auth.session.v1");
  window.localStorage.removeItem("comfama.legalizacion.role.v1");
});

afterEach(() => {
  signOut();
});

/** Mini-router equivalente al router real para estos tests de integración. */
const App = ({ initialPath }: { initialPath: string }) => (
  <MemoryRouter initialEntries={[initialPath]}>
    <Routes>
      <Route path="/" element={<AuthEntryRoute />} />
      <Route path="/login" element={<AuthEntryRoute />} />
      <Route
        path="/upload"
        element={
          <AuthGuard>
            <span>Página de carga</span>
          </AuthGuard>
        }
      />
      <Route
        path="/gestor"
        element={
          <AuthGuard>
            <span>Bandeja del gestor</span>
          </AuthGuard>
        }
      />
      <Route
        path="/me"
        element={
          <AuthGuard>
            <span>Página de mis documentos</span>
          </AuthGuard>
        }
      />
      <Route
        path="/review"
        element={
          <AuthGuard>
            <span>Página de revisión</span>
          </AuthGuard>
        }
      />
    </Routes>
  </MemoryRouter>
);

describe("AuthEntryRoute + AuthGuard (integración)", () => {
  it("renderiza el login cuando se visita / sin sesión", () => {
    render(
      <ToastProvider>
        <App initialPath="/" />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("renderiza el login cuando se visita /login sin sesión", () => {
    render(
      <ToastProvider>
        <App initialPath="/login" />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("redirige a /login cuando se intenta acceder a /upload sin sesión", () => {
    render(
      <ToastProvider>
        <App initialPath="/upload" />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.queryByText(/página de carga/i)).not.toBeInTheDocument();
  });

  it("redirige a /login cuando se intenta acceder a /me sin sesión", () => {
    render(
      <ToastProvider>
        <App initialPath="/me" />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("redirige a /login cuando se intenta acceder a /review sin sesión", () => {
    render(
      <ToastProvider>
        <App initialPath="/review" />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("tras un login válido de colaborador navega a /upload (replace)", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App initialPath="/" />
      </ToastProvider>,
    );
    await user.type(screen.getByLabelText(/usuario/i, { selector: "input" }), "demo");
    await user.type(screen.getByLabelText(/contraseña/i, { selector: "input" }), "demo1234");
    await user.click(screen.getByLabelText(/colaborador/i));
    await user.click(screen.getByRole("button", { name: /ingresar/i }));
    await waitFor(() => expect(screen.getByText(/página de carga/i)).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });

  it("tras un login válido de gestor-sap navega a /gestor (replace)", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App initialPath="/" />
      </ToastProvider>,
    );
    await user.type(screen.getByLabelText(/usuario/i, { selector: "input" }), "gestor.demo");
    await user.type(screen.getByLabelText(/contraseña/i, { selector: "input" }), "demo1234");
    await user.click(screen.getByLabelText(/gestor sap/i));
    await user.click(screen.getByRole("button", { name: /ingresar/i }));
    await waitFor(() => expect(screen.getByText(/bandeja del gestor/i)).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });

  it("al recargar con sesión activa, /upload sigue siendo accesible", () => {
    // Simulamos que ya hay sesión persistida.
    window.localStorage.setItem(
      "comfama.auth.session.v1",
      JSON.stringify({
        role: "gestor-sap",
        identifier: "demo",
        signedInAt: new Date().toISOString(),
      }),
    );
    render(
      <ToastProvider>
        <App initialPath="/upload" />
      </ToastProvider>,
    );
    expect(screen.getByText(/página de carga/i)).toBeInTheDocument();
  });

  it("al recargar con sesión de colaborador, / redirige a /upload", () => {
    window.localStorage.setItem(
      "comfama.auth.session.v1",
      JSON.stringify({
        role: "colaborador",
        identifier: "demo",
        signedInAt: new Date().toISOString(),
      }),
    );
    render(
      <ToastProvider>
        <App initialPath="/" />
      </ToastProvider>,
    );
    expect(screen.getByText(/página de carga/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });

  it("al recargar con sesión de gestor-sap, / redirige a /gestor", () => {
    window.localStorage.setItem(
      "comfama.auth.session.v1",
      JSON.stringify({
        role: "gestor-sap",
        identifier: "demo",
        signedInAt: new Date().toISOString(),
      }),
    );
    render(
      <ToastProvider>
        <App initialPath="/" />
      </ToastProvider>,
    );
    expect(screen.getByText(/bandeja del gestor/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });

  it("al recargar con sesión de colaborador, /login redirige a /upload", () => {
    window.localStorage.setItem(
      "comfama.auth.session.v1",
      JSON.stringify({
        role: "colaborador",
        identifier: "demo",
        signedInAt: new Date().toISOString(),
      }),
    );
    render(
      <ToastProvider>
        <App initialPath="/login" />
      </ToastProvider>,
    );
    expect(screen.getByText(/página de carga/i)).toBeInTheDocument();
  });

  it("al recargar con sesión de gestor-sap, /login redirige a /gestor", () => {
    window.localStorage.setItem(
      "comfama.auth.session.v1",
      JSON.stringify({
        role: "gestor-sap",
        identifier: "demo",
        signedInAt: new Date().toISOString(),
      }),
    );
    render(
      <ToastProvider>
        <App initialPath="/login" />
      </ToastProvider>,
    );
    expect(screen.getByText(/bandeja del gestor/i)).toBeInTheDocument();
  });

  it("Logout: tras limpiar el storage, la ruta protegida vuelve a pedir login", async () => {
    window.localStorage.setItem(
      "comfama.auth.session.v1",
      JSON.stringify({
        role: "gestor-sap",
        identifier: "demo",
        signedInAt: new Date().toISOString(),
      }),
    );
    const { rerender } = render(
      <ToastProvider>
        <App initialPath="/upload" />
      </ToastProvider>,
    );
    expect(screen.getByText(/página de carga/i)).toBeInTheDocument();
    // Limpiamos manualmente para simular signOut y re-render.
    window.localStorage.removeItem("comfama.auth.session.v1");
    rerender(
      <ToastProvider>
        <App initialPath="/upload" />
      </ToastProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /iniciar sesión/i })).toBeInTheDocument(),
    );
    // Sanity check: el form de LoginForm se importa pero no se usa acá.
    expect(LoginForm).toBeDefined();
  });
});
