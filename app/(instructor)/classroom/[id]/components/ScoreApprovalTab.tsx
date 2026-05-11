"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Tabs, Tab } from "@heroui/tabs";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Divider } from "@heroui/divider";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import scoreEditRequestService, { type ScoreEditRequest } from "@/services/scoreEditRequest.service";
import { API_BASE_URL } from "@/config/api";
import Image from "next/image";

interface ScoreApprovalTabProps {
    courseId: string;
    userRole?: string;
    onPendingCountChange?: (count: number) => void;
    isCourseActive?: boolean;
}

type FilterStatus = "pending" | "approved" | "rejected" | "all";

// Group of related requests (same assignment, same new_score, same reason, same time)
interface RequestGroup {
    key: string;
    requests: ScoreEditRequest[];
    assignment: ScoreEditRequest["assignment"];
    sub_item: ScoreEditRequest["sub_item"];
    new_score: number;
    old_score: number | null;
    reason: string | null;
    images: string[] | null;
    requester: ScoreEditRequest["requester"];
    created_at: string;
    status: string;
}

// Format date helper
const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

// Get image URL helper — point directly to backend server
// <img> tags load cross-origin images without CORS restrictions
const getImageUrl = (imagePath: string): string => {
    // API_BASE_URL = "http://host:3001/api" → strip trailing "/api" to get server root
    const backendRoot = API_BASE_URL.replace(/\/api\/?$/, '');
    // imagePath format: "uploads/score-edit-requests/filename.jpg"
    return `${backendRoot}/${imagePath}`;
};

