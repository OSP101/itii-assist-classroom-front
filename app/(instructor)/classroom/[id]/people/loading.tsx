import { ListSkeleton } from "@/components/ui/list-skeleton";
import { ProSkeleton } from "@/components/ui/pro-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Tab headers */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <ProSkeleton key={i} variant="button" className="w-24" />
        ))}
      </div>
      <ListSkeleton items={8} showAvatar showMeta />
    </div>
  );
}
