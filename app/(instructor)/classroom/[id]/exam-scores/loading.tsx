import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-default-900">คะแนนสอบ</h2>
        <p className="text-sm text-default-500">คะแนนสอบและการตั้งค่า</p>
      </div>
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
