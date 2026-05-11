"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Tabs, Tab } from "@heroui/tabs";
import { Tooltip } from "@heroui/tooltip";
import { Avatar } from "@heroui/avatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import {
  getActivityLogs,
  getActivityStats,
  getActivityFilters,
  type ActivityLog,
  type Pagination as PaginationData,
  type ActivityLogFilters,
  type ActivityLogStats,
} from "@/services/courseActivityLog.service";

interface ActivityLogTabProps {
  courseId: string;
}

// ============================================
// Category/Action Display Helpers
// ============================================

const categoryConfig: Record<string, { label: string; icon: string; bgClass: string; iconClass: string }> = {
  course: { label: "รายวิชา", icon: "solar:book-bold", bgClass: "bg-blue-100", iconClass: "text-blue-600" },
  member: { label: "สมาชิก", icon: "solar:users-group-rounded-bold", bgClass: "bg-indigo-100", iconClass: "text-indigo-600" },
  assignment: { label: "งาน", icon: "solar:clipboard-list-bold", bgClass: "bg-emerald-100", iconClass: "text-emerald-600" },
  score: { label: "คะแนน", icon: "solar:chart-square-bold", bgClass: "bg-amber-100", iconClass: "text-amber-600" },
  attendance: { label: "เช็คชื่อ", icon: "solar:user-check-bold", bgClass: "bg-rose-100", iconClass: "text-rose-600" },
  queue: { label: "คิว", icon: "solar:sort-by-time-bold", bgClass: "bg-content3", iconClass: "text-default-600" },
  general: { label: "ทั่วไป", icon: "solar:info-circle-bold", bgClass: "bg-content3", iconClass: "text-default-600" },
};

const categoryChipColor: Record<string, "primary" | "secondary" | "success" | "warning" | "danger" | "default"> = {
  course: "primary",
  member: "secondary",
  assignment: "success",
  score: "warning",
  attendance: "danger",
  queue: "default",
  general: "default",
};

