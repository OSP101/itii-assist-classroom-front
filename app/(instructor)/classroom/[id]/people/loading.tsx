import { ListSkeleton } from "@/components/ui/list-skeleton";
import { ProSkeleton } from "@/components/ui/pro-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div>
        <h2 className="text-xl font-bold text-default-900">สมาชิกในรายวิชา</h2>
        <p className="text-sm text-default-500">อาจารย์ ผู้ช่วยสอน และนักศึกษา</p>
      </div>
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
