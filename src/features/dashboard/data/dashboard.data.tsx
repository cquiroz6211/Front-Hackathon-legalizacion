import { LuBuilding2, LuUserPlus, LuUsers, LuWallet } from "react-icons/lu";

import type { Metric } from "../types/metric";

/**
 * KPIs de demostración del panel general. En un caso real vendrían de
 * `services/` (API). Aquí son estáticos solo para ilustrar el baseline.
 */
export const metrics: Metric[] = [
  {
    id: "afiliados",
    label: "Afiliados activos",
    value: "128.540",
    delta: "+3,2%",
    icon: <LuUsers />,
  },
  {
    id: "nuevos",
    label: "Nuevas afiliaciones",
    value: "1.847",
    delta: "+9,4%",
    icon: <LuUserPlus />,
  },
  {
    id: "aportes",
    label: "Aportes recaudados",
    value: "$52.300M",
    delta: "+6,1%",
    icon: <LuWallet />,
  },
  {
    id: "empresas",
    label: "Empresas afiliadas",
    value: "4.312",
    delta: "+2,8%",
    icon: <LuBuilding2 />,
  },
];
