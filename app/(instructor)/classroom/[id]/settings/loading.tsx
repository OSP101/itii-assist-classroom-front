import { FormSkeleton } from "@/components/ui/form-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-default-900">ตั้งค่ารายวิชา</h2>
        <p className="text-sm text-default-500">รายละเอียดและเกณฑ์ของรายวิชา</p>
      </div>
      <FormSkeleton fields={6} />
    </div>
  );
}
