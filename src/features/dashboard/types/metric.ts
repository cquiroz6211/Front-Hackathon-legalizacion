import type { ReactNode } from "react";

/** Métrica (KPI) mostrada en el panel general. */
export interface Metric {
  id: string;
  label: string;
  value: string;
  delta: string;
  icon: ReactNode;
}
