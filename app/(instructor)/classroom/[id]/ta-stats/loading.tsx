import { DashboardSkeleton } from "@/components/ui/page-shell-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-default-900">สถิติผู้ช่วยสอน</h2>
        <p className="text-sm text-default-500">ภาพรวมการช่วยตรวจและดูแลรายวิชา</p>
      </div>
      <DashboardSkeleton />
    </div>
  );
}
