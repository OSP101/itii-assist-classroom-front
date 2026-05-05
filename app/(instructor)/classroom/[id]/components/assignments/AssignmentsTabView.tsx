"use client";

import { memo } from "react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Tooltip } from "@heroui/tooltip";
import { Spinner } from "@heroui/spinner";
import { Tabs, Tab } from "@heroui/tabs";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Icon } from "@iconify/react";
import type { AssignmentType } from "../types";
import type { AssignmentTabType, ViewMode } from "./config";
import { getTypeInfo, getTypeBgColor, getTypeTextColor } from "./config";
import { AssignmentModal } from "./AssignmentModal";
import type { UngradedSummary } from "@/services/score.service";

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
    const getUngradedTooltipContent = (assignment: AssignmentType) => {
        const info = ungradedSummary[assignment.id];
        if (!info || info.ungraded_count === 0) {
            return null;
        }

        const previewStudents = info.students.slice(0, 3);

        return (
            <div className="max-w-xs px-1 py-0.5">
                <p className="mb-1 font-medium">
                    {"\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E30\u0E41\u0E19\u0E19 "}
                    {info.ungraded_count}/{info.total_students}
                    {" \u0E04\u0E19"}
                </p>
                <div className="space-y-1">
                    {previewStudents.map((student) => (
                        <p key={student.student_id} className="text-xs leading-5">
                            {student.student_id} - {student.full_name}
                        </p>
                    ))}
                </div>
                {info.ungraded_count > previewStudents.length && (
                    <p className="mt-1 text-xs text-slate-300">
                        {"\u0E41\u0E25\u0E30\u0E2D\u0E35\u0E01 "}
                        {info.ungraded_count - previewStudents.length}
                        {" \u0E04\u0E19..."}
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
            <div className="mt-2 border-t border-slate-100 pt-2">
                <Tooltip content={getUngradedTooltipContent(assignment)}>
                    <div className="inline-flex cursor-help items-center gap-1.5 text-xs text-orange-600">
                        <Icon icon="solar:user-cross-rounded-bold" className="text-sm" />
                        <span className="font-medium">
                            {"\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E30\u0E41\u0E19\u0E19 "}
                            {info.ungraded_count}/{info.total_students}
                            {" \u0E04\u0E19"}
                        </span>
                        <Icon icon="solar:info-circle-linear" className="text-sm text-orange-500" />
                    </div>
                </Tooltip>
            </div>
        );
    };

    // Render grid card view
    const renderGridCard = (assignment: AssignmentType) => {
        const typeInfo = getTypeInfo(assignment.assignment_type);
        return (
            <Card
                key={assignment.id}
                as="div"
                isPressable={canGradeAssignments || canEditScores}
                className="shadow-sm border border-slate-200 hover:shadow-md transition-all"
                onPress={() => (canGradeAssignments || canEditScores) && onOpenScoreModal(assignment)}
            >
                <CardBody className="p-4">
                    {/* Header with Actions */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className={`p-2 rounded-lg ${getTypeBgColor(assignment.assignment_type)}`}>
                            <Icon icon={typeInfo.icon} className={`text-xl ${getTypeTextColor(assignment.assignment_type)}`} />
                        </div>
                        {(canUpdateAssignments || canDeleteAssignments) && (
                            <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                                {canUpdateAssignments && (
                                    <Tooltip content="แก้ไข">
                                        <Button isIconOnly size="sm" variant="light" color="default" onPress={() => onOpenEditModal(assignment)}>
                                            <Icon icon="solar:pen-linear" />
                                        </Button>
                                    </Tooltip>
                                )}
                                {canDeleteAssignments && (
                                    <Tooltip content="ลบ" color="danger">
                                        <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => onDeleteAssignment(assignment)}>
                                            <Icon icon="solar:trash-bin-trash-linear" />
                                        </Button>
                                    </Tooltip>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    <p className="font-semibold text-slate-800 mb-2 line-clamp-2">{assignment.name}</p>

                    {/* Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        <Chip size="sm" className={typeInfo.color}>{typeInfo.label}</Chip>
                        {assignment.week_number && (
                            <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">W{assignment.week_number}</Chip>
                        )}
                        {assignment.subItems && assignment.subItems.length > 0 && (
                            <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-600">{assignment.subItems.length} ข้อย่อย</Chip>
                        )}
                        {assignment.is_score_visible === false && (
                            <Tooltip content="ซ่อนคะแนนจากนักศึกษา">
                                <Chip size="sm" variant="flat" className="bg-amber-50 text-amber-600 gap-1" startContent={<Icon icon="solar:eye-closed-linear" width={14} />}>
                                    ซ่อน
                                </Chip>
                            </Tooltip>
                        )}
                    </div>

                    {/* Footer Info */}
                    <div className="flex items-center justify-between text-sm text-slate-500 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                            <Icon icon="solar:medal-star-bold" className="text-amber-500" />
                            <span className="font-medium text-slate-700">{assignment.max_score}</span> คะแนน
                        </span>
                    </div>
                    {renderUngradedInfo(assignment)}
                </CardBody>
            </Card>
        );
    };

    // Render list row view
    const renderListRow = (assignment: AssignmentType) => {
        const typeInfo = getTypeInfo(assignment.assignment_type);
        return (
            <Card
                key={assignment.id}
                as="div"
                isPressable={canGradeAssignments || canEditScores}
                className="shadow-sm border border-slate-200 hover:shadow-md transition-all w-full"
                onPress={() => (canGradeAssignments || canEditScores) && onOpenScoreModal(assignment)}
            >
                <CardBody className="p-3 sm:p-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                        {/* Icon */}
                        <div className={`p-2 sm:p-2.5 rounded-lg shrink-0 ${getTypeBgColor(assignment.assignment_type)}`}>
                            <Icon icon={typeInfo.icon} className={`text-lg sm:text-xl ${getTypeTextColor(assignment.assignment_type)}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                <p className="font-semibold text-slate-800 truncate">{assignment.name}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <Chip size="sm" className={typeInfo.color}>{typeInfo.label}</Chip>
                                    {assignment.week_number && (
                                        <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">W{assignment.week_number}</Chip>
                                    )}
                                    {assignment.is_score_visible === false && (
                                        <Tooltip content="ซ่อนคะแนนจากนักศึกษา">
                                            <Chip size="sm" variant="flat" className="bg-amber-50 text-amber-600 gap-1" startContent={<Icon icon="solar:eye-closed-linear" width={14} />}>
                                                ซ่อน
                                            </Chip>
                                        </Tooltip>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                                <span className="flex items-center gap-1">
                                    <Icon icon="solar:medal-star-linear" className="text-amber-500" />
                                    {assignment.max_score} คะแนน
                                </span>
                                {assignment.subItems && assignment.subItems.length > 0 && (
                                    <span className="hidden sm:flex items-center gap-1">
                                        <Icon icon="solar:list-bold" className="text-slate-400" />
                                        {assignment.subItems.length} ข้อย่อย
                                    </span>
                                )}
                                {ungradedSummary[assignment.id] && ungradedSummary[assignment.id].ungraded_count > 0 ? (
                                    <Tooltip content={getUngradedTooltipContent(assignment)}>
                                        <span className="flex items-center gap-1 cursor-help text-orange-500">
                                            <Icon icon="solar:user-cross-rounded-bold" className="text-sm" />
                                            <span className="text-xs font-medium">
                                                {"\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E30\u0E41\u0E19\u0E19 "}
                                                {ungradedSummary[assignment.id].ungraded_count}
                                                {" \u0E04\u0E19"}
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
                                {canUpdateAssignments && (
                                    <Tooltip content="แก้ไข">
                                        <Button isIconOnly size="sm" variant="light" color="default" onPress={() => onOpenEditModal(assignment)}>
                                            <Icon icon="solar:pen-linear" className="text-lg" />
                                        </Button>
                                    </Tooltip>
                                )}
                                {canDeleteAssignments && (
                                    <Tooltip content="ลบ" color="danger">
                                        <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => onDeleteAssignment(assignment)}>
                                            <Icon icon="solar:trash-bin-trash-linear" className="text-lg" />
                                        </Button>
                                    </Tooltip>
                                )}
                            </div>
                        )}
                    </div>
                </CardBody>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800">งานในชั้นเรียน</h2>
                    <p className="text-sm text-slate-500">สร้างและจัดการหัวข้องานสำหรับการลงคะแนน</p>
                </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Spinner size="lg" />
                </div>
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
                                tabContent: "group-data-[selected=true]:text-blue-600 text-slate-500 font-medium text-sm"
                            }}
                        >
                            <Tab
                                key="all"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Icon icon="solar:clipboard-list-bold" className="text-lg" />
                                        <span>ทั้งหมด</span>
                                        {assignments.length > 0 && (
                                            <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700 h-5 min-w-5 px-1">
                                                {assignments.length}
                                            </Chip>
                                        )}
                                    </div>
                                }
                            />
                            <Tab
                                key="lab"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Icon icon="solar:monitor-bold" className="text-lg" />
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
                                        <Icon icon="solar:document-text-bold" className="text-lg" />
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
                                        <Icon icon="solar:users-group-rounded-bold" className="text-lg" />
                                        <span className="hidden sm:inline">งานกลุ่ม</span>
                                        <span className="sm:hidden">กลุ่ม</span>
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
                    <Card className="shadow-sm border border-slate-200">
                        <CardBody className="py-3 px-4">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <Input
                                        placeholder="ค้นหาชื่องาน..."
                                        value={searchQuery}
                                        onValueChange={onSetSearchQuery}
                                        startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400 text-lg sm:text-xl" />}
                                        className="w-full"
                                        size="md"
                                        variant="bordered"
                                        isClearable
                                        classNames={{
                                            inputWrapper: "border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-blue-400 text-sm",
                                        }}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* View Mode Toggle */}
                                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                                        <Tooltip content="แบบการ์ด">
                                            <Button
                                                isIconOnly
                                                size="md"
                                                variant="light"
                                                className={`rounded-none ${viewMode === "grid" ? "bg-slate-100" : ""}`}
                                                onPress={() => onSetViewMode("grid")}
                                            >
                                                <Icon icon="solar:widget-bold" className={`text-lg ${viewMode === "grid" ? "text-blue-600" : "text-slate-400"}`} />
                                            </Button>
                                        </Tooltip>
                                        <div className="w-px h-5 bg-slate-200" />
                                        <Tooltip content="แบบรายการ">
                                            <Button
                                                isIconOnly
                                                size="md"
                                                variant="light"
                                                className={`rounded-none ${viewMode === "list" ? "bg-slate-100" : ""}`}
                                                onPress={() => onSetViewMode("list")}
                                            >
                                                <Icon icon="solar:list-bold" className={`text-lg ${viewMode === "list" ? "text-blue-600" : "text-slate-400"}`} />
                                            </Button>
                                        </Tooltip>
                                    </div>

                                    {/* Bonus Score Button - Icon only on mobile */}
                                    {canGradeAssignments && onOpenBonusScoreModal && (
                                        <Tooltip content="ให้คะแนนพิเศษ (ถาม-ตอบ)">
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
                                        <Tooltip content="ให้คะแนนพิเศษ (ถาม-ตอบ)">
                                            <Button
                                                color="warning"
                                                variant="flat"
                                                startContent={<Icon icon="solar:star-bold" />}
                                                onPress={onOpenBonusScoreModal}
                                                className="hidden sm:flex"
                                                isDisabled={!isCourseActive}
                                            >
                                                คะแนนพิเศษ
                                            </Button>
                                        </Tooltip>
                                    )}

                                    {/* Create Button - Icon only on mobile */}
                                    {canCreateAssignments && (
                                        <Tooltip content="สร้างงานใหม่">
                                            <Button
                                                color="primary"
                                                isIconOnly
                                                onPress={onOpenCreateModal}
                                                className="sm:hidden bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-indigo-500/25"
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
                                            startContent={<Icon icon="solar:add-circle-bold" />}
                                            onPress={onOpenCreateModal}
                                            className="hidden sm:flex bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-indigo-500/25"
                                            isDisabled={!isCourseActive}
                                        >
                                            สร้างงานใหม่
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
                        <Card className="shadow-sm border border-dashed border-slate-300 bg-slate-50/50">
                            <CardBody className="text-center py-16">
                                {searchQuery ? (
                                    <>
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                            <Icon icon="solar:magnifer-linear" className="text-3xl text-slate-400" />
                                        </div>
                                        <p className="text-slate-600 font-medium">ไม่พบงานที่ค้นหา</p>
                                        <p className="text-sm text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาใหม่</p>
                                        <Button
                                            size="sm"
                                            variant="light"
                                            className="mt-4"
                                            onPress={onClearSearch}
                                        >
                                            ล้างการค้นหา
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                                            <Icon icon="solar:clipboard-list-bold-duotone" className="text-5xl text-blue-500" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-700 mb-2">
                                            {activeTab === "lab" ? "ยังไม่มี Lab" :
                                                activeTab === "assignment" ? "ยังไม่มี Assignment" :
                                                activeTab === "group" ? "ยังไม่มีงานกลุ่ม" : "ยังไม่มีงาน"}
                                        </h3>
                                        <p className="text-slate-500 mb-6 max-w-md mx-auto">
                                            สร้างงานเพื่อกำหนดหัวข้อการลงคะแนนให้นักศึกษา
                                        </p>
                                        {canCreateAssignments && (
                                            <Button
                                                color="primary"
                                                size="lg"
                                                startContent={<Icon icon="solar:add-circle-bold" />}
                                                onPress={onOpenCreateModal}
                                                className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-indigo-500/25"
                                                isDisabled={!isCourseActive}
                                            >
                                                สร้างงานแรก
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
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg">
                                <Icon icon="solar:danger-triangle-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">ลบงาน</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">
                                    กรุณาตรวจสอบข้อมูลก่อนดำเนินการ
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        {deleteTarget && (
                            <div className="space-y-4">
                                {/* Assignment Info */}
                                <Card className="border border-red-100 bg-red-50/50">
                                    <CardBody className="py-4 px-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                                                deleteTarget.assignment_type === "individual" 
                                                    ? "bg-gradient-to-br from-indigo-500 to-blue-600" 
                                                    : deleteTarget.assignment_type === "permanent_group" 
                                                        ? "bg-gradient-to-br from-purple-500 to-indigo-600" 
                                                        : "bg-gradient-to-br from-emerald-500 to-teal-600"
                                            }`}>
                                                <Icon 
                                                    icon={
                                                        deleteTarget.assignment_type === "individual" 
                                                            ? "solar:user-bold" 
                                                            : deleteTarget.assignment_type === "permanent_group"
                                                                ? "solar:users-group-two-rounded-bold"
                                                                : "solar:users-group-rounded-bold"
                                                    } 
                                                    className="text-2xl text-white"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold text-lg text-slate-800">{deleteTarget.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Chip size="sm" variant="flat" className={
                                                        deleteTarget.assignment_type === "individual"
                                                            ? "bg-indigo-100 text-indigo-700"
                                                            : deleteTarget.assignment_type === "permanent_group"
                                                                ? "bg-purple-100 text-purple-700"
                                                                : "bg-emerald-100 text-emerald-700"
                                                    }>
                                                        {deleteTarget.assignment_type === "individual" 
                                                            ? "งานเดี่ยว" 
                                                            : deleteTarget.assignment_type === "permanent_group"
                                                                ? "กลุ่มโปรเจกต์"
                                                                : "กลุ่มสัปดาห์"}
                                                    </Chip>
                                                    {deleteTarget.week_number && (
                                                        <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
                                                            W{deleteTarget.week_number}
                                                        </Chip>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Icon icon="solar:medal-star-linear" className="text-amber-500" />
                                                        {deleteTarget.max_score} คะแนน
                                                    </span>
                                                    {deleteTarget.subItems && deleteTarget.subItems.length > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <Icon icon="solar:list-bold" className="text-slate-400" />
                                                            {deleteTarget.subItems.length} ข้อย่อย
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>

                                {/* Score Info */}
                                <Card className="border border-amber-200 bg-amber-50">
                                    <CardBody className="py-3 px-4">
                                        <div className="flex items-start gap-3">
                                            <Icon icon="solar:diploma-verified-bold" className="text-xl text-amber-600 mt-0.5" />
                                            <div>
                                                <p className="font-medium text-amber-800">เกี่ยวกับคะแนน</p>
                                                <p className="text-sm text-amber-700 mt-1">
                                                    คะแนนทั้งหมดที่เกี่ยวข้องกับงานนี้จะถูกลบไปด้วย
                                                    รวมถึงคะแนนข้อย่อยทั้งหมด (ถ้ามี)
                                                </p>
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>

                                {/* Warning */}
                                <div className="p-4 bg-red-100 rounded-xl border border-red-200">
                                    <div className="flex items-center gap-3">
                                        <Icon icon="solar:shield-warning-bold" className="text-2xl text-red-600" />
                                        <div>
                                            <p className="font-semibold text-red-800">
                                                คุณต้องการลบงานนี้ใช่หรือไม่?
                                            </p>
                                            <p className="text-sm text-red-600">
                                                การดำเนินการนี้ไม่สามารถย้อนกลับได้
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button 
                            variant="light" 
                            onPress={onCloseDeleteModal}
                            isDisabled={isDeleting}
                        >
                            ยกเลิก
                        </Button>
                        <Button 
                            color="danger" 
                            onPress={onConfirmDelete}
                            isLoading={isDeleting}
                            className="bg-red-500"
                        >
                            ลบงาน
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
            />
        </div>
    );
}

export const AssignmentsTabView = memo(AssignmentsTabViewComponent);
