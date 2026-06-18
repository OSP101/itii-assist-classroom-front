"use client";

import React, { memo, useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { ScoresSkeleton } from "../Skeletons";
import type { ScoreSummaryMatrix } from "@/services/score.service";
import {
    AssignmentTabType,
    ScoreDetailModal,
    ColumnDef,
    AssignmentGroup,
    toNum,
    fmtScore,
    formatDate,
    getScoreColor,
} from "./config";

function localizeGeneratedSubItemName(name: string | undefined, isEnglish: boolean): string {
    if (!name) {
        return isEnglish ? "Item 1" : "ข้อ 1";
    }

    if (!isEnglish) {
        return name;
    }

    const match = name.match(/^ข้อ\s*(\d+)$/);
    if (match) {
        return `Item ${match[1]}`;
    }

    return name;
}

interface StudentType {
    student_id: string;
    full_name: string;
    section_number: string | number;
    total_score: number;
    total_max_score: number;
    bonus_score: number;
    scores?: Record<string, {
        score: number | null;
        max_score: number;
        sub_item_name?: string;
        graded_by?: string | null;
        graded_at?: string | null;
        updated_at?: string | null;
        comment?: string | null;
        edit_requests?: {
            old_score: number | null;
            new_score: number;
            reason: string | null;
            requester: string | null;
            reviewer: string | null;
            reviewed_at: string | null;
            review_comment: string | null;
        }[];
    }>;
}

interface ScoreSummaryTabViewProps {
    // State
    selectedTab: AssignmentTabType;
    selectedSection: string;
    searchQuery: string;
    isLoading: boolean;
    hoverRowId: string | null;
    hoverColKey: string | null;
    scoreModal: ScoreDetailModal;
    matrixData: ScoreSummaryMatrix | null;

    // Computed
    filteredStudents: StudentType[];
    columns: ColumnDef[];
    assignmentGroups: AssignmentGroup[];
    totalMaxScore: number;
    classAverage: number;
    labCount: number;
    assignmentCount: number;
    groupCount: number;

    // Actions
    onSetSelectedTab: (tab: AssignmentTabType) => void;
    onSetSelectedSection: (section: string) => void;
    onSetSearchQuery: (query: string) => void;
    onSetHoverRowId: (id: string | null) => void;
    onSetHoverColKey: (key: string | null) => void;
    onScoreClick: (
        student: StudentType,
        col: ColumnDef,
        scoreData: {
            score: number | null;
            max_score: number;
            sub_item_name?: string;
            graded_by?: string | null;
            graded_at?: string | null;
            updated_at?: string | null;
            comment?: string | null;
            edit_requests?: {
                old_score: number | null;
                new_score: number;
                reason: string | null;
                requester: string | null;
                reviewer: string | null;
                reviewed_at: string | null;
                review_comment: string | null;
            }[];
        } | undefined
    ) => void;
    onCloseScoreModal: () => void;
    isCourseActive?: boolean;
}

const ScoreSummaryTabView = memo(function ScoreSummaryTabView({
    selectedTab,
    selectedSection,
    searchQuery,
    isLoading,
    hoverRowId,
    hoverColKey,
    scoreModal,
    matrixData,
    filteredStudents,
    columns,
    assignmentGroups,
    totalMaxScore,
    classAverage,
    labCount,
    assignmentCount,
    groupCount,
    onSetSelectedTab,
    onSetSelectedSection,
    onSetSearchQuery,
    onSetHoverRowId,
    onSetHoverColKey,
    onScoreClick,
    onCloseScoreModal,
    isCourseActive = true,
}: ScoreSummaryTabViewProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const [isEditHistoryOpen, setIsEditHistoryOpen] = useState(false);

    const hasEditHistory = useMemo(() => (scoreModal.editRequests?.length ?? 0) > 0, [scoreModal.editRequests]);
    const gradedAtLabel = useMemo(() => formatDate(scoreModal.gradedAt, isEnglish), [scoreModal.gradedAt, isEnglish]);
    const updatedAtLabel = useMemo(() => formatDate(scoreModal.updatedAt, isEnglish), [scoreModal.updatedAt, isEnglish]);
    const shouldShowUpdatedAt = useMemo(() => {
        if (!scoreModal.updatedAt || !scoreModal.gradedAt) return false;
        return updatedAtLabel !== gradedAtLabel;
    }, [scoreModal.updatedAt, scoreModal.gradedAt, updatedAtLabel, gradedAtLabel]);

    useEffect(() => {
        if (!scoreModal.isOpen) {
            setIsEditHistoryOpen(false);
        }
    }, [scoreModal.isOpen]);

    if (isLoading) {
        return <ScoresSkeleton />;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{isEnglish ? "Classroom scores" : "คะแนนในชั้นเรียน"}</h2>
                    <p className="text-sm text-default-500">{isEnglish ? "View the overall score summary for all students." : "ดูภาพรวมคะแนนทั้งหมดของนักศึกษา"}</p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => onSetSelectedTab(key as AssignmentTabType)}
                variant="underlined"
                classNames={{
                    tabList: "gap-4 md:gap-6 flex-nowrap min-w-max",
                    cursor: "bg-blue-500",
                    tab: "px-0 h-10",
                    tabContent: "group-data-[selected=true]:text-blue-600 text-default-500 font-medium text-sm",
                }}
            >
                <Tab
                    key="lab"
                    title={
                        <div className="flex items-center gap-2">
                            <span>Laboratory</span>
                            {labCount > 0 && (
                                <Chip size="sm" variant="flat" className="bg-indigo-100 text-indigo-600 h-5 px-1.5 text-xs">
                                    {labCount}
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
                            {assignmentCount > 0 && (
                                <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-600 h-5 px-1.5 text-xs">
                                    {assignmentCount}
                                </Chip>
                            )}
                        </div>
                    }
                />
                <Tab
                    key="group"
                    title={
                        <div className="flex items-center gap-2">
                            <span>{isEnglish ? "Group work" : "งานกลุ่ม"}</span>
                            {groupCount > 0 && (
                                <Chip size="sm" variant="flat" className="bg-emerald-100 text-emerald-600 h-5 px-1.5 text-xs">
                                    {groupCount}
                                </Chip>
                            )}
                        </div>
                    }
                />
            </Tabs>

            {/* Filter Bar */}
            <Card className="shadow-sm">
                <CardBody className="py-3 px-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                        <div className="flex gap-2 items-center flex-1">
                            <Input
                                placeholder={isEnglish ? "Search students..." : "ค้นหา..."}
                                value={searchQuery}
                                onValueChange={onSetSearchQuery}
                                startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400 text-sm" />}
                                className="w-full"
                                size="md"
                                variant="bordered"
                                isClearable
                                classNames={{
                                    inputWrapper: "border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-blue-400 text-sm",
                                }}
                            />

                            <Dropdown>
                                <DropdownTrigger>
                                    <Button
                                        variant="bordered"
                                        size="md"
                                        className="min-w-28 justify-between border-default-200 bg-content1 text-default-700"
                                    >
                                        {selectedSection === "all"
                                            ? (isEnglish ? "All sections" : "ทุกกลุ่ม")
                                            : `Sec ${matrixData?.sections?.find((s) => String(s.id) === selectedSection)?.section_number}`}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    selectionMode="single"
                                    selectedKeys={new Set([selectedSection])}
                                    onSelectionChange={(keys) => onSetSelectedSection(Array.from(keys)[0] as string)}
                                    items={[
                                        { key: "all", label: isEnglish ? "All sections" : "ทุกกลุ่ม" },
                                        ...(matrixData?.sections || []).map((s) => ({
                                            key: String(s.id),
                                            label: `Section ${s.section_number}`,
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

            {/* Score Matrix */}
            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardBody className="p-0">
                    {!matrixData || matrixData.assignments.length === 0 ? (
                        <div className="text-center py-20">
                            <Icon icon="solar:clipboard-list-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                            <p className="text-default-500">
                                {selectedTab === "lab"
                                    ? (isEnglish ? "No labs yet" : "ยังไม่มีLab")
                                    : selectedTab === "assignment"
                                        ? (isEnglish ? "No assignments yet" : "ยังไม่มีAssignment")
                                        : (isEnglish ? "No group work yet" : "ยังไม่มีงานกลุ่ม")}
                            </p>
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="text-center py-20">
                            <Icon icon="solar:user-cross-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                            <p className="text-default-500">{isEnglish ? "No students found" : "ไม่พบนักศึกษา"}</p>
                        </div>
                    ) : (
                        <div className="max-h-147.5 overflow-x-auto overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10">
                                    {/* Row 1: Assignment names with colspan */}
                                    <tr className="border-b border-divider bg-content2">
                                        <th rowSpan={2} className="w-12 border-r border-divider bg-content2 px-3 py-2 text-center font-semibold text-default-600">#</th>
                                        <th rowSpan={2} className="min-w-30 border-r border-divider bg-content2 px-3 py-2 text-center font-semibold text-default-600">{isEnglish ? "Student ID" : "รหัสนักศึกษา"}</th>
                                        <th rowSpan={2} className="min-w-50 border-r border-divider bg-content2 px-3 py-2 text-center font-semibold text-default-600">{isEnglish ? "Student name" : "ชื่อ-นามสกุล"}</th>
                                        <th rowSpan={2} className="w-14 border-r border-divider bg-content2 px-2 py-2 text-center font-semibold text-default-600">Sec</th>
                                        {assignmentGroups.map((group) => (
                                            <th
                                                key={group.id}
                                                colSpan={group.colSpan}
                                                className="border-l border-default-300 bg-content3 px-2 py-2 text-center font-semibold text-default-700"
                                            >
                                                {group.title}
                                            </th>
                                        ))}
                                        <th rowSpan={2} className="min-w-20 border-l border-default-300 bg-content3 px-3 py-2 text-center font-semibold text-default-600">
                                            <div>{isEnglish ? "Total" : "รวม"}</div>
                                            <div className="text-xs font-normal text-default-400">({totalMaxScore})</div>
                                        </th>
                                        <th rowSpan={2} className="min-w-17.5 border-l border-amber-300 bg-amber-50 px-3 py-2 text-center font-semibold text-amber-600">
                                            <div className="flex items-center justify-center gap-1">
                                                <Icon icon="solar:star-bold" className="text-amber-500" />
                                                <span>{isEnglish ? "Bonus" : "พิเศษ"}</span>
                                            </div>
                                        </th>
                                    </tr>
                                    {/* Row 2: Sub-items / Max scores */}
                                    <tr className="border-b border-default-300 bg-content2/80">
                                        {columns.map((col) => (
                                            <th
                                                key={col.key}
                                                onMouseEnter={() => onSetHoverColKey(col.key)}
                                                onMouseLeave={() => onSetHoverColKey(null)}
                                                className={`min-w-20 border-l border-divider px-2 py-2 text-center
                                                    ${hoverColKey === col.key ? "bg-primary/10" : "bg-content2/80"}
                                                `}
                                            >
                                                {col.subItemName ? (
                                                    <div className="text-xs font-medium text-default-600">
                                                        {localizeGeneratedSubItemName(col.subItemName, isEnglish)}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs font-medium text-default-600">
                                                        {isEnglish ? "Item 1" : "ข้อ 1"}
                                                    </div>
                                                )}
                                            </th>
                                        ))}
                                    </tr>
                                    {/* Average Row */}
                                    <tr className="bg-blue-50 border-b-2 border-blue-200">
                                        <td colSpan={4} className="px-3 py-2 text-center text-blue-700 font-semibold bg-blue-50">{isEnglish ? "Average" : "ค่าเฉลี่ย"}</td>
                                        {columns.map((col) => (
                                            <td key={col.key} className="px-2 py-2 text-center text-blue-600 font-medium border-l border-blue-100 bg-blue-50">
                                                {matrixData.averages?.[col.key] ?? "-"}
                                            </td>
                                        ))}
                                        <td className="px-3 py-2 text-center text-blue-700 font-bold border-l border-blue-200 bg-blue-50">
                                            {classAverage.toFixed(1)}
                                        </td>
                                        <td className="px-3 py-2 text-center text-amber-600 font-bold border-l border-amber-200 bg-amber-50">
                                            -
                                        </td>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-divider">
                                    {filteredStudents.map((student, index) => {
                                        const studentTotal = toNum(student.total_score);
                                        const studentMax = toNum(student.total_max_score);
                                        const totalColor = getScoreColor(studentTotal, studentMax);

                                        return (
                                            <tr
                                                key={student.student_id}
                                                onMouseEnter={() => onSetHoverRowId(student.student_id)}
                                                onMouseLeave={() => onSetHoverRowId(null)}
                                                className={`transition-colors
                                                    ${hoverRowId === student.student_id ? "bg-primary/10" : ""}
                                                `}
                                            >
                                                <td className="px-3 py-3 text-center text-foreground">{index + 1}</td>
                                                <td className="px-3 py-3 text-default-600">{student.student_id}</td>
                                                <td className="px-3 py-3 font-medium text-foreground">{student.full_name}</td>
                                                <td className="px-2 py-3 text-center text-default-600">
                                                    {student.section_number}
                                                </td>
                                                {columns.map((col) => {
                                                    const scoreData = student.scores?.[col.key];
                                                    const score = scoreData?.score !== null && scoreData?.score !== undefined
                                                        ? toNum(scoreData.score)
                                                        : null;
                                                    const color = getScoreColor(score, col.maxScore);

                                                    return (
                                                        <td
                                                            key={col.key}
                                                            onMouseEnter={() => onSetHoverColKey(col.key)}
                                                            onMouseLeave={() => onSetHoverColKey(null)}
                                                            className={`border-l border-divider px-2 py-2 text-center transition-colors
                                                                ${hoverColKey === col.key ? "bg-primary/10" : ""}
                                                            `}
                                                        >
                                                            <button
                                                                onClick={() => onScoreClick(student, col, scoreData)}
                                                                disabled={!isCourseActive}
                                                                className={`inline-flex min-w-10 items-center justify-center rounded-md px-2 text-sm font-medium transition-all h-7 ${!isCourseActive ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-sm'} ${color.bg} ${color.text}`}
                                                            >
                                                                {fmtScore(score)}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                                <td className="border-l border-divider px-2 py-2 text-center">
                                                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md ${totalColor.bg}`}>
                                                        <span className={`text-sm font-bold ${totalColor.text}`}>
                                                            {fmtScore(studentTotal)}
                                                        </span>
                                                        <span className="text-xs text-default-400">/{studentMax}</span>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2 text-center border-l border-amber-100 bg-amber-50/30">
                                                    {student.bonus_score > 0 ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700 font-bold text-sm">
                                                            {student.bonus_score}
                                                        </span>
                                                    ) : (
                                                        <span className="text-default-300">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Score Detail Modal */}
            <Modal isOpen={scoreModal.isOpen} onClose={onCloseScoreModal} size="md">
                <ModalContent>
                    <ModalHeader className="flex items-start justify-between gap-3 pb-2">
                        <div>
                            <p className="text-lg font-semibold text-foreground">{isEnglish ? "Score details" : "รายละเอียดคะแนน"}</p>
                            <p className="text-xs text-default-500">{isEnglish ? "Review the score details and grading status." : "ตรวจสอบข้อมูลคะแนนและสถานะการให้คะแนน"}</p>
                        </div>
                        {scoreModal.score !== null ? (
                            <Chip
                                size="sm"
                                variant="flat"
                                className={`${getScoreColor(scoreModal.score, scoreModal.maxScore).bg} ${getScoreColor(scoreModal.score, scoreModal.maxScore).text}`}
                            >
                                {fmtScore(scoreModal.score)} / {scoreModal.maxScore}
                            </Chip>
                        ) : (
                            <Chip size="sm" variant="flat" className="bg-content3 text-default-500">
                                {isEnglish ? "Ungraded" : "ยังไม่ได้ให้คะแนน"}
                            </Chip>
                        )}
                    </ModalHeader>
                    <Divider />
                    <ModalBody className="py-4">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex items-center gap-3 rounded-lg border border-default-200 bg-content2 p-3">
                                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                                        <Icon icon="solar:user-bold" className="text-lg text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-default-500">{isEnglish ? "Student" : "นักศึกษา"}</p>
                                        <p className="font-medium text-foreground">{scoreModal.studentName}</p>
                                        <p className="text-sm text-default-500">{scoreModal.studentId}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 rounded-lg border border-default-200 bg-content2 p-3">
                                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                                        <Icon icon="solar:document-text-bold" className="text-lg text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-default-500">{isEnglish ? "Assignment" : "งาน"}</p>
                                        <p className="font-medium text-foreground">{scoreModal.assignmentTitle}</p>
                                        {scoreModal.subItemName && (
                                            <p className="text-sm text-default-600">{localizeGeneratedSubItemName(scoreModal.subItemName, isEnglish)}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-default-200">
                                <div className="flex items-center justify-between border-b border-divider bg-content2 px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Icon icon="solar:star-bold" className="text-amber-500" />
                                        <p className="text-sm font-semibold text-default-700">{isEnglish ? "Grading details" : "ข้อมูลการให้คะแนน"}</p>
                                    </div>
                                    <div className="text-sm text-default-500">
                                        {isEnglish ? `Max score ${scoreModal.maxScore}` : `คะแนนเต็ม ${scoreModal.maxScore}`}
                                    </div>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-sm text-default-500">{isEnglish ? "Score" : "คะแนนที่ได้"}</p>
                                        {scoreModal.score !== null ? (
                                            <p className="text-xl font-bold">
                                                <span className={getScoreColor(scoreModal.score, scoreModal.maxScore).text}>
                                                    {fmtScore(scoreModal.score)}
                                                </span>
                                                <span className="text-base font-medium text-default-400"> / {scoreModal.maxScore}</span>
                                            </p>
                                        ) : (
                                            <p className="text-sm font-medium text-default-400">{isEnglish ? "Ungraded" : "ยังไม่ได้ให้คะแนน"}</p>
                                        )}
                                    </div>

                                    {scoreModal.gradedBy && (
                                        <div className="flex items-center gap-2 text-sm text-default-600">
                                            <Icon icon="solar:pen-bold" className="text-amber-500" />
                                            <span>{isEnglish ? "Graded by" : "ผู้ให้คะแนน"}: {scoreModal.gradedBy}</span>
                                        </div>
                                    )}

                                    {scoreModal.gradedAt && (
                                        <div className="flex items-center gap-2 text-sm text-default-600">
                                            <Icon icon="solar:calendar-bold" className="text-sky-500" />
                                            <span>{isEnglish ? "Graded at" : "วันที่ให้คะแนน"}: {gradedAtLabel}</span>
                                        </div>
                                    )}

                                    {shouldShowUpdatedAt && (
                                        <div className="flex items-center gap-2 text-sm text-amber-700">
                                            <Icon icon="solar:pen-2-linear" className="text-amber-500" />
                                            <span>{isEnglish ? "Last updated" : "แก้ไขล่าสุด"}: {updatedAtLabel}</span>
                                        </div>
                                    )}

                                    {scoreModal.comment && (
                                        <div className="rounded-lg border border-default-200 bg-content2 p-3">
                                            <p className="mb-1 text-xs text-default-500">{isEnglish ? "Note" : "หมายเหตุ"}</p>
                                            <p className="text-sm whitespace-pre-wrap text-default-700">{scoreModal.comment}</p>
                                        </div>
                                    )}

                                    {scoreModal.score === null && (
                                        <div className="rounded-lg border border-default-200 bg-content2 p-3 text-center">
                                            <Icon icon="solar:info-circle-linear" className="mx-auto mb-1 text-2xl text-default-400" />
                                            <p className="text-sm text-default-500">{isEnglish ? "No score has been recorded for this item." : "ยังไม่มีการบันทึกคะแนนสำหรับรายการนี้"}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {hasEditHistory && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50/40">
                                    <div className="p-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-amber-700">
                                            <Icon icon="solar:history-bold" className="text-base" />
                                            <span className="text-sm font-semibold">{isEnglish ? "Score edit history" : "ประวัติการแก้ไขคะแนน"}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            className="bg-amber-100 text-amber-700"
                                            endContent={<Icon icon={isEditHistoryOpen ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} className="text-sm" />}
                                            onPress={() => setIsEditHistoryOpen((prev) => !prev)}
                                        >
                                            {isEditHistoryOpen
                                                ? (isEnglish ? "Hide details" : "ซ่อนรายละเอียด")
                                                : (isEnglish ? "View edit details" : "ดูรายละเอียดการแก้ไข")}
                                        </Button>
                                    </div>
                                    {isEditHistoryOpen && (
                                        <div className="px-3 pb-3 space-y-2">
                                            {(scoreModal.editRequests || []).map((req, idx) => (
                                                <div key={`${req.reviewed_at || "na"}-${idx}`} className="space-y-1.5 rounded-lg border border-amber-200 bg-content1 p-3">
                                                    <div className="flex items-center justify-between gap-3 text-sm">
                                                        <span className="font-semibold text-default-700">{isEnglish ? `Change ${idx + 1}` : `ครั้งที่ ${idx + 1}`}</span>
                                                        {req.reviewed_at && (
                                                            <span className="text-xs text-default-500">{isEnglish ? "Approved at" : "อนุมัติเมื่อ"} {formatDate(req.reviewed_at, isEnglish)}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-default-600">{isEnglish ? "Requested by" : "ผู้ขอแก้ไข"}: {req.requester || "-"}</p>
                                                    <p className="text-sm text-default-600">{isEnglish ? "Reason" : "เหตุผล"}: {req.reason || "-"}</p>
                                                    <p className="text-sm text-default-600">
                                                        {isEnglish ? "Previous score" : "คะแนนเดิม"}: {fmtScore(req.old_score)}
                                                        {" -> "}
                                                        {isEnglish ? "New score" : "คะแนนใหม่"}: {fmtScore(req.new_score)}
                                                    </p>
                                                    <p className="text-sm text-default-600">{isEnglish ? "Approved by" : "ผู้อนุมัติ"}: {req.reviewer || "-"}</p>
                                                    {req.review_comment && (
                                                        <p className="text-sm text-default-600">{isEnglish ? "Reviewer note" : "หมายเหตุผู้อนุมัติ"}: {req.review_comment}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </ModalBody>
                    <Divider />
                    <ModalFooter>
                        <Button color="primary" variant="light" onPress={onCloseScoreModal}>
                            {isEnglish ? "Close" : "ปิด"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
});

ScoreSummaryTabView.displayName = "ScoreSummaryTabView";

export default ScoreSummaryTabView;