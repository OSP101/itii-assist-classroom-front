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
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Tooltip } from "@heroui/tooltip";
import { Avatar } from "@heroui/avatar";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Textarea } from "@heroui/input";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { feedbackService } from "@/services/feedback.service";
import type { Feedback, FeedbackStats, UpdateFeedbackDto } from "@/services/feedback.service";
import { useTableParams } from "@/lib/table/use-table-params";
import TablePaginationFooter, { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/components/ui/table-pagination-footer";

// Column definitions
const columns = [
    { key: "type", label: "ประเภท", sortable: true },
    { key: "title", label: "หัวข้อ", sortable: true },
    { key: "user", label: "ผู้ส่ง", sortable: false },
    { key: "status", label: "สถานะ", sortable: true },
    { key: "priority", label: "ความสำคัญ", sortable: true },
    { key: "created_at", label: "วันที่", sortable: true },
    { key: "actions", label: "จัดการ", sortable: false },
];

const typeOptions = [
    { key: "all", label: "ทุกประเภท" },
    { key: "bug", label: "รายงานข้อผิดพลาด" },
    { key: "feature", label: "ขอฟีเจอร์ใหม่" },
    { key: "improvement", label: "ข้อเสนอแนะ" },
    { key: "support", label: "คำขอสนับสนุน" },
    { key: "other", label: "อื่นๆ" },
];

const statusOptions = [
    { key: "all", label: "ทุกสถานะ" },
    { key: "pending", label: "รอดำเนินการ" },
    { key: "reviewing", label: "กำลังตรวจสอบ" },
    { key: "resolved", label: "แก้ไขแล้ว" },
    { key: "rejected", label: "ปฏิเสธ" },
];

const priorityOptions = [
    { key: "all", label: "ทุกระดับ" },
    { key: "low", label: "ต่ำ" },
    { key: "medium", label: "ปานกลาง" },
    { key: "high", label: "สูง" },
    { key: "critical", label: "วิกฤต" },
];

const typeLabels: Record<string, string> = {
    bug: "รายงานข้อผิดพลาด",
    feature: "ขอฟีเจอร์ใหม่",
    improvement: "ข้อเสนอแนะ",
    support: "คำขอสนับสนุน",
    other: "อื่นๆ",
};

const typeColors: Record<string, "danger" | "primary" | "warning" | "default" | "success"> = {
    bug: "danger",
    feature: "primary",
    improvement: "warning",
    support: "success",
    other: "default",
};

const typeIcons: Record<string, string> = {
    bug: 'solar:bug-bold',
    feature: 'solar:star-bold',
    improvement: 'solar:lightbulb-bold',
    support: 'solar:chat-round-dots-bold',
    other: 'solar:chat-round-dots-bold',
};

const statusLabels: Record<string, string> = {
    pending: "รอดำเนินการ",
    reviewing: "กำลังตรวจสอบ",
    resolved: "แก้ไขแล้ว",
    rejected: "ปฏิเสธ",
};

const statusColors: Record<string, "warning" | "primary" | "success" | "danger"> = {
    pending: "warning",
    reviewing: "primary",
    resolved: "success",
    rejected: "danger",
};

const priorityLabels: Record<string, string> = {
    low: "ต่ำ",
    medium: "ปานกลาง",
    high: "สูง",
    critical: "วิกฤต",
};

const priorityColors: Record<string, "default" | "primary" | "warning" | "danger"> = {
    low: "default",
    medium: "primary",
    high: "warning",
    critical: "danger",
};

export default function FeedbackPage() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [stats, setStats] = useState<FeedbackStats | null>(null);

    // Pagination & Filters
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const {
        params,
        setSearch,
        setPage,
        setLimit,
        setFilter,
    } = useTableParams({
        defaultLimit: DEFAULT_TABLE_ROWS_PER_PAGE,
        defaultSort: "created_at",
        defaultOrder: "desc",
        searchDebounceMs: 300,
    });
    const [searchInput, setSearchInput] = useState(String(params.search ?? ""));

    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || DEFAULT_TABLE_ROWS_PER_PAGE;
    const search = String(params.search ?? "");
    const typeFilter = String(params.type ?? "all");
    const statusFilter = String(params.status ?? "all");
    const priorityFilter = String(params.priority ?? "all");

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Modal states
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit form
    const [editStatus, setEditStatus] = useState("");
    const [editPriority, setEditPriority] = useState("");
    const [adminNotes, setAdminNotes] = useState("");

    // Fetch feedbacks
    const fetchFeedbacks = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await feedbackService.getFeedbacks({
                page,
                limit,
                search: search || undefined,
                type: typeFilter !== "all" ? typeFilter : undefined,
                status: statusFilter !== "all" ? statusFilter : undefined,
                priority: priorityFilter !== "all" ? priorityFilter : undefined,
                sort_by: "created_at",
                sort_order: "DESC",
            });

            if (response.success && response.data) {
                setFeedbacks(response.data.feedbacks);
                setTotalPages(response.data.pagination.totalPages);
                setTotalItems(response.data.pagination.total);
            }
        } catch (error) {
            console.error("Error fetching feedbacks:", error);
        } finally {
            setIsLoading(false);
        }
    }, [page, limit, search, typeFilter, statusFilter, priorityFilter]);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const response = await feedbackService.getStats();
            if (response.success && response.data) {
                setStats(response.data);
            }
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    }, []);

    useEffect(() => {
        fetchFeedbacks();
        fetchStats();
    }, [fetchFeedbacks, fetchStats]);

    useEffect(() => {
        setSearchInput(search);
    }, [search]);

    // Open view modal
    const openViewModal = (feedback: Feedback) => {
        setSelectedFeedback(feedback);
        setEditStatus(feedback.status);
        setEditPriority(feedback.priority);
        setAdminNotes(feedback.admin_notes || "");
        setIsViewModalOpen(true);
    };

    // Handle update
    const handleUpdate = async () => {
        if (!selectedFeedback) return;

        setIsSubmitting(true);
        try {
            const updateData: UpdateFeedbackDto = {
                status: editStatus as any,
                priority: editPriority as any,
                admin_notes: adminNotes,
            };

            const response = await feedbackService.updateFeedback(selectedFeedback.id, updateData);
            if (response.success) {
                addToast({
                    title: "อัปเดตสำเร็จ",
                    description: "อัปเดต Feedback เรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsViewModalOpen(false);
                fetchFeedbacks();
                fetchStats();
            } else {
                addToast({
                    title: "เกิดข้อผิดพลาด",
                    description: response.message || "ไม่สามารถอัปเดตได้",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถอัปเดตได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (!selectedFeedback) return;

        setIsSubmitting(true);
        try {
            const response = await feedbackService.deleteFeedback(selectedFeedback.id);
            if (response.success) {
                addToast({
                    title: "ลบสำเร็จ",
                    description: "ลบ Feedback เรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsDeleteModalOpen(false);
                fetchFeedbacks();
                fetchStats();
            } else {
                addToast({
                    title: "เกิดข้อผิดพลาด",
                    description: response.message || "ไม่สามารถลบได้",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถลบได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render cell
    const renderCell = useCallback((feedback: Feedback, columnKey: React.Key) => {
        switch (columnKey) {
            case "type":
                return (
                    <Chip color={typeColors[feedback.type]} variant="flat" size="sm">
                        {typeLabels[feedback.type]}
                    </Chip>
                );
            case "title":
                return (
                    <div className="max-w-xs">
                        <p className="font-medium text-default-900 truncate">{feedback.title}</p>
                        <p className="text-xs text-default-500 truncate">{feedback.description}</p>
                    </div>
                );
            case "user":
                return feedback.user ? (
                    <div className="flex items-center gap-2">
                        <Avatar
                            name={feedback.user.full_name}
                            size="md"
                            src={feedback.user.avatar || ""}
                            className="bg-linear-to-br from-blue-400 to-indigo-500 text-white"
                        />
                        <div>
                            <p className="text-sm font-medium">{feedback.user.full_name}</p>
                            <p className="text-xs text-default-500">{feedback.user.email}</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-default-500 text-sm">
                        {feedback.contact_email || "ไม่ระบุตัวตน"}
                    </div>
                );
            case "status":
                return (
                    <Chip color={statusColors[feedback.status]} variant="flat" size="sm">
                        {statusLabels[feedback.status]}
                    </Chip>
                );
            case "priority":
                return (
                    <Chip color={priorityColors[feedback.priority]} variant="dot" size="sm">
                        {priorityLabels[feedback.priority]}
                    </Chip>
                );
            case "created_at":
                return (
                    <span className="text-sm text-default-600">
                        {new Date(feedback.created_at).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        })}
                    </span>
                );
            case "actions":
                return (
                    <div className="flex items-center gap-1">
                        <Tooltip content="ดูรายละเอียด">
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => openViewModal(feedback)}
                            >
                                <Icon icon="solar:eye-linear" className="text-lg text-default-600" />
                            </Button>
                        </Tooltip>
                        <Tooltip content="ลบ" color="danger">
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                onPress={() => {
                                    setSelectedFeedback(feedback);
                                    setIsDeleteModalOpen(true);
                                }}
                            >
                                <Icon icon="solar:trash-bin-trash-linear" className="text-lg" />
                            </Button>
                        </Tooltip>
                    </div>
                );
            default:
                return null;
        }
    }, []);

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-default-900">จัดการ Feedback</h1>
                    <p className="text-sm text-default-500">รายงานข้อผิดพลาด ข้อเสนอแนะ และคำขอสนับสนุนจากผู้ใช้</p>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
                    <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-blue-100 rounded-xl">
                                <Icon icon="solar:chat-round-dots-bold" className="text-xl sm:text-2xl text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-default-500">ทั้งหมด</p>
                                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.total}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-amber-100 rounded-xl">
                                <Icon icon="solar:clock-circle-bold" className="text-xl sm:text-2xl text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-default-500">รอดำเนินการ</p>
                                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.byStatus.pending}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-purple-100 rounded-xl">
                                <Icon icon="solar:magnifer-bold" className="text-xl sm:text-2xl text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-default-500">กำลังตรวจสอบ</p>
                                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.byStatus.reviewing}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-green-100 rounded-xl">
                                <Icon icon="solar:check-circle-bold" className="text-xl sm:text-2xl text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-default-500">แก้ไขแล้ว</p>
                                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.byStatus.resolved}</p>
                            </div>
                        </div>
                    </div>
                    <div className="col-span-2 rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4 lg:col-span-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-red-100 rounded-xl">
                                <Icon icon="solar:bug-bold" className="text-xl sm:text-2xl text-red-600" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-default-500">ข้อผิดพลาด</p>
                                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.byType.bugs}</p>
                            </div>
                        </div>
                    </div>
                    <div className="col-span-2 rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4 lg:col-span-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-emerald-100 rounded-xl">
                                <Icon icon="solar:chat-round-dots-bold" className="text-xl sm:text-2xl text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-default-500">คำขอสนับสนุน</p>
                                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.byType.supports}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="rounded-xl border border-default-200 bg-content1 p-4 shadow-sm">
                <div className="flex flex-col md:flex-row gap-3 pb-3 sm:pb-4">
                    <Input
                        aria-label="ค้นหา Feedback"
                        placeholder="ค้นหา..."
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
                        className="w-full md:flex-1"
                        size="md"
                        classNames={{
                            inputWrapper: "bg-content2 border-default-200 hover:border-default-300",
                        }}
                    />
                    <div className="flex gap-2 flex-wrap md:flex-nowrap">
                        <Select
                            aria-label="กรองตามประเภท"
                            placeholder="ประเภท"
                            selectedKeys={[typeFilter]}
                            onSelectionChange={(keys) => {
                                const selected = Array.from(keys)[0] as string;
                                setFilter("type", selected);
                            }}
                            className="flex-1 min-w-37.5 sm:w-48"
                                size="md"
                                classNames={{
                                    trigger: "bg-content2 border-default-200 hover:border-default-300",
                                }}
                        >
                            {typeOptions.map((option) => (
                                <SelectItem key={option.key}>{option.label}</SelectItem>
                            ))}
                        </Select>
                        <Select
                            aria-label="กรองตามสถานะ"
                            placeholder="สถานะ"
                            selectedKeys={[statusFilter]}
                            onSelectionChange={(keys) => {
                                const selected = Array.from(keys)[0] as string;
                                setFilter("status", selected);
                            }}
                            className="flex-1 min-w-37.5 sm:w-48"
                                size="md"
                                classNames={{
                                    trigger: "bg-content2 border-default-200 hover:border-default-300",
                                }}
                        >
                            {statusOptions.map((option) => (
                                <SelectItem key={option.key}>{option.label}</SelectItem>
                            ))}
                        </Select>
                        <Select
                            aria-label="กรองตามความสำคัญ"
                            placeholder="ความสำคัญ"
                            selectedKeys={[priorityFilter]}
                            onSelectionChange={(keys) => {
                                const selected = Array.from(keys)[0] as string;
                                setFilter("priority", selected);
                            }}
                            className="flex-1 min-w-37.5 sm:w-48"
                                size="md"
                                classNames={{
                                    trigger: "bg-content2 border-default-200 hover:border-default-300",
                                }}
                        >
                            {priorityOptions.map((option) => (
                                <SelectItem key={option.key}>{option.label}</SelectItem>
                            ))}
                        </Select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
                    <div className="min-w-150">
                        <Table
                            aria-label="Feedback table"
                            removeWrapper
                            classNames={{
                                th: "bg-content2 text-default-600 font-semibold text-xs sm:text-sm",
                                td: "py-2 sm:py-3",
                            }}
                        >
                            <TableHeader columns={columns}>
                                {(column) => (
                                    <TableColumn key={column.key} className="bg-default-50">
                                        {column.label}
                                    </TableColumn>
                                )}
                            </TableHeader>
                            <TableBody
                                items={feedbacks}
                                isLoading={isLoading}
                                loadingContent={<Spinner color="primary" />}
                                emptyContent="ไม่พบข้อมูล"
                            >
                                {(item) => (
                                    <TableRow key={item.id}>
                                        {(columnKey) => (
                                            <TableCell>{renderCell(item, columnKey)}</TableCell>
                                        )}
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                <TablePaginationFooter
                    totalItems={totalItems}
                    currentPage={page}
                    rowsPerPage={limit}
                    totalPages={totalPages}
                    isEnglish={false}
                    nounEnglish="feedback item"
                    nounThai="รายการ"
                    onPageChange={setPage}
                    onRowsPerPageChange={setLimit}
                />
            </div>



            {/* View/Edit Modal */}
            <Modal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                size="2xl"
                scrollBehavior="inside"
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="border-b border-default-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-linear-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-500/30">
                                        <Icon
                                            icon={selectedFeedback ? typeIcons[selectedFeedback.type] || 'solar:chat-round-dots-bold' : 'solar:chat-round-dots-bold'}
                                            className="text-xl text-white"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{selectedFeedback?.title}</h3>
                                        <p className="text-xs text-default-500">
                                            {selectedFeedback && typeLabels[selectedFeedback.type]}
                                        </p>
                                    </div>
                                </div>
                            </ModalHeader>
                            <ModalBody className="py-4">
                                {selectedFeedback && (
                                    <div className="space-y-4">
                                        {/* User Info */}
                                        <div className="flex items-center gap-3 p-3 bg-default-50 rounded-lg">
                                            {selectedFeedback.user ? (
                                                <>
                                                    <Avatar
                                                        name={selectedFeedback.user.full_name}
                                                        src={selectedFeedback.user.avatar || ""}
                                                        size="md"
                                                        className="bg-linear-to-br from-blue-400 to-indigo-500 text-white"
                                                    />
                                                    <div>
                                                        <p className="font-medium">{selectedFeedback.user.full_name}</p>
                                                        <p className="text-xs text-default-500">{selectedFeedback.user.email}</p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-default-500">
                                                    <p className="font-medium">ผู้ใช้ไม่ระบุตัวตน</p>
                                                    {selectedFeedback.contact_email && (
                                                        <p className="text-xs">{selectedFeedback.contact_email}</p>
                                                    )}
                                                </div>
                                            )}
                                            <div className="ml-auto text-right">
                                                <p className="text-xs text-default-500">ส่งเมื่อ</p>
                                                <p className="text-sm">
                                                    {new Date(selectedFeedback.created_at).toLocaleString('th-TH')}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <p className="text-sm font-medium mb-2">รายละเอียด</p>
                                            <div className="p-3 bg-default-50 rounded-lg whitespace-pre-wrap text-sm">
                                                {selectedFeedback.description}
                                            </div>
                                        </div>

                                        {/* Attachments */}
                                        {selectedFeedback.attachments && selectedFeedback.attachments.length > 0 && (
                                            <div>
                                                <p className="text-sm font-medium mb-2">ไฟล์แนบ</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedFeedback.attachments.map((url, index) => (
                                                        <a
                                                            key={index}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block"
                                                        >
                                                            <img
                                                                src={url}
                                                                alt={`Attachment ${index + 1}`}
                                                                className="w-24 h-24 object-cover rounded-lg border border-default-200 hover:opacity-80 transition-opacity"
                                                            />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Edit Form */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <Select
                                                label="สถานะ"
                                                selectedKeys={[editStatus]}
                                                onSelectionChange={(keys) => setEditStatus(Array.from(keys)[0] as string)}
                                                size="sm"
                                            >
                                                {statusOptions.filter(o => o.key !== 'all').map((option) => (
                                                    <SelectItem key={option.key}>{option.label}</SelectItem>
                                                ))}
                                            </Select>
                                            <Select
                                                label="ความสำคัญ"
                                                selectedKeys={[editPriority]}
                                                onSelectionChange={(keys) => setEditPriority(Array.from(keys)[0] as string)}
                                                size="sm"
                                            >
                                                {priorityOptions.filter(o => o.key !== 'all').map((option) => (
                                                    <SelectItem key={option.key}>{option.label}</SelectItem>
                                                ))}
                                            </Select>
                                        </div>

                                        <Textarea
                                            label="บันทึกของผู้ดูแล"
                                            placeholder="เพิ่มบันทึก..."
                                            value={adminNotes}
                                            onValueChange={setAdminNotes}
                                            minRows={3}
                                        />

                                        {/* Resolver info */}
                                        {selectedFeedback.resolver && (
                                            <div className="text-xs text-default-500">
                                                จัดการโดย: {selectedFeedback.resolver.full_name} เมื่อ{' '}
                                                {new Date(selectedFeedback.resolved_at!).toLocaleString('th-TH')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </ModalBody>
                            <ModalFooter className="border-t border-default-100">
                                <Button variant="light" onPress={onClose}>
                                    ปิด
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={handleUpdate}
                                    isLoading={isSubmitting}
                                >
                                    บันทึก
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* Delete Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                size="sm"
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="px-6 pt-6 pb-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                        <Icon icon="solar:trash-bin-trash-bold" className="text-2xl text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground">ยืนยันการลบ</h3>
                                </div>
                            </ModalHeader>
                            <ModalBody className="px-6 py-6">
                                <p>คุณต้องการลบ Feedback นี้หรือไม่?</p>
                                <p className="font-medium">{selectedFeedback?.title}</p>
                            </ModalBody>
                            <ModalFooter className="gap-3 border-t border-divider px-6 py-4">
                                <Button variant="flat" color="default" onPress={onClose} className="font-medium px-6">
                                    ยกเลิก
                                </Button>
                                <Button
                                    color="danger"
                                    onPress={handleDelete}
                                    isLoading={isSubmitting}
                                    className="font-medium px-6"
                                >
                                    ลบ
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
