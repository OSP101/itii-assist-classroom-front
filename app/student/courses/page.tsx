"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { courseService, type Course } from "@/services/course.service";
import { CourseThumb } from "@/components/course";

type StatusFilter = "all" | "active" | "closed";

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "ทั้งหมด" },
  { key: "active", label: "กำลังเรียน" },
  { key: "closed", label: "ปิดแล้ว" },
];

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // No status filter here on purpose — the "all / active / closed" tabs
        // below filter this same fetched list client-side (see `visible`), so
        // the request must include both active and closed courses up front.
        //
        // Paged through to the end rather than asking for one big limit and
        // hoping it covers everyone. A raised limit is still a guess: the
        // backend is free to clamp it, and when it does the extra courses do
        // not error, they just quietly never appear in the list. PAGE_CAP only
        // stops a broken `hasMore` from looping forever.
        const PAGE_SIZE = 100;
        const PAGE_CAP = 20;
        const collected: Course[] = [];
        for (let page = 1; page <= PAGE_CAP; page++) {
          const res = await courseService.getMyCourses({ page, limit: PAGE_SIZE, sortBy: "created_at", sortOrder: "DESC" });
          if (!active) return;
          if (!res.success || !res.data) throw new Error(res.message || "ไม่สามารถโหลดรายวิชาได้");
          collected.push(...(res.data.courses || []));

          const pagination = res.data.pagination;
          const reachedLastPage = !pagination || page >= pagination.totalPages;
          // An empty page also ends the loop: without it, a backend that ignores
          // `page` would hand back the same first page until PAGE_CAP.
          if (reachedLastPage || !pagination.hasMore || (res.data.courses || []).length === 0) break;
        }
        setCourses(collected);
      } catch (err) {
        if (!active) return;
        console.error("Failed to load student courses:", err);
        setError("ยังไม่สามารถดึงรายวิชาได้ในขณะนี้");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    if (filter === "active") return courses.filter((c) => c.is_active);
    if (filter === "closed") return courses.filter((c) => !c.is_active);
    return courses;
  }, [courses, filter]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="cg-page-title">รายวิชา</h1>

      <div className="cg-pill-row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="cg-pill"
            data-active={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="cg-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="cg-row animate-pulse">
              <div className="h-11 w-11 shrink-0 rounded-xl" style={{ background: "var(--cg-fill-strong)" }} />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 rounded-full" style={{ background: "var(--cg-fill-strong)" }} />
                <div className="h-2.5 w-1/2 rounded-full" style={{ background: "var(--cg-fill)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="cg-list">
          <div className="cg-row">
            <span className="cg-row-ico" style={{ background: "var(--cg-warning-soft)", color: "var(--cg-warning)" }}>
              <Icon icon="solar:danger-triangle-linear" width={17} height={17} />
            </span>
            <span className="cg-row-body">
              <span className="cg-row-title">ดึงรายวิชาไม่ได้</span>
              <span className="cg-row-sub">{error}</span>
            </span>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="cg-list">
          <div className="cg-empty">
            <Icon icon="solar:notebook-bookmark-linear" width={27} height={27} />
            <b className="text-[13px] font-medium" style={{ color: "var(--cg-text-2)" }}>ไม่มีรายวิชา</b>
            <span className="text-[11.5px] font-light">
              {filter === "all" ? "ยังไม่พบรายวิชาที่ลงทะเบียนสำหรับบัญชีนี้" : "ไม่พบรายการตามตัวกรองที่เลือก"}
            </span>
          </div>
        </div>
      ) : (
        <div className="cg-list">
          {visible.map((course) => (
            <Link key={course.id} href={`/student/courses/${course.id}`} className="cg-row">
              <CourseThumb
                code={course.code}
                name={course.name}
                image={course.image}
                positionX={course.cover_position_x}
                positionY={course.cover_position_y}
                zoom={course.cover_zoom}
                muted={!course.is_active}
              />
              <span className="cg-row-body">
                <span className="cg-row-title truncate">{course.name}</span>
                <span className="cg-row-sub truncate">
                  {course.code} {course.instructor?.full_name ?? course.instructor?.email ?? ""}
                </span>
                <span className="cg-row-sub" style={{ color: "var(--cg-text-3)" }}>
                  เทอม {course.semester}/{course.year}
                  {course.my_section_no ? ` กลุ่มเรียนที่ ${course.my_section_no}` : ""}
                </span>
              </span>
              {!course.is_active && <span className="cg-badge cg-badge-neutral">ปิดแล้ว</span>}
              <Icon icon="solar:alt-arrow-right-linear" className="cg-chevron" width={15} height={15} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
