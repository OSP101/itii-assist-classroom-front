"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@heroui/spinner";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";
import { Chip } from "@heroui/chip";
import { Checkbox, CheckboxGroup } from "@heroui/checkbox";
import { Select, SelectItem } from "@heroui/select";
import { Avatar } from "@heroui/avatar";
import { Card, CardBody } from "@heroui/card";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { addToast } from "@heroui/toast";
import { courseService } from "@/services/course.service";
import { useSectionsTab, SectionsTabView } from "./sections";

interface SectionsTabProps {
    courseId: string;
    isCourseActive?: boolean;
    canCreateSections?: boolean;
    canUpdateSections?: boolean;
    canDeleteSections?: boolean;
    canManageSectionStudents?: boolean;
    canCreateTeams?: boolean;
    canUpdateTeams?: boolean;
    canDeleteTeams?: boolean;
}

function formatCount(count: number, singular: string, plural: string) {
    return `${count} ${count === 1 ? singular : plural}`;
}

interface BulkTeamPreviewItem {
    name: string;
    rowNumbers: number[];
    memberIds: number[];
    memberLabels: string[];
    invalidTokens: string[];
    conflictMembers: Array<{ token: string; teamName: string }>;
    duplicateWithinTeam: string[];
    duplicateAcrossImport: Array<{ token: string; teamName: string }>;
}

/**
 * SectionsTab Container Component
 * 
 * This is a container component that:
 * 1. Uses the useSectionsTab hook to manage all state and business logic
 * 2. Passes data and handlers to the memoized SectionsTabView component
 * 3. Renders all modals (Add Section, Add Student, Create Team, etc.)
 * 
 * Benefits:
 * - Separation of concerns (logic vs presentation)
 * - Easier testing (can test hook and view separately)
 * - Reduced re-renders through React.memo in SectionsTabView
 * - Self-contained component - only needs courseId prop
 */
