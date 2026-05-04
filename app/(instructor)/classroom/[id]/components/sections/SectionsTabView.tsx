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
import type { Course, SectionStudent } from "@/services/course.service";
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


    // Handlers
    onSubTabChange: (tab: SectionSubTab) => void;
    onSearchQueryChange: (query: string) => void;
    onWeekChange: (week: number) => void;
    onToggleSection: (sectionId: number) => void;
    onOpenAddSectionModal: () => void;
    onOpenAddStudentModal: (sectionId: number) => void;
    onRemoveSection: (sectionId: number) => void;
    onOpenDeleteStudentModal: (sectionId: number, student: SectionStudent) => void;
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
    onToggle,
    onAddStudent,
    onEdit,
    onRemove,
}: SectionHeaderProps) {
    return (
        <div
            className={`flex items-center justify-between p-4 cursor-pointer transition-all ${isExpanded
                ? "bg-gradient-to-r from-blue-400 to-indigo-500"
                : "bg-white hover:from-amber-50 hover:to-blue-50"
                }`}
            onClick={onToggle}
        >
            <div className="flex items-center gap-4">
                <div>
                    <p className={`font-semibold ${isExpanded ? "text-white" : "text-slate-800"}`}>
                        Section {sectionNo}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <Icon
                            icon="solar:users-group-rounded-linear"
                            className={isExpanded ? "text-white/70" : "text-slate-400"}
                        />
                        <span className={`text-sm ${isExpanded ? "text-white/80" : "text-slate-500"}`}>
                            {studentCount} นักศึกษา
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                <div
                    className={`ml-2 p-1 rounded-lg ${isExpanded ? "bg-white/20" : "bg-slate-200"}`}
                    onClick={onToggle}
                >
                    <Icon
                        icon={isExpanded ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
                        className={`text-xl ${isExpanded ? "text-white" : "text-slate-500"}`}
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
}

const TeamCard = React.memo(function TeamCard({
    team,
    index,
    type,
    onEdit,
    onDelete,
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
        ? "hover:bg-purple-50"
        : "hover:bg-emerald-50";

    return (
        <Card className={`shadow-sm border border-slate-200 hover:shadow-lg ${hoverClass} transition-all group`}>
            <CardHeader className={`px-4 py-3 bg-gradient-to-r ${gradientClass}`}>
                <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-white flex-shrink-0">
                            {index + 1}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                            <Tooltip content={team.name}>
                                <p className="font-semibold text-white truncate cursor-default">{team.name}</p>
                            </Tooltip>
                            <p className="text-xs text-white/70">{team.members.length} สมาชิก</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
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
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${memberBgClass} flex items-center justify-center text-white text-xs font-medium`}>
                                {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{member.full_name}</p>
                                <p className="text-xs text-slate-400">{member.student_id}</p>
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
    onSubTabChange,
    onSearchQueryChange,
    onWeekChange,
    onToggleSection,
    onOpenAddSectionModal,
    onOpenAddStudentModal,
    onRemoveSection,
    onOpenDeleteStudentModal,
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
                            <h2 className="text-lg font-semibold text-slate-800">จัดการกลุ่มเรียน</h2>
                            <p className="text-sm text-slate-500">จัดการนักศึกษาและกลุ่มทำงานในรายวิชา</p>
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
                        tabContent: "group-data-[selected=true]:text-blue-600 text-slate-500 font-medium text-sm"
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
                    onSearchQueryChange={onSearchQueryChange}
                    onOpenAddSectionModal={onOpenAddSectionModal}
                    onToggleSection={onToggleSection}
                    onOpenAddStudentModal={onOpenAddStudentModal}
                    onRemoveSection={onRemoveSection}
                    onOpenDeleteStudentModal={onOpenDeleteStudentModal}
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
    isCourseActive?: boolean;
    onSearchQueryChange: (query: string) => void;
    onOpenAddSectionModal: () => void;
    onToggleSection: (sectionId: number) => void;
    onOpenAddStudentModal: (sectionId: number) => void;
    onRemoveSection: (sectionId: number) => void;
    onOpenDeleteStudentModal: (sectionId: number, student: SectionStudent) => void;
    onOpenEditSectionModal: (sectionId: number) => void;
    getFilteredSectionStudents: (sectionId: number) => SectionStudent[];
    findStudentTeam: (studentId: number, type: TeamType, weekNumber?: number) => string | null;
}

const StudentsSubTab = React.memo(function StudentsSubTab({
    course,
    sectionSearchQuery,
    expandedSections,
    sectionStudents,
    isCourseActive = true,
    onSearchQueryChange,
    onOpenAddSectionModal,
    onToggleSection,
    onOpenAddStudentModal,
    onRemoveSection,
    onOpenDeleteStudentModal,
    onOpenEditSectionModal,
    getFilteredSectionStudents,
    findStudentTeam,
}: StudentsSubTabProps) {
    return (
        <div className="space-y-4">
            {/* Search & Actions Bar */}
            <Card className="shadow-sm border border-slate-200">
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
                                    inputWrapper: "border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-blue-400 text-sm",
                                }}
                            />
                        </div>
                        <Button
                            color="primary"
                            startContent={<Icon icon="solar:add-circle-bold" />}
                            onPress={onOpenAddSectionModal}
                            isDisabled={!isCourseActive}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-indigo-500/25 w-full sm:w-auto"
                        >
                            เพิ่มกลุ่มเรียน
                        </Button>
                    </div>
                </CardBody>
            </Card>

            {/* Sections */}
            {course.sections && course.sections.length > 0 ? (
                <div className="space-y-4">
                    {course.sections.map((section) => (
                        <Card key={section.id} className="shadow-sm border border-slate-200 overflow-hidden">
                            <SectionHeader
                                sectionNo={section.section_no}
                                studentCount={section.studentCount || 0}
                                isExpanded={expandedSections.includes(section.id)}
                                isCourseActive={isCourseActive}
                                onToggle={() => onToggleSection(section.id)}
                                onAddStudent={() => onOpenAddStudentModal(section.id)}
                                onEdit={() => onOpenEditSectionModal(section.id)}
                                onRemove={() => onRemoveSection(section.id)}
                            />

                            {/* Student Table */}
                            {expandedSections.includes(section.id) && (
                                <CardBody className="p-0 bg-white overflow-hidden">
                                    {getFilteredSectionStudents(section.id).length > 0 ? (
                                        <div className="overflow-x-auto max-w-full">
                                            <Table
                                                aria-label={`นักศึกษากลุ่ม ${section.section_no}`}
                                                removeWrapper
                                                classNames={{
                                                    base: "min-w-[640px]",
                                                    th: "bg-slate-50/80 text-slate-600 font-semibold text-xs uppercase tracking-wide",
                                                    td: "py-3 border-b border-slate-50",
                                                    tr: "hover:bg-amber-50/50 transition-colors",
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
                                                                <div className="text-sm font-medium text-black text-center">{idx + 1}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="text-xs font-medium text-black">{student.student_id}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <Avatar
                                                                        name={student.full_name}
                                                                        size="sm"
                                                                        className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex-shrink-0"
                                                                    />
                                                                    <span className="font-medium text-black text-sm whitespace-nowrap">{student.full_name}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {findStudentTeam(student.id, "permanent") ? (
                                                                    <Tooltip content={findStudentTeam(student.id, "permanent")}>
                                                                        <span className="inline-block max-w-[280px] sm:max-w-[400px] truncate text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded-md cursor-default">
                                                                            {findStudentTeam(student.id, "permanent")}
                                                                        </span>
                                                                    </Tooltip>
                                                                ) : (
                                                                    <span className="text-slate-300 text-xs">-</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
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
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : sectionStudents[section.id] && sectionStudents[section.id].length > 0 ? (
                                        <div className="text-center py-12 bg-slate-50/50">
                                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                                <Icon icon="solar:magnifer-linear" className="text-3xl text-slate-400" />
                                            </div>
                                            <p className="text-slate-500 font-medium">ไม่พบนักศึกษาที่ค้นหา</p>
                                            <p className="text-sm text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาใหม่</p>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-gradient-to-b from-slate-50 to-white">
                                            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-amber-100 flex items-center justify-center">
                                                <Icon icon="solar:users-group-rounded-bold-duotone" className="text-4xl text-amber-500" />
                                            </div>
                                            <p className="text-slate-600 font-medium mb-1">ยังไม่มีนักศึกษาในกลุ่มนี้</p>
                                            <p className="text-sm text-slate-400 mb-4">เพิ่มนักศึกษาเพื่อเริ่มต้นจัดการกลุ่มเรียน</p>
                                            <Button
                                                color="primary"
                                                variant="flat"
                                                startContent={<Icon icon="solar:user-plus-bold" />}
                                                onPress={() => onOpenAddStudentModal(section.id)}
                                                className="text-amber-700"
                                            >
                                                เพิ่มนักศึกษา
                                            </Button>
                                        </div>
                                    )}
                                </CardBody>
                            )}
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="shadow-sm border border-dashed border-slate-300 bg-slate-50/50">
                    <CardBody className="text-center py-16">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                            <Icon icon="solar:notebook-bold-duotone" className="text-5xl text-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">ยังไม่มีกลุ่มเรียน</h3>
                        <p className="text-slate-500 mb-6 max-w-md mx-auto">
                            สร้างกลุ่มเรียนเพื่อจัดการนักศึกษาในรายวิชานี้
                        </p>
                        <Button
                            color="primary"
                            size="md"
                            startContent={<Icon icon="solar:add-circle-bold" />}
                            onPress={onOpenAddSectionModal}
                            isDisabled={!isCourseActive}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-indigo-500/25"
                        >
                            เพิ่มกลุ่มเรียนแรก
                        </Button>
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
    onOpenCreateTeamModal: (type: TeamType, method: TeamFormationMethod) => void;
    onOpenEditTeamModal: (teamId: number, type: TeamType, weekNumber?: number) => void;
    onOpenDeleteTeamModal: (teamId: number, type: TeamType, weekNumber?: number) => void;
}

const PermanentTeamsSubTab = React.memo(function PermanentTeamsSubTab({
    permanentTeams,
    isTeamsLoading,
    isCourseActive = true,
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
            <Card className="shadow-sm border border-slate-200">
                <CardBody className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                        {/* Info - hidden on mobile */}
                        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                            <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                                <Icon icon="solar:info-circle-bold" className="text-xl text-purple-500" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-700">กลุ่มโปรเจกต์</p>
                                <p className="text-sm text-slate-500">
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
                                    inputWrapper: "border-purple-200 hover:border-purple-300 focus-within:!border-purple-400",
                                }}
                            />
                            <Tooltip content="สุ่มกลุ่มอัตโนมัติ">
                                <Button
                                    color="secondary"
                                    variant="flat"
                                    isIconOnly
                                    onPress={() => onOpenCreateTeamModal("permanent", "random")}
                                    className="bg-purple-100 text-purple-700 flex-shrink-0 md:hidden"
                                    size="md"
                                    isDisabled={isTeamsLoading || !isCourseActive}
                                >
                                    <Icon icon="solar:shuffle-bold" className="text-lg" />
                                </Button>
                            </Tooltip>
                            <Button
                                color="secondary"
                                variant="flat"
                                startContent={<Icon icon="solar:shuffle-bold" />}
                                onPress={() => onOpenCreateTeamModal("permanent", "random")}
                                className="bg-purple-100 text-purple-700 flex-shrink-0 hidden md:flex"
                                size="md"
                                isDisabled={isTeamsLoading || !isCourseActive}
                            >
                                สุ่มกลุ่ม
                            </Button>
                            <Tooltip content="สร้างกลุ่มใหม่">
                                <Button
                                    color="primary"
                                    isIconOnly
                                    onPress={() => onOpenCreateTeamModal("permanent", "manual")}
                                    className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25 flex-shrink-0 md:hidden"
                                    size="md"
                                    isDisabled={isTeamsLoading || !isCourseActive}
                                >
                                    <Icon icon="solar:add-circle-bold" className="text-lg" />
                                </Button>
                            </Tooltip>
                            <Button
                                color="primary"
                                startContent={<Icon icon="solar:add-circle-bold" />}
                                onPress={() => onOpenCreateTeamModal("permanent", "manual")}
                                className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25 flex-shrink-0 hidden md:flex"
                                size="md"
                                isDisabled={isTeamsLoading || !isCourseActive}
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
                        />
                    ))}
                </div>
            ) : searchQuery ? (
                <Card className="shadow-sm border border-dashed border-purple-200 bg-purple-50/30">
                    <CardBody className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                            <Icon icon="solar:magnifer-linear" className="text-3xl text-purple-400" />
                        </div>
                        <p className="text-slate-500 font-medium">ไม่พบกลุ่มที่ค้นหา</p>
                        <p className="text-sm text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาใหม่</p>
                    </CardBody>
                </Card>
            ) : (
                <Card className="shadow-sm border border-dashed border-purple-200 bg-purple-50/30">
                    <CardBody className="text-center py-16">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                            <Icon icon="solar:users-group-two-rounded-bold-duotone" className="text-5xl text-purple-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">ยังไม่มีกลุ่มโปรเจกต์</h3>
                        <p className="text-slate-500 mb-6 max-w-md mx-auto">
                            สร้างกลุ่มสำหรับโปรเจกต์หรืองานกลุ่มระยะยาวที่ต้องทำงานร่วมกันตลอดเทอม
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <Button
                                variant="flat"
                                startContent={<Icon icon="solar:shuffle-bold" />}
                                onPress={() => onOpenCreateTeamModal("permanent", "random")}
                                className="bg-purple-100 text-purple-700"
                            >
                                สุ่มกลุ่มอัตโนมัติ
                            </Button>
                            <Button
                                color="primary"
                                startContent={<Icon icon="solar:add-circle-bold" />}
                                onPress={() => onOpenCreateTeamModal("permanent", "manual")}
                                className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                            >
                                สร้างกลุ่มเอง
                            </Button>
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
            <Card className="shadow-sm border border-slate-200">
                <CardBody className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                        {/* Info - hidden on mobile */}
                        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                            <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
                                <Icon icon="solar:calendar-bold" className="text-xl text-emerald-500" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-700">สัปดาห์ที่ {selectedWeek}</p>
                                <p className="text-sm text-slate-500">
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
                                    inputWrapper: "border-emerald-200 hover:border-emerald-300 focus-within:!border-emerald-400",
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
                                            className="bg-slate-100 flex-shrink-0 md:hidden"
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
                                            className="bg-slate-100 flex-shrink-0 hidden md:flex"
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
                            {weeklyTeams[selectedWeek]?.length > 0 && (
                                <>
                                    <Tooltip content="ลบกลุ่มทั้งหมด" color="danger">
                                        <Button
                                            variant="flat"
                                            size="md"
                                            color="danger"
                                            isIconOnly
                                            onPress={onOpenBulkDeleteModal}
                                            className="flex-shrink-0"
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
                                    isDisabled={!isCourseActive}
                                    onPress={() => onOpenCreateTeamModal("weekly", "random")}
                                    className="bg-emerald-100 text-emerald-700 flex-shrink-0 md:hidden"
                                >
                                    <Icon icon="solar:shuffle-bold" className="text-lg" />
                                </Button>
                            </Tooltip>
                            <Button
                                variant="flat"
                                size="md"
                                startContent={<Icon icon="solar:shuffle-bold" />}
                                isDisabled={!isCourseActive}
                                onPress={() => onOpenCreateTeamModal("weekly", "random")}
                                className="bg-emerald-100 text-emerald-700 flex-shrink-0 hidden md:flex"
                            >
                                สุ่มกลุ่ม
                            </Button>
                            {/* Create */}
                            <Tooltip content="สร้างกลุ่มเอง">
                                <Button
                                    color="primary"
                                    size="md"
                                    isIconOnly
                                    isDisabled={!isCourseActive}
                                    onPress={() => onOpenCreateTeamModal("weekly", "manual")}
                                    className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25 flex-shrink-0 md:hidden"
                                >
                                    <Icon icon="solar:add-circle-bold" className="text-lg" />
                                </Button>
                            </Tooltip>
                            <Button
                                color="primary"
                                size="md"
                                startContent={<Icon icon="solar:add-circle-bold" />}
                                isDisabled={!isCourseActive}
                                onPress={() => onOpenCreateTeamModal("weekly", "manual")}
                                className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25 flex-shrink-0 hidden md:flex"
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
                            className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium text-sm transition-all ${isSelected
                                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                                : hasTeams
                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
                        />
                    ))}
                </div>
            ) : searchQuery ? (
                <Card className="shadow-sm border border-dashed border-emerald-200 bg-emerald-50/30">
                    <CardBody className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Icon icon="solar:magnifer-linear" className="text-3xl text-emerald-400" />
                        </div>
                        <p className="text-slate-500 font-medium">ไม่พบกลุ่มที่ค้นหา</p>
                        <p className="text-sm text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาใหม่</p>
                    </CardBody>
                </Card>
            ) : (
                <Card className="shadow-sm border border-dashed border-emerald-200 bg-emerald-50/30">
                    <CardBody className="text-center py-16">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                            <Icon icon="solar:calendar-bold-duotone" className="text-5xl text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">ยังไม่มีกลุ่มสำหรับสัปดาห์ที่ {selectedWeek}</h3>
                        <p className="text-slate-500 mb-6 max-w-md mx-auto">
                            สร้างกลุ่มใหม่หรือคัดลอกจากสัปดาห์ก่อนหน้าเพื่อเริ่มต้น
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            {hasOtherWeeksWithTeams && (
                                <Dropdown>
                                    <DropdownTrigger>
                                        <Button
                                            variant="flat"
                                            startContent={<Icon icon="solar:copy-bold" />}
                                            endContent={<Icon icon="solar:alt-arrow-down-linear" className="text-sm" />}
                                            className="bg-slate-100"
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
                            <Button
                                variant="flat"
                                startContent={<Icon icon="solar:shuffle-bold" />}
                                onPress={() => onOpenCreateTeamModal("weekly", "random")}
                                className="bg-emerald-100 text-emerald-700"
                            >
                                สุ่มกลุ่มอัตโนมัติ
                            </Button>
                            <Button
                                color="primary"
                                startContent={<Icon icon="solar:add-circle-bold" />}
                                onPress={() => onOpenCreateTeamModal("weekly", "manual")}
                                className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                            >
                                สร้างกลุ่มเอง
                            </Button>
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
