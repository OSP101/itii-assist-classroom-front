import { ListSkeleton } from "@/components/ui/list-skeleton";
import { ProSkeleton } from "@/components/ui/pro-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <ProSkeleton variant="title" />
      <ListSkeleton items={5} showMeta />
    </div>
  );
}
