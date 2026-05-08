/**
 * Page-level skeletons — match the visual footprint of entire pages
 * so there is zero layout shift when content arrives.
 *
 * Each skeleton is sized to match its real counterpart.
 * Use in loading.tsx files.
 */

import { ProSkeleton } from "./pro-skeleton";

// ---------------------------------------------------------------------------
// Dashboard / Home skeletons
// ---------------------------------------------------------------------------

/** Course grid skeleton — used on instructor home */
export function CourseGridSkeleton({
  count = 6,
  showToolbar = true,
}: {
  count?: number;
  showToolbar?: boolean;
}) {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between gap-3">
          <ProSkeleton variant="title" />
          <div className="flex gap-2">
            <ProSkeleton variant="button" />
            <ProSkeleton variant="button" />
          </div>
        </div>
      )}
      {/* Search */}
      <ProSkeleton variant="input" className="max-w-xs" />
      {/* Course cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <ProSkeleton key={i} variant="card" className="h-40" />
        ))}
      </div>
    </div>
  );
}

/** General dashboard skeleton — 4 stat cards + chart + list */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Hero */}
      <ProSkeleton variant="hero" />
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProSkeleton key={i} variant="stat" />
        ))}
      </div>
      {/* Chart + list row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ProSkeleton variant="chart" className="lg:col-span-2" />
        <ProSkeleton variant="list" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Classroom page skeleton
// ---------------------------------------------------------------------------

/** Full classroom page shell — sidebar + main content */
export function ClassroomPageSkeleton() {
  const sidebarWidths = [96, 128, 112, 144, 104, 120, 88, 132];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col gap-1 w-64 border-r border-divider p-3 pt-4">
        {sidebarWidths.map((width, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <ProSkeleton variant="badge" className="h-5 w-5" />
            <ProSkeleton variant="text" className="h-4" style={{ width }} />
          </div>
        ))}
      </aside>
      {/* Main */}
      <main className="flex-1 p-4 lg:p-6 space-y-6">
        <ProSkeleton variant="hero" className="h-36" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProSkeleton key={i} variant="stat" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ProSkeleton variant="chart" />
          <ProSkeleton variant="list" />
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile page skeleton
// ---------------------------------------------------------------------------

/** Profile settings page skeleton — back button + title + sidebar menu + content */
export function ProfilePageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ProSkeleton variant="button" className="h-8 w-8" />
        <div className="space-y-1.5">
          <ProSkeleton variant="title" className="w-36" />
          <ProSkeleton variant="text" className="h-3 w-56" />
        </div>
      </div>
      {/* Mobile tab bar */}
      <div className="flex gap-2 lg:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <ProSkeleton key={i} variant="button" className="h-8 w-24" />
        ))}
      </div>
      {/* Main layout */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col gap-1 w-56 shrink-0">
          <ProSkeleton variant="avatar" className="h-20 w-20 rounded-full mx-auto mb-3" />
          <ProSkeleton variant="text" className="h-4 w-32 mx-auto mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <ProSkeleton key={i} variant="text" className="h-10 rounded-xl" />
          ))}
        </aside>
        {/* Content */}
        <div className="flex-1 space-y-4">
          <ProSkeleton variant="card" className="h-40" />
          <ProSkeleton variant="card" className="h-60" />
        </div>
      </div>
    </div>
  );
}
