import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@comfama/comfama-ui-react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HistorialPage } from "./HistorialPage";
import type { DocumentRecord, Legalization } from "./types/document";

const DOCS_KEY = "comfama.legalizacion.documents.v1";
const LEGS_KEY = "comfama.legalizacion.legalizations.v1";

function setDocuments(docs: DocumentRecord[]): void {
  window.localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

function setLegalizations(list: Legalization[]): void {
  window.localStorage.setItem(LEGS_KEY, JSON.stringify(list));
}

function clearAll(): void {
  window.localStorage.removeItem(DOCS_KEY);
  window.localStorage.removeItem(LEGS_KEY);
  window.localStorage.removeItem("comfama.legalizacion.role.v1");
}

function doc(id: string, fecha: string, total: string, fileName: string): DocumentRecord {
  return {
    id,
    fileName,
    fileType: "application/pdf",
    fileSize: 1024,
    status: "processing",
    role: "personal",
    uploadedAt: "2024-02-01T00:00:00.000Z",
    extracted: {
      fecha,
      nroFactura: `F-${id}`,
      proveedor: "Prov",
      cliente: "Comfama",
      cuit: "30-71452896-1",
      nit: "900.123.456-7",
      direccion: "Calle 1",
      telefono: "+57 1",
      departamento: "Antioquia",
      municipio: "Medellín",
      monto: total,
      kilometraje: "0",
      iva19Base: "0,00",
      iva19Valor: "0,00",
      iva5Base: "0,00",
      iva5Valor: "0,00",
      iva0Base: "0,00",
      iva0Valor: "0,00",
      totalFactura: total,
      propina: "0,00",
    },
  };
}

/**
 * Siembra dos legalizaciones con timestamps y fechas de consumo controladas:
 * - alpha001: draft, consumo 2024-02-10, total 100.000, registro 2024-02-01.
 * - bravo002: submitted, consumo 2024-03-15, total 50.000, registro 2024-03-12.
 */
function seedFixtures(): void {
  setDocuments([
    doc("doc-alpha", "2024-02-10", "100.000,00", "factura-alpha.pdf"),
    doc("doc-bravo", "2024-03-15", "50.000,00", "factura-bravo.pdf"),
  ]);
  setLegalizations([
    {
      id: "alpha001",
      period: "Febrero 2024",
      status: "draft",
      expenseIds: ["doc-alpha"],
      createdAt: "2024-02-01T00:00:00.000Z",
      anticipo: 1_500_000,
    },
    {
      id: "bravo002",
      period: "Marzo 2024",
      status: "submitted",
      expenseIds: ["doc-bravo"],
      createdAt: "2024-03-10T00:00:00.000Z",
      submittedAt: "2024-03-12T00:00:00.000Z",
      anticipo: 1_500_000,
    },
  ]);
}

function renderPage(): void {
  render(
    <ToastProvider>
      <MemoryRouter>
        <HistorialPage />
      </MemoryRouter>
    </ToastProvider>,
  );
}

type Clicker = { type: (element: Element, text: string) => Promise<void> };

/**
 * Completa un DateField (día/mes/año) por id base, disparando su `onChange`
 * con una fecha válida. Los DateField exponen inputs `${id}-day|month|year`.
 */
async function typeDate(
  user: Clicker,
  idBase: string,
  day: string,
  month: string,
  year: string,
): Promise<void> {
  await user.type(document.getElementById(`${idBase}-day`) as HTMLElement, day);
  await user.type(document.getElementById(`${idBase}-month`) as HTMLElement, month);
  await user.type(document.getElementById(`${idBase}-year`) as HTMLElement, year);
}

describe("HistorialPage (HU-0010)", () => {
  beforeEach(clearAll);
  afterEach(clearAll);

  it("E1/E2: lista las legalizaciones con identificador y estado", () => {
    seedFixtures();
    renderPage();
    expect(screen.getByText("SOL-ALPHA001")).toBeInTheDocument();
    expect(screen.getByText("SOL-BRAVO002")).toBeInTheDocument();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(screen.getByText("En aprobación")).toBeInTheDocument();
  });

  it("E2: muestra el total de cada registro", () => {
    seedFixtures();
    renderPage();
    expect(screen.getByText(/100\.000/)).toBeInTheDocument();
    expect(screen.getByText(/50\.000/)).toBeInTheDocument();
  });

  it("E5: al seleccionar un registro abre el detalle con sus soportes", async () => {
    const user = userEvent.setup();
    seedFixtures();
    renderPage();

    expect(screen.queryByText("factura-bravo.pdf")).not.toBeInTheDocument();

    const detailButtons = screen.getAllByRole("button", { name: /ver detalle/i });
    await user.click(detailButtons[0]);

    expect(await screen.findByText("factura-bravo.pdf")).toBeInTheDocument();
    expect(screen.getByText("Soportes asociados")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /revisar/i })).toBeInTheDocument();
  });

  it("E3: filtrar por consumo desde 2024-03-01 deja solo bravo", async () => {
    const user = userEvent.setup();
    seedFixtures();
    renderPage();

    await typeDate(user, "consumo-desde", "01", "03", "2024");

    expect(await screen.findByText("SOL-BRAVO002")).toBeInTheDocument();
    expect(screen.queryByText("SOL-ALPHA001")).not.toBeInTheDocument();
  });

  it("E4: filtrar por registro deja solo la enviada en ese rango", async () => {
    const user = userEvent.setup();
    seedFixtures();
    renderPage();

    await typeDate(user, "registro-desde", "11", "03", "2024");
    await typeDate(user, "registro-hasta", "13", "03", "2024");

    expect(await screen.findByText("SOL-BRAVO002")).toBeInTheDocument();
    expect(screen.queryByText("SOL-ALPHA001")).not.toBeInTheDocument();
  });

  it("E6: sin resultados muestra el mensaje requerido", async () => {
    const user = userEvent.setup();
    seedFixtures();
    renderPage();

    await typeDate(user, "consumo-desde", "01", "04", "2024");

    expect(
      await screen.findByText(/No hay registros para el criterio seleccionado/i),
    ).toBeInTheDocument();
  });

  it("Limpiar filtros restaura los registros", async () => {
    const user = userEvent.setup();
    seedFixtures();
    renderPage();

    await typeDate(user, "consumo-desde", "01", "04", "2024");
    expect(
      await screen.findByText(/No hay registros para el criterio seleccionado/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /limpiar filtros/i }));
    expect(await screen.findByText("SOL-ALPHA001")).toBeInTheDocument();
    expect(screen.getByText("SOL-BRAVO002")).toBeInTheDocument();
  });

  it("sin legalizaciones muestra el estado vacío con CTA", () => {
    setDocuments([]);
    setLegalizations([]);
    renderPage();
    expect(screen.getByText(/Aún no tenés legalizaciones/i)).toBeInTheDocument();
  });
});
