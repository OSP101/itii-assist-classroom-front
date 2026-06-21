"use client";

import { memo } from "react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Tooltip } from "@heroui/tooltip";
import { Tabs, Tab } from "@heroui/tabs";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { AssignmentsSkeleton } from "../Skeletons";
import type { AssignmentType } from "../types";
import type { AssignmentTabType, ViewMode } from "./config";
import { getTypeInfo, getTypeBgColor, getTypeTextColor } from "./config";
import { AssignmentModal } from "./AssignmentModal";
import assignmentService from "@/services/assignment.service";
import type { UngradedSummary } from "@/services/score.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";

function formatCount(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

function formatPoints(points: number, isEnglish: boolean): string {
    return isEnglish ? formatCount(points, "point", "points") : `${points} คะแนน`;
}

function formatShortDateTime(value: Date, isEnglish: boolean): string {
    const locale = isEnglish ? "en-US" : "th-TH";
    return `${value.toLocaleDateString(locale, { day: "numeric", month: "short" })} ${value.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
}

function getDeleteGradient(type: string): string {
    switch (type) {
        case "individual":
            return "bg-linear-to-br from-indigo-500 to-blue-600";
        case "assignment":
            return "bg-linear-to-br from-amber-500 to-orange-600";
        case "permanent_group":
            return "bg-linear-to-br from-purple-500 to-indigo-600";
        case "weekly_group":
            return "bg-linear-to-br from-emerald-500 to-teal-600";
        default:
            return "bg-linear-to-br from-blue-500 to-indigo-600";
    }
}

interface AssignmentsTabViewProps {
    // Data
    assignments: AssignmentType[];
    isLoading: boolean;
    courseId: string;
    weeklyTeams?: Record<number, any[]>;
    // State from hook
    searchQuery: string;
    activeTab: AssignmentTabType;
    viewMode: ViewMode;
    isDeleteModalOpen: boolean;
    deleteTarget: AssignmentType | null;
    isDeleting: boolean;
    // Create/Edit modal state
    isAssignmentModalOpen: boolean;
    editingAssignment: AssignmentType | null;
    // Computed from hook
    labAssignments: AssignmentType[];
    homeworkAssignments: AssignmentType[];
    groupAssignments: AssignmentType[];
    currentAssignments: AssignmentType[];
    // Drag reorder
    draggingId: number | null;
    dragOverId: number | null;
    onDragStart: (id: number) => void;
    onDragOver: (id: number) => void;
    onDrop: (id: number) => Promise<void>;
    onDragEnd: () => void;
    // Actions from hook
    onSetSearchQuery: (query: string) => void;
    onSetActiveTab: (tab: AssignmentTabType) => void;
    onSetViewMode: (mode: ViewMode) => void;
    onCloseDeleteModal: () => void;
    onConfirmDelete: () => Promise<void>;
    onDeleteAssignment: (assignment: AssignmentType) => void;
    onClearSearch: () => void;
    // Create/Edit modal actions
    onOpenCreateModal: () => void;
    onOpenEditModal: (assignment: AssignmentType) => void;
    onCloseAssignmentModal: () => void;
    onAssignmentSaved: () => void;
    // Score modal actions
    onOpenScoreModal: (assignment: AssignmentType) => void;
    onOpenBonusScoreModal?: () => void;
    isCourseActive?: boolean;
    ungradedSummary?: UngradedSummary;
    hasPendingUpdate?: boolean;
    onPendingUpdateAck?: () => void;
    canCreateAssignments?: boolean;
    canUpdateAssignments?: boolean;
    canDeleteAssignments?: boolean;
    canGradeAssignments?: boolean;
    canEditScores?: boolean;
}

function AssignmentsTabViewComponent({
    assignments,
    isLoading,
    courseId,
    weeklyTeams = {},
    searchQuery,
    activeTab,
    viewMode,
    isDeleteModalOpen,
    deleteTarget,
    isDeleting,
    isAssignmentModalOpen,
    editingAssignment,
    labAssignments,
    homeworkAssignments,
    groupAssignments,
    currentAssignments,
    draggingId,
    dragOverId,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onSetSearchQuery,
    onSetActiveTab,
    onSetViewMode,
    onCloseDeleteModal,
    onConfirmDelete,
    onDeleteAssignment,
    onClearSearch,
    onOpenCreateModal,
    onOpenEditModal,
    onCloseAssignmentModal,
    onAssignmentSaved,
    onOpenScoreModal,
    onOpenBonusScoreModal,
    isCourseActive = true,
    ungradedSummary = {},
    hasPendingUpdate,
    onPendingUpdateAck,
    canCreateAssignments = false,
    canUpdateAssignments = false,
    canDeleteAssignments = false,
    canGradeAssignments = false,
    canEditScores = false,
}: AssignmentsTabViewProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const deleteTypeInfo = deleteTarget ? getTypeInfo(deleteTarget.assignment_type, isEnglish) : null;
    const canReorderAssignments = canUpdateAssignments && isCourseActive;

    const getUngradedTooltipContent = (assignment: AssignmentType) => {
        const info = ungradedSummary[assignment.id];
        if (!info || info.ungraded_count === 0) {
            return null;
        }

        const previewStudents = info.students.slice(0, 3);

        return (
            <div className="max-w-xs px-1 py-0.5">
                <p className="mb-1 font-medium">
                    {isEnglish
                        ? `${info.ungraded_count}/${info.total_students} students ungraded`
                        : `ยังไม่มีคะแนน ${info.ungraded_count}/${info.total_students} คน`}
                </p>
                <div className="space-y-1">
                    {previewStudents.map((student) => (
                        <p key={student.student_id} className="text-xs leading-5">
                            {student.student_id} - {student.full_name}
                        </p>
                    ))}
                </div>
                {info.ungraded_count > previewStudents.length && (
                    <p className="mt-1 text-xs text-default-300">
                        {isEnglish
                            ? `and ${formatCount(info.ungraded_count - previewStudents.length, "more student", "more students")}...`
                            : `และอีก ${info.ungraded_count - previewStudents.length} คน...`}
                    </p>
                )}
            </div>
        );
    };

    const renderUngradedInfo = (assignment: AssignmentType) => {
        const info = ungradedSummary[assignment.id];
        if (!info || info.ungraded_count === 0) {
            return null;
        }

        return (
            <div className="mt-2 border-t border-divider pt-2">
                <Tooltip content={getUngradedTooltipContent(assignment)}>
                    <div className="inline-flex cursor-help items-center gap-1.5 text-xs text-orange-600">
                        <Icon icon="solar:user-cross-rounded-bold" className="text-sm" />
                        <span className="font-medium">
                            {isEnglish
                                ? `${info.ungraded_count}/${info.total_students} students ungraded`
                                : `ยังไม่มีคะแนน ${info.ungraded_count}/${info.total_students} คน`}
                        </span>
                        <Icon icon="solar:info-circle-linear" className="text-sm text-orange-500" />
                    </div>
                </Tooltip>
            </div>
        );
    };

    const renderStatusBadge = (assignment: AssignmentType) => {
        if (!assignment.is_draft) {
            return (
                <Chip
                    size="sm"
                    variant="flat"
                    className="bg-emerald-50 text-emerald-700 gap-1 border border-emerald-200"
                    startContent={<Icon icon="solar:check-circle-bold" width={13} />}
                >
                    {isEnglish ? "Published" : "เผยแพร่แล้ว"}
                </Chip>
            );
        }

        const publishAt = assignment.publish_at ? new Date(assignment.publish_at) : null;
        const isScheduled = publishAt && publishAt > new Date();
        return (
            <Chip
                size="sm"
                variant="flat"
                className="bg-yellow-100 text-yellow-700 gap-1 border border-yellow-200"
                startContent={<Icon icon={isScheduled ? "solar:calendar-date-bold" : "solar:pen-new-square-bold"} width={13} />}
            >
                {isScheduled
                    ? (isEnglish ? `Publishes ${formatShortDateTime(publishAt, true)}` : `เผยแพร่ ${formatShortDateTime(publishAt, false)}`)
                    : (isEnglish ? "Draft" : "ฉบับร่าง")}
            </Chip>
        );
    };

    // Render grid card view
    const renderGridCard = (assignment: AssignmentType) => {
        const typeInfo = getTypeInfo(assignment.assignment_type, isEnglish);
        const isDragging = draggingId === assignment.id;
        const isDragOver = dragOverId === assignment.id;
        const canOpenScoreModal = !assignment.is_draft && (canGradeAssignments || canEditScores);
        return (
            <Card
                key={assignment.id}
                as="div"
                isPressable={canOpenScoreModal}
                className={`border shadow-sm transition-all ${isDragging ? "opacity-40 scale-95" : ""} ${isDragOver ? "border-blue-400 border-2 shadow-lg" : "border-default-200 hover:shadow-md"} ${assignment.is_draft ? "bg-yellow-50/70 opacity-80" : "bg-content1"}`}
                onPress={() => canOpenScoreModal && onOpenScoreModal(assignment)}
                draggable={canReorderAssignments}
                onDragStart={canReorderAssignments ? () => onDragStart(assignment.id) : undefined}
                onDragOver={canReorderAssignments ? (e) => { e.preventDefault(); onDragOver(assignment.id); } : undefined}
                onDrop={canReorderAssignments ? (e) => { e.preventDefault(); onDrop(assignment.id); } : undefined}
                onDragEnd={canReorderAssignments ? onDragEnd : undefined}
            >
                <CardBody className="p-4">
                    {/* Header with Actions */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                            {canReorderAssignments && (
                                <div className="cursor-grab text-default-300 transition-colors hover:text-default-500 active:cursor-grabbing" title={isEnglish ? "Drag to reorder" : "ลากเพื่อจัดเรียง"}>
                                    <Icon icon="solar:reorder-bold" className="text-lg" />
                                </div>
                            )}
                            <div className={`p-2 rounded-lg ${getTypeBgColor(assignment.assignment_type)}`}>
                                <Icon icon={typeInfo.icon} className={`text-xl ${getTypeTextColor(assignment.assignment_type)}`} />
                            </div>
                        </div>
                        {(canUpdateAssignments || canDeleteAssignments) && (
                            <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                                {canUpdateAssignments && (
                                    <Tooltip content={isEnglish ? "Edit" : "แก้ไข"}>
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            variant="light"
                                            color="default"
                                            isDisabled={!isCourseActive}
                                            aria-label={isEnglish ? "Edit assignment" : "แก้ไขงาน"}
                                            onPress={() => onOpenEditModal(assignment)}
                                        >
                                            <Icon icon="solar:pen-linear" />
                                        </Button>
                                    </Tooltip>
                                )}
                                {canDeleteAssignments && (
                                    <Tooltip content={isEnglish ? "Delete" : "ลบ"} color="danger">
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            variant="light"
                                            color="danger"
                                            isDisabled={!isCourseActive}
                                            aria-label={isEnglish ? "Delete assignment" : "ลบงาน"}
                                            onPress={() => onDeleteAssignment(assignment)}
                                        >
                                            <Icon icon="solar:trash-bin-trash-linear" />
                                        </Button>
                                    </Tooltip>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    <p className={`mb-2 line-clamp-2 font-semibold ${assignment.is_draft ? "text-default-500" : "text-foreground"}`}>{assignment.name}</p>

                    {/* Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        <Chip size="sm" className={typeInfo.color}>{typeInfo.label}</Chip>
                        {assignment.week_number && (
                            <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">W{assignment.week_number}</Chip>
                        )}
                        {assignment.subItems && assignment.subItems.length > 0 && (
                            <Chip size="sm" variant="flat" className="bg-content3 text-default-600">
                                {isEnglish
                                    ? formatCount(assignment.subItems.length, "item", "items")
                                    : `${assignment.subItems.length} ข้อย่อย`}
                            </Chip>
                        )}
                        {assignment.is_score_visible === false && (
                            <Tooltip content={isEnglish ? "Scores are not shown to students" : "ไม่แสดงคะแนนให้นักศึกษารู้"}>
                                <Chip size="sm" variant="flat" className="bg-amber-50 text-amber-600 gap-1" startContent={<Icon icon="solar:eye-closed-linear" width={14} />}>
                                    {isEnglish ? "No student score" : "ไม่แสดงคะแนน"}
                                </Chip>
                            </Tooltip>
                        )}
                        {renderStatusBadge(assignment)}
                    </div>

                    {/* Footer Info */}
                    <div className="flex items-center justify-between border-t border-divider pt-2 text-sm text-default-500">
                        <span className={`flex items-center gap-1 ${assignment.is_draft ? "text-default-400" : ""}`}>
                            <Icon icon="solar:medal-star-bold" className="text-amber-500" />
                            <span className="font-medium text-default-700">{assignment.max_score}</span> {isEnglish ? (Number(assignment.max_score) === 1 ? "point" : "points") : "คะแนน"}
                        </span>
                        {assignment.is_draft && canUpdateAssignments && (
                            <Tooltip content={isEnglish ? "Publish now" : "เผยแพร่ทันที"}>
                                <Button
                                    size="sm"
                                    color="success"
                                    variant="flat"
                                    isDisabled={!isCourseActive}
                                    onPress={async () => {
                                        await assignmentService.publishAssignment(assignment.id);
                                        onAssignmentSaved();
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-7 px-2 text-xs"
                                >
                                    {isEnglish ? "Publish" : "เผยแพร่"}
                                </Button>
                            </Tooltip>
                        )}
                        {false && !assignment.is_draft && canUpdateAssignments && (
                            <Tooltip content={isEnglish ? "Move back to draft" : "ย้ายกลับเป็นร่าง"}>
                                <Button
                                    size="sm"
                                    color="warning"
                                    variant="flat"
                                    isDisabled={!isCourseActive}
                                    onPress={async () => {
                                        await assignmentService.unpublishAssignment(assignment.id);
                                        onAssignmentSaved();
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-7 px-2 text-xs"
                                >
                                    {isEnglish ? "Unpublish" : "ย้ายเป็นร่าง"}
                                </Button>
                            </Tooltip>
                        )}
                    </div>
                    {renderUngradedInfo(assignment)}
                </CardBody>
            </Card>
        );
    };

    // Render list row view
    const renderListRow = (assignment: AssignmentType) => {
        const typeInfo = getTypeInfo(assignment.assignment_type, isEnglish);
        const isDragging = draggingId === assignment.id;
        const isDragOver = dragOverId === assignment.id;
        const canOpenScoreModal = !assignment.is_draft && (canGradeAssignments || canEditScores);
        return (
            <div
                key={assignment.id}
                draggable={canReorderAssignments}
                onDragStart={canReorderAssignments ? () => onDragStart(assignment.id) : undefined}
                onDragOver={canReorderAssignments ? (e) => { e.preventDefault(); onDragOver(assignment.id); } : undefined}
                onDrop={canReorderAssignments ? (e) => { e.preventDefault(); onDrop(assignment.id); } : undefined}
                onDragEnd={canReorderAssignments ? onDragEnd : undefined}
                className={`transition-all ${isDragging ? "opacity-40" : ""} ${isDragOver ? "scale-[1.01]" : ""} ${assignment.is_draft ? "opacity-80" : ""}`}
            >
            <Card
                as="div"
                isPressable={canOpenScoreModal}
                className={`w-full border shadow-sm transition-all ${isDragOver ? "border-blue-400 border-2 shadow-md" : "border-default-200 hover:shadow-md"} ${assignment.is_draft ? "bg-yellow-50/70 opacity-80" : "bg-content1"}`}
                onPress={() => canOpenScoreModal && onOpenScoreModal(assignment)}
            >
                <CardBody className="p-3 sm:p-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                        {/* Drag Handle */}
                        {canReorderAssignments && (
                            <div className="shrink-0 cursor-grab text-default-300 transition-colors hover:text-default-500 active:cursor-grabbing" title={isEnglish ? "Drag to reorder" : "ลากเพื่อจัดเรียง"}>
                                <Icon icon="solar:reorder-bold" className="text-xl" />
                            </div>
                        )}

                        {/* Icon */}
                        <div className={`p-2 sm:p-2.5 rounded-lg shrink-0 ${getTypeBgColor(assignment.assignment_type)}`}>
                            <Icon icon={typeInfo.icon} className={`text-lg sm:text-xl ${getTypeTextColor(assignment.assignment_type)}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                <p className={`truncate font-semibold ${assignment.is_draft ? "text-default-500" : "text-foreground"}`}>{assignment.name}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <Chip size="sm" className={typeInfo.color}>{typeInfo.label}</Chip>
                                    {assignment.week_number && (
                                        <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">W{assignment.week_number}</Chip>
                                    )}
                                    {assignment.is_score_visible === false && (
                                        <Tooltip content={isEnglish ? "Scores are not shown to students" : "ไม่แสดงคะแนนให้นักศึกษารู้"}>
                                            <Chip size="sm" variant="flat" className="bg-amber-50 text-amber-600 gap-1" startContent={<Icon icon="solar:eye-closed-linear" width={14} />}>
                                                {isEnglish ? "No student score" : "ไม่แสดงคะแนน"}
                                            </Chip>
                                        </Tooltip>
                                    )}
                                    {renderStatusBadge(assignment)}
                                </div>
                            </div>
                            <div className={`mt-1 flex items-center gap-3 text-sm ${assignment.is_draft ? "text-default-400" : "text-default-500"}`}>
                                <span className="flex items-center gap-1">
                                    <Icon icon="solar:medal-star-linear" className="text-amber-500" />
                                    {formatPoints(assignment.max_score, isEnglish)}
                                </span>
                                {assignment.subItems && assignment.subItems.length > 0 && (
                                    <span className="hidden sm:flex items-center gap-1">
                                        <Icon icon="solar:list-bold" className="text-default-400" />
                                        {isEnglish
                                            ? formatCount(assignment.subItems.length, "item", "items")
                                            : `${assignment.subItems.length} ข้อย่อย`}
                                    </span>
                                )}
                                {ungradedSummary[assignment.id] && ungradedSummary[assignment.id].ungraded_count > 0 ? (
                                    <Tooltip content={getUngradedTooltipContent(assignment)}>
                                        <span className="flex items-center gap-1 cursor-help text-orange-500">
                                            <Icon icon="solar:user-cross-rounded-bold" className="text-sm" />
                                            <span className="text-xs font-medium">
                                                {isEnglish
                                                    ? formatCount(ungradedSummary[assignment.id].ungraded_count, "student ungraded", "students ungraded")
                                                    : `ยังไม่มีคะแนน ${ungradedSummary[assignment.id].ungraded_count} คน`}
                                            </span>
                                            <Icon icon="solar:info-circle-linear" className="text-sm" />
                                        </span>
                                    </Tooltip>
                                ) : null}
                            </div>
                        </div>

                        {/* Actions */}
                        {(canUpdateAssignments || canDeleteAssignments) && (
                            <div className="flex items-center gap-1 shrink-0" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                                {assignment.is_draft && canUpdateAssignments && (
                                    <Tooltip content={isEnglish ? "Publish now" : "เผยแพร่ทันที"}>
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            variant="flat"
                                            color="success"
                                            isDisabled={!isCourseActive}
                                            onPress={async () => {
                                                await assignmentService.publishAssignment(assignment.id);
                                                onAssignmentSaved();
                                            }}
                                        >
                                            <Icon icon="solar:eye-bold" className="text-lg" />
                                        </Button>
                                    </Tooltip>
                                )}
                                {false && !assignment.is_draft && canUpdateAssignments && (
                                    <Tooltip content={isEnglish ? "Move back to draft" : "ย้ายกลับเป็นร่าง"}>
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            variant="light"
                                            color="warning"
                                            isDisabled={!isCourseActive}
                                            onPress={async () => {
                                                await assignmentService.unpublishAssignment(assignment.id);
                                                onAssignmentSaved();
                                            }}
                                        >
                                            <Icon icon="solar:eye-closed-linear" className="text-lg" />
                                        </Button>
                                    </Tooltip>
                                )}
                                {canUpdateAssignments && (
                                    <Tooltip content={isEnglish ? "Edit" : "แก้ไข"}>
                                        <Button isIconOnly size="sm" variant="light" color="default" isDisabled={!isCourseActive} onPress={() => onOpenEditModal(assignment)}>
                                            <Icon icon="solar:pen-linear" className="text-lg" />
                                        </Button>
                                    </Tooltip>
                                )}
                                {canDeleteAssignments && (
                                    <Tooltip content={isEnglish ? "Delete" : "ลบ"} color="danger">
                                        <Button isIconOnly size="sm" variant="light" color="danger" isDisabled={!isCourseActive} onPress={() => onDeleteAssignment(assignment)}>
                                            <Icon icon="solar:trash-bin-trash-linear" className="text-lg" />
                                        </Button>
                                    </Tooltip>
                                )}
                            </div>
                        )}
                    </div>
                </CardBody>
            </Card>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{isEnglish ? "Classwork" : "งานในชั้นเรียน"}</h2>
                    <p className="text-sm text-default-500">{isEnglish ? "Create and manage grading items for this course." : "สร้างและจัดการหัวข้องานสำหรับการลงคะแนน"}</p>
                </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
                <AssignmentsSkeleton />
            ) : (
                <>
                    {/* Sub-tabs Navigation */}
                    <div className="overflow-x-auto scrollbar-hide -mx-4 px-3 lg:mx-0 lg:px-0">
                        <Tabs
                            selectedKey={activeTab}
                            onSelectionChange={(key) => onSetActiveTab(key as AssignmentTabType)}
                            variant="underlined"
                            classNames={{
                                tabList: "gap-4 md:gap-6 flex-nowrap min-w-max",
                                cursor: "bg-blue-500",
                                tab: "px-0 h-11 whitespace-nowrap",
                                tabContent: "group-data-[selected=true]:text-blue-600 text-default-500 font-medium text-sm"
                            }}
                        >
                            <Tab
                                key="lab"
                                title={
                                    <div className="flex items-center gap-2">
                                        <span>Laboratory</span>
                                        {labAssignments.length > 0 && (
                                            <Chip size="sm" variant="flat" className="bg-indigo-100 text-indigo-700 h-5 min-w-5 px-1">
                                                {labAssignments.length}
                                            </Chip>
                                        )}
                                    </div>
                                }
                            />
                            <Tab
                                key="assignment"
                                title={
                                    <div className="flex items-center gap-2">
                                        <span>Assignment</span>
                                        {homeworkAssignments.length > 0 && (
                                            <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-700 h-5 min-w-5 px-1">
                                                {homeworkAssignments.length}
                                            </Chip>
                                        )}
                                    </div>
                                }
                            />
                            <Tab
                                key="group"
                                title={
                                    <div className="flex items-center gap-2">
                                        <span className="hidden sm:inline">{isEnglish ? "Group work" : "งานกลุ่ม"}</span>
                                        <span className="sm:hidden">{isEnglish ? "Groups" : "กลุ่ม"}</span>
                                        {groupAssignments.length > 0 && (
                                            <Chip size="sm" variant="flat" className="bg-emerald-100 text-emerald-700 h-5 min-w-5 px-1">
                                                {groupAssignments.length}
                                            </Chip>
                                        )}
                                    </div>
                                }
                            />
                        </Tabs>
                    </div>

                    {/* Search & Actions Bar */}
                    <Card className="border border-default-200 shadow-sm">
                        <CardBody className="py-3 px-4">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <Input
                                        placeholder={isEnglish ? "Search assignments..." : "ค้นหาชื่องาน..."}
                                        value={searchQuery}
                                        onValueChange={onSetSearchQuery}
                                        startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400 text-lg sm:text-xl" />}
                                        className="w-full"
                                        size="md"
                                        variant="bordered"
                                        isClearable
                                        classNames={{
                                            inputWrapper: "bg-content1 border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-blue-400 text-sm",
                                        }}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* View Mode Toggle */}
                                    <div className="flex items-center overflow-hidden rounded-lg border border-default-200 bg-content1">
                                        <Tooltip content={isEnglish ? "Card view" : "แบบการ์ด"}>
                                            <Button
                                                isIconOnly
                                                size="md"
                                                variant="light"
                                                className={`rounded-none ${viewMode === "grid" ? "bg-content3" : ""}`}
                                                onPress={() => onSetViewMode("grid")}
                                            >
                                                <Icon icon="solar:widget-bold" className={`text-lg ${viewMode === "grid" ? "text-blue-600" : "text-default-400"}`} />
                                            </Button>
                                        </Tooltip>
                                        <div className="h-5 w-px bg-default-200" />
                                        <Tooltip content={isEnglish ? "List view" : "แบบรายการ"}>
                                            <Button
                                                isIconOnly
                                                size="md"
                                                variant="light"
                                                className={`rounded-none ${viewMode === "list" ? "bg-content3" : ""}`}
                                                onPress={() => onSetViewMode("list")}
                                            >
                                                <Icon icon="solar:list-bold" className={`text-lg ${viewMode === "list" ? "text-blue-600" : "text-default-400"}`} />
                                            </Button>
                                        </Tooltip>
                                    </div>

                                    {/* Bonus Score Button - Icon only on mobile */}
                                    {canGradeAssignments && onOpenBonusScoreModal && (
                                        <Tooltip content={isEnglish ? "Bonus score (Q&A)" : "ให้คะแนนพิเศษ (ถาม-ตอบ)"}>
                                            <Button
                                                color="warning"
                                                variant="flat"
                                                isIconOnly
                                                onPress={onOpenBonusScoreModal}
                                                className="sm:hidden"
                                                isDisabled={!isCourseActive}
                                            >
                                                <Icon icon="solar:star-bold" />
                                            </Button>
                                        </Tooltip>
                                    )}
                                    {/* Bonus Score Button - Full on desktop */}
                                    {canGradeAssignments && onOpenBonusScoreModal && (
                                        <Tooltip content={isEnglish ? "Bonus score (Q&A)" : "ให้คะแนนพิเศษ (ถาม-ตอบ)"}>
                                            <Button
                                                color="warning"
                                                variant="flat"
                                                onPress={onOpenBonusScoreModal}
                                                className="hidden sm:flex"
                                                isDisabled={!isCourseActive}
                                            >
                                                {isEnglish ? "Bonus score" : "คะแนนพิเศษ"}
                                            </Button>
                                        </Tooltip>
                                    )}

                                    {/* Create Button - Icon only on mobile */}
                                    {canCreateAssignments && (
                                        <Tooltip content={isEnglish ? "Create assignment" : "สร้างงานใหม่"}>
                                            <Button
                                                color="primary"
                                                isIconOnly
                                                onPress={onOpenCreateModal}
                                                className="sm:hidden bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-indigo-500/25"
                                                isDisabled={!isCourseActive}
                                            >
                                                <Icon icon="solar:add-circle-bold" />
                                            </Button>
                                        </Tooltip>
                                    )}
                                    {/* Create Button - Full on desktop */}
                                    {canCreateAssignments && (
                                        <Button
                                            color="primary"
                                            onPress={onOpenCreateModal}
                                            className="hidden sm:flex bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-indigo-500/25"
                                            isDisabled={!isCourseActive}
                                        >
                                            {isEnglish ? "Create assignment" : "สร้างงานใหม่"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Content */}
                    {currentAssignments.length > 0 ? (
                        viewMode === "grid" ? (
                            /* Grid View */
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {currentAssignments.map(renderGridCard)}
                            </div>
                        ) : (
                            /* List View */
                            <div className="space-y-2">
                                {currentAssignments.map((assignment) => renderListRow(assignment))}
                            </div>
                        )
                    ) : (
                        <Card className="border border-dashed border-default-300 bg-content2/50 shadow-sm">
                            <CardBody className="text-center py-16">
                                {searchQuery ? (
                                    <>
                                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-content3">
                                            <Icon icon="solar:magnifer-linear" className="text-3xl text-default-400" />
                                        </div>
                                        <p className="font-medium text-default-600">{isEnglish ? "No matching assignments" : "ไม่พบงานที่ค้นหา"}</p>
                                        <p className="mt-1 text-sm text-default-400">{isEnglish ? "Try a different search term." : "ลองเปลี่ยนคำค้นหาใหม่"}</p>
                                        <Button
                                            size="sm"
                                            variant="light"
                                            className="mt-4"
                                            onPress={onClearSearch}
                                        >
                                            {isEnglish ? "Clear search" : "ล้างการค้นหา"}
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                                            <Icon icon="solar:clipboard-list-bold-duotone" className="text-5xl text-blue-500" />
                                        </div>
                                        <h3 className="mb-2 text-lg font-semibold text-default-700">
                                            {activeTab === "lab"
                                                ? (isEnglish ? "No labs yet" : "ยังไม่มี Lab")
                                                : activeTab === "assignment"
                                                    ? (isEnglish ? "No assignments yet" : "ยังไม่มี Assignment")
                                                    : (isEnglish ? "No group work yet" : "ยังไม่มีงานกลุ่ม")}
                                        </h3>
                                        <p className="mx-auto mb-6 max-w-md text-default-500">
                                            {isEnglish ? "Create grading items for your students." : "สร้างงานเพื่อกำหนดหัวข้อการลงคะแนนให้นักศึกษา"}
                                        </p>
                                        {canCreateAssignments && (
                                            <Button
                                                color="primary"
                                                size="lg"
                                                onPress={onOpenCreateModal}
                                                className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-indigo-500/25"
                                                isDisabled={!isCourseActive}
                                            >
                                                {isEnglish ? "Create the first assignment" : "สร้างงานแรก"}
                                            </Button>
                                        )}
                                    </>
                                )}
                            </CardBody>
                        </Card>
                    )}
                </>
            )}


            {/* Delete Confirmation Modal ยืนยันว่าจะลบมั้ย */}
            <Modal 
                isOpen={isDeleteModalOpen} 
                onClose={onCloseDeleteModal}
                size="lg"
            >
                <ModalContent className="border border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-red-500 to-rose-600 rounded-xl shadow-lg">
                                <Icon icon="solar:danger-triangle-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{isEnglish ? "Delete assignment" : "ลบงาน"}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">
                                    {isEnglish ? "Review the details before continuing." : "กรุณาตรวจสอบข้อมูลก่อนดำเนินการ"}
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        {deleteTarget && (
                            <div className="space-y-4">
                                {/* Assignment Info */}
                                <Card className="border border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-800/70">
                                    <CardBody className="py-4 px-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${getDeleteGradient(deleteTarget.assignment_type)}`}>
                                                <Icon 
                                                    icon={deleteTypeInfo?.icon || "solar:clipboard-list-bold"}
                                                    className="text-2xl text-white"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-lg font-semibold text-foreground">{deleteTarget.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Chip size="sm" variant="flat" className={
                                                        deleteTypeInfo?.color || "bg-content3 text-default-700"
                                                    }>
                                                        {deleteTypeInfo?.label}
                                                    </Chip>
                                                    {deleteTarget.week_number && (
                                                        <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                                                            W{deleteTarget.week_number}
                                                        </Chip>
                                                    )}
                                                </div>
                                                <div className="mt-2 flex items-center gap-3 text-sm text-default-500">
                                                    <span className="flex items-center gap-1">
                                                        <Icon icon="solar:medal-star-linear" className="text-amber-500" />
                                                        {formatPoints(deleteTarget.max_score, isEnglish)}
                                                    </span>
                                                    {deleteTarget.subItems && deleteTarget.subItems.length > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <Icon icon="solar:list-bold" className="text-default-400" />
                                                            {isEnglish
                                                                ? formatCount(deleteTarget.subItems.length, "item", "items")
                                                                : `${deleteTarget.subItems.length} ข้อย่อย`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>

                                {/* Score Info */}
                                <Card className="border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
                                    <CardBody className="py-3 px-4">
                                        <div className="flex items-start gap-3">
                                            <Icon icon="solar:diploma-verified-bold" className="text-xl text-amber-600 mt-0.5" />
                                            <div>
                                                <p className="font-medium text-amber-800 dark:text-amber-200">{isEnglish ? "Score impact" : "เกี่ยวกับคะแนน"}</p>
                                                <p className="text-sm text-amber-700 mt-1 dark:text-amber-300">
                                                    {isEnglish
                                                        ? "All scores related to this assignment will also be deleted, including any sub-item scores."
                                                        : "คะแนนทั้งหมดที่เกี่ยวข้องกับงานนี้จะถูกลบไปด้วย รวมถึงคะแนนข้อย่อยทั้งหมด (ถ้ามี)"}
                                                </p>
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>

                                {/* Warning */}
                                <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 dark:border-rose-500/30 dark:bg-rose-500/10">
                                    <div className="flex items-center gap-3">
                                        <Icon icon="solar:shield-warning-bold" className="text-2xl text-rose-600 dark:text-rose-300" />
                                        <div>
                                            <p className="font-semibold text-rose-800 dark:text-rose-200">
                                                {isEnglish ? "Delete this assignment?" : "คุณต้องการลบงานนี้ใช่หรือไม่?"}
                                            </p>
                                            <p className="text-sm text-rose-700 dark:text-rose-300">
                                                {isEnglish ? "This action cannot be undone." : "การดำเนินการนี้ไม่สามารถย้อนกลับได้"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button 
                            variant="light" 
                            onPress={onCloseDeleteModal}
                            isDisabled={isDeleting}
                        >
                            {isEnglish ? "Cancel" : "ยกเลิก"}
                        </Button>
                        <Button 
                            color="danger" 
                            onPress={onConfirmDelete}
                            isLoading={isDeleting}
                            isDisabled={!isCourseActive}
                            className="bg-red-500"
                        >
                            {isEnglish ? "Delete assignment" : "ลบงาน"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Create/Edit Assignment Modal */}
            <AssignmentModal
                isOpen={isAssignmentModalOpen}
                onClose={onCloseAssignmentModal}
                courseId={courseId}
                editingAssignment={editingAssignment}
                onSuccess={onAssignmentSaved}
                weeklyTeams={weeklyTeams}
                isCourseActive={isCourseActive}
            />
        </div>
    );
}

export const AssignmentsTabView = memo(AssignmentsTabViewComponent);
