"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Tooltip } from "@heroui/tooltip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useTableParams } from "@/lib/table/use-table-params";
import {
  getLogs,
  getLogStats,
  exportLogs,
  getLogById,
  getLogTypeBadgeColor,
  getSeverityBadgeColor,
  getLogTypeLabel,
  getSeverityLabel,
  getStatusCodeColor,
  formatBytes,
  type SystemLog,
  type LogType,
  type SeverityLevel,
  type LogsFilter,
  type LogStats,
} from "@/services/systemLog.service";

// Column definitions
const columns = [
  { key: "created_at", label: "เวลา", sortable: true },
  { key: "log_type", label: "ประเภท", sortable: true },
  { key: "severity", label: "ระดับ", sortable: true },
  { key: "action", label: "Action", sortable: true },
  { key: "status_code", label: "Status", sortable: true },
  { key: "ip_address", label: "IP Address", sortable: true },
  { key: "actor_user", label: "ผู้ใช้", sortable: false },
  { key: "response_time_ms", label: "Response", sortable: true },
  { key: "actions", label: "", sortable: false },
];

const logTypeOptions = [
  { key: "all", label: "ทุกประเภท" },
  { key: "access", label: "การเข้าถึง" },
  { key: "error", label: "ข้อผิดพลาด" },
  { key: "auth", label: "การยืนยันตัวตน" },
  { key: "security", label: "ความปลอดภัย" },
];

const severityOptions = [
  { key: "all", label: "ทุกระดับ" },
  { key: "debug", label: "Debug" },
  { key: "info", label: "Info" },
  { key: "warn", label: "Warning" },
  { key: "error", label: "Error" },
  { key: "critical", label: "Critical" },
];

