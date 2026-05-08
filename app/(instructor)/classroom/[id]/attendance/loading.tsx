import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-default-900">เช็คชื่อ</h2>
        <p className="text-sm text-default-500">รอบการเช็คชื่อและสถานะนักศึกษา</p>
      </div>
      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
