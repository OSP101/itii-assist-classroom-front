import { Skeleton } from "@heroui/skeleton";

export default function MonitoringLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="w-40 h-5 rounded-lg" />
          <Skeleton className="w-60 h-3 rounded-lg" />
        </div>
      </div>
      <Skeleton className="w-full h-14 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
