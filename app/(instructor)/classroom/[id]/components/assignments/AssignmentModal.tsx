"use client";

import { useState, useEffect, memo } from "react";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import type { AssignmentType } from "../types";
import type { AttendanceSession } from "@/services/attendance.service";
import assignmentService from "@/services/assignment.service";
import attendanceService from "@/services/attendance.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import {
    instructorFlatButtonClass,
    instructorPrimaryButtonClass,
} from "@/components/ui/instructor-button-styles";

function formatCount(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

function formatPoints(points: number, isEnglish: boolean): string {
    return isEnglish ? formatCount(points, "point", "points") : `${points} คะแนน`;
}

function formatLocalizedDate(value: string, isEnglish: boolean): string {
    return new Date(value).toLocaleDateString(isEnglish ? "en-US" : "th-TH", {
        day: "numeric",
        month: "short",
        year: isEnglish ? "numeric" : "2-digit",
    });
}

function formatLocalizedPublishDateTime(value: string, isEnglish: boolean): string {
    const date = new Date(value);
    const locale = isEnglish ? "en-US" : "th-TH";
    const dateText = date.toLocaleDateString(locale, { dateStyle: "long" });
    const timeText = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    return isEnglish ? `${dateText} at ${timeText}` : `${dateText} เวลา ${timeText} น.`;
}

function getLinkedAttendanceSessionIds(assignment: AssignmentType): number[] {
    if (assignment.linkedAttendanceSessions && assignment.linkedAttendanceSessions.length > 0) {
        return assignment.linkedAttendanceSessions.map((session) => session.id);
    }

    if (assignment.linkedAttendanceSession) {
        return [assignment.linkedAttendanceSession.id];
    }

    if (assignment.linked_attendance_session_id) {
        return [assignment.linked_attendance_session_id];
    }

    return [];
}

interface LocalSubItem {
    id?: number;
    name: string;
    max_score: number;
}

interface AssignmentFormData {
    name: string;
    assignment_type: "individual" | "permanent_group" | "weekly_group" | "assignment";
    week_number?: number;
    linked_attendance_session_ids: number[];
    linked_attendance_session_id: number | null;
    attendance_condition: "and" | "or";
    hasSubItems: boolean;
    subItems: LocalSubItem[];
    maxScore: number;
    dueDate: string;
    description: string;
    isScoreVisible: boolean;
    isDraft: boolean;
    publishAt: string; // ISO datetime-local string
}

interface AssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
    editingAssignment: AssignmentType | null;
    onSuccess: () => void;
    weeklyTeams?: Record<number, any[]>;
    isCourseActive?: boolean;
}

const initialFormData: AssignmentFormData = {
    name: "",
    assignment_type: "individual",
    linked_attendance_session_ids: [],
    linked_attendance_session_id: null,
    attendance_condition: "or",
    hasSubItems: false,
    subItems: [],
    maxScore: 10,
    dueDate: "",
    description: "",
    isScoreVisible: true,
    isDraft: false,
    publishAt: "",
};

