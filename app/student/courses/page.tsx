"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { courseService, type Course } from "@/services/course.service";
import { CourseCoverImage } from "@/components/course";

const COURSE_PALETTES = [
  { bg: "bg-slate-900", ring: "ring-slate-200" },
  { bg: "bg-blue-700", ring: "ring-blue-100" },
  { bg: "bg-emerald-700", ring: "ring-emerald-100" },
  { bg: "bg-amber-600", ring: "ring-amber-100" },
  { bg: "bg-rose-700", ring: "ring-rose-100" },
  { bg: "bg-indigo-700", ring: "ring-indigo-100" },
] as const;

function getCourseColor(code: string) {
  let n = 0;
  for (let i = 0; i < code.length; i++) n += code.charCodeAt(i);
  return COURSE_PALETTES[n % COURSE_PALETTES.length];
}

function CourseInitialBadge({ code }: { code: string }) {
  const pal = getCourseColor(code);
  const letters = code.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || code.slice(0, 2).toUpperCase();
  return (
    <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${pal.bg} text-sm font-bold text-white ring-2 ${pal.ring} shadow-sm`}>
      {letters}
    </span>
  );
}

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await courseService.getMyCourses({ status: "active", limit: 50, sortBy: "created_at", sortOrder: "DESC" });
        if (!res.success || !res.data) throw new Error(res.message || "ไม่สามารถโหลดรายวิชาได้");
        setCourses(res.data.courses || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ไม่สามารถโหลดรายวิชาได้");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-4 pb-2">
      {/* Header */}
      <div className="relative overflow-hidden rounded-4xl border border-slate-200/70 bg-slate-900 p-5 shadow-lg shadow-slate-300/30 sm:p-6">
        <span className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-300">รายวิชา</p>
            <h2 className="mt-0.5 text-xl font-bold text-white">รายวิชาของฉัน</h2>
          </div>
          {!isLoading && !error && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
              <Icon icon="solar:notebook-bookmark-bold" className="text-sm" />
              {courses.length} วิชา
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-4 rounded-4xl border border-slate-100 bg-white/80 p-4">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 rounded-full bg-slate-200" />
                <div className="h-4 w-2/3 rounded-full bg-slate-200" />
                <div className="h-3 w-1/2 rounded-full bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex items-start gap-4 rounded-4xl border border-amber-200 bg-amber-50/80 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
            <Icon icon="solar:danger-triangle-bold" className="text-xl text-amber-600" />
          </span>
          <div>
            <p className="font-semibold text-amber-900">ดึงรายวิชาไม่ได้</p>
            <p className="mt-0.5 text-sm text-amber-700/80">{error}</p>
          </div>
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-4xl border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <Icon icon="solar:notebook-bookmark-bold" className="text-2xl text-slate-400" />
          </span>
          <div>
            <p className="font-semibold text-slate-700">ยังไม่มีรายวิชา</p>
            <p className="mt-1 text-sm text-slate-400">ยังไม่พบรายวิชาที่ลงทะเบียนสำหรับบัญชีนี้</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/student/courses/${course.id}`}
              className="group flex items-center gap-4 rounded-4xl border border-slate-200/80 bg-white/95 p-4 shadow-sm shadow-slate-100 transition hover:border-slate-300 hover:shadow-slate-200/60 active:scale-[0.985]"
            >
              {course.image ? (
                <CourseCoverImage
                  src={course.image}
                  alt={course.name}
                  positionX={course.cover_position_x}
                  positionY={course.cover_position_y}
                  zoom={course.cover_zoom}
                  className="h-12 w-12 shrink-0 rounded-2xl ring-2 ring-slate-100"
                  sizes="48px"
                />
              ) : (
                <CourseInitialBadge code={course.code} />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{course.code}</p>
                  {!course.is_active && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">ปิดแล้ว</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{course.name}</p>
                {course.instructor && (
                  <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-400">
                    <Icon icon="solar:user-bold" className="shrink-0 text-xs" />
                    <span className="truncate">{course.instructor.full_name ?? course.instructor.email}</span>
                  </p>
                )}
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:calendar-bold" className="text-xs" />
                    เทอม {course.semester}/{String(course.year).slice(-2)}
                  </span>
                    {course.my_section_no && (
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:bookmark-bold" className="text-xs" />
                        Sec {course.my_section_no}
                    </span>
                  )}
                </div>
              </div>

              <Icon
                icon="solar:arrow-right-bold"
                className="shrink-0 text-lg text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
