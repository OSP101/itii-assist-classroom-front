"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Skeleton } from "@heroui/skeleton";
import { Icon } from "@iconify/react";
import { userService, studentService, courseService } from "@/services";
import classroomService from "@/services/classroom.service";
import { getLogStats } from "@/services/systemLog.service";

// Types
interface SystemMetrics {
  cpu: { usage: number };
  memory: { usagePercent: number; usedGB: number; totalGB: number };
  system: { hostname: string; uptime: number; platform: string };
}

interface UserStats {
  total: number;
  active?: number;
  inactive?: number;
  byRole: { admin: number; instructor: number; ta: number };
  byStatus?: { active: number; inactive: number };
}

interface StudentStats {
  total: number;
  byStatus: { active: number; inactive: number };
}

interface CourseStats {
  total: number;
  byStatus: { active: number; inactive: number };
  thisYear: number;
}

interface ClassroomStats {
  totalClassrooms: number;
  totalDesks: number;
  computerDesks: number;
  enabledDesks: number;
  deletedClassrooms: number;
}

interface LogStats {
  total: number;
  byType: { log_type: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
}

// Helper functions
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} วัน ${hours} ชม.`;
  if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
  return `${minutes} นาที`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "สวัสดีตอนเช้า";
  if (hour < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}

// Skeleton Components
function StatCardSkeleton() {
  return (
    <Card className="border border-default-200 shadow-sm">
      <CardBody className="p-3 sm:p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="w-20 h-4 rounded-lg" />
            <Skeleton className="w-16 h-8 rounded-lg" />
            <Skeleton className="w-24 h-3 rounded-lg" />
          </div>
          <Skeleton className="w-10 h-10 rounded-lg" />
        </div>
      </CardBody>
    </Card>
  );
}

function RolesSkeleton() {
  return (
    <Card className="border border-default-200 shadow-sm">
      <CardHeader className="px-3 sm:px-4 py-2 sm:py-3 border-b border-default-100">
        <Skeleton className="w-40 h-5 rounded-lg" />
      </CardHeader>
      <CardBody className="p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="text-center p-2 sm:p-4 bg-default-50 rounded-xl">
              <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-full mx-auto mb-2" />
              <Skeleton className="w-10 sm:w-12 h-6 sm:h-7 rounded-lg mx-auto mb-1" />
              <Skeleton className="w-14 sm:w-16 h-4 rounded-lg mx-auto" />
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function ClassroomDetailsSkeleton() {
  return (
    <Card className="border border-default-200 shadow-sm">
      <CardHeader className="px-3 sm:px-4 py-2 sm:py-3 border-b border-default-100">
        <Skeleton className="w-36 h-5 rounded-lg" />
      </CardHeader>
      <CardBody className="p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-2 sm:p-3 bg-default-50 rounded-lg text-center">
              <Skeleton className="w-12 h-6 rounded-lg mx-auto mb-1" />
              <Skeleton className="w-16 h-3 rounded-lg mx-auto" />
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function ServerStatusSkeleton() {
  return (
    <Card className="border border-default-200 shadow-sm">
      <CardHeader className="px-4 py-3 border-b border-default-100">
        <div className="flex items-center justify-between w-full">
          <Skeleton className="w-32 h-5 rounded-lg" />
          <Skeleton className="w-8 h-8 rounded-lg" />
        </div>
      </CardHeader>
      <CardBody className="p-4 space-y-4">
        <Skeleton className="w-full h-10 rounded-lg" />
        <div>
          <div className="flex justify-between mb-1.5">
            <Skeleton className="w-8 h-4 rounded-lg" />
            <Skeleton className="w-12 h-4 rounded-lg" />
          </div>
          <Skeleton className="w-full h-2 rounded-full" />
        </div>
        <div>
          <div className="flex justify-between mb-1.5">
            <Skeleton className="w-14 h-4 rounded-lg" />
            <Skeleton className="w-12 h-4 rounded-lg" />
          </div>
          <Skeleton className="w-full h-2 rounded-full" />
        </div>
      </CardBody>
    </Card>
  );
}

function LogsSkeleton() {
  return (
    <Card className="border border-default-200 shadow-sm">
      <CardHeader className="px-4 py-3 border-b border-default-100">
        <div className="flex items-center justify-between w-full">
          <Skeleton className="w-36 h-5 rounded-lg" />
          <Skeleton className="w-16 h-7 rounded-lg" />
        </div>
      </CardHeader>
      <CardBody className="p-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-2">
            <Skeleton className="w-20 h-4 rounded-lg" />
            <Skeleton className="w-12 h-5 rounded-full" />
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

// Main Page Component
export default function AdminDashboardPage() {
  // State for all data
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [studentStats, setStudentStats] = useState<StudentStats | null>(null);
  const [courseStats, setCourseStats] = useState<CourseStats | null>(null);
  const [classroomStats, setClassroomStats] = useState<ClassroomStats | null>(null);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [currentUser, setCurrentUser] = useState<{ full_name: string } | null>(null);

  // Loading states
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingSystem, setLoadingSystem] = useState(true);
  const [loadingUser, setLoadingUser] = useState(true);

  // Fetch functions
  const fetchUserStats = useCallback(async () => {
    try {
      const response = await userService.getStats();
      if (response.success && response.data) {
        // Map API response to our interface
        const data = response.data as {
          total: number;
          active?: number;
          inactive?: number;
          byRole: { admin: number; instructor: number; ta: number };
          byStatus?: { active: number; inactive: number };
        };
        setUserStats({
          total: data.total,
          active: data.active ?? data.byStatus?.active,
          inactive: data.inactive ?? data.byStatus?.inactive,
          byRole: data.byRole,
          byStatus: data.byStatus,
        });
      }
    } catch (error) {
      console.error("Failed to fetch user stats:", error);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchStudentStats = useCallback(async () => {
    try {
      const response = await studentService.getStats();
      if (response.success && response.data) {
        setStudentStats(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch student stats:", error);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const fetchCourseStats = useCallback(async () => {
    try {
      const response = await courseService.getStats();
      if (response.success && response.data) {
        setCourseStats(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch course stats:", error);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  const fetchClassroomStats = useCallback(async () => {
    try {
      const response = await classroomService.getStats();
      if (response.success && response.data) {
        setClassroomStats(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch classroom stats:", error);
    } finally {
      setLoadingClassrooms(false);
    }
  }, []);

  const fetchLogStats = useCallback(async () => {
    try {
      const response = await getLogStats();
      if (response.success && response.data) {
        setLogStats(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch log stats:", error);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const fetchSystemMetrics = useCallback(async () => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API_BASE}/system/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSystemMetrics(data.data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch system metrics:", error);
    } finally {
      setLoadingSystem(false);
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
      }
    } catch (error) {
      console.error("Failed to get current user:", error);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  // Fetch all data on mount
  useEffect(() => {
    fetchCurrentUser();
    fetchUserStats();
    fetchStudentStats();
    fetchCourseStats();
    fetchClassroomStats();
    fetchLogStats();
    fetchSystemMetrics();
  }, [fetchCurrentUser, fetchUserStats, fetchStudentStats, fetchCourseStats, fetchClassroomStats, fetchLogStats, fetchSystemMetrics]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Banner */}
      {loadingUser ? (
        <div className="bg-gradient-to-r from-blue-400 to-indigo-500 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="w-48 sm:w-64 h-6 sm:h-8 rounded-lg bg-white/20" />
              <Skeleton className="w-64 sm:w-80 h-4 sm:h-5 rounded-lg bg-white/20" />
            </div>
            <div className="hidden sm:block">
              <Skeleton className="w-32 h-8 rounded-lg bg-white/20" />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-blue-400 to-indigo-500 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold mb-1">{getGreeting()}, {currentUser?.full_name || "Admin"} 👋</h2>
              <p className="text-blue-100 text-sm sm:text-base">ยินดีต้อนรับสู่ระบบจัดการ ITII Assist Classroom</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Users */}
        {loadingUsers ? <StatCardSkeleton /> : (
          <Link href="/admin/users">
            <Card className="border border-default-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardBody className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 bg-blue-100 rounded-xl flex-shrink-0">
                    <Icon icon="solar:users-group-rounded-bold" className="text-xl sm:text-2xl text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-default-500">ผู้ใช้งาน</p>
                    <p className="text-xl sm:text-2xl font-bold text-default-900">{userStats?.total || 0}</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Link>
        )}

        {/* Students */}
        {loadingStudents ? <StatCardSkeleton /> : (
          <Link href="/admin/students">
            <Card className="border border-default-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardBody className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 bg-green-100 rounded-xl flex-shrink-0">
                    <Icon icon="solar:square-academic-cap-bold" className="text-xl sm:text-2xl text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-default-500">นักศึกษา</p>
                    <p className="text-xl sm:text-2xl font-bold text-default-900">{studentStats?.total || 0}</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Link>
        )}

        {/* Courses */}
        {loadingCourses ? <StatCardSkeleton /> : (
          <Link href="/admin/courses">
            <Card className="border border-default-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardBody className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 bg-purple-100 rounded-xl flex-shrink-0">
                    <Icon icon="solar:book-bookmark-bold" className="text-xl sm:text-2xl text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-default-500">รายวิชา</p>
                    <p className="text-xl sm:text-2xl font-bold text-default-900">{courseStats?.total || 0}</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Link>
        )}

        {/* Classrooms */}
        {loadingClassrooms ? <StatCardSkeleton /> : (
          <Link href="/admin/classrooms">
            <Card className="border border-default-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardBody className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 bg-amber-100 rounded-xl flex-shrink-0">
                    <Icon icon="solar:buildings-3-bold" className="text-xl sm:text-2xl text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-default-500">ห้องเรียน</p>
                    <p className="text-xl sm:text-2xl font-bold text-default-900">{classroomStats?.totalClassrooms || 0}</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Link>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* User Roles Card */}
          {loadingUsers ? <RolesSkeleton /> : (
            <Card className="border border-default-200 shadow-sm">
              <CardHeader className="px-3 sm:px-4 py-2 sm:py-3 border-b border-default-100">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:users-group-rounded-bold" className="text-lg text-blue-500" />
                  <h3 className="font-semibold text-default-800 text-sm sm:text-base">ผู้ใช้งานตามบทบาท</h3>
                </div>
              </CardHeader>
              <CardBody className="p-3 sm:p-4">
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <div className="text-center p-2 sm:p-4 bg-red-50 rounded-xl">
                    <Icon icon="solar:shield-user-bold" className="text-2xl sm:text-3xl text-red-500 mx-auto mb-1 sm:mb-2" />
                    <p className="text-lg sm:text-2xl font-bold text-default-900">{userStats?.byRole?.admin || 0}</p>
                    <p className="text-xs sm:text-sm text-default-500">Admin</p>
                  </div>
                  <div className="text-center p-2 sm:p-4 bg-purple-50 rounded-xl">
                    <Icon icon="solar:user-check-bold" className="text-2xl sm:text-3xl text-purple-500 mx-auto mb-1 sm:mb-2" />
                    <p className="text-lg sm:text-2xl font-bold text-default-900">{userStats?.byRole?.instructor || 0}</p>
                    <p className="text-xs sm:text-sm text-default-500">อาจารย์</p>
                  </div>
                  <div className="text-center p-2 sm:p-4 bg-green-50 rounded-xl">
                    <Icon icon="solar:user-hand-up-bold" className="text-2xl sm:text-3xl text-green-500 mx-auto mb-1 sm:mb-2" />
                    <p className="text-lg sm:text-2xl font-bold text-default-900">{userStats?.byRole?.ta || 0}</p>
                    <p className="text-xs sm:text-sm text-default-500">TA</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Classroom Details Card */}
          {loadingClassrooms ? <ClassroomDetailsSkeleton /> : (
            <Card className="border border-default-200 shadow-sm">
              <CardHeader className="px-3 sm:px-4 py-2 sm:py-3 border-b border-default-100">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:display-bold" className="text-lg text-orange-500" />
                  <h3 className="font-semibold text-default-800 text-sm sm:text-base">รายละเอียดห้องเรียน</h3>
                </div>
              </CardHeader>
              <CardBody className="p-3 sm:p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-default-50 rounded-lg text-center">
                    <p className="text-lg sm:text-xl font-bold text-default-900">{classroomStats?.totalDesks || 0}</p>
                    <p className="text-xs text-default-500">โต๊ะทั้งหมด</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-lg sm:text-xl font-bold text-blue-600">{classroomStats?.computerDesks || 0}</p>
                    <p className="text-xs text-default-500">คอมพิวเตอร์</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-lg sm:text-xl font-bold text-green-600">{classroomStats?.enabledDesks || 0}</p>
                    <p className="text-xs text-default-500">ใช้งานได้</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-red-50 rounded-lg text-center">
                    <p className="text-lg sm:text-xl font-bold text-red-600">{(classroomStats?.totalDesks || 0) - (classroomStats?.enabledDesks || 0)}</p>
                    <p className="text-xs text-default-500">ปิดใช้งาน</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Quick Actions */}
          <Card className="border border-default-200 shadow-sm">
            <CardHeader className="px-3 sm:px-4 py-2 sm:py-3 border-b border-default-100">
              <div className="flex items-center gap-2">
                <Icon icon="solar:widget-5-bold" className="text-lg text-blue-500" />
                <h3 className="font-semibold text-default-800 text-sm sm:text-base">เมนูลัด</h3>
              </div>
            </CardHeader>
            <CardBody className="p-3 sm:p-4">
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                <Link
                  href="/admin/users"
                  className="flex flex-col items-center justify-center gap-1 sm:gap-2 p-2 sm:p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <Icon icon="solar:user-plus-linear" className="text-xl sm:text-2xl text-blue-600" />
                  <span className="text-[10px] sm:text-xs text-default-700 text-center">ผู้ใช้</span>
                </Link>
                <Link
                  href="/admin/students"
                  className="flex flex-col items-center justify-center gap-1 sm:gap-2 p-2 sm:p-4 rounded-xl bg-green-50 hover:bg-green-100 transition-colors"
                >
                  <Icon icon="solar:upload-linear" className="text-xl sm:text-2xl text-green-600" />
                  <span className="text-[10px] sm:text-xs text-default-700 text-center">นำเข้า</span>
                </Link>
                <Link
                  href="/admin/courses"
                  className="flex flex-col items-center justify-center gap-1 sm:gap-2 p-2 sm:p-4 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors"
                >
                  <Icon icon="solar:book-2-linear" className="text-xl sm:text-2xl text-purple-600" />
                  <span className="text-[10px] sm:text-xs text-default-700 text-center">รายวิชา</span>
                </Link>
                <Link
                  href="/admin/logs"
                  className="flex flex-col items-center justify-center gap-1 sm:gap-2 p-2 sm:p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <Icon icon="solar:document-text-linear" className="text-xl sm:text-2xl text-slate-600" />
                  <span className="text-[10px] sm:text-xs text-default-700 text-center">Logs</span>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Server Status */}
          {loadingSystem ? <ServerStatusSkeleton /> : (
            <Card className="border border-default-200 shadow-sm">
              <CardHeader className="px-4 py-3 border-b border-default-100">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:server-bold" className="text-lg text-blue-500" />
                    <h3 className="font-semibold text-default-800">สถานะเซิร์ฟเวอร์</h3>
                  </div>
                  <Button isIconOnly size="sm" variant="light" aria-label="รีเฟรชสถานะเซิร์ฟเวอร์" onPress={fetchSystemMetrics}>
                    <Icon icon="solar:refresh-linear" className="text-lg" />
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="p-4">
                {systemMetrics ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-medium text-green-700">ระบบทำงานปกติ</span>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-default-600">CPU</span>
                        <span className="font-medium text-default-800">{systemMetrics.cpu?.usage?.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-default-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${systemMetrics.cpu?.usage || 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-default-600">Memory</span>
                        <span className="font-medium text-default-800">{systemMetrics.memory?.usagePercent?.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-default-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            (systemMetrics.memory?.usagePercent || 0) > 80 ? "bg-red-500" : "bg-green-500"
                          }`}
                          style={{ width: `${systemMetrics.memory?.usagePercent || 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-default-400 mt-1">
                        {systemMetrics.memory?.usedGB?.toFixed(1)} / {systemMetrics.memory?.totalGB?.toFixed(1)} GB
                      </p>
                    </div>

                    <div className="pt-3 border-t border-default-100 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-default-500">Uptime</span>
                        <span className="text-default-700 font-medium">{formatUptime(systemMetrics.system?.uptime || 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-default-500">Platform</span>
                        <span className="text-default-700 font-medium">{systemMetrics.system?.platform}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-default-400">ไม่สามารถโหลดข้อมูลได้</div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Logs Summary */}
          {loadingLogs ? <LogsSkeleton /> : (
            <Card className="border border-default-200 shadow-sm">
              <CardHeader className="px-4 py-3 border-b border-default-100">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:document-text-bold" className="text-lg text-slate-500" />
                    <h3 className="font-semibold text-default-800">System Logs (24 ชม.)</h3>
                  </div>
                  <Link href="/admin/logs">
                    <Button size="sm" variant="light" color="primary">
                      ดูทั้งหมด
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardBody className="p-4">
                {logStats ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-default-50 rounded-lg">
                      <span className="text-sm text-default-600">ทั้งหมด</span>
                      <Chip size="sm" variant="flat">{logStats.total?.toLocaleString() || 0}</Chip>
                    </div>
                    {logStats.byType?.map((item) => (
                      <div key={item.log_type} className="flex items-center justify-between p-2">
                        <span className="text-sm text-default-600 capitalize">{item.log_type}</span>
                        <Chip
                          size="sm"
                          variant="flat"
                          color={
                            item.log_type === "error" ? "danger" :
                            item.log_type === "security" ? "warning" :
                            item.log_type === "auth" ? "secondary" :
                            "default"
                          }
                        >
                          {item.count?.toLocaleString() || 0}
                        </Chip>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-default-400">ไม่สามารถโหลดข้อมูลได้</div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
