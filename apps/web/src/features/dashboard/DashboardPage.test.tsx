import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@comfama/comfama-ui-react";
import { DashboardPage } from "./DashboardPage";

const renderPage = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </ToastProvider>,
  );

describe("DashboardPage", () => {
  it("muestra los KPIs y el resumen de solicitudes recientes", () => {
    renderPage();
    expect(screen.getByText("Afiliados activos")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /solicitudes de afiliación recientes/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana Restrepo")).toBeInTheDocument();
  });

  it("dispara un toast de recordatorio de cierre de aportes al montar", async () => {
    renderPage();
    expect(await screen.findByText("Cierre de aportes")).toBeInTheDocument();
  });
});
