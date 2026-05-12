import { CourseGridSkeleton } from "@/components/ui/page-shell-skeleton";
import { getRequestLanguage } from "@/lib/server-i18n";

export default async function Loading() {
  const language = await getRequestLanguage();

  return (
    <div className="space-y-4">
      <div className="p-4 lg:p-6 pb-0">
        <h1 className="text-xl sm:text-2xl font-bold text-default-900">{language === "en" ? "My Courses" : "รายวิชาของฉัน"}</h1>
        <p className="text-sm text-default-500">{language === "en" ? "Active courses" : "รายวิชาที่เปิดใช้งานอยู่"}</p>
      </div>
      <CourseGridSkeleton showToolbar={false} />
    </div>
  );
}
