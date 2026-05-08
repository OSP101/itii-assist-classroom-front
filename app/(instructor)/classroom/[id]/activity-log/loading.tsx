import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-default-900">บันทึกกิจกรรม</h2>
        <p className="text-sm text-default-500">รายการกิจกรรมในห้องเรียน</p>
      </div>
      <TableSkeleton rows={12} cols={4} />
    </div>
  );
}
