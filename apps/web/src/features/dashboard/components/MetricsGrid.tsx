import { metrics } from "../data/dashboard.data";
import { MetricCard } from "./MetricCard";

/** Grilla de KPIs del panel general. */
export const MetricsGrid = () => (
  <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {metrics.map((metric) => (
      <MetricCard key={metric.id} metric={metric} />
    ))}
  </section>
);
