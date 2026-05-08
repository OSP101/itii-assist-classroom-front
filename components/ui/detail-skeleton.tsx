/**
 * Detail skeleton — for single-item detail pages (course detail, student detail, etc.)
 */

import { ProSkeleton } from "./pro-skeleton";

export function DetailSkeleton() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <ProSkeleton variant="avatar" className="h-16 w-16 rounded-xl" />
        <div className="space-y-2 flex-1">
          <ProSkeleton variant="title" />
          <ProSkeleton variant="text" className="h-4 w-64" />
        </div>
      </div>
      {/* Meta badges */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProSkeleton key={i} variant="badge" />
        ))}
      </div>
      {/* Content body */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <ProSkeleton variant="card" className="h-36" />
          <ProSkeleton variant="card" className="h-28" />
        </div>
        <div className="space-y-4">
          <ProSkeleton variant="card" className="h-36" />
          <ProSkeleton variant="card" className="h-24" />
        </div>
      </div>
    </div>
  );
}
