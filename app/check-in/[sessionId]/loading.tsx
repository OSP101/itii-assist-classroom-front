import { ProSkeleton } from "@/components/ui/pro-skeleton";

/**
 * Check-in page skeleton — a simple step-form layout:
 * session info card → submit form below
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        {/* Session info card */}
        <ProSkeleton variant="hero" className="h-32" />
        {/* Form area */}
        <div className="space-y-3">
          <ProSkeleton variant="input" />
          <ProSkeleton variant="input" />
          <ProSkeleton variant="button" className="w-full h-10" />
        </div>
      </div>
    </div>
  );
}
