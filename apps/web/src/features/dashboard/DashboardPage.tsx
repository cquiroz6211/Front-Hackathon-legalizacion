import { useNavigate } from "react-router-dom";

import { Button, Typography } from "@comfama/comfama-ui-react";

import { recentAffiliations, SolicitudesTable } from "@/features/afiliaciones";

import { useAportesReminder } from "./hooks/useAportesReminder";
import { MetricsGrid } from "./components/MetricsGrid";

/** Panel general (ruta `/`): KPIs + resumen de actividad reciente. */
export const DashboardPage = () => {
  const navigate = useNavigate();
  useAportesReminder();

  return (
    <>
      <MetricsGrid />

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <Typography variant="subtitle1" className="font-bold text-typography-dark">
            Solicitudes de afiliación recientes
          </Typography>
          <Button variant="text" size="sm" action={() => navigate("/afiliaciones")}>
            Ver todas
          </Button>
        </div>
        <SolicitudesTable data={recentAffiliations} initialPageSize={5} />
      </section>
    </>
  );
};
