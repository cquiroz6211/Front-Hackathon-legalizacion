import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@comfama/comfama-ui-react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GestorPage } from "./GestorPage";
import { signOut } from "@/features/auth";
import type { DocumentRecord, Legalization } from "./types/document";

const DOCS_KEY = "comfama.legalizacion.documents.v1";
const LEGS_KEY = "comfama.legalizacion.legalizations.v1";
const SESSION_KEY = "comfama.auth.session.v1";

function setDocuments(docs: DocumentRecord[]): void {
  window.localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

function setLegalizations(list: Legalization[]): void {
  window.localStorage.setItem(LEGS_KEY, JSON.stringify(list));
}

function setGestorSession(): void {
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      role: "gestor-sap",
      identifier: "gestor.demo",
      signedInAt: new Date().toISOString(),
    }),
  );
}

function clearAll(): void {
  window.localStorage.removeItem(DOCS_KEY);
  window.localStorage.removeItem(LEGS_KEY);
  window.localStorage.removeItem("comfama.legalizacion.role.v1");
  window.localStorage.removeItem(SESSION_KEY);
}

function doc(id: string, total: string, fileName: string): DocumentRecord {
  return {
    id,
    fileName,
    fileType: "application/pdf",
    fileSize: 1024,
    status: "processing",
    role: "personal",
    uploadedAt: "2024-03-01T00:00:00.000Z",
    extracted: {
      fecha: "2024-03-01",
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
 * Siembra una legalización `submitted` (pendiente de decisión del gestor) con un
 * soporte, más una `draft` y una `approved` que NO deben aparecer en la bandeja.
 */
function seedFixtures(): void {
  setDocuments([doc("doc-pend", "100.000,00", "factura-pendiente.pdf")]);
  setLegalizations([
    {
      id: "pend-001",
      period: "Marzo 2024",
      status: "submitted",
      expenseIds: ["doc-pend"],
      createdAt: "2024-03-01T00:00:00.000Z",
      submittedAt: "2024-03-12T00:00:00.000Z",
      anticipo: 1_500_000,
    },
    {
      id: "borrador-001",
      period: "Abril 2024",
      status: "draft",
      expenseIds: [],
      createdAt: "2024-04-01T00:00:00.000Z",
      anticipo: 1_500_000,
    },
    {
      id: "aprobada-001",
      period: "Febrero 2024",
      status: "approved",
      expenseIds: [],
      createdAt: "2024-02-01T00:00:00.000Z",
      anticipo: 1_500_000,
    },
  ]);
}

function renderPage(): void {
  setGestorSession();
  render(
    <ToastProvider>
      <MemoryRouter>
        <GestorPage />
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe("GestorPage (HU-0011 lado gestor)", () => {
  beforeEach(() => {
    signOut();
    clearAll();
  });
  afterEach(clearAll);

  it("lista solo las legalizaciones pendientes (submitted) con su total", () => {
    seedFixtures();
    renderPage();
    expect(screen.getByText("Marzo 2024")).toBeInTheDocument();
    // El borrador no aparece en ningún lado (ni pendientes ni historial).
    expect(screen.queryByText("Abril 2024")).not.toBeInTheDocument();
    // La aprobada no está entre los pendientes, pero sí en el historial de decisiones.
    expect(screen.getByText("Febrero 2024")).toBeInTheDocument();
    // Muestra el total del ítem pendiente.
    expect(screen.getByText(/100\.000/)).toBeInTheDocument();
    // Muestra la identidad del gestor en sesión (header + ficha de sesión).
    expect(screen.getAllByText("gestor.demo").length).toBeGreaterThan(0);
  });

  it("aprueba y remueve el ítem de la bandeja", async () => {
    const user = userEvent.setup();
    seedFixtures();
    renderPage();

    // Expandir el detalle para exponer las acciones (el primer "Ver detalle"
    // es el de la bandeja de pendientes; el historial de decisiones tiene el suyo).
    await user.click(screen.getAllByRole("button", { name: /ver detalle/i })[0]);
    expect(screen.getByRole("button", { name: /aprobar/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /aprobar/i }));

    // La legalización aprobada sale de la bandeja de pendientes (estado
    // terminal) y pasa al historial de decisiones del gestor, junto a la
    // "Febrero 2024" ya aprobada de las fixtures (dos chips "Aprobado").
    expect(screen.getByText(/No hay legalizaciones pendientes/i)).toBeInTheDocument();
    expect(screen.getByText("Marzo 2024")).toBeInTheDocument();
    expect(screen.getAllByText("Aprobado")).toHaveLength(2);
  });

  it("rechazar sin motivo no remueve el ítem (motivo obligatorio)", async () => {
    const user = userEvent.setup();
    seedFixtures();
    renderPage();

    await user.click(screen.getAllByRole("button", { name: /ver detalle/i })[0]);
    await user.click(screen.getByRole("button", { name: /rechazar/i }));

    // Confirmar con motivo vacío mantiene el ítem en la bandeja.
    await user.click(screen.getByRole("button", { name: /confirmar rechazo/i }));
    expect(screen.getByText("Marzo 2024")).toBeInTheDocument();
  });

  it("rechazar con motivo remueve el ítem de la bandeja", async () => {
    const user = userEvent.setup();
    seedFixtures();
    renderPage();

    await user.click(screen.getAllByRole("button", { name: /ver detalle/i })[0]);
    await user.click(screen.getByRole("button", { name: /rechazar/i }));

    const reasonField = screen.getByLabelText(/motivo del rechazo/i);
    await user.type(reasonField, "Falta soporte");
    await user.click(screen.getByRole("button", { name: /confirmar rechazo/i }));

    // La legalización rechazada sale de la bandeja de pendientes (estado
    // terminal) y pasa al historial de decisiones del gestor.
    expect(screen.getByText(/No hay legalizaciones pendientes/i)).toBeInTheDocument();
    expect(screen.getByText("Marzo 2024")).toBeInTheDocument();
    expect(screen.getByText("Rechazado")).toBeInTheDocument();
  });

  it("sin pendientes muestra el estado vacío", () => {
    setDocuments([]);
    setLegalizations([]);
    renderPage();
    expect(screen.getByText(/No hay legalizaciones pendientes/i)).toBeInTheDocument();
  });
});
