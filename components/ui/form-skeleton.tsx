/**
 * Form skeleton — matches a generic form layout so the page doesn't shift
 * when the form loads. Use in settings / profile / create modals.
 */

import { ProSkeleton } from "./pro-skeleton";

type FormSkeletonProps = {
  fields?: number;
  showTitle?: boolean;
  className?: string;
};

export function FormSkeleton({ fields = 5, showTitle = true, className }: FormSkeletonProps) {
  return (
    <div className={`space-y-5 p-4 lg:p-6 ${className ?? ""}`}>
      {showTitle && <ProSkeleton variant="title" className="w-48" />}
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <ProSkeleton variant="text" className="h-3.5 w-24" />
          <ProSkeleton variant="input" />
        </div>
      ))}
      {/* Submit button */}
      <div className="flex justify-end gap-2 pt-2">
        <ProSkeleton variant="button" className="w-20" />
        <ProSkeleton variant="button" className="w-28" />
      </div>
    </div>
  );
}
