import { ListSkeleton } from "@/components/ui/list-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-default-900">ระบบคิว</h2>
          <p className="text-sm text-default-500">รอบคิวและรายการจอง</p>
        </div>
        <div className="h-10 rounded-lg bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-600">สร้างรอบคิว</div>
      </div>
      <ListSkeleton items={6} showMeta />
    </div>
  );
}
