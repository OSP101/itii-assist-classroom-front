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
    return isEnglish ? formatCount(points, "point", "points") : `${points} à¸„à¸°à¹à¸™à¸™`;
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
    return isEnglish ? `${dateText} at ${timeText}` : `${dateText} à¹€à¸§à¸¥à¸² ${timeText} à¸™.`;
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
                const populated: AssignmentFormData = {
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
                title: isEnglish ? "Missing information" : "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¸„à¸£à¸š",
                description: isEnglish ? "Please enter an assignment name." : "à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸Šà¸·à¹ˆà¸­à¸‡à¸²à¸™",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (formData.hasSubItems && formData.subItems.length === 0) {
            addToast({
                title: isEnglish ? "Missing information" : "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¸„à¸£à¸š",
                description: isEnglish ? "Please add at least one sub-item." : "à¸à¸£à¸¸à¸“à¸²à¹€à¸žà¸´à¹ˆà¸¡à¸‚à¹‰à¸­à¸¢à¹ˆà¸­à¸¢à¸­à¸¢à¹ˆà¸²à¸‡à¸™à¹‰à¸­à¸¢ 1 à¸‚à¹‰à¸­",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (formData.assignment_type === "weekly_group" && !formData.week_number) {
            addToast({
                title: isEnglish ? "Missing information" : "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¸„à¸£à¸š",
                description: isEnglish ? "Please select a week." : "à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ",
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
                linked_attendance_session_ids: formData.linked_attendance_session_ids.length > 0 
                    ? formData.linked_attendance_session_ids 
                    : undefined,
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
                    title: isEnglish ? "Success" : "à¸ªà¸³à¹€à¸£à¹‡à¸ˆ",
                    description: editingAssignment
                        ? (isDraft
                            ? (isEnglish ? "Draft saved." : "à¸šà¸±à¸™à¸—à¸¶à¸à¸£à¹ˆà¸²à¸‡à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢")
                            : (isEnglish ? "Assignment updated." : "à¹à¸à¹‰à¹„à¸‚à¸‡à¸²à¸™à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢"))
                        : (isDraft
                            ? (isEnglish ? "Draft created." : "à¸ªà¸£à¹‰à¸²à¸‡à¸‰à¸šà¸±à¸šà¸£à¹ˆà¸²à¸‡à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢")
                            : (isEnglish ? "Assignment created." : "à¸ªà¸£à¹‰à¸²à¸‡à¸‡à¸²à¸™à¹ƒà¸«à¸¡à¹ˆà¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢")),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                onSuccess();
                onClose();
            } else {
                throw new Error(isEnglish ? "Unable to save the assignment." : "à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸šà¸±à¸™à¸—à¸¶à¸à¸‡à¸²à¸™à¹„à¸”à¹‰");
            }
        } catch (error: any) {
            console.error("Failed to save assignment:", error);
            addToast({
                title: isEnglish ? "Error" : "à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”",
                description: isEnglish ? "Unable to save the assignment." : (error.message || "à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸šà¸±à¸™à¸—à¸¶à¸à¸‡à¸²à¸™à¹„à¸”à¹‰"),
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
                                    ? (isEnglish ? "Edit assignment" : "à¹à¸à¹‰à¹„à¸‚à¸‡à¸²à¸™")
                                    : (isEnglish ? "Create assignment" : "à¸ªà¸£à¹‰à¸²à¸‡à¸‡à¸²à¸™à¹ƒà¸«à¸¡à¹ˆ")}
                            </h3>
                            <p className="mt-1 text-sm font-normal text-default-500">
                                {isEnglish ? "Define grading items for this course." : "à¸à¸³à¸«à¸™à¸”à¸«à¸±à¸§à¸‚à¹‰à¸­à¸‡à¸²à¸™à¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸²à¸£à¸¥à¸‡à¸„à¸°à¹à¸™à¸™"}
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
                                            {isEditingPublished ? (isEnglish ? "Published assignment" : "à¸‡à¸²à¸™à¸—à¸µà¹ˆà¹€à¸œà¸¢à¹à¸žà¸£à¹ˆà¹à¸¥à¹‰à¸§") : (isEnglish ? "Draft workflow" : "à¹‚à¸«à¸¡à¸”à¸‰à¸šà¸±à¸šà¸£à¹ˆà¸²à¸‡")}
                                        </p>
                                        <Chip
                                            size="sm"
                                            variant="flat"
                                            className={isEditingPublished ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}
                                        >
                                            {isEditingPublished ? (isEnglish ? "Published" : "à¹€à¸œà¸¢à¹à¸žà¸£à¹ˆà¹à¸¥à¹‰à¸§") : (isEnglish ? "Draft" : "à¸‰à¸šà¸±à¸šà¸£à¹ˆà¸²à¸‡")}
                                        </Chip>
                                    </div>
                                    <p className={`text-xs ${isEditingPublished ? "text-emerald-700" : "text-yellow-800"}`}>
                                        {isEditingPublished
                                            ? (isEnglish
                                                ? "This assignment is already visible in the course. It can be edited, but it cannot be moved back to draft."
                                                : "à¸‡à¸²à¸™à¸™à¸µà¹‰à¹€à¸œà¸¢à¹à¸žà¸£à¹ˆà¹ƒà¸™à¸£à¸²à¸¢à¸§à¸´à¸Šà¸²à¹à¸¥à¹‰à¸§ à¹à¸à¹‰à¹„à¸‚à¹„à¸”à¹‰à¸•à¸²à¸¡à¸›à¸à¸•à¸´ à¹à¸•à¹ˆà¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¢à¹‰à¸­à¸™à¸à¸¥à¸±à¸šà¹€à¸›à¹‡à¸™à¸‰à¸šà¸±à¸šà¸£à¹ˆà¸²à¸‡à¹„à¸”à¹‰")
                                            : (isEnglish
                                                ? "Save as draft to keep working later, or publish when this assignment is ready for students and staff."
                                                : "à¸šà¸±à¸™à¸—à¸¶à¸à¸‰à¸šà¸±à¸šà¸£à¹ˆà¸²à¸‡à¹€à¸žà¸·à¹ˆà¸­à¸à¸¥à¸±à¸šà¸¡à¸²à¹à¸à¹‰à¸•à¹ˆà¸­à¸ à¸²à¸¢à¸«à¸¥à¸±à¸‡à¹„à¸”à¹‰ à¸«à¸£à¸·à¸­à¹€à¸œà¸¢à¹à¸žà¸£à¹ˆà¹€à¸¡à¸·à¹ˆà¸­à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸ªà¸³à¸«à¸£à¸±à¸šà¸œà¸¹à¹‰à¸ªà¸­à¸™à¹à¸¥à¸°à¸™à¸±à¸à¸¨à¸¶à¸à¸©à¸²")}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Assignment Name */}
                        <Input
                            label={isEnglish ? "Assignment name" : "à¸Šà¸·à¹ˆà¸­à¸‡à¸²à¸™"}
                            labelPlacement="outside"
                            placeholder={isEnglish ? "e.g. Lab 1, Quiz 1, Group project" : "à¹€à¸Šà¹ˆà¸™ à¸‡à¸²à¸™à¸—à¸µà¹ˆ 1, Quiz 1, à¹‚à¸›à¸£à¹€à¸ˆà¸„à¸à¸¥à¸¸à¹ˆà¸¡"}
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
                            <label className="mb-2 block text-sm font-medium text-default-600">{isEnglish ? "Assignment type" : "à¸›à¸£à¸°à¹€à¸ à¸—à¸‡à¸²à¸™"}</label>
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
                                        }`}>Laboratory</p>
                                    <p className="mt-1 text-xs text-default-500">{isEnglish ? "In-class work" : "à¸‡à¸²à¸™à¹ƒà¸™à¸„à¸²à¸š"}</p>
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
                                    <p className="mt-1 text-xs text-default-500">{isEnglish ? "Homework" : "à¸à¸²à¸£à¸šà¹‰à¸²à¸™"}</p>
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
                                        }`}>{isEnglish ? "Project group" : "à¸à¸¥à¸¸à¹ˆà¸¡à¹‚à¸›à¸£à¹€à¸ˆà¸à¸•à¹Œ"}</p>
                                    <p className="mt-1 text-xs text-default-500">{isEnglish ? "Permanent team work" : "à¸‡à¸²à¸™à¸à¸¥à¸¸à¹ˆà¸¡"}</p>
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
                                        }`}>{isEnglish ? "Weekly group" : "à¸à¸¥à¸¸à¹ˆà¸¡à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ"}</p>
                                    <p className="mt-1 text-xs text-default-500">{isEnglish ? "Weekly team work" : "à¸à¸¥à¸¸à¹ˆà¸¡à¸£à¸²à¸¢à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ"}</p>
                                </button>
                            </div>
                        </div>

                        {/* Week Number - Only show for weekly group */}
                        {formData.assignment_type === "weekly_group" && (
                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                                <label className="mb-2 block text-sm font-medium text-default-600">{isEnglish ? "Week" : "à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œà¸—à¸µà¹ˆ"}</label>
                                {Object.keys(weeklyTeams).length > 0 ? (
                                    <Select
                                        placeholder={isEnglish ? "Select week" : "à¹€à¸¥à¸·à¸­à¸à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ"}
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
                                                <SelectItem key={weekNum.toString()} textValue={isEnglish ? `Week ${weekNum}` : `à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œà¸—à¸µà¹ˆ ${weekNum}`}>
                                                    <div className="flex items-center justify-between w-full">
                                                        <span>{isEnglish ? `Week ${weekNum}` : `à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œà¸—à¸µà¹ˆ ${weekNum}`}</span>
                                                        <span className="text-xs text-default-500">
                                                            ({isEnglish
                                                                ? formatCount(weeklyTeams[weekNum]?.length || 0, "group", "groups")
                                                                : `${weeklyTeams[weekNum]?.length || 0} à¸à¸¥à¸¸à¹ˆà¸¡`})
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                    </Select>
                                ) : (
                                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                                        <Icon icon="solar:info-circle-bold" className="text-amber-500 text-xl mb-1" />
                                        <p className="text-sm text-amber-700">{isEnglish ? "No weekly groups yet" : "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸à¸¥à¸¸à¹ˆà¸¡à¸›à¸£à¸°à¸ˆà¸³à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ"}</p>
                                        <p className="text-xs text-amber-600 mt-1">{isEnglish ? "Create weekly groups first." : "à¸à¸£à¸¸à¸“à¸²à¸ªà¸£à¹‰à¸²à¸‡à¸à¸¥à¸¸à¹ˆà¸¡à¸›à¸£à¸°à¸ˆà¸³à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œà¸à¹ˆà¸­à¸™"}</p>
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
                                        <span className="font-semibold text-default-700">{isEnglish ? "Link attendance sessions" : "à¸¥à¸´à¸‡à¸à¹Œà¸à¸±à¸šà¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­"}</span>
                                        <p className="text-xs text-default-500">{isEnglish ? "You can link multiple attendance sessions." : "à¸ªà¸²à¸¡à¸²à¸£à¸–à¹€à¸¥à¸·à¸­à¸à¸«à¸¥à¸²à¸¢à¸£à¸­à¸šà¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¹„à¸”à¹‰"}</p>
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
                                            : `à¸¥à¸´à¸‡à¸à¹Œ ${formData.linked_attendance_session_ids.length} à¸£à¸­à¸š`)
                                        : (isEnglish ? "Not linked" : "à¹„à¸¡à¹ˆà¸¥à¸´à¸‡à¸à¹Œ")}
                                </Button>
                            </div>
                            
                            {isLoadingSessions ? (
                                <div className="p-4 text-center text-default-500">
                                    <Icon icon="svg-spinners:3-dots-fade" className="text-2xl" />
                                </div>
                            ) : attendanceSessions.length > 0 ? (
                                <Select
                                    placeholder={isEnglish ? "Select attendance sessions to link (multiple allowed)" : "à¹€à¸¥à¸·à¸­à¸à¸£à¸­à¸šà¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸¥à¸´à¸‡à¸à¹Œ (à¹€à¸¥à¸·à¸­à¸à¹„à¸”à¹‰à¸«à¸¥à¸²à¸¢à¸£à¸­à¸š)"}
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
                                    <p className="text-sm text-default-500">{isEnglish ? "No attendance sessions yet" : "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸£à¸­à¸šà¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­"}</p>
                                </div>
                            )}
                            
                            {/* Attendance Condition (AND/OR) - Only show when multiple sessions selected */}
                            {formData.linked_attendance_session_ids.length > 1 && (
                                <div className="mt-4 rounded-lg border border-default-200 bg-content1 p-3">
                                    <label className="mb-3 block text-sm font-medium text-default-600">
                                        {isEnglish ? "Attendance requirement" : "à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚à¸à¸²à¸£à¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­"}
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
                                                    {isEnglish ? "At least one session" : "à¸­à¸¢à¹ˆà¸²à¸‡à¸™à¹‰à¸­à¸¢ 1 à¸£à¸­à¸š"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-default-500">{isEnglish ? "Students can receive scores if they attended at least one linked session." : "à¸¡à¸²à¹€à¸£à¸µà¸¢à¸™à¸­à¸¢à¹ˆà¸²à¸‡à¸™à¹‰à¸­à¸¢ 1 à¸£à¸­à¸šà¸–à¸¶à¸‡à¸ˆà¸°à¸¥à¸‡à¸„à¸°à¹à¸™à¸™à¹„à¸”à¹‰"}</p>
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
                                                    {isEnglish ? "Every session" : "à¸—à¸¸à¸à¸£à¸­à¸š"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-default-500">{isEnglish ? "Students must attend every linked session to receive scores." : "à¸•à¹‰à¸­à¸‡à¸¡à¸²à¹€à¸£à¸µà¸¢à¸™à¸„à¸£à¸šà¸—à¸¸à¸à¸£à¸­à¸šà¸–à¸¶à¸‡à¸ˆà¸°à¸¥à¸‡à¸„à¸°à¹à¸™à¸™à¹„à¸”à¹‰"}</p>
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
                                                    ? (isEnglish ? "Students absent from this attendance session cannot receive a score." : "à¸™à¸±à¸à¸¨à¸¶à¸à¸©à¸²à¸—à¸µà¹ˆà¸‚à¸²à¸”à¹€à¸£à¸µà¸¢à¸™à¹ƒà¸™à¸£à¸­à¸šà¹€à¸Šà¹‡à¸„à¸Šà¸·à¹ˆà¸­à¸™à¸µà¹‰ à¸ˆà¸°à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¥à¸‡à¸„à¸°à¹à¸™à¸™à¹„à¸”à¹‰")
                                                    : formData.attendance_condition === "or"
                                                        ? (isEnglish
                                                            ? `Students absent from all ${formatCount(formData.linked_attendance_session_ids.length, "linked session", "linked sessions")} cannot receive a score.`
                                                            : `à¸™à¸±à¸à¸¨à¸¶à¸à¸©à¸²à¸—à¸µà¹ˆà¸‚à¸²à¸”à¹€à¸£à¸µà¸¢à¸™à¸—à¸±à¹‰à¸‡ ${formData.linked_attendance_session_ids.length} à¸£à¸­à¸š à¸ˆà¸°à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¥à¸‡à¸„à¸°à¹à¸™à¸™à¹„à¸”à¹‰`)
                                                        : (isEnglish
                                                            ? `Students must attend all ${formatCount(formData.linked_attendance_session_ids.length, "linked session", "linked sessions")} to receive a score.`
                                                            : `à¸™à¸±à¸à¸¨à¸¶à¸à¸©à¸²à¸•à¹‰à¸­à¸‡à¸¡à¸²à¹€à¸£à¸µà¸¢à¸™à¸„à¸£à¸šà¸—à¸¸à¸à¸£à¸­à¸š (${formData.linked_attendance_session_ids.length} à¸£à¸­à¸š) à¸ˆà¸¶à¸‡à¸ˆà¸°à¸¥à¸‡à¸„à¸°à¹à¸™à¸™à¹„à¸”à¹‰`)
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Has Sub Items Toggle */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-default-600">{isEnglish ? "Score format" : "à¸£à¸¹à¸›à¹à¸šà¸šà¸„à¸°à¹à¸™à¸™"}</label>
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
                                        }`}>{isEnglish ? "Single score" : "à¸„à¸°à¹à¸™à¸™à¹€à¸”à¸µà¸¢à¸§"}</p>
                                    <p className="mt-1 text-xs text-default-500">{isEnglish ? "One total score for the assignment" : "à¹ƒà¸«à¹‰à¸„à¸°à¹à¸™à¸™à¸£à¸§à¸¡à¸—à¸±à¹‰à¸‡à¸‡à¸²à¸™"}</p>
                                </button>
                                <button
                                    type="button"
                                    disabled={!!editingAssignment}
                                    onClick={() => setFormData(prev => ({
                                        ...prev,
                                        hasSubItems: true,
                                        subItems: prev.subItems.length > 0 ? prev.subItems : [
                                            { name: isEnglish ? "Item 1" : "à¸‚à¹‰à¸­ 1", max_score: 10 }
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
                                        }`}>{isEnglish ? "Sub-items" : "à¸¡à¸µà¸‚à¹‰à¸­à¸¢à¹ˆà¸­à¸¢"}</p>
                                    <p className="mt-1 text-xs text-default-500">{isEnglish ? "Split into multiple graded items" : "à¹à¸šà¹ˆà¸‡à¹€à¸›à¹‡à¸™à¸«à¸¥à¸²à¸¢à¸‚à¹‰à¸­à¸¢à¹ˆà¸­à¸¢"}</p>
                                </button>
                            </div>
                        </div>

                        {/* Single Score Input */}
                        {!formData.hasSubItems && (
                            <Input
                                type="number"
                                label={isEnglish ? "Max score" : "à¸„à¸°à¹à¸™à¸™à¹€à¸•à¹‡à¸¡"}
                                labelPlacement="outside"
                                placeholder={isEnglish ? "e.g. 10, 20, 100" : "à¹€à¸Šà¹ˆà¸™ 10, 20, 100"}
                                variant="bordered"
                                size="md"
                                min={0}
                                step="any"
                                value={formData.maxScore.toString()}
                                onValueChange={(val) => setFormData(prev => ({ ...prev, maxScore: parseFloat(val) || 0 }))}
                                isRequired
                                endContent={<span className="text-sm text-default-400">{isEnglish ? "points" : "à¸„à¸°à¹à¸™à¸™"}</span>}
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
                                            : `à¸‚à¹‰à¸­à¸¢à¹ˆà¸­à¸¢ (${formData.subItems.length} à¸‚à¹‰à¸­)`}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-600">
                                            {isEnglish
                                                ? `Total ${formatPoints(Number.isInteger(totalSubItemScore) ? totalSubItemScore : Number(totalSubItemScore.toFixed(2)), true)}`
                                                : `à¸£à¸§à¸¡ ${Number.isInteger(totalSubItemScore) ? totalSubItemScore : totalSubItemScore.toFixed(2)} à¸„à¸°à¹à¸™à¸™`}
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
                                                            name: isEnglish ? `Item ${prev.subItems.length + 1}` : `à¸‚à¹‰à¸­ ${prev.subItems.length + 1}`,
                                                            max_score: 10
                                                        }
                                                    ]
                                                }));
                                            }}
                                        >
                                            {isEnglish ? "Add item" : "à¹€à¸žà¸´à¹ˆà¸¡à¸‚à¹‰à¸­"}
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
                                                placeholder={isEnglish ? "Sub-item name" : "à¸Šà¸·à¹ˆà¸­à¸‚à¹‰à¸­à¸¢à¹ˆà¸­à¸¢"}
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
                                                placeholder={isEnglish ? "Points" : "à¸„à¸°à¹à¸™à¸™"}
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
                                                endContent={<span className="text-xs text-default-400">{isEnglish ? "points" : "à¸„à¸°à¹à¸™à¸™"}</span>}
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
                            label={isEnglish ? "Additional details" : "à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡"}
                            labelPlacement="outside"
                            placeholder={isEnglish ? "Description for the assignment (optional)" : "à¸„à¸³à¸­à¸˜à¸´à¸šà¸²à¸¢à¹€à¸à¸µà¹ˆà¸¢à¸§à¸à¸±à¸šà¸‡à¸²à¸™ (à¸–à¹‰à¸²à¸¡à¸µ)"}
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
                                        <p className="text-sm font-medium text-default-700">{isEnglish ? "Student score visibility" : "à¸à¸²à¸£à¹à¸ªà¸”à¸‡à¸„à¸°à¹à¸™à¸™à¸•à¹ˆà¸­à¸™à¸±à¸à¸¨à¸¶à¸à¸©à¸²"}</p>
                                        <p className="text-xs text-default-500">
                                            {formData.isScoreVisible 
                                                ? (isEnglish ? "Students can view scores for this assignment" : "à¸™à¸±à¸à¸¨à¸¶à¸à¸©à¸²à¸ªà¸²à¸¡à¸²à¸£à¸–à¸”à¸¹à¸„à¸°à¹à¸™à¸™à¸‡à¸²à¸™à¸™à¸µà¹‰à¹„à¸”à¹‰")
                                                : (isEnglish ? "Hidden - students cannot see scores for this assignment" : "à¸‹à¹ˆà¸­à¸™à¸„à¸°à¹à¸™à¸™ - à¸™à¸±à¸à¸¨à¸¶à¸à¸©à¸²à¸ˆà¸°à¹„à¸¡à¹ˆà¹€à¸«à¹‡à¸™à¸„à¸°à¹à¸™à¸™à¸‡à¸²à¸™à¸™à¸µà¹‰")
                                            }
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
                                                : "à¸„à¸°à¹à¸™à¸™à¸‡à¸²à¸™à¸™à¸µà¹‰à¸ˆà¸°à¹„à¸¡à¹ˆà¹à¸ªà¸”à¸‡à¹ƒà¸™à¸«à¸™à¹‰à¸²à¸„à¹‰à¸™à¸«à¸²à¸„à¸°à¹à¸™à¸™à¸‚à¸­à¸‡à¸™à¸±à¸à¸¨à¸¶à¸à¸©à¸² à¹à¸•à¹ˆà¸¢à¸±à¸‡à¸ªà¸²à¸¡à¸²à¸£à¸–à¸¥à¸‡à¸„à¸°à¹à¸™à¸™à¹à¸¥à¸° Export Excel à¹„à¸”à¹‰à¸•à¸²à¸¡à¸›à¸à¸•à¸´"}
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
                                        ? (isEnglish ? "Save draft" : "à¸šà¸±à¸™à¸—à¸¶à¸à¸£à¹ˆà¸²à¸‡")
                                        : (isEnglish ? "Create draft" : "à¸ªà¸£à¹‰à¸²à¸‡à¸‰à¸šà¸±à¸šà¸£à¹ˆà¸²à¸‡")}
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="light"
                                onPress={onClose}
                            >
                                {isEnglish ? "Cancel" : "à¸¢à¸à¹€à¸¥à¸´à¸"}
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
