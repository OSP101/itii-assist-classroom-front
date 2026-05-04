"use client";

import { useState, useCallback } from "react";
import { addToast } from "@heroui/toast";

// Team Member type
interface TeamMember {
    id: number;
    student_id: string;
    full_name: string;
}

interface ParsedMember {
    inputValue: string;
    matchedStudent: TeamMember | null;
    status: "matched" | "not_found" | "already_in_team";
}

interface UseModalStatesOptions {
    permanentTeams?: Array<{ members: TeamMember[] }>;
    weeklyTeams?: Record<number, Array<{ members: TeamMember[] }>>;
    selectedWeek?: number;
}

/**
 * Custom hook for managing modal states to reduce main component complexity
 */
export function useModalStates(options: UseModalStatesOptions = {}) {
    const { permanentTeams = [], weeklyTeams = {}, selectedWeek = 1 } = options;

    // Section Modal states
    const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
    const [newSectionNo, setNewSectionNo] = useState("");
    const [newSectionNote, setNewSectionNote] = useState("");

    // Team Modal states
    const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
    const [teamCreationType, setTeamCreationType] = useState<"permanent" | "weekly">("permanent");
    const [newTeamName, setNewTeamName] = useState("");
    const [selectedTeamMembers, setSelectedTeamMembers] = useState<number[]>([]);
    const [teamFormationMethod, setTeamFormationMethod] = useState<"manual" | "random">("manual");
    const [teamSize, setTeamSize] = useState(3);
    const [selectedSectionForTeam, setSelectedSectionForTeam] = useState<number | "all">("all");
    const [teamMemberMode, setTeamMemberMode] = useState<"select" | "paste">("select");
    const [teamExcelPasteData, setTeamExcelPasteData] = useState("");
    const [parsedTeamMembers, setParsedTeamMembers] = useState<ParsedMember[]>([]);
    const [isParsingTeamMembers, setIsParsingTeamMembers] = useState(false);

    // Edit Team Modal states
    const [isEditTeamModalOpen, setIsEditTeamModalOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<{
        id: number;
        name: string;
        type: "permanent" | "weekly";
        weekNumber?: number;
        members: TeamMember[];
    } | null>(null);
    const [editTeamName, setEditTeamName] = useState("");
    const [editTeamMembers, setEditTeamMembers] = useState<number[]>([]);
    const [editMemberMode, setEditMemberMode] = useState<"select" | "paste">("select");
    const [editExcelPasteData, setEditExcelPasteData] = useState("");
    const [editParsedMembers, setEditParsedMembers] = useState<ParsedMember[]>([]);
    const [isParsingEditMembers, setIsParsingEditMembers] = useState(false);

    // TA Modal states
    const [isAddTAModalOpen, setIsAddTAModalOpen] = useState(false);
    const [selectedTAIds, setSelectedTAIds] = useState<number[]>([]);
    const [taSearchQuery, setTASearchQuery] = useState("");

    // Instructor Modal states
    const [isAddInstructorModalOpen, setIsAddInstructorModalOpen] = useState(false);
    const [selectedInstructorIds, setSelectedInstructorIds] = useState<number[]>([]);
    const [instructorSearchQuery, setInstructorSearchQuery] = useState("");

    // Student Modal states
    const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
    const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string>("");
    const [studentSearchQuery, setStudentSearchQuery] = useState("");
    const [addStudentMode, setAddStudentMode] = useState<"select" | "paste">("select");
    const [excelPasteData, setExcelPasteData] = useState("");
    const [parsedStudents, setParsedStudents] = useState<Array<{
        inputValue: string;
        matchedStudent: any | null;
        status: "matched" | "not_found" | "already_enrolled";
    }>>([]);

    // Delete Confirmation Modal states
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteType, setDeleteType] = useState<"student" | "team" | "section" | "ta" | "instructor" | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{
        studentId?: number;
        studentName?: string;
        studentCode?: string;
        sectionId?: number;
        sectionNo?: string;
        sectionStudentCount?: number;
        teamId?: number;
        teamName?: string;
        teamType?: "permanent" | "weekly";
        weekNumber?: number;
        teamMembers?: TeamMember[];
        taId?: number;
        taName?: string;
        taEmail?: string;
        taAvatar?: string;
        instructorId?: number;
        instructorName?: string;
        instructorEmail?: string;
        instructorAvatar?: string;
    } | null>(null);

    // Bulk delete teams modal
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    // Score Modal states
    const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
    const [isBonusScoreModalOpen, setIsBonusScoreModalOpen] = useState(false);
    const [isGroupScoreModalOpen, setIsGroupScoreModalOpen] = useState(false);

    // General submitting state
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset section modal
    const resetSectionModal = useCallback(() => {
        setNewSectionNo("");
        setNewSectionNote("");
        setIsAddSectionModalOpen(false);
    }, []);

    // Reset team modal
    const resetTeamModal = useCallback(() => {
        setNewTeamName("");
        setSelectedTeamMembers([]);
        setTeamMemberMode("select");
        setTeamExcelPasteData("");
        setParsedTeamMembers([]);
        setIsCreateTeamModalOpen(false);
    }, []);

    // Reset edit team modal
    const resetEditTeamModal = useCallback(() => {
        setEditingTeam(null);
        setEditTeamName("");
        setEditTeamMembers([]);
        setEditMemberMode("select");
        setEditExcelPasteData("");
        setEditParsedMembers([]);
        setIsEditTeamModalOpen(false);
    }, []);

    // Reset TA modal
    const resetTAModal = useCallback(() => {
        setSelectedTAIds([]);
        setTASearchQuery("");
        setIsAddTAModalOpen(false);
    }, []);

    // Reset instructor modal
    const resetInstructorModal = useCallback(() => {
        setSelectedInstructorIds([]);
        setInstructorSearchQuery("");
        setIsAddInstructorModalOpen(false);
    }, []);

    // Reset student modal
    const resetStudentModal = useCallback(() => {
        setSelectedStudentId("");
        setStudentSearchQuery("");
        setAddStudentMode("select");
        setExcelPasteData("");
        setParsedStudents([]);
        setIsAddStudentModalOpen(false);
    }, []);

    // Reset delete modal
    const resetDeleteModal = useCallback(() => {
        setDeleteType(null);
        setDeleteTarget(null);
        setIsDeleteModalOpen(false);
    }, []);

    // Open delete confirmation
    const openDeleteConfirmation = useCallback((
        type: "student" | "team" | "section" | "ta" | "instructor",
        target: typeof deleteTarget
    ) => {
        setDeleteType(type);
        setDeleteTarget(target);
        setIsDeleteModalOpen(true);
    }, []);

    // Open edit team modal
    const openEditTeamModal = useCallback((team: typeof editingTeam) => {
        if (!team) return;
        setEditingTeam(team);
        setEditTeamName(team.name);
        setEditTeamMembers(team.members.map(m => m.id));
        setEditMemberMode("select");
        setEditExcelPasteData("");
        setEditParsedMembers([]);
        setIsEditTeamModalOpen(true);
    }, []);

    return {
        // Section Modal
        sectionModal: {
            isOpen: isAddSectionModalOpen,
            setIsOpen: setIsAddSectionModalOpen,
            sectionNo: newSectionNo,
            setSectionNo: setNewSectionNo,
            note: newSectionNote,
            setNote: setNewSectionNote,
            reset: resetSectionModal,
        },

        // Team Modal
        teamModal: {
            isOpen: isCreateTeamModalOpen,
            setIsOpen: setIsCreateTeamModalOpen,
            type: teamCreationType,
            setType: setTeamCreationType,
            name: newTeamName,
            setName: setNewTeamName,
            members: selectedTeamMembers,
            setMembers: setSelectedTeamMembers,
            formationMethod: teamFormationMethod,
            setFormationMethod: setTeamFormationMethod,
            size: teamSize,
            setSize: setTeamSize,
            sectionForTeam: selectedSectionForTeam,
            setSectionForTeam: setSelectedSectionForTeam,
            memberMode: teamMemberMode,
            setMemberMode: setTeamMemberMode,
            excelData: teamExcelPasteData,
            setExcelData: setTeamExcelPasteData,
            parsedMembers: parsedTeamMembers,
            setParsedMembers: setParsedTeamMembers,
            isParsing: isParsingTeamMembers,
            setIsParsing: setIsParsingTeamMembers,
            reset: resetTeamModal,
        },

        // Edit Team Modal
        editTeamModal: {
            isOpen: isEditTeamModalOpen,
            setIsOpen: setIsEditTeamModalOpen,
            team: editingTeam,
            setTeam: setEditingTeam,
            name: editTeamName,
            setName: setEditTeamName,
            members: editTeamMembers,
            setMembers: setEditTeamMembers,
            memberMode: editMemberMode,
            setMemberMode: setEditMemberMode,
            excelData: editExcelPasteData,
            setExcelData: setEditExcelPasteData,
            parsedMembers: editParsedMembers,
            setParsedMembers: setEditParsedMembers,
            isParsing: isParsingEditMembers,
            setIsParsing: setIsParsingEditMembers,
            reset: resetEditTeamModal,
            open: openEditTeamModal,
        },

        // TA Modal
        taModal: {
            isOpen: isAddTAModalOpen,
            setIsOpen: setIsAddTAModalOpen,
            selectedIds: selectedTAIds,
            setSelectedIds: setSelectedTAIds,
            searchQuery: taSearchQuery,
            setSearchQuery: setTASearchQuery,
            reset: resetTAModal,
        },

        // Instructor Modal
        instructorModal: {
            isOpen: isAddInstructorModalOpen,
            setIsOpen: setIsAddInstructorModalOpen,
            selectedIds: selectedInstructorIds,
            setSelectedIds: setSelectedInstructorIds,
            searchQuery: instructorSearchQuery,
            setSearchQuery: setInstructorSearchQuery,
            reset: resetInstructorModal,
        },

        // Student Modal
        studentModal: {
            isOpen: isAddStudentModalOpen,
            setIsOpen: setIsAddStudentModalOpen,
            sectionId: selectedSectionId,
            setSectionId: setSelectedSectionId,
            studentId: selectedStudentId,
            setStudentId: setSelectedStudentId,
            searchQuery: studentSearchQuery,
            setSearchQuery: setStudentSearchQuery,
            mode: addStudentMode,
            setMode: setAddStudentMode,
            excelData: excelPasteData,
            setExcelData: setExcelPasteData,
            parsedStudents: parsedStudents,
            setParsedStudents: setParsedStudents,
            reset: resetStudentModal,
        },

        // Delete Modal
        deleteModal: {
            isOpen: isDeleteModalOpen,
            setIsOpen: setIsDeleteModalOpen,
            type: deleteType,
            target: deleteTarget,
            reset: resetDeleteModal,
            open: openDeleteConfirmation,
        },

        // Bulk Delete Modal
        bulkDeleteModal: {
            isOpen: isBulkDeleteModalOpen,
            setIsOpen: setIsBulkDeleteModalOpen,
        },

        // Score Modals
        scoreModals: {
            isScoreModalOpen,
            setIsScoreModalOpen,
            isBonusScoreModalOpen,
            setIsBonusScoreModalOpen,
            isGroupScoreModalOpen,
            setIsGroupScoreModalOpen,
        },

        // General
        isSubmitting,
        setIsSubmitting,
    };
}
