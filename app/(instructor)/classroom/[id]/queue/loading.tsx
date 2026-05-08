import { ListSkeleton } from "@/components/ui/list-skeleton";
import { ProSkeleton } from "@/components/ui/pro-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <ProSkeleton variant="title" />
        <ProSkeleton variant="button" />
      </div>
      <ListSkeleton items={6} showMeta />
    </div>
  );
}
