import { ListSkeleton } from "@/components/ui/list-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div>
        <h2 className="text-xl font-bold text-default-900">กลุ่มเรียนและทีม</h2>
        <p className="text-sm text-default-500">กลุ่มเรียน ทีมถาวร และทีมรายสัปดาห์</p>
      </div>
      <ListSkeleton items={5} showMeta />
    </div>
  );
}