export default function SectionsTab({
    courseId,
    isCourseActive = true,
    canCreateSections = false,
    canUpdateSections = false,
    canDeleteSections = false,
    canManageSectionStudents = false,
    canCreateTeams = false,
    canUpdateTeams = false,
    canDeleteTeams = false,
}: SectionsTabProps) {
    const hook = useSectionsTab(courseId);
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    
    const {
        // Data
        course,
        isLoading,
        isTeamsLoading,
        
        // UI State
        sectionSubTab,
        sectionSearchQuery,
        selectedWeek,
        totalWeeks,
        expandedSections,
        
        // Data Collections
        permanentTeams,
        weeklyTeams,
        sectionStudents,
        removedStudents,
        studentsList,
        studentSearchResults,
        isStudentSearchLoading,
        
        // Computed
        totalStudents,
        
        // Modal States
        sectionModal,
        studentModal,
        teamModal,
        editTeamModal,
        deleteModal,
        bulkDeleteModal,
        editSectionModal,
        restoreModal,
        isSubmitting,
        
        // UI Handlers
        onSubTabChange,
        onSearchQueryChange,
        onWeekChange,
        onToggleSection,
        
        // CRUD Handlers
        handleAddSection,
        handleRemoveSection,
        confirmRemoveSection,
        handleEditSection,
        handleAddStudent,
        handleBulkAddStudents,
        handleRemoveStudent,
        handleRestoreStudent,
        confirmRestoreStudent,
        handleCreateTeam,
        handleSaveEditedTeam,
        handleDeleteTeam,
        handleBulkDeleteTeams,
        handleCopyTeamsFromWeek,
        
        // Modal Openers
        openAddStudentModal,
        openDeleteStudentModal,
        openCreateTeamModal,
        openEditTeamModal,
        openDeleteTeamModal,
        openBulkDeleteModal,
        openEditSectionModal,
        
        // Computed Functions
        getFilteredSectionStudents,
        findStudentTeam,
        getUnassignedStudents,
        getAvailableStudentsForEdit,
        getAllEnrolledStudents,
        
        // Utility
        parseExcelData,
        parseTeamExcelData,
        refreshTeams,
    } = hook;

    // Get enrolled student IDs for filtering
    const getEnrolledStudentIds = () => {
        const enrolledIds = new Set<number>();
        Object.values(sectionStudents).forEach(students => {
            students.forEach(s => enrolledIds.add(s.id));
        });
        return enrolledIds;
    };

    const getEnrolledSectionByStudentId = () => {
        const enrolledSections = new Map<number, string | null>();
        Object.entries(sectionStudents).forEach(([sectionId, students]) => {
            const sectionNo = course?.sections?.find(section => section.id === Number(sectionId))?.section_no || null;
            students.forEach(student => enrolledSections.set(student.id, sectionNo));
        });
        return enrolledSections;
    };

    // Get available students (not enrolled)
    const getAvailableStudents = () => {
        const enrolledIds = getEnrolledStudentIds();
        return studentsList.filter(student => !enrolledIds.has(student.id));
    };

    // Filter available students by search query
    const filteredStudents = () => {
        const hasQuery = studentModal.searchQuery.trim().length > 0;
        const enrolledSections = getEnrolledSectionByStudentId();
        const candidates = hasQuery ? studentSearchResults : getAvailableStudents();
        if (!studentModal.searchQuery.trim()) {
            return candidates.map(student => ({
                student,
                status: "matched" as const,
                enrolledSectionNo: null,
            }));
        }
        const query = studentModal.searchQuery.toLowerCase();
        return candidates
            .filter(s =>
                s.student_id.toLowerCase().includes(query) ||
                s.full_name.toLowerCase().includes(query)
            )
            .map(student => ({
                student,
                status: enrolledSections.has(student.id) ? "already_enrolled" as const : "matched" as const,
                enrolledSectionNo: enrolledSections.get(student.id) || null,
            }));
    };

    const [bulkTeamPasteData, setBulkTeamPasteData] = useState("");
    const [isBulkImportSubmitting, setIsBulkImportSubmitting] = useState(false);

    const allEnrolledStudents = useMemo(() => getAllEnrolledStudents(), [getAllEnrolledStudents]);

    const studentLookup = useMemo(() => {
        const byExact = new Map<string, typeof allEnrolledStudents[number]>();
        allEnrolledStudents.forEach((student) => {
            byExact.set(student.student_id.toLowerCase(), student);
            byExact.set(student.full_name.trim().toLowerCase(), student);
        });
        return byExact;
    }, [allEnrolledStudents]);

    const currentTeamAssignments = useMemo(() => {
        const assignments = new Map<number, string>();
        const targetTeams = teamModal.type === "permanent"
            ? permanentTeams
            : (weeklyTeams[selectedWeek] || []);

        targetTeams.forEach((team) => {
            team.members.forEach((member) => {
                assignments.set(member.id, team.name);
            });
        });

        return assignments;
    }, [teamModal.type, permanentTeams, weeklyTeams, selectedWeek]);

    const resolveBulkStudentToken = useCallback((token: string) => {
        const normalizedToken = token.trim().toLowerCase();
        if (!normalizedToken) {
            return null;
        }

        const exactMatch = studentLookup.get(normalizedToken);
        if (exactMatch) {
            return exactMatch;
        }

        return allEnrolledStudents.find((student) => {
            const studentId = student.student_id.toLowerCase();
            const fullName = student.full_name.trim().toLowerCase();
            return normalizedToken.includes(studentId) || fullName === normalizedToken;
        }) ?? null;
    }, [allEnrolledStudents, studentLookup]);

    const bulkTeamPreview = useMemo<BulkTeamPreviewItem[]>(() => {
        const text = bulkTeamPasteData.trim();
        if (!text) {
            return [];
        }

        const groupedTeams = new Map<string, {
            name: string;
            rowNumbers: number[];
            tokens: string[];
        }>();

        text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .forEach((line, index) => {
                const rawCells = line.includes("\t")
                    ? line.split("\t")
                    : line.split(",");
                const cells = rawCells
                    .map((cell) => cell.trim())
                    .filter((cell) => cell.length > 0);

                if (cells.length === 0) {
                    return;
                }

                const teamName = cells[0];
                const memberTokens = cells
                    .slice(1)
                    .flatMap((cell) => cell.split(/[;,|/]+/))
                    .map((cell) => cell.trim())
                    .filter((cell) => cell.length > 0);

                const existing = groupedTeams.get(teamName) ?? {
                    name: teamName,
                    rowNumbers: [],
                    tokens: [],
                };
                existing.rowNumbers.push(index + 1);
                existing.tokens.push(...memberTokens);
                groupedTeams.set(teamName, existing);
            });

        const seenAcrossImport = new Map<number, string>();

        return Array.from(groupedTeams.values()).map((team) => {
            const memberIds: number[] = [];
            const memberLabels: string[] = [];
            const invalidTokens: string[] = [];
            const conflictMembers: Array<{ token: string; teamName: string }> = [];
            const duplicateWithinTeam: string[] = [];
            const duplicateAcrossImport: Array<{ token: string; teamName: string }> = [];
            const seenWithinTeam = new Set<number>();

            team.tokens.forEach((token) => {
                const matchedStudent = resolveBulkStudentToken(token);
                if (!matchedStudent) {
                    invalidTokens.push(token);
                    return;
                }

                if (currentTeamAssignments.has(matchedStudent.id)) {
                    conflictMembers.push({
                        token,
                        teamName: currentTeamAssignments.get(matchedStudent.id) || "",
                    });
                    return;
                }

                if (seenWithinTeam.has(matchedStudent.id)) {
                    duplicateWithinTeam.push(token);
                    return;
                }

                if (seenAcrossImport.has(matchedStudent.id)) {
                    duplicateAcrossImport.push({
                        token,
                        teamName: seenAcrossImport.get(matchedStudent.id) || "",
                    });
                    return;
                }

                seenWithinTeam.add(matchedStudent.id);
                seenAcrossImport.set(matchedStudent.id, team.name);
                memberIds.push(matchedStudent.id);
                memberLabels.push(`${matchedStudent.student_id} ${matchedStudent.full_name}`);
            });

            return {
                name: team.name,
                rowNumbers: team.rowNumbers,
                memberIds,
                memberLabels,
                invalidTokens,
                conflictMembers,
                duplicateWithinTeam,
                duplicateAcrossImport,
            };
        });
    }, [bulkTeamPasteData, currentTeamAssignments, resolveBulkStudentToken]);

    const bulkTeamImportStats = useMemo(() => {
        const readyTeams = bulkTeamPreview.filter((team) =>
            team.memberIds.length > 0 &&
            team.invalidTokens.length === 0 &&
            team.conflictMembers.length === 0 &&
            team.duplicateWithinTeam.length === 0 &&
            team.duplicateAcrossImport.length === 0
        );

        const invalidTeams = bulkTeamPreview.length - readyTeams.length;
        return {
            readyTeams,
            invalidTeams,
            totalMembers: readyTeams.reduce((sum, team) => sum + team.memberIds.length, 0),
        };
    }, [bulkTeamPreview]);

    const resetBulkTeamImport = useCallback(() => {
        setBulkTeamPasteData("");
    }, []);

    useEffect(() => {
        if (!teamModal.isOpen || teamModal.formationMethod !== "bulk") {
            resetBulkTeamImport();
        }
    }, [teamModal.isOpen, teamModal.formationMethod, resetBulkTeamImport]);

    const handleBulkCreateTeams = useCallback(async () => {
        if (bulkTeamImportStats.readyTeams.length === 0 || bulkTeamImportStats.invalidTeams > 0) {
            addToast({
                title: isEnglish ? "Import not ready" : "ข้อมูลยังไม่พร้อมนำเข้า",
                description: isEnglish
                    ? "Please fix invalid rows before creating teams."
                    : "กรุณาแก้ไขแถวที่ยังมีปัญหาก่อนสร้างกลุ่ม",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsBulkImportSubmitting(true);
        try {
            const response = await courseService.bulkCreateTeams(courseId, {
                group_type: teamModal.type === "permanent" ? "permanent" : "temporary",
                week_number: teamModal.type === "weekly" ? selectedWeek : undefined,
                teams: bulkTeamImportStats.readyTeams.map((team) => ({
                    name: team.name,
                    member_ids: team.memberIds,
                })),
            });

            if (response.success) {
                await refreshTeams(true);
                addToast({
                    title: isEnglish ? "Import completed" : "นำเข้ากลุ่มสำเร็จ",
                    description: isEnglish
                        ? `Created ${bulkTeamImportStats.readyTeams.length} teams from Excel.`
                        : `สร้างกลุ่มจาก Excel จำนวน ${bulkTeamImportStats.readyTeams.length} กลุ่มเรียบร้อย`,
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                resetBulkTeamImport();
                teamModal.reset();
            }
        } catch (error) {
            const err = error as { message?: string };
            addToast({
                title: isEnglish ? "Import failed" : "นำเข้ากลุ่มไม่สำเร็จ",
                description: err.message || (isEnglish
                    ? "Unable to create teams from Excel data."
                    : "ไม่สามารถสร้างกลุ่มจากข้อมูล Excel ได้"),
                color: "danger",
                timeout: 4000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsBulkImportSubmitting(false);
        }
    }, [bulkTeamImportStats, courseId, isEnglish, refreshTeams, resetBulkTeamImport, selectedWeek, teamModal]);

    // Initial tab loading is handled by route/tab skeletons.
    // Keep this container blank until course data is ready.
    if (isLoading || !course) {
        return null;
    }

    return (
        <>
            <SectionsTabView
                // Data
                course={course}
                sectionSubTab={sectionSubTab}
                sectionSearchQuery={sectionSearchQuery}
                totalStudents={totalStudents}
                permanentTeams={permanentTeams}
                weeklyTeams={weeklyTeams}
                selectedWeek={selectedWeek}
                totalWeeks={totalWeeks}
                expandedSections={expandedSections}
                isTeamsLoading={isTeamsLoading}
                sectionStudents={sectionStudents}
                removedStudents={removedStudents}
                isCourseActive={isCourseActive}
                canCreateSections={canCreateSections}
                canUpdateSections={canUpdateSections}
                canDeleteSections={canDeleteSections}
                canManageSectionStudents={canManageSectionStudents}
                canCreateTeams={canCreateTeams}
                canUpdateTeams={canUpdateTeams}
                canDeleteTeams={canDeleteTeams}
                
                // UI Handlers
                onSubTabChange={onSubTabChange}
                onSearchQueryChange={onSearchQueryChange}
                onWeekChange={onWeekChange}
                onToggleSection={onToggleSection}
                onOpenAddSectionModal={() => sectionModal.setIsOpen(true)}
                onOpenAddStudentModal={openAddStudentModal}
                onRemoveSection={handleRemoveSection}
                onOpenDeleteStudentModal={openDeleteStudentModal}
                onRestoreRemovedStudent={handleRestoreStudent}
                onOpenCreateTeamModal={openCreateTeamModal}
                onOpenDeleteTeamModal={openDeleteTeamModal}
                onOpenEditTeamModal={openEditTeamModal}
                onCopyTeamsFromWeek={handleCopyTeamsFromWeek}
                onOpenBulkDeleteModal={openBulkDeleteModal}
                onOpenEditSectionModal={openEditSectionModal}
                
                // Computed Functions
                getFilteredSectionStudents={getFilteredSectionStudents}
                findStudentTeam={findStudentTeam}
            />

            {/* Add Section Modal */}
            <Modal 
                isOpen={sectionModal.isOpen} 
                onClose={sectionModal.reset}
                size="md"
                placement="center"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30">
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{isEnglish ? "Add section" : "เพิ่มกลุ่มเรียน"}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">{isEnglish ? "Create a new section for this course." : "สร้างกลุ่มเรียนใหม่สำหรับรายวิชานี้"}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            <Input
                                label={isEnglish ? "Section number" : "หมายเลขกลุ่มเรียน"}
                                labelPlacement="outside"
                                placeholder={isEnglish ? "For example: 1, 2, 801" : "เช่น 1, 2, 801"}
                                variant="bordered"
                                size="md"
                                type="number"
                                value={sectionModal.sectionNo}
                                onValueChange={sectionModal.setSectionNo}
                                className="pb-3"
                                isRequired
                                classNames={{
                                    inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-sm font-medium text-default-600",
                                }}
                            />
                            <Input
                                label={isEnglish ? "Note (optional)" : "หมายเหตุ (ถ้ามี)"}
                                labelPlacement="outside"
                                placeholder={isEnglish ? "For example: Regular section, special program, etc." : "เช่น ภาคปกติ ภาคพิเศษ ฯลฯ"}
                                variant="bordered"
                                size="md"
                                value={sectionModal.note}
                                onValueChange={sectionModal.setNote}
                                classNames={{
                                    inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-sm font-medium text-default-600",
                                }}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button variant="light" onPress={sectionModal.reset}>
                            {isEnglish ? "Cancel" : "ยกเลิก"}
                        </Button>
                        <Button 
                            onPress={handleAddSection}
                            isLoading={isSubmitting}
                            isDisabled={!isCourseActive || !sectionModal.sectionNo.trim()}
                            className="bg-linear-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-400/25"
                        >
                            {isEnglish ? "Add section" : "เพิ่มกลุ่มเรียน"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Section Modal */}
            <Modal 
                isOpen={editSectionModal.isOpen} 
                onClose={editSectionModal.reset}
                size="md"
                placement="center"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:pen-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{isEnglish ? "Edit section" : "แก้ไขกลุ่มเรียน"}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">{isEnglish ? "Update section details." : "แก้ไขข้อมูลกลุ่มเรียน"}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            <Input
                                label={isEnglish ? "Section number" : "หมายเลขกลุ่มเรียน"}
                                labelPlacement="outside"
                                placeholder={isEnglish ? "For example: 1, 2, 801" : "เช่น 1, 2, 801"}
                                variant="bordered"
                                size="md"
                                value={editSectionModal.sectionNo}
                                onValueChange={editSectionModal.setSectionNo}
                                className="pb-3"
                                isRequired
                                classNames={{
                                    inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-sm font-medium text-default-600",
                                }}
                            />
                            <Input
                                label={isEnglish ? "Note (optional)" : "หมายเหตุ (ถ้ามี)"}
                                labelPlacement="outside"
                                placeholder={isEnglish ? "For example: Regular section, special program, etc." : "เช่น ภาคปกติ ภาคพิเศษ ฯลฯ"}
                                variant="bordered"
                                size="md"
                                value={editSectionModal.note}
                                onValueChange={editSectionModal.setNote}
                                classNames={{
                                    inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-sm font-medium text-default-600",
                                }}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button variant="light" onPress={editSectionModal.reset}>
                            {isEnglish ? "Cancel" : "ยกเลิก"}
                        </Button>
                        <Button 
                            onPress={handleEditSection}
                            isLoading={isSubmitting}
                            isDisabled={!isCourseActive || !editSectionModal.sectionNo.trim()}
                            className="bg-linear-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-400/25"
                        >
                            {isEnglish ? "Save" : "บันทึก"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Add Student Modal */}
            <Modal 
                isOpen={studentModal.isOpen} 
                onClose={studentModal.reset}
                size="xl"
                scrollBehavior="outside"
                placement="center"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                                <Icon icon="solar:user-plus-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{isEnglish ? "Add student" : "เพิ่มนักศึกษา"}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">
                                    {isEnglish
                                        ? `Section ${course.sections?.find(s => s.id === studentModal.sectionId)?.section_no}`
                                        : `กลุ่มเรียน Section ${course.sections?.find(s => s.id === studentModal.sectionId)?.section_no}`}
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            {/* Mode Toggle */}
                            <div className="flex gap-2 rounded-xl bg-content2 p-1">
                                <button
                                    onClick={() => studentModal.setMode("single")}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                        studentModal.mode === "single"
                                            ? "bg-content1 shadow-sm text-primary"
                                            : "text-default-600 hover:bg-content3"
                                    }`}
                                >
                                    <Icon icon="solar:user-bold" />
                                    {isEnglish ? "Select one" : "เลือกทีละคน"}
                                </button>
                                <button
                                    onClick={() => studentModal.setMode("bulk")}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        studentModal.mode === "bulk"
                                            ? "bg-content1 shadow-sm text-primary"
                                            : "text-default-600 hover:bg-content3"
                                    }`}
                                >
                                    <Icon icon="solar:clipboard-list-bold" />
                                    {isEnglish ? "Paste from Excel" : "วางจาก Excel"}
                                </button>
                            </div>

                            {studentModal.mode === "single" ? (
                                <>
                                    <Input
                                        placeholder={isEnglish ? "Search students..." : "ค้นหานักศึกษา..."}
                                        value={studentModal.searchQuery}
                                        onValueChange={studentModal.setSearchQuery}
                                        variant="bordered"
                                        startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                        }}
                                    />
                                    {isStudentSearchLoading && studentModal.searchQuery.trim() ? (
                                        <div className="flex items-center gap-2 px-1 text-sm text-default-500">
                                            <Spinner size="sm" />
                                            <span>{isEnglish ? "Searching students..." : "กำลังค้นหานักศึกษา..."}</span>
                                        </div>
                                    ) : null}
                                    <div className="overflow-hidden rounded-xl border border-default-200">
                                        <div className="max-h-60 overflow-y-auto">
                                            {filteredStudents().map(({ student, status, enrolledSectionNo }) => (
                                                <div
                                                    key={student.id}
                                                    className={`flex items-center justify-between border-b border-divider p-3 transition-colors last:border-0 ${
                                                        status === "already_enrolled"
                                                            ? "cursor-not-allowed bg-amber-50"
                                                            : ""
                                                    } ${
                                                        studentModal.studentId === student.id.toString()
                                                            ? "border-l-4 border-l-primary bg-primary/10"
                                                            : "hover:bg-content2"
                                                    }`}
                                                    onClick={() => {
                                                        if (status === "already_enrolled") return;
                                                        studentModal.setStudentId(student.id.toString());
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            name={student.full_name}
                                                            size="sm"
                                                            className="bg-blue-500"
                                                        />
                                                        <div>
                                                            <p className="font-medium text-foreground">{student.full_name}</p>
                                                            <p className="text-sm text-default-500">{student.student_id}</p>
                                                            {status === "already_enrolled" && (
                                                                <p className="text-xs text-amber-700">
                                                                    {isEnglish
                                                                        ? `Already in this course${enrolledSectionNo ? ` (${enrolledSectionNo})` : ""}`
                                                                        : `อยู่ในรายวิชาแล้ว${enrolledSectionNo ? ` (${enrolledSectionNo})` : ""}`}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {status === "already_enrolled" ? (
                                                        <Chip size="sm" color="warning" variant="flat">
                                                            {isEnglish ? "Already in course" : "อยู่ในรายวิชาแล้ว"}
                                                        </Chip>
                                                    ) : studentModal.studentId === student.id.toString() && (
                                                        <Icon icon="solar:check-circle-bold" className="text-xl text-blue-500" />
                                                    )}
                                                </div>
                                            ))}
                                            {filteredStudents().length === 0 && (
                                                <div className="text-center py-8">
                                                    <Icon icon="solar:users-group-rounded-linear" className="mx-auto mb-2 text-4xl text-default-300" />
                                                    <p className="text-default-400">{isEnglish ? "No students matched your search." : "ไม่พบนักศึกษาที่ค้นหา"}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <p className="text-sm text-amber-700">
                                            <Icon icon="solar:info-circle-bold" className="inline mr-1" />
                                            {isEnglish ? "Paste one student ID per line from Excel or plain text." : "วางรหัสนักศึกษา (1 รหัสต่อบรรทัด) จาก Excel หรือ Text"}
                                        </p>
                                    </div>
                                    <Textarea
                                        label={isEnglish ? "Student IDs" : "รหัสนักศึกษา"}
                                        labelPlacement="outside"
                                        placeholder={isEnglish ? "Paste student IDs here\n65010001\n65010002\n65010003" : "วางรหัสนักศึกษาที่นี่\n65010001\n65010002\n65010003"}
                                        value={studentModal.pasteData}
                                        onValueChange={(value) => {
                                            studentModal.setPasteData(value);
                                            parseExcelData(value);
                                        }}
                                        minRows={5}
                                        variant="bordered"
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-sm font-medium text-default-600",
                                        }}
                                    />
                                    {studentModal.parsedStudents.length > 0 && (
                                        <div className="overflow-hidden rounded-xl border border-default-200">
                                            <div className="flex items-center justify-between border-b border-divider bg-content2 px-4 py-2">
                                                <p className="text-sm text-default-600">{isEnglish ? "Validation results" : "ผลการตรวจสอบ"}</p>
                                                <div className="flex gap-2 text-xs">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                                        {isEnglish ? "Found" : "พบ"} {studentModal.parsedStudents.filter(p => p.status === "matched").length}
                                                    </span>
                                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                                        {isEnglish ? "Already enrolled" : "ลงทะเบียนแล้ว"} {studentModal.parsedStudents.filter(p => p.status === "already_enrolled").length}
                                                    </span>
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
                                                        {isEnglish ? "Not found" : "ไม่พบ"} {studentModal.parsedStudents.filter(p => p.status === "not_found").length}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto">
                                                {studentModal.parsedStudents.map((result, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`flex items-center justify-between border-b border-divider p-3 last:border-0 ${
                                                            result.status === "matched" ? "bg-blue-50" :
                                                            result.status === "already_enrolled" ? "bg-amber-50" : "bg-red-50"
                                                        }`}
                                                    >
                                                        <span className="font-medium">{result.inputValue}</span>
                                                        <span className="text-xs">
                                                            {result.status === "matched" && result.matchedStudent?.full_name}
                                                            {result.status === "already_enrolled" && (isEnglish ? "Already enrolled" : "ลงทะเบียนแล้ว")}
                                                            {result.status === "not_found" && (isEnglish ? "Not found" : "ไม่พบ")}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button variant="light" onPress={studentModal.reset}>
                            {isEnglish ? "Cancel" : "ยกเลิก"}
                        </Button>
                        {studentModal.mode === "single" ? (
                            <Button 
                                onPress={handleAddStudent}
                                isLoading={isSubmitting}
                                isDisabled={!isCourseActive || !studentModal.studentId}
                                className="bg-linear-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-400/25"
                            >
                                {isEnglish ? "Add student" : "เพิ่มนักศึกษา"}
                            </Button>
                        ) : (
                            <Button 
                                onPress={handleBulkAddStudents}
                                isLoading={isSubmitting}
                                isDisabled={!isCourseActive || studentModal.parsedStudents.filter(p => p.status === "matched").length === 0}
                                className="bg-linear-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-400/25"
                            >
                                {isEnglish
                                    ? `Add students (${studentModal.parsedStudents.filter(p => p.status === "matched").length})`
                                    : `เพิ่มนักศึกษา (${studentModal.parsedStudents.filter(p => p.status === "matched").length})`}
                            </Button>
                        )}
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Create Team Modal */}
            <Modal 
                isOpen={teamModal.isOpen} 
                onClose={teamModal.reset}
                size="xl"
                scrollBehavior="outside"
                placement="center"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl shadow-lg bg-linear-to-br from-blue-400 to-indigo-500 shadow-blue-500/30">
                                <Icon icon="solar:users-group-two-rounded-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">
                                    {teamModal.formationMethod === "random"
                                        ? (isEnglish ? "Auto-generate teams" : "สุ่มกลุ่มอัตโนมัติ")
                                        : teamModal.formationMethod === "bulk"
                                            ? (isEnglish ? "Import teams from Excel" : "นำเข้ากลุ่มจาก Excel")
                                        : isEnglish
                                            ? `Create a new ${teamModal.type === "permanent" ? "project team" : "weekly team"}`
                                            : `สร้าง${teamModal.type === "permanent" ? "กลุ่มโปรเจกต์" : "กลุ่มโปรเจกต์รายสัปดาห์"}ใหม่`
                                    }
                                </h3>
                                <p className="mt-1 text-sm font-normal text-default-500">
                                    {teamModal.formationMethod === "random"
                                        ? isEnglish
                                            ? teamModal.type === "permanent"
                                                ? "Randomly group students into project teams."
                                                : `Randomly group students for week ${selectedWeek}.`
                                            : `สุ่มจับกลุ่ม${teamModal.type === "permanent" ? "โปรเจกต์" : `สัปดาห์ที่ ${selectedWeek}`}`
                                        : teamModal.formationMethod === "bulk"
                                            ? isEnglish
                                                ? "Paste rows copied from Excel, review them, and create all teams at once."
                                                : "วางข้อมูลที่คัดลอกมาจาก Excel ตรวจสอบความถูกต้อง แล้วสร้างหลายกลุ่มในครั้งเดียว"
                                        : teamModal.type === "permanent"
                                            ? (isEnglish ? "Teams used throughout the semester." : "กลุ่มที่ใช้ตลอดทั้งเทอม")
                                            : (isEnglish ? `Team for week ${selectedWeek}.` : `กลุ่มสำหรับสัปดาห์ที่ ${selectedWeek}`)
                                    }
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 gap-2 rounded-2xl bg-content2 p-1.5 sm:grid-cols-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        teamModal.setFormationMethod("manual");
                                        resetBulkTeamImport();
                                    }}
                                    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                                        teamModal.formationMethod === "manual"
                                            ? "bg-content1 text-blue-700 shadow-sm"
                                            : "text-default-600 hover:bg-content3"
                                    }`}
                                >
                                    <Icon icon="solar:add-circle-linear" />
                                    {isEnglish ? "Create manually" : "สร้างเอง"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        teamModal.setFormationMethod("bulk");
                                        teamModal.setName("");
                                        teamModal.setMembers([]);
                                    }}
                                    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                                        teamModal.formationMethod === "bulk"
                                            ? "bg-content1 text-blue-700 shadow-sm"
                                            : "text-default-600 hover:bg-content3"
                                    }`}
                                >
                                    <Icon icon="solar:clipboard-list-linear" />
                                    {isEnglish ? "Import Excel" : "นำเข้า Excel"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        teamModal.setFormationMethod("random");
                                        resetBulkTeamImport();
                                    }}
                                    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                                        teamModal.formationMethod === "random"
                                            ? "bg-content1 text-blue-700 shadow-sm"
                                            : "text-default-600 hover:bg-content3"
                                    }`}
                                >
                                    <Icon icon="solar:shuffle-linear" />
                                    {isEnglish ? "Randomize" : "สุ่มกลุ่ม"}
                                </button>
                            </div>

                            {teamModal.formationMethod === "random" ? (
                                <>
                                    {/* Random Formation Settings */}
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-default-600">{isEnglish ? "Members per team" : "จำนวนสมาชิกต่อกลุ่ม"}</label>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="flat"
                                                onPress={() => teamModal.setSize(Math.max(2, teamModal.size - 1))}
                                            >
                                                <Icon icon="solar:minus-circle-linear" />
                                            </Button>
                                            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                                                teamModal.type === "permanent"
                                                    ? "bg-purple-50 border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/30"
                                                    : "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30"
                                            }`}>
                                                <Icon icon="solar:users-group-rounded-linear" className={
                                                    teamModal.type === "permanent" ? "text-purple-600 dark:text-purple-300" : "text-emerald-600 dark:text-emerald-300"
                                                } />
                                                <span className="text-lg font-bold text-foreground">{teamModal.size}</span>
                                                <span className="text-sm text-default-500">{isEnglish ? "members" : "คน"}</span>
                                            </div>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="flat"
                                                onPress={() => teamModal.setSize(Math.min(10, teamModal.size + 1))}
                                            >
                                                <Icon icon="solar:add-circle-linear" />
                                            </Button>
                                        </div>
                                    </div>
                                    {/* Preview */}
                                    {(() => {
                                        const totalStudents = getUnassignedStudents(teamModal.type, teamModal.type === "weekly" ? selectedWeek : undefined).length;
                                        const groupCount = Math.ceil(totalStudents / teamModal.size);
                                        const remainder = totalStudents % teamModal.size;
                                        const lastGroupSize = remainder === 0 ? teamModal.size : remainder;
                                        
                                        return (
                                            <div className={`p-4 rounded-xl border ${
                                                teamModal.type === "permanent"
                                                    ? "border-purple-200 bg-purple-50/70 dark:border-purple-500/30 dark:bg-purple-500/10"
                                                    : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                                            }`}>
                                                <div className="flex items-start gap-3">
                                                    <Icon icon="solar:info-circle-bold" className={`text-xl mt-0.5 ${
                                                        teamModal.type === "permanent" ? "text-purple-600 dark:text-purple-300" : "text-emerald-600 dark:text-emerald-300"
                                                    }`} />
                                                    <div className="space-y-2">
                                                        <p className={`font-medium ${
                                                            teamModal.type === "permanent" ? "text-purple-900 dark:text-purple-200" : "text-emerald-900 dark:text-emerald-200"
                                                        }`}>{isEnglish ? "Grouping preview" : "ตัวอย่างการจับกลุ่ม"}</p>
                                                        <div className={`text-sm space-y-1 ${
                                                            teamModal.type === "permanent" ? "text-purple-700 dark:text-purple-300" : "text-emerald-700 dark:text-emerald-300"
                                                        }`}>
                                                            <p>{isEnglish ? "Unassigned students" : "นักศึกษาที่ยังไม่มีกลุ่ม"}: <span className="font-semibold">{isEnglish ? formatCount(totalStudents, "student", "students") : totalStudents}</span>{!isEnglish && " คน"}</p>
                                                            <p>{isEnglish ? "Teams to create" : "จำนวนกลุ่มที่จะสร้าง"}: <span className="font-semibold">{isEnglish ? formatCount(groupCount, "team", "teams") : groupCount}</span> {isEnglish ? `(${formatCount(teamModal.size, "member", "members")} each)` : `กลุ่ม (กลุ่มละ ${teamModal.size} คน)`}</p>
                                                            {remainder > 0 && totalStudents > 0 && (
                                                                <p className={`${teamModal.type === "permanent" ? "text-purple-800 dark:text-purple-200" : "text-emerald-800 dark:text-emerald-200"} font-medium`}>
                                                                    {isEnglish
                                                                        ? <>The last team (Team {groupCount}) will have <span className="font-semibold">{formatCount(lastGroupSize, "member", "members")}</span>.</>
                                                                        : <>• กลุ่มสุดท้าย (กลุ่มที่ {groupCount}) จะมี <span className="font-semibold">{lastGroupSize}</span> คน</>}
                                                                </p>
                                                            )}
                                                            {remainder === 0 && totalStudents > 0 && (
                                                                <p className={`${teamModal.type === "permanent" ? "text-purple-800 dark:text-purple-200" : "text-emerald-800 dark:text-emerald-200"}`}>
                                                                    {isEnglish ? "All teams will have the same number of members." : "• ทุกกลุ่มจะมีจำนวนสมาชิกเท่ากัน ✓"}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </>
                            ) : teamModal.formationMethod === "bulk" ? (
                                <>
                                    <Card className="border border-blue-100 bg-blue-50/60 shadow-sm">
                                        <CardBody className="space-y-3 p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="rounded-xl bg-blue-100 p-2 text-blue-600">
                                                    <Icon icon="solar:document-text-bold" className="text-xl" />
                                                </div>
                                                <div className="space-y-2 text-sm text-blue-900">
                                                    <p className="font-semibold">
                                                        {isEnglish ? "Expected format" : "รูปแบบที่รองรับ"}
                                                    </p>
                                                    <p>
                                                        {isEnglish
                                                            ? "Put the team name in the first column, then member student IDs or names in the next columns."
                                                            : "ใส่ชื่อกลุ่มไว้คอลัมน์แรก แล้วใส่รหัสนักศึกษาหรือชื่อนักศึกษาในคอลัมน์ถัดไป"}
                                                    </p>
                                                    <pre className="overflow-x-auto rounded-xl bg-white/80 p-3 text-xs text-blue-800">{`Alpha\t64070001\t64070002\nBeta\t64070003\t64070004`}</pre>
                                                    <p className="text-blue-700">
                                                        {isEnglish
                                                            ? "If one team spans multiple Excel rows, reuse the same team name and the system will merge them."
                                                            : "ถ้ากลุ่มเดียวกันมีหลายแถว ให้ใช้ชื่อกลุ่มเดิมซ้ำได้ ระบบจะรวมสมาชิกให้เอง"}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-default-600">
                                            {isEnglish ? "Paste rows from Excel" : "วางข้อมูลที่คัดลอกจาก Excel"}
                                        </label>
                                        <Textarea
                                            placeholder={"Alpha\t64070001\t64070002\nBeta\t64070003\t64070004"}
                                            value={bulkTeamPasteData}
                                            onValueChange={setBulkTeamPasteData}
                                            minRows={7}
                                            variant="bordered"
                                            classNames={{
                                                inputWrapper: "bg-content1 border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            }}
                                        />
                                    </div>

                                    {bulkTeamPreview.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700">
                                                    {isEnglish ? `Ready ${bulkTeamImportStats.readyTeams.length} teams` : `พร้อมสร้าง ${bulkTeamImportStats.readyTeams.length} กลุ่ม`}
                                                </Chip>
                                                <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-700">
                                                    {isEnglish ? `Need review ${bulkTeamImportStats.invalidTeams} teams` : `ต้องตรวจทาน ${bulkTeamImportStats.invalidTeams} กลุ่ม`}
                                                </Chip>
                                                <Chip size="sm" variant="flat" className="bg-emerald-100 text-emerald-700">
                                                    {isEnglish ? `${bulkTeamImportStats.totalMembers} members ready` : `สมาชิกพร้อมนำเข้า ${bulkTeamImportStats.totalMembers} คน`}
                                                </Chip>
                                            </div>

                                            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                                                {bulkTeamPreview.map((team) => {
                                                    const isReady =
                                                        team.memberIds.length > 0 &&
                                                        team.invalidTokens.length === 0 &&
                                                        team.conflictMembers.length === 0 &&
                                                        team.duplicateWithinTeam.length === 0 &&
                                                        team.duplicateAcrossImport.length === 0;

                                                    return (
                                                        <Card
                                                            key={`${team.name}-${team.rowNumbers.join("-")}`}
                                                            className={`border ${isReady ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"}`}
                                                        >
                                                            <CardBody className="space-y-3 p-4">
                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                    <div>
                                                                        <p className="font-semibold text-foreground">{team.name}</p>
                                                                        <p className="text-xs text-default-500">
                                                                            {isEnglish
                                                                                ? `Rows ${team.rowNumbers.join(", ")}`
                                                                                : `แถวที่ ${team.rowNumbers.join(", ")}`}
                                                                        </p>
                                                                    </div>
                                                                    <Chip
                                                                        size="sm"
                                                                        variant="flat"
                                                                        className={isReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}
                                                                    >
                                                                        {isReady
                                                                            ? (isEnglish ? `${team.memberIds.length} members ready` : `พร้อม ${team.memberIds.length} คน`)
                                                                            : (isEnglish ? "Needs review" : "ต้องตรวจทาน")}
                                                                    </Chip>
                                                                </div>

                                                                {team.memberLabels.length > 0 && (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {team.memberLabels.map((label) => (
                                                                            <Chip key={`${team.name}-${label}`} size="sm" variant="flat" className="bg-content1 text-default-700">
                                                                                {label}
                                                                            </Chip>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {team.invalidTokens.length > 0 && (
                                                                    <p className="text-sm text-red-600">
                                                                        {isEnglish ? "Not found:" : "ไม่พบข้อมูล:"} {team.invalidTokens.join(", ")}
                                                                    </p>
                                                                )}
                                                                {team.conflictMembers.length > 0 && (
                                                                    <p className="text-sm text-amber-700">
                                                                        {isEnglish ? "Already assigned:" : "มีสมาชิกอยู่ในกลุ่มแล้ว:"} {team.conflictMembers.map((item) => `${item.token} (${item.teamName})`).join(", ")}
                                                                    </p>
                                                                )}
                                                                {team.duplicateWithinTeam.length > 0 && (
                                                                    <p className="text-sm text-amber-700">
                                                                        {isEnglish ? "Duplicated in this team:" : "มีข้อมูลซ้ำในกลุ่มเดียวกัน:"} {team.duplicateWithinTeam.join(", ")}
                                                                    </p>
                                                                )}
                                                                {team.duplicateAcrossImport.length > 0 && (
                                                                    <p className="text-sm text-amber-700">
                                                                        {isEnglish ? "Duplicated across imported teams:" : "มีข้อมูลซ้ำกับกลุ่มอื่นในชุดนำเข้า:"} {team.duplicateAcrossImport.map((item) => `${item.token} (${item.teamName})`).join(", ")}
                                                                    </p>
                                                                )}
                                                            </CardBody>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Team Name */}
                                    <Input
                                        label={isEnglish ? "Team name" : "ชื่อกลุ่ม"}
                                        labelPlacement="outside"
                                        placeholder={isEnglish ? "For example: Team 1, Team A, Alpha Team" : "เช่น กลุ่ม 1, กลุ่ม A, ทีม Alpha"}
                                        variant="bordered"
                                        size="md"
                                        value={teamModal.name}
                                        onValueChange={teamModal.setName}
                                        isRequired
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-sm font-medium text-default-600",
                                        }}
                                    />

                                    {/* Member Selection Mode Toggle */}
                                    <div className="flex gap-2 rounded-xl bg-content2 p-1">
                                        <button
                                            onClick={() => {
                                                teamModal.setMemberMode("select");
                                                teamModal.setPasteData("");
                                                teamModal.setParsedMembers([]);
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                                teamModal.memberMode === "select"
                                                    ? `bg-content1 shadow-sm ${teamModal.type === "permanent" ? "text-purple-600" : "text-emerald-600"}`
                                                    : "text-default-600 hover:bg-content3"
                                            }`}
                                        >
                                            <Icon icon="solar:checklist-linear" />
                                            {isEnglish ? "Select from roster" : "เลือกจากรายชื่อ"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                teamModal.setMemberMode("paste");
                                                teamModal.setMembers([]);
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                                teamModal.memberMode === "paste"
                                                    ? `bg-content1 shadow-sm ${teamModal.type === "permanent" ? "text-purple-600" : "text-emerald-600"}`
                                                    : "text-default-600 hover:bg-content3"
                                            }`}
                                        >
                                            <Icon icon="solar:clipboard-list-linear" />
                                            {isEnglish ? "Paste from Excel" : "วางจาก Excel"}
                                        </button>
                                    </div>

                                    {/* Select Mode - Member Selection */}
                                    {teamModal.memberMode === "select" && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-default-600">
                                                    {isEnglish ? `Select members (${teamModal.members.length})` : `เลือกสมาชิก (${teamModal.members.length} คน)`}
                                                </label>
                                                {teamModal.members.length > 0 && (
                                                    <Button
                                                        size="sm"
                                                        variant="light"
                                                        color="danger"
                                                        onPress={() => teamModal.setMembers([])}
                                                    >
                                                        {isEnglish ? "Clear all" : "ล้างทั้งหมด"}
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="overflow-hidden rounded-xl border border-default-200">
                                                <div className="border-b border-divider bg-content2 px-4 py-2">
                                                    <p className="text-sm text-default-600">
                                                        {isEnglish
                                                            ? `Unassigned students: ${formatCount(getUnassignedStudents(teamModal.type, teamModal.type === "weekly" ? selectedWeek : undefined).length, "student", "students")}`
                                                            : `นักศึกษาที่ยังไม่อยู่ในกลุ่ม: ${getUnassignedStudents(teamModal.type, teamModal.type === "weekly" ? selectedWeek : undefined).length} คน`}
                                                    </p>
                                                </div>
                                                <div className="max-h-52 overflow-y-auto">
                                                    {getUnassignedStudents(teamModal.type, teamModal.type === "weekly" ? selectedWeek : undefined).length > 0 ? (
                                                        getUnassignedStudents(teamModal.type, teamModal.type === "weekly" ? selectedWeek : undefined).map((student) => (
                                                            <div
                                                                key={student.id}
                                                                onClick={() => {
                                                                    if (teamModal.members.includes(student.id)) {
                                                                        teamModal.setMembers(teamModal.members.filter(id => id !== student.id));
                                                                    } else {
                                                                        teamModal.setMembers([...teamModal.members, student.id]);
                                                                    }
                                                                }}
                                                                className={`flex items-center justify-between border-b border-divider p-3 transition-colors last:border-0 ${
                                                                    teamModal.members.includes(student.id)
                                                                        ? teamModal.type === "permanent"
                                                                            ? "bg-purple-50 border-l-4 border-l-purple-500"
                                                                            : "bg-emerald-50 border-l-4 border-l-emerald-500"
                                                                        : "hover:bg-content2"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <Avatar name={student.full_name} size="sm" className={
                                                                        teamModal.type === "permanent" ? "bg-purple-500" : "bg-emerald-500"
                                                                    } />
                                                                    <div>
                                                                        <p className="font-medium text-foreground">{student.full_name}</p>
                                                                        <p className="text-sm text-default-500">{student.student_id}</p>
                                                                    </div>
                                                                </div>
                                                                {teamModal.members.includes(student.id) && (
                                                                    <Icon icon="solar:check-circle-bold" className={`text-xl ${
                                                                        teamModal.type === "permanent" ? "text-purple-500" : "text-emerald-500"
                                                                    }`} />
                                                                )}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="text-center py-8">
                                                            <Icon icon="solar:users-group-rounded-linear" className="mx-auto mb-2 text-4xl text-default-300" />
                                                            <p className="text-default-400">{isEnglish ? "All students are already assigned to teams." : "นักศึกษาทั้งหมดอยู่ในกลุ่มแล้ว"}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}


                                    {/* Paste Mode - Excel Paste */}
                                    {teamModal.memberMode === "paste" && (
                                        <>
                                            <div>
                                                <label className="mb-2 block text-sm font-medium text-default-600">
                                                    {isEnglish ? "Paste student IDs from Excel" : "วางรหัสนักศึกษาจาก Excel"}
                                                </label>
                                                <p className="mb-2 text-xs text-default-400">
                                                    {isEnglish ? "Copy a column of student IDs from Excel and paste it here, one per line." : "คัดลอกคอลัมน์รหัสนักศึกษาจาก Excel แล้ววางที่นี่ (หนึ่งรหัสต่อหนึ่งบรรทัด)"}
                                                </p>
                                                <Textarea
                                                    placeholder={"64070001\n64070002\n64070003\n..."}
                                                    value={teamModal.pasteData}
                                                    onValueChange={(value) => {
                                                        teamModal.setPasteData(value);
                                                        parseTeamExcelData(value);
                                                    }}
                                                    minRows={4}
                                                    variant="bordered"
                                                    classNames={{
                                                        inputWrapper: `bg-content1 ${
                                                            teamModal.type === "permanent"
                                                                ? "border-purple-200 focus-within:!border-purple-400"
                                                                : "border-emerald-200 focus-within:!border-emerald-400"
                                                        }`,
                                                    }}
                                                />
                                            </div>

                                            {/* Loading State */}
                                            {teamModal.isParsing && (
                                                <div className="flex items-center justify-center py-4">
                                                    <Spinner size="sm" color={teamModal.type === "permanent" ? "secondary" : "success"} />
                                                    <span className="ml-2 text-default-500">{isEnglish ? "Searching students..." : "กำลังค้นหานักศึกษา..."}</span>
                                                </div>
                                            )}

                                            {/* Parse Results */}
                                            {teamModal.parsedMembers.length > 0 && (
                                                <div className="overflow-hidden rounded-xl border border-default-200">
                                                    <div className="flex items-center justify-between border-b border-divider bg-content2 px-4 py-2">
                                                        <p className="text-sm text-default-600">
                                                            {isEnglish ? `Validation results (${teamModal.parsedMembers.length} items)` : `ผลการตรวจสอบ (${teamModal.parsedMembers.length} รายการ)`}
                                                        </p>
                                                        <div className="flex gap-2 text-xs">
                                                            <span className={`px-2 py-1 rounded-full ${
                                                                teamModal.type === "permanent"
                                                                    ? "bg-purple-100 text-purple-700"
                                                                    : "bg-emerald-100 text-emerald-700"
                                                            }`}>
                                                                {isEnglish ? "Found" : "พบ"} {teamModal.parsedMembers.filter(p => p.status === "matched").length}
                                                            </span>
                                                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                                                {isEnglish ? "Already in a team" : "มีกลุ่มแล้ว"} {teamModal.parsedMembers.filter(p => p.status === "already_in_team").length}
                                                            </span>
                                                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
                                                                {isEnglish ? "Not found" : "ไม่พบ"} {teamModal.parsedMembers.filter(p => p.status === "not_found").length}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto">
                                                        {teamModal.parsedMembers.map((result, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`flex items-center justify-between border-b border-divider p-3 last:border-0 ${
                                                                    result.status === "matched"
                                                                        ? teamModal.type === "permanent" ? "bg-purple-50" : "bg-emerald-50"
                                                                        : result.status === "already_in_team" ? "bg-amber-50" : "bg-red-50"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    {result.matchedStudent ? (
                                                                        <>
                                                                            <Avatar name={result.matchedStudent.full_name} size="sm" className={
                                                                                result.status === "matched"
                                                                                    ? teamModal.type === "permanent" ? "bg-purple-500" : "bg-emerald-500"
                                                                                    : "bg-amber-500"
                                                                            } />
                                                                            <div>
                                                                                <p className="font-medium text-foreground">{result.matchedStudent.full_name}</p>
                                                                                <p className="text-sm text-default-500">{result.matchedStudent.student_id}</p>
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center">
                                                                                <Icon icon="solar:question-circle-linear" className="text-red-600" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-medium text-foreground">{result.inputValue}</p>
                                                                                <p className="text-sm text-red-500">{isEnglish ? "Not found in the system" : "ไม่พบในระบบ"}</p>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    {result.status === "matched" && (
                                                                        <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                                                                            teamModal.type === "permanent"
                                                                                ? "bg-purple-200 text-purple-700"
                                                                                : "bg-emerald-200 text-emerald-700"
                                                                        }`}>
                                                                            <Icon icon="solar:check-circle-bold" className="text-sm" />
                                                                            {isEnglish ? "Ready to add" : "พร้อมเพิ่ม"}
                                                                        </span>
                                                                    )}
                                                                    {result.status === "already_in_team" && (
                                                                        <span className="text-xs px-2 py-1 bg-amber-200 text-amber-700 rounded-full flex items-center gap-1">
                                                                            <Icon icon="solar:info-circle-bold" className="text-sm" />
                                                                            {isEnglish ? "Already in a team" : "มีกลุ่มแล้ว"}
                                                                        </span>
                                                                    )}
                                                                    {result.status === "not_found" && (
                                                                        <span className="text-xs px-2 py-1 bg-red-200 text-red-700 rounded-full flex items-center gap-1">
                                                                            <Icon icon="solar:close-circle-bold" className="text-sm" />
                                                                            {isEnglish ? "Not found" : "ไม่พบ"}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button variant="light" onPress={teamModal.reset}>
                            {isEnglish ? "Cancel" : "ยกเลิก"}
                        </Button>
                        <Button 
                            onPress={teamModal.formationMethod === "bulk" ? handleBulkCreateTeams : handleCreateTeam}
                            isLoading={teamModal.formationMethod === "bulk" ? isBulkImportSubmitting : isSubmitting}
                            isDisabled={
                                !isCourseActive || (
                                    teamModal.formationMethod === "manual"
                                        ? (!teamModal.name.trim() || teamModal.members.length === 0)
                                        : teamModal.formationMethod === "bulk"
                                            ? (bulkTeamImportStats.readyTeams.length === 0 || bulkTeamImportStats.invalidTeams > 0)
                                            : (getUnassignedStudents(teamModal.type, teamModal.type === "weekly" ? selectedWeek : undefined).length === 0)
                                )
                            }
                            className="bg-linear-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-500/25"
                        >
                            {teamModal.formationMethod === "random"
                                ? (isEnglish ? "Randomize teams" : "สุ่มกลุ่ม")
                                : teamModal.formationMethod === "bulk"
                                    ? (isEnglish
                                        ? `Create ${bulkTeamImportStats.readyTeams.length} teams`
                                        : `สร้าง ${bulkTeamImportStats.readyTeams.length} กลุ่ม`)
                                : isEnglish
                                    ? `Create team${teamModal.members.length > 0 ? ` (${teamModal.members.length})` : ""}`
                                    : `สร้างกลุ่ม${teamModal.members.length > 0 ? ` (${teamModal.members.length} คน)` : ""}`
                            }
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Team Modal */}
            <Modal 
                isOpen={editTeamModal.isOpen} 
                onClose={editTeamModal.reset}
                size="xl"
                scrollBehavior="outside"
                placement="center"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:pen-new-square-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{isEnglish ? "Edit team" : "แก้ไขกลุ่ม"}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">{isEnglish ? "Update the team name and members." : "แก้ไขชื่อและสมาชิกในกลุ่ม"}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            {/* Team Name */}
                            <Input
                                label={isEnglish ? "Team name" : "ชื่อกลุ่ม"}
                                labelPlacement="outside"
                                placeholder={isEnglish ? "For example: Team 1, Team A, Alpha Team" : "เช่น กลุ่ม 1, กลุ่ม A, ทีม Alpha"}
                                variant="bordered"
                                size="md"
                                value={editTeamModal.name}
                                onValueChange={editTeamModal.setName}
                                isRequired
                                className="pt-3"
                                classNames={{
                                    inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-sm font-medium text-default-600",
                                }}
                            />

                            {/* Current Members */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-default-600">
                                    {isEnglish ? `Current members (${editTeamModal.members.length})` : `สมาชิกปัจจุบัน (${editTeamModal.members.length} คน)`}
                                </label>
                                <div className="overflow-hidden rounded-xl border border-default-200">
                                    <div className="max-h-40 overflow-y-auto">
                                        {editTeamModal.members.length > 0 ? (
                                            editTeamModal.members.map((memberId) => {
                                                const student = getAllEnrolledStudents().find(s => s.id === memberId);
                                                if (!student) return null;
                                                return (
                                                    <div
                                                        key={memberId}
                                                        className="flex items-center justify-between border-b border-divider bg-primary/10 p-3 last:border-0"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Avatar name={student.full_name} size="sm" className="bg-blue-500" />
                                                            <div>
                                                                <p className="font-medium text-foreground">{student.full_name}</p>
                                                                <p className="text-sm text-default-500">{student.student_id}</p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            isIconOnly
                                                            size="sm"
                                                            variant="light"
                                                            color="danger"
                                                            onPress={() => {
                                                                editTeamModal.setMembers(
                                                                    editTeamModal.members.filter(id => id !== memberId)
                                                                );
                                                            }}
                                                        >
                                                            <Icon icon="solar:close-circle-bold" className="text-lg" />
                                                        </Button>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-center py-6">
                                                <Icon icon="solar:users-group-rounded-linear" className="mx-auto mb-2 text-3xl text-default-300" />
                                                <p className="text-sm text-default-400">{isEnglish ? "No members in this team yet." : "ยังไม่มีสมาชิกในกลุ่ม"}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Add Members */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-default-600">
                                    {isEnglish ? "Add members" : "เพิ่มสมาชิก"}
                                </label>
                                <div className="overflow-hidden rounded-xl border border-default-200">
                                    <div className="border-b border-divider bg-content2 px-4 py-2">
                                        <p className="text-sm text-default-600">
                                            {isEnglish
                                                ? `Available students: ${formatCount(getAvailableStudentsForEdit().filter(s => !editTeamModal.members.includes(s.id)).length, "student", "students")}`
                                                : `นักศึกษาที่ยังไม่อยู่ในกลุ่ม: ${getAvailableStudentsForEdit().filter(s => !editTeamModal.members.includes(s.id)).length} คน`}
                                        </p>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {getAvailableStudentsForEdit().filter(s => !editTeamModal.members.includes(s.id)).length > 0 ? (
                                            getAvailableStudentsForEdit()
                                                .filter(s => !editTeamModal.members.includes(s.id))
                                                .map((student) => (
                                                    <div
                                                        key={student.id}
                                                        onClick={() => {
                                                            editTeamModal.setMembers([...editTeamModal.members, student.id]);
                                                        }}
                                                        className="flex items-center justify-between border-b border-divider p-3 transition-colors last:border-0 hover:bg-content2"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Avatar name={student.full_name} size="sm" className="bg-content3" />
                                                            <div>
                                                                <p className="font-medium text-foreground">{student.full_name}</p>
                                                                <p className="text-sm text-default-500">{student.student_id}</p>
                                                            </div>
                                                        </div>
                                                        <Icon icon="solar:add-circle-linear" className="text-xl text-blue-500" />
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="text-center py-6">
                                                <Icon icon="solar:users-group-rounded-linear" className="mx-auto mb-2 text-3xl text-default-300" />
                                                <p className="text-sm text-default-400">{isEnglish ? "All students are already assigned to teams." : "นักศึกษาทั้งหมดอยู่ในกลุ่มแล้ว"}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button variant="light" onPress={editTeamModal.reset}>
                            {isEnglish ? "Cancel" : "ยกเลิก"}
                        </Button>
                        <Button 
                            onPress={handleSaveEditedTeam}
                            isLoading={isSubmitting}
                            isDisabled={!isCourseActive || !editTeamModal.name.trim() || editTeamModal.members.length === 0}
                            className="bg-linear-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-400/25"
                        >
                            {isEnglish ? "Save" : "บันทึก"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal 
                isOpen={deleteModal.isOpen} 
                onClose={deleteModal.reset}
                size="lg"
                scrollBehavior="outside"
                placement="center"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:danger-triangle-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">
                                    {deleteModal.target?.type === "section" && (isEnglish ? "Delete section" : "ลบกลุ่มเรียน")}
                                    {deleteModal.target?.type === "student" && (isEnglish ? "Remove student" : "นำนักศึกษาออก")}
                                    {deleteModal.target?.type === "team" && (isEnglish ? "Delete team" : "ลบกลุ่ม")}
                                </h3>
                                <p className="mt-1 text-sm font-normal text-default-500">
                                    {isEnglish ? "Please review the details before continuing." : "กรุณาตรวจสอบข้อมูลก่อนดำเนินการ"}
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-4">
                            {/* Item Info Card */}
                            <Card className="border border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-800/70">
                                <CardBody className="py-4 px-4">
                                    {deleteModal.target?.type === "section" && (
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg bg-linear-to-br from-blue-500 to-indigo-600">
                                                <Icon icon="solar:users-group-two-rounded-bold" className="text-2xl text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-lg font-semibold text-foreground">Section {deleteModal.target.sectionNo}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                                                        {isEnglish ? "Section" : "กลุ่มเรียน"}
                                                    </Chip>
                                                </div>
                                                <div className="mt-2 flex items-center gap-3 text-sm text-default-500">
                                                    <span className="flex items-center gap-1">
                                                        <Icon icon="solar:users-group-rounded-linear" className="text-blue-600 dark:text-blue-300" />
                                                        {deleteModal.target.sectionStudentCount || 0} {isEnglish ? "students" : "คน"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {deleteModal.target?.type === "student" && (
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg bg-linear-to-br from-indigo-500 to-blue-600">
                                                <Icon icon="solar:user-bold" className="text-2xl text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-lg font-semibold text-foreground">{deleteModal.target.studentName}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Chip size="sm" variant="flat" className="bg-content3 text-default-700">
                                                        {deleteModal.target.studentCode}
                                                    </Chip>
                                                    <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                                                        Section {deleteModal.target.sectionNo}
                                                    </Chip>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {deleteModal.target?.type === "team" && (
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                                                deleteModal.target.teamType === "permanent"
                                                    ? "bg-linear-to-br from-purple-500 to-indigo-600"
                                                    : "bg-linear-to-br from-emerald-500 to-teal-600"
                                            }`}>
                                                <Icon 
                                                    icon={deleteModal.target.teamType === "permanent" 
                                                        ? "solar:users-group-two-rounded-bold" 
                                                        : "solar:users-group-rounded-bold"
                                                    } 
                                                    className="text-2xl text-white" 
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-lg font-semibold text-foreground">{deleteModal.target.teamName}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Chip size="sm" variant="flat" className={
                                                        deleteModal.target.teamType === "permanent"
                                                            ? "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200"
                                                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                                                    }>
                                                        {deleteModal.target.teamType === "permanent"
                                                            ? (isEnglish ? "Project team" : "กลุ่มโปรเจกต์")
                                                            : (isEnglish ? "Weekly team" : "กลุ่มสัปดาห์")}
                                                    </Chip>
                                                </div>
                                                <div className="mt-2 flex items-center gap-3 text-sm text-default-500">
                                                    <span className="flex items-center gap-1">
                                                        <Icon icon="solar:users-group-rounded-linear" className="text-default-400" />
                                                        {deleteModal.target.teamMembers?.length || 0} {isEnglish ? "members" : "สมาชิก"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>

                            {/* Amber Warning Card */}
                            <Card className="border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
                                <CardBody className="py-3 px-4">
                                    <div className="flex items-start gap-3">
                                        <Icon icon="solar:info-circle-bold" className="text-xl text-amber-600 mt-0.5 dark:text-amber-300" />
                                        <div>
                                            <p className="font-medium text-amber-800 dark:text-amber-200">{isEnglish ? "What will happen" : "สิ่งที่จะเกิดขึ้น"}</p>
                                            <p className="text-sm text-amber-700 mt-1 dark:text-amber-300">
                                                {deleteModal.target?.type === "section" && (isEnglish ? "All students in this section will be removed from the course." : "นักศึกษาทั้งหมดในกลุ่มเรียนนี้จะถูกลบออกจากรายวิชา")}
                                                {deleteModal.target?.type === "student" && (isEnglish ? "The student will be removed from this section." : "นักศึกษาจะถูกลบออกจากกลุ่มเรียนนี้")}
                                                {deleteModal.target?.type === "team" && (isEnglish ? "All members will be removed from this team." : "สมาชิกทั้งหมดจะถูกลบออกจากกลุ่มนี้")}
                                            </p>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>

                            {/* Confirmation Input for Section Delete */}
                            {deleteModal.target?.type === "section" && (
                                <div className="space-y-3">
                                    <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 dark:border-rose-500/30 dark:bg-rose-500/10">
                                        <div className="flex items-start gap-3">
                                            <Icon icon="solar:shield-warning-bold" className="text-2xl text-rose-600 mt-0.5 dark:text-rose-300" />
                                            <div>
                                                <p className="font-semibold text-rose-800 dark:text-rose-200">
                                                    {isEnglish
                                                        ? `Type "${deleteModal.target.sectionNo}" to confirm deletion`
                                                        : `พิมพ์ "${deleteModal.target.sectionNo}" เพื่อยืนยันการลบ`}
                                                </p>
                                                <p className="text-sm text-rose-700 mt-1 dark:text-rose-300">
                                                    {isEnglish ? "Deleting a section removes all students from the course." : "การลบกลุ่มเรียนจะลบนักศึกษาทั้งหมดออกจากรายวิชา"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <Input
                                        placeholder={isEnglish ? `Type "${deleteModal.target.sectionNo}" to confirm` : `พิมพ์ "${deleteModal.target.sectionNo}" เพื่อยืนยัน`}
                                        value={deleteModal.confirmInput}
                                        onValueChange={deleteModal.setConfirmInput}
                                        variant="bordered"
                                        classNames={{
                                            inputWrapper: "border-rose-200 hover:border-rose-300 focus-within:!border-rose-400 dark:border-rose-500/30 dark:bg-slate-900",
                                        }}
                                    />
                                </div>
                            )}

                            {/* Red Warning for non-section delete */}
                            {deleteModal.target?.type !== "section" && (
                                <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 dark:border-rose-500/30 dark:bg-rose-500/10">
                                    <div className="flex items-center gap-3">
                                        <Icon icon="solar:shield-warning-bold" className="text-2xl text-rose-600 dark:text-rose-300" />
                                        <div>
                                            <p className="font-semibold text-rose-800 dark:text-rose-200">
                                                {isEnglish ? "Do you want to continue?" : "คุณต้องการดำเนินการต่อหรือไม่?"}
                                            </p>
                                            <p className="text-sm text-rose-700 dark:text-rose-300">
                                                {isEnglish ? "This action cannot be undone." : "การดำเนินการนี้ไม่สามารถย้อนกลับได้"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button 
                            variant="light" 
                            onPress={deleteModal.reset}
                            isDisabled={isSubmitting}
                        >
                            {isEnglish ? "Cancel" : "ยกเลิก"}
                        </Button>
                        <Button 
                            color="primary"
                            onPress={() => {
                                if (deleteModal.target?.type === "section") {
                                    confirmRemoveSection();
                                } else if (deleteModal.target?.type === "student") {
                                    handleRemoveStudent();
                                } else if (deleteModal.target?.type === "team") {
                                    handleDeleteTeam();
                                }
                            }}
                            isLoading={isSubmitting}
                            isDisabled={
                                !isCourseActive || (deleteModal.target?.type === "section" 
                                    ? deleteModal.confirmInput !== deleteModal.target?.sectionNo
                                    : false)
                            }
                            className="bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {deleteModal.target?.type === "section" && (isEnglish ? "Delete section" : "ลบกลุ่มเรียน")}
                            {deleteModal.target?.type === "student" && (isEnglish ? "Remove" : "นำออก")}
                            {deleteModal.target?.type === "team" && (isEnglish ? "Delete team" : "ลบกลุ่ม")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Restore Student Confirmation Modal */}
            <Modal
                isOpen={restoreModal.isOpen}
                onClose={restoreModal.reset}
                size="md"
                scrollBehavior="outside"
                placement="center"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-amber-500/30">
                                <Icon icon="solar:restart-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{isEnglish ? "Restore student" : "กู้คืนนักศึกษา"}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">
                                    {isEnglish ? "Please review the details before continuing." : "กรุณาตรวจสอบข้อมูลก่อนดำเนินการ"}
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-4">
                            {/* Student Info Card */}
                            <Card className="border border-amber-100 bg-amber-50/50">
                                <CardBody className="py-4 px-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg bg-linear-to-br from-amber-400 to-orange-500">
                                            <Icon icon="solar:user-bold" className="text-2xl text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-lg font-semibold text-foreground">{restoreModal.target?.full_name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {restoreModal.target?.student_ref_id !== 0 && (
                                                    <Chip size="sm" variant="flat" className="bg-content3 text-default-700">
                                                        {restoreModal.target?.student_ref_id}
                                                    </Chip>
                                                )}
                                                <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
                                                    Section {restoreModal.target?.section_no}
                                                </Chip>
                                                <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-700">
                                                    {isEnglish ? `${restoreModal.target?.remaining_days} days left` : `เหลือ ${restoreModal.target?.remaining_days} วัน`}
                                                </Chip>
                                            </div>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>

                            {/* Info */}
                            <Card className="border border-green-200 bg-green-50">
                                <CardBody className="py-3 px-4">
                                    <div className="flex items-start gap-3">
                                        <Icon icon="solar:info-circle-bold" className="text-xl text-green-600 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-green-800">{isEnglish ? "What will happen" : "สิ่งที่จะเกิดขึ้น"}</p>
                                            <p className="text-sm text-green-700 mt-1">
                                                {isEnglish
                                                    ? `The student will be restored to Section ${restoreModal.target?.section_no}.`
                                                    : `นักศึกษาจะถูกเพิ่มกลับเข้ากลุ่ม Section ${restoreModal.target?.section_no} ตามเดิม`}
                                            </p>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button
                            variant="light"
                            onPress={restoreModal.reset}
                            isDisabled={isSubmitting}
                        >
                            {isEnglish ? "Cancel" : "ยกเลิก"}
                        </Button>
                        <Button
                            onPress={confirmRestoreStudent}
                            isLoading={isSubmitting}
                            isDisabled={!isCourseActive}
                            className="bg-linear-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25"
                        >
                            {isEnglish ? "Restore student" : "กู้คืนนักศึกษา"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Bulk Delete Teams Modal */}
            <Modal
                isOpen={bulkDeleteModal.isOpen}
                onClose={() => bulkDeleteModal.setIsOpen(false)}
                size="lg"
                scrollBehavior="outside"
                placement="center"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:danger-triangle-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{isEnglish ? "Delete all teams" : "ลบกลุ่มทั้งหมด"}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">
                                    {isEnglish ? "Please review the details before continuing." : "กรุณาตรวจสอบข้อมูลก่อนดำเนินการ"}
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-4">
                            {/* Info Card */}
                            <Card className="border border-red-100 bg-red-50/50">
                                <CardBody className="py-4 px-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg bg-linear-to-br from-emerald-500 to-teal-600">
                                            <Icon icon="solar:calendar-bold" className="text-2xl text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-lg font-semibold text-foreground">{isEnglish ? `Week ${selectedWeek}` : `สัปดาห์ที่ ${selectedWeek}`}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Chip size="sm" variant="flat" className="bg-emerald-100 text-emerald-700">
                                                    {isEnglish ? "Weekly teams" : "กลุ่มสัปดาห์"}
                                                </Chip>
                                            </div>
                                            <div className="mt-2 flex items-center gap-3 text-sm text-default-500">
                                                <span className="flex items-center gap-1">
                                                    <Icon icon="solar:users-group-rounded-linear" className="text-emerald-500" />
                                                    {weeklyTeams[selectedWeek]?.length || 0} {isEnglish ? "teams" : "กลุ่ม"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>

                            {/* Amber Warning Card */}
                            <Card className="border border-amber-200 bg-amber-50">
                                <CardBody className="py-3 px-4">
                                    <div className="flex items-start gap-3">
                                        <Icon icon="solar:info-circle-bold" className="text-xl text-amber-600 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-amber-800">{isEnglish ? "What will happen" : "สิ่งที่จะเกิดขึ้น"}</p>
                                            <p className="text-sm text-amber-700 mt-1">
                                                {isEnglish
                                                    ? `All teams in week ${selectedWeek} will be deleted. All members will become unassigned for this week.`
                                                    : `กลุ่มทั้งหมดในสัปดาห์ที่ ${selectedWeek} จะถูกลบออก สมาชิกทั้งหมดจะไม่มีกลุ่มในสัปดาห์นี้`}
                                            </p>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>

                            {/* Red Warning */}
                            <div className="p-4 bg-red-100 rounded-xl border border-red-200">
                                <div className="flex items-center gap-3">
                                    <Icon icon="solar:shield-warning-bold" className="text-2xl text-red-600" />
                                    <div>
                                        <p className="font-semibold text-red-800">
                                            {isEnglish ? "Do you want to delete all teams?" : "คุณต้องการลบกลุ่มทั้งหมดหรือไม่?"}
                                        </p>
                                        <p className="text-sm text-red-600">
                                            {isEnglish ? "This action cannot be undone." : "การดำเนินการนี้ไม่สามารถย้อนกลับได้"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button 
                            variant="light" 
                            onPress={() => bulkDeleteModal.setIsOpen(false)}
                            isDisabled={isSubmitting}
                        >
                            {isEnglish ? "Cancel" : "ยกเลิก"}
                        </Button>
                        <Button 
                            color="primary"
                            onPress={handleBulkDeleteTeams}
                            isLoading={isSubmitting}
                            isDisabled={!isCourseActive}
                            className="bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {isEnglish ? "Delete all" : "ลบทั้งหมด"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