const actionLabels: Record<string, string> = {
  create_course: "สร้างรายวิชา",
  update_course: "แก้ไขรายวิชา",
  delete_course: "ลบรายวิชา",
  activate_course: "เปิดใช้งานรายวิชา",
  deactivate_course: "ปิดใช้งานรายวิชา",
  add_section: "เพิ่มกลุ่มเรียน",
  remove_section: "ลบกลุ่มเรียน",
  update_section: "แก้ไขกลุ่มเรียน",
  add_ta: "เพิ่มผู้ช่วยสอน",
  bulk_add_tas: "เพิ่มผู้ช่วยสอน (จำนวนมาก)",
  remove_ta: "นำผู้ช่วยสอนออก",
  add_instructor: "เพิ่มอาจารย์",
  bulk_add_instructors: "เพิ่มอาจารย์ (จำนวนมาก)",
  remove_instructor: "นำอาจารย์ออก",
  add_student: "เพิ่มนักศึกษา",
  bulk_add_students: "เพิ่มนักศึกษา (จำนวนมาก)",
  remove_student: "นำนักศึกษาออก",
  create_assignment: "สร้างงาน",
  update_assignment: "แก้ไขงาน",
  delete_assignment: "ลบงาน",
  submit_score: "ให้คะแนน",
  submit_bulk_scores: "ให้คะแนน (จำนวนมาก)",
  submit_group_score: "ให้คะแนนกลุ่ม",
  request_score_edit: "ขอแก้ไขคะแนน",
  approve_score_edit: "อนุมัติแก้ไขคะแนน",
  reject_score_edit: "ปฏิเสธแก้ไขคะแนน",
  create_attendance: "สร้างเช็คชื่อ",
  update_attendance: "แก้ไขเช็คชื่อ",
  activate_attendance: "เปิดเช็คชื่อ",
  close_attendance: "ปิดเช็คชื่อ",
  delete_attendance: "ลบเช็คชื่อ",
  create_queue_session: "สร้างคิว",
  update_queue_session: "แก้ไขคิว",
  delete_queue_session: "ลบคิว",
  queue_session_active: "เปิดคิว",
  queue_session_paused: "หยุดคิวชั่วคราว",
  queue_session_closed: "ปิดคิว",
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  if (diffHour < 24) return `${diffHour} ชั่วโมงที่แล้ว`;
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;

  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDetailText(detail: Record<string, unknown> | null | undefined): string {
  if (!detail || typeof detail !== "object") return "";
  const parts: string[] = [];
  if (detail.score !== undefined) parts.push(`คะแนน: ${String(detail.score)}`);
  if (detail.created !== undefined) parts.push(`สร้าง: ${String(detail.created)}`);
  if (detail.updated !== undefined) parts.push(`อัปเดต: ${String(detail.updated)}`);
  if (detail.count !== undefined) parts.push(`จำนวน: ${String(detail.count)}`);
  return parts.join(", ");
}

// ============================================
// Main Component
// ============================================

export default function ActivityLogTab({ courseId }: ActivityLogTabProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 30, totalPages: 0 });
  const [stats, setStats] = useState<ActivityLogStats | null>(null);
  const [filters, setFilters] = useState<ActivityLogFilters | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter state
  const [category, setCategory] = useState("");
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeSubTab, setActiveSubTab] = useState("timeline");

  // Fetch logs
  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const data = await getActivityLogs(courseId, {
          page,
          limit: 30,
          category,
          action,
          actorId,
          search: searchText,
        });
        setLogs(data.logs);
        setPagination(data.pagination);
      } catch {
        addToast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลได้", color: "danger", timeout: 3000,
                shouldShowTimeoutProgress: true, });
      } finally {
        setLoading(false);
      }
    },
    [courseId, category, action, actorId, searchText],
  );

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getActivityStats(courseId, 30);
      setStats(data);
    } catch {
      // silent fail for stats
    } finally {
      setStatsLoading(false);
    }
  }, [courseId]);

  // Fetch filters
  const fetchFilters = useCallback(async () => {
    try {
      const data = await getActivityFilters(courseId);
      setFilters(data);
    } catch {
      // silent
    }
  }, [courseId]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
    fetchFilters();
  }, [fetchStats, fetchFilters]);

  // Filter actions by selected category
  const filteredActions = useMemo(() => {
    if (!filters) return [];
    if (!category) return filters.actions;
    return filters.actions.filter((a) => a.category === category);
  }, [filters, category]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">บันทึกกิจกรรม</h2>
          <p className="text-sm text-default-500">ติดตามการเปลี่ยนแปลงทั้งหมดภายในรายวิชา</p>
        </div>
        <Button
          size="sm"
          variant="flat"
          startContent={<Icon icon="solar:refresh-bold" width={16} />}
          onPress={() => { fetchLogs(1); fetchStats(); fetchFilters(); }}
          className="bg-content2 text-default-600 hover:bg-content3"
        >
          รีเฟรช
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        selectedKey={activeSubTab}
        onSelectionChange={(key) => setActiveSubTab(key as string)}
        variant="underlined"
        classNames={{
          tabList: "gap-4 md:gap-6 flex-nowrap min-w-max",
          cursor: "bg-blue-500",
          tab: "px-0 h-10",
          tabContent: "group-data-[selected=true]:text-blue-600 text-default-500 font-medium text-sm",
        }}
      >
        <Tab
          key="timeline"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="solar:clock-circle-bold" className="text-base" />
              <span>ไทม์ไลน์กิจกรรม</span>
              {pagination.total > 0 && (
                <Chip size="sm" variant="flat" color="primary" className="h-5 px-1.5 text-xs">
                  {pagination.total}
                </Chip>
              )}
            </div>
          }
        />
        <Tab
          key="summary"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="solar:chart-2-bold" className="text-base" />
              <span>สรุปภาพรวม</span>
            </div>
          }
        />
      </Tabs>

      {/* Timeline Sub-Tab */}
      {activeSubTab === "timeline" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <Card className="border border-default-200 shadow-sm">
            <CardBody className="py-3 px-4">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="flex gap-2 items-center flex-1">
                  <Input
                    placeholder="ค้นหา..."
                    value={searchText}
                    onValueChange={setSearchText}
                    startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400 text-sm" />}
                    className="w-full sm:max-w-xs"
                    size="md"
                    variant="bordered"
                    isClearable
                    onClear={() => setSearchText("")}
                    classNames={{
                      inputWrapper: "bg-content1 border-default-200 hover:border-default-300 focus-within:!border-blue-400",
                    }}
                  />
                </div>

                <div className="flex gap-2 items-center flex-wrap">
                  {/* Category Filter */}
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        variant="bordered"
                        size="md"
                        className="min-w-28 justify-between border-default-200"
                        endContent={<Icon icon="solar:alt-arrow-down-linear" className="text-default-400 text-sm" />}
                      >
                        {category ? (categoryConfig[category]?.label || category) : "ทุกหมวดหมู่"}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      selectionMode="single"
                      selectedKeys={category ? new Set([category]) : new Set([])}
                      onSelectionChange={(keys) => {
                        const val = Array.from(keys)[0] as string || "";
                        setCategory(val);
                        setAction("");
                      }}
                      items={[
                        { key: "", label: "ทุกหมวดหมู่" },
                        ...(filters?.categories || []).map((cat) => ({
                          key: cat,
                          label: categoryConfig[cat]?.label || cat,
                        })),
                      ]}
                    >
                      {(item) => <DropdownItem key={item.key}>{item.label}</DropdownItem>}
                    </DropdownMenu>
                  </Dropdown>

                  {/* Action Filter */}
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        variant="bordered"
                        size="md"
                        className="min-w-28 justify-between border-default-200"
                        endContent={<Icon icon="solar:alt-arrow-down-linear" className="text-default-400 text-sm" />}
                      >
                        {action ? (actionLabels[action] || action) : "ทุกการกระทำ"}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      selectionMode="single"
                      selectedKeys={action ? new Set([action]) : new Set([])}
                      onSelectionChange={(keys) => setAction(Array.from(keys)[0] as string || "")}
                      items={[
                        { key: "", label: "ทุกการกระทำ" },
                        ...filteredActions.map((a) => ({
                          key: a.action,
                          label: actionLabels[a.action] || a.action,
                        })),
                      ]}
                    >
                      {(item) => <DropdownItem key={item.key}>{item.label}</DropdownItem>}
                    </DropdownMenu>
                  </Dropdown>

                  {/* Actor Filter */}
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        variant="bordered"
                        size="md"
                        className="min-w-28 justify-between border-default-200"
                        endContent={<Icon icon="solar:alt-arrow-down-linear" className="text-default-400 text-sm" />}
                      >
                        {actorId
                          ? (filters?.actors.find((a) => String(a.id) === actorId)?.fullName || "ผู้ดำเนินการ")
                          : "ทุกคน"}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      selectionMode="single"
                      selectedKeys={actorId ? new Set([actorId]) : new Set([])}
                      onSelectionChange={(keys) => setActorId(Array.from(keys)[0] as string || "")}
                      items={[
                        { key: "", label: "ทุกคน" },
                        ...(filters?.actors || []).map((actor) => ({
                          key: String(actor.id),
                          label: `${actor.fullName} (${actor.role === "instructor" ? "อาจารย์" : actor.role === "ta" ? "TA" : actor.role})`,
                        })),
                      ]}
                    >
                      {(item) => <DropdownItem key={item.key}>{item.label}</DropdownItem>}
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Log Table */}
          <Card className="border border-default-200 shadow-sm">
            <CardBody className="p-2">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-20">
                  <Icon icon="solar:clipboard-list-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                  <p className="text-default-500">ยังไม่มีบันทึกกิจกรรม</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table
                  aria-label="Activity log table"
                  removeWrapper
                  bottomContent={
                    pagination.totalPages > 1 ? (
                      <div className="flex flex-col gap-2 px-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-default-400">
                          หน้า {pagination.page} จาก {pagination.totalPages}
                        </p>
                        <Pagination
                          total={pagination.totalPages}
                          page={pagination.page}
                          onChange={(nextPage) => {
                            void fetchLogs(nextPage);
                          }}
                          showControls
                          isCompact
                          size="sm"
                          classNames={{
                            cursor: "bg-blue-500 text-white",
                          }}
                        />
                      </div>
                    ) : null
                  }
                  bottomContentPlacement="outside"
                  classNames={{
                    base: "min-w-225",
                    th: "bg-content2 text-default-600 font-semibold text-sm whitespace-nowrap",
                    td: "py-3 whitespace-nowrap",
                    tr: "hover:bg-content2/70",
                  }}
                >
                  <TableHeader>
                    <TableColumn className="min-w-40">ผู้ดำเนินการ</TableColumn>
                    <TableColumn className="min-w-35">การกระทำ</TableColumn>
                    <TableColumn className="min-w-25">หมวดหมู่</TableColumn>
                    <TableColumn className="min-w-37.5">เป้าหมาย</TableColumn>
                    <TableColumn className="min-w-35">รายละเอียด</TableColumn>
                    <TableColumn className="min-w-30">เวลา</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const catConf = categoryConfig[log.category] || categoryConfig.general;
                      const chipColor = categoryChipColor[log.category] || "default";
                      const detailText = getDetailText(log.detail as Record<string, unknown>);

                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={log.actor?.full_name || "Unknown"}
                                size="sm"
                                src={log.actor?.avatar || undefined}
                                className={`shrink-0 ${catConf.bgClass} `}
                              />
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {log.actor?.full_name || "Unknown"}
                                </p>
                                <p className="text-xs text-default-400">
                                  {log.actor?.role === "instructor" ? "อาจารย์" : log.actor?.role === "ta" ? "TA" : log.actor?.role || ""}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip size="sm" variant="flat" color={chipColor}>
                              {actionLabels[log.action] || log.action}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Icon icon={catConf.icon} width={14} className={catConf.iconClass} />
                              <span className="text-sm text-default-600">{catConf.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.target_name ? (
                              <Tooltip content={log.target_name}>
                                <span className="block max-w-37.5 truncate text-sm text-default-700">
                                  {log.target_name}
                                </span>
                              </Tooltip>
                            ) : (
                              <span className="text-default-300">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {detailText ? (
                              <span className="text-xs text-default-500">{detailText}</span>
                            ) : (
                              <span className="text-default-300">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Tooltip content={new Date(log.created_at).toLocaleString("th-TH")}>
                              <span className="whitespace-nowrap text-sm text-default-500">
                                {formatDate(log.created_at)}
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Summary Sub-Tab */}
      {activeSubTab === "summary" && (
        <div className="space-y-4">
          {statsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" color="primary" />
            </div>
          ) : stats ? (
            <>
              {/* Stats Cards - matching PeopleTab pattern */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card className="border border-default-200 shadow-sm">
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-100 rounded-xl">
                        <Icon icon="solar:clipboard-list-bold" className="text-2xl text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-default-500">กิจกรรมทั้งหมด</p>
                        <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm">
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-100 rounded-xl">
                        <Icon icon="solar:widget-bold" className="text-2xl text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-default-500">หมวดหมู่</p>
                        <p className="text-2xl font-bold text-foreground">{stats.categoryStats.length}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm">
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-100 rounded-xl">
                        <Icon icon="solar:users-group-rounded-bold" className="text-2xl text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-default-500">ผู้ดำเนินการ</p>
                        <p className="text-2xl font-bold text-foreground">{stats.actorStats.length}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Category Breakdown Table */}
              <Card className="border border-default-200 shadow-sm">
                <CardBody className="p-2">
                  <div className="px-3 py-2">
                    <h3 className="text-base font-semibold text-foreground">กิจกรรมตามหมวดหมู่ (30 วันล่าสุด)</h3>
                  </div>
                  <Table
                    aria-label="Category stats"
                    removeWrapper
                    classNames={{
                      th: "bg-content2 text-default-600 font-semibold text-sm",
                      td: "py-3",
                    }}
                  >
                    <TableHeader>
                      <TableColumn>หมวดหมู่</TableColumn>
                      <TableColumn>สัดส่วน</TableColumn>
                      <TableColumn align="end">จำนวน</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {stats.categoryStats.map((cat) => {
                        const conf = categoryConfig[cat.category] || categoryConfig.general;
                        const maxCount = Math.max(...stats.categoryStats.map((c) => Number(c.count)));
                        const pct = maxCount > 0 ? (Number(cat.count) / maxCount) * 100 : 0;
                        const progressClass = conf.bgClass.startsWith("bg-content") ? "bg-default-400" : conf.bgClass.replace("100", "400");
                        return (
                          <TableRow key={cat.category}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${conf.bgClass}`}>
                                  <Icon icon={conf.icon} width={14} className={conf.iconClass} />
                                </div>
                                <span className="text-sm font-medium text-default-700">{conf.label}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex min-w-30 items-center gap-2">
                                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-content3">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${progressClass}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-semibold text-foreground">{cat.count}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>

              {/* Top Actions Table */}
              <Card className="border border-default-200 shadow-sm">
                <CardBody className="p-2">
                  <div className="px-3 py-2">
                    <h3 className="text-base font-semibold text-foreground">การกระทำที่พบบ่อย (30 วันล่าสุด)</h3>
                  </div>
                  <Table
                    aria-label="Top actions"
                    removeWrapper
                    classNames={{
                      th: "bg-content2 text-default-600 font-semibold text-sm",
                      td: "py-3",
                    }}
                  >
                    <TableHeader>
                      <TableColumn width={40}>#</TableColumn>
                      <TableColumn>การกระทำ</TableColumn>
                      <TableColumn align="end">จำนวนครั้ง</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {stats.actionStats.slice(0, 10).map((a, idx) => (
                        <TableRow key={a.action}>
                          <TableCell>
                            <span className="text-xs text-default-400">{idx + 1}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-default-700">{actionLabels[a.action] || a.action}</span>
                          </TableCell>
                          <TableCell>
                            <Chip size="sm" variant="flat" color="primary">
                              {a.count} ครั้ง
                            </Chip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>

              {/* Active Users Table */}
              <Card className="border border-default-200 shadow-sm">
                <CardBody className="p-2">
                  <div className="px-3 py-2">
                    <h3 className="text-base font-semibold text-foreground">ผู้ดำเนินการ (30 วันล่าสุด)</h3>
                  </div>
                  <Table
                    aria-label="Active users"
                    removeWrapper
                    classNames={{
                      th: "bg-content2 text-default-600 font-semibold text-sm",
                      td: "py-3",
                    }}
                  >
                    <TableHeader>
                      <TableColumn>ชื่อ-นามสกุล</TableColumn>
                      <TableColumn>บทบาท</TableColumn>
                      <TableColumn align="end">จำนวนกิจกรรม</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {stats.actorStats.map((actor) => (
                        <TableRow key={actor.userId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={actor.fullName}
                                size="sm"
                                src={actor.avatar || undefined}
                                className="bg-blue-100 shrink-0"
                              />
                              <span className="text-sm font-medium text-foreground">{actor.fullName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip size="sm" variant="flat" color={actor.role === "instructor" ? "primary" : "secondary"}>
                              {actor.role === "instructor" ? "อาจารย์" : actor.role === "ta" ? "TA" : actor.role}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-foreground">{actor.count} ครั้ง</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>
            </>
          ) : (
            <Card className="border border-default-200 shadow-sm">
              <CardBody className="py-16">
                <div className="text-center">
                  <Icon icon="solar:chart-2-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                  <p className="text-default-500">ไม่มีข้อมูลสถิติ</p>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}