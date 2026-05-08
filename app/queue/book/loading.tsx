import { ProSkeleton } from "@/components/ui/pro-skeleton";

/** Queue booking step-form skeleton */
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <ProSkeleton variant="hero" className="h-28" />
        <ProSkeleton variant="input" className="h-12" />
        <ProSkeleton variant="button" className="w-full h-11" />
      </div>
    </div>
  );
}
