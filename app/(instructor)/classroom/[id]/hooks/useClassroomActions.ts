"use client";

import { useCallback } from "react";
import { addToast } from "@heroui/toast";
import { courseService } from "@/services/course.service";
import { studentService } from "@/services/student.service";
import type { Course, SectionStudent } from "@/services/course.service";
import type { Student } from "@/services/student.service";
import type { TeamMember, PermanentTeam, WeeklyTeam } from "./useClassroomData";

interface UseClassroomActionsProps {
    courseId: string;
    course: Course | null;
    setCourse: React.Dispatch<React.SetStateAction<Course | null>>;
    sectionStudents: Record<number, SectionStudent[]>;
    setSectionStudents: React.Dispatch<React.SetStateAction<Record<number, SectionStudent[]>>>;
    permanentTeams: PermanentTeam[];
    setPermanentTeams: React.Dispatch<React.SetStateAction<PermanentTeam[]>>;
    weeklyTeams: Record<number, WeeklyTeam[]>;
    setWeeklyTeams: React.Dispatch<React.SetStateAction<Record<number, WeeklyTeam[]>>>;
    studentsList: Student[];
    fetchCourse: (forceRefresh?: boolean) => Promise<void>;
    fetchOverview: (forceRefresh?: boolean) => Promise<void>;
    fetchTeams: (forceRefresh?: boolean) => Promise<void>;
    fetchAllSectionStudents: () => Promise<void>;
    emitUpdate: (resource: string, action: string, id?: string | number) => void;
}

/**
 * Custom hook for classroom CRUD operations (sections, TAs, students, teams)
 */