export default function ScoreApprovalTab({ courseId, userRole, onPendingCountChange, isCourseActive = true }: ScoreApprovalTabProps) {
    const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending");
    const [requests, setRequests] = useState<ScoreEditRequest[]>([]);
    const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
    const [isLoading, setIsLoading] = useState(true);

    const isReadOnly = userRole === 'ta' || !isCourseActive;

    // Action modal states
    const [actionModal, setActionModal] = useState<{
        isOpen: boolean;
        type: "approve" | "reject";
        request: ScoreEditRequest | null;
        group: RequestGroup | null;
        selectedIds: number[];
    }>({ isOpen: false, type: "approve", request: null, group: null, selectedIds: [] });
    const [actionComment, setActionComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cancellingRequestId, setCancellingRequestId] = useState<number | null>(null);
    const [cancelModalRequest, setCancelModalRequest] = useState<ScoreEditRequest | null>(null);

    // Image preview modal
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Group batch requests together: same assignment + sub_item + requester + reason + new_score,
    // created within 30 seconds of each other → treated as one batch submission.
    const groupedRequests = useMemo((): RequestGroup[] => {
        const groups: RequestGroup[] = [];
        const used = new Set<number>();

        // Sort by created_at ascending so we process earliest first
        const sorted = [...requests].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        for (const req of sorted) {
            if (used.has(req.id)) continue;

            // Find all requests that belong to the same batch:
            // same assignment, sub_item, requester, new_score, reason,
            // and created within 30 s of this request.
            const refTime = new Date(req.created_at).getTime();
            const batchMembers = sorted.filter(
                (r) =>
                    !used.has(r.id) &&
                    r.assignment.id === req.assignment.id &&
                    (r.sub_item?.id ?? null) === (req.sub_item?.id ?? null) &&
                    r.requester.id === req.requester.id &&
                    r.new_score === req.new_score &&
                    r.reason === req.reason &&
                    r.student.id !== req.student.id && // different students
                    Math.abs(new Date(r.created_at).getTime() - refTime) <= 30_000
            );

            if (batchMembers.length > 0) {
                // This is a batch group — combine req + all batchMembers
                const allInGroup = [req, ...batchMembers];
                allInGroup.forEach((r) => used.add(r.id));

                // Overall status: pending if any member is still pending
                const overallStatus =
                    allInGroup.some((r) => r.status === "pending")
                        ? "pending"
                        : allInGroup.every((r) => r.status === "approved")
                        ? "approved"
                        : "rejected";

                groups.push({
                    key: `batch-${allInGroup.map((r) => r.id).join("-")}`,
                    requests: allInGroup,
                    assignment: req.assignment,
                    sub_item: req.sub_item,
                    new_score: req.new_score,
                    old_score: req.old_score,
                    reason: req.reason,
                    images: req.images,
                    requester: req.requester,
                    created_at: req.created_at,
                    status: overallStatus,
                });
            } else {
                // Single request
                used.add(req.id);
                groups.push({
                    key: `single-${req.id}`,
                    requests: [req],
                    assignment: req.assignment,
                    sub_item: req.sub_item,
                    new_score: req.new_score,
                    old_score: req.old_score,
                    reason: req.reason,
                    images: req.images,
                    requester: req.requester,
                    created_at: req.created_at,
                    status: req.status,
                });
            }
        }

        // Sort final groups: pending first, then by created_at desc
        return groups.sort((a, b) => {
            if (a.status === "pending" && b.status !== "pending") return -1;
            if (a.status !== "pending" && b.status === "pending") return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [requests]);

    // Fetch requests
    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        try {
            const status = filterStatus === "all" ? undefined : filterStatus;
            const response = await scoreEditRequestService.getEditRequests(courseId, status);
            if (response) {
                setRequests(response.data || []);
                const countsData = response.counts || { pending: 0, approved: 0, rejected: 0 };
                setCounts(countsData);
                onPendingCountChange?.(countsData.pending);
            }
        } catch (error) {
            console.error("Failed to fetch edit requests:", error);
            setRequests([]);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถโหลดข้อมูลได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId, filterStatus]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    // Handle approve
    const handleApprove = async () => {
        const { request, group, selectedIds } = actionModal;
        
        setIsSubmitting(true);
        try {
            if (group && selectedIds.length > 0) {
                // Batch approve
                await scoreEditRequestService.batchApproveEditRequests(selectedIds, actionComment || undefined);
                addToast({
                    title: "อนุมัติสำเร็จ",
                    description: `อนุมัติการแก้ไขคะแนน ${selectedIds.length} รายการเรียบร้อยแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else if (request) {
                // Single approve
                await scoreEditRequestService.approveEditRequest(request.id, actionComment || undefined);
                addToast({
                    title: "อนุมัติสำเร็จ",
                    description: "อนุมัติการแก้ไขคะแนนเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
            setActionModal({ isOpen: false, type: "approve", request: null, group: null, selectedIds: [] });
            setActionComment("");
            fetchRequests();
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถอนุมัติได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle reject
    const handleReject = async () => {
        const { request, group, selectedIds } = actionModal;

        if (!actionComment.trim()) {
            addToast({
                title: "กรุณาระบุเหตุผล",
                description: "ต้องระบุเหตุผลในการปฏิเสธ",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            if (group && selectedIds.length > 0) {
                // Batch reject
                await scoreEditRequestService.batchRejectEditRequests(selectedIds, actionComment);
                addToast({
                    title: "ปฏิเสธสำเร็จ",
                    description: `ปฏิเสธการแก้ไขคะแนน ${selectedIds.length} รายการเรียบร้อยแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else if (request) {
                // Single reject
                await scoreEditRequestService.rejectEditRequest(request.id, actionComment);
                addToast({
                    title: "ปฏิเสธสำเร็จ",
                    description: "ปฏิเสธการแก้ไขคะแนนเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
            setActionModal({ isOpen: false, type: "reject", request: null, group: null, selectedIds: [] });
            setActionComment("");
            fetchRequests();
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถปฏิเสธได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Allow requester (TA view) to cancel their own pending request.
    const confirmCancelRequest = async () => {
        if (!cancelModalRequest) {
            return;
        }

        setCancellingRequestId(cancelModalRequest.id);
        try {
            await scoreEditRequestService.cancelEditRequest(cancelModalRequest.id);
            addToast({
                title: "ยกเลิกคำร้องสำเร็จ",
                description: "คำร้องแก้ไขคะแนนถูกยกเลิกแล้ว",
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            setCancelModalRequest(null);
            fetchRequests();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "ไม่สามารถยกเลิกคำร้องได้";
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: errorMessage,
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setCancellingRequestId(null);
        }
    };

    // Open action modal for group
    const openGroupActionModal = (type: "approve" | "reject", group: RequestGroup) => {
        // Default select all pending requests in the group
        const pendingIds = group.requests.filter(r => r.status === "pending").map(r => r.id);
        setActionModal({
            isOpen: true,
            type,
            request: null,
            group,
            selectedIds: pendingIds,
        });
    };

    // Open action modal for single request
    const openSingleActionModal = (type: "approve" | "reject", request: ScoreEditRequest) => {
        setActionModal({
            isOpen: true,
            type,
            request,
            group: null,
            selectedIds: [request.id],
        });
    };

    // Toggle selection of a request in group
    const toggleRequestSelection = (id: number) => {
        setActionModal(prev => ({
            ...prev,
            selectedIds: prev.selectedIds.includes(id)
                ? prev.selectedIds.filter(i => i !== id)
                : [...prev.selectedIds, id],
        }));
    };

    // Select/deselect all requests in group
    const toggleAllSelection = (selectAll: boolean) => {
        if (!actionModal.group) return;
        const pendingIds = actionModal.group.requests.filter(r => r.status === "pending").map(r => r.id);
        setActionModal(prev => ({
            ...prev,
            selectedIds: selectAll ? pendingIds : [],
        }));
    };

    // Get status chip
    const getStatusChip = (status: string) => {
        switch (status) {
            case "pending":
                return <Chip size="sm" color="warning" variant="flat">รออนุมัติ</Chip>;
            case "approved":
                return <Chip size="sm" color="success" variant="flat">อนุมัติแล้ว</Chip>;
            case "rejected":
                return <Chip size="sm" color="danger" variant="flat">ปฏิเสธ</Chip>;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        {isReadOnly ? "สถานะคำร้องแก้ไขคะแนน" : "อนุมัติการแก้ไขคะแนน"}
                    </h2>
                    <p className="text-sm text-default-500">
                        {isReadOnly
                            ? "ติดตามสถานะคำร้องขอแก้ไขคะแนนที่คุณส่ง"
                            : "ตรวจสอบและอนุมัติคำร้องขอแก้ไขคะแนนจาก TA"
                        }
                    </p>
                </div>
                {/* {isReadOnly && (
                    <Chip size="sm" color="secondary" variant="flat" className="text-xs">
                        <Icon icon="solar:eye-bold" className="mr-1" />
                        ดูได้อย่างเดียว
                    </Chip>
                )} */}
            </div>

            {/* Filter Tabs */}
            <Tabs
                selectedKey={filterStatus}
                onSelectionChange={(key) => setFilterStatus(key as FilterStatus)}
                variant="underlined"
                classNames={{
                    tabList: "gap-6",
                    cursor: "bg-blue-500",
                    tab: "px-0 h-10",
                    tabContent: "group-data-[selected=true]:text-blue-600 text-default-500 font-medium text-sm",
                }}
            >
                <Tab
                    key="pending"
                    title={
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:hourglass-bold" className="text-base" />
                            <span>รออนุมัติ</span>
                            {counts.pending > 0 && (
                                <Chip size="sm" color="warning" variant="flat" className="h-5 px-1.5 text-xs">
                                    {counts.pending}
                                </Chip>
                            )}
                        </div>
                    }
                />
                <Tab
                    key="approved"
                    title={
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:check-circle-bold" className="text-base" />
                            <span>อนุมัติแล้ว</span>
                            {counts.approved > 0 && (
                                <Chip size="sm" color="success" variant="flat" className="h-5 px-1.5 text-xs">
                                    {counts.approved}
                                </Chip>
                            )}
                        </div>
                    }
                />
                <Tab
                    key="rejected"
                    title={
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:close-circle-bold" className="text-base" />
                            <span>ปฏิเสธ</span>
                            {counts.rejected > 0 && (
                                <Chip size="sm" color="danger" variant="flat" className="h-5 px-1.5 text-xs">
                                    {counts.rejected}
                                </Chip>
                            )}
                        </div>
                    }
                />
            </Tabs>

            {/* Content */}
            {isLoading ? null : groupedRequests.length === 0 ? (
                <Card className="shadow-sm">
                    <CardBody className="py-16">
                        <div className="text-center">
                            <Icon
                                icon={filterStatus === "pending" ? "solar:inbox-linear" : "solar:clipboard-check-linear"}
                                className="mx-auto mb-3 text-5xl text-default-300"
                            />
                            <p className="text-default-500">
                                {filterStatus === "pending"
                                    ? "ไม่มีคำร้องรออนุมัติ"
                                    : filterStatus === "approved"
                                        ? "ยังไม่มีคำร้องที่อนุมัติ"
                                        : "ยังไม่มีคำร้องที่ปฏิเสธ"
                                }
                            </p>
                        </div>
                    </CardBody>
                </Card>
            ) : (
                <Accordion
                    variant="splitted"
                    selectionMode="multiple"
                    className="px-0 gap-3"
                    itemClasses={{
                        base: "rounded-xl border border-default-200 bg-content1 shadow-sm",
                        title: "font-medium text-default-700",
                        trigger: "rounded-xl px-4 py-3 data-[hover=true]:bg-content2",
                        content: "px-4 pb-4",
                    }}
                >
                    {groupedRequests.map((group) => {
                        const isGroup = group.requests.length > 1;
                        const firstRequest = group.requests[0];
                        
                        return (
                            <AccordionItem
                                key={group.key}
                                aria-label={`${group.assignment.name}`}
                                startContent={
                                    <div className="flex items-center gap-2">
                                        {getStatusChip(group.status)}
                                        {isGroup && (
                                            <Chip size="sm" color="secondary" variant="flat">
                                                <Icon icon="solar:users-group-rounded-bold" className="mr-1" />
                                                {group.requests.length} คน
                                            </Chip>
                                        )}
                                    </div>
                                }
                                title={
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                        {isGroup ? (
                                            <>
                                                <span className="font-medium text-foreground">งานกลุ่ม</span>
                                                <span className="text-sm text-default-500">
                                                    ({group.requests.map(r => r.student.full_name).join(", ")})
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="font-medium text-foreground">{firstRequest.student.full_name}</span>
                                                <span className="text-default-500">{firstRequest.student.student_id}</span>
                                            </>
                                        )}
                                    </div>
                                }
                                subtitle={
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className="text-default-600">{group.assignment.name}</span>
                                        {group.sub_item && (
                                            <span className="text-default-400">• {group.sub_item.name}</span>
                                        )}
                                        <span className="text-default-400">•</span>
                                        <span className="font-medium">
                                            <span className="text-default-500">{group.old_score ?? "-"}</span>
                                            <span className="mx-1 text-default-400">→</span>
                                            <span className="text-emerald-600">{group.new_score}</span>
                                            <span className="text-xs text-default-400">/{group.sub_item?.max_score ?? group.assignment.max_score}</span>
                                        </span>
                                        {group.images && group.images.length > 0 && (
                                            <>
                                                <span className="text-default-400">•</span>
                                                <span className="text-blue-500 text-xs flex items-center gap-1">
                                                    <Icon icon="solar:gallery-bold" />
                                                    {group.images.length} รูป
                                                </span>
                                            </>
                                        )}
                                    </div>
                                }
                            >
                                <div className="space-y-4">
                                    {/* Group Members List (for group batch requests) */}
                                    {isGroup && (
                                        <div className="overflow-hidden rounded-lg border border-default-200">
                                            <div className="flex items-center justify-between border-b border-divider bg-content2 px-3 py-2">
                                                <p className="flex items-center gap-1.5 text-xs font-semibold text-default-600">
                                                    <Icon icon="solar:users-group-two-rounded-bold" className="text-blue-500" />
                                                    สมาชิก ({group.requests.length} คน)
                                                </p>
                                                {group.status === "pending" && (
                                                    <span className="text-xs text-default-400">
                                                        รออนุมัติ {group.requests.filter(r => r.status === "pending").length} คน
                                                    </span>
                                                )}
                                            </div>
                                            <div className="divide-y divide-divider">
                                                {group.requests.map(req => (
                                                    <div key={req.id} className={`flex items-center justify-between px-3 py-2.5 ${
                                                        req.status === "approved" ? "bg-emerald-50/40" :
                                                        req.status === "rejected" ? "bg-red-50/40" : "bg-content1"
                                                    }`}>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                                                                req.status === "approved" ? "bg-emerald-100" :
                                                                req.status === "rejected" ? "bg-red-100" : "bg-blue-100"
                                                            }`}>
                                                                <Icon icon="solar:user-bold" className={`text-sm ${
                                                                    req.status === "approved" ? "text-emerald-600" :
                                                                    req.status === "rejected" ? "text-red-500" : "text-blue-600"
                                                                }`} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-foreground">{req.student.full_name}</p>
                                                                <p className="text-xs text-default-400">{req.student.student_id}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="hidden text-sm text-default-500 sm:inline">
                                                                <span className="text-default-400">{req.old_score ?? "-"}</span>
                                                                <span className="mx-1 text-default-300">→</span>
                                                                <span className="text-emerald-600 font-semibold">{req.new_score}</span>
                                                            </span>
                                                            {req.status === "approved" && (
                                                                <Chip size="sm" color="success" variant="flat" className="text-xs shrink-0" startContent={<Icon icon="solar:check-circle-bold" className="mr-0.5 text-xs" />}>อนุมัติแล้ว</Chip>
                                                            )}
                                                            {req.status === "rejected" && (
                                                                <Chip size="sm" color="danger" variant="flat" className="text-xs shrink-0" startContent={<Icon icon="solar:close-circle-bold" className="mr-0.5 text-xs" />}>ปฏิเสธ</Chip>
                                                            )}
                                                            {req.status === "pending" && (
                                                                <Chip size="sm" color="warning" variant="flat" className="text-xs shrink-0" startContent={<Icon icon="solar:hourglass-bold" className="mr-0.5 text-xs" />}>รออนุมัติ</Chip>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Score Change Details */}
                                    <div className="flex items-center gap-4 rounded-lg bg-content2 p-3">
                                        {!isGroup && (
                                            <>
                                                <div className="text-center flex-1">
                                                    <p className="mb-1 text-xs text-default-500">คะแนนเดิม</p>
                                                    <p className="text-2xl font-bold text-default-600">
                                                        {group.old_score ?? "-"}
                                                    </p>
                                                </div>
                                                <Icon icon="solar:arrow-right-linear" className="text-2xl text-default-300" />
                                            </>
                                        )}
                                        <div className="text-center flex-1">
                                            <p className="mb-1 text-xs text-default-500">คะแนนใหม่</p>
                                            <p className="text-2xl font-bold text-emerald-600">
                                                {group.new_score}
                                            </p>
                                        </div>
                                        <div className={`flex-1 border-l border-divider pl-4 text-center ${isGroup ? "" : ""}`}>
                                            <p className="mb-1 text-xs text-default-500">คะแนนเต็ม</p>
                                            <p className="text-2xl font-medium text-default-400">
                                                {group.sub_item?.max_score ?? group.assignment.max_score}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Reason */}
                                    {group.reason && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700/45 dark:bg-amber-950/35">
                                            <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                                                <Icon icon="solar:chat-round-line-bold" className="inline mr-1" />
                                                เหตุผลการแก้ไข
                                            </p>
                                            <p className="text-sm text-amber-950 dark:text-amber-50">{group.reason}</p>
                                        </div>
                                    )}

                                    {/* Attached Images */}
                                    {group.images && group.images.length > 0 && (
                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                            <p className="text-xs text-blue-600 font-medium mb-2">
                                                <Icon icon="solar:gallery-bold" className="inline mr-1" />
                                                รูปภาพประกอบ ({group.images.length} รูป)
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {group.images.map((imagePath, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setPreviewImage(getImageUrl(imagePath))}
                                                        className="relative group cursor-pointer"
                                                    >
                                                        <img
                                                            src={getImageUrl(imagePath)}
                                                            alt={`รูปภาพ ${idx + 1}`}
                                                            className="w-20 h-20 object-cover rounded-lg border border-blue-200 hover:border-blue-400 transition-colors"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = 'none';
                                                                target.parentElement!.innerHTML = '<div class="w-20 h-20 rounded-lg border border-red-200 bg-red-50 flex items-center justify-center text-red-400 text-xs text-center p-1">ไม่พบรูป</div>';
                                                            }}
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                                            <Icon icon="solar:eye-bold" className="text-white opacity-0 group-hover:opacity-100 text-xl" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Review Comment (for approved/rejected) */}
                                    {!isGroup && firstRequest.review_comment && firstRequest.status !== "pending" && (
                                        <div className={`p-3 rounded-lg border ${firstRequest.status === "approved"
                                            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/35 dark:border-emerald-700/45"
                                            : "bg-red-50 border-red-200 dark:bg-red-950/35 dark:border-red-700/45"
                                            }`}>
                                            <p className={`text-xs font-medium mb-1 ${firstRequest.status === "approved" ? "text-emerald-600" : "text-red-600"
                                                }`}>
                                                <Icon icon={firstRequest.status === "approved" ? "solar:check-circle-bold" : "solar:close-circle-bold"} className="inline mr-1" />
                                                {firstRequest.status === "approved" ? "หมายเหตุการอนุมัติ" : "เหตุผลการปฏิเสธ"}
                                            </p>
                                            <p className={`text-sm ${firstRequest.status === "approved" ? "text-emerald-950 dark:text-emerald-50" : "text-red-950 dark:text-red-50"}`}>{firstRequest.review_comment}</p>
                                        </div>
                                    )}
                                    {isGroup && group.requests.some(r => r.review_comment && r.status !== "pending") && (
                                        <div className="space-y-2">
                                            {group.requests.filter(r => r.review_comment && r.status !== "pending").map(req => (
                                                <div key={req.id} className={`p-3 rounded-lg border ${req.status === "approved"
                                                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/35 dark:border-emerald-700/45"
                                                    : "bg-red-50 border-red-200 dark:bg-red-950/35 dark:border-red-700/45"
                                                }`}>
                                                    <p className={`text-xs font-medium mb-1 ${req.status === "approved" ? "text-emerald-600" : "text-red-600"}`}>
                                                        <Icon icon={req.status === "approved" ? "solar:check-circle-bold" : "solar:close-circle-bold"} className="inline mr-1" />
                                                        {req.student.full_name} — {req.status === "approved" ? "หมายเหตุการอนุมัติ" : "เหตุผลการปฏิเสธ"}
                                                    </p>
                                                    <p className={`text-sm ${req.status === "approved" ? "text-emerald-950 dark:text-emerald-50" : "text-red-950 dark:text-red-50"}`}>{req.review_comment}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Meta Info & Actions */}
                                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-divider pt-2">
                                        <div className="flex flex-wrap gap-4 text-xs text-default-500">
                                            <div className="flex items-center gap-1">
                                                <Icon icon="solar:user-linear" />
                                                <span>ร้องขอโดย: {group.requester.full_name}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Icon icon="solar:calendar-linear" />
                                                <span>{formatDate(group.created_at)}</span>
                                            </div>
                                            {firstRequest.reviewer && firstRequest.reviewed_at && (
                                                <div className="flex items-center gap-1">
                                                    <Icon icon="solar:check-read-linear" />
                                                    <span className="mr-2">
                                                        {firstRequest.status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}โดย: {firstRequest.reviewer.full_name}
                                                    </span>
                                                    <Icon icon="solar:calendar-linear" />
                                                    <span> {formatDate(firstRequest.reviewed_at)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions (only for pending, instructor only) */}
                                        {group.status === "pending" && !isReadOnly && (
                                            <div className="flex gap-2">
                                                <Button
                                                    color="success"
                                                    variant="flat"
                                                    size="sm"
                                                    startContent={<Icon icon="solar:check-circle-bold" />}
                                                    onPress={() => isGroup 
                                                        ? openGroupActionModal("approve", group)
                                                        : openSingleActionModal("approve", firstRequest)
                                                    }
                                                >
                                                    {isGroup ? `อนุมัติ (${group.requests.length} คน)` : "อนุมัติ"}
                                                </Button>
                                                <Button
                                                    color="danger"
                                                    variant="flat"
                                                    size="sm"
                                                    startContent={<Icon icon="solar:close-circle-bold" />}
                                                    onPress={() => isGroup 
                                                        ? openGroupActionModal("reject", group)
                                                        : openSingleActionModal("reject", firstRequest)
                                                    }
                                                >
                                                    {isGroup ? `ปฏิเสธ (${group.requests.length} คน)` : "ปฏิเสธ"}
                                                </Button>
                                            </div>
                                        )}

                                        {group.status === "pending" && isReadOnly && (
                                            <>
                                                {isGroup ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {group.requests.filter(r => r.status === "pending").map(req => (
                                                            <Button
                                                                key={req.id}
                                                                color="warning"
                                                                variant="flat"
                                                                size="sm"
                                                                startContent={<Icon icon="solar:close-square-bold" />}
                                                                isLoading={cancellingRequestId === req.id}
                                                                onPress={() => setCancelModalRequest(req)}
                                                            >
                                                                ยกเลิก ({req.student.full_name})
                                                            </Button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <Button
                                                        color="warning"
                                                        variant="flat"
                                                        size="sm"
                                                        startContent={<Icon icon="solar:close-square-bold" />}
                                                        isLoading={cancellingRequestId === firstRequest.id}
                                                        onPress={() => setCancelModalRequest(firstRequest)}
                                                    >
                                                        ยกเลิกคำร้อง
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            )}

            {/* Action Modal */}
            <Modal
                isOpen={actionModal.isOpen}
                onClose={() => {
                    setActionModal({ isOpen: false, type: "approve", request: null, group: null, selectedIds: [] });
                    setActionComment("");
                }}
                size="lg"
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${actionModal.type === "approve" ? "bg-emerald-100" : "bg-red-100"}`}>
                            <Icon
                                icon={actionModal.type === "approve" ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                                className={`text-xl ${actionModal.type === "approve" ? "text-emerald-600" : "text-red-600"}`}
                            />
                        </div>
                        <span>{actionModal.type === "approve" ? "อนุมัติการแก้ไขคะแนน" : "ปฏิเสธการแก้ไขคะแนน"}</span>
                    </ModalHeader>
                    <Divider />
                    <ModalBody className="py-4">
                        {/* Single Request */}
                        {actionModal.request && !actionModal.group && (
                            <div className="space-y-4">
                                {/* Request Summary */}
                                <div className="space-y-2 rounded-lg bg-content2 p-3">
                                    <p className="text-sm">
                                        <span className="text-default-500">งาน:</span>{" "}
                                        <span className="font-medium">{actionModal.request.assignment.name}</span>
                                        {actionModal.request.sub_item && (
                                            <span className="text-default-500"> - {actionModal.request.sub_item.name}</span>
                                        )}
                                    </p>
                                    <p className="text-sm">
                                        <span className="text-default-500">นักศึกษา:</span>{" "}
                                        <span className="font-medium">{actionModal.request.student.student_id} - {actionModal.request.student.full_name}</span>
                                    </p>
                                    <p className="text-sm">
                                        <span className="text-default-500">คะแนน:</span>{" "}
                                        <span className="text-default-600">{actionModal.request.old_score ?? "-"}</span>
                                        <span className="mx-2">→</span>
                                        <span className="font-bold text-emerald-600">{actionModal.request.new_score}</span>
                                        <span className="text-default-400"> / {actionModal.request.sub_item?.max_score ?? actionModal.request.assignment.max_score}</span>
                                    </p>
                                </div>

                                {/* Comment Input */}
                                <Textarea
                                    label={actionModal.type === "approve" ? "หมายเหตุ (ไม่บังคับ)" : "เหตุผลการปฏิเสธ *"}
                                    placeholder={actionModal.type === "approve"
                                        ? "ระบุหมายเหตุเพิ่มเติม (ถ้ามี)..."
                                        : "กรุณาระบุเหตุผลในการปฏิเสธ..."
                                    }
                                    value={actionComment}
                                    onValueChange={setActionComment}
                                    variant="bordered"
                                    minRows={3}
                                    isRequired={actionModal.type === "reject"}
                                />
                            </div>
                        )}

                        {/* Group Request */}
                        {actionModal.group && (
                            <div className="space-y-4">
                                {/* Group Summary */}
                                <div className="space-y-2 rounded-lg bg-content2 p-3">
                                    <p className="text-sm">
                                        <span className="text-default-500">งาน:</span>{" "}
                                        <span className="font-medium">{actionModal.group.assignment.name}</span>
                                        {actionModal.group.sub_item && (
                                            <span className="text-default-500"> - {actionModal.group.sub_item.name}</span>
                                        )}
                                    </p>
                                    <p className="text-sm">
                                        <span className="text-default-500">คะแนน:</span>{" "}
                                        <span className="text-default-600">{actionModal.group.old_score ?? "-"}</span>
                                        <span className="mx-2">→</span>
                                        <span className="font-bold text-emerald-600">{actionModal.group.new_score}</span>
                                        <span className="text-default-400"> / {actionModal.group.sub_item?.max_score ?? actionModal.group.assignment.max_score}</span>
                                    </p>
                                </div>

                                {/* Member Selection */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="flex items-center gap-1.5 text-sm font-medium text-default-700">
                                            <Icon icon="solar:users-group-two-rounded-bold" className="text-blue-500" />
                                            เลือกสมาชิกที่ต้องการ{actionModal.type === "approve" ? "อนุมัติ" : "ปฏิเสธ"}
                                        </p>
                                        <div className="flex gap-1">
                                            <Button
                                                size="sm"
                                                variant="flat"
                                                color="primary"
                                                onPress={() => toggleAllSelection(true)}
                                                className="text-xs h-7 px-2"
                                            >
                                                เลือกทั้งหมด
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="flat"
                                                color="default"
                                                onPress={() => toggleAllSelection(false)}
                                                className="text-xs h-7 px-2"
                                            >
                                                ยกเลิกทั้งหมด
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto rounded-lg border border-default-200 bg-content1 divide-y divide-divider">
                                        {actionModal.group.requests
                                            .filter(r => r.status === "pending")
                                            .map(req => (
                                                <div
                                                    key={req.id}
                                                    className={`flex items-center justify-between p-3 cursor-pointer transition-all ${
                                                        actionModal.selectedIds.includes(req.id)
                                                            ? 'bg-blue-50/70'
                                                            : 'hover:bg-content2'
                                                    }`}
                                                    onClick={() => toggleRequestSelection(req.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                                            actionModal.selectedIds.includes(req.id)
                                                                ? 'bg-blue-500 border-blue-500 shadow-sm'
                                                                : 'border-default-300 bg-content1 hover:border-blue-300'
                                                        }`}>
                                                            {actionModal.selectedIds.includes(req.id) && (
                                                                <Icon icon="solar:check-bold" className="text-white text-xs" />
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                                                                actionModal.selectedIds.includes(req.id)
                                                                    ? 'bg-blue-100 text-blue-600'
                                                                    : 'bg-content3 text-default-600'
                                                            }`}>
                                                                <Icon icon="solar:user-bold" className="text-sm" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-default-700">
                                                                    {req.student.full_name}
                                                                </p>
                                                                <p className="text-xs text-default-500">
                                                                    {req.student.student_id}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm">
                                                            <span className="text-default-500">{req.old_score ?? "-"}</span>
                                                            <span className="mx-1 text-default-400">→</span>
                                                            <span className="text-emerald-600 font-semibold">{req.new_score}</span>
                                                        </div>
                                                        {actionModal.selectedIds.includes(req.id) && (
                                                            <Chip size="sm" color="primary" variant="flat" className="text-xs" startContent={<Icon icon="solar:check-circle-bold" className="mr-1 text-xs" />}>
                                                                เลือกแล้ว
                                                            </Chip>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <p className="flex items-center gap-1 text-default-500">
                                            <Icon icon="solar:user-check-bold" className="text-blue-500" />
                                            เลือกแล้ว {actionModal.selectedIds.length} / {actionModal.group.requests.filter(r => r.status === "pending").length} คน
                                        </p>
                                        {actionModal.selectedIds.length === 0 && (
                                            <p className="text-amber-600 flex items-center gap-1">
                                                <Icon icon="solar:danger-triangle-bold" />
                                                กรุณาเลือกอย่างน้อย 1 คน
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Comment Input */}
                                <Textarea
                                    label={actionModal.type === "approve" ? "หมายเหตุ (ไม่บังคับ)" : "เหตุผลการปฏิเสธ *"}
                                    placeholder={actionModal.type === "approve"
                                        ? "ระบุหมายเหตุเพิ่มเติม (ถ้ามี)..."
                                        : "กรุณาระบุเหตุผลในการปฏิเสธ..."
                                    }
                                    value={actionComment}
                                    onValueChange={setActionComment}
                                    variant="bordered"
                                    minRows={3}
                                    isRequired={actionModal.type === "reject"}
                                />
                            </div>
                        )}
                    </ModalBody>
                    <Divider />
                    <ModalFooter>
                        <Button
                            variant="light"
                            onPress={() => {
                                setActionModal({ isOpen: false, type: "approve", request: null, group: null, selectedIds: [] });
                                setActionComment("");
                            }}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color={actionModal.type === "approve" ? "success" : "danger"}
                            isLoading={isSubmitting}
                            isDisabled={actionModal.group ? actionModal.selectedIds.length === 0 : false}
                            onPress={actionModal.type === "approve" ? handleApprove : handleReject}
                        >
                            {actionModal.type === "approve" ? "อนุมัติ" : "ปฏิเสธ"}
                            {actionModal.group && actionModal.selectedIds.length > 0 && ` (${actionModal.selectedIds.length} คน)`}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Cancel Request Confirmation Modal */}
            <Modal
                isOpen={!!cancelModalRequest}
                onClose={() => {
                    if (cancellingRequestId !== null) {
                        return;
                    }
                    setCancelModalRequest(null);
                }}
                size="lg"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                <Icon icon="solar:danger-triangle-bold" className="text-xl text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">ยืนยันการยกเลิกคำร้อง</h3>
                                <p className="text-sm text-default-500">กรุณาตรวจสอบข้อมูลก่อนยืนยัน</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <Divider />
                    <ModalBody className="py-4">
                        {cancelModalRequest && (
                            <div className="space-y-3">
                                <Card className="border border-default-200 bg-content2/80 shadow-none">
                                    <CardBody className="py-3 px-4 space-y-2">
                                        <p className="text-sm">
                                            <span className="text-default-500">งาน:</span>{" "}
                                            <span className="font-medium text-foreground">{cancelModalRequest.assignment.name}</span>
                                            {cancelModalRequest.sub_item && (
                                                <span className="text-default-500"> - {cancelModalRequest.sub_item.name}</span>
                                            )}
                                        </p>
                                        <p className="text-sm">
                                            <span className="text-default-500">นักศึกษา:</span>{" "}
                                            <span className="font-medium text-foreground">
                                                {cancelModalRequest.student.student_id} - {cancelModalRequest.student.full_name}
                                            </span>
                                        </p>
                                        <p className="text-sm">
                                            <span className="text-default-500">คะแนน:</span>{" "}
                                            <span className="text-default-600">{cancelModalRequest.old_score ?? "-"}</span>
                                            <span className="mx-2 text-default-400">→</span>
                                            <span className="font-semibold text-emerald-600">{cancelModalRequest.new_score}</span>
                                            <span className="text-default-400"> / {cancelModalRequest.sub_item?.max_score ?? cancelModalRequest.assignment.max_score}</span>
                                        </p>
                                    </CardBody>
                                </Card>

                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                                    <div className="flex items-start gap-3">
                                        <Icon icon="solar:info-circle-bold" className="text-xl text-amber-600 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-amber-800">ต้องการยกเลิกคำร้องนี้ใช่หรือไม่?</p>
                                            <p className="text-sm text-amber-700 mt-1">
                                                หลังยกเลิกแล้ว คำร้องนี้จะหายจากรายการรออนุมัติ และสามารถส่งคำร้องใหม่ได้อีกครั้ง
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <Divider />
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button
                            variant="light"
                            onPress={() => setCancelModalRequest(null)}
                            isDisabled={cancellingRequestId !== null}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="warning"
                            onPress={confirmCancelRequest}
                            isLoading={cancellingRequestId !== null}
                            startContent={<Icon icon="solar:close-square-bold" />}
                        >
                            ยืนยันยกเลิกคำร้อง
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Image Preview Modal */}
            <Modal
                isOpen={!!previewImage}
                onClose={() => setPreviewImage(null)}
                size="4xl"
                classNames={{
                    backdrop: "bg-black/80",
                    base: "bg-transparent shadow-none",
                }}
            >
                <ModalContent>
                    {previewImage && (
                        <div className="relative">
                            <img
                                src={previewImage}
                                alt="Preview"
                                className="max-w-full max-h-[80vh] object-contain mx-auto rounded-lg"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.insertAdjacentHTML('afterend', '<div class="text-white text-center py-20"><p class="text-xl">ไม่สามารถโหลดรูปภาพได้</p><p class="text-sm mt-2 text-white/60">ไฟล์รูปภาพอาจถูกลบหรือไม่พบบนเซิร์ฟเวอร์</p></div>');
                                }}
                            />
                            <Button
                                isIconOnly
                                variant="flat"
                                className="absolute top-2 right-2 bg-black/50 text-white"
                                onPress={() => setPreviewImage(null)}
                            >
                                <Icon icon="solar:close-circle-bold" className="text-xl" />
                            </Button>
                        </div>
                        
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
