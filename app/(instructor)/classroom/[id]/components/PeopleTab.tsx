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
import { Pagination } from "@heroui/pagination";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Switch } from "@heroui/switch";
import { Icon } from "@iconify/react";
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
        <Card className="shadow-sm border border-slate-200">
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

const ITEMS_PER_PAGE = 10;

const PERMISSION_SECTIONS: Array<{
    title: string;
    items: Array<{ key: keyof CourseMemberPermissions; label: string; description: string }>;
}> = [
    {
        title: "บุคลากรและโครงสร้างรายวิชา",
        items: [
            { key: "view_people", label: "ดูรายชื่อบุคลากร", description: "เปิดแท็บบุคลากรและดูรายชื่ออาจารย์หรือ TA ในรายวิชา" },
            { key: "add_people", label: "เพิ่มบุคลากร", description: "เพิ่มอาจารย์ผู้สอนหรือผู้ช่วยสอนเข้าสู่รายวิชา" },
            { key: "remove_people", label: "นำบุคลากรออก", description: "ลบอาจารย์หรือ TA ออกจากรายวิชา" },
            { key: "edit_member_permissions", label: "แก้สิทธิ์บุคลากร", description: "ปรับสิทธิ์ของอาจารย์หรือ TA รายคน" },
            { key: "view_sections", label: "ดูกลุ่มเรียน", description: "ดูรายการกลุ่มเรียนและรายชื่อนักศึกษาในกลุ่ม" },
            { key: "create_sections", label: "สร้างกลุ่มเรียน", description: "เพิ่มกลุ่มเรียนใหม่ในรายวิชา" },
            { key: "update_sections", label: "แก้ไขกลุ่มเรียน", description: "แก้ชื่อหรือข้อมูลของกลุ่มเรียน" },
            { key: "delete_sections", label: "ลบกลุ่มเรียน", description: "ลบกลุ่มเรียนออกจากรายวิชา" },
            { key: "manage_section_students", label: "จัดการนักศึกษาในกลุ่มเรียน", description: "เพิ่ม ย้าย ลบ และกู้คืนนักศึกษาในกลุ่มเรียน" },
        ],
    },
    {
        title: "กลุ่มงาน งานชั้นเรียน และคะแนน",
        items: [
            { key: "view_teams", label: "ดูกลุ่มงาน", description: "ดูทีมถาวรหรือทีมรายสัปดาห์" },
            { key: "create_teams", label: "สร้างกลุ่มงาน", description: "สร้างทีมถาวรหรือทีมรายสัปดาห์" },
            { key: "update_teams", label: "แก้ไขกลุ่มงาน", description: "เปลี่ยนชื่อทีม หรือคัดลอกทีมข้ามสัปดาห์" },
            { key: "delete_teams", label: "ลบกลุ่มงาน", description: "ลบทีมรายบุคคลหรือแบบกลุ่ม" },
            { key: "manage_team_members", label: "จัดการสมาชิกในกลุ่มงาน", description: "เพิ่มหรือนำสมาชิกออกจากทีม" },
            { key: "view_assignments", label: "ดูงานในชั้นเรียน", description: "ดูรายการงาน รายละเอียดงาน และลำดับงาน" },
            { key: "create_assignments", label: "สร้างงาน", description: "สร้างงานหรือหัวข้อใหม่ในชั้นเรียน" },
            { key: "update_assignments", label: "แก้ไขงาน", description: "แก้ไขงาน ปรับลำดับ และเชื่อม attendance กับงาน" },
            { key: "delete_assignments", label: "ลบงาน", description: "ลบงานในชั้นเรียน" },
            { key: "grade_assignments", label: "ให้คะแนนงาน", description: "เปิดดูงานและบันทึกคะแนนรายคนหรือรายกลุ่ม" },
            { key: "edit_scores", label: "แก้ไขคะแนน", description: "แก้คะแนนและส่งคำร้องแก้ไขคะแนน" },
            { key: "view_score_summary", label: "ดูสรุปคะแนน", description: "ดู score summary, matrix และสถิติการให้คะแนน" },
            { key: "review_own_score_requests", label: "ดูคำร้องคะแนนของตนเอง", description: "ดูสถานะคำร้องที่ตนเองเป็นผู้ส่งหรือดูแล" },
            { key: "review_all_score_requests", label: "อนุมัติคำร้องคะแนนทั้งหมด", description: "ตรวจและอนุมัติคำร้องคะแนนได้แบบเดียวกับอาจารย์" },
        ],
    },
    {
        title: "คะแนนสอบ เช็คชื่อ และคิว",
        items: [
            { key: "view_exam_scores", label: "ดูคะแนนสอบ", description: "เปิดดูข้อมูลคะแนนสอบและสถิติ" },
            { key: "create_exam_scores", label: "เพิ่มคะแนนสอบ", description: "เพิ่มคะแนนสอบใหม่เข้าระบบ" },
            { key: "update_exam_scores", label: "แก้ไขคะแนนสอบ", description: "แก้ไขคะแนนสอบที่มีอยู่แล้ว" },
            { key: "delete_exam_scores", label: "ลบคะแนนสอบ", description: "ลบข้อมูลคะแนนสอบ" },
            { key: "update_exam_settings", label: "แก้การตั้งค่าคะแนนสอบ", description: "ปรับ exam settings หรือสัดส่วนคะแนนสอบ" },
            { key: "view_attendance", label: "ดูข้อมูลเช็คชื่อ", description: "ดู session เช็คชื่อและรายการเข้าเรียน" },
            { key: "create_attendance_sessions", label: "สร้าง session เช็คชื่อ", description: "สร้าง session เช็คชื่อใหม่" },
            { key: "update_attendance_sessions", label: "แก้ session เช็คชื่อ", description: "ปรับเวลา เปิด ปิด และแก้ session เช็คชื่อ" },
            { key: "delete_attendance_sessions", label: "ลบ session เช็คชื่อ", description: "ลบ session เช็คชื่อ" },
            { key: "update_attendance_status", label: "แก้สถานะเช็คชื่อ", description: "อัปเดตสถานะการเข้าเรียนรายคนหรือแบบกลุ่ม" },
            { key: "view_queue", label: "ดูคิวตรวจงาน", description: "ดู session คิว รายชื่อ worker และรายการจองคิว" },
            { key: "create_queue_sessions", label: "สร้างคิวตรวจงาน", description: "สร้าง session คิวตรวจงานใหม่" },
            { key: "update_queue_sessions", label: "แก้คิวตรวจงาน", description: "แก้ session คิว เปิด ปิด หยุดพัก และจัดการ worker" },
            { key: "delete_queue_sessions", label: "ลบคิวตรวจงาน", description: "ลบ session คิวตรวจงาน" },
            { key: "manage_queue_bookings", label: "จัดการรายการจองคิว", description: "รับงาน ข้ามคิว ปิดงาน และจัดการ booking" },
        ],
    },
];

