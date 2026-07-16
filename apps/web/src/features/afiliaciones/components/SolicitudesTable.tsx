import { Chip, DataTable } from "@comfama/comfama-ui-react";
import type { ColumnDefinition } from "@comfama/comfama-ui-react";

import { statusColor } from "../data/afiliaciones.data";
import type { Affiliation } from "../types/afiliacion";

const columns: ColumnDefinition<Affiliation>[] = [
  { accessorKey: "id", header: "Radicado", enableSorting: true },
  { accessorKey: "afiliado", header: "Afiliado", enableSorting: true },
  { accessorKey: "empresa", header: "Empresa" },
  {
    accessorKey: "categoria",
    header: "Categoría",
    cell: (row) => (
      <Chip color="info" hoverable={false}>
        {`Categoría ${row.categoria}`}
      </Chip>
    ),
  },
  {
    accessorKey: "estado",
    header: "Estado",
    cell: (row) => (
      <Chip color={statusColor[row.estado]} hoverable={false}>
        {row.estado}
      </Chip>
    ),
  },
];

interface SolicitudesTableProps {
  data: Affiliation[];
  initialPageSize?: number;
}

/** Tabla reutilizable de solicitudes de afiliación. */
export const SolicitudesTable = ({ data, initialPageSize = 5 }: SolicitudesTableProps) => (
  <DataTable<Affiliation> columns={columns} data={data} initialPageSize={initialPageSize} />
);
