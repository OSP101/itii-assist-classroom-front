import { ProSkeleton } from "@/components/ui/pro-skeleton";

/** Projector fullscreen skeleton — desk grid layout */
export default function Loading() {
  return (
    <div className="flex h-screen w-screen flex-col bg-black p-4 gap-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <ProSkeleton variant="title" className="bg-white/20 w-48" />
        <ProSkeleton variant="badge" className="bg-white/20 w-24" />
      </div>
      {/* Desk grid */}
      <div className="flex-1 grid grid-cols-4 gap-3 content-start">
        {Array.from({ length: 16 }).map((_, i) => (
          <ProSkeleton key={i} variant="card" className="h-20 bg-white/10" />
        ))}
      </div>
    </div>
  );
}