const PERMISSION_PRESETS: Array<{
    id: CoursePermissionPreset;
    label: string;
    description: string;
    roles?: Array<EditableMember["type"]>;
}> = [
    { id: "view_only", label: "ดูอย่างเดียว", description: "เข้าแท็บและดูข้อมูลได้ แต่แก้ไขอะไรไม่ได้" },
    { id: "ta_standard", label: "ช่วยสอนปกติ", description: "เหมาะกับ TA ที่ช่วยเช็กงาน ดูคะแนน และดูคิว", roles: ["ta"] },
    { id: "course_coordinator", label: "ผู้ประสานงานรายวิชา", description: "ดูแลการสอนเกือบทั้งหมด ยกเว้นการเป็นเจ้าของวิชา" },
];

function summarizePermissions(permissions: CourseMemberPermissions) {
    const labels = [
        permissions.view_people || permissions.add_people || permissions.remove_people || permissions.edit_member_permissions ? "บุคลากร" : null,
        permissions.view_sections || permissions.create_sections || permissions.update_sections || permissions.delete_sections || permissions.manage_section_students ? "กลุ่มเรียน" : null,
        permissions.view_teams || permissions.create_teams || permissions.update_teams || permissions.delete_teams || permissions.manage_team_members ? "กลุ่มงาน" : null,
        permissions.view_assignments || permissions.create_assignments || permissions.update_assignments || permissions.delete_assignments ? "งาน" : null,
        permissions.grade_assignments ? "ให้คะแนน" : null,
        permissions.edit_scores ? "แก้คะแนน" : null,
        permissions.view_score_summary ? "สรุปคะแนน" : null,
        permissions.review_all_score_requests ? "อนุมัติคำร้อง" : permissions.review_own_score_requests ? "ดูคำร้องตนเอง" : null,
        permissions.view_exam_scores || permissions.create_exam_scores || permissions.update_exam_scores || permissions.delete_exam_scores || permissions.update_exam_settings ? "คะแนนสอบ" : null,
        permissions.view_attendance || permissions.create_attendance_sessions || permissions.update_attendance_sessions || permissions.delete_attendance_sessions || permissions.update_attendance_status ? "เช็คชื่อ" : null,
        permissions.view_queue || permissions.create_queue_sessions || permissions.update_queue_sessions || permissions.delete_queue_sessions || permissions.manage_queue_bookings ? "คิว" : null,
    ].filter((value): value is string => Boolean(value));

    return {
        labels: labels.slice(0, 3),
        remaining: Math.max(0, labels.length - 3),
        total: labels.length,
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
    const [currentPage, setCurrentPage] = useState(1);
    const [editingMember, setEditingMember] = useState<EditableMember | null>(null);
    const [draftPermissions, setDraftPermissions] = useState<CourseMemberPermissions | null>(null);
    const [isSavingPermissions, setIsSavingPermissions] = useState(false);

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

    const totalPages = Math.ceil(allPeople.length / ITEMS_PER_PAGE);
    const paginatedPeople = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return allPeople.slice(start, start + ITEMS_PER_PAGE);
    }, [allPeople, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (editingMember) {
            setDraftPermissions(editingMember.permissions);
        } else {
            setDraftPermissions(null);
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
                    <h2 className="text-lg font-semibold text-slate-800">บุคลากรในรายวิชา</h2>
                    <p className="text-sm text-slate-500">เพิ่มบุคลากรและกำหนดขอบเขตงานของแต่ละคนในรายวิชา</p>
                </div>

                {(canAddInstructor || canAddTA) && (
                    <div className="flex gap-2">
                        {canAddInstructor && (
                            <Button
                                color="secondary"
                                variant="flat"
                                startContent={<Icon icon="solar:user-plus-bold" />}
                                onPress={onOpenAddInstructorModal}
                                isDisabled={isPeopleLoading || !isCourseActive}
                                className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                            >
                                เพิ่มอาจารย์
                            </Button>
                        )}
                        {canAddTA && (
                            <Button
                                color="primary"
                                startContent={<Icon icon="solar:user-plus-bold" />}
                                onPress={onOpenAddTAModal}
                                isDisabled={isPeopleLoading || !isCourseActive}
                                className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                            >
                                เพิ่มผู้ช่วยสอน
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {isLoading ? (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="shadow-sm border border-slate-200">
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
                        <Card className="shadow-sm border border-slate-200">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-100 rounded-xl">
                                        <Icon icon="solar:users-group-rounded-bold" className="text-2xl text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">บุคลากรทั้งหมด</p>
                                        <p className="text-2xl font-bold text-slate-800">{instructorsCount + (course.tas?.length || 0)}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="shadow-sm border border-slate-200">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-100 rounded-xl">
                                        <Icon icon="solar:user-circle-bold" className="text-2xl text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">อาจารย์ผู้สอน</p>
                                        <p className="text-2xl font-bold text-slate-800">{instructorsCount}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="shadow-sm border border-slate-200">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-100 rounded-xl">
                                        <Icon icon="solar:user-hands-bold" className="text-2xl text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">ผู้ช่วยสอน (TA)</p>
                                        <p className="text-2xl font-bold text-slate-800">{course.tas?.length || 0}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    <Card className="shadow-sm border border-slate-200">
                        <CardBody className="p-2">
                            <div className="overflow-x-auto">
                                <Table
                                    aria-label="People table"
                                    removeWrapper
                                    classNames={{
                                        base: "min-w-[860px]",
                                        th: "bg-slate-50 text-slate-600 font-semibold text-sm whitespace-nowrap",
                                        td: "py-3 align-top",
                                    }}
                                >
                                    <TableHeader>
                                        <TableColumn className="min-w-45">ชื่อ-นามสกุล</TableColumn>
                                        <TableColumn className="min-w-45">อีเมล / Username</TableColumn>
                                        <TableColumn className="min-w-35">บทบาท</TableColumn>
                                        <TableColumn className={showPermissionColumn ? "min-w-55" : "hidden"}>สิทธิ์ในรายวิชา</TableColumn>
                                        <TableColumn align="center" className="min-w-30">จัดการ</TableColumn>
                                    </TableHeader>
                                    <TableBody emptyContent={
                                        <div className="py-10 text-center">
                                            <Icon icon="solar:users-group-rounded-linear" className="text-5xl text-slate-300 mx-auto mb-3" />
                                            <p className="text-slate-400">ยังไม่มีบุคลากรในรายวิชานี้</p>
                                        </div>
                                    }>
                                        {paginatedPeople.map((person) => {
                                            const summary = summarizePermissions(person.permissions);
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
                                                                <p className="font-medium text-slate-800">{person.full_name}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-slate-600">{person.email}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {person.type === "instructor" ? (
                                                                <>
                                                                    <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700">
                                                                        อาจารย์ผู้สอน
                                                                    </Chip>
                                                                    {person.isPrimary && (
                                                                        <Chip
                                                                            size="sm"
                                                                            variant="flat"
                                                                            className="bg-amber-100 text-amber-700"
                                                                            startContent={<Icon icon="solar:crown-bold" className="text-xs" />}
                                                                        >
                                                                            เจ้าของวิชา
                                                                        </Chip>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <Chip size="sm" variant="flat" className="bg-emerald-100 text-emerald-700">
                                                                    ผู้ช่วยสอน
                                                                </Chip>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={showPermissionColumn ? undefined : "hidden"}>
                                                        <div className="space-y-2">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {summary.labels.map((label) => (
                                                                    <Chip key={label} size="sm" variant="flat" className="bg-slate-100 text-slate-700">
                                                                        {label}
                                                                    </Chip>
                                                                ))}
                                                                {summary.remaining > 0 && (
                                                                    <Chip size="sm" variant="flat" className="bg-slate-200 text-slate-700">
                                                                        +{summary.remaining}
                                                                    </Chip>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-500">เปิดใช้งาน {summary.total} สิทธิ์</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-center gap-1">
                                                            {canViewPeople ? (
                                                                <>
                                                                    {person.type === "instructor" ? (
                                                                        // <Tooltip content="สิทธิ์ของอาจารย์ประจำวิชาแก้ไขไม่ได้">
                                                                        //     <span className="text-slate-300 p-2">
                                                                        //         <Icon icon="solar:lock-keyhole-bold" className="text-lg" />
                                                                        //     </span>
                                                                        // </Tooltip>
                                                                        <></>
                                                                    ) : canEditTAPermissions(person.personId) ? (
                                                                        <Tooltip content="ตั้งค่าสิทธิ์">
                                                                            <Button
                                                                                isIconOnly
                                                                                size="sm"
                                                                                variant="light"
                                                                                color="primary"
                                                                                isDisabled={!isCourseActive}
                                                                                onPress={() => openPermissionEditor(person)}
                                                                            >
                                                                                <Icon icon="solar:settings-bold" className="text-lg" />
                                                                            </Button>
                                                                        </Tooltip>
                                                                    ) : (
                                                                        <Tooltip content={userRole === "ta" && person.personId === currentUserId ? "ผู้ช่วยสอนไม่สามารถแก้สิทธิ์ของตัวเองได้" : "บัญชีนี้ไม่มีสิทธิ์แก้ permission บุคลากร"}>
                                                                            <span className="text-slate-300 p-2">
                                                                                <Icon icon="solar:lock-keyhole-bold" className="text-lg" />
                                                                            </span>
                                                                        </Tooltip>
                                                                    )}

                                                                    {person.type === "instructor" ? (
                                                                        canRemoveInstructor(person.personId, person.isPrimary) ? (
                                                                            <Tooltip content="ลบออกจากรายวิชา" color="danger">
                                                                                <Button
                                                                                    isIconOnly
                                                                                    size="sm"
                                                                                    variant="light"
                                                                                    color="danger"
                                                                                    isDisabled={!isCourseActive}
                                                                                    onPress={() => onRemoveInstructor(person.personId)}
                                                                                >
                                                                                    <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />
                                                                                </Button>
                                                                            </Tooltip>
                                                                        ) : (
                                                                            <Tooltip content={person.isPrimary ? "อาจารย์เจ้าของวิชาไม่สามารถลบออกได้" : "ไม่สามารถลบตัวเองออกได้"}>
                                                                                <span className="text-slate-300 p-2">
                                                                                    <Icon icon="solar:lock-keyhole-bold" className="text-lg" />
                                                                                </span>
                                                                            </Tooltip>
                                                                        )
                                                                    ) : canRemoveTA(person.personId) ? (
                                                                        <Tooltip content="ลบออกจากรายวิชา" color="danger">
                                                                            <Button
                                                                                isIconOnly
                                                                                size="sm"
                                                                                variant="light"
                                                                                color="danger"
                                                                                isDisabled={!isCourseActive}
                                                                                onPress={() => onRemoveTA(person.personId)}
                                                                            >
                                                                                <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />
                                                                            </Button>
                                                                        </Tooltip>
                                                                    ) : (
                                                                        // <Tooltip content={person.personId === currentUserId ? "ไม่สามารถลบตัวเองออกได้" : "บัญชีนี้ไม่มีสิทธิ์นำผู้ช่วยสอนออก"}>
                                                                        //     <span className="text-slate-300 p-2">
                                                                        //         <Icon icon="solar:lock-keyhole-bold" className="text-lg" />
                                                                        //     </span>
                                                                        // </Tooltip>
                                                                        <></>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <Tooltip content="บัญชีนี้ไม่มีสิทธิ์จัดการบุคลากร">
                                                                    <span className="text-slate-300 p-2">
                                                                        <Icon icon="solar:lock-keyhole-bold" className="text-lg" />
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

                            {totalPages > 1 && (
                                <div className="flex justify-center py-4 border-t border-slate-100">
                                    <Pagination
                                        total={totalPages}
                                        page={currentPage}
                                        onChange={setCurrentPage}
                                        showControls
                                        size="sm"
                                        color="primary"
                                        classNames={{
                                            wrapper: "gap-1",
                                            item: "bg-transparent",
                                            cursor: "bg-blue-500 text-white shadow-md",
                                        }}
                                    />
                                </div>
                            )}
                        </CardBody>
                    </Card>

                    {instructorsCount === 0 && (!course.tas || course.tas.length === 0) && (
                        <Card className="shadow-sm border border-dashed border-slate-300 bg-slate-50/50">
                            <CardBody className="text-center py-16">
                                <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                                    <Icon icon="solar:users-group-rounded-bold-duotone" className="text-5xl text-blue-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-700 mb-2">ยังไม่มีบุคลากร</h3>
                                <p className="text-slate-500 mb-6 max-w-md mx-auto">เพิ่มอาจารย์หรือผู้ช่วยสอนเพื่อช่วยจัดการรายวิชาและมอบหมายสิทธิ์ได้ตามงานที่ต้องรับผิดชอบ</p>
                                {(canAddInstructor || canAddTA) && (
                                    <div className="flex gap-2 justify-center">
                                        {canAddInstructor && (
                                            <Button
                                                color="secondary"
                                                variant="flat"
                                                startContent={<Icon icon="solar:user-plus-bold" />}
                                                onPress={onOpenAddInstructorModal}
                                                className="bg-indigo-100 text-indigo-700"
                                            >
                                                เพิ่มอาจารย์
                                            </Button>
                                        )}
                                        {canAddTA && (
                                            <Button
                                                color="primary"
                                                startContent={<Icon icon="solar:user-plus-bold" />}
                                                onPress={onOpenAddTAModal}
                                                className="bg-linear-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                                            >
                                                เพิ่มผู้ช่วยสอน
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
                        <span>สิทธิ์ในรายวิชา</span>
                        <span className="text-sm font-normal text-slate-500">{editingMember?.full_name}</span>
                    </ModalHeader>
                    <ModalBody>
                        {draftPermissions && editingMember && (
                            <div className="space-y-5">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">บทบาทปัจจุบัน</p>
                                            <p className="text-sm text-slate-500">
                                                {editingMember.type === "instructor" ? "อาจารย์ผู้สอน" : "ผู้ช่วยสอน"}
                                            </p>
                                        </div>
                                        <Chip size="sm" variant="flat" className="bg-slate-200 text-slate-700">
                                            เปิดใช้งาน {summarizePermissions(draftPermissions).total} สิทธิ์
                                        </Chip>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Icon icon="solar:magic-stick-3-bold" className="text-blue-500" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">Preset สิทธิ์</p>
                                            <p className="text-xs text-slate-500">เลือกชุดสิทธิ์เริ่มต้นแล้วค่อยปรับจุดย่อยต่อได้</p>
                                        </div>
                                    </div>
                                    <div className="grid gap-2 md:grid-cols-3">
                                        {PERMISSION_PRESETS
                                            .filter((preset) => !preset.roles || preset.roles.includes(editingMember.type))
                                            .map((preset) => (
                                                <Button
                                                    key={preset.id}
                                                    variant="flat"
                                                    className="h-auto justify-start border border-blue-100 bg-white px-4 py-3 text-left"
                                                    onPress={() => applyPermissionPreset(preset.id)}
                                                >
                                                    <div>
                                                        <p className="font-medium text-slate-800">{preset.label}</p>
                                                        <p className="whitespace-normal text-xs text-slate-500">{preset.description}</p>
                                                    </div>
                                                </Button>
                                            ))}
                                    </div>
                                </div>

                                {PERMISSION_SECTIONS.map((section) => {
                                    const enabledCount = section.items.filter((item) => draftPermissions[item.key]).length;
                                    return (
                                        <div key={section.title} className="rounded-xl border border-slate-200 overflow-hidden">
                                            <div className="flex items-center justify-between gap-2 bg-slate-100 px-4 py-2.5 border-b border-slate-200">
                                                <h4 className="font-semibold text-slate-700 text-sm">{section.title}</h4>
                                                <Chip
                                                    size="sm"
                                                    variant="flat"
                                                    className={enabledCount > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}
                                                >
                                                    {enabledCount}/{section.items.length}
                                                </Chip>
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                {section.items.map((item) => {
                                                    const isChecked = draftPermissions[item.key];
                                                    return (
                                                        <div key={item.key} className={`flex items-center justify-between gap-4 px-4 py-3 transition-colors ${isChecked ? "bg-blue-50/40" : "bg-white"}`}>
                                                            <div>
                                                                <p className={`text-sm font-medium ${isChecked ? "text-blue-800" : "text-slate-700"}`}>{item.label}</p>
                                                                <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
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
                            ยกเลิก
                        </Button>
                        <Button color="primary" onPress={handleSavePermissions} isLoading={isSavingPermissions}>
                            บันทึกสิทธิ์
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}