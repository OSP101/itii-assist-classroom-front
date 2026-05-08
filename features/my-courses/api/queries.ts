/**
 * My Courses / Instructor Home — cached server queries.
 */

import { cacheLife, cacheTag } from "next/cache";
import { serverApi } from "@/lib/api/server-api";
import { cacheTags } from "@/lib/cache/cache-tags";

export type CourseCard = {
  id: string;
  name: string;
  code: string;
  semester: string;
  year: string;
  status: "active" | "closed" | "draft";
  studentCount: number;
  instructorNames: string[];
  classroomName?: string;
};

export type MyCoursesData = {
  courses: CourseCard[];
  total: number;
  activeCount: number;
  closedCount: number;
};

export async function getMyCourses(token: string): Promise<MyCoursesData> {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.myCourses());

  const [courses, stats] = await Promise.all([
    serverApi.get<CourseCard[]>("/courses/my-courses", { token }),
    serverApi.get<{ active: number; closed: number }>(
      "/courses/my-courses/stats",
      { token }
    ),
  ]);

  return {
    courses,
    total: courses.length,
    activeCount: stats.active ?? 0,
    closedCount: stats.closed ?? 0,
  };
}

export async function getClosedCourses(token: string): Promise<CourseCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(cacheTags.myCourses());

  return serverApi.get<CourseCard[]>(
    "/courses/my-courses?status=closed",
    { token }
  );
}
