"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import Link from "next/link";
// Import custom hooks
import {
    useClassroomData,
    useClassroomActions,
    useScores,
    useModalStates,
    type TeamMember,
    type PermanentTeam,
    type WeeklyTeam,
} from "./hooks";

// Import service types
import type { Assignment as AssignmentType, AssignmentSubItem } from "@/services/assignment.service";
import { getCurrentCourseMemberPermissions } from "@/services/course.service";
import type { CourseMemberPermissions, SectionStudent } from "@/services/course.service";

// Import Skeletons directly (they're small and used for loading states)
import { OverviewSkeleton, TeamsGridSkeleton, SidebarMenuSkeleton, PeopleTableSkeleton, AssignmentsSkeleton, ScoresSkeleton, TabListSkeleton } from "./components/Skeletons";

// Lazy load heavy Tab components with custom loading states
const OverviewTab = dynamic(() => import("./components/OverviewTab"), {
    loading: () => <OverviewSkeleton />,
    ssr: false,
});

const SectionsTab = dynamic(() => import("./components/SectionsTab"), {
    loading: () => <TabListSkeleton />,
    ssr: false,
});

const PeopleTab = dynamic(() => import("./components/PeopleTab"), {
    loading: () => <PeopleTableSkeleton />,
    ssr: false,
});

const AssignmentsTab = dynamic(() => import("./components/AssignmentsTab"), {
    loading: () => <AssignmentsSkeleton />,
    ssr: false,
});

const AttendanceTab = dynamic(() => import("./components/AttendanceTab"), {
    loading: () => <TabListSkeleton />,
    ssr: false,
});

const ScoresTab = dynamic(() => import("./components/ScoreSummaryTab"), {
    loading: () => <ScoresSkeleton />,
    ssr: false,
});

const QueueTab = dynamic(() => import("./components/QueueTab"), {
    loading: () => <TabListSkeleton />,
    ssr: false,
});

const ScoreApprovalTab = dynamic(() => import("./components/ScoreApprovalTab"), {
    loading: () => <TabListSkeleton />,
    ssr: false,
});

const ExamScoresTab = dynamic(() => import("./components/exam-scores/ExamScoresTab"), {
    loading: () => <TabListSkeleton />,
    ssr: false,
});

// Lazy load Modal (only needed when user opens it)
const ScoreModal = dynamic(() => import("./components/ScoreModal"), {
    loading: () => null,
    ssr: false,
});

const BonusScoreModal = dynamic(() => import("./components/BonusScoreModal"), {
    loading: () => null,
    ssr: false,
});

const SettingsTab = dynamic(() => import("./components/SettingsTab"), {
    loading: () => <TabListSkeleton />,
    ssr: false,
});

const ActivityLogTab = dynamic(() => import("./components/ActivityLogTab"), {
    loading: () => <TabListSkeleton />,
    ssr: false,
});

const TAStatsTab = dynamic(() => import("./components/TAStatsTab"), {
    loading: () => <TabListSkeleton />,
    ssr: false,
});

