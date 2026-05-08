import { ProSkeleton } from "@/components/ui/pro-skeleton";
import { TableSkeleton } from "@/components/ui/table-skeleton";

/** Live attendance monitor skeleton */
export default function Loading() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Session info banner */}
      <ProSkeleton variant="hero" className="h-24" />
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ProSkeleton key={i} variant="stat" />
        ))}
      </div>
      {/* Records table */}
      <TableSkeleton rows={10} cols={4} showToolbar={false} />
    </div>
  );
}
