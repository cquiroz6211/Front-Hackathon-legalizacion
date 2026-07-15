import { render, screen } from "@testing-library/react";
import { AfiliacionesPage } from "./AfiliacionesPage";

describe("AfiliacionesPage", () => {
  it("renderiza el encabezado y las solicitudes", () => {
    render(<AfiliacionesPage />);
    expect(screen.getByRole("heading", { name: /solicitudes de afiliación/i })).toBeInTheDocument();
    expect(screen.getByText("Ana Restrepo")).toBeInTheDocument();
  });
});