const timeRangeOptions = [
  { key: "1h", label: "1 ชั่วโมง" },
  { key: "6h", label: "6 ชั่วโมง" },
  { key: "24h", label: "24 ชั่วโมง" },
  { key: "7d", label: "7 วัน" },
  { key: "30d", label: "30 วัน" },
  { key: "90d", label: "90 วัน" },
  { key: "custom", label: "กำหนดเอง" },
];

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Pagination & Filters
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const {
    params,
    setSearch,
    setPage,
    setSort,
    setFilter,
  } = useTableParams({
    defaultLimit: 50,
    defaultSort: "created_at",
    defaultOrder: "desc",
    searchDebounceMs: 300,
  });
  const [searchInput, setSearchInput] = useState(String(params.search ?? ""));

  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 50;
  const search = String(params.search ?? "");
  const logTypeFilter = String(params.logType ?? "all");
  const severityFilter = String(params.severity ?? "all");
  const timeRange = String(params.timeRange ?? "24h");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const sortBy = String(params.sort ?? "created_at");
  const sortOrder: "ASC" | "DESC" = params.order === "asc" ? "ASC" : "DESC";

  // Modal states
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Calculate date range based on timeRange
  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate: Date | null = null;

    switch (timeRange) {
      case "1h":
        startDate = new Date(now.getTime() - 1 * 60 * 60 * 1000);
        break;
      case "6h":
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "custom":
        return {
          startDate: customStartDate || undefined,
          endDate: customEndDate || undefined,
        };
    }

    return {
      startDate: startDate?.toISOString(),
      endDate: now.toISOString(),
    };
  }, [timeRange, customStartDate, customEndDate]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const dateRange = getDateRange();
      const filters: LogsFilter = {
        page,
        limit,
        search: search || undefined,
        log_type: logTypeFilter !== "all" ? (logTypeFilter as LogType) : undefined,
        severity: severityFilter !== "all" ? (severityFilter as SeverityLevel) : undefined,
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      const response = await getLogs(filters);
      if (response.success && response.data) {
        setLogs(response.data.logs);
        setTotalItems(response.data.pagination.total);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      addToast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูล Log ได้",
        color: "danger",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, logTypeFilter, severityFilter, sortBy, sortOrder, getDateRange]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const dateRange = getDateRange();
      const response = await getLogStats(dateRange.startDate, dateRange.endDate);
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [getDateRange]);

  // Initial load
  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [fetchLogs, fetchStats]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Handle view detail
  const handleViewDetail = async (log: SystemLog) => {
    setIsDetailModalOpen(true);
    setIsLoadingDetail(true);
    try {
      const response = await getLogById(log.id);
      if (response.success && response.data) {
        setSelectedLog(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch log detail:", error);
      setSelectedLog(log);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const dateRange = getDateRange();
      await exportLogs({
        log_type: logTypeFilter !== "all" ? (logTypeFilter as LogType) : undefined,
        severity: severityFilter !== "all" ? (severityFilter as SeverityLevel) : undefined,
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        search: search || undefined,
      });
      addToast({
        title: "ส่งออกสำเร็จ",
        description: "ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว",
        color: "success",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
    } catch (error) {
      console.error("Failed to export logs:", error);
      addToast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถส่งออกข้อมูลได้",
        color: "danger",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle sort
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSort(column, sortOrder === "ASC" ? "desc" : "asc");
    } else {
      setSort(column, "desc");
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Get count for log type
  const getLogTypeCount = (type: string) => {
    if (type === "all") return stats?.total || 0;
    return stats?.byType.find((t) => t.log_type === type)?.count || 0;
  };

  // Render cell
  const renderCell = (log: SystemLog, columnKey: string) => {
    switch (columnKey) {
      case "created_at":
        return (
          <span className="text-xs text-default-600 whitespace-nowrap">
            {formatDate(log.created_at)}
          </span>
        );
      case "log_type":
        return (
          <Chip
            size="sm"
            color={getLogTypeBadgeColor(log.log_type)}
            variant="flat"
          >
            {getLogTypeLabel(log.log_type)}
          </Chip>
        );
      case "severity":
        return (
          <Chip
            size="sm"
            color={getSeverityBadgeColor(log.severity)}
            variant="dot"
          >
            {getSeverityLabel(log.severity)}
          </Chip>
        );
      case "action":
        return (
          <div className="max-w-52">
            <span className="text-sm font-mono truncate block" title={log.action}>
              {log.action}
            </span>
            {log.url && (
              <span className="text-xs text-default-400 truncate block" title={log.url}>
                {log.url}
              </span>
            )}
          </div>
        );
      case "status_code":
        if (!log.status_code) return <span className="text-default-400">-</span>;
        return (
          <Chip
            size="sm"
            color={getStatusCodeColor(log.status_code)}
            variant="flat"
          >
            {log.status_code}
          </Chip>
        );
      case "ip_address":
        return (
          <span className="text-sm font-mono text-default-600">
            {log.ip_address || "-"}
          </span>
        );
      case "actor_user":
        if (!log.actor_user) {
          return <span className="text-default-400">-</span>;
        }
        return (
          <div className="flex flex-col">
            <span className="text-sm">{log.actor_user.full_name}</span>
            <span className="text-xs text-default-400">{log.actor_user.email}</span>
          </div>
        );
      case "response_time_ms":
        if (!log.response_time_ms) return <span className="text-default-400">-</span>;
        return (
          <span
            className={`text-sm font-mono ${
              log.response_time_ms > 1000
                ? "text-danger"
                : log.response_time_ms > 500
                ? "text-warning"
                : "text-success"
            }`}
          >
            {log.response_time_ms}ms
          </span>
        );
      case "actions":
        return (
          <Tooltip content="ดูรายละเอียด">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => handleViewDetail(log)}
            >
              <Icon icon="solar:eye-linear" className="text-lg" />
            </Button>
          </Tooltip>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">System Logs</h1>
          <p className="text-sm text-default-500">
            บันทึกการใช้งานระบบ
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="flat"
            startContent={<Icon icon="solar:refresh-linear" className="text-lg" />}
            onPress={() => {
              fetchLogs();
              fetchStats();
            }}
            isLoading={isLoading}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <span className="hidden sm:inline">รีเฟรช</span>
            <span className="sm:hidden">รีเฟรช</span>
          </Button>
          <Button
            color="primary"
            variant="flat"
            startContent={<Icon icon="solar:export-linear" className="text-lg" />}
            onPress={handleExport}
            isLoading={isExporting}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <span className="hidden sm:inline">ส่งออก CSV</span>
            <span className="sm:hidden">ส่งออก</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                <Icon icon="solar:list-bold" className="text-xl sm:text-2xl text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-default-500">ทั้งหมด</p>
                <p className="text-lg sm:text-2xl font-bold text-default-900">{stats.total.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-cyan-100 rounded-lg">
                <Icon icon="solar:login-2-bold" className="text-xl sm:text-2xl text-cyan-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-default-500">การเข้าถึง</p>
                <p className="text-lg sm:text-2xl font-bold text-default-900">{getLogTypeCount("access").toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
                <Icon icon="solar:bug-bold" className="text-xl sm:text-2xl text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-default-500">ผิดพลาด</p>
                <p className="text-lg sm:text-2xl font-bold text-default-900">{getLogTypeCount("error").toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
                <Icon icon="solar:key-bold" className="text-xl sm:text-2xl text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-default-500">ยืนยันตัว</p>
                <p className="text-lg sm:text-2xl font-bold text-default-900">{getLogTypeCount("auth").toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-amber-100 rounded-lg">
                <Icon icon="solar:shield-bold" className="text-xl sm:text-2xl text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-default-500">ความปลอดภัย</p>
                <p className="text-lg sm:text-2xl font-bold text-default-900">{getLogTypeCount("security").toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Card with Filters */}
      <div className="bg-white rounded-xl border border-default-200 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 pb-3 sm:pb-4">
            <Input
              className="w-full"
              placeholder="ค้นหา action, URL, IP..."
              value={searchInput}
              onValueChange={(value) => {
                setSearchInput(value);
                setSearch(value);
              }}
              startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
              isClearable
              onClear={() => {
                setSearchInput("");
                setSearch("");
              }}
              classNames={{
                inputWrapper: "bg-slate-50 border-slate-200 hover:border-slate-300",
              }}
            />
            <div className="flex gap-2 flex-wrap">
              <Select
                className="flex-1 min-w-[100px]"
                placeholder="ประเภท"
                selectedKeys={new Set([logTypeFilter])}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  if (value) {
                    setFilter("logType", value);
                  }
                }}
                classNames={{
                  trigger: "bg-slate-50 border-slate-200 hover:border-slate-300",
                }}
              >
                {logTypeOptions.map((option) => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
              <Select
                className="flex-1 min-w-[90px]"
                placeholder="ระดับ"
                selectedKeys={new Set([severityFilter])}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  if (value) {
                    setFilter("severity", value);
                  }
                }}
                classNames={{
                  trigger: "bg-slate-50 border-slate-200 hover:border-slate-300",
                }}
              >
                {severityOptions.map((option) => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
              <Select
                className="flex-1 min-w-[100px]"
                placeholder="ช่วงเวลา"
                selectedKeys={new Set([timeRange])}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  if (value) {
                    setFilter("timeRange", value);
                  }
                }}
                classNames={{
                  trigger: "bg-slate-50 border-slate-200 hover:border-slate-300",
                }}
              >
                {timeRangeOptions.map((option) => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
            </div>
          </div>

          {/* Custom date range */}
          {timeRange === "custom" && (
            <div className="flex flex-col sm:flex-row gap-3 pb-3 sm:pb-4">
              <Input
                type="datetime-local"
                label="ตั้งแต่"
                value={customStartDate}
                onValueChange={setCustomStartDate}
                className="flex-1"
                size="sm"
                classNames={{
                  inputWrapper: "bg-slate-50 border-slate-200 hover:border-slate-300",
                }}
              />
              <Input
                type="datetime-local"
                label="ถึง"
                value={customEndDate}
                onValueChange={setCustomEndDate}
                className="flex-1"
                size="sm"
                classNames={{
                  inputWrapper: "bg-slate-50 border-slate-200 hover:border-slate-300",
                }}
              />
            </div>
          )}

          {/* Table with horizontal scroll */}
          <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
            <div className="min-w-[800px]">
              <Table
                aria-label="System logs table"
                removeWrapper
                classNames={{
                  th: "bg-slate-50 text-slate-600 font-semibold text-xs sm:text-sm",
                  td: "py-2 sm:py-3 text-sm",
                }}
              >
                <TableHeader columns={columns}>
                  {(column) => (
                    <TableColumn
                      key={column.key}
                      align={column.key === "actions" ? "center" : "start"}
                      allowsSorting={column.sortable}
                      onClick={() => column.sortable && handleSort(column.key)}
                      className={column.sortable ? "cursor-pointer hover:bg-default-200" : ""}
                    >
                      <div className="flex items-center gap-1">
                        {column.label}
                        {column.sortable && sortBy === column.key && (
                          <Icon
                            icon={sortOrder === "ASC" ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
                            className="text-sm"
                          />
                        )}
                      </div>
                    </TableColumn>
                  )}
                </TableHeader>
            <TableBody
              items={logs}
              isLoading={isLoading}
              loadingContent={<Spinner color="primary" label="กำลังโหลด..." />}
              emptyContent={
                <div className="py-10 text-center">
                  <Icon icon="solar:document-text-linear" className="text-5xl text-default-300 mx-auto mb-3" />
                  <p className="text-default-400">ไม่พบข้อมูล Log</p>
                </div>
              }
            >
              {(log) => (
                <TableRow key={log.id}>
                  {(columnKey) => (
                    <TableCell>{renderCell(log, columnKey as string)}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 py-3 border-t border-slate-100">
            <span className="text-xs sm:text-sm text-slate-500 order-2 sm:order-1">
              แสดง {((page - 1) * limit) + 1} - {Math.min(page * limit, totalItems)} จาก {totalItems.toLocaleString()} รายการ
            </span>
            <Pagination
              total={totalPages}
              page={page}
              onChange={setPage}
              showControls
              size="sm"
              color="primary"
              className="order-1 sm:order-2"
            />
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedLog(null);
        }}
        size="3xl"
        scrollBehavior="inside"
        classNames={{
          base: "mx-2 sm:mx-4",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 border-b border-divider">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon icon="solar:document-text-linear" className="text-xl text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Log Detail</h3>
                    {selectedLog && (
                      <span className="text-sm font-normal text-default-500">
                        ID: {selectedLog.id} • {formatDate(selectedLog.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              </ModalHeader>
              <ModalBody className="py-5">
                {isLoadingDetail ? (
                  <div className="flex justify-center py-8">
                    <Spinner label="กำลังโหลด..." />
                  </div>
                ) : selectedLog ? (
                  <div className="space-y-5">
                    {/* Basic Info */}
                    <div className="flex flex-wrap gap-3">
                      <Chip color={getLogTypeBadgeColor(selectedLog.log_type)} variant="flat" size="lg">
                        {getLogTypeLabel(selectedLog.log_type)}
                      </Chip>
                      <Chip color={getSeverityBadgeColor(selectedLog.severity)} variant="dot" size="lg">
                        {getSeverityLabel(selectedLog.severity)}
                      </Chip>
                      {selectedLog.status_code && (
                        <Chip color={getStatusCodeColor(selectedLog.status_code)} variant="flat" size="lg">
                          HTTP {selectedLog.status_code}
                        </Chip>
                      )}
                      {selectedLog.response_time_ms && (
                        <Chip variant="flat" size="lg">
                          <Icon icon="solar:stopwatch-linear" className="mr-1" />
                          {selectedLog.response_time_ms}ms
                        </Chip>
                      )}
                    </div>

                    {/* Request Info */}
                    <Card className="bg-default-50">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:server-linear" className="text-default-500" />
                          <h4 className="font-semibold text-sm">Request Information</h4>
                        </div>
                      </CardHeader>
                      <CardBody className="pt-0 space-y-3">
                        <div>
                          <p className="text-xs text-default-500 mb-1">Action</p>
                          <p className="font-mono text-sm bg-default-100 px-3 py-2 rounded-lg">{selectedLog.action}</p>
                        </div>
                        {selectedLog.url && (
                          <div>
                            <p className="text-xs text-default-500 mb-1">URL</p>
                            <p className="font-mono text-sm bg-default-100 px-3 py-2 rounded-lg break-all">
                              <span className="text-primary font-semibold">{selectedLog.http_method}</span> {selectedLog.url}
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-default-100 px-3 py-2 rounded-lg">
                            <p className="text-xs text-default-500">Request Size</p>
                            <p className="font-mono text-sm">{formatBytes(selectedLog.request_size || 0)}</p>
                          </div>
                          <div className="bg-default-100 px-3 py-2 rounded-lg">
                            <p className="text-xs text-default-500">Response Size</p>
                            <p className="font-mono text-sm">{formatBytes(selectedLog.response_size || 0)}</p>
                          </div>
                          <div className="bg-default-100 px-3 py-2 rounded-lg">
                            <p className="text-xs text-default-500">Response Time</p>
                            <p className="font-mono text-sm">{selectedLog.response_time_ms ? `${selectedLog.response_time_ms}ms` : "-"}</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    {/* Client Info */}
                    <Card className="bg-default-50">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:monitor-smartphone-linear" className="text-default-500" />
                          <h4 className="font-semibold text-sm">Client Information</h4>
                        </div>
                      </CardHeader>
                      <CardBody className="pt-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-default-100 px-3 py-2 rounded-lg">
                            <p className="text-xs text-default-500">IP Address</p>
                            <p className="font-mono text-sm">{selectedLog.ip_address || "-"}</p>
                          </div>
                          <div className="bg-default-100 px-3 py-2 rounded-lg">
                            <p className="text-xs text-default-500">Device</p>
                            <p className="text-sm capitalize">{selectedLog.device_type || "-"}</p>
                          </div>
                          <div className="bg-default-100 px-3 py-2 rounded-lg">
                            <p className="text-xs text-default-500">Browser</p>
                            <p className="text-sm">{selectedLog.browser || "-"}</p>
                          </div>
                          <div className="bg-default-100 px-3 py-2 rounded-lg">
                            <p className="text-xs text-default-500">OS</p>
                            <p className="text-sm">{selectedLog.os || "-"}</p>
                          </div>
                        </div>
                        {selectedLog.user_agent && (
                          <div className="mt-3 bg-default-100 px-3 py-2 rounded-lg">
                            <p className="text-xs text-default-500 mb-1">User Agent</p>
                            <p className="text-xs font-mono break-all text-default-600">
                              {selectedLog.user_agent}
                            </p>
                          </div>
                        )}
                      </CardBody>
                    </Card>

                    {/* User Info */}
                    {selectedLog.actor_user && (
                      <Card className="bg-default-50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:user-linear" className="text-default-500" />
                            <h4 className="font-semibold text-sm">User Information</h4>
                          </div>
                        </CardHeader>
                        <CardBody className="pt-0">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-default-100 px-3 py-2 rounded-lg">
                              <p className="text-xs text-default-500">ชื่อ</p>
                              <p className="text-sm font-medium">{selectedLog.actor_user.full_name}</p>
                            </div>
                            <div className="bg-default-100 px-3 py-2 rounded-lg">
                              <p className="text-xs text-default-500">อีเมล</p>
                              <p className="text-sm">{selectedLog.actor_user.email}</p>
                            </div>
                            <div className="bg-default-100 px-3 py-2 rounded-lg">
                              <p className="text-xs text-default-500">บทบาท</p>
                              <p className="text-sm">{selectedLog.actor_user.role || "-"}</p>

                            </div>
                            <div className="bg-default-100 px-3 py-2 rounded-lg">
                              <p className="text-xs text-default-500">Auth Method</p>
                              <p className="text-sm">{selectedLog.auth_method || "-"}</p>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    )}

                    {/* Error Info */}
                    {(selectedLog.error_message || selectedLog.error_stack) && (
                      <Card className="border border-danger/30 bg-danger/5">
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:danger-triangle-linear" className="text-danger" />
                            <h4 className="font-semibold text-sm text-danger">Error Information</h4>
                          </div>
                        </CardHeader>
                        <CardBody className="pt-0 space-y-3">
                          {selectedLog.error_code && (
                            <Chip color="danger" variant="flat" size="sm">
                              {selectedLog.error_code}
                            </Chip>
                          )}
                          {selectedLog.error_message && (
                            <div>
                              <p className="text-xs text-default-500 mb-1">Message</p>
                              <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">{selectedLog.error_message}</p>
                            </div>
                          )}
                          {selectedLog.error_stack && (
                            <div>
                              <p className="text-xs text-default-500 mb-1">Stack Trace</p>
                              <pre className="text-xs bg-default-900 text-default-100 p-3 rounded-lg overflow-x-auto max-h-48">
                                {selectedLog.error_stack}
                              </pre>
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    )}

                    {/* Detail JSON */}
                    {selectedLog.detail && Object.keys(selectedLog.detail).length > 0 && (
                      <Card className="bg-default-50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:code-linear" className="text-default-500" />
                            <h4 className="font-semibold text-sm">Additional Details</h4>
                          </div>
                        </CardHeader>
                        <CardBody className="pt-0">
                          <pre className="text-xs bg-default-900 text-default-100 p-3 rounded-lg overflow-x-auto max-h-48">
                            {JSON.stringify(selectedLog.detail, null, 2)}
                          </pre>
                        </CardBody>
                      </Card>
                    )}

                    {/* Request Body */}
                    {selectedLog.request_body && Object.keys(selectedLog.request_body).length > 0 && (
                      <Card className="bg-default-50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:document-text-linear" className="text-default-500" />
                            <h4 className="font-semibold text-sm">Request Body (Sanitized)</h4>
                          </div>
                        </CardHeader>
                        <CardBody className="pt-0">
                          <pre className="text-xs bg-default-900 text-default-100 p-3 rounded-lg overflow-x-auto max-h-48">
                            {JSON.stringify(selectedLog.request_body, null, 2)}
                          </pre>
                        </CardBody>
                      </Card>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-default-500 py-8">ไม่พบข้อมูล</p>
                )}
              </ModalBody>
              <ModalFooter className="border-t border-divider">
                <Button variant="flat" onPress={onClose}>
                  ปิด
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
