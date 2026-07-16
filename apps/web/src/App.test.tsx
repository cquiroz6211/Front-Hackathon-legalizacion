import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@comfama/comfama-ui-react";
import App from "./App";

describe("App", () => {
  it("muestra la pantalla de login en la ruta inicial cuando no hay sesión", () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: /iniciar sesión/i })).toBeInTheDocument();
  });
});
