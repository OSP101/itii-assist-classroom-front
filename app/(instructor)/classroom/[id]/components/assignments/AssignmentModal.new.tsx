"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import type { AssignmentType } from "../types";
import type { AttendanceSession } from "@/services/attendance.service";
import assignmentService from "@/services/assignment.service";
import attendanceService from "@/services/attendance.service";

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
}

interface AssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
    editingAssignment: AssignmentType | null;
    onSuccess: () => void;
    weeklyTeams?: Record<number, any[]>;
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
};

function AssignmentModalComponent({
    isOpen,
    onClose,
    courseId,
    editingAssignment,
    onSuccess,
    weeklyTeams = {},
}: AssignmentModalProps) {
    // Form state
    const [formData, setFormData] = useState<AssignmentFormData>(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

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
                setFormData({
                    name: editingAssignment.name,
                    assignment_type: editingAssignment.assignment_type,
                    week_number: editingAssignment.week_number,
                    linked_attendance_session_ids: editingAssignment.linkedAttendanceSessions?.map(s => s.id) || [],
                    linked_attendance_session_id: editingAssignment.linkedAttendanceSessions?.[0]?.id || null,
                    attendance_condition: editingAssignment.attendance_condition || "or",
                    hasSubItems: !!(editingAssignment.subItems && editingAssignment.subItems.length > 0),
                    subItems: editingAssignment.subItems?.map(s => ({
                        id: s.id,
                        name: s.name,
                        max_score: s.max_score,
                    })) || [],
                    maxScore: editingAssignment.max_score,
                    dueDate: editingAssignment.due_date || "",
                    description: editingAssignment.description || "",
                });
            } else {
                setFormData(initialFormData);
            }
        }
    }, [isOpen, editingAssignment]);

    // Handle submit
    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            addToast({
                title: "ข้อมูลไม่ครบ",
                description: "กรุณากรอกชื่องาน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        if (formData.hasSubItems && formData.subItems.length === 0) {
            addToast({
                title: "ข้อมูลไม่ครบ",
                description: "กรุณาเพิ่มข้อย่อยอย่างน้อย 1 ข้อ",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        if (formData.assignment_type === "weekly_group" && !formData.week_number) {
            addToast({
                title: "ข้อมูลไม่ครบ",
                description: "กรุณาเลือกสัปดาห์",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingAssignment) {
                // Update existing
                const result = await assignmentService.updateAssignment(editingAssignment.id, {
                    name: formData.name,
                    description: formData.description || undefined,
                    assignment_type: formData.assignment_type,
                    week_number: formData.week_number,
                    max_score: formData.hasSubItems ? undefined : formData.maxScore,
                    sub_items: formData.hasSubItems ? formData.subItems : undefined,
                    due_date: formData.dueDate || undefined,
                    linked_attendance_session_ids: formData.linked_attendance_session_ids.length > 0 
                        ? formData.linked_attendance_session_ids 
                        : [],
                    attendance_condition: formData.linked_attendance_session_ids.length > 1 
                        ? formData.attendance_condition 
                        : undefined,
                });
                if (result) {
                    addToast({
                        title: "สำเร็จ",
                        description: "แก้ไขงานเรียบร้อยแล้ว",
                        color: "success",
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });
                    onSuccess();
                    onClose();
                }
            } else {
                // Create new
                const result = await assignmentService.createAssignment({
                    course_id: courseId,
                    name: formData.name,
                    description: formData.description || undefined,
                    assignment_type: formData.assignment_type,
                    week_number: formData.week_number,
                    max_score: formData.hasSubItems ? undefined : formData.maxScore,
                    sub_items: formData.hasSubItems ? formData.subItems : undefined,
                    due_date: formData.dueDate || undefined,
                    linked_attendance_session_ids: formData.linked_attendance_session_ids.length > 0 
                        ? formData.linked_attendance_session_ids 
                        : undefined,
                    attendance_condition: formData.linked_attendance_session_ids.length > 1 
                        ? formData.attendance_condition 
                        : undefined,
                });
                if (result) {
                    addToast({
                        title: "สำเร็จ",
                        description: "สร้างงานใหม่เรียบร้อยแล้ว",
                        color: "success",
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });
                    onSuccess();
                    onClose();
                }
            }
        } catch (error) {
            console.error("Error saving assignment:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถบันทึกงานได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculate total sub items score
    const totalSubItemScore = formData.subItems.reduce((acc, sub) => acc + sub.max_score, 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                onClose();
            }}
            size="2xl"
            scrollBehavior="inside"
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg">
                            <Icon icon="solar:clipboard-list-bold" className="text-2xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {editingAssignment ? "แก้ไขงาน" : "สร้างงานใหม่"}
                            </h3>
                            <p className="text-sm text-slate-500 font-normal mt-1">
                                กำหนดหัวข้องานสำหรับการลงคะแนน
                            </p>
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody className="px-6 py-4">
                    <div className="space-y-5">
                        {/* Assignment Name */}
                        <Input
                            label="ชื่องาน"
                            labelPlacement="outside"
                            placeholder="เช่น งานที่ 1, Quiz 1, โปรเจคกลุ่ม"
                            variant="bordered"
                            size="md"
                            value={formData.name}
                            onValueChange={(val) => setFormData(prev => ({ ...prev, name: val }))}
                            isRequired
                            classNames={{
                                inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                label: "text-slate-600 font-medium text-sm",
                            }}
                        />

                        {/* Assignment Type */}
                        <div>
                            <label className="text-slate-600 font-medium text-sm mb-2 block">ประเภทงาน</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, assignment_type: "individual", week_number: undefined }))}
                                    className={`p-4 rounded-xl border-2 transition-all ${formData.assignment_type === "individual"
                                            ? "border-indigo-500 bg-indigo-50"
                                            : "border-slate-200 hover:border-slate-300"
                                        } ${editingAssignment ? "opacity-60 cursor-not-allowed" : ""}`}
                                    disabled={!!editingAssignment}
                                >
                                    <Icon icon="solar:test-tube-bold" className={`text-3xl mx-auto mb-2 ${formData.assignment_type === "individual" ? "text-indigo-500" : "text-slate-400"
                                        }`} />
                                    <p className={`font-semibold text-sm ${formData.assignment_type === "individual" ? "text-indigo-600" : "text-slate-600"
                                        }`}>Lab</p>
                                    <p className="text-xs text-slate-500 mt-1">งานในคาบ</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, assignment_type: "assignment", week_number: undefined }))}
                                    className={`p-4 rounded-xl border-2 transition-all ${formData.assignment_type === "assignment"
                                            ? "border-amber-500 bg-amber-50"
                                            : "border-slate-200 hover:border-slate-300"
                                        } ${editingAssignment ? "opacity-60 cursor-not-allowed" : ""}`}
                                    disabled={!!editingAssignment}
                                >
                                    <Icon icon="solar:document-text-bold" className={`text-3xl mx-auto mb-2 ${formData.assignment_type === "assignment" ? "text-amber-500" : "text-slate-400"
                                        }`} />
                                    <p className={`font-semibold text-sm ${formData.assignment_type === "assignment" ? "text-amber-600" : "text-slate-600"
                                        }`}>Assignment</p>
                                    <p className="text-xs text-slate-500 mt-1">การบ้าน</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, assignment_type: "permanent_group", week_number: undefined }))}
                                    className={`p-4 rounded-xl border-2 transition-all ${formData.assignment_type === "permanent_group"
                                            ? "border-purple-500 bg-purple-50"
                                            : "border-slate-200 hover:border-slate-300"
                                        } ${editingAssignment ? "opacity-60 cursor-not-allowed" : ""}`}
                                    disabled={!!editingAssignment}
                                >
                                    <Icon icon="solar:users-group-rounded-bold" className={`text-3xl mx-auto mb-2 ${formData.assignment_type === "permanent_group" ? "text-purple-500" : "text-slate-400"
                                        }`} />
                                    <p className={`font-semibold text-sm ${formData.assignment_type === "permanent_group" ? "text-purple-600" : "text-slate-600"
                                        }`}>กลุ่มโปรเจกต์</p>
                                    <p className="text-xs text-slate-500 mt-1">งานกลุ่ม</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, assignment_type: "weekly_group", week_number: prev.week_number || 1 }))}
                                    className={`p-4 rounded-xl border-2 transition-all ${formData.assignment_type === "weekly_group"
                                            ? "border-emerald-500 bg-emerald-50"
                                            : "border-slate-200 hover:border-slate-300"
                                        } ${editingAssignment ? "opacity-60 cursor-not-allowed" : ""}`}
                                    disabled={!!editingAssignment}
                                >
                                    <Icon icon="solar:calendar-bold" className={`text-3xl mx-auto mb-2 ${formData.assignment_type === "weekly_group" ? "text-emerald-500" : "text-slate-400"
                                        }`} />
                                    <p className={`font-semibold text-sm ${formData.assignment_type === "weekly_group" ? "text-emerald-600" : "text-slate-600"
                                        }`}>กลุ่มสัปดาห์</p>
                                    <p className="text-xs text-slate-500 mt-1">กลุ่มรายสัปดาห์</p>
                                </button>
                            </div>
                        </div>

                        {/* Week Number - Only show for weekly group */}
                        {formData.assignment_type === "weekly_group" && (
                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                <label className="text-slate-600 font-medium text-sm mb-2 block">สัปดาห์ที่</label>
                                {Object.keys(weeklyTeams).length > 0 ? (
                                    <Select
                                        placeholder="เลือกสัปดาห์"
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
                                            trigger: "bg-white border-slate-200",
                                            value: "text-slate-800",
                                        }}
                                    >
                                        {Object.keys(weeklyTeams)
                                            .map(Number)
                                            .sort((a, b) => a - b)
                                            .map((weekNum) => (
                                                <SelectItem key={weekNum.toString()} textValue={`สัปดาห์ที่ ${weekNum}`}>
                                                    <div className="flex items-center justify-between w-full">
                                                        <span>สัปดาห์ที่ {weekNum}</span>
                                                        <span className="text-xs text-slate-500">
                                                            ({weeklyTeams[weekNum]?.length || 0} กลุ่ม)
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                    </Select>
                                ) : (
                                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                                        <Icon icon="solar:info-circle-bold" className="text-amber-500 text-xl mb-1" />
                                        <p className="text-sm text-amber-700">ยังไม่มีกลุ่มประจำสัปดาห์</p>
                                        <p className="text-xs text-amber-600 mt-1">กรุณาสร้างกลุ่มประจำสัปดาห์ก่อน</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Link to Attendance Session - Multi-select */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <Icon icon="solar:clipboard-check-bold" className="text-lg text-blue-600" />
                                    </div>
                                    <div>
                                        <span className="font-semibold text-slate-700">ลิงก์กับการเช็คชื่อ</span>
                                        <p className="text-xs text-slate-500">สามารถเลือกหลายรอบเช็คชื่อได้</p>
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
                                        ? `ลิงก์ ${formData.linked_attendance_session_ids.length} รอบ` 
                                        : "ไม่ลิงก์"}
                                </Button>
                            </div>
                            
                            {isLoadingSessions ? (
                                <div className="p-4 text-center text-slate-500">
                                    <Icon icon="svg-spinners:3-dots-fade" className="text-2xl" />
                                </div>
                            ) : attendanceSessions.length > 0 ? (
                                <Select
                                    placeholder="เลือกรอบเช็คชื่อที่ต้องการลิงก์ (เลือกได้หลายรอบ)"
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
                                        trigger: "bg-white border-slate-200",
                                        value: "text-slate-800",
                                    }}
                                >
                                    {attendanceSessions.map((session) => (
                                        <SelectItem key={String(session.id)} textValue={session.title}>
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <span className="font-medium">{session.title}</span>
                                                    <span className="text-xs text-slate-500 ml-2">
                                                        {new Date(session.start_time).toLocaleDateString("th-TH", { 
                                                            day: "numeric", 
                                                            month: "short",
                                                            year: "2-digit"
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </Select>
                            ) : (
                                <div className="p-3 bg-slate-100 rounded-lg text-center">
                                    <Icon icon="solar:clipboard-list-linear" className="text-slate-400 text-xl mb-1" />
                                    <p className="text-sm text-slate-500">ยังไม่มีรอบเช็คชื่อ</p>
                                </div>
                            )}
                            
                            {/* Attendance Condition (AND/OR) - Only show when multiple sessions selected */}
                            {formData.linked_attendance_session_ids.length > 1 && (
                                <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
                                    <label className="text-slate-600 font-medium text-sm mb-3 block">
                                        เงื่อนไขการเช็คชื่อ
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, attendance_condition: "or" }))}
                                            className={`p-3 rounded-lg border-2 transition-all text-left ${
                                                formData.attendance_condition === "or"
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-slate-200 hover:border-slate-300"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icon 
                                                    icon="solar:alt-arrow-right-bold" 
                                                    className={formData.attendance_condition === "or" ? "text-blue-600" : "text-slate-400"} 
                                                />
                                                <span className={`font-semibold ${formData.attendance_condition === "or" ? "text-blue-700" : "text-slate-600"}`}>
                                                    อย่างน้อย 1 รอบ
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">มาเรียนอย่างน้อย 1 รอบถึงจะลงคะแนนได้</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, attendance_condition: "and" }))}
                                            className={`p-3 rounded-lg border-2 transition-all text-left ${
                                                formData.attendance_condition === "and"
                                                    ? "border-amber-500 bg-amber-50"
                                                    : "border-slate-200 hover:border-slate-300"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icon 
                                                    icon="solar:check-circle-bold" 
                                                    className={formData.attendance_condition === "and" ? "text-amber-600" : "text-slate-400"} 
                                                />
                                                <span className={`font-semibold ${formData.attendance_condition === "and" ? "text-amber-700" : "text-slate-600"}`}>
                                                    ทุกรอบ
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">ต้องมาเรียนครบทุกรอบถึงจะลงคะแนนได้</p>
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
                                                    ? "นักศึกษาที่ขาดเรียนในรอบเช็คชื่อนี้ จะไม่สามารถลงคะแนนได้"
                                                    : formData.attendance_condition === "or"
                                                        ? `นักศึกษาที่ขาดเรียนทั้ง ${formData.linked_attendance_session_ids.length} รอบ จะไม่สามารถลงคะแนนได้`
                                                        : `นักศึกษาต้องมาเรียนครบทุกรอบ (${formData.linked_attendance_session_ids.length} รอบ) จึงจะลงคะแนนได้`
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Has Sub Items Toggle */}
                        <div>
                            <label className="text-slate-600 font-medium text-sm mb-2 block">รูปแบบคะแนน</label>
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
                                            : "border-slate-200 hover:border-slate-300"
                                        } ${editingAssignment ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                    <Icon icon="solar:document-bold" className={`text-3xl mx-auto mb-2 ${!formData.hasSubItems ? "text-blue-500" : "text-slate-400"
                                        }`} />
                                    <p className={`font-semibold ${!formData.hasSubItems ? "text-blue-600" : "text-slate-600"
                                        }`}>คะแนนเดียว</p>
                                    <p className="text-xs text-slate-500 mt-1">ให้คะแนนรวมทั้งงาน</p>
                                </button>
                                <button
                                    type="button"
                                    disabled={!!editingAssignment}
                                    onClick={() => setFormData(prev => ({
                                        ...prev,
                                        hasSubItems: true,
                                        subItems: prev.subItems.length > 0 ? prev.subItems : [
                                            { name: "ข้อ 1", max_score: 5 }
                                        ]
                                    }))}
                                    className={`p-4 rounded-xl border-2 transition-all ${formData.hasSubItems
                                            ? "border-amber-500 bg-amber-50"
                                            : "border-slate-200 hover:border-slate-300"
                                        } ${editingAssignment ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                    <Icon icon="solar:checklist-bold" className={`text-3xl mx-auto mb-2 ${formData.hasSubItems ? "text-amber-500" : "text-slate-400"
                                        }`} />
                                    <p className={`font-semibold ${formData.hasSubItems ? "text-amber-600" : "text-slate-600"
                                        }`}>มีข้อย่อย</p>
                                    <p className="text-xs text-slate-500 mt-1">แบ่งเป็นหลายข้อย่อย</p>
                                </button>
                            </div>
                        </div>

                        {/* Single Score Input */}
                        {!formData.hasSubItems && (
                            <Input
                                type="number"
                                label="คะแนนเต็ม"
                                labelPlacement="outside"
                                placeholder="เช่น 10, 20, 100"
                                variant="bordered"
                                size="md"
                                min={0}
                                step="any"
                                value={formData.maxScore.toString()}
                                onValueChange={(val) => setFormData(prev => ({ ...prev, maxScore: parseFloat(val) || 0 }))}
                                isRequired
                                endContent={<span className="text-slate-400 text-sm">คะแนน</span>}
                                className="pt-6"
                                classNames={{
                                    inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            />
                        )}

                        {/* Sub Items Editor */}
                        {formData.hasSubItems && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-slate-600 font-medium text-sm">
                                        ข้อย่อย ({formData.subItems.length} ข้อ)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-600">
                                            รวม {Number.isInteger(totalSubItemScore) ? totalSubItemScore : totalSubItemScore.toFixed(2)} คะแนน
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
                                                            name: `ข้อ ${prev.subItems.length + 1}`,
                                                            max_score: 10
                                                        }
                                                    ]
                                                }));
                                            }}
                                        >
                                            เพิ่มข้อ
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                    {formData.subItems.map((subItem, idx) => (
                                        <div
                                            key={subItem.id || idx}
                                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                                        >
                                            <span className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 text-sm font-bold rounded-full flex-shrink-0">
                                                {idx + 1}
                                            </span>
                                            <Input
                                                size="sm"
                                                variant="bordered"
                                                placeholder="ชื่อข้อย่อย"
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
                                                    inputWrapper: "h-10 bg-white border-slate-200",
                                                }}
                                            />
                                            <Input
                                                type="number"
                                                size="sm"
                                                variant="bordered"
                                                placeholder="คะแนน"
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
                                                endContent={<span className="text-slate-400 text-xs">คะแนน</span>}
                                                classNames={{
                                                    inputWrapper: "h-10 bg-white border-slate-200",
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
                            label="รายละเอียดเพิ่มเติม"
                            labelPlacement="outside"
                            placeholder="คำอธิบายเกี่ยวกับงาน (ถ้ามี)"
                            variant="bordered"
                            size="md"
                            value={formData.description}
                            onValueChange={(val) => setFormData(prev => ({ ...prev, description: val }))}
                            className="pt-4"
                            classNames={{
                                inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                label: "text-slate-600 font-medium text-sm",
                            }}
                        />
                    </div>
                </ModalBody>

                <ModalFooter className="px-6 py-4 border-t border-slate-100">
                    <div className="flex items-center justify-between w-full">
                        <div className="text-sm text-slate-500">
                            {formData.hasSubItems
                                ? `คะแนนรวม: ${Number.isInteger(totalSubItemScore) ? totalSubItemScore : totalSubItemScore.toFixed(2)} คะแนน`
                                : `คะแนนเต็ม: ${formData.maxScore} คะแนน`
                            }
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="light"
                                onPress={onClose}
                            >
                                ยกเลิก
                            </Button>
                            <Button
                                color="primary"
                                onPress={handleSubmit}
                                isLoading={isSubmitting}
                                className="bg-blue-500"
                                startContent={!isSubmitting && <Icon icon={editingAssignment ? "solar:pen-bold" : "solar:add-circle-bold"} />}
                            >
                                {editingAssignment ? "บันทึกการแก้ไข" : "สร้างงาน"}
                            </Button>
                        </div>
                    </div>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

export const AssignmentModal = memo(AssignmentModalComponent);
