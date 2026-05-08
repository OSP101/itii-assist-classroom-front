import { Skeleton } from "@heroui/skeleton";

export function MetricValueSkeleton({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-7 w-14 rounded-lg ${className}`} />;
}

export function MetricCardSkeleton({
  iconClassName = "bg-default-100",
  lines = 1,
}: {
  iconClassName?: string;
  lines?: 1 | 2;
}) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 sm:p-2.5 rounded-xl ${iconClassName}`}>
          <Skeleton className="h-6 w-6 rounded-lg" />
        </div>
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-20 rounded-lg" />
          <MetricValueSkeleton />
          {lines === 2 && <Skeleton className="h-3 w-16 rounded-lg" />}
        </div>
      </div>
    </div>
  );
}

export function TableRowsSkeleton({
  rows = 7,
  columns,
}: {
  rows?: number;
  columns: string[];
}) {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid items-center gap-3 border-b border-slate-100 px-2 py-3 last:border-b-0"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {columns.map((width, columnIndex) => (
            <Skeleton key={`${rowIndex}-${columnIndex}`} className={`h-4 rounded-lg ${width}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
