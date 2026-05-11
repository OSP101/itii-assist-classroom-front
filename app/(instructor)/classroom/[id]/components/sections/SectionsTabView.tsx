"use client";

import React from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Tooltip } from "@heroui/tooltip";
import { Avatar } from "@heroui/avatar";
import { Tabs, Tab } from "@heroui/tabs";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
} from "@heroui/table";
import { Icon } from "@iconify/react";
import type { Course, SectionStudent, RemovedSectionStudent } from "@/services/course.service";
import { TeamsGridSkeleton } from "../Skeletons";
import type {
    PermanentTeam,
    WeeklyTeam,
    SectionSubTab,
    TeamType,
    TeamFormationMethod,
} from "./config";

interface SectionsTabViewProps {
    // Data
    course: Course;
    sectionSubTab: SectionSubTab;
    sectionSearchQuery: string;
    totalStudents: number;
    permanentTeams: PermanentTeam[];
    weeklyTeams: Record<number, WeeklyTeam[]>;
    selectedWeek: number;
    totalWeeks: number;
    expandedSections: number[];
    isTeamsLoading: boolean;
    sectionStudents: Record<number, SectionStudent[]>;
    isCourseActive?: boolean;
    removedStudents: RemovedSectionStudent[];
    canCreateSections?: boolean;
    canUpdateSections?: boolean;
    canDeleteSections?: boolean;
    canManageSectionStudents?: boolean;
    canCreateTeams?: boolean;
    canUpdateTeams?: boolean;
    canDeleteTeams?: boolean;


    // Handlers
    onSubTabChange: (tab: SectionSubTab) => void;
    onSearchQueryChange: (query: string) => void;
    onWeekChange: (week: number) => void;
    onToggleSection: (sectionId: number) => void;
    onOpenAddSectionModal: () => void;
    onOpenAddStudentModal: (sectionId: number) => void;
    onRemoveSection: (sectionId: number) => void;
    onOpenDeleteStudentModal: (sectionId: number, student: SectionStudent) => void;
    onRestoreRemovedStudent: (removed: RemovedSectionStudent) => void;
    onOpenCreateTeamModal: (type: TeamType, method: TeamFormationMethod) => void;
    onOpenDeleteTeamModal: (teamId: number, type: TeamType, weekNumber?: number) => void;
    onOpenEditTeamModal: (teamId: number, type: TeamType, weekNumber?: number) => void;
    onCopyTeamsFromWeek: (sourceWeek: number) => void;
    onOpenBulkDeleteModal: () => void;
    onOpenEditSectionModal: (sectionId: number) => void;

    // Computed functions
    getFilteredSectionStudents: (sectionId: number) => SectionStudent[];
    findStudentTeam: (studentId: number, type: TeamType, weekNumber?: number) => string | null;
}

// ============================================
// Sub-components (Memoized)
// ============================================

interface SectionHeaderProps {
    sectionNo: string;
    studentCount: number;
    isExpanded: boolean;
    isCourseActive?: boolean;
    canManageSectionStudents?: boolean;
    canUpdateSections?: boolean;
    canDeleteSections?: boolean;
    onToggle: () => void;
    onAddStudent: () => void;
    onEdit: () => void;
    onRemove: () => void;
}

