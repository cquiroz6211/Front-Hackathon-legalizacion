import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@comfama/comfama-ui-react";
import App from "./App";

describe("App", () => {
  it("monta la SPA en la ruta inicial (Panel)", () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: /^panel$/i })).toBeInTheDocument();
  });
});
