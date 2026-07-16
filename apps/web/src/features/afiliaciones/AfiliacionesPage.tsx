import { Typography } from "@comfama/comfama-ui-react";

import { affiliations } from "./data/afiliaciones.data";
import { SolicitudesTable } from "./components/SolicitudesTable";

/** Vista del dominio de afiliación: listado completo de solicitudes (ruta `/afiliaciones`). */
export const AfiliacionesPage = () => (
  <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
    <Typography variant="subtitle1" className="font-bold text-typography-dark">
      Solicitudes de afiliación
    </Typography>
    <SolicitudesTable data={affiliations} initialPageSize={5} />
  </section>
);
