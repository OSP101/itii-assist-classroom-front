import { Skeleton } from "@heroui/skeleton";

export default function TablePaginationFooterSkeleton() {
  return (
    <div className="flex flex-col gap-3 border border-default-200 bg-content1 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:px-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Skeleton className="mx-auto h-4 w-40 rounded-lg sm:mx-0 sm:w-48" />

        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg sm:w-28" />
        </div>
      </div>

      <div className="flex justify-center gap-2 sm:justify-end">
        {[...Array(5)].map((_, index) => (
          <Skeleton key={index} className="h-8 w-8 rounded-lg" />
        ))}
      </div>
    </div>
  );
}