export default function ClassroomDetailPage() {
    const params = useParams();
    const courseId = params.id as string;

    // ============================================
    // Custom Hooks - Data & Business Logic
    // ============================================

    const classroomData = useClassroomData(courseId);
    const {
        course,
        setCourse,
        overview,
        assignments,
        setAssignments,
        attendanceSessions,
        permanentTeams,
        setPermanentTeams,
        weeklyTeams,
        setWeeklyTeams,
        tasList,
        studentsList,
        instructorsList,
        sectionStudents,
        setSectionStudents,
        userRole,
        currentUserId,
        pendingApprovalCount,
        setPendingApprovalCount,
        isConnected,
        isLoading,
        isOverviewLoading,
        isAssignmentsLoading,
        isTeamsLoading,
        isPeopleLoading,
        isStudentsLoading,
        pendingAssignmentUpdate,
        ackAssignmentUpdate,
        fetchCourse,
        fetchOverview,
        fetchAssignments,
        fetchAttendanceSessions,
        fetchTeams,
        fetchSectionStudents,
        fetchAllSectionStudents,
        refreshForTab,
        initializeData,
        emitUpdate,
        naturalSort,
    } = classroomData;

    const classroomActions = useClassroomActions({
        courseId,
        course,
        setCourse,
        sectionStudents,
        setSectionStudents,
        permanentTeams,
        setPermanentTeams,
        weeklyTeams,
        setWeeklyTeams,
        studentsList,
        fetchCourse,
        fetchOverview,
        fetchTeams,
        fetchAllSectionStudents,
        emitUpdate,
    });

    const scores = useScores({
        onOverviewRefresh: () => fetchOverview(true),
        emitUpdate,
    });

    const modals = useModalStates();

    // ============================================
    // UI-Only States (local to this component)
    // ============================================

    const [activeTab, setActiveTab] = useState("overview");
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [expandedSections, setExpandedSections] = useState<number[]>([]);

    // Section UI states
    const [sectionSubTab, setSectionSubTab] = useState<"students" | "permanent" | "weekly">("students");
    const [sectionSearchQuery, setSectionSearchQuery] = useState("");

    // Team UI states
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [totalWeeks] = useState(15);
    const [selectedSectionForTeam, setSelectedSectionForTeam] = useState<number | "all">("all");

    // Score modal specific state
    const [scoreModalAssignment, setScoreModalAssignment] = useState<AssignmentType | null>(null);
    const [scoreSearchQuery, setScoreSearchQuery] = useState("");

    // ============================================
    // Computed Values (Memoized)
    // ============================================

    const totalStudents = useMemo(() => {
        return course?.sections?.reduce((acc, section) => acc + (section.studentCount || 0), 0) || 0;
    }, [course?.sections]);

    const currentCoursePermissions = useMemo<CourseMemberPermissions>(() => {
        return getCurrentCourseMemberPermissions(course, currentUserId, userRole);
    }, [course, currentUserId, userRole]);

    const canViewPeople = currentCoursePermissions.view_people || currentCoursePermissions.add_people || currentCoursePermissions.remove_people || currentCoursePermissions.edit_member_permissions;
    const canAddPeople = currentCoursePermissions.add_people;
    const canRemovePeople = currentCoursePermissions.remove_people;
    const canEditMemberPermissions = currentCoursePermissions.edit_member_permissions;
    const canAccessSections = currentCoursePermissions.view_sections
        || currentCoursePermissions.create_sections
        || currentCoursePermissions.update_sections
        || currentCoursePermissions.delete_sections
        || currentCoursePermissions.manage_section_students
        || currentCoursePermissions.view_teams
        || currentCoursePermissions.create_teams
        || currentCoursePermissions.update_teams
        || currentCoursePermissions.delete_teams
        || currentCoursePermissions.manage_team_members;
    const canAccessAssignments = currentCoursePermissions.view_assignments
        || currentCoursePermissions.create_assignments
        || currentCoursePermissions.update_assignments
        || currentCoursePermissions.delete_assignments
        || currentCoursePermissions.grade_assignments
        || currentCoursePermissions.edit_scores;
    const canAccessScores = currentCoursePermissions.view_score_summary || currentCoursePermissions.grade_assignments || currentCoursePermissions.edit_scores;
    const canAccessExamScores = currentCoursePermissions.view_exam_scores
        || currentCoursePermissions.create_exam_scores
        || currentCoursePermissions.update_exam_scores
        || currentCoursePermissions.delete_exam_scores
        || currentCoursePermissions.update_exam_settings;
    const canAccessApproval = currentCoursePermissions.review_own_score_requests || currentCoursePermissions.review_all_score_requests;
    const canAccessAttendance = currentCoursePermissions.view_attendance
        || currentCoursePermissions.create_attendance_sessions
        || currentCoursePermissions.update_attendance_sessions
        || currentCoursePermissions.delete_attendance_sessions
        || currentCoursePermissions.update_attendance_status;
    const canAccessQueue = currentCoursePermissions.view_queue
        || currentCoursePermissions.create_queue_sessions
        || currentCoursePermissions.update_queue_sessions
        || currentCoursePermissions.delete_queue_sessions
        || currentCoursePermissions.manage_queue_bookings;
    const approvalRole = currentCoursePermissions.review_all_score_requests ? "instructor" : "ta";

    const availableTAs = useMemo(() => {
        return tasList.filter(ta => !course?.tas?.some(courseTa => courseTa.id === ta.id));
    }, [tasList, course?.tas]);

    const filteredInstructors = useMemo(() => {
        const existingIds = course?.instructors?.map(i => i.id) || [];
        return instructorsList.filter(instructor => {
            if (existingIds.includes(instructor.id)) return false;
            if (modals.instructorModal.searchQuery) {
                const query = modals.instructorModal.searchQuery.toLowerCase();
                return instructor.full_name.toLowerCase().includes(query) ||
                    instructor.email?.toLowerCase().includes(query);
            }
            return true;
        });
    }, [instructorsList, course?.instructors, modals.instructorModal.searchQuery]);

    // Get all enrolled students (for team management)
    const getAllEnrolledStudents = useCallback((): TeamMember[] => {
        const students: TeamMember[] = [];
        Object.values(sectionStudents).forEach(sectionList => {
            sectionList.forEach(s => {
                if (!students.some(existing => existing.id === s.id)) {
                    students.push({
                        id: s.id,
                        student_id: s.student_id,
                        full_name: s.full_name
                    });
                }
            });
        });
        return students;
    }, [sectionStudents]);

    // Get students in a specific section
    const getStudentsInSection = useCallback((sectionId: number): TeamMember[] => {
        return (sectionStudents[sectionId] || []).map(s => ({
            id: s.id,
            student_id: s.student_id,
            full_name: s.full_name
        }));
    }, [sectionStudents]);

    // Get all enrolled student IDs
    const getAllEnrolledStudentIds = useCallback(() => {
        const enrolledIds = new Set<number>();
        Object.values(sectionStudents).forEach(students => {
            students.forEach(s => enrolledIds.add(s.id));
        });
        return enrolledIds;
    }, [sectionStudents]);

    // Get available students (not enrolled)
    const getAvailableStudents = useCallback(() => {
        const enrolledIds = getAllEnrolledStudentIds();
        return studentsList.filter(student => !enrolledIds.has(student.id));
    }, [studentsList, getAllEnrolledStudentIds]);

    // Get unassigned students (not in any team)
    const getUnassignedStudents = useCallback((teamType: "permanent" | "weekly", weekNumber?: number): TeamMember[] => {
        const allStudents = selectedSectionForTeam === "all"
            ? getAllEnrolledStudents()
            : getStudentsInSection(selectedSectionForTeam as number);

        const assignedIds = new Set<number>();
        if (teamType === "permanent") {
            permanentTeams.forEach(team => {
                team.members.forEach(m => assignedIds.add(m.id));
            });
        } else if (weekNumber !== undefined && weeklyTeams[weekNumber]) {
            weeklyTeams[weekNumber].forEach(team => {
                team.members.forEach(m => assignedIds.add(m.id));
            });
        }
        return allStudents.filter(s => !assignedIds.has(s.id));
    }, [getAllEnrolledStudents, getStudentsInSection, permanentTeams, weeklyTeams, selectedSectionForTeam]);

    // Get student's team info
    const getStudentTeamInfo = useCallback((studentId: number) => {
        const permanentTeam = permanentTeams.find(t => t.members.some(m => m.id === studentId));
        const weeklyTeamsInfo: { weekNumber: number; teamName: string }[] = [];

        Object.entries(weeklyTeams).forEach(([weekNum, teams]) => {
            teams.forEach(team => {
                if (team.members.some(m => m.id === studentId)) {
                    weeklyTeamsInfo.push({ weekNumber: parseInt(weekNum), teamName: team.name });
                }
            });
        });

        return {
            permanentTeam: permanentTeam?.name || null,
            weeklyTeams: weeklyTeamsInfo
        };
    }, [permanentTeams, weeklyTeams]);

    // Find which team a student belongs to
    const findStudentTeam = useCallback((studentId: number, teamType: "permanent" | "weekly", weekNumber?: number): string | null => {
        if (teamType === "permanent") {
            const team = permanentTeams.find(t => t.members.some(m => m.id === studentId));
            return team?.name || null;
        } else if (weekNumber !== undefined && weeklyTeams[weekNumber]) {
            const team = weeklyTeams[weekNumber].find(t => t.members.some(m => m.id === studentId));
            return team?.name || null;
        }
        return null;
    }, [permanentTeams, weeklyTeams]);

    // Get available students for editing team
    const getAvailableStudentsForEdit = useCallback(() => {
        const editTeam = modals.editTeamModal.team;
        if (!editTeam) return [];

        const allStudents = getAllEnrolledStudents();
        const currentMemberIds = new Set(modals.editTeamModal.members);
        const otherTeamMemberIds = new Set<number>();

        if (editTeam.type === "permanent") {
            permanentTeams.forEach(team => {
                if (team.id !== editTeam.id) {
                    team.members.forEach(m => otherTeamMemberIds.add(m.id));
                }
            });
        } else if (editTeam.weekNumber !== undefined) {
            const weekTeams = weeklyTeams[editTeam.weekNumber] || [];
            weekTeams.forEach(team => {
                if (team.id !== editTeam.id) {
                    team.members.forEach(m => otherTeamMemberIds.add(m.id));
                }
            });
        }

        return allStudents.filter(s =>
            currentMemberIds.has(s.id) || !otherTeamMemberIds.has(s.id)
        );
    }, [modals.editTeamModal.team, modals.editTeamModal.members, getAllEnrolledStudents, permanentTeams, weeklyTeams]);

    // Filter section students by search
    const getFilteredSectionStudents = useCallback((sectionId: number) => {
        const students = sectionStudents[sectionId] || [];
        if (!sectionSearchQuery.trim()) return students;
        const query = sectionSearchQuery.toLowerCase();
        return students.filter(s =>
            s.student_id.toLowerCase().includes(query) ||
            s.full_name.toLowerCase().includes(query)
        );
    }, [sectionStudents, sectionSearchQuery]);

    // Filter available students by search
    const filteredStudents = useCallback(() => {
        const available = getAvailableStudents();
        if (!modals.studentModal.searchQuery.trim()) return available;
        const query = modals.studentModal.searchQuery.toLowerCase();
        return available.filter(s =>
            s.student_id.toLowerCase().includes(query) ||
            s.full_name.toLowerCase().includes(query)
        );
    }, [getAvailableStudents, modals.studentModal.searchQuery]);

    // ============================================
    // Effects
    // ============================================

    // Initialize data on mount
    useEffect(() => {
        initializeData();
    }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch section students when course sections load
    useEffect(() => {
        if (course?.sections && course.sections.length > 0) {
            fetchAllSectionStudents();
        }
    }, [course?.sections, fetchAllSectionStudents]);

    // Refresh data when changing tabs
    useEffect(() => {
        refreshForTab(activeTab);
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    // ============================================
    // UI Handlers
    // ============================================

    const toggleSection = useCallback((sectionId: number) => {
        if (expandedSections.includes(sectionId)) {
            setExpandedSections(expandedSections.filter(id => id !== sectionId));
        } else {
            setExpandedSections([...expandedSections, sectionId]);
            if (!sectionStudents[sectionId]) {
                fetchSectionStudents(sectionId);
            }
        }
    }, [expandedSections, sectionStudents, fetchSectionStudents]);

    // ============================================
    // Action Handlers (Bridge to hooks)
    // ============================================

    const handleAddSection = async () => {
        modals.setIsSubmitting(true);
        const success = await classroomActions.addSection(
            modals.sectionModal.sectionNo,
            modals.sectionModal.note
        );
        modals.setIsSubmitting(false);
        if (success) modals.sectionModal.reset();
    };

    const confirmRemoveSection = async () => {
        if (!modals.deleteModal.target?.sectionId) return;
        modals.setIsSubmitting(true);
        const success = await classroomActions.removeSection(modals.deleteModal.target.sectionId);
        modals.setIsSubmitting(false);
        if (success) modals.deleteModal.reset();
    };

    const handleAddTA = async () => {
        modals.setIsSubmitting(true);
        const success = await classroomActions.addTAs(modals.taModal.selectedIds);
        console.log("Add TA result:", modals.taModal.selectedIds);
        modals.setIsSubmitting(false);
        if (success) modals.taModal.reset();
    };

    const confirmRemoveTA = async () => {
        if (!modals.deleteModal.target?.taId) return;
        modals.setIsSubmitting(true);
        const success = await classroomActions.removeTA(modals.deleteModal.target.taId);
        modals.setIsSubmitting(false);
        if (success) modals.deleteModal.reset();
    };

    const handleAddInstructors = async () => {
        modals.setIsSubmitting(true);
        const success = await classroomActions.addInstructors(modals.instructorModal.selectedIds);
        modals.setIsSubmitting(false);
        if (success) modals.instructorModal.reset();
    };

    const confirmRemoveInstructor = async () => {
        if (!(modals.deleteModal.target as any)?.instructorId) return;
        modals.setIsSubmitting(true);
        const success = await classroomActions.removeInstructor((modals.deleteModal.target as any).instructorId);
        modals.setIsSubmitting(false);
        if (success) modals.deleteModal.reset();
    };

    const handleAddStudent = async () => {
        if (!modals.studentModal.sectionId || !modals.studentModal.studentId) {
            addToast({
                title: "ข้อมูลไม่ครบ",
                description: "กรุณาเลือกนักศึกษา",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        modals.setIsSubmitting(true);
        const success = await classroomActions.addStudentToSection(
            modals.studentModal.sectionId,
            parseInt(modals.studentModal.studentId)
        );
        modals.setIsSubmitting(false);
        if (success) modals.studentModal.reset();
    };

    const handleBulkAddStudents = async () => {
        const studentsToAdd = modals.studentModal.parsedStudents
            .filter(p => p.status === "matched" && p.matchedStudent)
            .map(p => p.matchedStudent!.id);

        if (studentsToAdd.length === 0 || !modals.studentModal.sectionId) return;

        modals.setIsSubmitting(true);
        const success = await classroomActions.bulkAddStudentsToSection(
            modals.studentModal.sectionId,
            studentsToAdd
        );
        modals.setIsSubmitting(false);
        if (success) modals.studentModal.reset();
    };

    const confirmRemoveStudent = async () => {
        if (!modals.deleteModal.target?.sectionId || !modals.deleteModal.target?.studentId) return;
        modals.setIsSubmitting(true);
        const success = await classroomActions.removeStudentFromSection(
            modals.deleteModal.target.sectionId,
            modals.deleteModal.target.studentId
        );
        modals.setIsSubmitting(false);
        if (success) modals.deleteModal.reset();
    };

    const handleCreateTeam = async () => {
        modals.setIsSubmitting(true);

        if (modals.teamModal.formationMethod === "manual") {
            const success = await classroomActions.createTeam(
                modals.teamModal.type,
                modals.teamModal.name,
                modals.teamModal.members,
                modals.teamModal.type === "weekly" ? selectedWeek : undefined
            );
            if (success) modals.teamModal.reset();
        } else {
            // Random team creation
            const unassigned = getUnassignedStudents(
                modals.teamModal.type,
                modals.teamModal.type === "weekly" ? selectedWeek : undefined
            );
            const baseName = modals.teamModal.type === "permanent" ? "งานกลุ่ม" : `กลุ่มสัปดาห์ ${selectedWeek}`;
            await classroomActions.createRandomTeams(
                modals.teamModal.type,
                unassigned,
                modals.teamModal.size,
                baseName,
                modals.teamModal.type === "weekly" ? selectedWeek : undefined
            );
            modals.teamModal.reset();
        }

        modals.setIsSubmitting(false);
    };

    const saveEditedTeam = async () => {
        if (!modals.editTeamModal.team) return;
        modals.setIsSubmitting(true);
        const success = await classroomActions.updateTeam(
            modals.editTeamModal.team.id,
            modals.editTeamModal.name,
            modals.editTeamModal.members
        );
        modals.setIsSubmitting(false);
        if (success) modals.editTeamModal.reset();
    };

    const confirmDeleteTeam = async () => {
        if (!modals.deleteModal.target?.teamId) return;
        modals.setIsSubmitting(true);
        const success = await classroomActions.deleteTeam(modals.deleteModal.target.teamId);
        modals.setIsSubmitting(false);
        if (success) modals.deleteModal.reset();
    };

    const confirmBulkDeleteTeams = async () => {
        const teamsToDelete = weeklyTeams[selectedWeek] || [];
        if (teamsToDelete.length === 0) return;

        modals.setIsSubmitting(true);
        await classroomActions.bulkDeleteTeams(teamsToDelete.map(t => t.id));
        modals.setIsSubmitting(false);
        modals.bulkDeleteModal.setIsOpen(false);
    };

    const handleCopyTeamsFromWeek = async (sourceWeek: number) => {
        modals.setIsSubmitting(true);
        await classroomActions.copyTeamsFromWeek(sourceWeek, selectedWeek);
        modals.setIsSubmitting(false);
    };

    // Parse Excel data for students
    const parseExcelData = useCallback((pasteData: string) => {
        if (!pasteData.trim() || !modals.studentModal.sectionId) {
            modals.studentModal.setParsedStudents([]);
            return;
        }

        const lines = pasteData
            .split(/[\n\r]+/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const enrolledStudentIds = new Set(
            (sectionStudents[modals.studentModal.sectionId] || []).map(s => s.student_id)
        );

        const results = lines.map(inputValue => {
            const matchedStudent = studentsList.find(student =>
                student.student_id.toLowerCase() === inputValue.toLowerCase() ||
                student.full_name.toLowerCase().includes(inputValue.toLowerCase()) ||
                inputValue.toLowerCase().includes(student.student_id.toLowerCase())
            );

            if (!matchedStudent) {
                return { inputValue, matchedStudent: null, status: "not_found" as const };
            }

            if (enrolledStudentIds.has(matchedStudent.student_id)) {
                return { inputValue, matchedStudent, status: "already_enrolled" as const };
            }

            return { inputValue, matchedStudent, status: "matched" as const };
        });

        modals.studentModal.setParsedStudents(results);
    }, [studentsList, sectionStudents, modals.studentModal]);

    // Parse Excel data for team members
    const parseTeamExcelData = useCallback(async (pasteData: string) => {
        if (!pasteData.trim()) {
            modals.teamModal.setParsedMembers([]);
            return;
        }

        const lines = pasteData
            .split(/[\n\r]+/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length === 0) {
            modals.teamModal.setParsedMembers([]);
            return;
        }

        modals.teamModal.setIsParsing(true);

        try {
            const sectionFilter = selectedSectionForTeam === "all"
                ? "all"
                : course?.sections?.find(s => s.id === selectedSectionForTeam)?.section_no;

            const response = await classroomActions.searchStudentsByIds(lines, sectionFilter);

            if (!response.success || !response.data) {
                modals.teamModal.setIsParsing(false);
                return;
            }

            const unassignedStudents = getUnassignedStudents(
                modals.teamModal.type,
                modals.teamModal.type === "weekly" ? selectedWeek : undefined
            );
            const unassignedIds = new Set(unassignedStudents.map(s => s.id));

            const results: Array<{
                inputValue: string;
                matchedStudent: TeamMember | null;
                status: "matched" | "not_found" | "already_in_team";
            }> = [];

            response.data.found.forEach((item: any) => {
                const student = item.student;
                const teamMember: TeamMember = {
                    id: student.id,
                    student_id: student.student_id,
                    full_name: student.full_name,
                };

                if (unassignedIds.has(student.id)) {
                    results.push({
                        inputValue: item.query,
                        matchedStudent: teamMember,
                        status: "matched",
                    });
                } else {
                    const existingTeam = findStudentTeam(
                        student.id,
                        modals.teamModal.type,
                        modals.teamModal.type === "weekly" ? selectedWeek : undefined
                    );
                    results.push({
                        inputValue: item.query,
                        matchedStudent: teamMember,
                        status: existingTeam ? "already_in_team" : "matched",
                    });
                }
            });

            response.data.not_found.forEach((inputValue: string) => {
                results.push({
                    inputValue,
                    matchedStudent: null,
                    status: "not_found",
                });
            });

            modals.teamModal.setParsedMembers(results);

            const matchedIds = results
                .filter(r => r.status === "matched" && r.matchedStudent)
                .map(r => r.matchedStudent!.id);
            modals.teamModal.setMembers(matchedIds);

        } catch (error) {
            console.error("Error parsing team members:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถค้นหานักศึกษาได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            modals.teamModal.setParsedMembers([]);
        } finally {
            modals.teamModal.setIsParsing(false);
        }
    }, [course?.sections, selectedSectionForTeam, selectedWeek, getUnassignedStudents, findStudentTeam, classroomActions, modals.teamModal]);

    // Open modals helpers
    const openAddStudentModal = useCallback((sectionId: number) => {
        modals.studentModal.setSectionId(sectionId);
        modals.studentModal.setStudentId("");
        modals.studentModal.setSearchQuery("");
        modals.studentModal.setIsOpen(true);
    }, [modals.studentModal]);

    const handleRemoveSection = useCallback((sectionId: number) => {
        const section = course?.sections?.find(s => s.id === sectionId);
        if (!section) return;
        modals.deleteModal.open("section", {
            sectionId: sectionId,
            sectionNo: section.section_no,
            sectionStudentCount: section.studentCount || 0
        });
    }, [course?.sections, modals.deleteModal]);

    const handleRemoveTA = useCallback((userId: number) => {
        if (!canRemovePeople || !course?.is_active) {
            return;
        }
        if (userId === currentUserId) {
            addToast({
                title: "ไม่สามารถลบตัวเองออกได้",
                description: "ระบบไม่อนุญาตให้ลบตัวเองออกจากรายวิชา",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        const ta = course?.tas?.find(t => t.id === userId);
        if (!ta) return;
        modals.deleteModal.open("ta", {
            taId: userId,
            taName: ta.full_name,
            taEmail: ta.email || ta.username,
            taAvatar: ta.avatar || undefined,
        });
    }, [canRemovePeople, course?.is_active, course?.tas, currentUserId, modals.deleteModal]);

    const handleRemoveInstructor = useCallback((userId: number) => {
        if (!canRemovePeople || !course?.is_active) {
            return;
        }
        if (userId === currentUserId) {
            addToast({
                title: "ไม่สามารถลบตัวเองออกได้",
                description: "ระบบไม่อนุญาตให้ลบตัวเองออกจากรายวิชา",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        const instructor = course?.instructors?.find(i => i.id === userId);
        if (!instructor) return;
        if (instructor.CourseInstructor?.is_primary) {
            addToast({
                title: "ไม่สามารถลบเจ้าของวิชา",
                description: "อาจารย์เจ้าของวิชาไม่สามารถถูกลบออกได้",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        modals.deleteModal.open("instructor" as any, {
            instructorId: userId,
            instructorName: instructor.full_name,
            instructorEmail: instructor.email || undefined,
        } as any);
    }, [canRemovePeople, course?.is_active, course?.instructors, currentUserId, modals.deleteModal]);

    const openDeleteStudentModal = useCallback((sectionId: number, student: SectionStudent) => {
        const section = course?.sections?.find(s => s.id === sectionId);
        modals.deleteModal.open("student", {
            studentId: student.id,
            studentName: student.full_name,
            studentCode: student.student_id,
            sectionId: sectionId,
            sectionNo: section?.section_no
        });
    }, [course?.sections, modals.deleteModal]);

    const openDeleteTeamModal = useCallback((teamId: number, teamType: "permanent" | "weekly", weekNumber?: number) => {
        let team: PermanentTeam | WeeklyTeam | undefined;
        if (teamType === "permanent") {
            team = permanentTeams.find(t => t.id === teamId);
        } else if (weekNumber !== undefined) {
            team = weeklyTeams[weekNumber]?.find(t => t.id === teamId);
        }
        if (team) {
            modals.deleteModal.open("team", {
                teamId: team.id,
                teamName: team.name,
                teamType: teamType,
                weekNumber: weekNumber,
                teamMembers: team.members
            });
        }
    }, [permanentTeams, weeklyTeams, modals.deleteModal]);

    const openEditTeamModal = useCallback((teamId: number, teamType: "permanent" | "weekly", weekNumber?: number) => {
        let team: PermanentTeam | WeeklyTeam | undefined;
        if (teamType === "permanent") {
            team = permanentTeams.find(t => t.id === teamId);
        } else if (weekNumber !== undefined) {
            team = weeklyTeams[weekNumber]?.find(t => t.id === teamId);
        }
        if (team) {
            modals.editTeamModal.open({
                id: team.id,
                name: team.name,
                type: teamType,
                weekNumber: weekNumber,
                members: team.members,
            });
        }
    }, [permanentTeams, weeklyTeams, modals.editTeamModal]);

    const openBulkDeleteModal = useCallback(() => {
        const teamsToDelete = weeklyTeams[selectedWeek];
        if (!teamsToDelete || teamsToDelete.length === 0) {
            addToast({
                title: "ไม่มีกลุ่มที่จะลบ",
                description: "ไม่พบกลุ่มในสัปดาห์ที่เลือก",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        modals.bulkDeleteModal.setIsOpen(true);
    }, [selectedWeek, weeklyTeams, modals.bulkDeleteModal]);

    // TA selection helpers
    const toggleTASelection = useCallback((taId: number) => {
        const current = modals.taModal.selectedIds;
        if (current.includes(taId)) {
            modals.taModal.setSelectedIds(current.filter(id => id !== taId));
        } else {
            modals.taModal.setSelectedIds([...current, taId]);
        }
    }, [modals.taModal]);

    const selectAllAvailableTAs = useCallback(() => {
        const existingTAIds = course?.tas?.map(ta => ta.id) || [];
        const availableTAIds = tasList
            .filter(ta => !existingTAIds.includes(ta.id))
            .map(ta => ta.id);
        modals.taModal.setSelectedIds(availableTAIds);
    }, [course?.tas, tasList, modals.taModal]);

    const clearTASelection = useCallback(() => {
        modals.taModal.setSelectedIds([]);
    }, [modals.taModal]);

    // Instructor selection helpers
    const selectAllInstructors = useCallback(() => {
        const existingIds = course?.instructors?.map(i => i.id) || [];
        const availableIds = instructorsList
            .filter(inst => !existingIds.includes(inst.id))
            .map(inst => inst.id);
        modals.instructorModal.setSelectedIds(availableIds);
    }, [course?.instructors, instructorsList, modals.instructorModal]);

    const clearInstructorSelection = useCallback(() => {
        modals.instructorModal.setSelectedIds([]);
    }, [modals.instructorModal]);

    // ============================================
    // Menu Items
    // ============================================

    const menuItems = useMemo(() => [
        { key: "overview", label: "ภาพรวม", icon: "solar:chart-2-bold" },
        ...(canAccessSections ? [{ key: "sections", label: "กลุ่มเรียน", icon: "solar:notebook-bold" }] : []),
        ...(canViewPeople ? [{ key: "people", label: "บุคลากร", icon: "solar:users-group-rounded-bold" }] : []),
        ...(canAccessAssignments ? [{ key: "assignments", label: "งานในชั้นเรียน", icon: "solar:clipboard-list-bold" }] : []),
        ...(canAccessScores ? [{ key: "scores", label: "คะแนนในชั้นเรียน", icon: "solar:chart-square-bold" }] : []),
        ...(canAccessExamScores ? [{ key: "exam-scores", label: "คะแนนสอบ", icon: "solar:diploma-bold" }] : []),
        ...(canAccessApproval ? [{
            key: "approval",
            label: approvalRole === "ta" ? "สถานะคำร้องคะแนน" : "อนุมัติคะแนน",
            icon: "solar:clipboard-check-bold",
        }] : []),
        ...(canAccessAttendance ? [{ key: "attendance", label: "เช็คชื่อ", icon: "solar:user-check-bold" }] : []),
        ...(canAccessQueue ? [{ key: "queue", label: "คิวตรวจงาน", icon: "solar:sort-by-time-bold" }] : []),
        ...(userRole === 'instructor' ? [{ key: "activity-log", label: "บันทึกกิจกรรม", icon: "solar:document-text-bold" }] : []),
        ...(userRole === 'instructor' ? [{ key: "ta-stats", label: "สถิติ TA", icon: "solar:graph-new-up-bold" }] : []),
        ...(userRole === 'instructor' ? [{ key: "settings", label: "ตั้งค่ารายวิชา", icon: "solar:settings-bold" }] : []),
    ], [approvalRole, canAccessApproval, canAccessAssignments, canAccessAttendance, canAccessExamScores, canAccessQueue, canAccessScores, canAccessSections, canViewPeople, userRole]);

    useEffect(() => {
        if (!menuItems.some((item) => item.key === activeTab)) {
            setActiveTab("overview");
        }
    }, [activeTab, menuItems]);

    // ============================================
    // Render
    // ============================================

    return (
        <div className="min-h-[calc(100vh-6rem)] bg-slate-100">
            {/* Mobile Header */}
            <div className="lg:hidden sticky top-0 z-50 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-4 py-3">
                <div className="flex items-center gap-3">
                    <Button
                        isIconOnly
                        variant="flat"
                        className="bg-white/20 text-white"
                        onPress={() => setIsMobileSidebarOpen(true)}
                    >
                        <Icon icon="solar:hamburger-menu-linear" className="text-xl" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        {course ? (
                            <>
                                <h1 className="text-white font-semibold truncate">{course.name}</h1>
                                <p className="text-white/70 text-xs">{course.code}</p>
                            </>
                        ) : isLoading ? (
                            <>
                                <div className="h-5 w-32 bg-white/20 rounded animate-pulse" />
                                <div className="h-3 w-20 bg-white/20 rounded animate-pulse mt-1" />
                            </>
                        ) : (
                            <>
                                <h1 className="text-white font-semibold truncate">ไม่พบรายวิชา</h1>
                                <p className="text-white/70 text-xs">Course not found</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileSidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-50"
                    onClick={() => setIsMobileSidebarOpen(false)}
                >
                    <div
                        className="w-72 h-full bg-white shadow-xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Mobile Sidebar Header */}
                        <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 p-4">
                            <div className="flex items-center justify-between mb-3">
                                {course ? (
                                    <Chip size="sm" className="bg-white/20 text-white border-0">
                                        {course.code}
                                    </Chip>
                                ) : isLoading ? (
                                    <div className="h-6 w-20 bg-white/20 rounded animate-pulse" />
                                ) : (
                                    <Chip size="sm" className="bg-red-500/30 text-white border-0">
                                        N/A
                                    </Chip>
                                )}
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    className="bg-white/20 text-white"
                                    onPress={() => setIsMobileSidebarOpen(false)}
                                >
                                    <Icon icon="solar:close-circle-linear" className="text-lg" />
                                </Button>
                            </div>
                            {course ? (
                                <>
                                    <h2 className="text-white font-bold text-lg leading-tight mb-1">{course.name}</h2>
                                    <p className="text-white/70 text-sm">{course.year}/{course.semester === 3 ? "ฤดูร้อน" : course.semester}</p>
                                    {course.instructor && (
                                        <p className="text-white/60 text-xs mt-2">{course.instructor.full_name}</p>
                                    )}
                                </>
                            ) : isLoading ? (
                                <>
                                    <div className="h-6 w-48 bg-white/20 rounded animate-pulse mb-2" />
                                    <div className="h-4 w-24 bg-white/20 rounded animate-pulse" />
                                </>
                            ) : (
                                <>
                                    <h2 className="text-white font-bold text-lg leading-tight mb-1">ไม่พบรายวิชา</h2>
                                    <p className="text-white/70 text-sm">กรุณาตรวจสอบลิงก์อีกครั้ง</p>
                                </>
                            )}
                        </div>

                        {/* Mobile Menu Items */}
                        <nav className="flex-1 overflow-y-auto p-3">
                            {!course ? (
                                <SidebarMenuSkeleton />
                            ) : (
                                menuItems.map((item) => (
                                <button
                                    key={item.key}
                                    onClick={() => {
                                        if ((item as any).status !== "coming_soon") {
                                            setActiveTab(item.key);
                                            setIsMobileSidebarOpen(false);
                                        }
                                    }}
                                    disabled={(item as any).status === "coming_soon"}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all ${activeTab === item.key
                                        ? "bg-blue-50 text-blue-600"
                                        : "text-slate-600 hover:bg-slate-50"
                                        } ${(item as any).status === "coming_soon" ? "cursor-not-allowed opacity-50 bg-slate-50" : "cursor-pointer"}`}
                                >
                                    <Icon icon={item.icon} className="text-xl" />
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            ))
                            )}
                        </nav>
                    </div>
                </div>
            )}

            <div className="flex">
                {/* Desktop Sidebar - Fixed position */}
                <aside className="hidden lg:flex flex-col w-64 h-[calc(100vh)] bg-white border-r border-slate-200 fixed top-12 left-0 overflow-y-auto z-40">
                    {/* Navigation Menu */}
                    <nav className="flex-1 p-3">
                        {!course ? (
                            <SidebarMenuSkeleton />
                        ) : (
                            menuItems.map((item) => (
                            <button
                                key={item.key}
                                disabled={(item as any).status === "coming_soon"}
                                onClick={() => {
                                    if ((item as any).status !== "coming_soon") {
                                        setActiveTab(item.key);
                                    }
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all ${activeTab === item.key
                                    ? "bg-blue-50 text-blue-600 font-medium"
                                    : "text-slate-600 hover:bg-slate-50"
                                    } ${(item as any).status === "coming_soon" ? "cursor-not-allowed opacity-50 bg-slate-50" : "cursor-pointer"}`}
                            >
                                <Icon icon={item.icon} className={`text-lg ${activeTab === item.key ? "text-blue-500" : "text-slate-400"}`} />
                                <span className="text-sm">{item.label}</span>
                            </button>
                        ))
                        )}
                    </nav>
                </aside>

                {/* Main Content Area - Add left margin for fixed sidebar */}
                <main className="flex-1 lg:ml-64 overflow-x-hidden">
                    <div className="p-4 lg:p-6">
                        {/* Error State - Course Not Found */}
                        {!isLoading && !course && (
                            <div className="flex items-center justify-center min-h-[60vh]">
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Icon icon="solar:danger-triangle-bold" className="text-4xl text-red-500" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-slate-700 mb-2">ไม่พบข้อมูลรายวิชา</h2>
                                    <p className="text-slate-500 mb-6">รายวิชานี้อาจถูกลบไปแล้ว หรือคุณไม่มีสิทธิ์เข้าถึง</p>
                                    <div className="flex gap-3 justify-center">
                                        <Button
                                            color="primary"
                                            variant="flat"
                                            onPress={() => window.history.back()}
                                            startContent={<Icon icon="solar:arrow-left-linear" />}
                                        >
                                            กลับหน้าก่อน
                                        </Button>
                                        <Button
                                            color="primary"
                                            onPress={() => window.location.href = '/home'}
                                            startContent={<Icon icon="solar:home-2-linear" />}
                                        >
                                            หน้าหลัก
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Loading State - Show while course data is fetching */}
                        {isLoading && !course && (
                            <OverviewSkeleton />
                        )}

                        {/* Content - Only show when course is loaded */}
                        {course && (
                            <>
                                {/* Closed course banner */}
                                {!course.is_active && (
                                    <div className="mb-4 rounded-xl border border-warning-200 bg-warning-50 dark:border-warning-700 dark:bg-warning-900/30 p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-shrink-0">
                                                <Icon icon="solar:lock-keyhole-bold" className="text-warning-600 dark:text-warning-400" width={24} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold text-warning-800 dark:text-warning-300">
                                                    รายวิชานี้ปิดใช้งานอยู่
                                                </p>
                                                <p className="text-sm text-warning-600 dark:text-warning-400">
                                                    สามารถดูข้อมูลได้อย่างเดียว ต้องเปิดใช้งานรายวิชาก่อนถึงจะแก้ไขได้
                                                </p>
                                            </div>
                                            {userRole === "instructor" && (
                                                <Button
                                                    size="sm"
                                                    color="warning"
                                                    variant="flat"
                                                    onPress={() => setActiveTab("settings")}
                                                    startContent={<Icon icon="solar:settings-linear" width={16} />}
                                                >
                                                    ไปที่ตั้งค่า
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === "overview" && (
                                    <OverviewTab
                                        course={course}
                                        overview={overview}
                                        isLoading={isOverviewLoading}
                                        userRole={userRole}
                                        assignments={assignments}
                                        onNavigateToAssignments={() => setActiveTab("assignments")}
                                        onNavigateToAttendance={() => setActiveTab("attendance")}
                                        onNavigateToQueue={() => setActiveTab("queue")}
                                        onNavigateToScores={() => setActiveTab("scores")}
                                        onNavigateToApproval={() => setActiveTab("approval")}
                                        onNavigateToPeople={() => setActiveTab("people")}
                                    />
                                )}

                                {activeTab === "sections" && canAccessSections && (
                                    <SectionsTab
                                        courseId={courseId}
                                        isCourseActive={course.is_active}
                                        canCreateSections={currentCoursePermissions.create_sections}
                                        canUpdateSections={currentCoursePermissions.update_sections}
                                        canDeleteSections={currentCoursePermissions.delete_sections}
                                        canManageSectionStudents={currentCoursePermissions.manage_section_students}
                                        canCreateTeams={currentCoursePermissions.create_teams}
                                        canUpdateTeams={currentCoursePermissions.update_teams}
                                        canDeleteTeams={currentCoursePermissions.delete_teams}
                                    />
                                )}

                                {activeTab === "people" && canViewPeople && (
                                    <PeopleTab
                                        course={course}
                                        isLoading={isPeopleLoading}
                                        isPeopleLoading={isPeopleLoading}
                                        onOpenAddTAModal={() => modals.taModal.setIsOpen(true)}
                                        onOpenAddInstructorModal={() => modals.instructorModal.setIsOpen(true)}
                                        onRemoveTA={handleRemoveTA}
                                        onRemoveInstructor={handleRemoveInstructor}
                                        onUpdatePermissions={classroomActions.updateMemberPermissions}
                                        userRole={userRole}
                                        currentUserId={currentUserId}
                                        canViewPeople={canViewPeople}
                                        canAddPeople={canAddPeople}
                                        canRemovePeople={canRemovePeople}
                                        canEditMemberPermissions={canEditMemberPermissions}
                                        isCourseActive={course.is_active}
                                    />
                                )}

                                {activeTab === "assignments" && canAccessAssignments && (
                                    <AssignmentsTab
                                        assignments={assignments}
                                        setAssignments={setAssignments}
                                        isLoading={isAssignmentsLoading}
                                        courseId={courseId}
                                        weeklyTeams={weeklyTeams}
                                        onOpenScoreModal={(assignment) => {
                                            setScoreModalAssignment(assignment);
                                            modals.scoreModals.setIsScoreModalOpen(true);
                                        }}
                                        onOpenBonusScoreModal={() => modals.scoreModals.setIsBonusScoreModalOpen(true)}
                                        onAssignmentChanged={() => {
                                            fetchAssignments(true, true);
                                            fetchOverview(true);
                                        }}
                                        hasPendingUpdate={pendingAssignmentUpdate}
                                        onPendingUpdateAck={ackAssignmentUpdate}
                                        isCourseActive={course.is_active}
                                        canCreateAssignments={currentCoursePermissions.create_assignments}
                                        canUpdateAssignments={currentCoursePermissions.update_assignments}
                                        canDeleteAssignments={currentCoursePermissions.delete_assignments}
                                        canGradeAssignments={currentCoursePermissions.grade_assignments}
                                        canEditScores={currentCoursePermissions.edit_scores}
                                    />
                                )}

                                {activeTab === "scores" && canAccessScores && (
                                    <ScoresTab courseId={courseId} isCourseActive={course.is_active} />
                                )}

                                {activeTab === "exam-scores" && canAccessExamScores && (
                                    <ExamScoresTab
                                        courseId={courseId}
                                        isCourseActive={course.is_active}
                                        canCreateExamScores={currentCoursePermissions.create_exam_scores}
                                        canUpdateExamScores={currentCoursePermissions.update_exam_scores}
                                        canUpdateExamSettings={currentCoursePermissions.update_exam_settings}
                                    />
                                )}

                                {activeTab === "approval" && canAccessApproval && (
                                    <ScoreApprovalTab
                                        courseId={courseId}
                                        userRole={approvalRole}
                                        onPendingCountChange={setPendingApprovalCount}
                                        isCourseActive={course.is_active}
                                    />
                                )}

                                {activeTab === "attendance" && canAccessAttendance && (
                                    <AttendanceTab
                                        course={course}
                                        isLoading={isOverviewLoading}
                                        onAttendanceChanged={() => fetchOverview(true)}
                                        isCourseActive={course.is_active}
                                        canCreateAttendanceSessions={currentCoursePermissions.create_attendance_sessions}
                                        canUpdateAttendanceSessions={currentCoursePermissions.update_attendance_sessions}
                                        canDeleteAttendanceSessions={currentCoursePermissions.delete_attendance_sessions}
                                    />
                                )}

                                {activeTab === "settings" && userRole === "instructor" && (
                                    <SettingsTab
                                        courseId={String(course.id)}
                                        course={course}
                                        onCourseUpdate={(updatedCourse) => setCourse(updatedCourse)}
                                    />
                                )}

                                {activeTab === "queue" && canAccessQueue && (
                                    <QueueTab
                                        course={course}
                                        isLoading={isOverviewLoading}
                                        isCourseActive={course.is_active}
                                        canCreateQueueSessions={currentCoursePermissions.create_queue_sessions}
                                        canUpdateQueueSessions={currentCoursePermissions.update_queue_sessions}
                                        canDeleteQueueSessions={currentCoursePermissions.delete_queue_sessions}
                                        canManageQueueBookings={currentCoursePermissions.manage_queue_bookings}
                                    />
                                )}

                                {activeTab === "activity-log" && userRole === "instructor" && (
                                    <ActivityLogTab courseId={courseId} />
                                )}

                                {activeTab === "ta-stats" && userRole === "instructor" && (
                                    <TAStatsTab courseId={courseId} />
                                )}
                            </>
                        )}
                    </div>
                </main>
            </div>

            {/* Score Modal */}
            <ScoreModal
                isOpen={modals.scoreModals.isScoreModalOpen}
                onClose={() => {
                    modals.scoreModals.setIsScoreModalOpen(false);
                    setScoreModalAssignment(null);
                }}
                assignment={scoreModalAssignment}
                courseId={courseId}
                canGradeAssignments={currentCoursePermissions.grade_assignments}
                canEditScores={currentCoursePermissions.edit_scores}
                onScoreSubmitted={() => {
                    fetchOverview(true);
                    if (scores.selectedAssignment) {
                        scores.fetchScores(scores.selectedAssignment);
                    }
                }}
            />

            {/* Bonus Score Modal */}
            <BonusScoreModal
                isOpen={modals.scoreModals.isBonusScoreModalOpen}
                onClose={() => modals.scoreModals.setIsBonusScoreModalOpen(false)}
                courseId={courseId}
            />

            {/* Add Section Modal */}
            <Modal isOpen={modals.sectionModal.isOpen} onClose={modals.sectionModal.reset} size="md">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-xl shadow-lg">
                                <Icon icon="solar:users-group-rounded-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">เพิ่มกลุ่มเรียน</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">สร้างกลุ่มเรียนใหม่สำหรับรายวิชานี้</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-4">
                            <Input
                                label="หมายเลขกลุ่มเรียน"
                                labelPlacement="outside"
                                placeholder="เช่น 1, 2, 101, A"
                                variant="bordered"
                                size="lg"
                                value={modals.sectionModal.sectionNo}
                                onValueChange={modals.sectionModal.setSectionNo}
                                isRequired
                                classNames={{
                                    inputWrapper: "h-11 sm:h-12 border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            />
                            <Input
                                label="หมายเหตุ (ถ้ามี)"
                                labelPlacement="outside"
                                placeholder="เช่น เรียนวันจันทร์, กลุ่มพิเศษ"
                                variant="bordered"
                                size="lg"
                                value={modals.sectionModal.note}
                                onValueChange={modals.sectionModal.setNote}
                                className="pt-2"
                                classNames={{
                                    inputWrapper: "h-11 sm:h-12 border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-slate-100">
                        <Button variant="light" onPress={modals.sectionModal.reset}>
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleAddSection}
                            isLoading={modals.isSubmitting}
                            isDisabled={!modals.sectionModal.sectionNo.trim()}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500"
                            startContent={!modals.isSubmitting && <Icon icon="solar:add-circle-bold" />}
                        >
                            เพิ่มกลุ่มเรียน
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Add TA Modal */}
            <Modal
                isOpen={modals.taModal.isOpen}
                onClose={modals.taModal.reset}
                size="2xl"
                scrollBehavior="outside"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-2">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-xl shadow-lg">
                                <Icon icon="solar:user-hands-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">เพิ่มผู้ช่วยสอน</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">เลือกผู้ช่วยสอนที่ต้องการเพิ่ม (เลือกได้หลายคน)</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        {/* Stats */}
                        <div className="mb-1 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Icon icon="solar:users-group-rounded-bold" className="text-blue-500" />
                                <span>ผู้ช่วยสอนในระบบ <span className="font-semibold text-blue-600">{tasList.length}</span> คน</span>
                                {course?.tas && course.tas.length > 0 && (
                                    <span className="text-slate-400">
                                        (อยู่ในวิชานี้แล้ว <span className="font-semibold text-emerald-600">{course.tas.length}</span> คน)
                                    </span>
                                )}
                            </div>
                            {modals.taModal.selectedIds.length > 0 && (
                                <Chip size="sm" color="primary" variant="flat">
                                    เลือกแล้ว {modals.taModal.selectedIds.length} คน
                                </Chip>
                            )}
                        </div>

                        {/* Search */}
                        <Input
                            placeholder="ค้นหาด้วยชื่อหรืออีเมล..."
                            variant="bordered"
                            size="lg"
                            value={modals.taModal.searchQuery}
                            onValueChange={modals.taModal.setSearchQuery}
                            startContent={<Icon icon="solar:magnifer-linear" className="text-slate-400" />}
                            endContent={
                                modals.taModal.searchQuery && (
                                    <Button
                                        isIconOnly
                                        size="md"
                                        variant="light"
                                        onPress={() => modals.taModal.setSearchQuery("")}
                                    >
                                        <Icon icon="solar:close-circle-bold" className="text-slate-400" />
                                    </Button>
                                )
                            }
                            classNames={{
                                inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                            }}
                        />

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2 mt-1">
                            <Button
                                size="sm"
                                variant="flat"
                                color="primary"
                                onPress={selectAllAvailableTAs}
                                startContent={<Icon icon="solar:checklist-bold" />}
                            >
                                เลือกทั้งหมด
                            </Button>
                            {modals.taModal.selectedIds.length > 0 && (
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="danger"
                                    onPress={clearTASelection}
                                    startContent={<Icon icon="solar:close-circle-bold" />}
                                >
                                    ล้างการเลือก
                                </Button>
                            )}
                        </div>

                        {/* TA List */}
                        <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden">
                            <div className="h-[300px] overflow-y-auto">
                                {(() => {
                                    const existingTAIds = course?.tas?.map(ta => ta.id) || [];
                                    const filteredTAs = tasList.filter(ta => {
                                        // ไม่แสดง TA ที่อยู่ในวิชาแล้ว
                                        if (existingTAIds.includes(ta.id)) return false;

                                        const searchLower = modals.taModal.searchQuery.toLowerCase();
                                        const matchesSearch = !modals.taModal.searchQuery ||
                                            ta.full_name.toLowerCase().includes(searchLower) ||
                                            (ta.email && ta.email.toLowerCase().includes(searchLower)) ||
                                            (ta.username && ta.username.toLowerCase().includes(searchLower));
                                        return matchesSearch;
                                    });

                                    if (filteredTAs.length === 0) {
                                        return (
                                            <div className="p-8 text-center text-slate-500">
                                                <Icon icon="solar:user-cross-linear" className="text-4xl mb-2" />
                                                <p>{modals.taModal.searchQuery ? "ไม่พบผู้ช่วยสอนที่ค้นหา" : "ผู้ช่วยสอนทั้งหมดอยู่ในวิชานี้แล้ว"}</p>
                                            </div>
                                        );
                                    }

                                    return filteredTAs.map((ta) => {
                                        const isSelected = modals.taModal.selectedIds.includes(ta.id);

                                        return (
                                            <div
                                                key={ta.id}
                                                onClick={() => toggleTASelection(ta.id)}
                                                className={`flex items-center gap-3 p-3 border-b border-slate-100 last:border-0 transition-all ${isSelected
                                                    ? "bg-blue-50 cursor-pointer"
                                                    : "hover:bg-slate-50 cursor-pointer"
                                                    }`}
                                            >
                                                {/* Checkbox */}
                                                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 `}>
                                                    {isSelected && (
                                                        <Icon icon="solar:check-circle-bold" className="text-lg text-blue-500" />
                                                    )}
                                                </div>

                                                <Avatar
                                                    name={ta.full_name}
                                                    src={ta.avatar || undefined}
                                                    size="sm"
                                                    className={`flex-shrink-0 bg-gradient-to-br from-blue-400 to-indigo-500`}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate text-slate-800">
                                                        {ta.full_name}
                                                    </p>
                                                    <p className="text-xs truncate text-slate-500">
                                                        {ta.email || ta.username}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        {/* Selected TAs Preview */}
                        {modals.taModal.selectedIds.length > 0 && (
                            <div className="mt-2">
                                <p className="text-sm font-medium text-slate-600 mb-2">ผู้ช่วยสอนที่เลือก ({modals.taModal.selectedIds.length} คน)</p>
                                <div className="flex flex-wrap gap-2">
                                    {modals.taModal.selectedIds.map(taId => {
                                        const ta = tasList.find(t => t.id === taId);
                                        if (!ta) return null;
                                        return (
                                            <Chip
                                                key={taId}
                                                variant="flat"
                                                color="primary"
                                                onClose={() => toggleTASelection(taId)}

                                            >
                                                {ta.full_name}
                                            </Chip>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button
                            variant="light"
                            onPress={modals.taModal.reset}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleAddTA}
                            isLoading={modals.isSubmitting}
                            isDisabled={modals.taModal.selectedIds.length === 0}
                            startContent={!modals.isSubmitting && <Icon icon="solar:add-circle-bold" />}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                        >
                            เพิ่มผู้ช่วยสอน {modals.taModal.selectedIds.length > 0 ? `(${modals.taModal.selectedIds.length} คน)` : ""}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Add Instructor Modal */}
            <Modal
                isOpen={modals.instructorModal.isOpen}
                onClose={modals.instructorModal.reset}
                size="2xl"
                scrollBehavior="outside"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-2">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-xl shadow-lg">
                                <Icon icon="solar:user-hands-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">เพิ่มอาจารย์ผู้สอน</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">เลือกอาจารย์ที่ต้องการเพิ่ม (เลือกได้หลายคน)</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        {/* Stats */}
                        <div className="mb-1 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Icon icon="solar:users-group-rounded-bold" className="text-indigo-500" />
                                <span>อาจารย์ในระบบ <span className="font-semibold text-indigo-600">{instructorsList.length}</span> คน</span>
                            </div>
                            {modals.instructorModal.selectedIds.length > 0 && (
                                <Chip size="sm" color="secondary" variant="flat">
                                    เลือกแล้ว {modals.instructorModal.selectedIds.length} คน
                                </Chip>
                            )}
                        </div>

                        {/* Search */}
                        <Input
                            placeholder="ค้นหาด้วยชื่อหรืออีเมล..."
                            variant="bordered"
                            size="md"
                            value={modals.instructorModal.searchQuery}
                            onValueChange={modals.instructorModal.setSearchQuery}
                            startContent={<Icon icon="solar:magnifer-linear" className="text-slate-400" />}
                            endContent={
                                modals.instructorModal.searchQuery && (
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        onPress={() => modals.instructorModal.setSearchQuery("")}
                                    >
                                        <Icon icon="solar:close-circle-bold" className="text-slate-400" />
                                    </Button>
                                )
                            }
                            classNames={{
                                inputWrapper: "bg-white border-slate-200 hover:border-indigo-300 focus-within:!border-indigo-400",
                            }}
                        />

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2 mt-2">
                            <Button
                                size="sm"
                                variant="flat"
                                color="secondary"
                                onPress={selectAllInstructors}
                                startContent={<Icon icon="solar:checklist-bold" />}
                            >
                                เลือกทั้งหมด
                            </Button>
                            {modals.instructorModal.selectedIds.length > 0 && (
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="danger"
                                    onPress={clearInstructorSelection}
                                    startContent={<Icon icon="solar:close-circle-bold" />}
                                >
                                    ล้างการเลือก
                                </Button>
                            )}
                        </div>

                        {/* Instructor List */}
                        <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
                            <div className="h-[300px] overflow-y-auto">
                                {filteredInstructors.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">
                                        <Icon icon="solar:user-cross-linear" className="text-4xl mb-2" />
                                        <p>{modals.instructorModal.searchQuery ? "ไม่พบอาจารย์ที่ค้นหา" : "อาจารย์ทั้งหมดอยู่ในวิชานี้แล้ว"}</p>
                                    </div>
                                ) : (
                                    filteredInstructors.map((instructor) => {
                                        const isSelected = modals.instructorModal.selectedIds.includes(instructor.id);

                                        return (
                                            <div
                                                key={instructor.id}
                                                onClick={() => {
                                                    const current = modals.instructorModal.selectedIds;
                                                    if (current.includes(instructor.id)) {
                                                        modals.instructorModal.setSelectedIds(current.filter(id => id !== instructor.id));
                                                    } else {
                                                        modals.instructorModal.setSelectedIds([...current, instructor.id]);
                                                    }
                                                }}
                                                className={`flex items-center gap-3 p-3 border-b border-slate-100 last:border-0 transition-all ${isSelected
                                                    ? "bg-indigo-50 cursor-pointer"
                                                    : "hover:bg-slate-50 cursor-pointer"
                                                    }`}
                                            >
                                                {/* Checkbox */}
                                                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0`}>
                                                    {isSelected && (
                                                        <Icon icon="solar:check-circle-bold" className="text-lg text-indigo-500" />
                                                    )}
                                                </div>

                                                <Avatar
                                                    name={instructor.full_name}
                                                    src={instructor.avatar || undefined}
                                                    size="sm"
                                                    className={`flex-shrink-0 bg-gradient-to-br from-indigo-400 to-purple-500`}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate text-slate-800">
                                                        {instructor.full_name}
                                                    </p>
                                                    <p className="text-xs truncate text-slate-500">
                                                        {instructor.email}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Selected Instructors Preview */}
                        {modals.instructorModal.selectedIds.length > 0 && (
                            <div className="mt-2">
                                <p className="text-sm font-medium text-slate-600 mb-2">อาจารย์ที่เลือก ({modals.instructorModal.selectedIds.length} คน)</p>
                                <div className="flex flex-wrap gap-2">
                                    {modals.instructorModal.selectedIds.map(instructorId => {
                                        const instructor = instructorsList.find(i => i.id === instructorId);
                                        if (!instructor) return null;
                                        return (
                                            <Chip
                                                key={instructorId}
                                                variant="flat"
                                                color="secondary"
                                                onClose={() => {
                                                    modals.instructorModal.setSelectedIds(
                                                        modals.instructorModal.selectedIds.filter(id => id !== instructorId)
                                                    );
                                                }}
                                            >
                                                {instructor.full_name}
                                            </Chip>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button
                            variant="light"
                            onPress={modals.instructorModal.reset}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="secondary"
                            onPress={handleAddInstructors}
                            isLoading={modals.isSubmitting}
                            isDisabled={modals.instructorModal.selectedIds.length === 0}
                            startContent={!modals.isSubmitting && <Icon icon="solar:add-circle-bold" />}
                            className="bg-gradient-to-r from-indigo-400 to-purple-500 shadow-lg shadow-indigo-400/25"
                        >
                            เพิ่มอาจารย์ {modals.instructorModal.selectedIds.length > 0 ? `(${modals.instructorModal.selectedIds.length} คน)` : ""}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Add Student Modal */}
            <Modal
                isOpen={modals.studentModal.isOpen}
                onClose={modals.studentModal.reset}
                size="2xl"
                scrollBehavior="inside"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl shadow-lg">
                                <Icon icon="solar:user-plus-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">เพิ่มนักศึกษา</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">
                                    กลุ่มเรียน {course?.sections?.find(s => s.id === modals.studentModal.sectionId)?.section_no}
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-4">
                            {/* Mode Tabs */}
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant={modals.studentModal.mode === "select" ? "solid" : "flat"}
                                    color={modals.studentModal.mode === "select" ? "primary" : "default"}
                                    onPress={() => modals.studentModal.setMode("select")}
                                    className={modals.studentModal.mode === "select" ? "bg-gradient-to-r from-cyan-400 to-blue-500" : ""}
                                    startContent={<Icon icon="solar:user-check-bold" />}
                                >
                                    เลือกจากรายชื่อ
                                </Button>
                                <Button
                                    size="sm"
                                    variant={modals.studentModal.mode === "paste" ? "solid" : "flat"}
                                    color={modals.studentModal.mode === "paste" ? "primary" : "default"}
                                    onPress={() => modals.studentModal.setMode("paste")}
                                    className={modals.studentModal.mode === "paste" ? "bg-gradient-to-r from-emerald-400 to-teal-500" : ""}
                                    startContent={<Icon icon="solar:clipboard-text-bold" />}
                                >
                                    วางจาก Excel
                                </Button>
                            </div>

                            {modals.studentModal.mode === "select" ? (
                                <>
                                    <Input
                                        placeholder="ค้นหานักศึกษา..."
                                        variant="bordered"
                                        size="lg"
                                        value={modals.studentModal.searchQuery}
                                        onValueChange={modals.studentModal.setSearchQuery}
                                        startContent={<Icon icon="solar:magnifer-linear" className="text-slate-400" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-white border-slate-200 hover:border-cyan-300 focus-within:!border-cyan-400",
                                        }}
                                    />
                                    <Select
                                        label="เลือกนักศึกษา"
                                        labelPlacement="outside"
                                        placeholder="เลือกนักศึกษาที่ต้องการเพิ่ม"
                                        variant="bordered"
                                        size="lg"
                                        selectedKeys={modals.studentModal.studentId ? [modals.studentModal.studentId] : []}
                                        onSelectionChange={(keys) => {
                                            const selected = Array.from(keys)[0] as string;
                                            modals.studentModal.setStudentId(selected || "");
                                        }}
                                        classNames={{
                                            trigger: "h-12 bg-white border-slate-200 hover:border-cyan-300 data-[open=true]:border-cyan-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    >
                                        {filteredStudents().map(student => (
                                            <SelectItem key={String(student.id)} textValue={`${student.student_id} - ${student.full_name}`}>
                                                <div className="flex items-center gap-3">
                                                    <Avatar size="sm" name={student.full_name} className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white" />
                                                    <div>
                                                        <p className="font-medium text-slate-800">{student.student_id}</p>
                                                        <p className="text-xs text-slate-500">{student.full_name}</p>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </Select>
                                </>
                            ) : (
                                <>
                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                        <p className="text-sm text-slate-600">
                                            <Icon icon="solar:info-circle-bold" className="text-cyan-500 inline mr-1" />
                                            วางรหัสนักศึกษา หรือชื่อ-นามสกุล หนึ่งรายการต่อบรรทัด
                                        </p>
                                    </div>
                                    <Input
                                        label="วางรายชื่อจาก Excel"
                                        labelPlacement="outside"
                                        placeholder="วางรหัสนักศึกษา (แต่ละบรรทัด)"
                                        variant="bordered"
                                        size="lg"
                                        value={modals.studentModal.excelData}
                                        onValueChange={(value) => {
                                            modals.studentModal.setExcelData(value);
                                            parseExcelData(value);
                                        }}
                                        startContent={<Icon icon="solar:document-text-linear" className="text-slate-400" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-white border-slate-200 hover:border-emerald-300 focus-within:!border-emerald-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                    {modals.studentModal.parsedStudents.length > 0 && (
                                        <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-3">
                                            {modals.studentModal.parsedStudents.map((item, index) => (
                                                <div
                                                    key={index}
                                                    className={`p-3 rounded-lg border transition-all ${item.status === "matched" ? "border-emerald-200 bg-emerald-50" :
                                                        item.status === "already_enrolled" ? "border-amber-200 bg-amber-50" :
                                                            "border-red-200 bg-red-50"
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Icon
                                                                icon={
                                                                    item.status === "matched" ? "solar:check-circle-bold" :
                                                                        item.status === "already_enrolled" ? "solar:info-circle-bold" :
                                                                            "solar:close-circle-bold"
                                                                }
                                                                className={`text-lg ${item.status === "matched" ? "text-emerald-500" :
                                                                    item.status === "already_enrolled" ? "text-amber-500" :
                                                                        "text-red-500"
                                                                    }`}
                                                            />
                                                            <span className="text-sm font-medium">{item.inputValue}</span>
                                                        </div>
                                                        {item.status === "matched" && item.matchedStudent && (
                                                            <span className="text-xs text-emerald-600 font-medium">
                                                                → {item.matchedStudent.student_id} {item.matchedStudent.full_name}
                                                            </span>
                                                        )}
                                                        {item.status === "already_enrolled" && (
                                                            <span className="text-xs text-amber-600 font-medium">ลงทะเบียนแล้ว</span>
                                                        )}
                                                        {item.status === "not_found" && (
                                                            <span className="text-xs text-red-600 font-medium">ไม่พบ</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                                                <Chip size="sm" color="success" variant="flat">
                                                    <Icon icon="solar:check-circle-bold" className="mr-1" />
                                                    พบ {modals.studentModal.parsedStudents.filter(p => p.status === "matched").length}
                                                </Chip>
                                                <Chip size="sm" color="warning" variant="flat">
                                                    <Icon icon="solar:info-circle-bold" className="mr-1" />
                                                    ซ้ำ {modals.studentModal.parsedStudents.filter(p => p.status === "already_enrolled").length}
                                                </Chip>
                                                <Chip size="sm" color="danger" variant="flat">
                                                    <Icon icon="solar:close-circle-bold" className="mr-1" />
                                                    ไม่พบ {modals.studentModal.parsedStudents.filter(p => p.status === "not_found").length}
                                                </Chip>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button
                            variant="light"
                            onPress={modals.studentModal.reset}
                        >
                            ยกเลิก
                        </Button>
                        {modals.studentModal.mode === "select" ? (
                            <Button
                                color="primary"
                                onPress={handleAddStudent}
                                isLoading={modals.isSubmitting}
                                isDisabled={!modals.studentModal.studentId}
                                startContent={!modals.isSubmitting && <Icon icon="solar:add-circle-bold" />}
                                className="bg-gradient-to-r from-cyan-400 to-blue-500 shadow-lg shadow-cyan-400/25"
                            >
                                เพิ่มนักศึกษา
                            </Button>
                        ) : (
                            <Button
                                color="success"
                                onPress={handleBulkAddStudents}
                                isLoading={modals.isSubmitting}
                                isDisabled={modals.studentModal.parsedStudents.filter(p => p.status === "matched").length === 0}
                                startContent={!modals.isSubmitting && <Icon icon="solar:users-group-rounded-bold" />}
                                className="bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-400/25"
                            >
                                เพิ่ม {modals.studentModal.parsedStudents.filter(p => p.status === "matched").length} คน
                            </Button>
                        )}
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={modals.deleteModal.isOpen}
                onClose={modals.deleteModal.reset}
                size="lg"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg">
                                <Icon icon="solar:danger-triangle-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    {modals.deleteModal.type === "student" && "นำนักศึกษาออก"}
                                    {modals.deleteModal.type === "section" && "ลบกลุ่มเรียน"}
                                    {modals.deleteModal.type === "team" && "ลบกลุ่ม"}
                                    {modals.deleteModal.type === "ta" && "นำผู้ช่วยสอนออก"}
                                    {modals.deleteModal.type === "instructor" && "นำอาจารย์ออก"}
                                </h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">
                                    กรุณาตรวจสอบข้อมูลก่อนดำเนินการ
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        {modals.deleteModal.target && (
                            <div className="space-y-4">
                                {/* Info Card */}
                                <Card className="border border-red-100 bg-red-50/50">
                                    <CardBody className="py-4 px-4">
                                        <div className="flex items-center gap-4">
                                            {/* Student Delete */}
                                            {modals.deleteModal.type === "student" && (
                                                <>
                                                    <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                                                        <Icon icon="solar:user-bold" className="text-2xl text-white" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-lg text-slate-800">{modals.deleteModal.target.studentName}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700">
                                                                {modals.deleteModal.target.studentCode}
                                                            </Chip>
                                                            <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-600">
                                                                Section {modals.deleteModal.target.sectionNo}
                                                            </Chip>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                            {/* Section Delete */}
                                            {modals.deleteModal.type === "section" && (
                                                <>
                                                    <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                                                        <Icon icon="solar:notebook-bold" className="text-2xl text-white" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-lg text-slate-800">กลุ่มเรียน {modals.deleteModal.target.sectionNo}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700">
                                                                <Icon icon="solar:users-group-rounded-linear" className="mr-1" />
                                                                {modals.deleteModal.target.sectionStudentCount || 0} นักศึกษา
                                                            </Chip>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                            {/* Team Delete */}
                                            {modals.deleteModal.type === "team" && (
                                                <>
                                                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${modals.deleteModal.target.teamType === "permanent"
                                                        ? "bg-gradient-to-br from-purple-500 to-indigo-600"
                                                        : "bg-gradient-to-br from-emerald-500 to-teal-600"
                                                        }`}>
                                                        <Icon icon="solar:users-group-two-rounded-bold" className="text-2xl text-white" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-lg text-slate-800">{modals.deleteModal.target.teamName}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Chip size="sm" variant="flat" className={
                                                                modals.deleteModal.target.teamType === "permanent"
                                                                    ? "bg-purple-100 text-purple-700"
                                                                    : "bg-emerald-100 text-emerald-700"
                                                            }>
                                                                {modals.deleteModal.target.teamType === "permanent" ? "กลุ่มโปรเจกต์" : "กลุ่มสัปดาห์"}
                                                            </Chip>
                                                            {modals.deleteModal.target.weekNumber && (
                                                                <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
                                                                    W{modals.deleteModal.target.weekNumber}
                                                                </Chip>
                                                            )}
                                                        </div>
                                                        {modals.deleteModal.target.teamMembers && modals.deleteModal.target.teamMembers.length > 0 && (
                                                            <div className="flex items-center gap-1 mt-2 text-sm text-slate-500">
                                                                <Icon icon="solar:users-group-rounded-linear" className="text-slate-400" />
                                                                {modals.deleteModal.target.teamMembers.length} สมาชิก
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                            {/* TA Delete */}
                                            {modals.deleteModal.type === "ta" && (
                                                <>
                                                    <Avatar
                                                        src={modals.deleteModal.target.taAvatar}
                                                        name={modals.deleteModal.target.taName}
                                                        className="w-14 h-14 text-xl"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-lg text-slate-800">{modals.deleteModal.target.taName}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700">
                                                                ผู้ช่วยสอน
                                                            </Chip>
                                                        </div>
                                                        <p className="text-sm text-slate-500 mt-1">{modals.deleteModal.target.taEmail}</p>
                                                    </div>
                                                </>
                                            )}
                                            {/* Instructor Delete */}
                                            {modals.deleteModal.type === "instructor" && (
                                                <>
                                                    <Avatar
                                                        src={(modals.deleteModal.target as any).instructorAvatar}
                                                        name={(modals.deleteModal.target as any).instructorName}
                                                        className="w-14 h-14 text-xl"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-lg text-slate-800">{(modals.deleteModal.target as any).instructorName}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Chip size="sm" variant="flat" className="bg-indigo-100 text-indigo-700">
                                                                อาจารย์
                                                            </Chip>
                                                        </div>
                                                        <p className="text-sm text-slate-500 mt-1">{(modals.deleteModal.target as any).instructorEmail}</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </CardBody>
                                </Card>

                                {/* Additional Info Card */}
                                {modals.deleteModal.type === "section" && (modals.deleteModal.target.sectionStudentCount || 0) > 0 && (
                                    <Card className="border border-amber-200 bg-amber-50">
                                        <CardBody className="py-3 px-4">
                                            <div className="flex items-start gap-3">
                                                <Icon icon="solar:users-group-rounded-bold" className="text-xl text-amber-600 mt-0.5" />
                                                <div>
                                                    <p className="font-medium text-amber-800">เกี่ยวกับนักศึกษา</p>
                                                    <p className="text-sm text-amber-700 mt-1">
                                                        นักศึกษาทั้งหมด {modals.deleteModal.target.sectionStudentCount} คนในกลุ่มเรียนนี้จะถูกนำออกด้วย
                                                    </p>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                )}

                                {modals.deleteModal.type === "team" && modals.deleteModal.target.teamMembers && modals.deleteModal.target.teamMembers.length > 0 && (
                                    <Card className="border border-amber-200 bg-amber-50">
                                        <CardBody className="py-3 px-4">
                                            <div className="flex items-start gap-3">
                                                <Icon icon="solar:users-group-rounded-bold" className="text-xl text-amber-600 mt-0.5" />
                                                <div className="flex-1">
                                                    <p className="font-medium text-amber-800">สมาชิกในกลุ่ม ({modals.deleteModal.target.teamMembers.length} คน)</p>
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {modals.deleteModal.target.teamMembers.slice(0, 5).map(m => (
                                                            <Chip key={m.id} size="sm" variant="flat" className="bg-amber-100 text-amber-700">
                                                                {m.full_name}
                                                            </Chip>
                                                        ))}
                                                        {modals.deleteModal.target.teamMembers.length > 5 && (
                                                            <Chip size="sm" variant="flat" className="bg-amber-200 text-amber-800">
                                                                +{modals.deleteModal.target.teamMembers.length - 5} คน
                                                            </Chip>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                )}

                                {/* Warning */}
                                <div className="p-4 bg-red-100 rounded-xl border border-red-200">
                                    <div className="flex items-center gap-3">
                                        <Icon icon="solar:shield-warning-bold" className="text-2xl text-red-600" />
                                        <div>
                                            <p className="font-semibold text-red-800">
                                                {modals.deleteModal.type === "student" && "คุณต้องการนำนักศึกษานี้ออกใช่หรือไม่?"}
                                                {modals.deleteModal.type === "section" && "คุณต้องการลบกลุ่มเรียนนี้ใช่หรือไม่?"}
                                                {modals.deleteModal.type === "team" && "คุณต้องการลบกลุ่มนี้ใช่หรือไม่?"}
                                                {modals.deleteModal.type === "ta" && "คุณต้องการนำผู้ช่วยสอนออกใช่หรือไม่?"}
                                                {modals.deleteModal.type === "instructor" && "คุณต้องการนำอาจารย์ออกใช่หรือไม่?"}
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
                            onPress={modals.deleteModal.reset}
                            isDisabled={modals.isSubmitting}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="danger"
                            onPress={() => {
                                switch (modals.deleteModal.type) {
                                    case "student": confirmRemoveStudent(); break;
                                    case "section": confirmRemoveSection(); break;
                                    case "team": confirmDeleteTeam(); break;
                                    case "ta": confirmRemoveTA(); break;
                                    case "instructor": confirmRemoveInstructor(); break;
                                }
                            }}
                            isLoading={modals.isSubmitting}
                            className="bg-red-500"
                        >
                            {modals.deleteModal.type === "student" && "นำออก"}
                            {modals.deleteModal.type === "section" && "ลบกลุ่มเรียน"}
                            {modals.deleteModal.type === "team" && "ลบกลุ่ม"}
                            {modals.deleteModal.type === "ta" && "นำออก"}
                            {modals.deleteModal.type === "instructor" && "นำออก"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Bulk Delete Teams Modal */}
            <Modal
                isOpen={modals.bulkDeleteModal.isOpen}
                onClose={() => modals.bulkDeleteModal.setIsOpen(false)}
                size="lg"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg">
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
                                            <Icon icon="solar:users-group-two-rounded-bold" className="text-2xl text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-lg text-slate-800">
                                                กลุ่มสัปดาห์ที่ {selectedWeek}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Chip size="sm" variant="flat" className="bg-emerald-100 text-emerald-700">
                                                    <Icon icon="solar:users-group-rounded-linear" className="mr-1" />
                                                    {(weeklyTeams[selectedWeek] || []).length} กลุ่ม
                                                </Chip>
                                                <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
                                                    W{selectedWeek}
                                                </Chip>
                                            </div>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>

                            {/* Teams List */}
                            {(weeklyTeams[selectedWeek] || []).length > 0 && (
                                <Card className="border border-amber-200 bg-amber-50">
                                    <CardBody className="py-3 px-4">
                                        <div className="flex items-start gap-3">
                                            <Icon icon="solar:list-bold" className="text-xl text-amber-600 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="font-medium text-amber-800">รายชื่อกลุ่มที่จะถูกลบ</p>
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {(weeklyTeams[selectedWeek] || []).slice(0, 8).map(team => (
                                                        <Chip key={team.id} size="sm" variant="flat" className="bg-amber-100 text-amber-700">
                                                            {team.name}
                                                        </Chip>
                                                    ))}
                                                    {(weeklyTeams[selectedWeek] || []).length > 8 && (
                                                        <Chip size="sm" variant="flat" className="bg-amber-200 text-amber-800">
                                                            +{(weeklyTeams[selectedWeek] || []).length - 8} กลุ่ม
                                                        </Chip>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>
                            )}

                            {/* Warning */}
                            <div className="p-4 bg-red-100 rounded-xl border border-red-200">
                                <div className="flex items-center gap-3">
                                    <Icon icon="solar:shield-warning-bold" className="text-2xl text-red-600" />
                                    <div>
                                        <p className="font-semibold text-red-800">
                                            คุณต้องการลบกลุ่มทั้งหมดใช่หรือไม่?
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
                            onPress={() => modals.bulkDeleteModal.setIsOpen(false)}
                            isDisabled={modals.isSubmitting}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="danger"
                            onPress={confirmBulkDeleteTeams}
                            isLoading={modals.isSubmitting}
                            className="bg-red-500"
                        >
                            ลบทั้งหมด
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Create Team Modal */}
            <Modal
                isOpen={modals.teamModal.isOpen}
                onClose={modals.teamModal.reset}
                size="xl"
                scrollBehavior="inside"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl shadow-lg ${modals.teamModal.type === "permanent"
                                ? "bg-gradient-to-br from-purple-500 to-indigo-600"
                                : "bg-gradient-to-br from-emerald-500 to-teal-600"
                                }`}>
                                <Icon icon="solar:users-group-two-rounded-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    {modals.teamModal.formationMethod === "random"
                                        ? "สุ่มกลุ่มอัตโนมัติ"
                                        : `สร้าง${modals.teamModal.type === "permanent" ? "กลุ่มโปรเจกต์" : "กลุ่มโปรเจกต์รายสัปดาห์"}ใหม่`
                                    }
                                </h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">
                                    {modals.teamModal.formationMethod === "random"
                                        ? `สุ่มจับกลุ่ม${modals.teamModal.type === "permanent" ? "โปรเจกต์" : `สัปดาห์ที่ ${selectedWeek}`}`
                                        : modals.teamModal.type === "permanent"
                                            ? "กลุ่มที่ใช้ตลอดทั้งเทอม"
                                            : `กลุ่มสำหรับสัปดาห์ที่ ${selectedWeek}`
                                    }
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-5">
                            {/* Formation Method Toggle */}
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => modals.teamModal.setFormationMethod("manual")}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${modals.teamModal.formationMethod === "manual"
                                        ? `bg-white shadow-sm ${modals.teamModal.type === "permanent" ? "text-purple-600" : "text-emerald-600"}`
                                        : "text-slate-600 hover:bg-slate-200"
                                        }`}
                                >
                                    <Icon icon="solar:checklist-linear" />
                                    เลือกด้วยตนเอง
                                </button>
                                <button
                                    onClick={() => modals.teamModal.setFormationMethod("random")}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${modals.teamModal.formationMethod === "random"
                                        ? `bg-white shadow-sm ${modals.teamModal.type === "permanent" ? "text-purple-600" : "text-emerald-600"}`
                                        : "text-slate-600 hover:bg-slate-200"
                                        }`}
                                >
                                    <Icon icon="solar:shuffle-bold" />
                                    สุ่มอัตโนมัติ
                                </button>
                            </div>

                            {modals.teamModal.formationMethod === "manual" ? (
                                <>
                                    {/* Team Name */}
                                    <Input
                                        label="ชื่อกลุ่ม"
                                        labelPlacement="outside"
                                        placeholder="เช่น กลุ่ม 1, กลุ่ม A, ทีม Alpha"
                                        variant="bordered"
                                        size="md"
                                        value={modals.teamModal.name}
                                        onValueChange={modals.teamModal.setName}
                                        isRequired
                                        className="pt-3"
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />

                                    {/* Member Selection Mode Toggle */}
                                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                                        <button
                                            onClick={() => {
                                                modals.teamModal.setMemberMode("select");
                                                modals.teamModal.setExcelData("");
                                                modals.teamModal.setParsedMembers([]);
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${modals.teamModal.memberMode === "select"
                                                ? `bg-white shadow-sm ${modals.teamModal.type === "permanent" ? "text-purple-600" : "text-emerald-600"}`
                                                : "text-slate-600 hover:bg-slate-200"
                                                }`}
                                        >
                                            <Icon icon="solar:checklist-linear" />
                                            เลือกจากรายชื่อ
                                        </button>
                                        <button
                                            onClick={() => {
                                                modals.teamModal.setMemberMode("paste");
                                                modals.teamModal.setMembers([]);
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${modals.teamModal.memberMode === "paste"
                                                ? `bg-white shadow-sm ${modals.teamModal.type === "permanent" ? "text-purple-600" : "text-emerald-600"}`
                                                : "text-slate-600 hover:bg-slate-200"
                                                }`}
                                        >
                                            <Icon icon="solar:clipboard-list-linear" />
                                            วางจาก Excel
                                        </button>
                                    </div>

                                    {/* Select Mode - Member Selection */}
                                    {modals.teamModal.memberMode === "select" && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-slate-600 font-medium text-sm">
                                                    เลือกสมาชิก ({modals.teamModal.members.length} คน)
                                                </label>
                                                {modals.teamModal.members.length > 0 && (
                                                    <Button
                                                        size="sm"
                                                        variant="light"
                                                        color="danger"
                                                        onPress={() => modals.teamModal.setMembers([])}
                                                    >
                                                        ล้างทั้งหมด
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                                    <p className="text-sm text-slate-600">
                                                        นักศึกษาที่ยังไม่อยู่ในกลุ่ม: {getUnassignedStudents(modals.teamModal.type, modals.teamModal.type === "weekly" ? selectedWeek : undefined).length} คน
                                                    </p>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto">
                                                    {getUnassignedStudents(modals.teamModal.type, modals.teamModal.type === "weekly" ? selectedWeek : undefined).length > 0 ? (
                                                        getUnassignedStudents(modals.teamModal.type, modals.teamModal.type === "weekly" ? selectedWeek : undefined).map((student) => (
                                                            <div
                                                                key={student.id}
                                                                onClick={() => {
                                                                    if (modals.teamModal.members.includes(student.id)) {
                                                                        modals.teamModal.setMembers(modals.teamModal.members.filter(id => id !== student.id));
                                                                    } else {
                                                                        modals.teamModal.setMembers([...modals.teamModal.members, student.id]);
                                                                    }
                                                                }}
                                                                className={`flex items-center justify-between p-3 cursor-pointer transition-colors border-b border-slate-100 last:border-0 ${modals.teamModal.members.includes(student.id)
                                                                    ? modals.teamModal.type === "permanent"
                                                                        ? "bg-purple-50 border-l-4 border-l-purple-500"
                                                                        : "bg-emerald-50 border-l-4 border-l-emerald-500"
                                                                    : "hover:bg-slate-50"
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <Avatar name={student.full_name} size="sm" className={
                                                                        modals.teamModal.type === "permanent" ? "bg-purple-500" : "bg-emerald-500"
                                                                    } />
                                                                    <div>
                                                                        <p className="font-medium text-slate-800">{student.full_name}</p>
                                                                        <p className="text-sm text-slate-500">{student.student_id}</p>
                                                                    </div>
                                                                </div>
                                                                {modals.teamModal.members.includes(student.id) && (
                                                                    <Icon icon="solar:check-circle-bold" className={`text-xl ${modals.teamModal.type === "permanent" ? "text-purple-500" : "text-emerald-500"
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
                                    {modals.teamModal.memberMode === "paste" && (
                                        <>
                                            <div>
                                                <label className="text-slate-600 font-medium text-sm mb-2 block">
                                                    วางรหัสนักศึกษาจาก Excel
                                                </label>
                                                <p className="text-xs text-slate-400 mb-2">
                                                    คัดลอกคอลัมน์รหัสนักศึกษาจาก Excel แล้ววางที่นี่ (หนึ่งรหัสต่อหนึ่งบรรทัด)
                                                </p>
                                                <textarea
                                                    value={modals.teamModal.excelData}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        modals.teamModal.setExcelData(value);
                                                        if (value.trim()) {
                                                            modals.teamModal.setIsParsing(true);
                                                        } else {
                                                            modals.teamModal.setParsedMembers([]);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (modals.teamModal.excelData.trim()) {
                                                            parseTeamExcelData(modals.teamModal.excelData);
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            if (modals.teamModal.excelData.trim()) {
                                                                parseTeamExcelData(modals.teamModal.excelData);
                                                            }
                                                        }
                                                    }}
                                                    onPaste={(e) => {
                                                        const pastedText = e.clipboardData.getData('text');
                                                        if (pastedText.trim()) {
                                                            modals.teamModal.setIsParsing(true);
                                                            setTimeout(() => {
                                                                const combinedText = modals.teamModal.excelData + pastedText;
                                                                parseTeamExcelData(combinedText);
                                                            }, 50);
                                                        }
                                                    }}
                                                    placeholder={"64070001\n64070002\n64070003\n..."}
                                                    className={`w-full h-28 px-4 py-3 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 resize-none bg-white ${modals.teamModal.type === "permanent"
                                                        ? "border-purple-200 focus:ring-purple-400"
                                                        : "border-emerald-200 focus:ring-emerald-400"
                                                        }`}
                                                />
                                                <div className="mt-2 flex justify-end">
                                                    <Button
                                                        size="sm"
                                                        color={modals.teamModal.type === "permanent" ? "secondary" : "success"}
                                                        variant="flat"
                                                        onPress={() => parseTeamExcelData(modals.teamModal.excelData)}
                                                        isLoading={modals.teamModal.isParsing}
                                                        isDisabled={!modals.teamModal.excelData.trim()}
                                                        startContent={!modals.teamModal.isParsing && <Icon icon="solar:magnifer-linear" />}
                                                    >
                                                        ค้นหานักศึกษา
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Loading State */}
                                            {modals.teamModal.isParsing && modals.teamModal.parsedMembers.length === 0 && (
                                                <div className="flex items-center justify-center py-8">
                                                    <Spinner size="sm" color={modals.teamModal.type === "permanent" ? "secondary" : "success"} />
                                                    <span className="ml-2 text-slate-500">กำลังค้นหานักศึกษา...</span>
                                                </div>
                                            )}

                                            {/* Parse Results */}
                                            {modals.teamModal.parsedMembers.length > 0 && (
                                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                                                        <p className="text-sm text-slate-600">
                                                            ผลการตรวจสอบ ({modals.teamModal.parsedMembers.length} รายการ)
                                                        </p>
                                                        <div className="flex gap-2 text-xs">
                                                            <span className={`px-2 py-1 rounded-full ${modals.teamModal.type === "permanent"
                                                                ? "bg-purple-100 text-purple-700"
                                                                : "bg-emerald-100 text-emerald-700"
                                                                }`}>
                                                                พบ {modals.teamModal.parsedMembers.filter(p => p.status === "matched").length}
                                                            </span>
                                                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                                                มีกลุ่มแล้ว {modals.teamModal.parsedMembers.filter(p => p.status === "already_in_team").length}
                                                            </span>
                                                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
                                                                ไม่พบ {modals.teamModal.parsedMembers.filter(p => p.status === "not_found").length}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto">
                                                        {modals.teamModal.parsedMembers.map((result, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`flex items-center justify-between p-3 border-b border-slate-100 last:border-0 ${result.status === "matched"
                                                                    ? modals.teamModal.type === "permanent" ? "bg-purple-50" : "bg-emerald-50"
                                                                    : result.status === "already_in_team" ? "bg-amber-50" : "bg-red-50"
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    {result.matchedStudent ? (
                                                                        <>
                                                                            <Avatar name={result.matchedStudent.full_name} size="sm" className={
                                                                                result.status === "matched"
                                                                                    ? modals.teamModal.type === "permanent" ? "bg-purple-500" : "bg-emerald-500"
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
                                                                        <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${modals.teamModal.type === "permanent"
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
                            ) : (
                                <>
                                    {/* Random Formation Settings */}
                                    <div>
                                        <label className="text-slate-600 font-medium text-sm mb-2 block">จำนวนสมาชิกต่อกลุ่ม</label>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="flat"
                                                onPress={() => modals.teamModal.setSize(Math.max(2, modals.teamModal.size - 1))}
                                            >
                                                <Icon icon="solar:minus-circle-linear" />
                                            </Button>
                                            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${modals.teamModal.type === "permanent"
                                                ? "bg-purple-50 border-purple-200"
                                                : "bg-emerald-50 border-emerald-200"
                                                }`}>
                                                <Icon icon="solar:users-group-rounded-linear" className={
                                                    modals.teamModal.type === "permanent" ? "text-purple-500" : "text-emerald-500"
                                                } />
                                                <span className="font-bold text-lg text-slate-800">{modals.teamModal.size}</span>
                                                <span className="text-slate-500 text-sm">คน</span>
                                            </div>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="flat"
                                                onPress={() => modals.teamModal.setSize(Math.min(10, modals.teamModal.size + 1))}
                                            >
                                                <Icon icon="solar:add-circle-linear" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Preview */}
                                    <Card className={`shadow-sm border ${modals.teamModal.type === "permanent"
                                        ? "border-purple-100 bg-purple-50/50"
                                        : "border-emerald-100 bg-emerald-50/50"
                                        }`}>
                                        <CardBody className="py-3 px-4">
                                            <div className="flex items-start gap-3">
                                                <Icon icon="solar:info-circle-bold" className={`text-xl mt-0.5 ${modals.teamModal.type === "permanent" ? "text-purple-500" : "text-emerald-500"
                                                    }`} />
                                                <div>
                                                    <p className={`font-medium ${modals.teamModal.type === "permanent" ? "text-purple-800" : "text-emerald-800"
                                                        }`}>ตัวอย่างการจับกลุ่ม</p>
                                                    <p className={`text-sm ${modals.teamModal.type === "permanent" ? "text-purple-600" : "text-emerald-600"
                                                        }`}>
                                                        {(() => {
                                                            const unassigned = getUnassignedStudents(modals.teamModal.type, modals.teamModal.type === "weekly" ? selectedWeek : undefined);
                                                            const numTeams = Math.ceil(unassigned.length / modals.teamModal.size);
                                                            const remainder = unassigned.length % modals.teamModal.size;
                                                            if (unassigned.length === 0) {
                                                                return "ไม่มีนักศึกษาที่ยังไม่อยู่ในกลุ่ม";
                                                            }
                                                            return `นักศึกษา ${unassigned.length} คน จะถูกแบ่งเป็น ${numTeams} กลุ่ม ${remainder > 0 ? `(${numTeams - 1} กลุ่ม ${modals.teamModal.size} คน และ 1 กลุ่ม ${remainder} คน)` : `(กลุ่มละ ${modals.teamModal.size} คน)`
                                                                }`;
                                                        })()}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                </>
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button
                            variant="light"
                            onPress={modals.teamModal.reset}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color={modals.teamModal.type === "permanent" ? "secondary" : "success"}
                            onPress={handleCreateTeam}
                            isLoading={modals.isSubmitting}
                            className={modals.teamModal.type === "permanent" ? "bg-purple-500" : "bg-emerald-500"}
                            startContent={!modals.isSubmitting && <Icon icon={modals.teamModal.formationMethod === "random" ? "solar:shuffle-bold" : "solar:add-circle-bold"} />}
                        >
                            {modals.teamModal.formationMethod === "random"
                                ? "สุ่มกลุ่ม"
                                : `สร้างกลุ่ม${modals.teamModal.members.length > 0 ? ` (${modals.teamModal.members.length} คน)` : ""}`
                            }
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Team Modal */}
            <Modal
                isOpen={modals.editTeamModal.isOpen}
                onClose={modals.editTeamModal.reset}
                size="xl"
                scrollBehavior="inside"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
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
                                value={modals.editTeamModal.name}
                                onValueChange={modals.editTeamModal.setName}
                                isRequired
                                className="pt-3"
                                classNames={{
                                    inputWrapper: "bg-white border-slate-200 hover:border-amber-300 focus-within:!border-amber-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            />

                            {/* Current Members */}
                            <div>
                                <label className="text-slate-600 font-medium text-sm mb-2 block">
                                    สมาชิกปัจจุบัน ({modals.editTeamModal.members.length} คน)
                                </label>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="max-h-40 overflow-y-auto">
                                        {modals.editTeamModal.members.length > 0 ? (
                                            modals.editTeamModal.members.map((memberId) => {
                                                const student = getAllEnrolledStudents().find(
                                                    (s) => s.id === memberId
                                                );
                                                if (!student) return null;
                                                return (
                                                    <div
                                                        key={memberId}
                                                        className="flex items-center justify-between p-3 border-b border-slate-100 last:border-0 bg-amber-50"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Avatar name={student.full_name} size="sm" className="bg-amber-500" />
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
                                                                modals.editTeamModal.setMembers(
                                                                    modals.editTeamModal.members.filter(id => id !== memberId)
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
                                            นักศึกษาที่ยังไม่อยู่ในกลุ่ม: {getAvailableStudentsForEdit().filter(s => !modals.editTeamModal.members.includes(s.id)).length} คน
                                        </p>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {getAvailableStudentsForEdit().filter(s => !modals.editTeamModal.members.includes(s.id)).length > 0 ? (
                                            getAvailableStudentsForEdit()
                                                .filter(s => !modals.editTeamModal.members.includes(s.id))
                                                .map((student) => (
                                                    <div
                                                        key={student.id}
                                                        onClick={() => {
                                                            modals.editTeamModal.setMembers([...modals.editTeamModal.members, student.id]);
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
                                                        <Icon icon="solar:add-circle-linear" className="text-xl text-amber-500" />
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
                        <Button
                            variant="light"
                            onPress={modals.editTeamModal.reset}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            onPress={saveEditedTeam}
                            isLoading={modals.isSubmitting}
                            isDisabled={!modals.editTeamModal.name.trim()}
                            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-400/25"
                            startContent={!modals.isSubmitting && <Icon icon="solar:diskette-bold" />}
                        >
                            บันทึก
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Group Score Modal */}
            <Modal
                isOpen={modals.scoreModals.isGroupScoreModalOpen}
                onClose={() => modals.scoreModals.setIsGroupScoreModalOpen(false)}
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-xl shadow-lg">
                                <Icon icon="solar:chart-square-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">ให้คะแนนกลุ่ม</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">เลือกกลุ่มและใส่คะแนน</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-4">
                            <Select
                                label="เลือกกลุ่ม"
                                labelPlacement="outside"
                                placeholder="เลือกกลุ่มที่ต้องการให้คะแนน"
                                variant="bordered"
                                size="lg"
                                selectedKeys={scores.selectedGroup ? [String(scores.selectedGroup.id)] : []}
                                onSelectionChange={(keys) => {
                                    const selectedId = Array.from(keys)[0];
                                    const group = scores.groupsForScore.find(g => g.id === Number(selectedId));
                                    scores.setSelectedGroup(group || null);
                                }}
                                classNames={{
                                    trigger: "h-12 bg-white border-slate-200 hover:border-indigo-300 data-[open=true]:border-indigo-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            >
                                {scores.groupsForScore.map(group => (
                                    <SelectItem key={String(group.id)} textValue={group.name}>
                                        <div className="flex items-center gap-2">
                                            <Icon icon="solar:users-group-rounded-bold" className="text-indigo-500" />
                                            <span>{group.name}</span>
                                            <Chip size="sm" variant="flat" color="primary">
                                                {group.members?.length || 0} คน
                                            </Chip>
                                        </div>
                                    </SelectItem>
                                ))}
                            </Select>
                            {scores.selectedGroup && (
                                <Input
                                    type="number"
                                    label="คะแนน"
                                    labelPlacement="outside"
                                    placeholder="ใส่คะแนน"
                                    variant="bordered"
                                    size="lg"
                                    value={String(scores.groupScoreValue)}
                                    onValueChange={(v) => scores.setGroupScoreValue(parseFloat(v) || 0)}
                                    max={scores.selectedAssignment?.max_score || 100}
                                    min={0}
                                    startContent={<Icon icon="solar:star-linear" className="text-slate-400" />}
                                    endContent={
                                        <span className="text-sm text-slate-400">
                                            / {scores.selectedAssignment?.max_score || 100}
                                        </span>
                                    }
                                    classNames={{
                                        inputWrapper: "h-12 bg-white border-slate-200 hover:border-indigo-300 focus-within:!border-indigo-400",
                                        label: "text-slate-600 font-medium text-sm",
                                    }}
                                />
                            )}
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button
                            variant="light"
                            onPress={() => modals.scoreModals.setIsGroupScoreModalOpen(false)}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="secondary"
                            onPress={async () => {
                                const success = await scores.saveGroupScore();
                                if (success) modals.scoreModals.setIsGroupScoreModalOpen(false);
                            }}
                            isLoading={scores.isSaving}
                            isDisabled={!scores.selectedGroup}
                            startContent={!scores.isSaving && <Icon icon="solar:diskette-bold" />}
                            className="bg-gradient-to-r from-indigo-400 to-purple-500 shadow-lg shadow-indigo-400/25"
                        >
                            บันทึกคะแนน
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Assignment Pending Update Toast - Portaled to body to escape all stacking contexts */}
            {pendingAssignmentUpdate && createPortal(
                <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[9999] sm:max-w-sm sm:w-full animate-toast-slide-up">
                    <div className="bg-white/95 backdrop-blur-md border border-blue-200 rounded-2xl shadow-2xl overflow-hidden">
                        {/* <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" /> */}
                        <div className="flex items-center gap-3 p-4">
                            <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:bell-bing-bold" className="text-xl text-white animate-bounce" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800">มีงานอัปเดตใหม่</p>
                                <p className="text-xs text-slate-500 mt-0.5">มีการเพิ่มหรือแก้ไขงานในชั้นเรียนนี้</p>
                            </div>
                            <Button
                                size="sm"
                                color="primary"
                                className="shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                                startContent={<Icon icon="solar:refresh-bold" />}
                                onPress={() => ackAssignmentUpdate()}
                            >
                                โหลดงานใหม่
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}