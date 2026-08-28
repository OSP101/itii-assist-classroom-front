"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Avatar } from "@heroui/avatar";
import { Skeleton } from "@heroui/skeleton";
import {
    Table,
    TableHeader,
    TableBody,
    TableColumn,
    TableRow,
    TableCell,
} from "@heroui/table";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Switch } from "@heroui/switch";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import TablePaginationFooter, { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/components/ui/table-pagination-footer";
import {
    useHorizontalOverflow,
    STICKY_SCROLL_CONTAINER_CLASS,
    STICKY_ACTION_HEADER_CLASS,
    STICKY_ACTION_CELL_CLASS,
} from "./shared/stickyActionColumn";
import {
    buildCoursePermissionPreset,
    resolveCourseMemberPermissions,
    type CourseMemberPermissions,
    type CoursePermissionPreset,
} from "@/services/course.service";

interface Instructor {
    id: number;
    full_name: string;
    email: string | null;
    username?: string;
    avatar: string | null;
    CourseInstructor?: {
        is_primary: boolean;
        assigned_at?: string;
        permissions?: CourseMemberPermissions;
    };
}

interface TA {
    id: number;
    full_name: string;
    email: string | null;
    username: string;
    avatar: string | null;
    CourseTA?: {
        assigned_at?: string;
        permissions?: CourseMemberPermissions;
    };
}

interface Course {
    instructor?: Instructor | null;
    instructors?: Instructor[];
    tas?: TA[];
}

interface EditableMember {
    type: "instructor" | "ta";
    personId: number;
    full_name: string;
    isPrimary: boolean;
    permissions: CourseMemberPermissions;
}

interface PeopleTabProps {
    course: Course;
    isLoading: boolean;
    isPeopleLoading: boolean;
    onOpenAddTAModal: () => void;
    onOpenAddInstructorModal: () => void;
    onRemoveTA: (taId: number) => void;
    onRemoveInstructor: (instructorId: number) => void;
    onUpdatePermissions: (memberType: "instructor" | "ta", userId: number, permissions: CourseMemberPermissions) => Promise<boolean>;
    userRole: string;
    currentUserId: number | null;
    canViewPeople: boolean;
    canAddPeople: boolean;
    canRemovePeople: boolean;
    canEditMemberPermissions: boolean;
    isCourseActive?: boolean;
}

function PeopleTableSkeleton() {
    return (
        <Card className="border border-default-200 shadow-sm">
            <CardBody className="p-2">
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-3">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="w-32 h-4 rounded-lg" />
                                <Skeleton className="w-48 h-3 rounded-lg" />
                            </div>
                            <Skeleton className="w-36 h-6 rounded-full" />
                        </div>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
}

function getPermissionSections(isEnglish: boolean): Array<{
    title: string;
    items: Array<{ key: keyof CourseMemberPermissions; label: string; description: string }>;
}> {
    return [
        {
            title: isEnglish ? "People and course structure" : "บุคลากรและโครงสร้างรายวิชา",
            items: [
                { key: "update_course", label: isEnglish ? "Edit course details" : "แก้ไขข้อมูลรายวิชา", description: isEnglish ? "Update course settings such as code, name, semester, cover image, and attention threshold." : "แก้ไขการตั้งค่ารายวิชา เช่น รหัสวิชา ชื่อวิชา ภาคการศึกษา รูปปก และเกณฑ์แจ้งเตือน" },
                { key: "view_people", label: isEnglish ? "View people" : "ดูรายชื่อบุคลากร", description: isEnglish ? "Open the People tab and view instructors or TAs in this course." : "เปิดแท็บบุคลากรและดูรายชื่ออาจารย์หรือ TA ในรายวิชา" },
                { key: "add_people", label: isEnglish ? "Add people" : "เพิ่มบุคลากร", description: isEnglish ? "Add instructors or teaching assistants to this course." : "เพิ่มอาจารย์ผู้สอนหรือผู้ช่วยสอนเข้าสู่รายวิชา" },
                { key: "remove_people", label: isEnglish ? "Remove people" : "นำบุคลากรออก", description: isEnglish ? "Remove instructors or TAs from this course." : "ลบอาจารย์หรือ TA ออกจากรายวิชา" },
                { key: "edit_member_permissions", label: isEnglish ? "Edit member permissions" : "แก้สิทธิ์บุคลากร", description: isEnglish ? "Adjust permissions for individual instructors or TAs." : "ปรับสิทธิ์ของอาจารย์หรือ TA รายคน" },
                { key: "view_sections", label: isEnglish ? "View sections" : "ดูกลุ่มเรียน", description: isEnglish ? "View sections and the students assigned to them." : "ดูรายการกลุ่มเรียนและรายชื่อนักศึกษาในกลุ่ม" },
                { key: "create_sections", label: isEnglish ? "Create sections" : "สร้างกลุ่มเรียน", description: isEnglish ? "Create new sections in this course." : "เพิ่มกลุ่มเรียนใหม่ในรายวิชา" },
                { key: "update_sections", label: isEnglish ? "Edit sections" : "แก้ไขกลุ่มเรียน", description: isEnglish ? "Update section names or details." : "แก้ชื่อหรือข้อมูลของกลุ่มเรียน" },
                { key: "delete_sections", label: isEnglish ? "Delete sections" : "ลบกลุ่มเรียน", description: isEnglish ? "Remove sections from this course." : "ลบกลุ่มเรียนออกจากรายวิชา" },
                { key: "manage_section_students", label: isEnglish ? "Manage section students" : "จัดการนักศึกษาในกลุ่มเรียน", description: isEnglish ? "Add, move, remove, and restore students in sections." : "เพิ่ม ย้าย ลบ และกู้คืนนักศึกษาในกลุ่มเรียน" },
            ],
        },
        {
            title: isEnglish ? "Teams, classwork, and scores" : "กลุ่มงาน งานชั้นเรียน และคะแนน",
            items: [
                { key: "view_teams", label: isEnglish ? "View teams" : "ดูกลุ่มงาน", description: isEnglish ? "View permanent or weekly teams." : "ดูทีมถาวรหรือทีมรายสัปดาห์" },
                { key: "create_teams", label: isEnglish ? "Create teams" : "สร้างกลุ่มงาน", description: isEnglish ? "Create permanent or weekly teams." : "สร้างทีมถาวรหรือทีมรายสัปดาห์" },
                { key: "update_teams", label: isEnglish ? "Edit teams" : "แก้ไขกลุ่มงาน", description: isEnglish ? "Rename teams or copy them across weeks." : "เปลี่ยนชื่อทีม หรือคัดลอกทีมข้ามสัปดาห์" },
                { key: "delete_teams", label: isEnglish ? "Delete teams" : "ลบกลุ่มงาน", description: isEnglish ? "Delete individual or group teams." : "ลบทีมรายบุคคลหรือแบบกลุ่ม" },
                { key: "manage_team_members", label: isEnglish ? "Manage team members" : "จัดการสมาชิกในกลุ่มงาน", description: isEnglish ? "Add or remove members from teams." : "เพิ่มหรือนำสมาชิกออกจากทีม" },
                { key: "view_assignments", label: isEnglish ? "View classwork" : "ดูงานในชั้นเรียน", description: isEnglish ? "View assignments, details, and ordering." : "ดูรายการงาน รายละเอียดงาน และลำดับงาน" },
                { key: "create_assignments", label: isEnglish ? "Create assignments" : "สร้างงาน", description: isEnglish ? "Create assignments or topics in classwork." : "สร้างงานหรือหัวข้อใหม่ในชั้นเรียน" },
                { key: "update_assignments", label: isEnglish ? "Edit assignments" : "แก้ไขงาน", description: isEnglish ? "Edit assignments, reorder items, and link attendance." : "แก้ไขงาน ปรับลำดับ และเชื่อม attendance กับงาน" },
                { key: "delete_assignments", label: isEnglish ? "Delete assignments" : "ลบงาน", description: isEnglish ? "Delete classwork assignments." : "ลบงานในชั้นเรียน" },
                { key: "grade_assignments", label: isEnglish ? "Grade assignments" : "ให้คะแนนงาน", description: isEnglish ? "Open work and save individual or group scores." : "เปิดดูงานและบันทึกคะแนนรายคนหรือรายกลุ่ม" },
                { key: "edit_scores", label: isEnglish ? "Edit scores" : "แก้ไขคะแนน", description: isEnglish ? "Edit scores and submit score-edit requests." : "แก้คะแนนและส่งคำร้องแก้ไขคะแนน" },
                { key: "view_score_summary", label: isEnglish ? "View score summary" : "ดูสรุปคะแนน", description: isEnglish ? "View score summaries, matrices, and grading stats." : "ดู score summary, matrix และสถิติการให้คะแนน" },
                { key: "review_own_score_requests", label: isEnglish ? "Review own score requests" : "ดูคำร้องคะแนนของตนเอง", description: isEnglish ? "See the status of requests you submitted or oversee." : "ดูสถานะคำร้องที่ตนเองเป็นผู้ส่งหรือดูแล" },
                { key: "review_all_score_requests", label: isEnglish ? "Review all score requests" : "อนุมัติคำร้องคะแนนทั้งหมด", description: isEnglish ? "Review and approve all score requests like an instructor." : "ตรวจและอนุมัติคำร้องคะแนนได้แบบเดียวกับอาจารย์" },
            ],
        },
        {
            title: isEnglish ? "Exam scores, attendance, and queue" : "คะแนนสอบ เช็กชื่อ และคิว",
            items: [
                { key: "view_exam_scores", label: isEnglish ? "View exam scores" : "ดูคะแนนสอบ", description: isEnglish ? "Open exam score data and statistics." : "เปิดดูข้อมูลคะแนนสอบและสถิติ" },
                { key: "create_exam_scores", label: isEnglish ? "Add exam scores" : "เพิ่มคะแนนสอบ", description: isEnglish ? "Add new exam scores to the system." : "เพิ่มคะแนนสอบใหม่เข้าระบบ" },
                { key: "update_exam_scores", label: isEnglish ? "Edit exam scores" : "แก้ไขคะแนนสอบ", description: isEnglish ? "Edit existing exam scores." : "แก้ไขคะแนนสอบที่มีอยู่แล้ว" },
                { key: "delete_exam_scores", label: isEnglish ? "Delete exam scores" : "ลบคะแนนสอบ", description: isEnglish ? "Delete exam score records." : "ลบข้อมูลคะแนนสอบ" },
                { key: "update_exam_settings", label: isEnglish ? "Edit exam settings" : "แก้การตั้งค่าคะแนนสอบ", description: isEnglish ? "Adjust exam settings or score weighting." : "ปรับ exam settings หรือสัดส่วนคะแนนสอบ" },
                { key: "view_attendance", label: isEnglish ? "View attendance" : "ดูข้อมูลเช็กชื่อ", description: isEnglish ? "View attendance sessions and records." : "ดู session เช็กชื่อและรายการเข้าเรียน" },
                { key: "create_attendance_sessions", label: isEnglish ? "Create attendance sessions" : "สร้าง session เช็กชื่อ", description: isEnglish ? "Create new attendance sessions." : "สร้าง session เช็กชื่อใหม่" },
                { key: "update_attendance_sessions", label: isEnglish ? "Edit attendance sessions" : "แก้ session เช็กชื่อ", description: isEnglish ? "Adjust time, status, and attendance session details." : "ปรับเวลา เปิด ปิด และแก้ session เช็กชื่อ" },
                { key: "delete_attendance_sessions", label: isEnglish ? "Delete attendance sessions" : "ลบ session เช็กชื่อ", description: isEnglish ? "Delete attendance sessions." : "ลบ session เช็กชื่อ" },
                { key: "update_attendance_status", label: isEnglish ? "Update attendance status" : "แก้สถานะเช็กชื่อ", description: isEnglish ? "Update attendance status per student or in bulk." : "อัปเดตสถานะการเข้าเรียนรายคนหรือแบบกลุ่ม" },
                { key: "view_queue", label: isEnglish ? "View review queue" : "ดูคิวตรวจงาน", description: isEnglish ? "View queue sessions, workers, and bookings." : "ดู session คิว รายชื่อ worker และรายการจองคิว" },
                { key: "create_queue_sessions", label: isEnglish ? "Create review queues" : "สร้างคิวตรวจงาน", description: isEnglish ? "Create new queue sessions." : "สร้าง session คิวตรวจงานใหม่" },
                { key: "update_queue_sessions", label: isEnglish ? "Edit review queues" : "แก้คิวตรวจงาน", description: isEnglish ? "Edit queue sessions, open/close state, breaks, and workers." : "แก้ session คิว เปิด ปิด หยุดพัก และจัดการ worker" },
                { key: "delete_queue_sessions", label: isEnglish ? "Delete review queues" : "ลบคิวตรวจงาน", description: isEnglish ? "Delete queue sessions." : "ลบ session คิวตรวจงาน" },
                { key: "manage_queue_bookings", label: isEnglish ? "Manage queue bookings" : "จัดการรายการจองคิว", description: isEnglish ? "Take work, skip, close, and manage bookings." : "รับงาน ข้ามคิว ปิดงาน และจัดการ booking" },
            ],
        },
    ];
}

function getPermissionPresets(isEnglish: boolean): Array<{
    id: CoursePermissionPreset;
    label: string;
    description: string;
    roles?: Array<EditableMember["type"]>;
}> {
    return [
        {
            id: "view_only",
            label: isEnglish ? "View only" : "ดูอย่างเดียว",
            description: isEnglish ? "Can open tabs and view information, but cannot make changes." : "เข้าแท็บและดูข้อมูลได้ แต่แก้ไขอะไรไม่ได้",
        },
        {
            id: "ta_standard",
            label: isEnglish ? "Standard TA" : "ช่วยสอนปกติ",
            description: isEnglish ? "Suitable for TAs who review work, scores, and queue items." : "เหมาะกับ TA ที่ช่วยเช็กงาน ดูคะแนน และดูคิว",
            roles: ["ta"],
        },
        {
            id: "course_coordinator",
            label: isEnglish ? "Course coordinator" : "ผู้ประสานงานรายวิชา",
            description: isEnglish ? "Can manage most teaching operations, except course ownership." : "ดูแลการสอนเกือบทั้งหมด ยกเว้นการเป็นเจ้าของวิชา",
        },
    ];
}

function summarizePermissions(permissions: CourseMemberPermissions, isEnglish: boolean) {
    const labels = [
        permissions.update_course ? (isEnglish ? "Course settings" : "แก้ไขรายวิชา") : null,
        permissions.view_people || permissions.add_people || permissions.remove_people || permissions.edit_member_permissions ? (isEnglish ? "People" : "บุคลากร") : null,
        permissions.view_sections || permissions.create_sections || permissions.update_sections || permissions.delete_sections || permissions.manage_section_students ? (isEnglish ? "Sections" : "กลุ่มเรียน") : null,
        permissions.view_teams || permissions.create_teams || permissions.update_teams || permissions.delete_teams || permissions.manage_team_members ? (isEnglish ? "Teams" : "กลุ่มงาน") : null,
        permissions.view_assignments || permissions.create_assignments || permissions.update_assignments || permissions.delete_assignments ? (isEnglish ? "Classwork" : "งาน") : null,
        permissions.grade_assignments ? (isEnglish ? "Grading" : "ให้คะแนน") : null,
        permissions.edit_scores ? (isEnglish ? "Score edits" : "แก้คะแนน") : null,
        permissions.view_score_summary ? (isEnglish ? "Score summary" : "สรุปคะแนน") : null,
        permissions.review_all_score_requests ? (isEnglish ? "All score requests" : "อนุมัติคำร้อง") : permissions.review_own_score_requests ? (isEnglish ? "Own score requests" : "ดูคำร้องตนเอง") : null,
        permissions.view_exam_scores || permissions.create_exam_scores || permissions.update_exam_scores || permissions.delete_exam_scores || permissions.update_exam_settings ? (isEnglish ? "Exam scores" : "คะแนนสอบ") : null,
        permissions.view_attendance || permissions.create_attendance_sessions || permissions.update_attendance_sessions || permissions.delete_attendance_sessions || permissions.update_attendance_status ? (isEnglish ? "Attendance" : "เช็กชื่อ") : null,
        permissions.view_queue || permissions.create_queue_sessions || permissions.update_queue_sessions || permissions.delete_queue_sessions || permissions.manage_queue_bookings ? (isEnglish ? "Queue" : "คิว") : null,
    ].filter((value): value is string => Boolean(value));

    const values = Object.values(permissions) as boolean[];
    const enabledCount = values.filter(Boolean).length;
    const totalCount = values.length;

    return {
        labels: labels.slice(0, 3),
        remaining: Math.max(0, labels.length - 3),
        total: labels.length,
        enabledCount,
        totalCount,
    };
}

export default function PeopleTab({
    course,
    isLoading,
    isPeopleLoading,
    onOpenAddTAModal,
    onOpenAddInstructorModal,
    onRemoveTA,
    onRemoveInstructor,
    onUpdatePermissions,
    userRole,
    currentUserId,
    canViewPeople,
    canAddPeople,
    canRemovePeople,
    canEditMemberPermissions,
    isCourseActive = true,
}: PeopleTabProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);
    // Pin the actions column so it stays visible when the table scrolls sideways.
    const { scrollRef, hasOverflow } = useHorizontalOverflow();
    const [editingMember, setEditingMember] = useState<EditableMember | null>(null);
    const [draftPermissions, setDraftPermissions] = useState<CourseMemberPermissions | null>(null);
    const [originalDraftPermissions, setOriginalDraftPermissions] = useState<CourseMemberPermissions | null>(null);
    const [isSavingPermissions, setIsSavingPermissions] = useState(false);
    const permissionSections = useMemo(() => getPermissionSections(isEnglish), [isEnglish]);
    const permissionPresets = useMemo(() => getPermissionPresets(isEnglish), [isEnglish]);

    const instructorsCount = course.instructors?.length || (course.instructor ? 1 : 0);
    const instructorsList = course.instructors || (course.instructor ? [course.instructor] : []);

    const allPeople = useMemo(() => [
        ...instructorsList.map((instructor) => ({
            id: `instructor-${instructor.id}`,
            type: "instructor" as const,
            personId: instructor.id,
            full_name: instructor.full_name,
            email: instructor.email || instructor.username || "-",
            avatar: instructor.avatar,
            isPrimary: instructor.CourseInstructor?.is_primary || false,
            permissions: resolveCourseMemberPermissions(
                "instructor",
                instructor.CourseInstructor?.permissions,
                instructor.CourseInstructor?.is_primary,
            ),
        })),
        ...(course.tas?.map((ta) => ({
            id: `ta-${ta.id}`,
            type: "ta" as const,
            personId: ta.id,
            full_name: ta.full_name,
            email: ta.email || ta.username || "-",
            avatar: ta.avatar,
            isPrimary: false,
            permissions: resolveCourseMemberPermissions("ta", ta.CourseTA?.permissions),
        })) || []),
    ], [course.tas, instructorsList]);

    const totalPages = Math.max(1, Math.ceil(allPeople.length / rowsPerPage));
    const paginatedPeople = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return allPeople.slice(start, start + rowsPerPage);
    }, [allPeople, currentPage, rowsPerPage]);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage(1);
    }, [rowsPerPage]);

    useEffect(() => {
        if (editingMember) {
            setDraftPermissions(editingMember.permissions);
            setOriginalDraftPermissions(editingMember.permissions);
        } else {
            setDraftPermissions(null);
            setOriginalDraftPermissions(null);
        }
    }, [editingMember]);

    const openPermissionEditor = (member: EditableMember) => {
        setEditingMember(member);
    };

    const updateDraftPermission = (key: keyof CourseMemberPermissions, value: boolean) => {
        setDraftPermissions((current) => {
            if (!current) return current;

            const next = { ...current, [key]: value };

            if (key === "review_all_score_requests" && value) {
                next.review_own_score_requests = true;
            }
            if (key === "review_own_score_requests" && !value) {
                next.review_all_score_requests = false;
            }
            if (key === "add_people" || key === "remove_people" || key === "edit_member_permissions") next.view_people = true;
            if (key === "view_people" && !value) {
                next.add_people = false;
                next.remove_people = false;
                next.edit_member_permissions = false;
            }
            if (key === "create_sections" || key === "update_sections" || key === "delete_sections" || key === "manage_section_students") next.view_sections = true;
            if (key === "view_sections" && !value) {
                next.create_sections = false;
                next.update_sections = false;
                next.delete_sections = false;
                next.manage_section_students = false;
            }
            if (key === "create_teams" || key === "update_teams" || key === "delete_teams" || key === "manage_team_members") next.view_teams = true;
            if (key === "view_teams" && !value) {
                next.create_teams = false;
                next.update_teams = false;
                next.delete_teams = false;
                next.manage_team_members = false;
            }
            if (key === "create_assignments" || key === "update_assignments" || key === "delete_assignments" || key === "grade_assignments" || key === "edit_scores") next.view_assignments = true;
            if (key === "view_assignments" && !value) {
                next.create_assignments = false;
                next.update_assignments = false;
                next.delete_assignments = false;
                next.grade_assignments = false;
                next.edit_scores = false;
            }
            if (key === "create_exam_scores" || key === "update_exam_scores" || key === "delete_exam_scores" || key === "update_exam_settings") next.view_exam_scores = true;
            if (key === "view_exam_scores" && !value) {
                next.create_exam_scores = false;
                next.update_exam_scores = false;
                next.delete_exam_scores = false;
                next.update_exam_settings = false;
            }
            if (key === "create_attendance_sessions" || key === "update_attendance_sessions" || key === "delete_attendance_sessions" || key === "update_attendance_status") next.view_attendance = true;
            if (key === "view_attendance" && !value) {
                next.create_attendance_sessions = false;
                next.update_attendance_sessions = false;
                next.delete_attendance_sessions = false;
                next.update_attendance_status = false;
            }
            if (key === "create_queue_sessions" || key === "update_queue_sessions" || key === "delete_queue_sessions" || key === "manage_queue_bookings") next.view_queue = true;
            if (key === "view_queue" && !value) {
                next.create_queue_sessions = false;
                next.update_queue_sessions = false;
                next.delete_queue_sessions = false;
                next.manage_queue_bookings = false;
            }

            return next;
        });
    };

    const hasPermissionChanges = () => {
        if (!originalDraftPermissions || !draftPermissions) return false;
        return JSON.stringify(draftPermissions) !== JSON.stringify(originalDraftPermissions);
    };

    const handleSavePermissions = async () => {
        if (!editingMember || !draftPermissions) return;
        setIsSavingPermissions(true);
        const success = await onUpdatePermissions(editingMember.type, editingMember.personId, draftPermissions);
        setIsSavingPermissions(false);
        if (success) {
            setEditingMember(null);
        }
    };

    const applyPermissionPreset = (preset: CoursePermissionPreset) => {
        if (!editingMember) return;
        setDraftPermissions(buildCoursePermissionPreset(editingMember.type, preset));
    };

    const arePermissionsEqual = (a: CourseMemberPermissions, b: CourseMemberPermissions) => {
        const keys = Object.keys(a) as Array<keyof CourseMemberPermissions>;
        return keys.every((key) => a[key] === b[key]);
    };

    const activePresetId = useMemo<CoursePermissionPreset | null>(() => {
        if (!editingMember || !draftPermissions) return null;
        for (const preset of permissionPresets) {
            if (preset.roles && !preset.roles.includes(editingMember.type)) continue;
            const built = buildCoursePermissionPreset(editingMember.type, preset.id);
            if (arePermissionsEqual(built, draftPermissions)) return preset.id;
        }
        return null;
    }, [draftPermissions, editingMember, permissionPresets]);

    const toggleSectionPermissions = (
        items: Array<{ key: keyof CourseMemberPermissions }>,
        value: boolean,
    ) => {
        setDraftPermissions((current) => {
            if (!current) return current;
            const next = { ...current };
            items.forEach((item) => {
                next[item.key] = value;
            });
            if (!value) {
                if (items.some((item) => item.key === "view_people")) {
                    next.add_people = false;
                    next.remove_people = false;
                    next.edit_member_permissions = false;
                }
                if (items.some((item) => item.key === "view_sections")) {
                    next.create_sections = false;
                    next.update_sections = false;
                    next.delete_sections = false;
                    next.manage_section_students = false;
                }
                if (items.some((item) => item.key === "view_teams")) {
                    next.create_teams = false;
                    next.update_teams = false;
                    next.delete_teams = false;
                    next.manage_team_members = false;
                }
                if (items.some((item) => item.key === "view_assignments")) {
                    next.create_assignments = false;
                    next.update_assignments = false;
                    next.delete_assignments = false;
                    next.grade_assignments = false;
                    next.edit_scores = false;
                }
                if (items.some((item) => item.key === "view_exam_scores")) {
                    next.create_exam_scores = false;
                    next.update_exam_scores = false;
                    next.delete_exam_scores = false;
                    next.update_exam_settings = false;
                }
                if (items.some((item) => item.key === "view_attendance")) {
                    next.create_attendance_sessions = false;
                    next.update_attendance_sessions = false;
                    next.delete_attendance_sessions = false;
                    next.update_attendance_status = false;
                }
                if (items.some((item) => item.key === "view_queue")) {
                    next.create_queue_sessions = false;
                    next.update_queue_sessions = false;
                    next.delete_queue_sessions = false;
                    next.manage_queue_bookings = false;
                }
                if (items.some((item) => item.key === "review_own_score_requests")) {
                    next.review_all_score_requests = false;
                }
            }
            return next;
        });
    };

    const canRemoveInstructor = (personId: number, isPrimary: boolean) => {
        if (!canRemovePeople || !isCourseActive) return false;
        if (isPrimary) return false;
        if (personId === currentUserId) return false;
        return true;
    };

    const canRemoveTA = (personId: number) => {
        if (!canRemovePeople || !isCourseActive) return false;
        if (personId === currentUserId) return false;
        return true;
    };

    const canEditTAPermissions = (personId: number) => {
        if (!canEditMemberPermissions || !isCourseActive) return false;
        if (userRole === "ta" && personId === currentUserId) return false;
        return true;
    };

    const showPermissionColumn = userRole !== "ta";
    const canAddInstructor = canAddPeople && userRole !== "ta";
    const canAddTA = canAddPeople;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{isEnglish ? "Course people" : "บุคลากรในรายวิชา"}</h2>
                    <p className="text-sm text-default-500">{isEnglish ? "Add course staff and define what each person can manage in this course." : "เพิ่มบุคลากรและกำหนดขอบเขตงานของแต่ละคนในรายวิชา"}</p>
                </div>

                {(canAddInstructor || canAddTA) && (
                    <div className="flex gap-2">
                        {canAddInstructor && (
                            <Button
                                color="secondary"
                                variant="flat"
                                onPress={onOpenAddInstructorModal}
                                isDisabled={isPeopleLoading || !isCourseActive}
                                className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                            >
                                {isEnglish ? "Add instructor" : "เพิ่มอาจารย์"}
                            </Button>
                        )}
                        {canAddTA && (
                            <Button
                                color="primary"
                                onPress={onOpenAddTAModal}
                                isDisabled={isPeopleLoading || !isCourseActive}
                                className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                            >
                                {isEnglish ? "Add teaching assistant" : "เพิ่มผู้ช่วยสอน"}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {isLoading ? (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="border border-default-200 shadow-sm">
                                <CardBody className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="w-12 h-12 rounded-xl" />
                                        <div className="space-y-2">
                                            <Skeleton className="w-20 h-3 rounded-lg" />
                                            <Skeleton className="w-8 h-6 rounded-lg" />
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                    <PeopleTableSkeleton />
                </>
            ) : (
                <>
                    <div className="hidden md:grid grid-cols-2 md:grid-cols-3 gap-3">
                        <Card className="border border-default-200 shadow-sm">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-100 rounded-xl">
                                        <Icon icon="solar:users-group-rounded-bold" className="text-2xl text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-default-500">{isEnglish ? "Total people" : "บุคลากรทั้งหมด"}</p>
                                        <p className="text-2xl font-bold text-foreground">{instructorsCount + (course.tas?.length || 0)}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="border border-default-200 shadow-sm">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-100 rounded-xl">
                                        <Icon icon="solar:user-circle-bold" className="text-2xl text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-default-500">{isEnglish ? "Instructors" : "อาจารย์ผู้สอน"}</p>
                                        <p className="text-2xl font-bold text-foreground">{instructorsCount}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="border border-default-200 shadow-sm">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-100 rounded-xl">
                                        <Icon icon="solar:user-hands-bold" className="text-2xl text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-default-500">{isEnglish ? "Teaching assistants" : "ผู้ช่วยสอน (TA)"}</p>
                                        <p className="text-2xl font-bold text-foreground">{course.tas?.length || 0}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    <Card className="border border-default-200 shadow-sm">
                        <CardBody className="p-2">
                            <div
                                ref={scrollRef}
                                data-overflow={hasOverflow ? "true" : "false"}
                                className={STICKY_SCROLL_CONTAINER_CLASS}
                            >
                                <Table
                                    aria-label="People table"
                                    removeWrapper
                                    classNames={{
                                        base: "min-w-[860px]",
                                        th: "bg-content2 text-default-600 font-semibold text-sm whitespace-nowrap",
                                        td: "py-3 align-top",
                                    }}
                                >
                                    <TableHeader>
                                        <TableColumn className="min-w-45">{isEnglish ? "Full name" : "ชื่อ-นามสกุล"}</TableColumn>
                                        <TableColumn className="min-w-45">{isEnglish ? "Email / username" : "อีเมล / Username"}</TableColumn>
                                        <TableColumn className="min-w-35">{isEnglish ? "Role" : "บทบาท"}</TableColumn>
                                        <TableColumn className={showPermissionColumn ? "min-w-55" : "hidden"}>{isEnglish ? "Course permissions" : "สิทธิ์ในรายวิชา"}</TableColumn>
                                        <TableColumn align="center" className={`${STICKY_ACTION_HEADER_CLASS} min-w-30`}>{isEnglish ? "Actions" : "จัดการ"}</TableColumn>
                                    </TableHeader>
                                    <TableBody emptyContent={
                                        <div className="py-10 text-center">
                                                <Icon icon="solar:users-group-rounded-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                                                <p className="text-default-400">{isEnglish ? "No people in this course yet." : "ยังไม่มีบุคลากรในรายวิชานี้"}</p>
                                        </div>
                                    }>
                                        {paginatedPeople.map((person) => {
                                            const summary = summarizePermissions(person.permissions, isEnglish);
                                            return (
                                                <TableRow key={person.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar
                                                                name={person.full_name}
                                                                src={person.avatar || undefined}
                                                                size="sm"
                                                                className={person.type === "instructor"
                                                                    ? "bg-linear-to-br from-blue-500 to-indigo-500 shrink-0"
                                                                    : "bg-linear-to-br from-emerald-500 to-teal-500 shrink-0"
                                                                }
                                                            />
                                                            <div>
                                                                    <p className="font-medium text-foreground">{person.full_name}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                            <span className="text-default-600">{person.email}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {person.type === "instructor" ? (
                                                                <>
                                                                    <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700">
                                                                        {isEnglish ? "Instructor" : "อาจารย์ผู้สอน"}
                                                                    </Chip>
                                                                    {person.isPrimary && (
                                                                        <Chip
                                                                            size="sm"
                                                                            variant="flat"
                                                                            className="bg-amber-100 text-amber-700"
                                                                            startContent={<Icon icon="solar:crown-bold" className="text-xs" />}
                                                                        >
                                                                            {isEnglish ? "Lead instructor" : "เจ้าของวิชา"}
                                                                        </Chip>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <Chip size="sm" variant="flat" className="bg-emerald-100 text-emerald-700">
                                                                    {isEnglish ? "Teaching assistant" : "ผู้ช่วยสอน"}
                                                                </Chip>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={showPermissionColumn ? undefined : "hidden"}>
                                                        <div className="space-y-2">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {summary.labels.map((label) => (
                                                                    <Chip key={label} size="sm" variant="flat" className="bg-content3 text-default-700">
                                                                        {label}
                                                                    </Chip>
                                                                ))}
                                                                {summary.remaining > 0 && (
                                                                    <Chip size="sm" variant="flat" className="bg-content4 text-default-700">
                                                                        +{summary.remaining}
                                                                    </Chip>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-default-500">{isEnglish ? `Enabled ${summary.enabledCount} of ${summary.totalCount} permissions` : `เปิดใช้งาน ${summary.enabledCount} จาก ${summary.totalCount} สิทธิ์`}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={STICKY_ACTION_CELL_CLASS}>
                                                        <div className="flex items-center justify-center gap-1">
                                                            {canViewPeople ? (
                                                                <>
                                                                    {person.type === "instructor" ? (
                                                                        // <Tooltip content="สิทธิ์ของอาจารย์ประจำวิชาแก้ไขไม่ได้">
                                                                        //     <span className="text-slate-300 p-2">
                                                                        //         <Icon icon="solar:lock-keyhole-bold" className="text-xl" />
                                                                        //     </span>
                                                                        // </Tooltip>
                                                                        <></>
                                                                    ) : canEditTAPermissions(person.personId) ? (
                                                                        <Tooltip content={isEnglish ? "Configure permissions" : "ตั้งค่าสิทธิ์"}>
                                                                            <Button
                                                                                isIconOnly
                                                                                size="sm"
                                                                                variant="light"
                                                                                color="primary"
                                                                                isDisabled={!isCourseActive}
                                                                                onPress={() => openPermissionEditor(person)}
                                                                            >
                                                                                <Icon icon="solar:settings-bold" className="text-xl" />
                                                                            </Button>
                                                                        </Tooltip>
                                                                    ) : (
                                                                        <Tooltip content={userRole === "ta" && person.personId === currentUserId ? (isEnglish ? "Teaching assistants cannot edit their own permissions." : "ผู้ช่วยสอนไม่สามารถแก้สิทธิ์ของตัวเองได้") : (isEnglish ? "This account cannot edit course member permissions." : "บัญชีนี้ไม่มีสิทธิ์แก้ permission บุคลากร")}>
                                                                            <span className="p-2 text-default-300">
                                                                                <Icon icon="solar:lock-keyhole-bold" className="text-xl" />
                                                                            </span>
                                                                        </Tooltip>
                                                                    )}

                                                                    {person.type === "instructor" ? (
                                                                        canRemoveInstructor(person.personId, person.isPrimary) ? (
                                                                            <Tooltip content={isEnglish ? "Remove from course" : "ลบออกจากรายวิชา"} color="danger">
                                                                                <Button
                                                                                    isIconOnly
                                                                                    size="sm"
                                                                                    variant="light"
                                                                                    color="danger"
                                                                                    isDisabled={!isCourseActive}
                                                                                    onPress={() => onRemoveInstructor(person.personId)}
                                                                                >
                                                                                    <Icon icon="solar:trash-bin-trash-bold" className="text-xl" />
                                                                                </Button>
                                                                            </Tooltip>
                                                                        ) : (
                                                                            <Tooltip content={person.isPrimary ? (isEnglish ? "The lead instructor cannot be removed." : "อาจารย์เจ้าของวิชาไม่สามารถลบออกได้") : (isEnglish ? "You cannot remove yourself." : "ไม่สามารถลบตัวเองออกได้")}>
                                                                                <span className="p-2 text-default-300">
                                                                                    <Icon icon="solar:lock-keyhole-bold" className="text-xl" />
                                                                                </span>
                                                                            </Tooltip>
                                                                        )
                                                                    ) : canRemoveTA(person.personId) ? (
                                                                        <Tooltip content={isEnglish ? "Remove from course" : "ลบออกจากรายวิชา"} color="danger">
                                                                            <Button
                                                                                isIconOnly
                                                                                size="sm"
                                                                                variant="light"
                                                                                color="danger"
                                                                                isDisabled={!isCourseActive}
                                                                                onPress={() => onRemoveTA(person.personId)}
                                                                            >
                                                                                <Icon icon="solar:trash-bin-trash-bold" className="text-xl" />
                                                                            </Button>
                                                                        </Tooltip>
                                                                    ) : (
                                                                        // <Tooltip content={person.personId === currentUserId ? "ไม่สามารถลบตัวเองออกได้" : "บัญชีนี้ไม่มีสิทธิ์นำผู้ช่วยสอนออก"}>
                                                                        //     <span className="text-slate-300 p-2">
                                                                        //         <Icon icon="solar:lock-keyhole-bold" className="text-xl" />
                                                                        //     </span>
                                                                        // </Tooltip>
                                                                        <></>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <Tooltip content={isEnglish ? "This account cannot manage course people." : "บัญชีนี้ไม่มีสิทธิ์จัดการบุคลากร"}>
                                                                    <span className="p-2 text-default-300">
                                                                        <Icon icon="solar:lock-keyhole-bold" className="text-xl" />
                                                                    </span>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {allPeople.length > 0 && (
                                <TablePaginationFooter
                                    totalItems={allPeople.length}
                                    currentPage={currentPage}
                                    rowsPerPage={rowsPerPage}
                                    totalPages={totalPages}
                                    isEnglish={isEnglish}
                                    nounEnglish="person"
                                    nounEnglishPlural="people"
                                    nounThai="คน"
                                    onPageChange={setCurrentPage}
                                    onRowsPerPageChange={setRowsPerPage}
                                />
                            )}
                        </CardBody>
                    </Card>

                    {instructorsCount === 0 && (!course.tas || course.tas.length === 0) && (
                        <Card className="border border-dashed border-default-300 bg-content2/50 shadow-sm">
                            <CardBody className="text-center py-16">
                                <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                                    <Icon icon="solar:users-group-rounded-bold-duotone" className="text-5xl text-blue-500" />
                                </div>
                                <h3 className="mb-2 text-lg font-semibold text-default-700">{isEnglish ? "No people yet" : "ยังไม่มีบุคลากร"}</h3>
                                <p className="mx-auto mb-6 max-w-md text-default-500">{isEnglish ? "Add instructors or teaching assistants to help manage the course and assign responsibilities." : "เพิ่มอาจารย์หรือผู้ช่วยสอนเพื่อช่วยจัดการรายวิชาและมอบหมายสิทธิ์ได้ตามงานที่ต้องรับผิดชอบ"}</p>
                                {(canAddInstructor || canAddTA) && (
                                    <div className="flex gap-2 justify-center">
                                        {canAddInstructor && (
                                            <Button
                                                color="secondary"
                                                variant="flat"
                                                onPress={onOpenAddInstructorModal}
                                                className="bg-indigo-100 text-indigo-700"
                                            >
                                                {isEnglish ? "Add instructor" : "เพิ่มอาจารย์"}
                                            </Button>
                                        )}
                                        {canAddTA && (
                                            <Button
                                                color="primary"
                                                onPress={onOpenAddTAModal}
                                                className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                                            >
                                                {isEnglish ? "Add teaching assistant" : "เพิ่มผู้ช่วยสอน"}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    )}
                </>
            )}

            <Modal isOpen={!!editingMember} onClose={() => setEditingMember(null)} size="3xl" scrollBehavior="inside">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <span>{isEnglish ? "Course permissions" : "สิทธิ์ในรายวิชา"}</span>
                        <span className="text-sm font-normal text-default-500">{editingMember?.full_name}</span>
                    </ModalHeader>
                    <ModalBody>
                        {draftPermissions && editingMember && (
                            <div className="space-y-5">
                                <div className="rounded-xl border border-default-200 bg-content2 p-4">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{isEnglish ? "Current role" : "บทบาทปัจจุบัน"}</p>
                                            <p className="text-sm text-default-500">
                                                {editingMember.type === "instructor"
                                                    ? (isEnglish ? "Instructor" : "อาจารย์ผู้สอน")
                                                    : (isEnglish ? "Teaching assistant" : "ผู้ช่วยสอน")}
                                            </p>
                                        </div>
                                        {(() => {
                                            const s = summarizePermissions(draftPermissions, isEnglish);
                                            return (
                                                <Chip size="sm" variant="flat" className="bg-content4 text-default-700">
                                                    {isEnglish
                                                        ? `Enabled ${s.enabledCount} of ${s.totalCount} permissions`
                                                        : `เปิดใช้งาน ${s.enabledCount} จาก ${s.totalCount} สิทธิ์`}
                                                </Chip>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-700/30 dark:bg-blue-950/20">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Icon icon="solar:magic-stick-3-bold" className="text-blue-500 dark:text-blue-300" />
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{isEnglish ? "Permission presets" : "Preset สิทธิ์"}</p>
                                            <p className="text-xs text-default-500">{isEnglish ? "Start from a preset, then fine-tune the details if needed." : "เลือกชุดสิทธิ์เริ่มต้นแล้วค่อยปรับจุดย่อยต่อได้"}</p>
                                        </div>
                                    </div>
                                    <div className="grid gap-2 md:grid-cols-3">
                                        {permissionPresets
                                            .filter((preset) => !preset.roles || preset.roles.includes(editingMember.type))
                                            .map((preset) => {
                                                const isActive = activePresetId === preset.id;
                                                return (
                                                    <Button
                                                        key={preset.id}
                                                        variant="flat"
                                                        className={`h-auto justify-start border px-4 py-3 text-left ${isActive
                                                            ? "border-blue-400 bg-blue-100 ring-2 ring-blue-300 dark:border-blue-400 dark:bg-blue-900/40 dark:ring-blue-500/40"
                                                            : "border-blue-100 bg-content1 dark:border-blue-700/30"}`}
                                                        onPress={() => applyPermissionPreset(preset.id)}
                                                    >
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <p className={`font-medium ${isActive ? "text-blue-800 dark:text-blue-100" : "text-foreground"}`}>{preset.label}</p>
                                                                {isActive && (
                                                                    <Icon icon="solar:check-circle-bold" className="text-blue-500 dark:text-blue-300" />
                                                                )}
                                                            </div>
                                                            <p className={`whitespace-normal text-xs ${isActive ? "text-blue-700/80 dark:text-blue-200/70" : "text-default-500"}`}>{preset.description}</p>
                                                        </div>
                                                    </Button>
                                                );
                                            })}
                                    </div>
                                </div>

                                    {permissionSections.map((section) => {
                                    const enabledCount = section.items.filter((item) => draftPermissions[item.key]).length;
                                    const allOn = enabledCount === section.items.length;
                                    return (
                                        <div key={section.title} className="overflow-hidden rounded-xl border border-default-200">
                                            <div className="flex items-center justify-between gap-2 border-b border-default-200 bg-content2 px-4 py-2.5">
                                                <h4 className="text-sm font-semibold text-default-700">{section.title}</h4>
                                                <div className="flex items-center gap-2">
                                                    <Chip
                                                        size="sm"
                                                        variant="flat"
                                                        className={enabledCount > 0 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100" : "bg-content4 text-default-500"}
                                                    >
                                                        {enabledCount}/{section.items.length}
                                                    </Chip>
                                                    <Tooltip content={allOn ? (isEnglish ? "Turn off all in this group" : "ปิดทั้งหมวด") : (isEnglish ? "Turn on all in this group" : "เปิดทั้งหมวด")}>
                                                        <span>
                                                            <Switch
                                                                size="sm"
                                                                isSelected={allOn}
                                                                onValueChange={(value) => toggleSectionPermissions(section.items, value)}
                                                                aria-label={isEnglish ? "Toggle all in group" : "สลับทั้งหมวด"}
                                                            />
                                                        </span>
                                                    </Tooltip>
                                                </div>
                                            </div>
                                            <div className="divide-y divide-divider">
                                                {section.items.map((item) => {
                                                    const isChecked = draftPermissions[item.key];
                                                    return (
                                                        <div key={item.key} className={`flex items-center justify-between gap-4 px-4 py-3 transition-colors ${isChecked ? "bg-blue-50/60 dark:bg-blue-950/35" : "bg-content1"}`}>
                                                            <div>
                                                                <p className={`text-sm font-medium ${isChecked ? "text-blue-800 dark:text-blue-100" : "text-default-700"}`}>{item.label}</p>
                                                                <p className={`mt-0.5 text-xs ${isChecked ? "text-blue-700/80 dark:text-blue-200/70" : "text-default-400"}`}>{item.description}</p>
                                                            </div>
                                                            <Switch
                                                                size="sm"
                                                                isSelected={isChecked}
                                                                onValueChange={(value) => updateDraftPermission(item.key, value)}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setEditingMember(null)}>
                            {isEnglish ? "Cancel" : "ยกเลิก"}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleSavePermissions}
                            isLoading={isSavingPermissions}
                            isDisabled={!hasPermissionChanges()}
                            className="bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {isEnglish ? "Save permissions" : "บันทึกสิทธิ์"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
