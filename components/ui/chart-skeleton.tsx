/**
 * Chart skeleton — placeholder for Recharts / data visualisation components.
 * Use inside <Suspense> fallback for chart sections so they load
 * after critical data without blocking the initial render.
 */

import { ProSkeleton } from "./pro-skeleton";

type ChartSkeletonProps = {
  height?: string;
  showLegend?: boolean;
  className?: string;
};

export function ChartSkeleton({ height = "h-64", showLegend = true, className }: ChartSkeletonProps) {
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {/* Title */}
      <ProSkeleton variant="title" className="w-32" />
      {/* Chart area */}
      <ProSkeleton variant="chart" className={height} />
      {/* Legend */}
      {showLegend && (
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <ProSkeleton variant="badge" className="h-3 w-3 rounded-sm" />
              <ProSkeleton variant="text" className="h-3 w-12" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Analytics section — multiple charts in a grid */
export function AnalyticsSectionSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartSkeleton height="h-60" />
      <ChartSkeleton height="h-60" />
    </div>
  );
}
