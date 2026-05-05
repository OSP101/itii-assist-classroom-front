"use client";

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
    } = hook;

    // Get enrolled student IDs for filtering
    const getEnrolledStudentIds = () => {
        const enrolledIds = new Set<number>();
        Object.values(sectionStudents).forEach(students => {
            students.forEach(s => enrolledIds.add(s.id));
        });
        return enrolledIds;
    };

    // Get available students (not enrolled)
    const getAvailableStudents = () => {
        const enrolledIds = getEnrolledStudentIds();
        return studentsList.filter(student => !enrolledIds.has(student.id));
    };

    // Filter available students by search query
    const filteredStudents = () => {
        const available = getAvailableStudents();
        if (!studentModal.searchQuery.trim()) return available;
        const query = studentModal.searchQuery.toLowerCase();
        return available.filter(s =>
            s.student_id.toLowerCase().includes(query) ||
            s.full_name.toLowerCase().includes(query)
        );
    };

    // Show loading spinner while fetching initial data
    if (isLoading || !course) {
        return (
            <div className="flex items-center justify-center py-12">
                <Spinner size="lg" color="primary" />
            </div>
        );
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
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30">
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">เพิ่มกลุ่มเรียน</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">สร้างกลุ่มเรียนใหม่สำหรับรายวิชานี้</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            <Input
                                label="หมายเลขกลุ่มเรียน"
                                labelPlacement="outside"
                                placeholder="เช่น 1, 2, 801"
                                variant="bordered"
                                size="md"
                                type="number"
                                value={sectionModal.sectionNo}
                                onValueChange={sectionModal.setSectionNo}
                                className="pb-3"
                                isRequired
                                classNames={{
                                    inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            />
                            <Input
                                label="หมายเหตุ (ถ้ามี)"
                                labelPlacement="outside"
                                placeholder="เช่น ภาคปกติ ภาคพิเศษ ฯลฯ"
                                variant="bordered"
                                size="md"
                                value={sectionModal.note}
                                onValueChange={sectionModal.setNote}
                                classNames={{
                                    inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button variant="light" onPress={sectionModal.reset}>
                            ยกเลิก
                        </Button>
                        <Button 
                            onPress={handleAddSection}
                            isLoading={isSubmitting}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-400/25"
                            startContent={!isSubmitting && <Icon icon="solar:add-circle-bold" />}
                        >
                            เพิ่มกลุ่มเรียน
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
                            <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:pen-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">แก้ไขกลุ่มเรียน</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">แก้ไขข้อมูลกลุ่มเรียน</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            <Input
                                label="หมายเลขกลุ่มเรียน"
                                labelPlacement="outside"
                                placeholder="เช่น 1, 2, 801"
                                variant="bordered"
                                size="md"
                                value={editSectionModal.sectionNo}
                                onValueChange={editSectionModal.setSectionNo}
                                className="pb-3"
                                isRequired
                                classNames={{
                                    inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            />
                            <Input
                                label="หมายเหตุ (ถ้ามี)"
                                labelPlacement="outside"
                                placeholder="เช่น ภาคปกติ ภาคพิเศษ ฯลฯ"
                                variant="bordered"
                                size="md"
                                value={editSectionModal.note}
                                onValueChange={editSectionModal.setNote}
                                classNames={{
                                    inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button variant="light" onPress={editSectionModal.reset}>
                            ยกเลิก
                        </Button>
                        <Button 
                            onPress={handleEditSection}
                            isLoading={isSubmitting}
                            isDisabled={!editSectionModal.sectionNo.trim()}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-400/25"
                            startContent={!isSubmitting && <Icon icon="solar:diskette-bold" />}
                        >
                            บันทึก
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
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                                <Icon icon="solar:user-plus-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">เพิ่มนักศึกษา</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">
                                    กลุ่มเรียน Section {course.sections?.find(s => s.id === studentModal.sectionId)?.section_no}
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            {/* Mode Toggle */}
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => studentModal.setMode("single")}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                        studentModal.mode === "single"
                                            ? "bg-white shadow-sm text-blue-600"
                                            : "text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    <Icon icon="solar:user-bold" />
                                    เลือกทีละคน
                                </button>
                                <button
                                    onClick={() => studentModal.setMode("bulk")}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        studentModal.mode === "bulk"
                                            ? "bg-white shadow-sm text-blue-600"
                                            : "text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    <Icon icon="solar:clipboard-list-bold" />
                                    วางจาก Excel
                                </button>
                            </div>

                            {studentModal.mode === "single" ? (
                                <>
                                    <Input
                                        placeholder="ค้นหานักศึกษา..."
                                        value={studentModal.searchQuery}
                                        onValueChange={studentModal.setSearchQuery}
                                        variant="bordered"
                                        startContent={<Icon icon="solar:magnifer-linear" className="text-slate-400" />}
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                        }}
                                    />
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="max-h-60 overflow-y-auto">
                                            {filteredStudents().map(student => (
                                                <div
                                                    key={student.id}
                                                    className={`flex items-center justify-between p-3 cursor-pointer transition-colors border-b border-slate-100 last:border-0 ${
                                                        studentModal.studentId === student.id.toString()
                                                            ? "bg-blue-50 border-l-4 border-l-blue-500"
                                                            : "hover:bg-slate-50"
                                                    }`}
                                                    onClick={() => studentModal.setStudentId(student.id.toString())}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            name={student.full_name}
                                                            size="sm"
                                                            className="bg-blue-500"
                                                        />
                                                        <div>
                                                            <p className="font-medium text-slate-800">{student.full_name}</p>
                                                            <p className="text-sm text-slate-500">{student.student_id}</p>
                                                        </div>
                                                    </div>
                                                    {studentModal.studentId === student.id.toString() && (
                                                        <Icon icon="solar:check-circle-bold" className="text-xl text-blue-500" />
                                                    )}
                                                </div>
                                            ))}
                                            {filteredStudents().length === 0 && (
                                                <div className="text-center py-8">
                                                    <Icon icon="solar:users-group-rounded-linear" className="text-4xl text-slate-300 mx-auto mb-2" />
                                                    <p className="text-slate-400">ไม่พบนักศึกษาที่ค้นหา</p>
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
                                            วางรหัสนักศึกษา (1 รหัสต่อบรรทัด) จาก Excel หรือ Text
                                        </p>
                                    </div>
                                    <Textarea
                                        label="รหัสนักศึกษา"
                                        labelPlacement="outside"
                                        placeholder={"วางรหัสนักศึกษาที่นี่\n65010001\n65010002\n65010003"}
                                        value={studentModal.pasteData}
                                        onValueChange={(value) => {
                                            studentModal.setPasteData(value);
                                            parseExcelData(value);
                                        }}
                                        minRows={5}
                                        variant="bordered"
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                    {studentModal.parsedStudents.length > 0 && (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                                                <p className="text-sm text-slate-600">ผลการตรวจสอบ</p>
                                                <div className="flex gap-2 text-xs">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                                        พบ {studentModal.parsedStudents.filter(p => p.status === "matched").length}
                                                    </span>
                                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                                        ลงทะเบียนแล้ว {studentModal.parsedStudents.filter(p => p.status === "already_enrolled").length}
                                                    </span>
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
                                                        ไม่พบ {studentModal.parsedStudents.filter(p => p.status === "not_found").length}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto">
                                                {studentModal.parsedStudents.map((result, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`flex items-center justify-between p-3 border-b border-slate-100 last:border-0 ${
                                                            result.status === "matched" ? "bg-blue-50" :
                                                            result.status === "already_enrolled" ? "bg-amber-50" : "bg-red-50"
                                                        }`}
                                                    >
                                                        <span className="font-medium">{result.inputValue}</span>
                                                        <span className="text-xs">
                                                            {result.status === "matched" && result.matchedStudent?.full_name}
                                                            {result.status === "already_enrolled" && "ลงทะเบียนแล้ว"}
                                                            {result.status === "not_found" && "ไม่พบ"}
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
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button variant="light" onPress={studentModal.reset}>
                            ยกเลิก
                        </Button>
                        {studentModal.mode === "single" ? (
                            <Button 
                                onPress={handleAddStudent}
                                isLoading={isSubmitting}
                                isDisabled={!studentModal.studentId}
                                className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-400/25"
                                startContent={!isSubmitting && <Icon icon="solar:user-plus-bold" />}
                            >
                                เพิ่มนักศึกษา
                            </Button>
                        ) : (
                            <Button 
                                onPress={handleBulkAddStudents}
                                isLoading={isSubmitting}
                                isDisabled={studentModal.parsedStudents.filter(p => p.status === "matched").length === 0}
                                className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-400/25"
                                startContent={!isSubmitting && <Icon icon="solar:users-group-rounded-bold" />}
                            >
                                เพิ่มนักศึกษา ({studentModal.parsedStudents.filter(p => p.status === "matched").length})
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
                            <div className="p-3 rounded-xl shadow-lg bg-gradient-to-br from-blue-400 to-indigo-500 shadow-blue-500/30">
                                <Icon icon="solar:users-group-two-rounded-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    {teamModal.formationMethod === "random"
                                        ? "สุ่มกลุ่มอัตโนมัติ"
                                        : `สร้าง${teamModal.type === "permanent" ? "กลุ่มโปรเจกต์" : "กลุ่มโปรเจกต์รายสัปดาห์"}ใหม่`
                                    }
                                </h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">
                                    {teamModal.formationMethod === "random"
                                        ? `สุ่มจับกลุ่ม${teamModal.type === "permanent" ? "โปรเจกต์" : `สัปดาห์ที่ ${selectedWeek}`}`
                                        : teamModal.type === "permanent"
                                            ? "กลุ่มที่ใช้ตลอดทั้งเทอม"
                                            : `กลุ่มสำหรับสัปดาห์ที่ ${selectedWeek}`
                                    }
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            {teamModal.formationMethod === "random" ? (
                                <>
                                    {/* Random Formation Settings */}
                                    <div>
                                        <label className="text-slate-600 font-medium text-sm mb-2 block">จำนวนสมาชิกต่อกลุ่ม</label>
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
                                                    ? "bg-purple-50 border-purple-200"
                                                    : "bg-emerald-50 border-emerald-200"
                                            }`}>
                                                <Icon icon="solar:users-group-rounded-linear" className={
                                                    teamModal.type === "permanent" ? "text-purple-500" : "text-emerald-500"
                                                } />
                                                <span className="font-bold text-lg text-slate-800">{teamModal.size}</span>
                                                <span className="text-slate-500 text-sm">คน</span>
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
                                                    ? "border-purple-100 bg-purple-50/50"
                                                    : "border-emerald-100 bg-emerald-50/50"
                                            }`}>
                                                <div className="flex items-start gap-3">
                                                    <Icon icon="solar:info-circle-bold" className={`text-xl mt-0.5 ${
                                                        teamModal.type === "permanent" ? "text-purple-500" : "text-emerald-500"
                                                    }`} />
                                                    <div className="space-y-2">
                                                        <p className={`font-medium ${
                                                            teamModal.type === "permanent" ? "text-purple-800" : "text-emerald-800"
                                                        }`}>ตัวอย่างการจับกลุ่ม</p>
                                                        <div className={`text-sm space-y-1 ${
                                                            teamModal.type === "permanent" ? "text-purple-600" : "text-emerald-600"
                                                        }`}>
                                                            <p>• นักศึกษาที่ยังไม่มีกลุ่ม: <span className="font-semibold">{totalStudents}</span> คน</p>
                                                            <p>• จำนวนกลุ่มที่จะสร้าง: <span className="font-semibold">{groupCount}</span> กลุ่ม (กลุ่มละ {teamModal.size} คน)</p>
                                                            {remainder > 0 && totalStudents > 0 && (
                                                                <p className={`${teamModal.type === "permanent" ? "text-purple-700" : "text-emerald-700"} font-medium`}>
                                                                    • กลุ่มสุดท้าย (กลุ่มที่ {groupCount}) จะมี <span className="font-semibold">{lastGroupSize}</span> คน
                                                                </p>
                                                            )}
                                                            {remainder === 0 && totalStudents > 0 && (
                                                                <p className={`${teamModal.type === "permanent" ? "text-purple-700" : "text-emerald-700"}`}>
                                                                    • ทุกกลุ่มจะมีจำนวนสมาชิกเท่ากัน ✓
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </>
                            ) : (
                                <>
                                    {/* Team Name */}
                                    <Input
                                        label="ชื่อกลุ่ม"
                                        labelPlacement="outside"
                                        placeholder="เช่น กลุ่ม 1, กลุ่ม A, ทีม Alpha"
                                        variant="bordered"
                                        size="md"
                                        value={teamModal.name}
                                        onValueChange={teamModal.setName}
                                        isRequired
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />

                                    {/* Member Selection Mode Toggle */}
                                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                                        <button
                                            onClick={() => {
                                                teamModal.setMemberMode("select");
                                                teamModal.setPasteData("");
                                                teamModal.setParsedMembers([]);
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                                teamModal.memberMode === "select"
                                                    ? `bg-white shadow-sm ${teamModal.type === "permanent" ? "text-purple-600" : "text-emerald-600"}`
                                                    : "text-slate-600 hover:bg-slate-200"
                                            }`}
                                        >
                                            <Icon icon="solar:checklist-linear" />
                                            เลือกจากรายชื่อ
                                        </button>
                                        <button
                                            onClick={() => {
                                                teamModal.setMemberMode("paste");
                                                teamModal.setMembers([]);
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                                teamModal.memberMode === "paste"
                                                    ? `bg-white shadow-sm ${teamModal.type === "permanent" ? "text-purple-600" : "text-emerald-600"}`
                                                    : "text-slate-600 hover:bg-slate-200"
                                            }`}
                                        >
                                            <Icon icon="solar:clipboard-list-linear" />
                                            วางจาก Excel
                                        </button>
                                    </div>

                                    {/* Select Mode - Member Selection */}
                                    {teamModal.memberMode === "select" && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-slate-600 font-medium text-sm">
                                                    เลือกสมาชิก ({teamModal.members.length} คน)
                                                </label>
                                                {teamModal.members.length > 0 && (
                                                    <Button
                                                        size="sm"
                                                        variant="light"
                                                        color="danger"
                                                        onPress={() => teamModal.setMembers([])}
                                                    >
                                                        ล้างทั้งหมด
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                                    <p className="text-sm text-slate-600">
                                                        นักศึกษาที่ยังไม่อยู่ในกลุ่ม: {getUnassignedStudents(teamModal.type, teamModal.type === "weekly" ? selectedWeek : undefined).length} คน
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
                                                                className={`flex items-center justify-between p-3 cursor-pointer transition-colors border-b border-slate-100 last:border-0 ${
                                                                    teamModal.members.includes(student.id)
                                                                        ? teamModal.type === "permanent"
                                                                            ? "bg-purple-50 border-l-4 border-l-purple-500"
                                                                            : "bg-emerald-50 border-l-4 border-l-emerald-500"
                                                                        : "hover:bg-slate-50"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <Avatar name={student.full_name} size="sm" className={
                                                                        teamModal.type === "permanent" ? "bg-purple-500" : "bg-emerald-500"
                                                                    } />
                                                                    <div>
                                                                        <p className="font-medium text-slate-800">{student.full_name}</p>
                                                                        <p className="text-sm text-slate-500">{student.student_id}</p>
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
                                                            <Icon icon="solar:users-group-rounded-linear" className="text-4xl text-slate-300 mx-auto mb-2" />
                                                            <p className="text-slate-400">นักศึกษาทั้งหมดอยู่ในกลุ่มแล้ว</p>
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
                                                <label className="text-slate-600 font-medium text-sm mb-2 block">
                                                    วางรหัสนักศึกษาจาก Excel
                                                </label>
                                                <p className="text-xs text-slate-400 mb-2">
                                                    คัดลอกคอลัมน์รหัสนักศึกษาจาก Excel แล้ววางที่นี่ (หนึ่งรหัสต่อหนึ่งบรรทัด)
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
                                                        inputWrapper: `bg-white ${
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
                                                    <span className="ml-2 text-slate-500">กำลังค้นหานักศึกษา...</span>
                                                </div>
                                            )}

                                            {/* Parse Results */}
                                            {teamModal.parsedMembers.length > 0 && (
                                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                                                        <p className="text-sm text-slate-600">
                                                            ผลการตรวจสอบ ({teamModal.parsedMembers.length} รายการ)
                                                        </p>
                                                        <div className="flex gap-2 text-xs">
                                                            <span className={`px-2 py-1 rounded-full ${
                                                                teamModal.type === "permanent"
                                                                    ? "bg-purple-100 text-purple-700"
                                                                    : "bg-emerald-100 text-emerald-700"
                                                            }`}>
                                                                พบ {teamModal.parsedMembers.filter(p => p.status === "matched").length}
                                                            </span>
                                                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                                                มีกลุ่มแล้ว {teamModal.parsedMembers.filter(p => p.status === "already_in_team").length}
                                                            </span>
                                                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
                                                                ไม่พบ {teamModal.parsedMembers.filter(p => p.status === "not_found").length}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto">
                                                        {teamModal.parsedMembers.map((result, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`flex items-center justify-between p-3 border-b border-slate-100 last:border-0 ${
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
                                                                                <p className="font-medium text-slate-800">{result.matchedStudent.full_name}</p>
                                                                                <p className="text-sm text-slate-500">{result.matchedStudent.student_id}</p>
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center">
                                                                                <Icon icon="solar:question-circle-linear" className="text-red-600" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-medium text-slate-800">{result.inputValue}</p>
                                                                                <p className="text-sm text-red-500">ไม่พบในระบบ</p>
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
                                                                            พร้อมเพิ่ม
                                                                        </span>
                                                                    )}
                                                                    {result.status === "already_in_team" && (
                                                                        <span className="text-xs px-2 py-1 bg-amber-200 text-amber-700 rounded-full flex items-center gap-1">
                                                                            <Icon icon="solar:info-circle-bold" className="text-sm" />
                                                                            มีกลุ่มแล้ว
                                                                        </span>
                                                                    )}
                                                                    {result.status === "not_found" && (
                                                                        <span className="text-xs px-2 py-1 bg-red-200 text-red-700 rounded-full flex items-center gap-1">
                                                                            <Icon icon="solar:close-circle-bold" className="text-sm" />
                                                                            ไม่พบ
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
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button variant="light" onPress={teamModal.reset}>
                            ยกเลิก
                        </Button>
                        <Button 
                            onPress={handleCreateTeam}
                            isLoading={isSubmitting}
                            isDisabled={
                                teamModal.formationMethod === "manual" 
                                    ? !teamModal.name.trim() || teamModal.members.length === 0
                                    : getUnassignedStudents(teamModal.type, teamModal.type === "weekly" ? selectedWeek : undefined).length === 0
                            }
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-500/25"
                            startContent={!isSubmitting && <Icon icon={teamModal.formationMethod === "random" ? "solar:shuffle-bold" : "solar:add-circle-bold"} />}
                        >
                            {teamModal.formationMethod === "random"
                                ? "สุ่มกลุ่ม"
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
                            <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:pen-new-square-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">แก้ไขกลุ่ม</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">แก้ไขชื่อและสมาชิกในกลุ่ม</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            {/* Team Name */}
                            <Input
                                label="ชื่อกลุ่ม"
                                labelPlacement="outside"
                                placeholder="เช่น กลุ่ม 1, กลุ่ม A, ทีม Alpha"
                                variant="bordered"
                                size="md"
                                value={editTeamModal.name}
                                onValueChange={editTeamModal.setName}
                                isRequired
                                className="pt-3"
                                classNames={{
                                    inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            />

                            {/* Current Members */}
                            <div>
                                <label className="text-slate-600 font-medium text-sm mb-2 block">
                                    สมาชิกปัจจุบัน ({editTeamModal.members.length} คน)
                                </label>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="max-h-40 overflow-y-auto">
                                        {editTeamModal.members.length > 0 ? (
                                            editTeamModal.members.map((memberId) => {
                                                const student = getAllEnrolledStudents().find(s => s.id === memberId);
                                                if (!student) return null;
                                                return (
                                                    <div
                                                        key={memberId}
                                                        className="flex items-center justify-between p-3 border-b border-slate-100 last:border-0 bg-blue-50"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Avatar name={student.full_name} size="sm" className="bg-blue-500" />
                                                            <div>
                                                                <p className="font-medium text-slate-800">{student.full_name}</p>
                                                                <p className="text-sm text-slate-500">{student.student_id}</p>
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
                                                <Icon icon="solar:users-group-rounded-linear" className="text-3xl text-slate-300 mx-auto mb-2" />
                                                <p className="text-slate-400 text-sm">ยังไม่มีสมาชิกในกลุ่ม</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Add Members */}
                            <div>
                                <label className="text-slate-600 font-medium text-sm mb-2 block">
                                    เพิ่มสมาชิก
                                </label>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                        <p className="text-sm text-slate-600">
                                            นักศึกษาที่ยังไม่อยู่ในกลุ่ม: {getAvailableStudentsForEdit().filter(s => !editTeamModal.members.includes(s.id)).length} คน
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
                                                        className="flex items-center justify-between p-3 cursor-pointer transition-colors border-b border-slate-100 last:border-0 hover:bg-slate-50"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Avatar name={student.full_name} size="sm" className="bg-slate-400" />
                                                            <div>
                                                                <p className="font-medium text-slate-800">{student.full_name}</p>
                                                                <p className="text-sm text-slate-500">{student.student_id}</p>
                                                            </div>
                                                        </div>
                                                        <Icon icon="solar:add-circle-linear" className="text-xl text-blue-500" />
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="text-center py-6">
                                                <Icon icon="solar:users-group-rounded-linear" className="text-3xl text-slate-300 mx-auto mb-2" />
                                                <p className="text-slate-400 text-sm">นักศึกษาทั้งหมดอยู่ในกลุ่มแล้ว</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button variant="light" onPress={editTeamModal.reset}>
                            ยกเลิก
                        </Button>
                        <Button 
                            onPress={handleSaveEditedTeam}
                            isLoading={isSubmitting}
                            isDisabled={!editTeamModal.name.trim() || editTeamModal.members.length === 0}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-400/25"
                            startContent={!isSubmitting && <Icon icon="solar:diskette-bold" />}
                        >
                            บันทึก
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
                            <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:danger-triangle-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    {deleteModal.target?.type === "section" && "ลบกลุ่มเรียน"}
                                    {deleteModal.target?.type === "student" && "นำนักศึกษาออก"}
                                    {deleteModal.target?.type === "team" && "ลบกลุ่ม"}
                                </h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">
                                    กรุณาตรวจสอบข้อมูลก่อนดำเนินการ
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-4">
                            {/* Item Info Card */}
                            <Card className="border border-red-100 bg-red-50/50">
                                <CardBody className="py-4 px-4">
                                    {deleteModal.target?.type === "section" && (
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                                                <Icon icon="solar:users-group-two-rounded-bold" className="text-2xl text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold text-lg text-slate-800">Section {deleteModal.target.sectionNo}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700">
                                                        กลุ่มเรียน
                                                    </Chip>
                                                </div>
                                                <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Icon icon="solar:users-group-rounded-linear" className="text-blue-500" />
                                                        {deleteModal.target.sectionStudentCount || 0} คน
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {deleteModal.target?.type === "student" && (
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-indigo-500 to-blue-600">
                                                <Icon icon="solar:user-bold" className="text-2xl text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold text-lg text-slate-800">{deleteModal.target.studentName}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-700">
                                                        {deleteModal.target.studentCode}
                                                    </Chip>
                                                    <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
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
                                                    ? "bg-gradient-to-br from-purple-500 to-indigo-600"
                                                    : "bg-gradient-to-br from-emerald-500 to-teal-600"
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
                                                <p className="font-semibold text-lg text-slate-800">{deleteModal.target.teamName}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Chip size="sm" variant="flat" className={
                                                        deleteModal.target.teamType === "permanent"
                                                            ? "bg-purple-100 text-purple-700"
                                                            : "bg-emerald-100 text-emerald-700"
                                                    }>
                                                        {deleteModal.target.teamType === "permanent" ? "กลุ่มโปรเจกต์" : "กลุ่มสัปดาห์"}
                                                    </Chip>
                                                </div>
                                                <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Icon icon="solar:users-group-rounded-linear" className="text-slate-400" />
                                                        {deleteModal.target.teamMembers?.length || 0} สมาชิก
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>

                            {/* Amber Warning Card */}
                            <Card className="border border-amber-200 bg-amber-50">
                                <CardBody className="py-3 px-4">
                                    <div className="flex items-start gap-3">
                                        <Icon icon="solar:info-circle-bold" className="text-xl text-amber-600 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-amber-800">สิ่งที่จะเกิดขึ้น</p>
                                            <p className="text-sm text-amber-700 mt-1">
                                                {deleteModal.target?.type === "section" && "นักศึกษาทั้งหมดในกลุ่มเรียนนี้จะถูกลบออกจากรายวิชา"}
                                                {deleteModal.target?.type === "student" && "นักศึกษาจะถูกลบออกจากกลุ่มเรียนนี้"}
                                                {deleteModal.target?.type === "team" && "สมาชิกทั้งหมดจะถูกลบออกจากกลุ่มนี้"}
                                            </p>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>

                            {/* Confirmation Input for Section Delete */}
                            {deleteModal.target?.type === "section" && (
                                <div className="space-y-3">
                                    <div className="p-4 bg-red-100 rounded-xl border border-red-200">
                                        <div className="flex items-start gap-3">
                                            <Icon icon="solar:shield-warning-bold" className="text-2xl text-red-600 mt-0.5" />
                                            <div>
                                                <p className="font-semibold text-red-800">
                                                    พิมพ์ &quot;{deleteModal.target.sectionNo}&quot; เพื่อยืนยันการลบ
                                                </p>
                                                <p className="text-sm text-red-600 mt-1">
                                                    การลบกลุ่มเรียนจะลบนักศึกษาทั้งหมดออกจากรายวิชา
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <Input
                                        placeholder={`พิมพ์ "${deleteModal.target.sectionNo}" เพื่อยืนยัน`}
                                        value={deleteModal.confirmInput}
                                        onValueChange={deleteModal.setConfirmInput}
                                        variant="bordered"
                                        classNames={{
                                            inputWrapper: "border-red-200 hover:border-red-300 focus-within:!border-red-400",
                                        }}
                                    />
                                </div>
                            )}

                            {/* Red Warning for non-section delete */}
                            {deleteModal.target?.type !== "section" && (
                                <div className="p-4 bg-red-100 rounded-xl border border-red-200">
                                    <div className="flex items-center gap-3">
                                        <Icon icon="solar:shield-warning-bold" className="text-2xl text-red-600" />
                                        <div>
                                            <p className="font-semibold text-red-800">
                                                คุณต้องการดำเนินการต่อหรือไม่?
                                            </p>
                                            <p className="text-sm text-red-600">
                                                การดำเนินการนี้ไม่สามารถย้อนกลับได้
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button 
                            variant="light" 
                            onPress={deleteModal.reset}
                            isDisabled={isSubmitting}
                        >
                            ยกเลิก
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
                                deleteModal.target?.type === "section" 
                                    ? deleteModal.confirmInput !== deleteModal.target?.sectionNo
                                    : false
                            }
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {deleteModal.target?.type === "section" && "ลบกลุ่มเรียน"}
                            {deleteModal.target?.type === "student" && "นำออก"}
                            {deleteModal.target?.type === "team" && "ลบกลุ่ม"}
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
                            <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-amber-500/30">
                                <Icon icon="solar:restart-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">กู้คืนนักศึกษา</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">
                                    กรุณาตรวจสอบข้อมูลก่อนดำเนินการ
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
                                        <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-amber-400 to-orange-500">
                                            <Icon icon="solar:user-bold" className="text-2xl text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-lg text-slate-800">{restoreModal.target?.full_name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {restoreModal.target?.student_ref_id !== 0 && (
                                                    <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-700">
                                                        {restoreModal.target?.student_ref_id}
                                                    </Chip>
                                                )}
                                                <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
                                                    Section {restoreModal.target?.section_no}
                                                </Chip>
                                                <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-700">
                                                    เหลือ {restoreModal.target?.remaining_days} วัน
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
                                            <p className="font-medium text-green-800">สิ่งที่จะเกิดขึ้น</p>
                                            <p className="text-sm text-green-700 mt-1">
                                                นักศึกษาจะถูกเพิ่มกลับเข้ากลุ่ม Section {restoreModal.target?.section_no} ตามเดิม
                                            </p>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button
                            variant="light"
                            onPress={restoreModal.reset}
                            isDisabled={isSubmitting}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            onPress={confirmRestoreStudent}
                            isLoading={isSubmitting}
                            className="bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25"
                            startContent={!isSubmitting && <Icon icon="solar:restart-bold" />}
                        >
                            กู้คืนนักศึกษา
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
                            <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:danger-triangle-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">ลบกลุ่มทั้งหมด</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">
                                    กรุณาตรวจสอบข้อมูลก่อนดำเนินการ
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
                                        <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                                            <Icon icon="solar:calendar-bold" className="text-2xl text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-lg text-slate-800">สัปดาห์ที่ {selectedWeek}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Chip size="sm" variant="flat" className="bg-emerald-100 text-emerald-700">
                                                    กลุ่มสัปดาห์
                                                </Chip>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Icon icon="solar:users-group-rounded-linear" className="text-emerald-500" />
                                                    {weeklyTeams[selectedWeek]?.length || 0} กลุ่ม
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
                                            <p className="font-medium text-amber-800">สิ่งที่จะเกิดขึ้น</p>
                                            <p className="text-sm text-amber-700 mt-1">
                                                กลุ่มทั้งหมดในสัปดาห์ที่ {selectedWeek} จะถูกลบออก
                                                สมาชิกทั้งหมดจะไม่มีกลุ่มในสัปดาห์นี้
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
                                            คุณต้องการลบกลุ่มทั้งหมดหรือไม่?
                                        </p>
                                        <p className="text-sm text-red-600">
                                            การดำเนินการนี้ไม่สามารถย้อนกลับได้
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button 
                            variant="light" 
                            onPress={() => bulkDeleteModal.setIsOpen(false)}
                            isDisabled={isSubmitting}
                        >
                            ยกเลิก
                        </Button>
                        <Button 
                            color="primary"
                            onPress={handleBulkDeleteTeams}
                            isLoading={isSubmitting}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            ลบทั้งหมด
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