export function useClassroomActions({
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
}: UseClassroomActionsProps) {
    
    // ============================================
    // Section Actions
    // ============================================

    const addSection = useCallback(async (sectionNo: string, note?: string) => {
        if (!sectionNo.trim()) {
            addToast({
                title: "ข้อมูลไม่ครบ",
                description: "กรุณากรอกหมายเลขกลุ่มเรียน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }

        try {
            const response = await courseService.addSection(courseId, {
                section_no: sectionNo,
                note: note || undefined,
            });
            
            if (response.success && response.data) {
                const newSection = response.data;
                setCourse(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        sections: [...(prev.sections || []), {
                            id: newSection.id,
                            course_id: courseId,
                            section_no: newSection.section_no,
                            note: newSection.note,
                            created_at: newSection.created_at,
                            studentCount: 0
                        }]
                    };
                });
                
                addToast({
                    title: "สำเร็จ",
                    description: "เพิ่มกลุ่มเรียนสำเร็จ",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                fetchOverview();
                emitUpdate("section", "create", newSection.id);
                return true;
            }
            return false;
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: err.message || "ไม่สามารถเพิ่มกลุ่มเรียนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
    }, [courseId, setCourse, fetchOverview, emitUpdate]);

    const removeSection = useCallback(async (sectionId: number) => {
        try {
            const response = await courseService.removeSection(courseId, sectionId);
            if (response.success) {
                setCourse(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        sections: prev.sections?.filter(s => s.id !== sectionId) || []
                    };
                });
                
                setSectionStudents(prev => {
                    const newState = { ...prev };
                    delete newState[sectionId];
                    return newState;
                });
                
                addToast({
                    title: "สำเร็จ",
                    description: "ลบกลุ่มเรียนเรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                fetchOverview();
                emitUpdate("section", "delete", sectionId);
                return true;
            }
            return false;
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: err.message || "ไม่สามารถลบกลุ่มเรียนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
    }, [courseId, setCourse, setSectionStudents, fetchOverview, emitUpdate]);

    // ============================================
    // TA Actions
    // ============================================

    const addTAs = useCallback(async (taIds: number[]) => {
        if (taIds.length === 0) {
            addToast({
                title: "ข้อมูลไม่ครบ",
                description: "กรุณาเลือกผู้ช่วยสอนอย่างน้อย 1 คน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }

        try {
            const response = await courseService.bulkAddTAs(courseId, taIds);
            if (response.success && response.data) {
                setCourse(prev => {
                    if (!prev) return prev;
                    const existingTAs = prev.tas || [];
                    const newTAs = response.data?.added || [];
                    return {
                        ...prev,
                        tas: [...existingTAs, ...newTAs]
                    };
                });
                
                const addedCount = response.data?.added?.length || 0;
                addToast({
                    title: "สำเร็จ",
                    description: `เพิ่มผู้ช่วยสอน ${addedCount} คนเรียบร้อย`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                emitUpdate("user", "create");
                return true;
            }
            return false;
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: err.message || "ไม่สามารถเพิ่มผู้ช่วยสอนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
    }, [courseId, setCourse, emitUpdate]);

    const removeTA = useCallback(async (userId: number) => {
        try {
            const response = await courseService.removeTA(courseId, userId);
            if (response.success) {
                setCourse(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        tas: prev.tas?.filter(ta => ta.id !== userId) || []
                    };
                });
                
                addToast({
                    title: "สำเร็จ",
                    description: "นำผู้ช่วยสอนออกเรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                emitUpdate("user", "delete", userId);
                return true;
            }
            return false;
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: err.message || "ไม่สามารถนำผู้ช่วยสอนออกได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
    }, [courseId, setCourse, emitUpdate]);

    // ============================================
    // Instructor Actions
    // ============================================

    const addInstructors = useCallback(async (instructorIds: number[]) => {
        if (instructorIds.length === 0) {
            addToast({
                title: "กรุณาเลือกอาจารย์",
                description: "เลือกอาจารย์อย่างน้อย 1 คน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }

        try {
            const response = await courseService.bulkAddCourseInstructors(courseId, instructorIds);
            if (response.success) {
                await fetchCourse(true);
                addToast({
                    title: "สำเร็จ",
                    description: "เพิ่มอาจารย์เรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                emitUpdate("user", "create");
                return true;
            }
            return false;
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: err.message || "ไม่สามารถเพิ่มอาจารย์ได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
    }, [courseId, fetchCourse, emitUpdate]);

    const removeInstructor = useCallback(async (userId: number) => {
        try {
            const response = await courseService.removeCourseInstructor(courseId, userId);
            if (response.success) {
                setCourse(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        instructors: prev.instructors?.filter(i => i.id !== userId) || []
                    };
                });
                
                addToast({
                    title: "สำเร็จ",
                    description: "นำอาจารย์ออกเรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                emitUpdate("user", "delete", userId);
                return true;
            }
            return false;
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: err.message || "ไม่สามารถนำอาจารย์ออกได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
    }, [courseId, setCourse, emitUpdate]);

    // ============================================
    // Student Actions
    // ============================================

    const addStudentToSection = useCallback(async (sectionId: number, studentId: number) => {
        try {
            const response = await courseService.addStudentToSection(courseId, sectionId, studentId);
            if (response.success) {
                const student = studentsList.find(s => s.id === studentId);
                if (student) {
                    setSectionStudents(prev => ({
                        ...prev,
                        [sectionId]: [...(prev[sectionId] || []), {
                            id: student.id,
                            student_id: student.student_id,
                            full_name: student.full_name,
                            email: student.email || null,
                            is_active: student.is_active,
                            enrolled_at: new Date().toISOString(),
                        }]
                    }));
                    
                    setCourse(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            sections: prev.sections?.map(s => 
                                s.id === sectionId 
                                    ? { ...s, studentCount: (s.studentCount || 0) + 1 }
                                    : s
                            ) || []
                        };
                    });
                }
                
                addToast({
                    title: "สำเร็จ",
                    description: "เพิ่มนักศึกษาเรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                fetchOverview();
                emitUpdate("student", "create", studentId);
                return true;
            }
            return false;
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: err.message || "ไม่สามารถเพิ่มนักศึกษาได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
    }, [courseId, studentsList, setSectionStudents, setCourse, fetchOverview, emitUpdate]);

    const bulkAddStudentsToSection = useCallback(async (sectionId: number, studentIds: number[]) => {
        try {
            const response = await courseService.bulkAddStudentsToSection(courseId, sectionId, studentIds);
            if (response.success) {
                await fetchAllSectionStudents();
                await fetchCourse(true);
                await fetchOverview();
                
                addToast({
                    title: "สำเร็จ",
                    description: `เพิ่มนักศึกษา ${studentIds.length} คนเรียบร้อย`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                emitUpdate("student", "bulk");
                return true;
            }
            return false;
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: err.message || "ไม่สามารถเพิ่มนักศึกษาได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
    }, [courseId, fetchAllSectionStudents, fetchCourse, fetchOverview, emitUpdate]);

    const removeStudentFromSection = useCallback(async (sectionId: number, studentId: number) => {
        try {
            const response = await courseService.removeStudentFromSection(courseId, sectionId, studentId);
            if (response.success) {
                setSectionStudents(prev => ({
                    ...prev,
                    [sectionId]: (prev[sectionId] || []).filter(s => s.id !== studentId)
                }));
                
                setCourse(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        sections: prev.sections?.map(s => 
                            s.id === sectionId 
                                ? { ...s, studentCount: Math.max(0, (s.studentCount || 0) - 1) }
                                : s
                        ) || []
                    };
                });
                
                // Remove student from teams
                setPermanentTeams(prev => 
                    prev.map(team => ({
                        ...team,
                        members: team.members.filter(m => m.id !== studentId)
                    }))
                );
                
                setWeeklyTeams(prev => {
                    const newWeekly = { ...prev };
                    Object.keys(newWeekly).forEach(week => {
                        newWeekly[parseInt(week)] = newWeekly[parseInt(week)].map(team => ({
                            ...team,
                            members: team.members.filter(m => m.id !== studentId)
                        }));
                    });
                    return newWeekly;
                });
                
                addToast({
                    title: "สำเร็จ",
                    description: "นำนักศึกษาออกเรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                fetchOverview();
                emitUpdate("student", "delete", studentId);
                return true;
            }
            return false;
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: err.message || "ไม่สามารถนำนักศึกษาออกได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
    }, [courseId, setSectionStudents, setCourse, setPermanentTeams, setWeeklyTeams, fetchOverview, emitUpdate]);

    // Search students by IDs (for Excel paste)
    const searchStudentsByIds = useCallback(async (
        ids: string[],
        sectionFilter?: string
    ) => {
        try {
            const response = await studentService.searchStudentsByIds(
                ids,
                course?.id,
                sectionFilter
            );
            return response;
        } catch (error) {
            console.error("Error searching students:", error);
            return { success: false, data: null };
        }
    }, [course?.id]);

    // ============================================
    // Team Actions
    // ============================================

    const createTeam = useCallback(async (
        type: "permanent" | "weekly",
        name: string,
        memberIds: number[],
        weekNumber?: number
    ) => {
        if (!name.trim()) {
            addToast({
                title: "ข้อมูลไม่ครบ",
                description: "กรุณากรอกชื่อกลุ่ม",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }

        if (memberIds.length === 0) {
            addToast({
                title: "ข้อมูลไม่ครบ",
                description: "กรุณาเลือกสมาชิกอย่างน้อย 1 คน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }

        try {
            const response = await courseService.createTeam(courseId, {
                name,
                group_type: type === "permanent" ? "permanent" : "temporary",
                member_ids: memberIds,
                week_number: type === "weekly" ? weekNumber : undefined,
            });

            if (response.success) {
                await fetchTeams(true);
                addToast({
                    title: "สำเร็จ",
                    description: `สร้างกลุ่ม "${name}" เรียบร้อย`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                emitUpdate("group", "create");
                return true;
            }
            return false;
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: err.message || "ไม่สามารถสร้างกลุ่มได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
    }, [courseId, fetchTeams, emitUpdate]);

    const createRandomTeams = useCallback(async (
        type: "permanent" | "weekly",
        students: TeamMember[],
        teamSize: number,
        baseTeamName: string,
        weekNumber?: number
    ) => {
        const shuffled = [...students].sort(() => Math.random() - 0.5);
        const teams: TeamMember[][] = [];
        for (let i = 0; i < shuffled.length; i += teamSize) {
            teams.push(shuffled.slice(i, i + teamSize));
        }

        let successCount = 0;
        for (let i = 0; i < teams.length; i++) {
            const teamName = `${baseTeamName} ${i + 1}`;
            const memberIds = teams[i].map(m => m.id);
            
            try {
                const response = await courseService.createTeam(courseId, {
                    name: teamName,
                    group_type: type === "permanent" ? "permanent" : "temporary",
                    member_ids: memberIds,
                    week_number: type === "weekly" ? weekNumber : undefined,
                });
                if (response.success) successCount++;
            } catch (error) {
                console.error(`Error creating team ${teamName}:`, error);
            }
        }

        await fetchTeams(true);
        
        if (successCount > 0) {
            addToast({
                title: "สำเร็จ",
                description: `สร้างกลุ่มแบบสุ่ม ${successCount} กลุ่มเรียบร้อย`,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            emitUpdate("group", "bulk");
        }
        
        return successCount;
    }, [courseId, fetchTeams, emitUpdate]);

    const updateTeam = useCallback(async (
        teamId: number,
        name: string,
        memberIds: number[]
    ) => {
        try {
            const response = await courseService.updateTeam(courseId, teamId, {
                name,
                member_ids: memberIds,
            });

            if (response.success) {
                await fetchTeams(true);
                addToast({
                    title: "สำเร็จ",
                    description: "แก้ไขกลุ่มเรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                emitUpdate("group", "update", teamId);
                return true;
            }
            return false;
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: err.message || "ไม่สามารถแก้ไขกลุ่มได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
    }, [courseId, fetchTeams, emitUpdate]);

    const deleteTeam = useCallback(async (teamId: number) => {
        try {
            const response = await courseService.deleteTeam(courseId, teamId);
            if (response.success) {
                await fetchTeams(true);
                addToast({
                    title: "สำเร็จ",
                    description: "ลบกลุ่มเรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                emitUpdate("group", "delete", teamId);
                return true;
            }
            return false;
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: err.message || "ไม่สามารถลบกลุ่มได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return false;
        }
    }, [courseId, fetchTeams, emitUpdate]);

    const bulkDeleteTeams = useCallback(async (teamIds: number[]) => {
        let successCount = 0;
        for (const teamId of teamIds) {
            try {
                const response = await courseService.deleteTeam(courseId, teamId);
                if (response.success) successCount++;
            } catch (error) {
                console.error(`Error deleting team ${teamId}:`, error);
            }
        }

        await fetchTeams(true);
        
        if (successCount > 0) {
            addToast({
                title: "สำเร็จ",
                description: `ลบกลุ่ม ${successCount} กลุ่มเรียบร้อย`,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            emitUpdate("group", "bulk");
        }
        
        return successCount;
    }, [courseId, fetchTeams, emitUpdate]);

    const copyTeamsFromWeek = useCallback(async (
        sourceWeek: number,
        targetWeek: number
    ) => {
        const sourceTeams = weeklyTeams[sourceWeek];
        if (!sourceTeams || sourceTeams.length === 0) {
            addToast({
                title: "ไม่พบกลุ่ม",
                description: `ไม่พบกลุ่มในสัปดาห์ที่ ${sourceWeek}`,
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return 0;
        }

        let successCount = 0;
        for (const team of sourceTeams) {
            try {
                const response = await courseService.createTeam(courseId, {
                    name: team.name,
                    group_type: "temporary",
                    member_ids: team.members.map(m => m.id),
                    week_number: targetWeek,
                });
                if (response.success) successCount++;
            } catch (error) {
                console.error(`Error copying team ${team.name}:`, error);
            }
        }

        await fetchTeams(true);
        
        if (successCount > 0) {
            addToast({
                title: "สำเร็จ",
                description: `คัดลอก ${successCount} กลุ่มเรียบร้อย`,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            emitUpdate("group", "bulk");
        }
        
        return successCount;
    }, [courseId, weeklyTeams, fetchTeams, emitUpdate]);

    return {
        // Section actions
        addSection,
        removeSection,

        // TA actions
        addTAs,
        removeTA,

        // Instructor actions
        addInstructors,
        removeInstructor,

        // Student actions
        addStudentToSection,
        bulkAddStudentsToSection,
        removeStudentFromSection,
        searchStudentsByIds,

        // Team actions
        createTeam,
        createRandomTeams,
        updateTeam,
        deleteTeam,
        bulkDeleteTeams,
        copyTeamsFromWeek,
    };
}
