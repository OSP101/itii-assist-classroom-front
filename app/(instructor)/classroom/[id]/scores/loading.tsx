import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-default-900">สรุปคะแนน</h2>
        <p className="text-sm text-default-500">คะแนนงานและคะแนนรวมของนักศึกษา</p>
      </div>
      <TableSkeleton rows={8} cols={7} />
    </div>
  );
}
