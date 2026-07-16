import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "./LoginForm";
import { getSession, signOut } from "../lib/auth";

beforeEach(() => {
  window.localStorage.removeItem("comfama.auth.session.v1");
  window.localStorage.removeItem("comfama.legalizacion.role.v1");
  signOut();
});

afterEach(() => {
  signOut();
});

// `getByLabelText` también matchea elementos con `aria-label` (v10.4.1),
// por lo que el toggle "Mostrar/Ocultar contraseña" entra en la búsqueda.
// Restringimos a inputs para evitar ambigüedad.
const userInput = () =>
  screen.getByLabelText(/usuario/i, { selector: "input" }) as HTMLInputElement;
const passwordInput = () =>
  screen.getByLabelText(/contraseña/i, {
    selector: "input",
  }) as HTMLInputElement;
const roleOption = (role: "gestor-sap" | "colaborador") =>
  screen.getByLabelText(role === "gestor-sap" ? /gestor sap/i : /colaborador/i);

const fillValid = async (
  user: ReturnType<typeof userEvent.setup>,
  role: "gestor-sap" | "colaborador",
) => {
  await user.type(userInput(), "demo");
  await user.type(passwordInput(), "demo1234");
  await user.click(roleOption(role));
};

describe("LoginForm", () => {
  it("renderiza los campos con etiquetas visibles", () => {
    render(<LoginForm onAuthenticated={() => undefined} />);
    expect(userInput()).toBeInTheDocument();
    expect(passwordInput()).toBeInTheDocument();
    expect(roleOption("gestor-sap")).toBeInTheDocument();
    expect(roleOption("colaborador")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ingresar/i })).toBeInTheDocument();
  });

  it("el formulario expone un nombre accesible y no valida nativamente", () => {
    render(<LoginForm onAuthenticated={() => undefined} />);
    const form = screen.getByRole("form", {
      name: /formulario de inicio de sesión/i,
    });
    expect(form).toBeInTheDocument();
    expect(form).toHaveAttribute("aria-label");
    expect(form).toHaveAttribute("novalidate");
  });

  it("valida identifier vacío", async () => {
    const user = userEvent.setup();
    render(<LoginForm onAuthenticated={() => undefined} />);
    await user.click(screen.getByRole("button", { name: /ingresar/i }));
    expect(screen.getByTestId("login-form-error")).toBeInTheDocument();
    expect(getSession()).toBeNull();
  });

  it("valida password vacío", async () => {
    const user = userEvent.setup();
    render(<LoginForm onAuthenticated={() => undefined} />);
    await user.type(userInput(), "demo");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));
    expect(screen.getByTestId("login-form-error")).toBeInTheDocument();
    expect(getSession()).toBeNull();
  });

  it("valida password corto (<4 caracteres)", async () => {
    const user = userEvent.setup();
    render(<LoginForm onAuthenticated={() => undefined} />);
    await user.type(userInput(), "demo");
    await user.type(passwordInput(), "ab");
    await user.click(roleOption("gestor-sap"));
    await user.click(screen.getByRole("button", { name: /ingresar/i }));
    expect(screen.getByTestId("login-form-error")).toBeInTheDocument();
    // El mensaje aparece tanto en el alert superior como en el helperText del input.
    expect(screen.getAllByText(/4 caracteres/i).length).toBeGreaterThan(0);
    expect(getSession()).toBeNull();
  });

  it("puede alternar la visibilidad de la contraseña", async () => {
    const user = userEvent.setup();
    render(<LoginForm onAuthenticated={() => undefined} />);
    const password = passwordInput();
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /mostrar contraseña/i }));
    expect(password).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: /ocultar contraseña/i }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("con credenciales válidas como Gestor SAP llama a onAuthenticated y persiste la sesión", async () => {
    const user = userEvent.setup();
    const onAuth = vi.fn();
    render(<LoginForm onAuthenticated={onAuth} />);
    await fillValid(user, "gestor-sap");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));
    await waitFor(() => expect(onAuth).toHaveBeenCalledTimes(1));
    const session = getSession();
    expect(session).not.toBeNull();
    expect(session?.role).toBe("gestor-sap");
    expect(session?.identifier).toBe("demo");
  });

  it("con credenciales válidas como Colaborador llama a onAuthenticated y persiste la sesión", async () => {
    const user = userEvent.setup();
    const onAuth = vi.fn();
    render(<LoginForm onAuthenticated={onAuth} />);
    await fillValid(user, "colaborador");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));
    await waitFor(() => expect(onAuth).toHaveBeenCalledTimes(1));
    expect(getSession()?.role).toBe("colaborador");
  });

  it("deshabilita el submit mientras se procesa", async () => {
    const user = userEvent.setup();
    let resolveAuth: () => void = () => undefined;
    const onAuth = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAuth = resolve;
        }),
    );
    render(<LoginForm onAuthenticated={onAuth} />);
    await fillValid(user, "gestor-sap");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));
    const submitting = await screen.findByRole("button", {
      name: /ingresando/i,
    });
    expect(submitting).toBeDisabled();
    expect(submitting).toHaveAttribute("aria-busy", "true");
    resolveAuth();
  });
});