function AssignmentModalComponent({
    isOpen,
    onClose,
    courseId,
    editingAssignment,
    onSuccess,
    weeklyTeams = {},
    isCourseActive = true,
}: AssignmentModalProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const canSaveAsDraft = !editingAssignment || editingAssignment.is_draft;
    const isEditingDraft = editingAssignment?.is_draft === true;
    const isEditingPublished = !!editingAssignment && !editingAssignment.is_draft;

    // Form state
    const [formData, setFormData] = useState<AssignmentFormData>(initialFormData);
    const [originalFormData, setOriginalFormData] = useState<AssignmentFormData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

    const hasFormChanges = () => {
        if (!originalFormData) return false;
        return JSON.stringify(formData) !== JSON.stringify(originalFormData);
    };

    // Fetch attendance sessions when modal opens
    useEffect(() => {
        if (isOpen && courseId) {
            const fetchSessions = async () => {
                setIsLoadingSessions(true);
                try {
                    const sessions = await attendanceService.getSessions(courseId);
                    setAttendanceSessions(sessions);
                } catch (error) {
                    console.error("Failed to fetch attendance sessions:", error);
                }
                setIsLoadingSessions(false);
            };
            fetchSessions();
        }
    }, [isOpen, courseId]);

    // Reset or populate form when modal opens/closes or editing assignment changes
    useEffect(() => {
        if (isOpen) {
            if (editingAssignment) {
                // Populate form with existing assignment data
                const linkedAttendanceSessionIds = getLinkedAttendanceSessionIds(editingAssignment);
                const populated: AssignmentFormData = {
                    name: editingAssignment.name,
                    assignment_type: editingAssignment.assignment_type,
                    week_number: editingAssignment.week_number,
                    linked_attendance_session_ids: linkedAttendanceSessionIds,
                    linked_attendance_session_id: linkedAttendanceSessionIds[0] || null,
                    attendance_condition: editingAssignment.attendance_condition || "or",
                    hasSubItems: !!(editingAssignment.subItems && editingAssignment.subItems.length > 0),
                    subItems: editingAssignment.subItems?.map(s => ({
                        id: s.id,
                        name: s.name,
                        max_score: Number(s.max_score)
                    })) || [],
                    maxScore: Number(editingAssignment.max_score),
                    dueDate: editingAssignment.due_date || "",
                    description: editingAssignment.description || "",
                    isScoreVisible: editingAssignment.is_score_visible !== false,
                    isDraft: false,
                    publishAt: editingAssignment.publish_at
                        ? new Date(editingAssignment.publish_at).toISOString().slice(0, 16)
                        : "",
                };
                setFormData(populated);
                setOriginalFormData(populated);
            } else {
                // Reset to initial form data
                setFormData(initialFormData);
                setOriginalFormData(null);
            }
        }
    }, [isOpen, editingAssignment]);

    // Calculate total score from sub items
    const totalSubItemScore = formData.subItems.reduce((sum, item) => sum + (item.max_score || 0), 0);

    // Handle form submit
    const handleSubmit = async (draftOverride?: boolean) => {
        // Validation
        if (!formData.name.trim()) {
            addToast({
                title: isEnglish ? "Missing information" : "ข้อมูลไม่ครบ",
                description: isEnglish ? "Please enter an assignment name." : "กรุณากรอกชื่องาน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (formData.hasSubItems && formData.subItems.length === 0) {
            addToast({
                title: isEnglish ? "Missing information" : "ข้อมูลไม่ครบ",
                description: isEnglish ? "Please add at least one sub-item." : "กรุณาเพิ่มข้อย่อยอย่างน้อย 1 ข้อ",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (formData.assignment_type === "weekly_group" && !formData.week_number) {
            addToast({
                title: isEnglish ? "Missing information" : "ข้อมูลไม่ครบ",
                description: isEnglish ? "Please select a week." : "กรุณาเลือกสัปดาห์",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const isDraft = draftOverride ?? formData.isDraft;

            const payload = {
                course_id: courseId,
                name: formData.name.trim(),
                description: formData.description.trim() || undefined,
                assignment_type: formData.assignment_type,
                week_number: (formData.assignment_type === "weekly_group") ? formData.week_number : undefined,
                linked_attendance_session_ids: formData.linked_attendance_session_ids,
                attendance_condition: formData.linked_attendance_session_ids.length > 1 
                    ? formData.attendance_condition 
                    : undefined,
                max_score: formData.hasSubItems ? totalSubItemScore : formData.maxScore,
                sub_items: formData.hasSubItems
                    ? formData.subItems.map((item, index) => ({
                        id: item.id,
                        name: item.name,
                        max_score: item.max_score,
                        order_index: index,
                    }))
                    : undefined,
                due_date: formData.dueDate || undefined,
                is_score_visible: formData.isScoreVisible,
                is_draft: isDraft,
                publish_at: isDraft && formData.publishAt
                    ? new Date(formData.publishAt).toISOString()
                    : undefined,
                clear_publish_at: isDraft && !formData.publishAt && editingAssignment?.publish_at
                    ? true
                    : undefined,
            };

            let result;
            if (editingAssignment) {
                result = await assignmentService.updateAssignment(editingAssignment.id, payload);
            } else {
                result = await assignmentService.createAssignment(payload);
            }

            if (result) {
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: editingAssignment
                        ? (isDraft
                            ? (isEnglish ? "Draft saved." : "บันทึกร่างเรียบร้อย")
                            : (isEnglish ? "Assignment updated." : "แก้ไขงานเรียบร้อย"))
                        : (isDraft
                            ? (isEnglish ? "Draft created." : "สร้างฉบับร่างเรียบร้อย")
                            : (isEnglish ? "Assignment created." : "สร้างงานใหม่เรียบร้อย")),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                onSuccess();
                onClose();
            } else {
                throw new Error(isEnglish ? "Unable to save the assignment." : "ไม่สามารถบันทึกงานได้");
            }
        } catch (error: any) {
            console.error("Failed to save assignment:", error);
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: isEnglish ? "Unable to save the assignment." : (error.message || "ไม่สามารถบันทึกงานได้"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveDraft = async () => {
        await handleSubmit(true);
    };

    const handleSaveChanges = async () => {
        await handleSubmit();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                onClose();
            }}
            size="2xl"
            scrollBehavior="inside"
        >
            <ModalContent className="border border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg">
                            <Icon icon="solar:clipboard-list-bold" className="text-2xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground">
                                {editingAssignment
                                    ? (isEnglish ? "Edit assignment" : "แก้ไขงาน")
                                    : (isEnglish ? "Create assignment" : "สร้างงานใหม่")}
                            </h3>
                            <p className="mt-1 text-sm font-normal text-default-500">
                                {isEnglish ? "Define grading items for this course." : "กำหนดหัวข้องานสำหรับการลงคะแนน"}
                            </p>
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody className="px-6 py-4">
                    <div className="space-y-5">
                        <div
                            className={`rounded-xl border p-4 ${
                                isEditingPublished
                                    ? "border-emerald-200 bg-emerald-50"
                                    : "border-yellow-200 bg-yellow-50"
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`rounded-lg p-2 ${isEditingPublished ? "bg-emerald-100" : "bg-yellow-100"}`}>
                                    <Icon
                                        icon={isEditingPublished ? "solar:check-circle-bold" : "solar:pen-new-square-bold"}
                                        className={isEditingPublished ? "text-emerald-600" : "text-yellow-700"}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-default-800">
                                            {isEditingPublished ? (isEnglish ? "Published assignment" : "งานที่เผยแพร่แล้ว") : (isEnglish ? "Draft workflow" : "โหมดฉบับร่าง")}
                                        </p>
                                        <Chip
                                            size="sm"
                                            variant="flat"
                                            className={isEditingPublished ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}
                                        >
                                            {isEditingPublished ? (isEnglish ? "Published" : "เผยแพร่แล้ว") : (isEnglish ? "Draft" : "ฉบับร่าง")}
                                        </Chip>
                                    </div>
                                    <p className={`text-xs ${isEditingPublished ? "text-emerald-700" : "text-yellow-800"}`}>
                                        {isEditingPublished
                                            ? (isEnglish
                                                ? "This assignment is already visible in the course. It can be edited, but it cannot be moved back to draft."
                                                : "งานนี้เผยแพร่ในรายวิชาแล้ว แก้ไขได้ตามปกติ แต่ไม่สามารถย้อนกลับเป็นฉบับร่างได้")
                                            : (isEnglish
                                                ? "Save as draft to keep working later, or publish when this assignment is ready for students and staff."
                                                : "บันทึกฉบับร่างเพื่อกลับมาแก้ต่อภายหลัง หรือเผยแพร่เมื่อพร้อมใช้งานสำหรับผู้สอนและนักศึกษา")}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Assignment Name */}
                        <Input
                            label={isEnglish ? "Assignment name" : "ชื่องาน"}
                            labelPlacement="outside"
                            placeholder={isEnglish ? "e.g. Lab 1, Quiz 1, Group project" : "เช่น งานที่ 1, Quiz 1, โปรเจกต์กลุ่ม"}
                            variant="bordered"
                            size="md"
                            value={formData.name}
                            onValueChange={(val) => setFormData(prev => ({ ...prev, name: val }))}
                            isRequired
                            classNames={{
                                inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                label: "text-sm font-medium text-default-600",
                            }}
                        />

                        {/* Assignment Type */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-default-600">{isEnglish ? "Assignment type" : "ประเภทงาน"}</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, assignment_type: "individual", week_number: undefined }))}
                                    className={`p-4 rounded-xl border-2 transition-all ${formData.assignment_type === "individual"
                                            ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/10"
                                            : "border-default-200 hover:border-default-300 dark:hover:border-slate-600"
                                        } ${editingAssignment ? "opacity-60 cursor-not-allowed" : ""}`}
                                    disabled={!!editingAssignment}
                                >
                                    <Icon icon="solar:monitor-bold" className={`text-3xl mx-auto mb-2 ${formData.assignment_type === "individual" ? "text-indigo-500" : "text-default-400"
                                        }`} />
                                    <p className={`font-semibold text-sm ${formData.assignment_type === "individual" ? "text-indigo-700 dark:text-indigo-200" : "text-default-600"
                                        }`}>Lab</p>
                                    <p className="mt-1 text-xs text-default-500">{isEnglish ? "In-class work" : "งานในคาบ"}</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, assignment_type: "assignment", week_number: undefined }))}
                                    className={`p-4 rounded-xl border-2 transition-all ${formData.assignment_type === "assignment"
                                            ? "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-500/10"
                                            : "border-default-200 hover:border-default-300 dark:hover:border-slate-600"
                                        } ${editingAssignment ? "opacity-60 cursor-not-allowed" : ""}`}
                                    disabled={!!editingAssignment}
                                >
                                    <Icon icon="solar:document-text-bold" className={`text-3xl mx-auto mb-2 ${formData.assignment_type === "assignment" ? "text-amber-500" : "text-default-400"
                                        }`} />
                                    <p className={`font-semibold text-sm ${formData.assignment_type === "assignment" ? "text-amber-700 dark:text-amber-200" : "text-default-600"
                                        }`}>Assignment</p>
                                    <p className="mt-1 text-xs text-default-500">{isEnglish ? "Homework" : "การบ้าน"}</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, assignment_type: "permanent_group", week_number: undefined }))}
                                    className={`p-4 rounded-xl border-2 transition-all ${formData.assignment_type === "permanent_group"
                                            ? "border-purple-500 bg-purple-50 dark:border-purple-400 dark:bg-purple-500/10"
                                            : "border-default-200 hover:border-default-300 dark:hover:border-slate-600"
                                        } ${editingAssignment ? "opacity-60 cursor-not-allowed" : ""}`}
                                    disabled={!!editingAssignment}
                                >
                                    <Icon icon="solar:users-group-rounded-bold" className={`text-3xl mx-auto mb-2 ${formData.assignment_type === "permanent_group" ? "text-purple-500" : "text-default-400"
                                        }`} />
                                    <p className={`font-semibold text-sm ${formData.assignment_type === "permanent_group" ? "text-purple-600" : "text-default-600"
                                        }`}>กลุ่มโปรเจกต์</p>
                                    <p className="mt-1 text-xs text-default-500">{isEnglish ? "Permanent team work" : "งานกลุ่ม"}</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, assignment_type: "weekly_group", week_number: prev.week_number || 1 }))}
                                    className={`p-4 rounded-xl border-2 transition-all ${formData.assignment_type === "weekly_group"
                                            ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-500/10"
                                            : "border-default-200 hover:border-default-300 dark:hover:border-slate-600"
                                        } ${editingAssignment ? "opacity-60 cursor-not-allowed" : ""}`}
                                    disabled={!!editingAssignment}
                                >
                                    <Icon icon="solar:calendar-bold" className={`text-3xl mx-auto mb-2 ${formData.assignment_type === "weekly_group" ? "text-emerald-500" : "text-default-400"
                                        }`} />
                                    <p className={`font-semibold text-sm ${formData.assignment_type === "weekly_group" ? "text-emerald-600" : "text-default-600"
                                        }`}>กลุ่มสัปดาห์</p>
                                    <p className="mt-1 text-xs text-default-500">{isEnglish ? "Weekly team work" : "กลุ่มรายสัปดาห์"}</p>
                                </button>
                            </div>
                        </div>

                        {/* Week Number - Only show for weekly group */}
                        {formData.assignment_type === "weekly_group" && (
                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                                <label className="mb-2 block text-sm font-medium text-default-600">{isEnglish ? "Week" : "สัปดาห์ที่"}</label>
                                {Object.keys(weeklyTeams).length > 0 ? (
                                    <Select
                                        placeholder={isEnglish ? "Select week" : "เลือกสัปดาห์"}
                                        selectedKeys={formData.week_number ? [formData.week_number.toString()] : []}
                                        size="md"
                                        onSelectionChange={(keys) => {
                                            const val = Array.from(keys)[0] as string;
                                            if (val) {
                                                setFormData(prev => ({ ...prev, week_number: parseInt(val) }));
                                            }
                                        }}
                                        variant="bordered"
                                        classNames={{
                                            trigger: "bg-content1 border-default-200",
                                            value: "text-foreground",
                                        }}
                                    >
                                        {Object.keys(weeklyTeams)
                                            .map(Number)
                                            .sort((a, b) => a - b)
                                            .map((weekNum) => (
                                                <SelectItem key={weekNum.toString()} textValue={isEnglish ? `Week ${weekNum}` : `สัปดาห์ที่ ${weekNum}`}>
                                                    <div className="flex items-center justify-between w-full">
                                                        <span>{isEnglish ? `Week ${weekNum}` : `สัปดาห์ที่ ${weekNum}`}</span>
                                                        <span className="text-xs text-default-500">
                                                            ({isEnglish
                                                                ? formatCount(weeklyTeams[weekNum]?.length || 0, "group", "groups")
                                                                : `${weeklyTeams[weekNum]?.length || 0} กลุ่ม`})
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                    </Select>
                                ) : (
                                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                                        <Icon icon="solar:info-circle-bold" className="text-amber-500 text-xl mb-1" />
                                        <p className="text-sm text-amber-700">{isEnglish ? "No weekly groups yet" : "ยังไม่มีกลุ่มประจำสัปดาห์"}</p>
                                        <p className="text-xs text-amber-600 mt-1">{isEnglish ? "Create weekly groups first." : "กรุณาสร้างกลุ่มประจำสัปดาห์ก่อน"}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Link to Attendance Session - Multi-select */}
                        <div className="rounded-xl border border-default-200 bg-content2/80 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <Icon icon="solar:clipboard-check-bold" className="text-lg text-blue-600" />
                                    </div>
                                    <div>
                                        <span className="font-semibold text-default-700">{isEnglish ? "Link attendance sessions" : "ลิงก์กับการเช็คชื่อ"}</span>
                                        <p className="text-xs text-default-500">{isEnglish ? "You can link multiple attendance sessions." : "สามารถเลือกหลายรอบเช็คชื่อได้"}</p>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant={formData.linked_attendance_session_ids.length > 0 ? "solid" : "bordered"}
                                    color={formData.linked_attendance_session_ids.length > 0 ? "primary" : "default"}
                                    onPress={() => {
                                        if (formData.linked_attendance_session_ids.length > 0) {
                                            setFormData(prev => ({ 
                                                ...prev, 
                                                linked_attendance_session_ids: [],
                                                linked_attendance_session_id: null 
                                            }));
                                        }
                                    }}
                                    startContent={
                                        <Icon 
                                            icon={formData.linked_attendance_session_ids.length > 0 ? "solar:link-bold" : "solar:link-broken-bold"} 
                                            className="text-lg" 
                                        />
                                    }
                                >
                                    {formData.linked_attendance_session_ids.length > 0 
                                        ? (isEnglish
                                            ? `Linked ${formatCount(formData.linked_attendance_session_ids.length, "session", "sessions")}`
                                            : `ลิงก์ ${formData.linked_attendance_session_ids.length} รอบ`)
                                        : (isEnglish ? "Not linked" : "ไม่ลิงก์")}
                                </Button>
                            </div>
                            
                            {isLoadingSessions ? (
                                <div className="p-4 text-center text-default-500">
                                    <Icon icon="svg-spinners:3-dots-fade" className="text-2xl" />
                                </div>
                            ) : attendanceSessions.length > 0 ? (
                                <Select
                                    placeholder={isEnglish ? "Select attendance sessions to link (multiple allowed)" : "เลือกรอบเช็คชื่อที่ต้องการลิงก์ (เลือกได้หลายรอบ)"}
                                    selectionMode="multiple"
                                    size="md"
                                    selectedKeys={new Set(formData.linked_attendance_session_ids.map(String))}
                                    onSelectionChange={(keys) => {
                                        const selectedIds = Array.from(keys).map(k => parseInt(k as string));
                                        setFormData(prev => ({ 
                                            ...prev, 
                                            linked_attendance_session_ids: selectedIds,
                                            linked_attendance_session_id: selectedIds.length === 1 ? selectedIds[0] : null
                                        }));
                                    }}
                                    variant="bordered"
                                    classNames={{
                                        trigger: "bg-content1 border-default-200",
                                        value: "text-foreground",
                                    }}
                                >
                                    {attendanceSessions.map((session) => (
                                        <SelectItem key={String(session.id)} textValue={session.title}>
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <span className="font-medium">{session.title}</span>
                                                    <span className="ml-2 text-xs text-default-500">
                                                        {formatLocalizedDate(session.start_time, isEnglish)}
                                                    </span>
                                                </div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </Select>
                            ) : (
                                <div className="rounded-lg bg-content3 p-3 text-center">
                                    <Icon icon="solar:clipboard-list-linear" className="mb-1 text-xl text-default-400" />
                                    <p className="text-sm text-default-500">{isEnglish ? "No attendance sessions yet" : "ยังไม่มีรอบเช็คชื่อ"}</p>
                                </div>
                            )}
                            
                            {/* Attendance Condition (AND/OR) - Only show when multiple sessions selected */}
                            {formData.linked_attendance_session_ids.length > 1 && (
                                <div className="mt-4 rounded-lg border border-default-200 bg-content1 p-3">
                                    <label className="mb-3 block text-sm font-medium text-default-600">
                                        {isEnglish ? "Attendance requirement" : "เงื่อนไขการเช็คชื่อ"}
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, attendance_condition: "or" }))}
                                            className={`p-3 rounded-lg border-2 transition-all text-left ${
                                                formData.attendance_condition === "or"
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-default-200 hover:border-default-300"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icon 
                                                    icon="solar:alt-arrow-right-bold" 
                                                    className={formData.attendance_condition === "or" ? "text-blue-600" : "text-default-400"} 
                                                />
                                                <span className={`font-semibold ${formData.attendance_condition === "or" ? "text-blue-700" : "text-default-600"}`}>
                                                    {isEnglish ? "At least one session" : "อย่างน้อย 1 รอบ"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-default-500">{isEnglish ? "Students can receive scores if they attended at least one linked session." : "มาเรียนอย่างน้อย 1 รอบถึงจะลงคะแนนได้"}</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, attendance_condition: "and" }))}
                                            className={`p-3 rounded-lg border-2 transition-all text-left ${
                                                formData.attendance_condition === "and"
                                                    ? "border-amber-500 bg-amber-50"
                                                    : "border-default-200 hover:border-default-300"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icon 
                                                    icon="solar:check-circle-bold" 
                                                    className={formData.attendance_condition === "and" ? "text-amber-600" : "text-default-400"} 
                                                />
                                                <span className={`font-semibold ${formData.attendance_condition === "and" ? "text-amber-700" : "text-default-600"}`}>
                                                    {isEnglish ? "Every session" : "ทุกรอบ"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-default-500">{isEnglish ? "Students must attend every linked session to receive scores." : "ต้องมาเรียนครบทุกรอบถึงจะลงคะแนนได้"}</p>
                                        </button>
                                    </div>
                                </div>
                            )}
                            
                            {formData.linked_attendance_session_ids.length > 0 && (
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="flex items-start gap-2 text-blue-700">
                                        <Icon icon="solar:info-circle-bold" className="mt-0.5" />
                                        <div className="text-sm">
                                            <span className="font-medium">
                                                {formData.linked_attendance_session_ids.length === 1 
                                                    ? (isEnglish ? "Students absent from this attendance session cannot receive a score." : "นักศึกษาที่ขาดเรียนในรอบเช็คชื่อนี้ จะไม่สามารถลงคะแนนได้")
                                                    : formData.attendance_condition === "or"
                                                        ? (isEnglish
                                                            ? `Students absent from all ${formatCount(formData.linked_attendance_session_ids.length, "linked session", "linked sessions")} cannot receive a score.`
                                                            : `นักศึกษาที่ขาดเรียนทั้ง ${formData.linked_attendance_session_ids.length} รอบ จะไม่สามารถลงคะแนนได้`)
                                                        : (isEnglish
                                                            ? `Students must attend all ${formatCount(formData.linked_attendance_session_ids.length, "linked session", "linked sessions")} to receive a score.`
                                                            : `นักศึกษาต้องมาเรียนครบทุกรอบ (${formData.linked_attendance_session_ids.length} รอบ) จึงจะลงคะแนนได้`)
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Has Sub Items Toggle */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-default-600">{isEnglish ? "Score format" : "รูปแบบคะแนน"}</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    disabled={!!editingAssignment}
                                    onClick={() => setFormData(prev => ({
                                        ...prev,
                                        hasSubItems: false,
                                        subItems: []
                                    }))}
                                    className={`p-4 rounded-xl border-2 transition-all ${!formData.hasSubItems
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-default-200 hover:border-default-300"
                                        } ${editingAssignment ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                    <Icon icon="solar:document-bold" className={`text-3xl mx-auto mb-2 ${!formData.hasSubItems ? "text-blue-500" : "text-default-400"
                                        }`} />
                                    <p className={`font-semibold ${!formData.hasSubItems ? "text-blue-600" : "text-default-600"
                                        }`}>{isEnglish ? "Single score" : "คะแนนเดียว"}</p>
                                    <p className="mt-1 text-xs text-default-500">{isEnglish ? "One total score for the assignment" : "ให้คะแนนรวมทั้งงาน"}</p>
                                </button>
                                <button
                                    type="button"
                                    disabled={!!editingAssignment}
                                    onClick={() => setFormData(prev => ({
                                        ...prev,
                                        hasSubItems: true,
                                        subItems: prev.subItems.length > 0 ? prev.subItems : [
                                            { name: isEnglish ? "Item 1" : "ข้อ 1", max_score: 10 }
                                        ]
                                    }))}
                                    className={`p-4 rounded-xl border-2 transition-all ${formData.hasSubItems
                                            ? "border-amber-500 bg-amber-50"
                                            : "border-default-200 hover:border-default-300"
                                        } ${editingAssignment ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                    <Icon icon="solar:checklist-bold" className={`text-3xl mx-auto mb-2 ${formData.hasSubItems ? "text-amber-500" : "text-default-400"
                                        }`} />
                                    <p className={`font-semibold ${formData.hasSubItems ? "text-amber-600" : "text-default-600"
                                        }`}>{isEnglish ? "Sub-items" : "มีข้อย่อย"}</p>
                                    <p className="mt-1 text-xs text-default-500">{isEnglish ? "Split into multiple graded items" : "แบ่งเป็นหลายข้อย่อย"}</p>
                                </button>
                            </div>
                        </div>

                        {/* Single Score Input */}
                        {!formData.hasSubItems && (
                            <Input
                                type="number"
                                label={isEnglish ? "Max score" : "คะแนนเต็ม"}
                                labelPlacement="outside"
                                placeholder={isEnglish ? "e.g. 10, 20, 100" : "เช่น 10, 20, 100"}
                                variant="bordered"
                                size="md"
                                min={0}
                                step="any"
                                value={formData.maxScore.toString()}
                                onValueChange={(val) => setFormData(prev => ({ ...prev, maxScore: parseFloat(val) || 0 }))}
                                isRequired
                                endContent={<span className="text-sm text-default-400">{isEnglish ? "points" : "คะแนน"}</span>}
                                className="pt-6"
                                classNames={{
                                    inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-sm font-medium text-default-600",
                                }}
                            />
                        )}

                        {/* Sub Items Editor */}
                        {formData.hasSubItems && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-medium text-default-600">
                                        {isEnglish
                                            ? `Sub-items (${formatCount(formData.subItems.length, "item", "items")})`
                                            : `ข้อย่อย (${formData.subItems.length} ข้อ)`}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-600">
                                            {isEnglish
                                                ? `Total ${formatPoints(Number.isInteger(totalSubItemScore) ? totalSubItemScore : Number(totalSubItemScore.toFixed(2)), true)}`
                                                : `รวม ${Number.isInteger(totalSubItemScore) ? totalSubItemScore : totalSubItemScore.toFixed(2)} คะแนน`}
                                        </Chip>
                                        <Button
                                            size="sm"
                                            color="primary"
                                            variant="flat"
                                            startContent={<Icon icon="solar:add-circle-linear" />}
                                            onPress={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    subItems: [
                                                        ...prev.subItems,
                                                        {
                                                            name: isEnglish ? `Item ${prev.subItems.length + 1}` : `ข้อ ${prev.subItems.length + 1}`,
                                                            max_score: 10
                                                        }
                                                    ]
                                                }));
                                            }}
                                        >
                                            {isEnglish ? "Add item" : "เพิ่มข้อ"}
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                    {formData.subItems.map((subItem, idx) => (
                                        <div
                                            key={subItem.id || idx}
                                            className="flex items-center gap-3 rounded-xl bg-content2/80 p-3"
                                        >
                                            <span className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 text-sm font-bold rounded-full shrink-0">
                                                {idx + 1}
                                            </span>
                                            <Input
                                                size="sm"
                                                variant="bordered"
                                                placeholder={isEnglish ? "Sub-item name" : "ชื่อข้อย่อย"}
                                                value={subItem.name}
                                                onValueChange={(val) => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        subItems: prev.subItems.map((s, i) =>
                                                            i === idx ? { ...s, name: val } : s
                                                        )
                                                    }));
                                                }}
                                                classNames={{
                                                    inputWrapper: "h-10 bg-content1 border-default-200",
                                                }}
                                            />
                                            <Input
                                                type="number"
                                                size="sm"
                                                variant="bordered"
                                                placeholder={isEnglish ? "Points" : "คะแนน"}
                                                min={0}
                                                step="any"
                                                value={subItem.max_score.toString()}
                                                onValueChange={(val) => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        subItems: prev.subItems.map((s, i) =>
                                                            i === idx ? { ...s, max_score: parseFloat(val) || 0 } : s
                                                        )
                                                    }));
                                                }}
                                                className="w-36"
                                                endContent={<span className="text-xs text-default-400">{isEnglish ? "points" : "คะแนน"}</span>}
                                                classNames={{
                                                    inputWrapper: "h-10 bg-content1 border-default-200",
                                                }}
                                            />
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="light"
                                                color="danger"
                                                isDisabled={formData.subItems.length <= 1}
                                                onPress={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        subItems: prev.subItems.filter((_, i) => i !== idx)
                                                    }));
                                                }}
                                            >
                                                <Icon icon="solar:trash-bin-trash-linear" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <Input
                            label={isEnglish ? "Additional details" : "รายละเอียดเพิ่มเติม"}
                            labelPlacement="outside"
                            placeholder={isEnglish ? "Description for the assignment (optional)" : "คำอธิบายเกี่ยวกับงาน (ถ้ามี)"}
                            variant="bordered"
                            size="md"
                            value={formData.description}
                            onValueChange={(val) => setFormData(prev => ({ ...prev, description: val }))}
                            className="pt-4"
                            classNames={{
                                inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                label: "text-sm font-medium text-default-600",
                            }}
                        />

                        {/* Score Visibility Toggle */}
                        <div className="rounded-xl border border-default-200 bg-content2/80 p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${formData.isScoreVisible ? 'bg-green-100' : 'bg-amber-100'}`}>
                                        <Icon 
                                            icon={formData.isScoreVisible ? "solar:eye-bold" : "solar:eye-closed-bold"} 
                                            className={`text-lg ${formData.isScoreVisible ? 'text-green-600' : 'text-amber-600'}`} 
                                        />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-default-700">{isEnglish ? "Student score visibility" : "การแสดงคะแนนต่อนักศึกษา"}</p>
                                        <p className="text-xs text-default-500">
                                            {formData.isScoreVisible 
                                                ? (isEnglish ? "Students can view scores for this assignment" : "นักศึกษาสามารถดูคะแนนงานนี้ได้")
                                                : (isEnglish ? "Hidden - students cannot see scores for this assignment" : "ซ่อนคะแนน - นักศึกษาจะไม่เห็นคะแนนงานนี้")}
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    isSelected={formData.isScoreVisible}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, isScoreVisible: value }))}
                                    color="success"
                                    size="lg"
                                />
                            </div>
                            {!formData.isScoreVisible && (
                                <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                    <p className="text-xs text-amber-700 flex items-start gap-2">
                                        <Icon icon="solar:info-circle-bold" className="mt-0.5 shrink-0" />
                                        <span>
                                            {isEnglish
                                                ? "This assignment's scores will not appear in student score search, but grading and Excel export will still work normally."
                                                : "คะแนนงานนี้จะไม่แสดงในหน้าค้นหาคะแนนของนักศึกษา แต่ยังสามารถลงคะแนนและ Export Excel ได้ตามปกติ"}
                                        </span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </ModalBody>

                <ModalFooter className="border-t border-divider px-6 py-4">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 text-sm text-default-500">
                            {canSaveAsDraft && (
                                <Button
                                    size="md"
                                    variant="flat"
                                    color="warning"
                                    onPress={handleSaveDraft}
                                    isLoading={isSubmitting}
                                    isDisabled={!isCourseActive || (editingAssignment ? !hasFormChanges() : !formData.name.trim())}
                                    className={instructorFlatButtonClass("bg-yellow-100/70 text-yellow-700 opacity-70 hover:bg-yellow-100 hover:opacity-100")}
                                >
                                    {editingAssignment
                                        ? (isEnglish ? "Save draft" : "บันทึกฉบับร่าง")
                                        : (isEnglish ? "Create draft" : "สร้างฉบับร่าง")}
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="light"
                                onPress={onClose}
                            >
                                {isEnglish ? "Cancel" : "ยกเลิก"}
                            </Button>
                            <Button
                                color={isEditingDraft ? "success" : "primary"}
                                onPress={handleSaveChanges}
                                isLoading={isSubmitting}
                                isDisabled={!isCourseActive || (editingAssignment ? !hasFormChanges() : !formData.name.trim())}
                                className={isEditingDraft
                                    ? instructorFlatButtonClass("bg-emerald-600 text-white")
                                    : instructorPrimaryButtonClass()}
                            >
                                {isEditingDraft
                                    ? (isEnglish ? "Save and publish" : "บันทึกและเผยแพร่")
                                    : (editingAssignment
                                        ? (isEnglish ? "Save changes" : "บันทึกการแก้ไข")
                                        : (isEnglish ? "Create assignment" : "สร้างงาน"))}
                            </Button>
                        </div>
                    </div>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

export const AssignmentModal = memo(AssignmentModalComponent);
