import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InvoicePreview } from "./InvoicePreview";
import type { ExtractedFields } from "../types/document";

const FIELDS: ExtractedFields = {
  fecha: "2024-01-01",
  nroFactura: "F-100",
  proveedor: "Proveedor X",
  cliente: "Comfama",
  cuit: "30-71452896-1",
  nit: "900.123.456-7",
  direccion: "Calle 1",
  telefono: "+57 1 000 0000",
  departamento: "Antioquia",
  municipio: "Medellín",
  monto: "123.456,00",
  kilometraje: "0",
  iva19Base: "0,00",
  iva19Valor: "0,00",
  iva5Base: "0,00",
  iva5Valor: "0,00",
  iva0Base: "0,00",
  iva0Valor: "0,00",
  totalFactura: "123.456,00",
};

describe("InvoicePreview", () => {
  it("muestra el número de factura recibido", () => {
    render(<InvoicePreview fields={FIELDS} />);
    expect(screen.getByText(/F-100/i)).toBeInTheDocument();
  });

  it("aplica defaults cuando los campos vienen vacíos", () => {
    const empty: ExtractedFields = { ...FIELDS, nroFactura: "", monto: "" };
    render(<InvoicePreview fields={empty} />);
    expect(screen.getByText(/0001-00002834/i)).toBeInTheDocument();
    expect(screen.getByText(/\$559\.625,00/i)).toBeInTheDocument();
  });

  it("muestra el nombre de archivo cuando se provee", () => {
    render(<InvoicePreview fields={FIELDS} fileName="factura.pdf" />);
    expect(screen.getByText(/factura\.pdf/i)).toBeInTheDocument();
  });
});