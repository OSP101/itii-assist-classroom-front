import { CourseGridSkeleton } from "@/components/ui/page-shell-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="p-4 lg:p-6 pb-0">
        <h1 className="text-xl sm:text-2xl font-bold text-default-900">รายวิชาที่ปิดแล้ว</h1>
        <p className="text-sm text-default-500">รายวิชาที่ไม่ได้เปิดใช้งาน</p>
      </div>
      <CourseGridSkeleton showToolbar={false} />
    </div>
  );
}
