import { LuArrowUpRight } from "react-icons/lu";

import { Typography } from "@comfama/comfama-ui-react";

import type { Metric } from "../types/metric";

interface MetricCardProps {
  metric: Metric;
}

/** Tarjeta individual de KPI. */
export const MetricCard = ({ metric }: MetricCardProps) => (
  <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-main [&>svg]:h-5 [&>svg]:w-5">
        {metric.icon}
      </span>
      <span className="inline-flex items-center gap-0.5 text-sm font-medium text-success-main">
        <LuArrowUpRight className="h-4 w-4" />
        {metric.delta}
      </span>
    </div>
    <div className="flex flex-col gap-1">
      <Typography variant="h4" className="text-typography-dark">
        {metric.value}
      </Typography>
      <Typography variant="body2" className="text-secondary-600">
        {metric.label}
      </Typography>
    </div>
  </div>
);
