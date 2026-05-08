/**
 * Table skeleton — mimics a data table with header + body rows.
 * Used for all list/table pages as initial loading state.
 *
 * Do NOT show this skeleton when the table already has data and is
 * merely refreshing (e.g., on filter/search change). Use UpdatingIndicator
 * from pro-skeleton instead.
 */

import { ProSkeleton } from "./pro-skeleton";

type TableSkeletonProps = {
  /** Number of body rows to render */
  rows?: number;
  /** Number of columns */
  cols?: number;
  /** Show a toolbar row above the table */
  showToolbar?: boolean;
};

export function TableSkeleton({ rows = 8, cols = 5, showToolbar = true }: TableSkeletonProps) {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      {showToolbar && (
        <div className="flex items-center justify-between gap-3">
          <ProSkeleton variant="input" className="max-w-xs" />
          <div className="flex gap-2">
            <ProSkeleton variant="button" />
            <ProSkeleton variant="button" />
          </div>
        </div>
      )}
      <div className="rounded-xl border border-divider overflow-hidden">
        {/* Table header */}
        <div className="flex gap-4 px-4 py-3 border-b border-divider bg-default-50">
          {Array.from({ length: cols }).map((_, i) => (
            <ProSkeleton
              key={i}
              variant="text"
              className="h-4"
              style={{ width: `${60 + i * 12}px`, flexShrink: 0 }}
            />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-divider last:border-0"
          >
            {Array.from({ length: cols }).map((_, j) => (
              <ProSkeleton
                key={j}
                variant="text"
                className="h-4"
                style={{ width: `${50 + j * 15}px`, flexShrink: 0 }}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Pagination */}
      <div className="flex justify-end gap-2">
        <ProSkeleton variant="button" className="w-20" />
        <ProSkeleton variant="button" className="w-20" />
      </div>
    </div>
  );
}
