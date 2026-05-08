/**
 * List skeleton — for vertical card/item lists (not tables).
 * Use for: recent activity, assignment cards, queue session cards, team lists.
 */

import { ProSkeleton } from "./pro-skeleton";

type ListSkeletonProps = {
  items?: number;
  showAvatar?: boolean;
  showMeta?: boolean;
  className?: string;
};

export function ListSkeleton({
  items = 5,
  showAvatar = false,
  showMeta = true,
  className,
}: ListSkeletonProps) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-divider px-4 py-3"
        >
          {showAvatar && <ProSkeleton variant="avatar" className="shrink-0" />}
          <div className="flex-1 space-y-1.5">
            <ProSkeleton variant="text" className="h-4 w-3/4" />
            {showMeta && <ProSkeleton variant="text" className="h-3 w-1/2" />}
          </div>
          <ProSkeleton variant="badge" className="shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Card grid skeleton — for course-like card grids */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProSkeleton key={i} variant="card" className="h-40" />
      ))}
    </div>
  );
}