const SectionHeader = React.memo(function SectionHeader({
    sectionNo,
    studentCount,
    isExpanded,
    isCourseActive = true,
    canManageSectionStudents = false,
    canUpdateSections = false,
    canDeleteSections = false,
    onToggle,
    onAddStudent,
    onEdit,
    onRemove,
}: SectionHeaderProps) {
    return (
        <div
            className={`flex items-center justify-between p-4 cursor-pointer transition-all ${isExpanded
                ? "bg-linear-to-r from-blue-400 to-indigo-500"
                : "bg-content1 hover:bg-content2"
                }`}
            onClick={onToggle}
        >
            <div className="flex items-center gap-4">
                <div>
                    <p className={`font-semibold ${isExpanded ? "text-white" : "text-foreground"}`}>
                        Section {sectionNo}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <Icon
                            icon="solar:users-group-rounded-linear"
                            className={isExpanded ? "text-white/70" : "text-default-400"}
                        />
                        <span className={`text-sm ${isExpanded ? "text-white/80" : "text-default-500"}`}>
                            {studentCount} นักศึกษา
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {canManageSectionStudents && (
                    <Tooltip content="เพิ่มนักศึกษา">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            isDisabled={!isCourseActive}
                            className={isExpanded ? "bg-white/20 text-white" : ""}
                            onPress={onAddStudent}
                        >
                            <Icon icon="solar:user-plus-bold" className="text-lg" />
                        </Button>
                    </Tooltip>
                )}
                {canUpdateSections && (
                    <Tooltip content="แก้ไขกลุ่มเรียน">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            isDisabled={!isCourseActive}
                            className={isExpanded ? "bg-white/20 text-white" : "bg-amber-100 text-amber-600"}
                            onPress={onEdit}
                        >
                            <Icon icon="solar:pen-bold" className="text-lg" />
                        </Button>
                    </Tooltip>
                )}
                {canDeleteSections && (
                    <Tooltip content="ลบกลุ่มเรียน" color="danger">
                        <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            isDisabled={!isCourseActive}
                            className={isExpanded ? "bg-white/20 text-white hover:bg-red-500" : "bg-red-100 text-red-600"}
                            onPress={onRemove}
                        >
                            <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />
                        </Button>
                    </Tooltip>
                )}
                <div
                    className={`ml-2 p-1 rounded-lg ${isExpanded ? "bg-white/20" : "bg-content3"}`}
                    onClick={onToggle}
                >
                    <Icon
                        icon={isExpanded ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
                        className={`text-xl ${isExpanded ? "text-white" : "text-default-500"}`}
                    />
                </div>
            </div>
        </div>
    );
});

interface TeamCardProps {
    team: PermanentTeam | WeeklyTeam;
    index: number;
    type: TeamType;
    weekNumber?: number;
    onEdit: () => void;
    onDelete: () => void;
    canUpdateTeams?: boolean;
    canDeleteTeams?: boolean;
}

const TeamCard = React.memo(function TeamCard({
    team,
    index,
    type,
    onEdit,
    onDelete,
    canUpdateTeams = false,
    canDeleteTeams = false,
}: TeamCardProps) {
    const isPermanent = type === "permanent";
    const gradientClass = isPermanent
        ? "from-purple-500 to-indigo-500"
        : "from-emerald-500 to-teal-500";
    const hoverClass = isPermanent
        ? "hover:border-purple-200"
        : "hover:border-emerald-200";
    const memberBgClass = isPermanent
        ? "from-purple-400 to-indigo-500"
        : "from-emerald-400 to-teal-500";
    const memberHoverClass = isPermanent
        ? "hover:bg-purple-500/10"
        : "hover:bg-emerald-500/10";

    return (
        <Card className={`border border-default-200 bg-content1 shadow-sm transition-all hover:shadow-lg ${hoverClass} group`}>
            <CardHeader className={`px-4 py-3 bg-linear-to-r ${gradientClass}`}>
                <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-white shrink-0">
                            {index + 1}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                            <Tooltip content={team.name}>
                                <p className="font-semibold text-white truncate cursor-default">{team.name}</p>
                            </Tooltip>
                            <p className="text-xs text-white/70">{team.members.length} สมาชิก</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {canUpdateTeams && (
                            <Tooltip content="แก้ไขกลุ่ม">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    className="bg-white/20 text-white hover:bg-white/40"
                                    onPress={onEdit}
                                >
                                    <Icon icon="solar:pen-bold" />
                                </Button>
                            </Tooltip>
                        )}
                        {canDeleteTeams && (
                            <Tooltip content="ลบกลุ่ม" color="danger">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    className="bg-white/20 text-white hover:bg-red-500"
                                    onPress={onDelete}
                                >
                                    <Icon icon="solar:trash-bin-trash-bold" />
                                </Button>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardBody className="px-4 py-3">
                <div className="space-y-2">
                    {team.members.map((member, idx) => (
                        <div
                            key={member.id}
                            className={`flex items-center gap-3 p-2 rounded-lg ${memberHoverClass} transition-colors`}
                        >
                            <div className={`w-8 h-8 rounded-full bg-linear-to-br ${memberBgClass} flex items-center justify-center text-white text-xs font-medium`}>
                                {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{member.full_name}</p>
                                <p className="text-xs text-default-400">{member.student_id}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
});

// ============================================
// Main View Component
// ============================================

function SectionsTabViewComponent({
    course,
    sectionSubTab,
    sectionSearchQuery,
    totalStudents,
    permanentTeams,
    weeklyTeams,
    selectedWeek,
    totalWeeks,
    expandedSections,
    isTeamsLoading,
    sectionStudents,
    isCourseActive = true,
    removedStudents,
    canCreateSections = false,
    canUpdateSections = false,
    canDeleteSections = false,
    canManageSectionStudents = false,
    canCreateTeams = false,
    canUpdateTeams = false,
    canDeleteTeams = false,
    onSubTabChange,
    onSearchQueryChange,
    onWeekChange,
    onToggleSection,
    onOpenAddSectionModal,
    onOpenAddStudentModal,
    onRemoveSection,
    onOpenDeleteStudentModal,
    onRestoreRemovedStudent,
    onOpenCreateTeamModal,
    onOpenDeleteTeamModal,
    onOpenEditTeamModal,
    onCopyTeamsFromWeek,
    onOpenBulkDeleteModal,
    onOpenEditSectionModal,
    getFilteredSectionStudents,
    findStudentTeam,
}: SectionsTabViewProps) {
    return (
        <div className="space-y-6 h-auto">
            {/* Header */}
            <div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">จัดการกลุ่มเรียน</h2>
                            <p className="text-sm text-default-500">จัดการนักศึกษาและกลุ่มทำงานในรายวิชา</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub-tabs Navigation */}
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-3 lg:mx-0 lg:px-0">
                <Tabs
                    selectedKey={sectionSubTab}
                    onSelectionChange={(key) => onSubTabChange(key as SectionSubTab)}
                    variant="underlined"
                    classNames={{
                        tabList: "gap-4 md:gap-6 flex-nowrap min-w-max",
                        cursor: "bg-blue-500",
                        tab: "px-0 h-11 whitespace-nowrap",
                        tabContent: "group-data-[selected=true]:text-blue-600 text-default-500 font-medium text-sm"
                    }}
                >
                    <Tab
                        key="students"
                        title={
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:users-group-rounded-bold" className="text-lg" />
                                <span className="hidden sm:inline">รายชื่อนักศึกษา</span>
                                <span className="sm:hidden">นักศึกษา</span>
                                {totalStudents > 0 && (
                                    <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700 h-5 min-w-5 px-1">
                                        {totalStudents}
                                    </Chip>
                                )}
                            </div>
                        }
                    />
                    <Tab
                        key="permanent"
                        title={
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:users-group-two-rounded-bold" className="text-lg" />
                                <span>กลุ่มโปรเจกต์</span>
                                {permanentTeams.length > 0 && (
                                    <Chip size="sm" variant="flat" className="bg-purple-100 text-purple-700 h-5 min-w-5 px-1">
                                        {permanentTeams.length}
                                    </Chip>
                                )}
                            </div>
                        }
                    />
                    <Tab
                        key="weekly"
                        title={
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:calendar-bold" className="text-lg" />
                                <span className="hidden sm:inline">กลุ่มโปรเจกต์รายสัปดาห์</span>
                                <span className="sm:hidden">รายสัปดาห์</span>
                                {Object.keys(weeklyTeams).filter(k => weeklyTeams[parseInt(k)]?.length > 0).length > 0 && (
                                    <Chip size="sm" variant="flat" className="bg-emerald-100 text-emerald-700 h-5 min-w-5 px-1">
                                        W{selectedWeek}
                                    </Chip>
                                )}
                            </div>
                        }
                    />
                </Tabs>
            </div>

            {/* Students Tab */}
            {sectionSubTab === "students" && (
                <StudentsSubTab
                    course={course}
                    sectionSearchQuery={sectionSearchQuery}
                    expandedSections={expandedSections}
                    sectionStudents={sectionStudents}
                    isCourseActive={isCourseActive}
                    canCreateSections={canCreateSections}
                    canUpdateSections={canUpdateSections}
                    canDeleteSections={canDeleteSections}
                    canManageSectionStudents={canManageSectionStudents}
                    onSearchQueryChange={onSearchQueryChange}
                    onOpenAddSectionModal={onOpenAddSectionModal}
                    onToggleSection={onToggleSection}
                    onOpenAddStudentModal={onOpenAddStudentModal}
                    onRemoveSection={onRemoveSection}
                    onOpenDeleteStudentModal={onOpenDeleteStudentModal}
                    removedStudents={removedStudents}
                    onRestoreRemovedStudent={onRestoreRemovedStudent}
                    onOpenEditSectionModal={onOpenEditSectionModal}
                    getFilteredSectionStudents={getFilteredSectionStudents}
                    findStudentTeam={findStudentTeam}
                />
            )}

            {/* Permanent Teams Tab */}
            {sectionSubTab === "permanent" && (
                <PermanentTeamsSubTab
                    permanentTeams={permanentTeams}
                    isTeamsLoading={isTeamsLoading}
                    isCourseActive={isCourseActive}
                    canCreateTeams={canCreateTeams}
                    canUpdateTeams={canUpdateTeams}
                    canDeleteTeams={canDeleteTeams}
                    onOpenCreateTeamModal={onOpenCreateTeamModal}
                    onOpenEditTeamModal={onOpenEditTeamModal}
                    onOpenDeleteTeamModal={onOpenDeleteTeamModal}
                />
            )}

            {/* Weekly Teams Tab */}
            {sectionSubTab === "weekly" && (
                <WeeklyTeamsSubTab
                    weeklyTeams={weeklyTeams}
                    selectedWeek={selectedWeek}
                    totalWeeks={totalWeeks}
                    isTeamsLoading={isTeamsLoading}
                    isCourseActive={isCourseActive}
                    canCreateTeams={canCreateTeams}
                    canUpdateTeams={canUpdateTeams}
                    canDeleteTeams={canDeleteTeams}
                    onWeekChange={onWeekChange}
                    onOpenCreateTeamModal={onOpenCreateTeamModal}
                    onOpenEditTeamModal={onOpenEditTeamModal}
                    onOpenDeleteTeamModal={onOpenDeleteTeamModal}
                    onCopyTeamsFromWeek={onCopyTeamsFromWeek}
                    onOpenBulkDeleteModal={onOpenBulkDeleteModal}
                />
            )}
        </div>
    );
}

// ============================================
// Students Sub-Tab Component
// ============================================

interface StudentsSubTabProps {
    course: Course;
    sectionSearchQuery: string;
    expandedSections: number[];
    sectionStudents: Record<number, SectionStudent[]>;
    removedStudents: RemovedSectionStudent[];
    isCourseActive?: boolean;
    canCreateSections?: boolean;
    canUpdateSections?: boolean;
    canDeleteSections?: boolean;
    canManageSectionStudents?: boolean;
    onSearchQueryChange: (query: string) => void;
    onOpenAddSectionModal: () => void;
    onToggleSection: (sectionId: number) => void;
    onOpenAddStudentModal: (sectionId: number) => void;
    onRemoveSection: (sectionId: number) => void;
    onOpenDeleteStudentModal: (sectionId: number, student: SectionStudent) => void;
    onRestoreRemovedStudent: (removed: RemovedSectionStudent) => void;
    onOpenEditSectionModal: (sectionId: number) => void;
    getFilteredSectionStudents: (sectionId: number) => SectionStudent[];
    findStudentTeam: (studentId: number, type: TeamType, weekNumber?: number) => string | null;
}

const StudentsSubTab = React.memo(function StudentsSubTab({
    course,
    sectionSearchQuery,
    expandedSections,
    sectionStudents,
    removedStudents,
    isCourseActive = true,
    canCreateSections = false,
    canUpdateSections = false,
    canDeleteSections = false,
    canManageSectionStudents = false,
    onSearchQueryChange,
    onOpenAddSectionModal,
    onToggleSection,
    onOpenAddStudentModal,
    onRemoveSection,
    onOpenDeleteStudentModal,
    onRestoreRemovedStudent,
    onOpenEditSectionModal,
    getFilteredSectionStudents,
    findStudentTeam,
}: StudentsSubTabProps) {
    const [showHistory, setShowHistory] = React.useState(false);
    const [historyFilter, setHistoryFilter] = React.useState<string>("");

    const filteredHistory = React.useMemo(() => {
        if (!historyFilter) return removedStudents;
        return removedStudents.filter(r =>
            r.full_name.toLowerCase().includes(historyFilter.toLowerCase()) ||
            String(r.student_ref_id).includes(historyFilter) ||
            r.section_no.includes(historyFilter)
        );
    }, [removedStudents, historyFilter]);

    return (
        <div className="space-y-4">
            {/* Search & Actions Bar */}
            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardBody className="py-3 px-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <Input
                                placeholder="ค้นหารหัสหรือชื่อนักศึกษา..."
                                value={sectionSearchQuery}
                                onValueChange={onSearchQueryChange}
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
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button
                                variant="flat"
                                startContent={<Icon icon="solar:history-bold" />}
                                endContent={removedStudents.length > 0 ? <Chip size="sm" className="bg-amber-100 text-amber-700">{removedStudents.length}</Chip> : undefined}
                                className={`border ${showHistory ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                                isDisabled={removedStudents.length === 0}
                                onPress={() => setShowHistory(v => !v)}
                            >
                                รายการที่ลบ
                            </Button>

                            {canCreateSections && (
                                <Button
                                    color="primary"
                                    startContent={<Icon icon="solar:add-circle-bold" />}
                                    onPress={onOpenAddSectionModal}
                                    isDisabled={!isCourseActive}
                                    className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-indigo-500/25 w-full sm:w-auto"
                                >
                                    เพิ่มกลุ่มเรียน
                                </Button>
                            )}
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Removed Students History Panel */}
            {showHistory && removedStudents.length > 0 && (
                <Card className="shadow-sm border border-amber-200 bg-amber-50/40">
                    <CardHeader className="px-4 py-3 flex flex-col gap-3">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:history-bold" className="text-amber-600 text-lg" />
                                <span className="font-semibold text-amber-800 text-sm">ประวัติการลบนักศึกษา (กู้คืนได้ภายใน 10 วัน)</span>
                            </div>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                className="text-amber-600"
                                onPress={() => setShowHistory(false)}
                            >
                                <Icon icon="solar:close-circle-bold" className="text-lg" />
                            </Button>
                        </div>
                        <Input
                            placeholder="ค้นหาชื่อ, รหัส หรือกลุ่มเรียน..."
                            value={historyFilter}
                            onValueChange={setHistoryFilter}
                            startContent={<Icon icon="solar:magnifer-linear" className="text-amber-400" />}
                            size="sm"
                            variant="bordered"
                            isClearable
                            classNames={{
                                inputWrapper: "bg-content1 border-amber-200 hover:border-amber-300 focus-within:!border-amber-400",
                            }}
                        />
                    </CardHeader>
                    <CardBody className="p-0">
                        {filteredHistory.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-amber-600/70">ไม่พบรายการที่ตรงกับคำค้นหา</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table
                                    aria-label="ประวัติการลบนักศึกษา"
                                    removeWrapper
                                    classNames={{
                                        base: "min-w-140",
                                        th: "bg-amber-100/60 text-amber-700 font-semibold text-xs uppercase tracking-wide",
                                        td: "py-2 border-b border-amber-100",
                                        tr: "hover:bg-amber-50 transition-colors",
                                    }}
                                >
                                    <TableHeader>
                                        <TableColumn>นักศึกษา</TableColumn>
                                        <TableColumn width={90}>กลุ่ม</TableColumn>
                                        <TableColumn width={120}>วันที่ลบ</TableColumn>
                                        <TableColumn width={100}>เหลือเวลา</TableColumn>
                                        <TableColumn width={80} align="center">กู้คืน</TableColumn>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredHistory.map((removed) => (
                                            <TableRow key={removed.removal_id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar
                                                            name={removed.full_name}
                                                            size="sm"
                                                            className="bg-linear-to-br from-amber-400 to-orange-500 text-white shrink-0"
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium text-foreground">{removed.full_name}</p>
                                                            {removed.student_ref_id !== 0 && (
                                                                <p className="text-xs text-default-500">{removed.student_ref_id}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700">
                                                        กลุ่ม {removed.section_no}
                                                    </Chip>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs text-default-500">
                                                        {new Date(removed.removed_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" })}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        size="sm"
                                                        variant="flat"
                                                        className={removed.remaining_days <= 2 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}
                                                    >
                                                        {removed.remaining_days} วัน
                                                    </Chip>
                                                </TableCell>
                                                <TableCell>
                                                    {canManageSectionStudents && (
                                                        <Tooltip content="กู้คืนนักศึกษา" color="warning">
                                                            <Button
                                                                isIconOnly
                                                                size="sm"
                                                                variant="flat"
                                                                isDisabled={!isCourseActive}
                                                                className="bg-amber-100 text-amber-700 hover:bg-amber-200"
                                                                onPress={() => onRestoreRemovedStudent(removed)}
                                                            >
                                                                <Icon icon="solar:restart-bold" className="text-base" />
                                                            </Button>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}

            {/* Sections */}
            {course.sections && course.sections.length > 0 ? (
                <div className="space-y-4">
                    {course.sections.map((section) => (
                        <Card key={section.id} className="overflow-hidden border border-default-200 bg-content1 shadow-sm">
                            <SectionHeader
                                sectionNo={section.section_no}
                                studentCount={sectionStudents[section.id]?.length || section.studentCount || 0}
                                isExpanded={expandedSections.includes(section.id)}
                                isCourseActive={isCourseActive}
                                canManageSectionStudents={canManageSectionStudents}
                                canUpdateSections={canUpdateSections}
                                canDeleteSections={canDeleteSections}
                                onToggle={() => onToggleSection(section.id)}
                                onAddStudent={() => onOpenAddStudentModal(section.id)}
                                onEdit={() => onOpenEditSectionModal(section.id)}
                                onRemove={() => onRemoveSection(section.id)}
                            />

                            {/* Student Table */}
                            {expandedSections.includes(section.id) && (
                                <CardBody className="overflow-hidden bg-content1 p-0">
                                    {getFilteredSectionStudents(section.id).length > 0 ? (
                                        <div className="overflow-x-auto max-w-full">
                                            <Table
                                                aria-label={`นักศึกษากลุ่ม ${section.section_no}`}
                                                removeWrapper
                                                classNames={{
                                                    base: "min-w-[640px]",
                                                    th: "bg-content2 text-default-600 font-semibold text-xs uppercase tracking-wide",
                                                    td: "border-b border-divider py-3",
                                                    tr: "transition-colors hover:bg-content2/70",
                                                }}
                                            >
                                                <TableHeader>
                                                    <TableColumn width={50}>ลำดับ</TableColumn>
                                                    <TableColumn width={100}>รหัส</TableColumn>
                                                    <TableColumn>ชื่อ-นามสกุล</TableColumn>
                                                    <TableColumn width={120}>กลุ่มโปรเจกต์</TableColumn>
                                                    <TableColumn width={50} align="center">จัดการ</TableColumn>
                                                </TableHeader>
                                                <TableBody>
                                                    {getFilteredSectionStudents(section.id).map((student, idx) => (
                                                        <TableRow key={student.id}>
                                                            <TableCell>
                                                                <div className="text-center text-sm font-medium text-default-700">{idx + 1}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="text-xs font-medium text-default-700">{student.student_id}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <Avatar
                                                                        name={student.full_name}
                                                                        size="sm"
                                                                        className="bg-linear-to-br from-blue-400 to-indigo-500 text-white shrink-0"
                                                                    />
                                                                    <span className="whitespace-nowrap text-sm font-medium text-foreground">{student.full_name}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {findStudentTeam(student.id, "permanent") ? (
                                                                    <Tooltip content={findStudentTeam(student.id, "permanent")}>
                                                                        <span className="inline-block max-w-70 sm:max-w-100 truncate text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded-md cursor-default">
                                                                            {findStudentTeam(student.id, "permanent")}
                                                                        </span>
                                                                    </Tooltip>
                                                                ) : (
                                                                    <span className="text-xs text-default-300">-</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {canManageSectionStudents && (
                                                                    <Tooltip content="นำออกจากกลุ่ม" color="danger">
                                                                        <Button
                                                                            isIconOnly
                                                                            size="sm"
                                                                            variant="light"
                                                                            color="danger"
                                                                            onPress={() => onOpenDeleteStudentModal(section.id, student)}
                                                                        >
                                                                            <Icon icon="solar:user-minus-bold" className="text-lg" />
                                                                        </Button>
                                                                    </Tooltip>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : sectionStudents[section.id] && sectionStudents[section.id].length > 0 ? (
                                        <div className="bg-content2/60 py-12 text-center">
                                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-content3">
                                                <Icon icon="solar:magnifer-linear" className="text-3xl text-default-400" />
                                            </div>
                                            <p className="font-medium text-default-500">ไม่พบนักศึกษาที่ค้นหา</p>
                                            <p className="mt-1 text-sm text-default-400">ลองเปลี่ยนคำค้นหาใหม่</p>
                                        </div>
                                    ) : (
                                        <div className="bg-content2/60 py-12 text-center">
                                            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-amber-100 flex items-center justify-center">
                                                <Icon icon="solar:users-group-rounded-bold-duotone" className="text-4xl text-amber-500" />
                                            </div>
                                            <p className="mb-1 font-medium text-default-600">ยังไม่มีนักศึกษาในกลุ่มนี้</p>
                                            <p className="mb-4 text-sm text-default-400">เพิ่มนักศึกษาเพื่อเริ่มต้นจัดการกลุ่มเรียน</p>
                                            {canManageSectionStudents && (
                                                <Button
                                                    color="primary"
                                                    variant="flat"
                                                    startContent={<Icon icon="solar:user-plus-bold" />}
                                                    onPress={() => onOpenAddStudentModal(section.id)}
                                                    className="text-amber-700"
                                                >
                                                    เพิ่มนักศึกษา
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </CardBody>
                            )}
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="border border-dashed border-default-300 bg-content2/50 shadow-sm">
                    <CardBody className="text-center py-16">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                            <Icon icon="solar:notebook-bold-duotone" className="text-5xl text-blue-500" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-default-700">ยังไม่มีกลุ่มเรียน</h3>
                        <p className="mx-auto mb-6 max-w-md text-default-500">
                            สร้างกลุ่มเรียนเพื่อจัดการนักศึกษาในรายวิชานี้
                        </p>
                        {canCreateSections && (
                            <Button
                                color="primary"
                                size="md"
                                startContent={<Icon icon="solar:add-circle-bold" />}
                                onPress={onOpenAddSectionModal}
                                isDisabled={!isCourseActive}
                                className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-indigo-500/25"
                            >
                                เพิ่มกลุ่มเรียนแรก
                            </Button>
                        )}
                    </CardBody>
                </Card>
            )}
        </div>
    );
});

// ============================================
// Permanent Teams Sub-Tab Component
// ============================================

interface PermanentTeamsSubTabProps {
    permanentTeams: PermanentTeam[];
    isTeamsLoading: boolean;
    isCourseActive?: boolean;
    canCreateTeams?: boolean;
    canUpdateTeams?: boolean;
    canDeleteTeams?: boolean;
    onOpenCreateTeamModal: (type: TeamType, method: TeamFormationMethod) => void;
    onOpenEditTeamModal: (teamId: number, type: TeamType, weekNumber?: number) => void;
    onOpenDeleteTeamModal: (teamId: number, type: TeamType, weekNumber?: number) => void;
}

const PermanentTeamsSubTab = React.memo(function PermanentTeamsSubTab({
    permanentTeams,
    isTeamsLoading,
    isCourseActive = true,
    canCreateTeams = false,
    canUpdateTeams = false,
    canDeleteTeams = false,
    onOpenCreateTeamModal,
    onOpenEditTeamModal,
    onOpenDeleteTeamModal,
}: PermanentTeamsSubTabProps) {
    const [searchQuery, setSearchQuery] = React.useState("");

    // Filter teams by search query
    const filteredTeams = React.useMemo(() => {
        if (!searchQuery.trim()) return permanentTeams;
        const query = searchQuery.toLowerCase().trim();
        return permanentTeams.filter(team =>
            team.name.toLowerCase().includes(query) ||
            team.members.some(member =>
                member.full_name.toLowerCase().includes(query) ||
                member.student_id.toLowerCase().includes(query)
            )
        );
    }, [permanentTeams, searchQuery]);

    return (
        <div className="space-y-4">
            {/* Search & Action Bar */}
            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardBody className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                        {/* Info - hidden on mobile */}
                        <div className="hidden md:flex items-center gap-3 shrink-0">
                            <div className="p-2 bg-purple-100 rounded-lg shrink-0">
                                <Icon icon="solar:info-circle-bold" className="text-xl text-purple-500" />
                            </div>
                            <div>
                                <p className="font-medium text-default-700">กลุ่มโปรเจกต์</p>
                                <p className="text-sm text-default-500">
                                    {searchQuery ? `พบ ${filteredTeams.length} จาก ${permanentTeams.length} กลุ่ม` : `${permanentTeams.length} กลุ่ม · ที่ใช้ตลอดทั้งเทอม`}
                                </p>
                            </div>
                        </div>
                        {/* Search + Buttons */}
                        <div className="flex items-center gap-2 flex-1 md:flex-initial md:w-auto justify-end">
                            <Input
                                placeholder="ค้นหากลุ่ม..."
                                value={searchQuery}
                                onValueChange={setSearchQuery}
                                startContent={<Icon icon="solar:magnifer-linear" className="text-purple-400 text-lg" />}
                                className="flex-1 md:w-48 lg:w-56"
                                size="md"
                                variant="bordered"
                                isClearable
                                classNames={{
                                    inputWrapper: "bg-content1 border-purple-200 hover:border-purple-300 focus-within:!border-purple-400",
                                }}
                            />
                            <Tooltip content="สุ่มกลุ่มอัตโนมัติ">
                                <Button
                                    color="secondary"
                                    variant="flat"
                                    isIconOnly
                                    onPress={() => onOpenCreateTeamModal("permanent", "random")}
                                    className="bg-purple-100 text-purple-700 shrink-0 md:hidden"
                                    size="md"
                                    isDisabled={isTeamsLoading || !isCourseActive || !canCreateTeams}
                                >
                                    <Icon icon="solar:shuffle-bold" className="text-lg" />
                                </Button>
                            </Tooltip>
                            <Button
                                color="secondary"
                                variant="flat"
                                startContent={<Icon icon="solar:shuffle-bold" />}
                                onPress={() => onOpenCreateTeamModal("permanent", "random")}
                                className="bg-purple-100 text-purple-700 shrink-0 hidden md:flex"
                                size="md"
                                isDisabled={isTeamsLoading || !isCourseActive || !canCreateTeams}
                            >
                                สุ่มกลุ่ม
                            </Button>
                            <Tooltip content="สร้างกลุ่มใหม่">
                                <Button
                                    color="primary"
                                    isIconOnly
                                    onPress={() => onOpenCreateTeamModal("permanent", "manual")}
                                    className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25 shrink-0 md:hidden"
                                    size="md"
                                    isDisabled={isTeamsLoading || !isCourseActive || !canCreateTeams}
                                >
                                    <Icon icon="solar:add-circle-bold" className="text-lg" />
                                </Button>
                            </Tooltip>
                            <Button
                                color="primary"
                                startContent={<Icon icon="solar:add-circle-bold" />}
                                onPress={() => onOpenCreateTeamModal("permanent", "manual")}
                                className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25 shrink-0 hidden md:flex"
                                size="md"
                                isDisabled={isTeamsLoading || !isCourseActive || !canCreateTeams}
                            >
                                สร้างกลุ่ม
                            </Button>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Teams Grid */}
            {isTeamsLoading ? (
                <TeamsGridSkeleton />
            ) : filteredTeams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTeams.map((team, idx) => (
                        <TeamCard
                            key={team.id}
                            team={team}
                            index={permanentTeams.findIndex(t => t.id === team.id)}
                            type="permanent"
                            onEdit={() => onOpenEditTeamModal(team.id, "permanent")}
                            onDelete={() => onOpenDeleteTeamModal(team.id, "permanent")}
                            canUpdateTeams={canUpdateTeams}
                            canDeleteTeams={canDeleteTeams}
                        />
                    ))}
                </div>
            ) : searchQuery ? (
                <Card className="shadow-sm border border-dashed border-purple-200 bg-purple-50/30">
                    <CardBody className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                            <Icon icon="solar:magnifer-linear" className="text-3xl text-purple-400" />
                        </div>
                        <p className="font-medium text-default-500">ไม่พบกลุ่มที่ค้นหา</p>
                        <p className="mt-1 text-sm text-default-400">ลองเปลี่ยนคำค้นหาใหม่</p>
                    </CardBody>
                </Card>
            ) : (
                <Card className="shadow-sm border border-dashed border-purple-200 bg-purple-50/30">
                    <CardBody className="text-center py-16">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-linear-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                            <Icon icon="solar:users-group-two-rounded-bold-duotone" className="text-5xl text-purple-500" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-default-700">ยังไม่มีกลุ่มโปรเจกต์</h3>
                        <p className="mx-auto mb-6 max-w-md text-default-500">
                            สร้างกลุ่มสำหรับโปรเจกต์หรืองานกลุ่มระยะยาวที่ต้องทำงานร่วมกันตลอดเทอม
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            {canCreateTeams && (
                                <Button
                                    variant="flat"
                                    startContent={<Icon icon="solar:shuffle-bold" />}
                                    onPress={() => onOpenCreateTeamModal("permanent", "random")}
                                    className="bg-purple-100 text-purple-700"
                                >
                                    สุ่มกลุ่มอัตโนมัติ
                                </Button>
                            )}
                            {canCreateTeams && (
                                <Button
                                    color="primary"
                                    startContent={<Icon icon="solar:add-circle-bold" />}
                                    onPress={() => onOpenCreateTeamModal("permanent", "manual")}
                                    className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                                >
                                    สร้างกลุ่มเอง
                                </Button>
                            )}
                        </div>
                    </CardBody>
                </Card>
            )}
        </div>
    );
});

// ============================================
// Weekly Teams Sub-Tab Component
// ============================================

interface WeeklyTeamsSubTabProps {
    weeklyTeams: Record<number, WeeklyTeam[]>;
    selectedWeek: number;
    totalWeeks: number;
    isTeamsLoading: boolean;
    isCourseActive?: boolean;
    canCreateTeams?: boolean;
    canUpdateTeams?: boolean;
    canDeleteTeams?: boolean;
    onWeekChange: (week: number) => void;
    onOpenCreateTeamModal: (type: TeamType, method: TeamFormationMethod) => void;
    onOpenEditTeamModal: (teamId: number, type: TeamType, weekNumber?: number) => void;
    onOpenDeleteTeamModal: (teamId: number, type: TeamType, weekNumber?: number) => void;
    onCopyTeamsFromWeek: (sourceWeek: number) => void;
    onOpenBulkDeleteModal: () => void;
}

const WeeklyTeamsSubTab = React.memo(function WeeklyTeamsSubTab({
    weeklyTeams,
    selectedWeek,
    totalWeeks,
    isTeamsLoading,
    isCourseActive = true,
    canCreateTeams = false,
    canUpdateTeams = false,
    canDeleteTeams = false,
    onWeekChange,
    onOpenCreateTeamModal,
    onOpenEditTeamModal,
    onOpenDeleteTeamModal,
    onCopyTeamsFromWeek,
    onOpenBulkDeleteModal,
}: WeeklyTeamsSubTabProps) {
    const [searchQuery, setSearchQuery] = React.useState("");

    const hasOtherWeeksWithTeams = Object.keys(weeklyTeams).some(
        k => parseInt(k) !== selectedWeek && weeklyTeams[parseInt(k)]?.length > 0
    );

    // Filter teams by search query
    const currentWeekTeams = weeklyTeams[selectedWeek] || [];
    const filteredTeams = React.useMemo(() => {
        if (!searchQuery.trim()) return currentWeekTeams;
        const query = searchQuery.toLowerCase().trim();
        return currentWeekTeams.filter(team =>
            team.name.toLowerCase().includes(query) ||
            team.members.some(member =>
                member.full_name.toLowerCase().includes(query) ||
                member.student_id.toLowerCase().includes(query)
            )
        );
    }, [currentWeekTeams, searchQuery]);

    return (
        <div className="space-y-4">
            {/* Search & Week Selector Bar */}
            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardBody className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                        {/* Info - hidden on mobile */}
                        <div className="hidden md:flex items-center gap-3 shrink-0">
                            <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                                <Icon icon="solar:calendar-bold" className="text-xl text-emerald-500" />
                            </div>
                            <div>
                                <p className="font-medium text-default-700">สัปดาห์ที่ {selectedWeek}</p>
                                <p className="text-sm text-default-500">
                                    {searchQuery ? `พบ ${filteredTeams.length} จาก ${currentWeekTeams.length} กลุ่ม` : `${currentWeekTeams.length} กลุ่ม`}
                                </p>
                            </div>
                        </div>
                        {/* Search + Buttons */}
                        <div className="flex items-center gap-2 flex-1 md:flex-initial md:w-auto justify-end">
                            <Input
                                placeholder="ค้นหากลุ่ม..."
                                value={searchQuery}
                                onValueChange={setSearchQuery}
                                startContent={<Icon icon="solar:magnifer-linear" className="text-emerald-400 text-lg" />}
                                className="flex-1 md:w-48 lg:w-56"
                                size="md"
                                variant="bordered"
                                isClearable
                                classNames={{
                                    inputWrapper: "bg-content1 border-emerald-200 hover:border-emerald-300 focus-within:!border-emerald-400",
                                }}
                            />
                            {/* Copy dropdown */}
                            {!weeklyTeams[selectedWeek]?.length && hasOtherWeeksWithTeams && (
                                <Dropdown>
                                    <DropdownTrigger>
                                        <Button
                                            variant="flat"
                                            size="md"
                                            isIconOnly
                                            className="bg-content3 text-default-600 shrink-0 md:hidden"
                                        >
                                            <Icon icon="solar:copy-bold" className="text-lg" />
                                        </Button>
                                    </DropdownTrigger>
                                    <DropdownMenu
                                        aria-label="เลือกสัปดาห์ที่จะคัดลอก"
                                        onAction={(key) => onCopyTeamsFromWeek(parseInt(key as string))}
                                    >
                                        {Array.from({ length: totalWeeks }, (_, i) => i + 1)
                                            .filter(week => week !== selectedWeek && weeklyTeams[week]?.length > 0)
                                            .map((week) => (
                                                <DropdownItem
                                                    key={week.toString()}
                                                    startContent={<Icon icon="solar:calendar-linear" className="text-emerald-500" />}
                                                    description={`${weeklyTeams[week]?.length || 0} กลุ่ม`}
                                                >
                                                    สัปดาห์ที่ {week}
                                                </DropdownItem>
                                            ))
                                        }
                                    </DropdownMenu>
                                </Dropdown>
                            )}
                            {!weeklyTeams[selectedWeek]?.length && hasOtherWeeksWithTeams && (
                                <Dropdown>
                                    <DropdownTrigger>
                                        <Button
                                            variant="flat"
                                            size="md"
                                            startContent={<Icon icon="solar:copy-bold" />}
                                            className="bg-content3 text-default-600 shrink-0 hidden md:flex"
                                        >
                                            คัดลอก
                                        </Button>
                                    </DropdownTrigger>
                                    <DropdownMenu
                                        aria-label="เลือกสัปดาห์ที่จะคัดลอก"
                                        onAction={(key) => onCopyTeamsFromWeek(parseInt(key as string))}
                                    >
                                        {Array.from({ length: totalWeeks }, (_, i) => i + 1)
                                            .filter(week => week !== selectedWeek && weeklyTeams[week]?.length > 0)
                                            .map((week) => (
                                                <DropdownItem
                                                    key={week.toString()}
                                                    startContent={<Icon icon="solar:calendar-linear" className="text-emerald-500" />}
                                                    description={`${weeklyTeams[week]?.length || 0} กลุ่ม`}
                                                >
                                                    สัปดาห์ที่ {week}
                                                </DropdownItem>
                                            ))
                                        }
                                    </DropdownMenu>
                                </Dropdown>
                            )}
                            {/* Delete all */}
                            {weeklyTeams[selectedWeek]?.length > 0 && canDeleteTeams && (
                                <>
                                    <Tooltip content="ลบกลุ่มทั้งหมด" color="danger">
                                        <Button
                                            variant="flat"
                                            size="md"
                                            color="danger"
                                            isIconOnly
                                            onPress={onOpenBulkDeleteModal}
                                            className="shrink-0"
                                        >
                                            <Icon icon="solar:eraser-bold" className="text-lg" />
                                        </Button>
                                    </Tooltip>
                                </>
                            )}
                            {/* Random */}
                            <Tooltip content="สุ่มกลุ่มอัตโนมัติ">
                                <Button
                                    variant="flat"
                                    size="md"
                                    isIconOnly
                                    isDisabled={!isCourseActive || !canCreateTeams}
                                    onPress={() => onOpenCreateTeamModal("weekly", "random")}
                                    className="bg-emerald-100 text-emerald-700 shrink-0 md:hidden"
                                >
                                    <Icon icon="solar:shuffle-bold" className="text-lg" />
                                </Button>
                            </Tooltip>
                            <Button
                                variant="flat"
                                size="md"
                                startContent={<Icon icon="solar:shuffle-bold" />}
                                isDisabled={!isCourseActive || !canCreateTeams}
                                onPress={() => onOpenCreateTeamModal("weekly", "random")}
                                className="bg-emerald-100 text-emerald-700 shrink-0 hidden md:flex"
                            >
                                สุ่มกลุ่ม
                            </Button>
                            {/* Create */}
                            <Tooltip content="สร้างกลุ่มเอง">
                                <Button
                                    color="primary"
                                    size="md"
                                    isIconOnly
                                    isDisabled={!isCourseActive || !canCreateTeams}
                                    onPress={() => onOpenCreateTeamModal("weekly", "manual")}
                                    className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25 shrink-0 md:hidden"
                                >
                                    <Icon icon="solar:add-circle-bold" className="text-lg" />
                                </Button>
                            </Tooltip>
                            <Button
                                color="primary"
                                size="md"
                                startContent={<Icon icon="solar:add-circle-bold" />}
                                isDisabled={!isCourseActive || !canCreateTeams}
                                onPress={() => onOpenCreateTeamModal("weekly", "manual")}
                                className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25 shrink-0 hidden md:flex"
                            >
                                สร้างกลุ่ม
                            </Button>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Week Navigation Pills */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 lg:mx-0 lg:px-1">
                {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((week) => {
                    const hasTeams = weeklyTeams[week] && weeklyTeams[week].length > 0;
                    const isSelected = week === selectedWeek;
                    return (
                        <button
                            key={week}
                            onClick={() => onWeekChange(week)}
                            className={`shrink-0 px-4 py-2 rounded-xl font-medium text-sm transition-all ${isSelected
                                ? "bg-linear-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                                : hasTeams
                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                    : "bg-content3 text-default-500 hover:bg-content4"
                                }`}
                        >
                            W{week}
                            {hasTeams && !isSelected && (
                                <Icon icon="solar:check-circle-bold" className="ml-1 text-emerald-500" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Teams Grid */}
            {isTeamsLoading ? (
                <TeamsGridSkeleton />
            ) : filteredTeams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTeams.map((team, idx) => (
                        <TeamCard
                            key={team.id}
                            team={team}
                            index={currentWeekTeams.findIndex(t => t.id === team.id)}
                            type="weekly"
                            weekNumber={selectedWeek}
                            onEdit={() => onOpenEditTeamModal(team.id, "weekly", selectedWeek)}
                            onDelete={() => onOpenDeleteTeamModal(team.id, "weekly", selectedWeek)}
                            canUpdateTeams={canUpdateTeams}
                            canDeleteTeams={canDeleteTeams}
                        />
                    ))}
                </div>
            ) : searchQuery ? (
                <Card className="shadow-sm border border-dashed border-emerald-200 bg-emerald-50/30">
                    <CardBody className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Icon icon="solar:magnifer-linear" className="text-3xl text-emerald-400" />
                        </div>
                        <p className="font-medium text-default-500">ไม่พบกลุ่มที่ค้นหา</p>
                        <p className="mt-1 text-sm text-default-400">ลองเปลี่ยนคำค้นหาใหม่</p>
                    </CardBody>
                </Card>
            ) : (
                <Card className="shadow-sm border border-dashed border-emerald-200 bg-emerald-50/30">
                    <CardBody className="text-center py-16">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-linear-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                            <Icon icon="solar:calendar-bold-duotone" className="text-5xl text-emerald-500" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-default-700">ยังไม่มีกลุ่มสำหรับสัปดาห์ที่ {selectedWeek}</h3>
                        <p className="mx-auto mb-6 max-w-md text-default-500">
                            สร้างกลุ่มใหม่หรือคัดลอกจากสัปดาห์ก่อนหน้าเพื่อเริ่มต้น
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            {hasOtherWeeksWithTeams && canCreateTeams && (
                                <Dropdown>
                                    <DropdownTrigger>
                                        <Button
                                            variant="flat"
                                            startContent={<Icon icon="solar:copy-bold" />}
                                            endContent={<Icon icon="solar:alt-arrow-down-linear" className="text-sm" />}
                                            className="bg-content3 text-default-600"
                                        >
                                            คัดลอกจากสัปดาห์อื่น
                                        </Button>
                                    </DropdownTrigger>
                                    <DropdownMenu
                                        aria-label="เลือกสัปดาห์ที่จะคัดลอก"
                                        onAction={(key) => onCopyTeamsFromWeek(parseInt(key as string))}
                                    >
                                        {Array.from({ length: totalWeeks }, (_, i) => i + 1)
                                            .filter(week => week !== selectedWeek && weeklyTeams[week]?.length > 0)
                                            .map((week) => (
                                                <DropdownItem
                                                    key={week.toString()}
                                                    startContent={<Icon icon="solar:calendar-linear" className="text-emerald-500" />}
                                                    description={`${weeklyTeams[week]?.length || 0} กลุ่ม`}
                                                >
                                                    สัปดาห์ที่ {week}
                                                </DropdownItem>
                                            ))
                                        }
                                    </DropdownMenu>
                                </Dropdown>
                            )}
                            {canCreateTeams && (
                                <Button
                                    variant="flat"
                                    startContent={<Icon icon="solar:shuffle-bold" />}
                                    onPress={() => onOpenCreateTeamModal("weekly", "random")}
                                    className="bg-emerald-100 text-emerald-700"
                                >
                                    สุ่มกลุ่มอัตโนมัติ
                                </Button>
                            )}
                            {canCreateTeams && (
                                <Button
                                    color="primary"
                                    startContent={<Icon icon="solar:add-circle-bold" />}
                                    onPress={() => onOpenCreateTeamModal("weekly", "manual")}
                                    className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                                >
                                    สร้างกลุ่มเอง
                                </Button>
                            )}
                        </div>
                    </CardBody>
                </Card>
            )}
        </div>
    );
});

// ============================================
// Export with React.memo
// ============================================

export const SectionsTabView = React.memo(SectionsTabViewComponent);
