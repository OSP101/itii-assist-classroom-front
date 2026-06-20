"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Card, CardBody } from "@heroui/card";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";
import { Tooltip } from "@heroui/tooltip";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import scoreService, { type Student, type Group, type StudentScore, type ScoresData, type SubItemScoreData } from "@/services/score.service";
import scoreEditRequestService from "@/services/scoreEditRequest.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { formatScoreValue, isScoreInputValid, SCORE_INPUT_PATTERN, sanitizeScoreInput } from "@/lib/score-input";
import type { AssignmentType } from "./types";

// Preset reasons for score edit requests
interface PresetEditReason {
    key: string;
    label: string;
    enLabel: string;
}

const PRESET_EDIT_REASONS: PresetEditReason[] = [
    { key: "wrong_score", label: "กรอกคะแนนผิด", enLabel: "Entered the wrong score" },
    { key: "wrong_student", label: "ให้คะแนนผิดคน", enLabel: "Assigned the score to the wrong student" },
    { key: "calculation_error", label: "คำนวณคะแนนผิด", enLabel: "Calculation error" },
    { key: "missing_score", label: "ลืมให้คะแนนบางข้อ", enLabel: "Missed scoring some items" },
    { key: "recheck_request", label: "นักศึกษาขอตรวจสอบใหม่", enLabel: "Student requested a re-check" },
    { key: "other", label: "อื่นๆ (ระบุเอง)", enLabel: "Other (specify)" },
];

function localizeGeneratedSubItemName(name: string | undefined, fallbackIndex: number, isEnglish: boolean): string {
    if (!name) {
        return isEnglish ? `Item ${fallbackIndex}` : `ข้อ ${fallbackIndex}`;
    }

    if (!isEnglish) {
        return name;
    }

    const match = name.match(/^(ข้อ|ข้อย่อย|เกณฑ์)\s*(\d+)$/);
    if (match) {
        return `Item ${match[2]}`;
    }

    return name;
}

interface ScoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    assignment: AssignmentType | null;
    courseId: string;
    isCourseActive?: boolean;
    onScoreSubmitted?: () => void;
    canGradeAssignments?: boolean;
    canEditScores?: boolean;
}

interface SubItemScore {
    subItemId: number;
    score: number | string;
    maxScore: number;
}

// Interface for existing score info
interface ExistingScoreInfo {
    score: number | null;
    graded_by?: {
        id: number;
        display_name: string;
    };
    graded_at?: string;
}

// Interface for sub-item existing score
interface SubItemExistingScore {
    subItemId: number;
    score: number | null;
    graded_by?: {
        id: number;
        display_name: string;
    };
    graded_at?: string;
}

type CopySource = "from_above" | "from_first";

interface MainScoreCopySnapshot {
    scores: Record<number, string>;
    copiedScores: Record<number, boolean>;
    copiedScoreSources: Record<number, CopySource | undefined>;
}

interface SubItemScoreCopySnapshot {
    subItemScores: Record<number, Record<number, string>>;
    copiedSubItemScores: Record<number, Record<number, boolean>>;
    copiedSubItemScoreSources: Record<number, Record<number, CopySource | undefined>>;
}

const SCORE_SEARCH_AUTOCOMPLETE_CLASSNAMES = {
    base: "w-full",
    listboxWrapper: "max-h-75 p-0",
    listbox: "gap-1 p-1 bg-content1",
    popoverContent: "border border-default-200 bg-content1 text-foreground shadow-xl shadow-black/10",
    selectorButton: "text-blue-400 dark:text-blue-300",
};

const SCORE_SEARCH_LISTBOX_PROPS = {
    classNames: {
        base: "bg-content1 p-1",
        list: "gap-1",
        emptyContent: "text-default-500",
    },
    itemClasses: {
        base: "rounded-lg px-2 py-1.5 text-foreground data-[hover=true]:bg-content2 data-[focus=true]:bg-content2 data-[selected=true]:bg-primary/12 data-[selected=true]:text-foreground",
        wrapper: "gap-0.5",
        title: "text-foreground",
        description: "text-default-500",
        selectedIcon: "text-primary",
    },
};

export default function ScoreModal({
    isOpen,
    onClose,
    assignment,
    courseId,
    isCourseActive = true,
    onScoreSubmitted,
    canGradeAssignments = true,
    canEditScores = true,
}: ScoreModalProps) {
    // Determine which tabs are available
    const defaultTab: "grade" | "edit" = canGradeAssignments ? "grade" : "edit";
    const showBothTabs = canGradeAssignments && canEditScores;
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    // States
    const [activeTab, setActiveTab] = useState<"grade" | "edit">(defaultTab);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Grade tab states
    const [students, setStudents] = useState<Student[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [mainScore, setMainScore] = useState<string>("");
    const [subItemScores, setSubItemScores] = useState<SubItemScore[]>([]);
    const [comment, setComment] = useState("");
    // Grade group mode - "all" = grade all members, "selected" = grade selected members only
    const [gradeGroupMode, setGradeGroupMode] = useState<"all" | "selected">("all");
    const [gradeGroupMembers, setGradeGroupMembers] = useState<{
        studentId: number;
        studentName: string;
        selected: boolean;
        canScore: boolean;
        hasScore: boolean; // Already has a score
        existingScore: number | null;
        gradedBy: string | null;
        gradedAt: string | null;
    }[]>([]);
    const [gradeGroupMemberScores, setGradeGroupMemberScores] = useState<Record<number, string>>({});
    const [gradeGroupMemberSubItemScores, setGradeGroupMemberSubItemScores] = useState<Record<number, Record<number, string>>>({});
    const [copiedGradeMemberScores, setCopiedGradeMemberScores] = useState<Record<number, boolean>>({});
    const [copiedGradeMemberSubItemScores, setCopiedGradeMemberSubItemScores] = useState<Record<number, Record<number, boolean>>>({});
    const [copiedGradeMemberScoreSources, setCopiedGradeMemberScoreSources] = useState<Record<number, CopySource | undefined>>({});
    const [copiedGradeMemberSubItemScoreSources, setCopiedGradeMemberSubItemScoreSources] = useState<Record<number, Record<number, CopySource | undefined>>>({});
    const [mainCopyUndoHistory, setMainCopyUndoHistory] = useState<MainScoreCopySnapshot[]>([]);
    const [mainCopyRedoHistory, setMainCopyRedoHistory] = useState<MainScoreCopySnapshot[]>([]);
    const [subItemCopyUndoHistory, setSubItemCopyUndoHistory] = useState<SubItemScoreCopySnapshot[]>([]);
    const [subItemCopyRedoHistory, setSubItemCopyRedoHistory] = useState<SubItemScoreCopySnapshot[]>([]);

    // Edit tab states
    const [editSearchQuery, setEditSearchQuery] = useState("");
    const [editGroupSearchQuery, setEditGroupSearchQuery] = useState("");
    const [editSelectedStudent, setEditSelectedStudent] = useState<Student | null>(null);
    const [editSelectedGroup, setEditSelectedGroup] = useState<Group | null>(null);
    const [currentScore, setCurrentScore] = useState<StudentScore | null>(null);
    const [newScore, setNewScore] = useState<string>("");
    const [editReason, setEditReason] = useState("");
    const [editReasonType, setEditReasonType] = useState<string>(""); // Preset reason key
    const [editReasonCustom, setEditReasonCustom] = useState(""); // Custom reason text when "other" is selected
    // Image upload states
    const [editImages, setEditImages] = useState<File[]>([]);
    const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
    const imageInputRef = useRef<HTMLInputElement>(null);
    // For sub-items editing
    const [editSubItemScores, setEditSubItemScores] = useState<{ subItemId: number; scoreId: number | null; currentScore: number | null; newScore: string }[]>([]);
    const [selectedEditSubItemId, setSelectedEditSubItemId] = useState<number | null>(null);
    // For group editing - store all member scores
    const [groupMemberScores, setGroupMemberScores] = useState<{ studentId: number; studentName: string; scoreId: number | null; score: number | null; hasAnySubItemScore: boolean; selected: boolean; hasPendingEdit: boolean }[]>([]);
    // For group editing with sub-items - map studentId → [{subItemId, scoreId}]
    const [groupMemberSubItemScores, setGroupMemberSubItemScores] = useState<Map<number, { subItemId: number; scoreId: number | null }[]>>(new Map());
    const [pendingEditSubItemByStudent, setPendingEditSubItemByStudent] = useState<Record<number, number[]>>({});
    const [editGroupMode, setEditGroupMode] = useState<"all" | "selected">("all"); // "all" = edit all members, "selected" = edit selected members only
    const [editGroupMemberScores, setEditGroupMemberScores] = useState<Record<number, string>>({});
    const [editGroupMemberSubItemScores, setEditGroupMemberSubItemScores] = useState<Record<number, Record<number, string>>>({});

    // Existing score states (for checking duplicates)
    const [scoresData, setScoresData] = useState<ScoresData | null>(null);
    const [existingScore, setExistingScore] = useState<ExistingScoreInfo | null>(null);
    const [subItemExistingScores, setSubItemExistingScores] = useState<SubItemExistingScore[]>([]);
    const [groupSearchQuery, setGroupSearchQuery] = useState("");
    const [isCheckingScore, setIsCheckingScore] = useState(false);

    // ✅ FIX: "assignment" and "individual" are both individual assignments
    // Only "permanent_group" and "weekly_group" are group assignments
    const isGroupAssignment = assignment?.assignment_type === "permanent_group" || assignment?.assignment_type === "weekly_group";
    const isPermanentGroup = assignment?.assignment_type === "permanent_group";
    const hasSubItems = assignment?.subItems && assignment.subItems.length > 0;
    const locale = isEnglish ? "en-US" : "th-TH";
    const t = (th: string, en: string) => (isEnglish ? en : th);
    const formatPointCount = (value: number | string) => {
        const numericValue = Number(value);
        return isEnglish
            ? `${value} ${numericValue === 1 ? "point" : "points"}`
            : `${value} คะแนน`;
    };
    const formatSubItemCount = (count: number) => (
        isEnglish ? `${count} ${count === 1 ? "sub-item" : "sub-items"}` : `${count} ข้อย่อย`
    );
    const formatMemberCount = (count: number) => (
        isEnglish ? `${count} ${count === 1 ? "member" : "members"}` : `${count} คน`
    );
    const formatStudentCount = (count: number) => (
        isEnglish ? `${count} ${count === 1 ? "student" : "students"}` : `${count} คน`
    );
    const formatRequestCount = (count: number) => (
        isEnglish ? `${count} ${count === 1 ? "request" : "requests"}` : `${count} รายการ`
    );
    const formatLocalizedDate = (value: string) => new Date(value).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: isEnglish ? "numeric" : "2-digit",
    });
    const formatLocalizedDateTime = (value: string) => new Date(value).toLocaleString(locale, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
    const getPresetEditReasonLabel = (reason: PresetEditReason) => (
        isEnglish ? reason.enLabel : reason.label
    );
    const getSubItemName = (subItemId: number) => localizeGeneratedSubItemName(
        assignment?.subItems?.find((subItem) => subItem.id === subItemId)?.name,
        subItemId,
        isEnglish,
    );

    // Colors based on group type
    const groupColors = isPermanentGroup
        ? { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', chip: 'bg-purple-100 text-purple-700' }
        : { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', chip: 'bg-emerald-100 text-emerald-700' };

    // Load students and groups when modal opens
    useEffect(() => {
        if (isOpen && assignment) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, assignment?.id]);

    // Reset states when modal closes
    useEffect(() => {
        if (!isOpen) {
            resetStates();
        } else {
            // Sync active tab to what's available when modal opens
            setActiveTab(canGradeAssignments ? "grade" : "edit");
        }
    }, [isOpen]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const studentData = await scoreService.searchStudents(courseId);
            setStudents(studentData);

            if (isGroupAssignment && assignment) {
                const groupData = await scoreService.getGroupsForAssignment(assignment.id);
                setGroups(groupData);
            }

            // Load existing scores for this assignment
            if (assignment) {
                const scores = await scoreService.getScores(assignment.id);
                setScoresData(scores);
            }
        } catch (error) {
            console.error("loadData error:", error);
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถโหลดข้อมูลได้", "Unable to load the data."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const resetStates = () => {
        setActiveTab(defaultTab);
        setSearchQuery("");
        setSelectedStudent(null);
        setSelectedGroup(null);
        setMainScore("");
        setSubItemScores([]);
        setComment("");
        setGradeGroupMode("all");
        setGradeGroupMembers([]);
        setGradeGroupMemberScores({});
        setGradeGroupMemberSubItemScores({});
        setCopiedGradeMemberScores({});
        setCopiedGradeMemberSubItemScores({});
        setCopiedGradeMemberScoreSources({});
        setCopiedGradeMemberSubItemScoreSources({});
        setMainCopyUndoHistory([]);
        setMainCopyRedoHistory([]);
        setSubItemCopyUndoHistory([]);
        setSubItemCopyRedoHistory([]);
        setEditSearchQuery("");
        setEditGroupSearchQuery("");
        setEditSelectedStudent(null);
        setEditSelectedGroup(null);
        setCurrentScore(null);
        setNewScore("");
        setEditReason("");
        setEditReasonType("");
        setEditReasonCustom("");
        setEditImages([]);
        setEditImagePreviews([]);
        setEditSubItemScores([]);
        setSelectedEditSubItemId(null);
        setExistingScore(null);
        setSubItemExistingScores([]);
        setGroupSearchQuery("");
        setGroupMemberScores([]);
        setGroupMemberSubItemScores(new Map());
        setPendingEditSubItemByStudent({});
        setEditGroupMode("all");
        setEditGroupMemberScores({});
        setEditGroupMemberSubItemScores({});
    };

    // Helper function to get final edit reason
    const getFinalEditReason = (): string => {
        if (editReasonType === "other") {
            return editReasonCustom.trim();
        }
        const preset = PRESET_EDIT_REASONS.find(r => r.key === editReasonType);
        return preset?.label || "";
    };

    // Handle image upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newFiles: File[] = [];
        const newPreviews: string[] = [];
        const maxImages = 3 - editImages.length;

        for (let i = 0; i < Math.min(files.length, maxImages); i++) {
            const file = files[i];
            // Validate file type
            if (!file.type.startsWith('image/')) {
                addToast({
                    title: t("ไฟล์ไม่ถูกต้อง", "Invalid file"),
                    description: isEnglish
                        ? `${file.name} is not an image file.`
                        : `${file.name} ไม่ใช่ไฟล์รูปภาพ`,
                    color: "warning",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                continue;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                addToast({
                    title: t("ไฟล์ใหญ่เกินไป", "File too large"),
                    description: isEnglish
                        ? `${file.name} is larger than 5 MB.`
                        : `${file.name} มีขนาดเกิน 5MB`,
                    color: "warning",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                continue;
            }
            newFiles.push(file);
            newPreviews.push(URL.createObjectURL(file));
        }

        setEditImages(prev => [...prev, ...newFiles]);
        setEditImagePreviews(prev => [...prev, ...newPreviews]);

        // Reset input
        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    };

    // Remove image
    const handleRemoveImage = (index: number) => {
        // Revoke URL to prevent memory leak
        URL.revokeObjectURL(editImagePreviews[index]);
        setEditImages(prev => prev.filter((_, i) => i !== index));
        setEditImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    // Helper function to check if student can be scored (attendance check)
    const getStudentAttendanceInfo = (studentId: number) => {
        if (!scoresData?.student_scores) return { canScore: true, status: null };
        const studentScore = scoresData.student_scores.find(ss => ss.student.id === studentId);
        return {
            canScore: studentScore?.can_score ?? true,
            status: studentScore?.attendance_status ?? null,
        };
    };

    // Get attendance status label and color
    const getAttendanceLabel = (status: string | null) => {
        switch (status) {
            case 'present': return { text: t('มาเรียน', 'Present'), color: 'text-emerald-600', bg: 'bg-emerald-100' };
            case 'late': return { text: t('มาสาย', 'Late'), color: 'text-amber-600', bg: 'bg-amber-100' };
            case 'leave': return { text: t('ลา', 'On leave'), color: 'text-blue-600', bg: 'bg-blue-100' };
            case 'absent': return { text: t('ขาดเรียน', 'Absent'), color: 'text-red-600', bg: 'bg-red-100' };
            default: return null;
        }
    };

    // Check if selected student/group can be scored
    const canScoreSelected = useMemo(() => {
        if (isGroupAssignment && selectedGroup) {
            // For group assignment, all members must be able to score
            return selectedGroup.members.every(member => {
                const info = getStudentAttendanceInfo(member.id);
                return info.canScore;
            });
        } else if (selectedStudent) {
            const info = getStudentAttendanceInfo(selectedStudent.id);
            return info.canScore;
        }
        return true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStudent?.id, selectedGroup?.id, scoresData]);

    // Get absent members in group
    const absentGroupMembers = useMemo(() => {
        if (!isGroupAssignment || !selectedGroup) return [];
        return selectedGroup.members.filter(member => {
            const info = getStudentAttendanceInfo(member.id);
            return !info.canScore;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGroup?.id, scoresData, isGroupAssignment]);

    // Initialize sub-item scores when student/group is selected
    useEffect(() => {
        if (assignment?.subItems && (selectedStudent || selectedGroup)) {
            setSubItemScores(
                assignment.subItems
                    .filter(item => item.id !== undefined)
                    .map(item => ({
                        subItemId: item.id!,
                        score: "",
                        maxScore: item.max_score,
                    }))
            );
        }
    }, [selectedStudent?.id, selectedGroup?.id, assignment?.id, assignment?.subItems]);

    // Check for existing scores when student is selected
    useEffect(() => {
        if (selectedStudent && scoresData) {
            const studentScore = scoresData.student_scores.find(
                ss => ss.student.id === selectedStudent.id
            );

            if (studentScore && studentScore.score !== null && studentScore.score !== undefined) {
                setExistingScore({
                    score: studentScore.score,
                    graded_by: studentScore.graded_by,
                    graded_at: studentScore.graded_at,
                });
            } else {
                setExistingScore(null);
            }

            // Check sub-item scores from API response
            if (studentScore?.sub_item_scores && studentScore.sub_item_scores.length > 0) {
                const existingSubScores: SubItemExistingScore[] = studentScore.sub_item_scores
                    .filter(si => si.score !== null)
                    .map(si => ({
                        subItemId: si.sub_item_id,
                        score: si.score,
                        graded_by: si.graded_by || undefined,
                        graded_at: si.graded_at || undefined,
                    }));
                setSubItemExistingScores(existingSubScores);
            } else {
                setSubItemExistingScores([]);
            }
        } else {
            setExistingScore(null);
            setSubItemExistingScores([]);
        }
    }, [selectedStudent?.id, scoresData]);

    // Check for existing scores when group is selected
    useEffect(() => {
        if (isGroupAssignment && selectedGroup && scoresData) {
            // Group grading uses per-member score checks (gradeGroupMembers/getMemberSubItemScoreData).
            // Keep these global states empty to avoid locking inputs based on one scored member.
            setExistingScore(null);
            setSubItemExistingScores([]);
        }
        // Note: Don't reset existingScore when !selectedGroup because 
        // this useEffect also triggers for individual assignments
        // and would override the student's existingScore
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGroupAssignment, selectedGroup?.id, scoresData]);

    // Filter students based on search query
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students.slice(0, 10);
        const query = searchQuery.toLowerCase();
        return students.filter(
            s => s.student_id.toLowerCase().includes(query) ||
                s.full_name.toLowerCase().includes(query)
        ).slice(0, 10);
    }, [students, searchQuery]);

    // Filter students for edit tab based on edit search query
    const filteredEditStudents = useMemo(() => {
        if (!editSearchQuery.trim()) return students.slice(0, 10);
        const query = editSearchQuery.toLowerCase();
        return students.filter(
            s => s.student_id.toLowerCase().includes(query) ||
                s.full_name.toLowerCase().includes(query)
        ).slice(0, 10);
    }, [students, editSearchQuery]);

    // Filter groups based on search query
    const filteredGroups = useMemo(() => {
        if (!groupSearchQuery.trim()) return groups;
        const query = groupSearchQuery.toLowerCase();
        return groups.filter(
            g => g.name.toLowerCase().includes(query) ||
                g.members.some(m =>
                    m.full_name.toLowerCase().includes(query) ||
                    m.student_id.toLowerCase().includes(query)
                )
        );
    }, [groups, groupSearchQuery]);

    const handleStudentSelect = async (key: React.Key | null) => {
        if (!key) {
            setSelectedStudent(null);
            setExistingScore(null);
            setSubItemExistingScores([]);
            return;
        }
        const student = students.find(s => s.id.toString() === key.toString());
        setSelectedStudent(student || null);
        setSearchQuery(""); // Clear search query after selection
        setMainScore("");

        // Fetch latest scores from server to check if already graded by another TA
        if (student && assignment) {
            setIsCheckingScore(true);
            try {
                const latestScores = await scoreService.getScores(assignment.id);
                setScoresData(latestScores);
            } catch (error) {
                console.error("Error checking scores:", error);
            } finally {
                setIsCheckingScore(false);
            }
        }
    };

    const handleGroupSelect = async (key: React.Key | null) => {
        if (!key) {
            setSelectedGroup(null);
            setExistingScore(null);
            setSubItemExistingScores([]);
            setGradeGroupMembers([]);
            setGradeGroupMemberScores({});
            setGradeGroupMemberSubItemScores({});
            setCopiedGradeMemberScores({});
            setCopiedGradeMemberSubItemScores({});
            setCopiedGradeMemberScoreSources({});
            setCopiedGradeMemberSubItemScoreSources({});
            setMainCopyUndoHistory([]);
            setMainCopyRedoHistory([]);
            setSubItemCopyUndoHistory([]);
            setSubItemCopyRedoHistory([]);
            setGradeGroupMode("all");
            return;
        }
        const group = groups.find(g => g.id.toString() === key.toString());
        setSelectedGroup(group || null);
        setGroupSearchQuery(""); // Clear search query after selection
        setMainScore("");
        setGradeGroupMode("all");

        // Fetch latest scores first to get member score data
        let latestScores = scoresData;
        if (group && assignment) {
            setIsCheckingScore(true);
            try {
                latestScores = await scoreService.getScores(assignment.id);
                setScoresData(latestScores);
            } catch (error) {
                console.error("Error checking scores:", error);
            } finally {
                setIsCheckingScore(false);
            }
        }

        // Setup grade group members with score info
        if (group) {
            const members = group.members.map(member => {
                const info = getStudentAttendanceInfo(member.id);
                // Find existing score for this member
                const memberScore = latestScores?.student_scores?.find(
                    ss => ss.student.id === member.id
                );
                const hasMainScore = memberScore?.score !== null && memberScore?.score !== undefined;
                const subItemCount = assignment?.subItems?.length ?? 0;
                const scoredSubItemCount = memberScore?.sub_item_scores?.filter(
                    (si) => si.score !== null && si.score !== undefined
                ).length ?? 0;
                // For sub-item assignments: member only "has score" when ALL sub-items are scored.
                // This allows re-selecting them to grade remaining sub-items without locking.
                const hasExistingScore = subItemCount > 0
                    ? scoredSubItemCount >= subItemCount
                    : hasMainScore;
                
                return {
                    studentId: member.id,
                    studentName: member.full_name,
                    // Only auto-select students who can score AND don't have a score yet
                    selected: info.canScore && !hasExistingScore,
                    canScore: info.canScore,
                    hasScore: hasExistingScore,
                    existingScore: memberScore?.score ?? null,
                    gradedBy: memberScore?.graded_by?.display_name ?? null,
                    gradedAt: memberScore?.graded_at ?? null,
                };
            });
            setGradeGroupMembers(members);

            const initialScores: Record<number, string> = {};
            members.forEach((member) => {
                if (member.selected) {
                    initialScores[member.studentId] = "";
                }
            });
            setGradeGroupMemberScores(initialScores);
            setGradeGroupMemberSubItemScores({});
            setCopiedGradeMemberScores({});
            setCopiedGradeMemberSubItemScores({});
            setCopiedGradeMemberScoreSources({});
            setCopiedGradeMemberSubItemScoreSources({});
            setMainCopyUndoHistory([]);
            setMainCopyRedoHistory([]);
            setSubItemCopyUndoHistory([]);
            setSubItemCopyRedoHistory([]);
        }
    };

    // Toggle single grade group member selection (only if they don't have score yet)
    const toggleGradeMemberSelection = (studentId: number) => {
        setGradeGroupMembers(prev => {
            const next = prev.map(m => {
                if (m.studentId === studentId && !m.hasScore) {
                    return { ...m, selected: !m.selected };
                }
                return m;
            });

            const changedMember = next.find(m => m.studentId === studentId);
            if (changedMember && !changedMember.hasScore) {
                setGradeGroupMemberScores(prevScores => {
                    if (changedMember.selected) {
                        return {
                            ...prevScores,
                            [studentId]: prevScores[studentId] ?? "",
                        };
                    }
                    const { [studentId]: _, ...rest } = prevScores;
                    return rest;
                });

                setCopiedGradeMemberScores(prevCopied => {
                    if (changedMember.selected) {
                        return {
                            ...prevCopied,
                            [studentId]: prevCopied[studentId] ?? false,
                        };
                    }
                    const { [studentId]: _, ...rest } = prevCopied;
                    return rest;
                });

                setCopiedGradeMemberScoreSources(prevSources => {
                    if (changedMember.selected) {
                        return {
                            ...prevSources,
                            [studentId]: prevSources[studentId],
                        };
                    }
                    const { [studentId]: _, ...rest } = prevSources;
                    return rest;
                });

                setGradeGroupMemberSubItemScores(prevSubScores => {
                    if (changedMember.selected) {
                        return {
                            ...prevSubScores,
                            [studentId]: prevSubScores[studentId] ?? {},
                        };
                    }
                    const { [studentId]: _, ...rest } = prevSubScores;
                    return rest;
                });

                setCopiedGradeMemberSubItemScores(prevCopiedSub => {
                    if (changedMember.selected) {
                        return {
                            ...prevCopiedSub,
                            [studentId]: prevCopiedSub[studentId] ?? {},
                        };
                    }
                    const { [studentId]: _, ...rest } = prevCopiedSub;
                    return rest;
                });

                setCopiedGradeMemberSubItemScoreSources(prevSources => {
                    if (changedMember.selected) {
                        return {
                            ...prevSources,
                            [studentId]: prevSources[studentId] ?? {},
                        };
                    }
                    const { [studentId]: _, ...rest } = prevSources;
                    return rest;
                });
            }

            return next;
        });
    };

    // Toggle all grade group members selection (only those without scores)
    const toggleAllGradeMembersSelection = (selectAll: boolean) => {
        setGradeGroupMembers(prev => {
            const next = prev.map(m => ({ ...m, selected: selectAll && m.canScore && !m.hasScore }));

            setGradeGroupMemberScores(prevScores => {
                if (!selectAll) {
                    return {};
                }

                const allSelectableIds = next
                    .filter(m => m.selected)
                    .map(m => m.studentId);
                const merged: Record<number, string> = {};
                allSelectableIds.forEach((id) => {
                    merged[id] = prevScores[id] ?? "";
                });
                return merged;
            });

            setCopiedGradeMemberScores(prevCopied => {
                if (!selectAll) {
                    return {};
                }

                const allSelectableIds = next
                    .filter(m => m.selected)
                    .map(m => m.studentId);
                const merged: Record<number, boolean> = {};
                allSelectableIds.forEach((id) => {
                    merged[id] = prevCopied[id] ?? false;
                });
                return merged;
            });

            setCopiedGradeMemberScoreSources(prevSources => {
                if (!selectAll) {
                    return {};
                }
                const allSelectableIds = next
                    .filter(m => m.selected)
                    .map(m => m.studentId);
                const merged: Record<number, CopySource | undefined> = {};
                allSelectableIds.forEach((id) => {
                    merged[id] = prevSources[id];
                });
                return merged;
            });

            setGradeGroupMemberSubItemScores(prevSubScores => {
                if (!selectAll) {
                    return {};
                }

                const allSelectableIds = next
                    .filter(m => m.selected)
                    .map(m => m.studentId);
                const merged: Record<number, Record<number, string>> = {};
                allSelectableIds.forEach((id) => {
                    merged[id] = prevSubScores[id] ?? {};
                });
                return merged;
            });

            setCopiedGradeMemberSubItemScores(prevCopiedSub => {
                if (!selectAll) {
                    return {};
                }

                const allSelectableIds = next
                    .filter(m => m.selected)
                    .map(m => m.studentId);
                const merged: Record<number, Record<number, boolean>> = {};
                allSelectableIds.forEach((id) => {
                    merged[id] = prevCopiedSub[id] ?? {};
                });
                return merged;
            });

            setCopiedGradeMemberSubItemScoreSources(prevSources => {
                if (!selectAll) {
                    return {};
                }
                const allSelectableIds = next
                    .filter(m => m.selected)
                    .map(m => m.studentId);
                const merged: Record<number, Record<number, CopySource | undefined>> = {};
                allSelectableIds.forEach((id) => {
                    merged[id] = prevSources[id] ?? {};
                });
                return merged;
            });

            return next;
        });
    };

    const handleGradeGroupMemberScoreChange = (studentId: number, value: string) => {
        const sanitizedValue = sanitizeScoreInput(value, assignment?.max_score);
        setGradeGroupMemberScores(prev => ({
            ...prev,
            [studentId]: sanitizedValue,
        }));
        setCopiedGradeMemberScores(prev => ({
            ...prev,
            [studentId]: false,
        }));
        setCopiedGradeMemberScoreSources(prev => ({
            ...prev,
            [studentId]: undefined,
        }));
    };

    const handleGradeGroupMemberSubItemScoreChange = (studentId: number, subItemId: number, value: string) => {
        const maxScore = subItemScores.find(item => item.subItemId === subItemId)?.maxScore;
        const sanitizedValue = sanitizeScoreInput(value, maxScore);
        setGradeGroupMemberSubItemScores(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                [subItemId]: sanitizedValue,
            },
        }));
        setCopiedGradeMemberSubItemScores(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                [subItemId]: false,
            },
        }));
        setCopiedGradeMemberSubItemScoreSources(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                [subItemId]: undefined,
            },
        }));
    };

    const copyPreviousGradeMemberScore = (studentId: number) => {
        const selectedMembers = gradeGroupMembers.filter(m => m.selected && m.canScore && !m.hasScore);
        const currentIndex = selectedMembers.findIndex(m => m.studentId === studentId);
        if (currentIndex <= 0) return;

        const previousMember = selectedMembers[currentIndex - 1];
        const previousScore = gradeGroupMemberScores[previousMember.studentId] ?? "";
        if (previousScore === "") return;

        setGradeGroupMemberScores(prev => ({
            ...prev,
            [studentId]: previousScore,
        }));
        setCopiedGradeMemberScores(prev => ({
            ...prev,
            [studentId]: true,
        }));
        setCopiedGradeMemberScoreSources(prev => ({
            ...prev,
            [studentId]: "from_above",
        }));
    };

    const copyPreviousGradeMemberSubItemScore = (studentId: number, subItemId: number) => {
        const selectedMembers = gradeGroupMembers.filter(m => m.selected && m.canScore && !m.hasScore);
        const currentIndex = selectedMembers.findIndex(m => m.studentId === studentId);
        if (currentIndex <= 0) return;

        const previousMember = selectedMembers[currentIndex - 1];
        const previousScore = gradeGroupMemberSubItemScores[previousMember.studentId]?.[subItemId] ?? "";
        if (previousScore === "") return;

        setGradeGroupMemberSubItemScores(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                [subItemId]: previousScore,
            },
        }));
        setCopiedGradeMemberSubItemScores(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                [subItemId]: true,
            },
        }));
        setCopiedGradeMemberSubItemScoreSources(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                [subItemId]: "from_above",
            },
        }));
    };

    const applyFirstGradeMemberScoreToAll = () => {
        const selectedMembers = gradeGroupMembers.filter(m => m.selected && m.canScore && !m.hasScore);
        if (selectedMembers.length < 2) return;

        const firstMemberId = selectedMembers[0].studentId;
        const firstScore = gradeGroupMemberScores[firstMemberId] ?? "";
        if (firstScore === "") return;

        setMainCopyUndoHistory(prev => [...prev, {
            scores: { ...gradeGroupMemberScores },
            copiedScores: { ...copiedGradeMemberScores },
            copiedScoreSources: { ...copiedGradeMemberScoreSources },
        }]);
        setMainCopyRedoHistory([]);

        setGradeGroupMemberScores(prev => {
            const next = { ...prev };
            selectedMembers.forEach((member) => {
                next[member.studentId] = firstScore;
            });
            return next;
        });
        setCopiedGradeMemberScores(prev => {
            const next = { ...prev };
            selectedMembers.forEach((member, index) => {
                next[member.studentId] = index !== 0;
            });
            return next;
        });
        setCopiedGradeMemberScoreSources(prev => {
            const next = { ...prev };
            selectedMembers.forEach((member, index) => {
                next[member.studentId] = index !== 0 ? "from_first" : undefined;
            });
            return next;
        });
    };

    const applyFirstGradeMemberSubItemScoresToAll = () => {
        const selectedMembers = gradeGroupMembers.filter(m => m.selected && m.canScore && !m.hasScore);
        if (selectedMembers.length < 2) return;

        const firstMemberId = selectedMembers[0].studentId;
        const firstSubScores = gradeGroupMemberSubItemScores[firstMemberId] || {};
        if (Object.keys(firstSubScores).length === 0) return;

        setSubItemCopyUndoHistory(prev => [...prev, {
            subItemScores: { ...gradeGroupMemberSubItemScores },
            copiedSubItemScores: { ...copiedGradeMemberSubItemScores },
            copiedSubItemScoreSources: { ...copiedGradeMemberSubItemScoreSources },
        }]);
        setSubItemCopyRedoHistory([]);

        setGradeGroupMemberSubItemScores(prev => {
            const next = { ...prev };
            selectedMembers.forEach((member) => {
                next[member.studentId] = {
                    ...(next[member.studentId] || {}),
                    ...firstSubScores,
                };
            });
            return next;
        });
        setCopiedGradeMemberSubItemScores(prev => {
            const next = { ...prev };
            selectedMembers.forEach((member, index) => {
                const copiedMap = { ...(next[member.studentId] || {}) };
                Object.keys(firstSubScores).forEach((subItemId) => {
                    copiedMap[Number(subItemId)] = index !== 0;
                });
                next[member.studentId] = copiedMap;
            });
            return next;
        });
        setCopiedGradeMemberSubItemScoreSources(prev => {
            const next = { ...prev };
            selectedMembers.forEach((member, index) => {
                const sourceMap = { ...(next[member.studentId] || {}) };
                Object.keys(firstSubScores).forEach((subItemId) => {
                    sourceMap[Number(subItemId)] = index !== 0 ? "from_first" : undefined;
                });
                next[member.studentId] = sourceMap;
            });
            return next;
        });
    };

    const resetCopiedGradeMemberScores = () => {
        const selectedMembers = gradeGroupMembers.filter(m => m.selected && m.canScore && !m.hasScore);
        setGradeGroupMemberScores(prev => {
            const next = { ...prev };
            selectedMembers.forEach((member) => {
                if (copiedGradeMemberScores[member.studentId]) {
                    next[member.studentId] = "";
                }
            });
            return next;
        });
        setCopiedGradeMemberScores(prev => {
            const next = { ...prev };
            selectedMembers.forEach((member) => {
                next[member.studentId] = false;
            });
            return next;
        });
        setCopiedGradeMemberScoreSources(prev => {
            const next = { ...prev };
            selectedMembers.forEach((member) => {
                next[member.studentId] = undefined;
            });
            return next;
        });
    };

    const resetCopiedGradeMemberSubItemScores = () => {
        const selectedMembers = gradeGroupMembers.filter(m => m.selected && m.canScore && !m.hasScore);
        setGradeGroupMemberSubItemScores(prev => {
            const next = { ...prev };
            selectedMembers.forEach((member) => {
                const copiedMap = copiedGradeMemberSubItemScores[member.studentId] || {};
                const memberScores = { ...(next[member.studentId] || {}) };
                Object.entries(copiedMap).forEach(([subItemId, copied]) => {
                    if (copied) {
                        memberScores[Number(subItemId)] = "";
                    }
                });
                next[member.studentId] = memberScores;
            });
            return next;
        });
        setCopiedGradeMemberSubItemScores(prev => {
            const next = { ...prev };
            selectedMembers.forEach((member) => {
                const copiedMap = { ...(next[member.studentId] || {}) };
                Object.keys(copiedMap).forEach((subItemId) => {
                    copiedMap[Number(subItemId)] = false;
                });
                next[member.studentId] = copiedMap;
            });
            return next;
        });
        setCopiedGradeMemberSubItemScoreSources(prev => {
            const next = { ...prev };
            selectedMembers.forEach((member) => {
                const sourceMap = { ...(next[member.studentId] || {}) };
                Object.keys(sourceMap).forEach((subItemId) => {
                    sourceMap[Number(subItemId)] = undefined;
                });
                next[member.studentId] = sourceMap;
            });
            return next;
        });
    };

    const undoMainBulkCopy = () => {
        if (mainCopyUndoHistory.length === 0) return;

        const previousState = mainCopyUndoHistory[mainCopyUndoHistory.length - 1];
        setMainCopyRedoHistory(prev => [...prev, {
            scores: { ...gradeGroupMemberScores },
            copiedScores: { ...copiedGradeMemberScores },
            copiedScoreSources: { ...copiedGradeMemberScoreSources },
        }]);

        setGradeGroupMemberScores(previousState.scores);
        setCopiedGradeMemberScores(previousState.copiedScores);
        setCopiedGradeMemberScoreSources(previousState.copiedScoreSources);
        setMainCopyUndoHistory(prev => prev.slice(0, -1));
    };

    const redoMainBulkCopy = () => {
        if (mainCopyRedoHistory.length === 0) return;

        const nextState = mainCopyRedoHistory[mainCopyRedoHistory.length - 1];
        setMainCopyUndoHistory(prev => [...prev, {
            scores: { ...gradeGroupMemberScores },
            copiedScores: { ...copiedGradeMemberScores },
            copiedScoreSources: { ...copiedGradeMemberScoreSources },
        }]);

        setGradeGroupMemberScores(nextState.scores);
        setCopiedGradeMemberScores(nextState.copiedScores);
        setCopiedGradeMemberScoreSources(nextState.copiedScoreSources);
        setMainCopyRedoHistory(prev => prev.slice(0, -1));
    };

    const undoSubItemBulkCopy = () => {
        if (subItemCopyUndoHistory.length === 0) return;

        const previousState = subItemCopyUndoHistory[subItemCopyUndoHistory.length - 1];
        setSubItemCopyRedoHistory(prev => [...prev, {
            subItemScores: { ...gradeGroupMemberSubItemScores },
            copiedSubItemScores: { ...copiedGradeMemberSubItemScores },
            copiedSubItemScoreSources: { ...copiedGradeMemberSubItemScoreSources },
        }]);

        setGradeGroupMemberSubItemScores(previousState.subItemScores);
        setCopiedGradeMemberSubItemScores(previousState.copiedSubItemScores);
        setCopiedGradeMemberSubItemScoreSources(previousState.copiedSubItemScoreSources);
        setSubItemCopyUndoHistory(prev => prev.slice(0, -1));
    };

    const redoSubItemBulkCopy = () => {
        if (subItemCopyRedoHistory.length === 0) return;

        const nextState = subItemCopyRedoHistory[subItemCopyRedoHistory.length - 1];
        setSubItemCopyUndoHistory(prev => [...prev, {
            subItemScores: { ...gradeGroupMemberSubItemScores },
            copiedSubItemScores: { ...copiedGradeMemberSubItemScores },
            copiedSubItemScoreSources: { ...copiedGradeMemberSubItemScoreSources },
        }]);

        setGradeGroupMemberSubItemScores(nextState.subItemScores);
        setCopiedGradeMemberSubItemScores(nextState.copiedSubItemScores);
        setCopiedGradeMemberSubItemScoreSources(nextState.copiedSubItemScoreSources);
        setSubItemCopyRedoHistory(prev => prev.slice(0, -1));
    };

    const getCopySourceLabel = (source?: CopySource) => {
        if (source === "from_first") return t("คัดลอกจากคนแรก", "Copied from the first student");
        return t("คัดลอกจากคนบน", "Copied from the student above");
    };

    const getMemberSubItemScoreData = (studentId: number, subItemId: number): SubItemScoreData | undefined => {
        const studentScore = scoresData?.student_scores?.find(ss => ss.student.id === studentId);
        return studentScore?.sub_item_scores?.find(si => si.sub_item_id === subItemId);
    };

    // Get selected grade group member IDs (only those without existing scores)
    const selectedGradeMembers = useMemo(() => {
        return gradeGroupMembers.filter(m => m.selected && m.canScore && !m.hasScore).map(m => m.studentId);
    }, [gradeGroupMembers]);

    // Check if there are members still needing scores
    const membersNeedingScores = useMemo(() => {
        return gradeGroupMembers.filter(m => m.canScore && !m.hasScore);
    }, [gradeGroupMembers]);

    // Check if all members already have scores
    const allMembersHaveScores = useMemo(() => {
        if (gradeGroupMembers.length === 0) return false;
        return gradeGroupMembers.every(m => m.hasScore || !m.canScore);
    }, [gradeGroupMembers]);

    const handleSubItemScoreChange = (subItemId: number, value: string) => {
        const maxScore = subItemScores.find(item => item.subItemId === subItemId)?.maxScore;
        const sanitizedValue = sanitizeScoreInput(value, maxScore);
        setSubItemScores(prev =>
            prev.map(item =>
                item.subItemId === subItemId ? { ...item, score: sanitizedValue } : item
            )
        );
    };

    // Calculate total score from sub-items
    const calculatedTotalScore = useMemo(() => {
        if (!hasSubItems) return null;
        return subItemScores.reduce((sum, item) => {
            const score = parseFloat(item.score.toString()) || 0;
            return sum + score;
        }, 0);
    }, [subItemScores, hasSubItems]);

    // Validate scores
    const validateScore = (score: string, maxScore: number): boolean => {
        return isScoreInputValid(score, maxScore);
    };

    const canSubmitGrade = useMemo(() => {
        if (!isCourseActive) return false;
        if (!assignment) return false;
        if (isCheckingScore) return false; // Disable while checking
        if (!isGroupAssignment && !selectedStudent) return false;
        if (isGroupAssignment && !selectedGroup) return false;

        // Check attendance - cannot score if absent (for individual)
        if (!isGroupAssignment && !canScoreSelected) return false;

        // For individual: If already scored (non sub-items), cannot submit
        if (!isGroupAssignment && !hasSubItems && existingScore) return false;

        // For group assignments
        if (isGroupAssignment) {
            // Check if all members already have scores
            if (allMembersHaveScores && !hasSubItems) return false;
            
            // Must have at least 1 member selected who needs scoring
            if (selectedGradeMembers.length === 0) return false;

            // In selected mode (non sub-items), require a valid score for every selected member
            if (!hasSubItems && gradeGroupMode === "selected") {
                return selectedGradeMembers.every((studentId) => {
                    const scoreValue = gradeGroupMemberScores[studentId] ?? "";
                    return scoreValue !== "" && validateScore(scoreValue, assignment.max_score);
                });
            }

            if (hasSubItems && gradeGroupMode === "selected") {
                let hasAnyValidEntry = false;
                for (const studentId of selectedGradeMembers) {
                    const memberScores = gradeGroupMemberSubItemScores[studentId] || {};
                    for (const item of subItemScores) {
                        const existingSubScore = getMemberSubItemScoreData(studentId, item.subItemId);
                        if (existingSubScore?.score !== null && existingSubScore?.score !== undefined) {
                            continue;
                        }

                        const value = memberScores[item.subItemId] ?? "";
                        if (value === "") continue;

                        if (!validateScore(value, item.maxScore)) {
                            return false;
                        }
                        hasAnyValidEntry = true;
                    }
                }

                return hasAnyValidEntry;
            }

            if (hasSubItems && gradeGroupMode === "all") {
                const filledItems = subItemScores.filter(item => item.score !== "");
                if (filledItems.length === 0) return false;
                if (!filledItems.every(item => validateScore(item.score.toString(), item.maxScore))) return false;
                // Must have at least one member who does not yet have each filled sub-item scored
                const hasAnySubmittable = filledItems.some(item =>
                    gradeGroupMembers.some(m => {
                        if (!m.canScore) return false;
                        const existing = getMemberSubItemScoreData(m.studentId, item.subItemId);
                        return existing?.score === null || existing?.score === undefined;
                    })
                );
                return hasAnySubmittable;
            }
        }

        if (hasSubItems) {
            // อย่างน้อยต้องกรอกคะแนน 1 ข้อ และคะแนนที่กรอกต้องถูกต้อง
            // และข้อที่กรอกต้องไม่มีคะแนนอยู่แล้ว
            const filledItems = subItemScores.filter(item => {
                const existingSubScore = subItemExistingScores.find(s => s.subItemId === item.subItemId);
                return item.score !== "" && !existingSubScore;
            });
            if (filledItems.length === 0) return false;
            return filledItems.every(item => validateScore(item.score.toString(), item.maxScore));
        } else {
            return mainScore !== "" && validateScore(mainScore, assignment.max_score);
        }
    }, [assignment, selectedStudent, selectedGroup, mainScore, subItemScores, hasSubItems, isCourseActive, isGroupAssignment, existingScore, subItemExistingScores, isCheckingScore, canScoreSelected, gradeGroupMode, selectedGradeMembers, allMembersHaveScores, gradeGroupMemberScores, gradeGroupMemberSubItemScores, scoresData, gradeGroupMembers]);

    const handleSubmitGrade = async () => {
        if (!isCourseActive) {
            addToast({
                title: t("รายวิชาถูกปิดแล้ว", "Course is closed"),
                description: t("วิชาที่ปิดแล้วจะดูข้อมูลได้อย่างเดียว ไม่สามารถบันทึกคะแนนได้", "Closed courses are read-only. Saving scores is disabled."),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (!assignment || !canSubmitGrade) return;

        setIsSubmitting(true);
        try {
            // For group assignments, always use selectedGradeMembers (which only includes members without scores)
            const studentIdsForGrade = isGroupAssignment && selectedGradeMembers.length > 0
                ? selectedGradeMembers
                : undefined;

            if (hasSubItems) {
                // Submit each sub-item score individually
                const itemsToSubmit = subItemScores.filter(item => {
                    if (isGroupAssignment) {
                        return item.score !== "";
                    }
                    const existingSubScore = subItemExistingScores.find(s => s.subItemId === item.subItemId);
                    return item.score !== "" && !existingSubScore;
                });

                if (isGroupAssignment && selectedGroup) {
                    // For group with sub-items
                    if (gradeGroupMode === "selected") {
                        for (const studentId of selectedGradeMembers) {
                            const memberScores = gradeGroupMemberSubItemScores[studentId] || {};
                            for (const item of subItemScores) {
                                const value = memberScores[item.subItemId] ?? "";
                                const existingSubScore = getMemberSubItemScoreData(studentId, item.subItemId);
                                if (value === "" || (existingSubScore?.score !== null && existingSubScore?.score !== undefined)) {
                                    continue;
                                }

                                await scoreService.submitGroupScore({
                                    assignment_id: assignment.id,
                                    group_id: selectedGroup.id,
                                    score: parseFloat(value),
                                    sub_item_id: item.subItemId,
                                    comment: comment || undefined,
                                    student_ids: [studentId],
                                });
                            }
                        }
                    } else {
                        for (const item of itemsToSubmit) {
                            // Per sub-item: only send to members who don't have this sub-item scored yet
                            const membersForSubItem = gradeGroupMembers
                                .filter(m => m.canScore)
                                .filter(m => {
                                    const existingSubScore = getMemberSubItemScoreData(m.studentId, item.subItemId);
                                    return existingSubScore?.score === null || existingSubScore?.score === undefined;
                                })
                                .map(m => m.studentId);

                            if (membersForSubItem.length === 0) continue; // All members already have this sub-item scored

                            await scoreService.submitGroupScore({
                                assignment_id: assignment.id,
                                group_id: selectedGroup.id,
                                score: parseFloat(item.score.toString()),
                                sub_item_id: item.subItemId,
                                comment: comment || undefined,
                                student_ids: membersForSubItem,
                            });
                        }
                    }
                } else if (selectedStudent) {
                    // For individual with sub-items
                    for (const item of itemsToSubmit) {
                        await scoreService.submitScore({
                            assignment_id: assignment.id,
                            student_id: selectedStudent.id,
                            score: parseFloat(item.score.toString()),
                            sub_item_id: item.subItemId,
                            comment: comment || undefined,
                        });
                    }
                }
            } else {
                // Single score (no sub-items)
                if (isGroupAssignment && selectedGroup) {
                    if (gradeGroupMode === "selected") {
                        for (const studentId of selectedGradeMembers) {
                            const memberScore = parseFloat(gradeGroupMemberScores[studentId]);
                            const result = await scoreService.submitGroupScore({
                                assignment_id: assignment.id,
                                group_id: selectedGroup.id,
                                score: memberScore,
                                comment: comment || undefined,
                                student_ids: [studentId],
                            });
                            if (!result) {
                                throw new Error(`Failed to submit score for student ${studentId}`);
                            }
                        }
                    } else {
                        const result = await scoreService.submitGroupScore({
                            assignment_id: assignment.id,
                            group_id: selectedGroup.id,
                            score: parseFloat(mainScore),
                            comment: comment || undefined,
                            student_ids: studentIdsForGrade,
                        });
                        if (!result) {
                            throw new Error('Failed to submit group score');
                        }
                    }
                } else if (selectedStudent) {
                    const result = await scoreService.submitScore({
                        assignment_id: assignment.id,
                        student_id: selectedStudent.id,
                        score: parseFloat(mainScore),
                        comment: comment || undefined,
                    });
                    if (!result) {
                        throw new Error('Failed to submit score');
                    }
                }
            }

            addToast({
                title: t("บันทึกคะแนนสำเร็จ", "Score saved"),
                description: isEnglish
                    ? `Saved the ${isGroupAssignment ? "group" : "student"} score successfully.`
                    : `บันทึกคะแนน${isGroupAssignment ? "กลุ่ม" : "นักศึกษา"}เรียบร้อยแล้ว`,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });

            // Reload scoresData เพื่อให้ข้อมูลเป็นปัจจุบัน
            const updatedScores = await scoreService.getScores(assignment.id);
            setScoresData(updatedScores);

            setSelectedStudent(null);
            setSelectedGroup(null);
            setMainScore("");
            setSubItemScores([]);
            setComment("");
            setSearchQuery("");
            setGroupSearchQuery("");
            setExistingScore(null);
            setSubItemExistingScores([]);
            setGradeGroupMode("all");
            setGradeGroupMembers([]);
            setGradeGroupMemberScores({});
            setGradeGroupMemberSubItemScores({});

            onScoreSubmitted?.();
        } catch (error) {
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: t("ไม่สามารถบันทึกคะแนนได้", "Unable to save the score."),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Edit tab handlers
    const handleEditStudentSelect = async (key: React.Key | null) => {
        if (!key || !assignment) {
            setEditSelectedStudent(null);
            setCurrentScore(null);
            setEditSubItemScores([]);
            setSelectedEditSubItemId(null);
            return;
        }

        const student = students.find(s => s.id.toString() === key.toString());
        setEditSelectedStudent(student || null);
        setEditSearchQuery("");

        if (student) {
            try {
                const scoresData = await scoreService.getScores(assignment.id);
                const studentScore = scoresData?.student_scores.find(
                    ss => ss.student.id === student.id
                );
                setCurrentScore(studentScore || null);
                setNewScore(studentScore?.score?.toString() || "");

                // Load sub-item scores for editing
                if (studentScore?.sub_item_scores && studentScore.sub_item_scores.length > 0) {
                    setEditSubItemScores(studentScore.sub_item_scores.map(si => ({
                        subItemId: si.sub_item_id,
                        scoreId: si.score_id,
                        currentScore: si.score,
                        newScore: si.score?.toString() || "",
                    })));
                } else {
                    setEditSubItemScores([]);
                }
            } catch (error) {
                console.error("Error loading score:", error);
            }
        }
    };

    // Edit tab - Group selection handler
    const handleEditGroupSelect = async (key: React.Key | null) => {
        if (!key || !assignment) {
            setEditSelectedGroup(null);
            setCurrentScore(null);
            setEditSubItemScores([]);
            setSelectedEditSubItemId(null);
            setGroupMemberScores([]);
            setGroupMemberSubItemScores(new Map());
            setPendingEditSubItemByStudent({});
            setEditGroupMode("all");
            setEditGroupMemberScores({});
            setEditGroupMemberSubItemScores({});
            return;
        }

        const group = groups.find(g => g.id.toString() === key.toString());
        setEditSelectedGroup(group || null);
        setEditGroupSearchQuery("");
        setEditGroupMode("all"); // Reset to "all" when selecting new group

        if (group && group.members.length > 0) {
            try {
                const scoresData = await scoreService.getScores(assignment.id);

                // Fetch pending edit requests to mark locked members
                let pendingStudentIds = new Set<number>();
                const pendingSubItemByStudent: Record<number, number[]> = {};
                try {
                    const pendingRequests = await scoreEditRequestService.getEditRequests(courseId, 'pending');
                    if (pendingRequests?.data) {
                        pendingRequests.data
                            .filter(req => req.assignment.id === assignment.id)
                            .forEach(req => {
                                if (req.sub_item?.id) {
                                    const existing = pendingSubItemByStudent[req.student.id] ?? [];
                                    if (!existing.includes(req.sub_item.id)) {
                                        pendingSubItemByStudent[req.student.id] = [...existing, req.sub_item.id];
                                    }
                                } else {
                                    pendingStudentIds.add(req.student.id);
                                }
                            });
                    }
                } catch {
                    // If pending request fetch fails, continue without lock info
                }
                setPendingEditSubItemByStudent(pendingSubItemByStudent);

                // Collect scores for ALL members in the group
        const memberScoresData = group.members.map(member => {
                    const studentScore = scoresData?.student_scores.find(
                        ss => ss.student.id === member.id
                    );
                    const hasPendingEdit = !hasSubItems && pendingStudentIds.has(member.id);
                    const hasAnySubItemScore = (studentScore?.sub_item_scores || []).some(si => si.score_id != null);
                    const canEditMember = hasSubItems ? hasAnySubItemScore : !!studentScore?.score_id;
                    return {
                        studentId: member.id,
                        studentName: member.full_name,
                        scoreId: studentScore?.score_id || null,
                        score: studentScore?.score ?? null,
                        hasAnySubItemScore,
                        selected: canEditMember,
                        hasPendingEdit,
                    };
                });
                setGroupMemberScores(memberScoresData);
                const initialEditMemberScores: Record<number, string> = {};
                memberScoresData.forEach((member) => {
                    if (member.selected && member.scoreId && member.score !== null && member.score !== undefined) {
                        initialEditMemberScores[member.studentId] = member.score.toString();
                    }
                });
                setEditGroupMemberScores(initialEditMemberScores);

                // Build sub-item score map for all members
                const subItemMap = new Map<number, { subItemId: number; scoreId: number | null }[]>();
                for (const member of group.members) {
                    const studentScore = scoresData?.student_scores.find(ss => ss.student.id === member.id);
                    if (studentScore?.sub_item_scores && studentScore.sub_item_scores.length > 0) {
                        subItemMap.set(member.id, studentScore.sub_item_scores.map(si => ({
                            subItemId: si.sub_item_id,
                            scoreId: si.score_id,
                        })));
                    }
                }
                setGroupMemberSubItemScores(subItemMap);
                const initialEditMemberSubItemScores: Record<number, Record<number, string>> = {};
                for (const member of group.members) {
                    const studentScore = scoresData?.student_scores.find(ss => ss.student.id === member.id);
                    if (!studentScore?.sub_item_scores) continue;

                    const memberSubScores: Record<number, string> = {};
                    studentScore.sub_item_scores.forEach((si) => {
                        if (si.score !== null && si.score !== undefined) {
                            memberSubScores[si.sub_item_id] = si.score.toString();
                        }
                    });
                    initialEditMemberSubItemScores[member.id] = memberSubScores;
                }
                setEditGroupMemberSubItemScores(initialEditMemberSubItemScores);

                // Get score from first member (for display purposes)
                const memberScore = scoresData?.student_scores.find(
                    ss => group.members.some(m => m.id === ss.student.id)
                );
                setCurrentScore(memberScore || null);
                setNewScore(memberScore?.score?.toString() || "");

                // Load sub-item edit baseline from any member in the group (not only the first member)
                if (assignment.subItems && assignment.subItems.length > 0) {
                    const groupSubItemScores = assignment.subItems
                        .filter(item => item.id !== undefined)
                        .map((item) => {
                            let matchedScore: { score_id: number | null; score: number | null } | null = null;

                            for (const member of group.members) {
                                const memberScoreData = scoresData?.student_scores.find(ss => ss.student.id === member.id);
                                const sub = memberScoreData?.sub_item_scores?.find(si => si.sub_item_id === item.id && si.score_id != null);
                                if (sub) {
                                    matchedScore = { score_id: sub.score_id, score: sub.score };
                                    break;
                                }
                            }

                            return {
                                subItemId: item.id!,
                                scoreId: matchedScore?.score_id ?? null,
                                currentScore: matchedScore?.score ?? null,
                                newScore: matchedScore?.score?.toString() || "",
                            };
                        });

                    setEditSubItemScores(groupSubItemScores);
                } else {
                    setEditSubItemScores([]);
                }
            } catch (error) {
                console.error("Error loading score:", error);
            }
        }
    };

    // Toggle member selection for group edit (cannot toggle members with pending edit requests)
    const toggleMemberSelection = (studentId: number) => {
        setGroupMemberScores(prev => {
            const next = prev.map(m =>
                m.studentId === studentId && !m.hasPendingEdit ? { ...m, selected: !m.selected } : m
            );

            const changedMember = next.find(m => m.studentId === studentId);
            if (changedMember && !changedMember.hasPendingEdit) {
                if (changedMember.selected) {
                    setEditGroupMemberScores(prevScores => ({
                        ...prevScores,
                        [studentId]: prevScores[studentId] ?? (changedMember.score?.toString() || ""),
                    }));
                } else {
                    setEditGroupMemberScores(prevScores => {
                        const { [studentId]: _, ...rest } = prevScores;
                        return rest;
                    });
                }
            }

            return next;
        });
    };

    // Select/deselect all members (hasPendingEdit members are always excluded from selection)
    const toggleAllMembersSelection = (selected: boolean) => {
        setGroupMemberScores(prev => {
            const next = prev.map(m => ({
                ...m,
                selected: selected
                    ? (!m.hasPendingEdit && (hasSubItems ? m.hasAnySubItemScore : !!m.scoreId))
                    : false,
            }));

            setEditGroupMemberScores(prevScores => {
                if (!selected) return {};
                const merged: Record<number, string> = {};
                next.forEach((m) => {
                    if (m.selected && m.scoreId) {
                        merged[m.studentId] = prevScores[m.studentId] ?? (m.score?.toString() || "");
                    }
                });
                return merged;
            });

            return next;
        });
    };

    const handleEditGroupMemberScoreChange = (studentId: number, value: string) => {
        const sanitizedValue = sanitizeScoreInput(value, assignment?.max_score);
        setEditGroupMemberScores(prev => ({
            ...prev,
            [studentId]: sanitizedValue,
        }));
    };

    const handleEditGroupMemberSubItemScoreChange = (studentId: number, subItemId: number, value: string) => {
        const maxScore = assignment?.subItems?.find((item) => item.id === subItemId)?.max_score;
        const sanitizedValue = sanitizeScoreInput(value, maxScore);
        setEditGroupMemberSubItemScores(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                [subItemId]: sanitizedValue,
            },
        }));
    };

    const hasPendingSubItemEdit = (studentId: number, subItemId: number): boolean => {
        return (pendingEditSubItemByStudent[studentId] || []).includes(subItemId);
    };

    // Filter groups for edit search
    const filteredEditGroups = useMemo(() => {
        if (!editGroupSearchQuery.trim()) return groups;
        const query = editGroupSearchQuery.toLowerCase();
        return groups.filter(
            g => g.name.toLowerCase().includes(query) ||
                g.members.some(m =>
                    m.full_name.toLowerCase().includes(query) ||
                    m.student_id.toLowerCase().includes(query)
                )
        );
    }, [groups, editGroupSearchQuery]);

    const canSubmitEdit = useMemo(() => {
        if (!isCourseActive) return false;
        // Check if reason is valid
        const hasValidReason = editReasonType !== "" && (editReasonType !== "other" || editReasonCustom.trim() !== "");

        // Group + sub-items: allow submitting all changed sub-items in one request flow
        if (isGroupAssignment && editSelectedGroup && hasSubItems) {
            if (!hasValidReason) return false;
            const selectedMembers = groupMemberScores.filter(m => m.selected);

            if (selectedMembers.length === 0) return false;

            if (editGroupMode === "selected") {
                let hasAnyChangedEntry = false;

                for (const member of selectedMembers) {
                    const subScores = groupMemberSubItemScores.get(member.studentId) || [];

                    for (const subScore of subScores) {
                        if (!subScore.scoreId) continue;

                        const subItemId = subScore.subItemId;
                        const maxScore = assignment?.subItems?.find(si => si.id === subItemId)?.max_score || 0;
                        const currentScore = getMemberSubItemScoreData(member.studentId, subItemId)?.score;
                        const value = editGroupMemberSubItemScores[member.studentId]?.[subItemId] ?? (currentScore?.toString() || "");
                        if (hasPendingSubItemEdit(member.studentId, subItemId)) continue;

                        if (value === "") continue;
                        if (!validateScore(value, maxScore)) return false;

                        if (currentScore === null || currentScore === undefined || parseFloat(value) !== Number(currentScore)) {
                            hasAnyChangedEntry = true;
                        }
                    }
                }

                return hasAnyChangedEntry;
            }

            let hasAnyChangedSubItem = false;

            for (const subItem of editSubItemScores) {
                const maxScore = assignment?.subItems?.find(si => si.id === subItem.subItemId)?.max_score || 0;
                if (subItem.newScore === "") continue;
                if (!validateScore(subItem.newScore, maxScore)) return false;

                const isChanged = subItem.currentScore === null || subItem.currentScore === undefined
                    ? true
                    : parseFloat(subItem.newScore) !== Number(subItem.currentScore);

                if (!isChanged) continue;

                const hasAnyTarget = selectedMembers.some((member) => {
                    if (hasPendingSubItemEdit(member.studentId, subItem.subItemId)) {
                        return false;
                    }
                    const sub = groupMemberSubItemScores.get(member.studentId);
                    return sub?.find(s => s.subItemId === subItem.subItemId)?.scoreId != null;
                });

                if (hasAnyTarget) {
                    hasAnyChangedSubItem = true;
                }
            }

            return hasAnyChangedSubItem;
        }

        // For sub-items (individual): allow multiple changed sub-items in one submit
        if (hasSubItems) {
            if (!hasValidReason) return false;

            let hasAnyChangedSubItem = false;
            for (const subItem of editSubItemScores) {
                if (!subItem.scoreId) continue;
                if (subItem.newScore === "") continue;

                const maxScore = assignment?.subItems?.find(si => si.id === subItem.subItemId)?.max_score || 0;
                if (!validateScore(subItem.newScore, maxScore)) return false;

                if (subItem.currentScore === null || subItem.currentScore === undefined || parseFloat(subItem.newScore) !== Number(subItem.currentScore)) {
                    hasAnyChangedSubItem = true;
                }
            }

            return hasAnyChangedSubItem;
        }

        // For group edit - check if at least one member is selected with valid score (and no pending edit)
        if (isGroupAssignment && editSelectedGroup) {
            const selectedMembers = groupMemberScores.filter(m => m.selected && m.scoreId && !m.hasPendingEdit);
            if (selectedMembers.length === 0 || !hasValidReason) return false;
            if (editGroupMode === "selected") {
                return selectedMembers.every((member) => {
                    const value = editGroupMemberScores[member.studentId] ?? "";
                    return value !== "" && validateScore(value, assignment?.max_score || 0);
                });
            }
            if (newScore === "" || !validateScore(newScore, assignment?.max_score || 0)) return false;
            return true;
        }

        // For main score (individual)
        if (!currentScore || !hasValidReason) return false;
        if (newScore === "" || !validateScore(newScore, assignment?.max_score || 0)) return false;
        return true;
    }, [currentScore, newScore, editReasonType, editReasonCustom, assignment, hasSubItems, selectedEditSubItemId, editSubItemScores, isCourseActive, isGroupAssignment, editSelectedGroup, groupMemberScores, groupMemberSubItemScores, editGroupMode, editGroupMemberScores, editGroupMemberSubItemScores, pendingEditSubItemByStudent]);

    const handleSubItemNewScoreChange = (subItemId: number, value: string) => {
        const maxScore = assignment?.subItems?.find((item) => item.id === subItemId)?.max_score;
        const sanitizedValue = sanitizeScoreInput(value, maxScore);
        setEditSubItemScores(prev => prev.map(s =>
            s.subItemId === subItemId ? { ...s, newScore: sanitizedValue } : s
        ));
    };

    const buildEditConfirmationLines = (): string[] => {
        const lines: string[] = [];

        if (isGroupAssignment && editSelectedGroup && hasSubItems) {
            lines.push(`${t("กลุ่ม", "Group")}: ${editSelectedGroup.name}`);

            const selectedMembers = groupMemberScores.filter(m => m.selected);
            if (editGroupMode === "selected") {
                let changedCount = 0;

                selectedMembers.forEach((member) => {
                    const subScores = groupMemberSubItemScores.get(member.studentId) || [];
                    subScores.forEach((subScore) => {
                        if (!subScore.scoreId) return;
                        if (hasPendingSubItemEdit(member.studentId, subScore.subItemId)) return;
                        const currentScore = getMemberSubItemScoreData(member.studentId, subScore.subItemId)?.score;
                        const targetScore = editGroupMemberSubItemScores[member.studentId]?.[subScore.subItemId] ?? (currentScore?.toString() || "");
                        if (targetScore === "") return;
                        if (currentScore !== null && currentScore !== undefined && parseFloat(targetScore) === Number(currentScore)) return;

                        const subItemName = getSubItemName(subScore.subItemId);
                        lines.push(`- ${member.studentName} | ${subItemName}: ${targetScore}`);
                        changedCount += 1;
                    });
                });

                if (changedCount === 0) {
                    lines.push(t("ยังไม่มีการเปลี่ยนแปลงคะแนนข้อย่อย", "No sub-item score changes yet"));
                }
            } else {
                const changedSubItems = editSubItemScores.filter((subItem) => {
                    if (subItem.newScore === "") return false;
                    if (subItem.currentScore === null || subItem.currentScore === undefined) return true;
                    return parseFloat(subItem.newScore) !== Number(subItem.currentScore);
                });

                if (changedSubItems.length === 0) {
                    lines.push(t("ยังไม่มีการเปลี่ยนแปลงคะแนนข้อย่อย", "No sub-item score changes yet"));
                } else {
                    changedSubItems.forEach((subItem) => {
                        const subItemName = getSubItemName(subItem.subItemId);
                        const targetCount = selectedMembers.filter((member) => {
                            if (hasPendingSubItemEdit(member.studentId, subItem.subItemId)) {
                                return false;
                            }
                            const sub = groupMemberSubItemScores.get(member.studentId);
                            return sub?.some(s => s.subItemId === subItem.subItemId && s.scoreId != null);
                        }).length;
                        lines.push(`- ${subItemName}: ${subItem.newScore} (${formatMemberCount(targetCount)})`);
                    });
                }
            }
            return lines;
        }

        if (isGroupAssignment && editSelectedGroup) {
            lines.push(`${t("กลุ่ม", "Group")}: ${editSelectedGroup.name}`);
            const selectedMembers = groupMemberScores.filter(m => m.selected && m.scoreId && !m.hasPendingEdit);
            if (editGroupMode === "selected") {
                selectedMembers.forEach((member) => {
                    const targetScore = editGroupMemberScores[member.studentId] ?? "";
                    lines.push(`- ${member.studentName}: ${targetScore}`);
                });
            } else {
                lines.push(`${t("แก้ทั้งกลุ่มเป็น", "Apply to whole group")}: ${newScore}`);
                lines.push(`${t("จำนวนสมาชิก", "Members")}: ${formatMemberCount(selectedMembers.length)}`);
            }
            return lines;
        }

        if (hasSubItems) {
            const changedSubItems = editSubItemScores.filter((subItem) => {
                if (!subItem.scoreId || subItem.newScore === "") return false;
                if (subItem.currentScore === null || subItem.currentScore === undefined) return true;
                return parseFloat(subItem.newScore) !== Number(subItem.currentScore);
            });

            if (changedSubItems.length === 0) {
                lines.push(t("ยังไม่มีการเปลี่ยนแปลงคะแนนข้อย่อย", "No sub-item score changes yet"));
                return lines;
            }

            changedSubItems.forEach((subItem) => {
                const subItemName = getSubItemName(subItem.subItemId);
                lines.push(`- ${subItemName}: ${subItem.newScore}`);
            });
            return lines;
        }

        lines.push(`${t("คะแนนใหม่", "New score")}: ${newScore}`);
        return lines;
    };
    const formatSkippedEditDetails = (result: {
        skipped: number;
        skipped_names: string[];
        skipped_items?: { student_name: string; sub_item_name?: string | null }[];
    }): string => {
        if (result.skipped <= 0) {
            return "";
        }

        const itemLabels = (result.skipped_items ?? [])
            .map((item) => item.sub_item_name
                ? `${item.student_name} (${localizeGeneratedSubItemName(item.sub_item_name, 1, isEnglish)})`
                : item.student_name)
            .filter((value) => value.trim().length > 0);

        const fallbackNames = (result.skipped_names ?? []).filter((value) => value.trim().length > 0);
        const merged = itemLabels.length > 0 ? itemLabels : fallbackNames;
        const unique = Array.from(new Set(merged));

        if (unique.length === 0) {
            return "";
        }

        if (unique.length <= 5) {
            return unique.join(", ");
        }

        return isEnglish
            ? `${unique.slice(0, 5).join(", ")} and ${unique.length - 5} more ${unique.length - 5 === 1 ? "item" : "items"}`
            : `${unique.slice(0, 5).join(", ")} และอีก ${unique.length - 5} รายการ`;
    };

    const handleSubmitEdit = async () => {
        if (!isCourseActive) {
            addToast({
                title: t("รายวิชาถูกปิดแล้ว", "Course is closed"),
                description: t("วิชาที่ปิดแล้วจะดูข้อมูลได้อย่างเดียว ไม่สามารถส่งคำขอแก้ไขคะแนนได้", "Closed courses are read-only. Score edit requests are disabled."),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const finalReason = getFinalEditReason();

            // Group + sub-items: submit all changed sub-items in one action
            if (isGroupAssignment && editSelectedGroup && hasSubItems) {
                const selectedMembers = groupMemberScores.filter(m => m.selected);
                if (selectedMembers.length === 0) {
                    addToast({
                        title: t("ไม่มีสมาชิกที่เลือก", "No members selected"),
                        description: t(
                            "กรุณาเลือกอย่างน้อย 1 คนที่มีคะแนนในข้อย่อยนี้",
                            "Please select at least one member with a score for this sub-item.",
                        ),
                        color: "warning",
                        timeout: 3000,
                        shouldShowTimeoutProgress: true,
                    });
                    return;
                }

                if (editGroupMode === "selected") {
                    const editTargets: { studentId: number; scoreId: number; subItemId: number; newScore: number }[] = [];

                    for (const member of selectedMembers) {
                        const subScores = groupMemberSubItemScores.get(member.studentId) || [];
                        for (const subScore of subScores) {
                            if (!subScore.scoreId) continue;
                            if (hasPendingSubItemEdit(member.studentId, subScore.subItemId)) continue;

                            const currentScore = getMemberSubItemScoreData(member.studentId, subScore.subItemId)?.score;
                            const rawValue = editGroupMemberSubItemScores[member.studentId]?.[subScore.subItemId] ?? (currentScore?.toString() || "");
                            if (rawValue === "") continue;

                            const parsedValue = parseFloat(rawValue);
                            if (Number.isNaN(parsedValue)) continue;
                            if (currentScore !== null && currentScore !== undefined && parsedValue === Number(currentScore)) continue;

                            editTargets.push({
                                studentId: member.studentId,
                                scoreId: subScore.scoreId,
                                subItemId: subScore.subItemId,
                                newScore: parsedValue,
                            });
                        }
                    }

                    if (editTargets.length === 0) {
                        addToast({
                            title: t("ยังไม่มีการเปลี่ยนแปลง", "No changes yet"),
                            description: t(
                                "กรุณาปรับคะแนนข้อย่อยอย่างน้อย 1 รายการก่อนส่งคำขอ",
                                "Please update at least one sub-item score before submitting the request.",
                            ),
                            color: "warning",
                            timeout: 3000,
                            shouldShowTimeoutProgress: true,
                        });
                        return;
                    }

                    const detailedBatchResult = await scoreService.requestDetailedScoreEdits({
                        edits: editTargets.map((target) => ({
                            score_id: target.scoreId,
                            new_score: target.newScore,
                        })),
                        reason: finalReason,
                    }, editImages);

                    if (detailedBatchResult.skipped > 0) {
                        const skippedDetails = formatSkippedEditDetails(detailedBatchResult);
                        addToast({
                            title: t("ส่งคำขอแก้ไขสำเร็จ (บางส่วน)", "Edit request submitted (partial)"),
                            description: isEnglish
                                ? `Submitted ${formatRequestCount(detailedBatchResult.created)} | Skipped ${formatRequestCount(detailedBatchResult.skipped)} with pending approvals${skippedDetails ? `: ${skippedDetails}` : ""}`
                                : `ส่งคำขอรวม ${detailedBatchResult.created} รายการ | ข้าม ${detailedBatchResult.skipped} รายการที่มีคำร้องรออนุมัติอยู่แล้ว${skippedDetails ? `: ${skippedDetails}` : ""}`,
                            color: "warning",
                            timeout: 5000,
                            shouldShowTimeoutProgress: true,
                        });
                    } else {
                        addToast({
                            title: t("ส่งคำขอแก้ไขสำเร็จ", "Edit request submitted"),
                            description: isEnglish
                                ? `Submitted ${formatRequestCount(detailedBatchResult.created)} for individual sub-item edits.`
                                : `ส่งคำขอแก้ไขคะแนนข้อย่อยแบบรายบุคคล ${detailedBatchResult.created} รายการเรียบร้อยแล้ว`,
                            color: "success",
                            timeout: 3000,
                            shouldShowTimeoutProgress: true,
                        });
                    }
                } else {
                    const changedSubItems = editSubItemScores.filter((subItem) => {
                        if (subItem.newScore === "") return false;
                        if (subItem.currentScore === null || subItem.currentScore === undefined) return true;
                        return parseFloat(subItem.newScore) !== Number(subItem.currentScore);
                    });

                    if (changedSubItems.length === 0) {
                        addToast({
                            title: t("ยังไม่มีการเปลี่ยนแปลง", "No changes yet"),
                            description: t(
                                "กรุณาปรับคะแนนข้อย่อยอย่างน้อย 1 ข้อก่อนส่งคำขอ",
                                "Please update at least one sub-item score before submitting the request.",
                            ),
                            color: "warning",
                            timeout: 3000,
                            shouldShowTimeoutProgress: true,
                        });
                        return;
                    }

                    const detailedEdits: { score_id: number; new_score: number }[] = [];

                    for (const subItem of changedSubItems) {
                        const scoreIds = selectedMembers
                            .map((member) => {
                                if (hasPendingSubItemEdit(member.studentId, subItem.subItemId)) {
                                    return null;
                                }
                                return groupMemberSubItemScores.get(member.studentId)?.find(s => s.subItemId === subItem.subItemId)?.scoreId ?? null;
                            })
                            .filter((scoreId): scoreId is number => scoreId !== null);

                        scoreIds.forEach((scoreId) => {
                            detailedEdits.push({
                                score_id: scoreId,
                                new_score: parseFloat(subItem.newScore),
                            });
                        });
                    }

                    if (detailedEdits.length === 0) {
                        addToast({
                            title: t("ไม่มีรายการที่ส่งได้", "No eligible items"),
                            description: t(
                                "ไม่พบสมาชิกที่มีคะแนนข้อย่อยตรงกับรายการที่แก้ไข",
                                "No members with matching sub-item scores were found for these edits.",
                            ),
                            color: "warning",
                            timeout: 3000,
                            shouldShowTimeoutProgress: true,
                        });
                        return;
                    }

                    const detailedBatchResult = await scoreService.requestDetailedScoreEdits({
                        edits: detailedEdits,
                        reason: finalReason,
                    }, editImages);

                    if (detailedBatchResult.skipped > 0) {
                        const skippedDetails = formatSkippedEditDetails(detailedBatchResult);
                        addToast({
                            title: t("ส่งคำขอแก้ไขสำเร็จ (บางส่วน)", "Edit request submitted (partial)"),
                            description: isEnglish
                                ? `Submitted ${formatRequestCount(detailedBatchResult.created)} | Skipped ${formatRequestCount(detailedBatchResult.skipped)} with pending approvals${skippedDetails ? `: ${skippedDetails}` : ""}`
                                : `ส่งคำขอรวม ${detailedBatchResult.created} รายการ | ข้าม ${detailedBatchResult.skipped} รายการที่มีคำร้องรออนุมัติอยู่แล้ว${skippedDetails ? `: ${skippedDetails}` : ""}`,
                            color: "warning",
                            timeout: 5000,
                            shouldShowTimeoutProgress: true,
                        });
                    } else {
                        addToast({
                            title: t("ส่งคำขอแก้ไขสำเร็จ", "Edit request submitted"),
                            description: isEnglish
                                ? `Submitted ${formatRequestCount(detailedBatchResult.created)} for grouped sub-item edits.`
                                : `ส่งคำขอแก้ไขคะแนนข้อย่อยรวม ${detailedBatchResult.created} รายการเรียบร้อยแล้ว`,
                            color: "success",
                            timeout: 3000,
                            shouldShowTimeoutProgress: true,
                        });
                    }
                }

            // Individual sub-item edit: submit all changed sub-items
            } else if (hasSubItems) {
                const changedSubItems = editSubItemScores.filter((subItem) => {
                    if (!subItem.scoreId || subItem.newScore === "") return false;
                    if (subItem.currentScore === null || subItem.currentScore === undefined) return true;
                    return parseFloat(subItem.newScore) !== Number(subItem.currentScore);
                });

                if (changedSubItems.length === 0) {
                    addToast({
                        title: t("ยังไม่มีการเปลี่ยนแปลง", "No changes yet"),
                        description: t(
                            "กรุณาปรับคะแนนข้อย่อยอย่างน้อย 1 ข้อก่อนส่งคำขอ",
                            "Please update at least one sub-item score before submitting the request.",
                        ),
                        color: "warning",
                        timeout: 3000,
                        shouldShowTimeoutProgress: true,
                    });
                    return;
                }

                const detailedBatchResult = await scoreService.requestDetailedScoreEdits({
                    edits: changedSubItems.map((subItem) => ({
                        score_id: subItem.scoreId!,
                        new_score: parseFloat(subItem.newScore),
                    })),
                    reason: finalReason,
                }, editImages);

                if (detailedBatchResult.skipped > 0) {
                    const skippedDetails = formatSkippedEditDetails(detailedBatchResult);
                    addToast({
                        title: t("ส่งคำขอแก้ไขสำเร็จ (บางส่วน)", "Edit request submitted (partial)"),
                        description: isEnglish
                            ? `Submitted ${formatRequestCount(detailedBatchResult.created)} | Skipped ${formatRequestCount(detailedBatchResult.skipped)} with pending approvals${skippedDetails ? `: ${skippedDetails}` : ""}`
                            : `ส่งคำขอรวม ${detailedBatchResult.created} รายการ | ข้าม ${detailedBatchResult.skipped} รายการที่มีคำร้องรออนุมัติอยู่แล้ว${skippedDetails ? `: ${skippedDetails}` : ""}`,
                        color: "warning",
                        timeout: 5000,
                        shouldShowTimeoutProgress: true,
                    });
                } else {
                    addToast({
                        title: t("ส่งคำขอแก้ไขสำเร็จ", "Edit request submitted"),
                        description: isEnglish
                            ? `Submitted ${formatRequestCount(detailedBatchResult.created)} for sub-item score edits.`
                            : `ส่งคำขอแก้ไขคะแนนข้อย่อย ${detailedBatchResult.created} ข้อเรียบร้อยแล้ว`,
                        color: "success",
                        timeout: 3000,
                        shouldShowTimeoutProgress: true,
                    });
                }
            } else if (isGroupAssignment && editSelectedGroup) {
                // For group edit - submit edit requests for all selected members (excluding those with pending edits)
                const selectedMembers = groupMemberScores.filter(m => m.selected && m.scoreId && !m.hasPendingEdit);

                if (selectedMembers.length === 0) {
                    addToast({
                        title: t("ไม่มีสมาชิกที่เลือก", "No members selected"),
                        description: t(
                            "กรุณาเลือกอย่างน้อย 1 คนที่มีคะแนนอยู่แล้ว",
                            "Please select at least one member who already has a score.",
                        ),
                        color: "warning",
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });
                    return;
                }

                if (editGroupMode === "selected") {
                    for (const member of selectedMembers) {
                        const memberScore = editGroupMemberScores[member.studentId] ?? "";
                        await scoreService.requestScoreEdit({
                            score_id: member.scoreId!,
                            new_score: parseFloat(memberScore),
                            reason: finalReason,
                        }, editImages);
                    }

                    addToast({
                        title: t("ส่งคำขอแก้ไขสำเร็จ", "Edit request submitted"),
                        description: isEnglish
                            ? `Submitted individual edit requests for ${formatStudentCount(selectedMembers.length)}.`
                            : `ส่งคำขอแก้ไขคะแนนแบบรายบุคคล ${selectedMembers.length} คนเรียบร้อยแล้ว`,
                        color: "success",
                        timeout: 3000,
                        shouldShowTimeoutProgress: true,
                    });
                } else {
                    // Submit batch edit request
                    const batchResult = await scoreService.requestGroupScoreEdit({
                        score_ids: selectedMembers.map(m => m.scoreId!),
                        new_score: parseFloat(newScore),
                        reason: finalReason,
                    }, editImages);

                    if (batchResult.skipped > 0) {
                        const skippedDetails = formatSkippedEditDetails(batchResult);
                        addToast({
                            title: t("ส่งคำขอแก้ไขสำเร็จ (บางส่วน)", "Edit request submitted (partial)"),
                            description: isEnglish
                                ? `Submitted requests for ${formatStudentCount(batchResult.created)} | Skipped ${formatStudentCount(batchResult.skipped)} with pending approvals${skippedDetails ? `: ${skippedDetails}` : ""}`
                                : `ส่งคำขอสำหรับ ${batchResult.created} คน | ข้าม ${batchResult.skipped} คนที่มีคำร้องรออนุมัติอยู่แล้ว${skippedDetails ? `: ${skippedDetails}` : ""}`,
                            color: "warning",
                            timeout: 5000,
                            shouldShowTimeoutProgress: true,
                        });
                    } else {
                        addToast({
                            title: t("ส่งคำขอแก้ไขสำเร็จ", "Edit request submitted"),
                            description: isEnglish
                                ? `Submitted requests for ${formatStudentCount(batchResult.created)}.`
                                : `ส่งคำขอแก้ไขคะแนนสำหรับ ${batchResult.created} คนเรียบร้อยแล้ว`,
                            color: "success",
                            timeout: 3000,
                            shouldShowTimeoutProgress: true,
                        });
                    }
                }
            } else {
                // For main score (individual)
                if (!currentScore?.score_id) return;

                await scoreService.requestScoreEdit({
                    score_id: currentScore.score_id,
                    new_score: parseFloat(newScore),
                    reason: finalReason,
                }, editImages);

                addToast({
                    title: t("ส่งคำขอแก้ไขสำเร็จ", "Edit request submitted"),
                    description: t(
                        "คำขอแก้ไขคะแนนถูกส่งไปยังอาจารย์แล้ว",
                        "The score edit request was sent to the instructor.",
                    ),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }

            setEditSelectedStudent(null);
            setEditSelectedGroup(null);
            setCurrentScore(null);
            setNewScore("");
            setEditReason("");
            setEditReasonType("");
            setEditReasonCustom("");
            setEditImages([]);
            setEditImagePreviews([]);
            setEditSearchQuery("");
            setEditGroupSearchQuery("");
            setEditSubItemScores([]);
            setSelectedEditSubItemId(null);
            setGroupMemberScores([]);
            setGroupMemberSubItemScores(new Map());
            setEditGroupMode("all");
            setEditGroupMemberScores({});
            setEditGroupMemberSubItemScores({});
        } catch (error) {
            const errorMessage = error instanceof Error && error.message
                ? error.message
                : t("ไม่สามารถส่งคำขอแก้ไขได้", "Unable to submit the edit request.");
            addToast({
                title: t("เกิดข้อผิดพลาด", "Error"),
                description: errorMessage,
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get assignment type info
    const getTypeInfo = () => {
        if (!assignment) return { icon: "solar:document-bold", color: "from-blue-400 to-indigo-500" };
        switch (assignment.assignment_type) {
            case "individual":
                return { icon: "solar:user-bold", color: "from-blue-400 to-indigo-500" };
            case "permanent_group":
                return { icon: "solar:users-group-two-rounded-bold", color: "from-blue-400 to-indigo-500" };
            default:
                return { icon: "solar:users-group-rounded-bold", color: "from-blue-400 to-indigo-500" };
        }
    };

    // Don't render anything if no assignment
    if (!assignment) return null;

    const typeInfo = getTypeInfo();
    const editConfirmationLines = activeTab === "edit" ? buildEditConfirmationLines() : [];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            scrollBehavior="outside"
            placement="top-center"

        >
            <ModalContent className="score-modal-theme-scope bg-content2 text-foreground">
                <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 bg-linear-to-br ${typeInfo.color} rounded-xl shadow-lg`}>
                            <Icon icon={typeInfo.icon} className="text-2xl text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-slate-800">{assignment.name}</h3>
                                {assignment.is_score_visible === false && (
                                    <Tooltip content={t("ไม่แสดงคะแนนให้นักศึกษารู้", "Scores are not shown to students")}>
                                        <Chip size="sm" variant="flat" className="bg-amber-50 text-amber-600 gap-1" startContent={<Icon icon="solar:eye-closed-linear" width={14} />}>
                                            {t("ไม่แสดงคะแนน", "No student score")}
                                        </Chip>
                                    </Tooltip>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 font-normal mt-1">
                                {t("คะแนนเต็ม", "Maximum score")} {formatPointCount(assignment.max_score)}
                                {hasSubItems && ` • ${formatSubItemCount(assignment.subItems?.length ?? 0)}`}
                            </p>
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody className="px-6 py-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Spinner size="lg" />
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Tabs */}
                            {showBothTabs && (
                            <Tabs
                                selectedKey={activeTab}
                                onSelectionChange={(key) => setActiveTab(key as "grade" | "edit")}
                                variant="underlined"
                                classNames={{
                                    tabList: "gap-6 w-full",
                                    cursor: "bg-blue-500",
                                    tab: "px-0 h-10",
                                    tabContent: "group-data-[selected=true]:text-blue-600 font-medium"
                                }}
                            >
                                <Tab
                                    key="grade"
                                    title={
                                        <div className="flex items-center gap-2">
                                            <Icon icon="solar:pen-new-square-bold" className="text-lg" />
                                            <span>{t("ลงคะแนน", "Grade")}</span>
                                        </div>
                                    }
                                />
                                <Tab
                                    key="edit"
                                    title={
                                        <div className="flex items-center gap-2">
                                            <Icon icon="solar:pen-2-bold" className="text-lg" />
                                            <span>{t("แก้ไขคะแนน", "Edit score")}</span>
                                        </div>
                                    }
                                />
                            </Tabs>
                            )}

                            {activeTab === "grade" ? (
                                /* Grade Tab */
                                <div className="space-y-5">
                                    {/* Student/Group Selection */}
                                    {!isGroupAssignment ? (
                                        <div>
                                            <label className="text-slate-600 font-medium text-sm mb-2 block">{t("ค้นหานักศึกษา", "Find a student")}</label>
                                            {!selectedStudent && (
                                                <Autocomplete
                                                    placeholder={t("พิมพ์รหัสหรือชื่อนักศึกษา...", "Type a student ID or name...")}
                                                    inputValue={searchQuery}
                                                    onInputChange={setSearchQuery}
                                                    selectedKey={null}
                                                    onSelectionChange={handleStudentSelect}
                                                    startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400" />}
                                                    variant="bordered"
                                                    classNames={SCORE_SEARCH_AUTOCOMPLETE_CLASSNAMES}
                                                    listboxProps={SCORE_SEARCH_LISTBOX_PROPS}
                                                    inputProps={{
                                                        classNames: {
                                                            inputWrapper: "bg-content1 border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                                        },
                                                    }}
                                                >
                                                    {filteredStudents.map((student) => (
                                                        <AutocompleteItem
                                                            key={student.id.toString()}
                                                            textValue={`${student.student_id} ${student.full_name}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <Avatar
                                                                    name={`${student.full_name}`}
                                                                    size="sm"
                                                                    className="bg-linear-to-br from-blue-400 to-indigo-500 text-white shrink-0"
                                                                />
                                                                <div>
                                                                    <p className="font-medium text-foreground">{student.full_name}</p>
                                                                    <p className="text-xs text-default-500">{student.student_id}</p>
                                                                </div>
                                                            </div>
                                                        </AutocompleteItem>
                                                    ))}
                                                </Autocomplete>
                                            )}

                                            {/* Selected Student Info */}
                                            {selectedStudent && (
                                                <div className={`mt-3 p-3 rounded-xl border ${!canScoreSelected ? 'bg-red-50 border-red-200' : existingScore ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            name={`${selectedStudent.full_name}`}
                                                            size="md"
                                                            className={`text-white ${!canScoreSelected ? 'bg-red-400' : 'bg-linear-to-br from-blue-400 to-indigo-500'}`}
                                                        />
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-slate-800">
                                                                {selectedStudent.full_name}
                                                            </p>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm text-slate-500">{selectedStudent.student_id}</p>
                                                                {(() => {
                                                                    const info = getStudentAttendanceInfo(selectedStudent.id);
                                                                    const label = getAttendanceLabel(info.status);
                                                                    if (label) {
                                                                        return (
                                                                            <Chip size="sm" className={`${label.bg} ${label.color}`}>
                                                                                {label.text}
                                                                            </Chip>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            isIconOnly
                                                            size="sm"
                                                            variant="light"
                                                            onPress={() => {
                                                                setSelectedStudent(null);
                                                                setSearchQuery("");
                                                                setExistingScore(null);
                                                            }}
                                                        >
                                                            <Icon icon="solar:close-circle-bold" className="text-xl text-slate-400" />
                                                        </Button>
                                                    </div>

                                                    {/* Loading indicator while checking score */}
                                                    {isCheckingScore && (
                                                        <div className="mt-3 p-3 bg-slate-100 rounded-lg border border-slate-200">
                                                            <div className="flex items-center gap-2">
                                                                <Spinner size="sm" />
                                                                <p className="text-sm text-slate-600">{t("กำลังตรวจสอบคะแนน...", "Checking scores...")}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Warning if student is absent (cannot score) */}
                                                    {!isCheckingScore && !canScoreSelected && (
                                                        <div className="mt-3 p-3 bg-red-100 rounded-lg border border-red-300">
                                                            <div className="flex items-start gap-2">
                                                                <Icon icon="solar:user-cross-bold" className="text-xl text-red-600 shrink-0 mt-0.5" />
                                                                <div>
                                                                    <p className="text-sm font-semibold text-red-800">{t("ไม่สามารถลงคะแนนได้", "Scoring unavailable")}</p>
                                                                    <p className="text-xs text-red-700 mt-1">
                                                                        {t("นักศึกษาคนนี้ขาดเรียนในรอบเช็คชื่อที่เชื่อมกับงานนี้", "This student was absent in the attendance session linked to this assignment.")}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Warning if already scored */}
                                                    {!isCheckingScore && canScoreSelected && existingScore && !hasSubItems && (
                                                        <div className="mt-3 p-3 bg-amber-100 rounded-lg border border-amber-300">
                                                            <div className="flex items-start gap-2">
                                                                <Icon icon="solar:danger-triangle-bold" className="text-xl text-amber-600 shrink-0 mt-0.5" />
                                                                <div>
                                                                    <p className="text-sm font-semibold text-amber-800">{t("นักศึกษาคนนี้ได้รับคะแนนไปแล้ว", "This student already has a score")}</p>
                                                                    <p className="text-lg font-bold text-amber-900 mt-1">
                                                                        {existingScore.score} / {assignment?.max_score} {isEnglish ? "points" : "คะแนน"}
                                                                    </p>
                                                                    {existingScore.graded_by && (
                                                                        <p className="text-xs text-amber-700 mt-1">
                                                                            {t("ให้คะแนนโดย", "Graded by")}: {existingScore.graded_by.display_name}
                                                                            {existingScore.graded_at && ` ${t("เมื่อ", "on")} ${formatLocalizedDate(existingScore.graded_at)}`}
                                                                        </p>
                                                                    )}
                                                                    <p className="text-xs text-amber-600 mt-2">
                                                                        {t("หากต้องการแก้ไข กรุณาไปที่แท็บ \"แก้ไขคะแนน\"", "If you need to change it, go to the \"Edit score\" tab.")}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Group Assignment */
                                        <div>
                                            <label className="text-slate-600 font-medium text-sm mb-2 block">{t("ค้นหากลุ่ม", "Find a group")}</label>
                                            {!selectedGroup && (
                                                <Autocomplete
                                                    placeholder={t("พิมพ์ชื่อกลุ่มหรือชื่อสมาชิก...", "Type a group name or member name...")}
                                                    inputValue={groupSearchQuery}
                                                    onInputChange={setGroupSearchQuery}
                                                    selectedKey={null}
                                                    onSelectionChange={handleGroupSelect}
                                                    startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400" />}
                                                    variant="bordered"
                                                    classNames={SCORE_SEARCH_AUTOCOMPLETE_CLASSNAMES}
                                                    listboxProps={SCORE_SEARCH_LISTBOX_PROPS}
                                                    inputProps={{
                                                        classNames: {
                                                            inputWrapper: "bg-content1 border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                                        },
                                                    }}
                                                >
                                                    {filteredGroups.map((group) => (
                                                        <AutocompleteItem
                                                            key={group.id.toString()}
                                                            textValue={group.name}
                                                        >
                                                            <div className="flex items-center justify-between w-full">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-2 ${isPermanentGroup ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'} rounded-lg shrink-0`}>
                                                                        <Icon icon={isPermanentGroup ? "solar:users-group-two-rounded-bold" : "solar:users-group-rounded-bold"} className={`text-lg ${groupColors.icon}`} />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-medium text-foreground">{group.name}</p>
                                                                        <p className="text-xs text-default-500">
                                                                            {group.members.slice(0, 3).map(m => m.full_name).join(", ")}
                                                                            {group.members.length > 3 && (isEnglish ? ` +${group.members.length - 3} more` : ` +${group.members.length - 3} คน`)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <Chip size="sm" variant="flat" className="bg-content3 text-default-600">
                                                                    {formatMemberCount(group.members.length)}
                                                                </Chip>
                                                            </div>
                                                        </AutocompleteItem>
                                                    ))}
                                                </Autocomplete>
                                            )}

                                            {/* Selected Group Info */}
                                            {selectedGroup && (
                                                <div className={`mt-3 p-3 rounded-xl border ${absentGroupMembers.length > 0 ? 'bg-red-50 border-red-200' : existingScore ? 'bg-amber-50 border-amber-200' : `${groupColors.bg} ${groupColors.border}`}`}>
                                                    <div className="flex items-center justify-between ">
                                                        <div className="flex items-center gap-2">
                                                            <Icon icon={isPermanentGroup ? "solar:users-group-two-rounded-bold" : "solar:users-group-rounded-bold"} className={`text-xl ${absentGroupMembers.length > 0 ? 'text-red-500' : groupColors.icon}`} />
                                                            <span className="font-semibold text-slate-800">{selectedGroup.name}</span>
                                                            <Chip size="sm" variant="flat" className={absentGroupMembers.length > 0 ? 'bg-red-100 text-red-700' : groupColors.chip}>
                                                                {formatMemberCount(selectedGroup.members.length)}
                                                            </Chip>
                                                        </div>
                                                        <Button
                                                            isIconOnly
                                                            size="sm"
                                                            variant="light"
                                                            onPress={() => {
                                                                setSelectedGroup(null);
                                                                setGroupSearchQuery("");
                                                                setExistingScore(null);
                                                            }}
                                                        >
                                                            <Icon icon="solar:close-circle-bold" className="text-xl text-slate-400" />
                                                        </Button>
                                                    </div>
                                                    {/* รายชื่อกลุ่ม  */}
                                                    {/* <div className="flex flex-wrap gap-2">
                                                        {selectedGroup.members.map((member) => {
                                                            const info = getStudentAttendanceInfo(member.id);
                                                            const label = getAttendanceLabel(info.status);
                                                            return (
                                                                <Chip
                                                                    key={member.id}
                                                                    size="sm"
                                                                    variant="flat"
                                                                    className={!info.canScore ? 'bg-red-100 text-red-700' : 'bg-white'}
                                                                    startContent={!info.canScore ? <Icon icon="solar:user-cross-bold" className="text-red-500" /> : undefined}
                                                                >
                                                                    {member.full_name}
                                                                    {label && (
                                                                        <span className={`ml-1 text-xs ${label.color}`}>({label.text})</span>
                                                                    )}
                                                                </Chip>
                                                            );
                                                        })}
                                                    </div> */}

                                                    {/* Warning if any member is absent */}
                                                    {absentGroupMembers.length > 0 && (
                                                        <div className="mt-3 p-3 bg-red-100 rounded-lg border border-red-300">
                                                            <div className="flex items-start gap-2">
                                                                <Icon icon="solar:users-group-rounded-bold" className="text-xl text-red-600 shrink-0 mt-0.5" />
                                                                <div>
                                                                    <p className="text-sm font-semibold text-red-800">{t("ไม่สามารถลงคะแนนได้", "Scoring unavailable")}</p>
                                                                    <p className="text-xs text-red-700 mt-1">
                                                                        {t("สมาชิกในกลุ่มขาดเรียน", "Absent group members")}: {absentGroupMembers.map(m => m.full_name).join(", ")}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Loading indicator while checking score */}
                                                    {isCheckingScore && (
                                                        <div className="mt-3 p-3 bg-slate-100 rounded-lg border border-slate-200">
                                                            <div className="flex items-center gap-2">
                                                                <Spinner size="sm" />
                                                                <p className="text-sm text-slate-600">{t("กำลังตรวจสอบคะแนน...", "Checking scores...")}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Info: Some members already have scores */}
                                                    {/* {!isCheckingScore && canScoreSelected && gradeGroupMembers.some(m => m.hasScore) && !allMembersHaveScores && !hasSubItems && (
                                                        <div className="mt-3 p-3 bg-blue-100 rounded-lg border border-blue-300">
                                                            <div className="flex items-start gap-2">
                                                                <Icon icon="solar:info-circle-bold" className="text-xl text-blue-600 shrink-0 mt-0.5" />
                                                                <div>
                                                                    <p className="text-sm font-medium text-blue-800">
                                                                        มีสมาชิก {gradeGroupMembers.filter(m => m.hasScore).length} คนที่ได้รับคะแนนแล้ว
                                                                    </p>
                                                                    <p className="text-xs text-blue-600 mt-1">
                                                                        คุณสามารถลงคะแนนเพิ่มเติมให้สมาชิกที่เหลืออีก {membersNeedingScores.length} คน
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )} */}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Grade Mode Selection for Group Assignments */}
                                    {isGroupAssignment && selectedGroup && !isCheckingScore && canScoreSelected && !allMembersHaveScores && (
                                        <div className="mb-4 p-4 bg-linear-to-br from-slate-50 to-blue-50/30 rounded-xl border border-slate-200">
                                            {/* Show members who already have scores */}
                                            {gradeGroupMembers.some(m => m.hasScore) && (
                                                <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                                    <p className="text-xs text-emerald-700 font-medium mb-2 flex items-center gap-1.5">
                                                        <Icon icon="solar:check-circle-bold" className="text-emerald-600" />
                                                        {t("สมาชิกที่ลงคะแนนแล้ว", "Members already scored")} ({formatMemberCount(gradeGroupMembers.filter(m => m.hasScore).length)})
                                                    </p>
                                                    <div className="space-y-1.5">
                                                        {gradeGroupMembers.filter(m => m.hasScore).map((member) => (
                                                            <div key={member.studentId} className="flex items-center justify-between text-xs bg-white/60 rounded-md px-2 py-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    {/* <Icon icon="solar:user-check-bold" className="text-emerald-600" /> */}
                                                                    <span className="text-slate-700 text-sm font-medium">{member.studentName}</span>
                                                                </div>
                                                                <div className="gap-2 text-slate-500">
                                                                    <p className="text-end text-md font-semibold text-emerald-600">{member.existingScore} {isEnglish ? "points" : "คะแนน"}</p>
                                                                    {member.gradedBy && (
                                                                        <>
                                                                            <span>{member.gradedBy}</span>
                                                                        </>
                                                                    )}
                                                                    {member.gradedAt && (
                                                                        <>
                                                                            <span> • </span>
                                                                            <span>{formatLocalizedDateTime(member.gradedAt)}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Show members needing scores */}
                                            {membersNeedingScores.length > 0 && (
                                                <>
                                                    <p className="text-xs text-slate-500 mb-3 font-medium flex items-center gap-1.5">
                                                        {/* <Icon icon="solar:pen-new-square-bold" className="text-blue-500" /> */}
                                                        {t("สมาชิกที่ยังไม่มีคะแนน", "Members without scores")} ({formatMemberCount(membersNeedingScores.length)})
                                                    </p>
                                                    
                                                    {/* Mode selection buttons */}
                                                    <div className="flex gap-2 mb-3">
                                                        <Button
                                                            size="sm"
                                                            variant={gradeGroupMode === "all" ? "solid" : "bordered"}
                                                            color={gradeGroupMode === "all" ? "primary" : "default"}
                                                            onPress={() => {
                                                                setGradeGroupMode("all");
                                                                toggleAllGradeMembersSelection(true);
                                                            }}
                                                            startContent={<Icon icon="solar:users-group-rounded-bold" />}
                                                            className={gradeGroupMode === "all" ? "shadow-md" : ""}
                                                        >
                                                            {t("ลงทุกคนที่เหลือ", "Score all remaining members")}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant={gradeGroupMode === "selected" ? "solid" : "bordered"}
                                                            color={gradeGroupMode === "selected" ? "warning" : "default"}
                                                            onPress={() => setGradeGroupMode("selected")}
                                                            startContent={<Icon icon="solar:user-check-rounded-bold" />}
                                                            className={gradeGroupMode === "selected" ? "shadow-md" : ""}
                                                        >
                                                            {t("เลือกเฉพาะบางคน", "Choose specific members")}
                                                        </Button>
                                                    </div>

                                                    {/* Member Selection when mode is "selected" */}
                                                    {gradeGroupMode === "selected" && (
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-xs text-slate-600 font-medium">
                                                                    {t("เลือกสมาชิกที่ต้องการลงคะแนน:", "Choose the members to score:")}
                                                                </p>
                                                                <div className="flex gap-1">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color="primary"
                                                                        onPress={() => toggleAllGradeMembersSelection(true)}
                                                                        className="text-xs h-7 px-2"
                                                                    >
                                                                        {t("เลือกทั้งหมด", "Select all")}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color="default"
                                                                        onPress={() => toggleAllGradeMembersSelection(false)}
                                                                        className="text-xs h-7 px-2"
                                                                    >
                                                                        {t("ยกเลิกทั้งหมด", "Clear all")}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                                                                {gradeGroupMembers.filter(m => !m.hasScore).map((member) => (
                                                                    <div
                                                                        key={member.studentId}
                                                                        className={`flex items-center justify-between p-3 cursor-pointer transition-all ${
                                                                            !member.canScore
                                                                                ? 'bg-red-50/50 cursor-not-allowed'
                                                                                : member.selected
                                                                                    ? 'bg-blue-50/70'
                                                                                    : 'hover:bg-slate-50'
                                                                        }`}
                                                                        onClick={() => member.canScore && toggleGradeMemberSelection(member.studentId)}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                                                                !member.canScore
                                                                                    ? 'bg-red-100 border-red-300'
                                                                                    : member.selected
                                                                                        ? 'bg-blue-500 border-blue-500 shadow-sm'
                                                                                        : 'border-slate-300 bg-white hover:border-blue-300'
                                                                            }`}>
                                                                                {member.selected && member.canScore && (
                                                                                    <Icon icon="solar:check-bold" className="text-white text-xs" />
                                                                                )}
                                                                                {!member.canScore && (
                                                                                    <Icon icon="solar:close-circle-bold" className="text-red-500 text-xs" />
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                                                                                    !member.canScore
                                                                                        ? 'bg-red-100 text-red-600'
                                                                                        : member.selected
                                                                                            ? 'bg-blue-100 text-blue-600'
                                                                                            : 'bg-slate-100 text-slate-600'
                                                                                }`}>
                                                                                    <Icon icon="solar:user-bold" className="text-sm" />
                                                                                </div>
                                                                                <span className={`text-sm font-medium ${!member.canScore ? 'text-red-700' : 'text-slate-700'}`}>
                                                                                    {member.studentName}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            {!member.canScore ? (
                                                                                <Chip size="sm" color="danger" variant="flat" className="text-xs" startContent={<Icon icon="solar:user-cross-bold" className="mr-1 text-xs" />}>
                                                                                    {t("ขาดเรียน", "Absent")}
                                                                                </Chip>
                                                                            ) : member.selected ? (
                                                                                <Chip size="sm" color="primary" variant="flat" className="text-xs" startContent={<Icon icon="solar:check-circle-bold" className="mr-1 text-xs" />}>
                                                                                    {t("เลือกแล้ว", "Selected")}
                                                                                </Chip>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs">
                                                                <p className="text-slate-500 flex items-center gap-1">
                                                                    <Icon icon="solar:user-check-bold" className="text-blue-500" />
                                                                    {t("เลือกแล้ว", "Selected")} {selectedGradeMembers.length} / {membersNeedingScores.length} {isEnglish ? "students" : "คน"}
                                                                </p>
                                                                {selectedGradeMembers.length === 0 && (
                                                                    <p className="text-amber-600 flex items-center gap-1">
                                                                        <Icon icon="solar:danger-triangle-bold" />
                                                                        {t("กรุณาเลือกอย่างน้อย 1 คน", "Please select at least one student")}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* All members already have scores warning */}
                                    {isGroupAssignment && selectedGroup && !isCheckingScore && allMembersHaveScores && !hasSubItems && (
                                        <div className="mb-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                            <div className="flex items-start gap-3">
                                                <Icon icon="solar:check-circle-bold" className="text-2xl text-emerald-600 shrink-0" />
                                                <div>
                                                    <p className="text-sm font-semibold text-emerald-800">{t("กลุ่มนี้ลงคะแนนครบทุกคนแล้ว", "All members in this group already have scores")}</p>
                                                    <p className="text-xs text-emerald-600 mt-1">{t("หากต้องการแก้ไข กรุณาไปที่แท็บ \"แก้ไขคะแนน\"", "If you need to change scores, use the \"Edit score\" tab.")}</p>
                                                    <div className="mt-3 space-y-1.5">
                                                        {gradeGroupMembers.map((member) => (
                                                            <div key={member.studentId} className="flex items-center justify-between text-xs bg-white/60 rounded-md px-2 py-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    <Icon icon="solar:user-check-bold" className="text-emerald-600" />
                                                                    <span className="text-slate-700 font-medium">{member.studentName}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-slate-500">
                                                                    <span className="font-semibold text-emerald-600">{member.existingScore} {isEnglish ? "points" : "คะแนน"}</span>
                                                                    {member.gradedBy && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span>{t("โดย", "by")} {member.gradedBy}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Score Input Section */}
                                    {(selectedStudent || (selectedGroup && !allMembersHaveScores)) && !isCheckingScore && ((!isGroupAssignment && (!existingScore || hasSubItems)) || (isGroupAssignment && membersNeedingScores.length > 0)) && canScoreSelected && (
                                        <>
                                            <Divider />

                                            <div>
                                                <label className="text-slate-600 font-medium text-sm mb-3 flex items-center gap-2">
                                                    {/* <Icon icon="solar:medal-star-bold" className="text-amber-500" /> */}
                                                    {t("กรอกคะแนน", "Enter score")}
                                                </label>

                                                {hasSubItems ? (
                                                    /* Sub-items score inputs */
                                                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl">
                                                        {isGroupAssignment && gradeGroupMode === "selected" ? (
                                                            <div className="space-y-4">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color="primary"
                                                                        className="text-xs"
                                                                        onPress={applyFirstGradeMemberSubItemScoresToAll}
                                                                    >
                                                                            {t("ใช้คะแนนรายข้อของคนแรกกับทุกคน", "Apply the first student's sub-item scores to everyone")}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color="default"
                                                                        className="text-xs"
                                                                        onPress={resetCopiedGradeMemberSubItemScores}
                                                                    >
                                                                        {t("รีเซ็ตค่าที่คัดลอก", "Reset copied values")}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color="secondary"
                                                                        className="text-xs"
                                                                        isDisabled={subItemCopyUndoHistory.length === 0}
                                                                        onPress={undoSubItemBulkCopy}
                                                                    >
                                                                        {t("Undo คัดลอกล่าสุด", "Undo last copy")}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color="secondary"
                                                                        className="text-xs"
                                                                        isDisabled={subItemCopyRedoHistory.length === 0}
                                                                        onPress={redoSubItemBulkCopy}
                                                                    >
                                                                        Redo
                                                                    </Button>
                                                                </div>
                                                                {gradeGroupMembers
                                                                    .filter((member) => member.selected && member.canScore && !member.hasScore)
                                                                    .map((member) => (
                                                                        <div key={member.studentId} className="p-3 bg-white rounded-lg border border-slate-200 space-y-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <Icon icon="solar:user-bold" className="text-amber-600" />
                                                                                <span className="text-sm font-semibold text-slate-700">{member.studentName}</span>
                                                                            </div>

                                                                            {assignment.subItems?.filter(item => item.id !== undefined).slice().sort((a, b) => a.id! - b.id!).map((subItem, idx) => {
                                                                                const subItemId = subItem.id!;
                                                                                const existingSubScore = getMemberSubItemScoreData(member.studentId, subItemId);
                                                                                const isLocked = existingSubScore && existingSubScore.score !== null;
                                                                                const value = gradeGroupMemberSubItemScores[member.studentId]?.[subItemId] ?? "";

                                                                                return (
                                                                                    <div key={`${member.studentId}_${subItemId}`} className={`flex items-center gap-3 p-2 rounded-md border ${isLocked ? 'bg-amber-50 border-amber-200' : copiedGradeMemberSubItemScores[member.studentId]?.[subItemId] ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                                                                        <span className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-full shrink-0 ${isLocked ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                                            {idx + 1}
                                                                                        </span>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <p className="text-xs font-medium text-slate-700 truncate">{localizeGeneratedSubItemName(subItem.name, idx + 1, isEnglish)}</p>
                                                                                                {copiedGradeMemberSubItemScores[member.studentId]?.[subItemId] && (
                                                                                                    <Tooltip content={getCopySourceLabel(copiedGradeMemberSubItemScoreSources[member.studentId]?.[subItemId])}>
                                                                                                        <Chip size="sm" variant="flat" color="primary" className="text-[10px] h-5">
                                                                                                            {copiedGradeMemberSubItemScoreSources[member.studentId]?.[subItemId] === "from_first"
                                                                                                                ? t("คัดลอกจากคนแรก", "Copied from first")
                                                                                                                : t("คัดลอกจากคนบน", "Copied from above")}
                                                                                                        </Chip>
                                                                                                    </Tooltip>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        {isLocked ? (
                                                                                            <span className="text-xs font-semibold text-amber-700">{existingSubScore?.score} / {subItem.max_score}</span>
                                                                                        ) : (
                                                                                            <div className="flex items-center gap-2">
                                                                                                <Input
                                                                                                    type="text"
                                                                                                    inputMode="decimal"
                                                                                                    pattern={SCORE_INPUT_PATTERN}
                                                                                                    placeholder="0"
                                                                                                    value={value}
                                                                                                    onValueChange={(v) => handleGradeGroupMemberSubItemScoreChange(member.studentId, subItemId, v)}
                                                                                                    min={0}
                                                                                                    max={subItem.max_score}
                                                                                                    step="0.01"
                                                                                                    className="w-20"
                                                                                                    size="sm"
                                                                                                    variant="bordered"
                                                                                                    classNames={{
                                                                                                        input: "text-center font-semibold",
                                                                                                        inputWrapper: "bg-white border-slate-200",
                                                                                                    }}
                                                                                                />
                                                                                                <span className="text-xs text-slate-500">/ {subItem.max_score}</span>
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="flat"
                                                                                                    color="default"
                                                                                                    className="text-xs h-7 px-2"
                                                                                                    onPress={() => copyPreviousGradeMemberSubItemScore(member.studentId, subItemId)}
                                                                                                >
                                                                                                    {t("คัดลอกจากคนบน", "Copy from above")}
                                                                                                </Button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        ) : (
                                                        assignment.subItems?.filter(item => item.id !== undefined).slice().sort((a, b) => a.id! - b.id!).map((subItem, idx) => {
                                                            const subItemId = subItem.id!;
                                                            const existingSubScore = isGroupAssignment
                                                                ? null
                                                                : subItemExistingScores.find(s => s.subItemId === subItemId);
                                                            const isLocked = existingSubScore && existingSubScore.score !== null;

                                                            return (
                                                                <div
                                                                    key={subItemId}
                                                                    className={`flex items-center gap-3 p-3 rounded-lg border ${isLocked
                                                                        ? 'bg-amber-50 border-amber-200'
                                                                        : 'bg-white border-slate-200'
                                                                        }`}
                                                                >
                                                                    <span className={`w-8 h-8 flex items-center justify-center text-sm font-bold rounded-full shrink-0 ${isLocked
                                                                        ? 'bg-amber-100 text-amber-600'
                                                                        : 'bg-blue-100 text-blue-600'
                                                                        }`}>
                                                                        {idx + 1}
                                                                    </span>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-slate-700 truncate">{localizeGeneratedSubItemName(subItem.name, idx + 1, isEnglish)}</p>
                                                                        {isLocked && existingSubScore?.graded_by && (
                                                                            <p className="text-xs text-amber-600 mt-0.5">
                                                                                {t("ลงโดย", "Graded by")} {existingSubScore.graded_by.display_name}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {isLocked ? (
                                                                            <>
                                                                                <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 rounded-lg">
                                                                                    <Icon icon="solar:lock-bold" className="text-amber-600" />
                                                                                    <span className="font-bold text-amber-700">{existingSubScore?.score}</span>
                                                                                </div>
                                                                                <span className="text-sm text-slate-500">/ {subItem.max_score}</span>
                                                                            </>
                                                                        ) : (
                                                                            <div className="flex flex-col items-end gap-2">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Input
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        pattern={SCORE_INPUT_PATTERN}
                                                                                        placeholder="0"
                                                                                        value={subItemScores.find(s => s.subItemId === subItemId)?.score.toString() || ""}
                                                                                        onValueChange={(value) => handleSubItemScoreChange(subItemId, value)}
                                                                                        min={0}
                                                                                        max={subItem.max_score}
                                                                                        step="0.01"
                                                                                        className="w-20"
                                                                                        size="sm"
                                                                                        variant="bordered"
                                                                                        classNames={{
                                                                                            input: "text-center font-semibold",
                                                                                            inputWrapper: "bg-white border-slate-200",
                                                                                        }}
                                                                                    />
                                                                                    <span className="text-sm text-slate-500">/ {subItem.max_score}</span>
                                                                                </div>
                                                                                {/* Quick score buttons for sub-item */}
                                                                                <div className="flex justify-end gap-1">
                                                                                    {(() => {
                                                                                        const max = Number(subItem.max_score);
                                                                                        const currentScore = subItemScores.find(s => s.subItemId === subItemId)?.score.toString() || "";
                                                                                        // Always show 3 buttons: 0, half, full
                                                                                        const half = Number(formatScoreValue(max / 2));
                                                                                        const options = [0, half, max];
                                                                                        return options.map(score => (
                                                                                            <Button
                                                                                                key={score}
                                                                                                size="sm"
                                                                                                variant={currentScore === score.toString() ? "solid" : "flat"}
                                                                                                color={currentScore === score.toString() ? "primary" : "default"}
                                                                                                className={`min-w-10 h-7 text-xs ${currentScore === score.toString()
                                                                                                    ? "bg-blue-500 text-white font-semibold"
                                                                                                    : "bg-slate-100 font-medium"
                                                                                                    }`}
                                                                                                onPress={() => handleSubItemScoreChange(subItemId, score.toString())}
                                                                                            >
                                                                                                {Number.isInteger(score) ? score : score.toFixed(1)}
                                                                                            </Button>
                                                                                        ));
                                                                                    })()}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }))}

                                                        {/* Total Score Display */}
                                                        {/* <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                                                            <span className="text-sm font-medium text-slate-600">รวม:</span>
                                                            <span className="text-xl font-bold text-blue-600">
                                                                {calculatedTotalScore?.toFixed(1) || 0}
                                                            </span>
                                                            <span className="text-sm text-slate-500">/ {assignment.max_score}</span>
                                                        </div> */}
                                                    </div>
                                                ) : (
                                                    /* Single score input */
                                                    <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                                                        {isGroupAssignment && gradeGroupMode === "selected" ? (
                                                            <div className="space-y-3">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color="primary"
                                                                        className="text-xs"
                                                                        onPress={applyFirstGradeMemberScoreToAll}
                                                                    >
                                                                            {t("ใช้คะแนนคนแรกกับทุกคน", "Apply the first score to everyone")}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color="default"
                                                                        className="text-xs"
                                                                        onPress={resetCopiedGradeMemberScores}
                                                                    >
                                                                        {t("รีเซ็ตค่าที่คัดลอก", "Reset copied values")}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color="secondary"
                                                                        className="text-xs"
                                                                        isDisabled={mainCopyUndoHistory.length === 0}
                                                                        onPress={undoMainBulkCopy}
                                                                    >
                                                                        {t("Undo คัดลอกล่าสุด", "Undo last copy")}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color="secondary"
                                                                        className="text-xs"
                                                                        isDisabled={mainCopyRedoHistory.length === 0}
                                                                        onPress={redoMainBulkCopy}
                                                                    >
                                                                        Redo
                                                                    </Button>
                                                                </div>
                                                                {gradeGroupMembers
                                                                    .filter((member) => member.selected && member.canScore && !member.hasScore)
                                                                    .map((member) => (
                                                                        <div key={member.studentId} className={`flex items-center gap-3 p-3 rounded-lg border ${copiedGradeMemberScores[member.studentId] ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                                                                            <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                                                                                <Icon icon="solar:user-bold" className="text-lg text-amber-600" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2">
                                                                                    <p className="text-sm font-medium text-slate-700 truncate">{member.studentName}</p>
                                                                                    {copiedGradeMemberScores[member.studentId] && (
                                                                                        <Tooltip content={getCopySourceLabel(copiedGradeMemberScoreSources[member.studentId])}>
                                                                                            <Chip size="sm" variant="flat" color="primary" className="text-[10px] h-5">
                                                                                                {copiedGradeMemberScoreSources[member.studentId] === "from_first"
                                                                                                    ? t("คัดลอกจากคนแรก", "Copied from first")
                                                                                                    : t("คัดลอกจากคนบน", "Copied from above")}
                                                                                            </Chip>
                                                                                        </Tooltip>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <Input
                                                                                    type="text"
                                                                                    inputMode="decimal"
                                                                                    pattern={SCORE_INPUT_PATTERN}
                                                                                    placeholder="0"
                                                                                    value={gradeGroupMemberScores[member.studentId] ?? ""}
                                                                                    onValueChange={(value) => handleGradeGroupMemberScoreChange(member.studentId, value)}
                                                                                    min={0}
                                                                                    max={assignment.max_score}
                                                                                    step="0.01"
                                                                                    className="w-20"
                                                                                    size="sm"
                                                                                    variant="bordered"
                                                                                    classNames={{
                                                                                        input: "text-center font-semibold",
                                                                                        inputWrapper: "bg-white border-slate-200",
                                                                                    }}
                                                                                />
                                                                                <span className="text-sm text-slate-500">/ {assignment.max_score}</span>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="flat"
                                                                                    color="default"
                                                                                    className="text-xs h-7 px-2"
                                                                                    onPress={() => copyPreviousGradeMemberScore(member.studentId)}
                                                                                >
                                                                                    {t("คัดลอกจากคนบน", "Copy from above")}
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                                                                    <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                                                                        <Icon icon="solar:medal-star-bold" className="text-xl text-amber-600" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-slate-700">{t("คะแนนรวม", "Total score")}</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Input
                                                                            type="text"
                                                                            inputMode="decimal"
                                                                            pattern={SCORE_INPUT_PATTERN}
                                                                            placeholder="0"
                                                                            value={mainScore}
                                                                            onValueChange={(value) => setMainScore(sanitizeScoreInput(value, assignment.max_score))}
                                                                            min={0}
                                                                            max={assignment.max_score}
                                                                            step="0.01"
                                                                            className="w-20"
                                                                            size="sm"
                                                                            variant="bordered"
                                                                            classNames={{
                                                                                input: "text-center font-semibold",
                                                                                inputWrapper: "bg-white border-slate-200",
                                                                            }}
                                                                        />
                                                                        <span className="text-sm text-slate-500">/ {assignment.max_score}</span>
                                                                    </div>
                                                                </div>
                                                                {/* Quick score buttons */}
                                                                <div className="flex justify-end gap-2">
                                                                    {(() => {
                                                                        const max = Number(assignment.max_score);
                                                                        // Always show 3 buttons: 0, half, full
                                                                        const half = Number(formatScoreValue(max / 2));
                                                                        const options = [0, half, max];
                                                                        return options.map(score => (
                                                                            <Button
                                                                                key={score}
                                                                                size="sm"
                                                                                variant={mainScore === score.toString() ? "solid" : "flat"}
                                                                                color={mainScore === score.toString() ? "primary" : "default"}
                                                                                className={mainScore === score.toString()
                                                                                    ? "bg-blue-500 text-white font-semibold min-w-12"
                                                                                    : "bg-white border border-slate-200 font-medium min-w-12"
                                                                                }
                                                                                onPress={() => setMainScore(score.toString())}
                                                                            >
                                                                                {Number.isInteger(score) ? score : score.toFixed(1)}
                                                                            </Button>
                                                                        ));
                                                                    })()}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Comment */}
                                            <div>
                                                <label className="text-slate-600 font-medium text-sm mb-2 block">{t("หมายเหตุ (ไม่บังคับ)", "Comment (optional)")}</label>
                                                <Textarea
                                                    placeholder={t("เพิ่มหมายเหตุ...", "Add a comment...")}
                                                    value={comment}
                                                    onValueChange={setComment}
                                                    variant="bordered"
                                                    minRows={2}
                                                    classNames={{
                                                        inputWrapper: "bg-white border-slate-200",
                                                    }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                /* Edit Tab */
                                <div className="space-y-5">
                                    {/* Info Banner */}
                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                                        <div className="flex items-start gap-2">
                                            <Icon icon="solar:info-circle-bold" className="text-xl text-amber-600 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-amber-800">{t("การแก้ไขคะแนน", "Score editing")}</p>
                                                <p className="text-xs text-amber-700 mt-1">
                                                    {t("การแก้ไขคะแนนจะต้องระบุเหตุผล และจะถูกบันทึกไว้ในระบบ", "Score edits require a reason and are recorded in the system.")}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Search Section - Different for individual vs group */}
                                    {!isGroupAssignment ? (
                                        /* Individual - Student Search */
                                        <div>
                                            <label className="text-slate-600 font-medium text-sm mb-2 block">{t("ค้นหานักศึกษาที่ต้องการแก้ไขคะแนน", "Find a student to edit")}</label>
                                            {!editSelectedStudent && (
                                                <Autocomplete
                                                    placeholder={t("พิมพ์รหัสหรือชื่อนักศึกษา...", "Type a student ID or name...")}
                                                    inputValue={editSearchQuery}
                                                    onInputChange={setEditSearchQuery}
                                                    selectedKey={null}
                                                    onSelectionChange={handleEditStudentSelect}
                                                    startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400" />}
                                                    variant="bordered"
                                                    classNames={SCORE_SEARCH_AUTOCOMPLETE_CLASSNAMES}
                                                    listboxProps={SCORE_SEARCH_LISTBOX_PROPS}
                                                    inputProps={{
                                                        classNames: {
                                                            inputWrapper: "bg-content1 border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                                        },
                                                    }}
                                                >
                                                    {filteredEditStudents.map((student) => (
                                                        <AutocompleteItem
                                                            key={student.id.toString()}
                                                            textValue={`${student.student_id} ${student.full_name}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <Avatar
                                                                    name={`${student.full_name}`}
                                                                    size="sm"
                                                                    className="bg-linear-to-br from-blue-400 to-indigo-500 text-white shrink-0"
                                                                />
                                                                <div>
                                                                    <p className="font-medium text-foreground">{student.full_name}</p>
                                                                    <p className="text-xs text-default-500">{student.student_id}</p>
                                                                </div>
                                                            </div>
                                                        </AutocompleteItem>
                                                    ))}
                                                </Autocomplete>
                                            )}

                                            {/* Selected Student Info */}
                                            {editSelectedStudent && (
                                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            name={editSelectedStudent.full_name}
                                                            size="md"
                                                            className="bg-linear-to-br from-blue-400 to-indigo-500 text-white"
                                                        />
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-slate-800">{editSelectedStudent.full_name}</p>
                                                            <p className="text-sm text-slate-500">{editSelectedStudent.student_id}</p>
                                                        </div>
                                                        <Button
                                                            isIconOnly
                                                            size="sm"
                                                            variant="light"
                                                            onPress={() => {
                                                                setEditSelectedStudent(null);
                                                                setEditSearchQuery("");
                                                                setCurrentScore(null);
                                                                setEditSubItemScores([]);
                                                                setSelectedEditSubItemId(null);
                                                            }}
                                                        >
                                                            <Icon icon="solar:close-circle-bold" className="text-xl text-slate-400" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Group Assignment - Group Search */
                                        <div>
                                            <label className="text-slate-600 font-medium text-sm mb-2 block">{t("ค้นหากลุ่มที่ต้องการแก้ไขคะแนน", "Find a group to edit")}</label>
                                            {!editSelectedGroup && (
                                                <Autocomplete
                                                    placeholder={t("พิมพ์ชื่อกลุ่ม...", "Type a group name...")}
                                                    inputValue={editGroupSearchQuery}
                                                    onInputChange={setEditGroupSearchQuery}
                                                    selectedKey={null}
                                                    onSelectionChange={handleEditGroupSelect}
                                                    startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400" />}
                                                    variant="bordered"
                                                    classNames={SCORE_SEARCH_AUTOCOMPLETE_CLASSNAMES}
                                                    listboxProps={SCORE_SEARCH_LISTBOX_PROPS}
                                                    inputProps={{
                                                        classNames: {
                                                            inputWrapper: "bg-content1 border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                                        },
                                                    }}
                                                >
                                                    {filteredEditGroups.map((group) => (
                                                        <AutocompleteItem
                                                            key={group.id.toString()}
                                                            textValue={group.name}
                                                        >
                                                            <div className="flex items-center justify-between w-full">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-2 ${isPermanentGroup ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'} rounded-lg shrink-0`}>
                                                                        <Icon icon={isPermanentGroup ? "solar:users-group-two-rounded-bold" : "solar:users-group-rounded-bold"} className={`text-lg ${groupColors.icon}`} />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-medium text-foreground">{group.name}</p>
                                                                        <p className="text-xs text-default-500">
                                                                            {group.members.slice(0, 3).map(m => m.full_name).join(", ")}
                                                                            {group.members.length > 3 && (isEnglish ? ` +${group.members.length - 3} more` : ` +${group.members.length - 3} คน`)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <Chip size="sm" variant="flat" className="bg-content3 text-default-600">
                                                                    {formatMemberCount(group.members.length)}
                                                                </Chip>
                                                            </div>
                                                        </AutocompleteItem>
                                                    ))}
                                                </Autocomplete>
                                            )}

                                            {/* Selected Group Info */}
                                            {editSelectedGroup && (
                                                <>
                                                    <div className={`p-3 rounded-xl border mb-5 ${groupColors.bg} ${groupColors.border}`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <Icon icon={isPermanentGroup ? "solar:users-group-two-rounded-bold" : "solar:users-group-rounded-bold"} className={`text-xl ${groupColors.icon}`} />
                                                                <span className="font-semibold text-slate-800">{editSelectedGroup.name}</span>
                                                                <Chip size="sm" variant="flat" className={groupColors.chip}>
                                                                    {formatMemberCount(editSelectedGroup.members.length)}
                                                                </Chip>
                                                            </div>
                                                            <Button
                                                                isIconOnly
                                                                size="sm"
                                                                variant="light"
                                                                onPress={() => {
                                                                    setEditSelectedGroup(null);
                                                                    setEditGroupSearchQuery("");
                                                                    setCurrentScore(null);
                                                                    setEditSubItemScores([]);
                                                                    setSelectedEditSubItemId(null);
                                                                    setGroupMemberScores([]);
                                                                    setGroupMemberSubItemScores(new Map());
                                                                    setEditGroupMode("all");
                                                                    setEditGroupMemberScores({});
                                                                    setEditGroupMemberSubItemScores({});
                                                                }}
                                                            >
                                                                <Icon icon="solar:close-circle-bold" className="text-xl text-slate-400" />
                                                            </Button>
                                                        </div>

                                                        {/* Edit Mode Selection */}

                                                    </div>

                                                    <div className="mb-3 p-4 bg-linear-to-br from-slate-50 to-amber-50/30 rounded-xl border border-slate-200">
                                                        <p className="text-xs text-slate-500 mb-3 font-medium flex items-center gap-1.5">
                                                            {/* <Icon icon="solar:settings-bold" className="text-slate-400" /> */}
                                                            {t("เลือกโหมดการแก้ไข", "Choose edit mode")}
                                                        </p>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant={editGroupMode === "all" ? "solid" : "bordered"}
                                                                color={editGroupMode === "all" ? "primary" : "default"}
                                                                onPress={() => {
                                                                    setEditGroupMode("all");
                                                                    toggleAllMembersSelection(true);
                                                                }}
                                                                startContent={<Icon icon="solar:users-group-rounded-bold" />}
                                                                className={editGroupMode === "all" ? "shadow-md" : ""}
                                                            >
                                                                {t("แก้ทั้งกลุ่ม", "Edit whole group")}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant={editGroupMode === "selected" ? "solid" : "bordered"}
                                                                color={editGroupMode === "selected" ? "warning" : "default"}
                                                                onPress={() => {
                                                                    setEditGroupMode("selected");
                                                                    toggleAllMembersSelection(false); // Deselect all so user can choose explicitly
                                                                }}
                                                                startContent={<Icon icon="solar:user-check-bold" />}
                                                                className={editGroupMode === "selected" ? "shadow-md" : ""}
                                                            >
                                                                {t("เลือกเฉพาะบางคน", "Choose specific members")}
                                                            </Button>
                                                        </div>

                                                        {/* Member Selection (show when "selected" mode) */}
                                                        {editGroupMode === "selected" && (
                                                            <div className="mt-4 space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                                                                        <Icon icon="solar:users-group-two-rounded-bold" className="text-amber-500" />
                                                                        {t("เลือกสมาชิกที่ต้องการแก้ไขคะแนน", "Choose the members to edit")}
                                                                    </p>
                                                                    <div className="flex gap-1">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="flat"
                                                                            color="warning"
                                                                            onPress={() => toggleAllMembersSelection(true)}
                                                                            className="text-xs h-7 px-2"
                                                                        >
                                                                            {t("เลือกทั้งหมด", "Select all")}
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="flat"
                                                                            color="default"
                                                                            onPress={() => toggleAllMembersSelection(false)}
                                                                            className="text-xs h-7 px-2"
                                                                        >
                                                                            {t("ยกเลิกทั้งหมด", "Clear all")}
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                                                                    {groupMemberScores.map((member) => (
                                                                        (() => {
                                                                            const canEditMember = hasSubItems ? member.hasAnySubItemScore : !!member.scoreId;
                                                                            return (
                                                                        <div
                                                                            key={member.studentId}
                                                                                className={`flex items-center justify-between p-3 transition-all ${!canEditMember || member.hasPendingEdit
                                                                                ? 'bg-slate-50/50 cursor-not-allowed'
                                                                                : member.selected
                                                                                    ? 'bg-amber-50/70 cursor-pointer'
                                                                                    : 'hover:bg-slate-50 cursor-pointer'
                                                                                }`}
                                                                                onClick={() => canEditMember && !member.hasPendingEdit && toggleMemberSelection(member.studentId)}
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${!canEditMember || member.hasPendingEdit
                                                                                    ? 'bg-slate-100 border-slate-300'
                                                                                    : member.selected
                                                                                        ? 'bg-amber-500 border-amber-500 shadow-sm'
                                                                                        : 'border-slate-300 bg-white hover:border-amber-300'
                                                                                    }`}>
                                                                                    {member.hasPendingEdit ? (
                                                                                        <Icon icon="solar:lock-bold" className="text-slate-400 text-xs" />
                                                                                        ) : member.selected && canEditMember ? (
                                                                                        <Icon icon="solar:check-bold" className="text-white text-xs" />
                                                                                    ) : null}
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${!canEditMember || member.hasPendingEdit
                                                                                        ? 'bg-slate-100 text-slate-400'
                                                                                        : member.selected
                                                                                            ? 'bg-amber-100 text-amber-600'
                                                                                            : 'bg-slate-100 text-slate-600'
                                                                                        }`}>
                                                                                        <Icon icon="solar:user-bold" className="text-sm" />
                                                                                    </div>
                                                                                    <div>
                                                                                            <span className={`text-sm font-medium ${!canEditMember || member.hasPendingEdit ? 'text-slate-400' : 'text-slate-700'}`}>
                                                                                            {member.studentName}
                                                                                        </span>
                                                                                        {member.hasPendingEdit && (
                                                                                            <p className="text-xs text-orange-500">{t("รออนุมัติการแก้ไข", "Awaiting edit approval")}</p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                {member.hasPendingEdit ? (
                                                                                    <Chip size="sm" color="warning" variant="flat" className="text-xs" startContent={<Icon icon="solar:hourglass-bold" className="mr-1 text-xs" />}>
                                                                                        {t("รออนุมัติ", "Pending")}
                                                                                    </Chip>
                                                                                ) : canEditMember ? (
                                                                                    <Chip size="sm" color="success" variant="flat" className="text-xs" startContent={<Icon icon="solar:medal-star-bold" className="mr-1 text-xs" />}>
                                                                                        {hasSubItems ? t("มีคะแนนข้อย่อย", "Has sub-item scores") : `${member.score ?? 0} ${isEnglish ? "points" : "คะแนน"}`}
                                                                                    </Chip>
                                                                                ) : (
                                                                                    <Chip size="sm" color="default" variant="flat" className="text-xs">
                                                                                        {t("ยังไม่มีคะแนน", "No score yet")}
                                                                                    </Chip>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        );
                                                                    })()
                                                                ))}
                                                                </div>
                                                                <div className="flex items-center justify-between text-xs">
                                                                    <p className="text-slate-500 flex items-center gap-1">
                                                                        <Icon icon="solar:user-check-bold" className="text-amber-500" />
                                                                        {t("เลือกแล้ว", "Selected")} {groupMemberScores.filter(m => m.selected && (hasSubItems ? m.hasAnySubItemScore : (!m.hasPendingEdit && !!m.scoreId))).length} / {groupMemberScores.filter(m => hasSubItems ? m.hasAnySubItemScore : (!m.hasPendingEdit && !!m.scoreId)).length} {isEnglish ? "students" : "คน"}
                                                                    </p>
                                                                    {groupMemberScores.filter(m => m.selected && (hasSubItems ? m.hasAnySubItemScore : (!m.hasPendingEdit && !!m.scoreId))).length === 0 && (
                                                                        <p className="text-amber-600 flex items-center gap-1">
                                                                            <Icon icon="solar:danger-triangle-bold" />
                                                                            {t("กรุณาเลือกอย่างน้อย 1 คน", "Please select at least one student")}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Show locked members notice in "all" mode */}
                                                        {editGroupMode === "all" && groupMemberScores.some(m => m.hasPendingEdit) && (
                                                            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                                                <p className="text-xs font-medium text-orange-700 flex items-center gap-1.5 mb-2">
                                                                    <Icon icon="solar:lock-bold" className="text-orange-500" />
                                                                    {t("สมาชิกที่รออนุมัติการแก้ไข (จะถูกข้ามอัตโนมัติ)", "Members with pending edit approvals (skipped automatically)")}
                                                                </p>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {groupMemberScores.filter(m => m.hasPendingEdit).map(member => (
                                                                        <Chip
                                                                            key={member.studentId}
                                                                            size="sm"
                                                                            variant="flat"
                                                                            className="bg-orange-100 text-orange-700 border border-orange-200"
                                                                            startContent={<Icon icon="solar:hourglass-bold" className="text-orange-500 text-xs mr-0.5" />}
                                                                        >
                                                                            {member.studentName}
                                                                        </Chip>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Current Score & Edit Form */}
                                    {(editSelectedStudent || editSelectedGroup) && (
                                        <>
                                            {!currentScore && !hasSubItems ? (
                                                <div className="text-center py-6">
                                                    <Icon icon="solar:clipboard-remove-linear" className="text-4xl text-slate-300 mx-auto mb-2" />
                                                    <p className="text-slate-500">{isEnglish ? `${isGroupAssignment ? "This group" : "This student"} has no score yet.` : `${isGroupAssignment ? "กลุ่มนี้" : "นักศึกษาคนนี้"}ยังไม่มีคะแนน`}</p>
                                                    <p className="text-sm text-slate-400">{t("กรุณาไปที่แท็บ \"ลงคะแนน\" เพื่อให้คะแนนใหม่", "Use the \"Grade\" tab to create a score.")}</p>
                                                </div>
                                            ) : hasSubItems ? (
                                                /* Sub-items scores for editing */
                                                <div className="space-y-4">
                                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                        <p className="text-sm font-medium text-slate-700 mb-3">{t("เลือกข้อที่ต้องการแก้ไข", "Choose a sub-item to edit")}</p>
                                                        <div className="space-y-2">
                                                            {assignment.subItems?.filter(item => item.id !== undefined).map((subItem, idx) => {
                                                                const editScore = editSubItemScores.find(s => s.subItemId === subItem.id);
                                                                const selectedActiveMembers = groupMemberScores.filter(m => m.selected);
                                                                const candidateMembers = isGroupAssignment && editSelectedGroup && editGroupMode === "selected"
                                                                    ? (selectedActiveMembers.length > 0 ? selectedActiveMembers : groupMemberScores)
                                                                    : groupMemberScores;
                                                                const editableMemberCount = isGroupAssignment && editSelectedGroup
                                                                    ? candidateMembers.filter((member) => {
                                                                        if (hasPendingSubItemEdit(member.studentId, subItem.id!)) return false;
                                                                        return groupMemberSubItemScores.get(member.studentId)?.some((s) => s.subItemId === subItem.id && s.scoreId != null);
                                                                    }).length
                                                                    : 0;
                                                                const pendingMemberCount = isGroupAssignment && editSelectedGroup
                                                                    ? candidateMembers.filter((member) => {
                                                                        if (!hasPendingSubItemEdit(member.studentId, subItem.id!)) return false;
                                                                        return groupMemberSubItemScores.get(member.studentId)?.some((s) => s.subItemId === subItem.id && s.scoreId != null);
                                                                    }).length
                                                                    : 0;
                                                                const hasEditableScore = isGroupAssignment && editSelectedGroup
                                                                    ? candidateMembers.some((member) => {
                                                                        if (hasPendingSubItemEdit(member.studentId, subItem.id!)) return false;
                                                                        return groupMemberSubItemScores.get(member.studentId)?.some((s) => s.subItemId === subItem.id && s.scoreId != null);
                                                                    })
                                                                    : !!(editScore && editScore.currentScore !== null);
                                                                const hasLockedOnlyScore = isGroupAssignment && editSelectedGroup
                                                                    ? !hasEditableScore && candidateMembers.some((member) => {
                                                                        if (!hasPendingSubItemEdit(member.studentId, subItem.id!)) return false;
                                                                        return groupMemberSubItemScores.get(member.studentId)?.some((s) => s.subItemId === subItem.id && s.scoreId != null);
                                                                    })
                                                                    : false;
                                                                const isSelected = selectedEditSubItemId === subItem.id;

                                                                return (
                                                                    <div
                                                                        key={subItem.id}
                                                                        onClick={() => hasEditableScore && setSelectedEditSubItemId(subItem.id!)}
                                                                        className={`flex items-center gap-3 p-3 rounded-lg border  transition-colors ${isSelected
                                                                            ? 'bg-blue-50 border-blue-300'
                                                                            : hasEditableScore
                                                                                ? 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                                                                                : hasLockedOnlyScore
                                                                                    ? 'bg-amber-50 border-amber-200 cursor-not-allowed'
                                                                                : 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-60'
                                                                            }`}
                                                                    >
                                                                        <span className={`w-8 h-8 flex items-center justify-center text-sm font-bold rounded-full shrink-0 ${isSelected ? 'bg-blue-500 text-white' : hasEditableScore ? 'bg-blue-100 text-blue-600' : hasLockedOnlyScore ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'
                                                                            }`}>
                                                                            {idx + 1}
                                                                        </span>
                                                                        <div className="flex-1 min-w-0">
                                                                                <p className="text-sm font-medium text-slate-700 truncate">{localizeGeneratedSubItemName(subItem.name, idx + 1, isEnglish)}</p>
                                                                            {isGroupAssignment && editSelectedGroup && (
                                                                                <p className="text-xs text-slate-500">
                                                                                        {isEnglish
                                                                                            ? `Editable for ${formatMemberCount(editableMemberCount)}${pendingMemberCount > 0 ? ` • Pending for ${formatMemberCount(pendingMemberCount)}` : ""}`
                                                                                            : `แก้ได้ ${editableMemberCount} คน${pendingMemberCount > 0 ? ` • รออนุมัติ ${pendingMemberCount} คน` : ""}`}
                                                                                </p>
                                                                            )}
                                                                            {hasLockedOnlyScore && (
                                                                                    <p className="text-xs text-amber-600">{t("มีคำร้องค้างในข้อนี้ (แก้ข้ออื่นได้)", "This sub-item has a pending request (other sub-items can still be edited)")}</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Edit form for selected sub-item */}
                                                    {selectedEditSubItemId !== null && (() => {
                                                        const selectedSubItem = assignment.subItems?.find(s => s.id === selectedEditSubItemId);
                                                        const selectedEditScore = editSubItemScores.find(s => s.subItemId === selectedEditSubItemId);
                                                        return (
                                                            <div className="space-y-4 p-4 bg-linear-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                                                                {/* Header */}
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="p-2 bg-blue-100 rounded-lg">
                                                                            <Icon icon="solar:pen-2-bold" className="text-lg text-blue-600" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs text-blue-600 font-medium">{t("แก้ไขคะแนน", "Edit score")}</p>
                                                                            <p className="font-semibold text-slate-800">{localizeGeneratedSubItemName(selectedSubItem?.name, selectedEditSubItemId ?? 1, isEnglish)}</p>
                                                                        </div>
                                                                    </div>
                                                                    {selectedEditScore?.currentScore !== null && (
                                                                        <div className="text-right">
                                                                            <p className="text-xs text-slate-500">{t("คะแนนเดิม", "Current score")}</p>
                                                                            <p className="text-lg font-bold text-slate-600">
                                                                                {selectedEditScore?.currentScore} <span className="text-sm font-normal">/ {selectedSubItem?.max_score}</span>
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Score Input */}
                                                                <div className="bg-white p-4 rounded-lg border border-slate-200">
                                                                    <label className="text-slate-600 font-medium text-sm mb-3 flex items-center gap-2">
                                                                        {t("คะแนนใหม่", "New score")}
                                                                    </label>
                                                                    {isGroupAssignment && editSelectedGroup && editGroupMode === "selected" ? (
                                                                        <div className="space-y-2">
                                                                            {groupMemberScores
                                                                                .filter((m) => m.selected)
                                                                                .map((member) => {
                                                                                    const hasSubItemScore = groupMemberSubItemScores
                                                                                        .get(member.studentId)
                                                                                        ?.some((s) => s.subItemId === selectedEditSubItemId && s.scoreId);
                                                                                    if (!hasSubItemScore) return null;

                                                                                    const isPendingForSubItem = hasPendingSubItemEdit(member.studentId, selectedEditSubItemId);

                                                                                    return (
                                                                                        <div key={`${member.studentId}_${selectedEditSubItemId}`} className="flex items-center justify-between gap-3 p-2 rounded-md border border-slate-200">
                                                                                            <span className="text-sm font-medium text-slate-700 truncate">{member.studentName}</span>
                                                                                            <div className="flex items-center gap-2">
                                                                                                <Input
                                                                                                    type="text"
                                                                                                    inputMode="decimal"
                                                                                                    pattern={SCORE_INPUT_PATTERN}
                                                                                                    isRequired
                                                                                                    placeholder="0"
                                                                                                    value={editGroupMemberSubItemScores[member.studentId]?.[selectedEditSubItemId] ?? ""}
                                                                                                    onValueChange={(val) => handleEditGroupMemberSubItemScoreChange(member.studentId, selectedEditSubItemId, val)}
                                                                                                    min={0}
                                                                                                    max={selectedSubItem?.max_score || 0}
                                                                                                    step="0.01"
                                                                                                    size="sm"
                                                                                                    variant="bordered"
                                                                                                    className="w-24"
                                                                                                    isDisabled={isPendingForSubItem}
                                                                                                    classNames={{
                                                                                                        input: "text-center font-semibold",
                                                                                                        inputWrapper: isPendingForSubItem
                                                                                                            ? "bg-slate-100 border-slate-200"
                                                                                                            : "bg-white border-blue-200 hover:border-blue-400",
                                                                                                    }}
                                                                                                />
                                                                                                <span className="text-xs text-slate-500">/ {selectedSubItem?.max_score}</span>
                                                                                                {isPendingForSubItem && (
                                                                                                    <Chip size="sm" color="warning" variant="flat" className="text-[10px]" startContent={<Icon icon="solar:hourglass-bold" className="text-xs" />}>
                                                                                                        {t("รออนุมัติ", "Pending")}
                                                                                                    </Chip>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center justify-center gap-3">
                                                                            <Input
                                                                                type="text"
                                                                                inputMode="decimal"
                                                                                pattern={SCORE_INPUT_PATTERN}
                                                                                isRequired
                                                                                placeholder="0"
                                                                                value={selectedEditScore?.newScore || ""}
                                                                                onValueChange={(val) => handleSubItemNewScoreChange(selectedEditSubItemId, val)}
                                                                                min={0}
                                                                                max={selectedSubItem?.max_score || 0}
                                                                                step="0.01"
                                                                                size="lg"
                                                                                variant="bordered"
                                                                                classNames={{
                                                                                    base: "w-28",
                                                                                    input: "text-center text-2xl font-bold text-blue-600",
                                                                                    inputWrapper: "bg-white border-blue-200 hover:border-blue-400",
                                                                                }}
                                                                            />
                                                                            <div className="text-center">
                                                                                <span className="text-2xl text-slate-400">/</span>
                                                                            </div>
                                                                            <div className="text-center">
                                                                                <span className="text-2xl font-bold text-slate-700">{selectedSubItem?.max_score}</span>
                                                                                <p className="text-xs text-slate-500">{t("คะแนนเต็ม", "Max score")}</p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Reason Input */}
                                                                <div className="space-y-3">
                                                                    <label className="text-slate-600 font-medium text-sm mb-2 flex items-center gap-2">
                                                                        {/* <Icon icon="solar:document-text-bold" className="text-slate-400" /> */}
                                                                        {t("เหตุผลในการแก้ไข *", "Reason for edit *")}
                                                                    </label>
                                                                    <Select
                                                                        placeholder={t("เลือกเหตุผลในการแก้ไข", "Select a reason")}
                                                                        selectedKeys={editReasonType ? new Set([editReasonType]) : new Set()}
                                                                        onSelectionChange={(keys) => {
                                                                            const selected = Array.from(keys)[0] as string;
                                                                            setEditReasonType(selected || "");
                                                                            if (selected !== "other") {
                                                                                setEditReasonCustom("");
                                                                            }
                                                                        }}
                                                                        variant="bordered"
                                                                        classNames={{
                                                                            trigger: "bg-white border-slate-200",
                                                                        }}
                                                                    >
                                                                        {PRESET_EDIT_REASONS.map((reason) => (
                                                                            <SelectItem key={reason.key} textValue={getPresetEditReasonLabel(reason)}>
                                                                                {getPresetEditReasonLabel(reason)}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </Select>


                                                                    {editReasonType === "other" && (
                                                                        <Textarea
                                                                            placeholder={t("กรุณาระบุเหตุผลในการขอแก้ไขคะแนน...", "Please describe the reason for this score edit request...")}
                                                                            value={editReasonCustom}
                                                                            onValueChange={setEditReasonCustom}
                                                                            variant="bordered"
                                                                            minRows={2}
                                                                            isRequired
                                                                            classNames={{
                                                                                inputWrapper: "bg-white border-slate-200",
                                                                            }}
                                                                        />
                                                                    )}
                                                                </div>

                                                                {/* Image Upload */}
                                                                <div className="space-y-3">
                                                                    <label className="text-slate-600 font-medium text-sm mb-2 flex items-center gap-2">
                                                                        {/* <Icon icon="solar:camera-bold" className="text-slate-400" /> */}
                                                                        {t("แนบรูปภาพประกอบ (ไม่บังคับ, สูงสุด 3 รูป)", "Attach images (optional, up to 3)")}
                                                                    </label>

                                                                    {/* Image Previews */}
                                                                    {editImagePreviews.length > 0 && (
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {editImagePreviews.map((preview, index) => (
                                                                                <div key={index} className="relative group">
                                                                                    <img
                                                                                        src={preview}
                                                                                        alt={isEnglish ? `Image preview ${index + 1}` : `Preview ${index + 1}`}
                                                                                        className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                                                                                    />
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleRemoveImage(index)}
                                                                                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                    >
                                                                                        <Icon icon="solar:close-circle-bold" className="text-sm" />
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {editImages.length < 3 && (
                                                                        <div>
                                                                            <input
                                                                                type="file"
                                                                                ref={imageInputRef}
                                                                                accept="image/*"
                                                                                multiple
                                                                                onChange={handleImageUpload}
                                                                                className="hidden"
                                                                            />
                                                                            <Button
                                                                                variant="bordered"
                                                                                size="sm"
                                                                                onPress={() => imageInputRef.current?.click()}
                                                                                startContent={<Icon icon="solar:upload-bold" />}
                                                                            >
                                                                                {t("เพิ่มรูปภาพ", "Add image")} ({editImages.length}/3)
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            ) : (
                                                /* Main score editing */
                                                <div className="space-y-4">
                                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between w-full">
                                                        <div className="">
                                                            <span className="text-sm text-slate-600">{t("คะแนนปัจจุบัน", "Current score")}</span>
                                                            {currentScore?.graded_by && (
                                                                <p className="text-xs text-slate-500 mt-2">
                                                                    {t("ให้คะแนนโดย", "Graded by")}: {currentScore.graded_by.display_name}
                                                                    {currentScore.graded_at && ` ${t("เมื่อ", "on")} ${formatLocalizedDate(currentScore.graded_at)}`}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center">
                                                            <span className="text-2xl font-bold text-slate-800">
                                                                {currentScore?.score ?? "-"} <span className="text-sm font-normal text-slate-500">/ {assignment.max_score}</span>
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <Divider />


                                                    <div>
                                                        <label className="text-slate-600 font-medium text-sm mb-2 block">{t("คะแนนใหม่ *", "New score *")}</label>


                                                        <div className="bg-slate-50 p-4 rounded-xl">
                                                            {isGroupAssignment && editSelectedGroup && editGroupMode === "selected" ? (
                                                                <div className="space-y-2">
                                                                    {groupMemberScores
                                                                        .filter((m) => m.selected && m.scoreId && !m.hasPendingEdit)
                                                                        .map((member) => (
                                                                            <div key={member.studentId} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                                                                                <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                                                                                    <Icon icon="solar:user-bold" className="text-lg text-amber-600" />
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-sm font-medium text-slate-700 truncate">{member.studentName}</p>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <Input
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        pattern={SCORE_INPUT_PATTERN}
                                                                                        placeholder="0"
                                                                                        value={editGroupMemberScores[member.studentId] ?? ""}
                                                                                        onValueChange={(value) => handleEditGroupMemberScoreChange(member.studentId, value)}
                                                                                        min={0}
                                                                                        max={assignment.max_score}
                                                                                        step="0.01"
                                                                                        className="w-20"
                                                                                        size="sm"
                                                                                        variant="bordered"
                                                                                        classNames={{
                                                                                            input: "text-center font-semibold",
                                                                                            inputWrapper: "bg-white border-slate-200",
                                                                                        }}
                                                                                    />
                                                                                    <span className="text-sm text-slate-500">/ {assignment.max_score}</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                                                                    <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                                                                        <Icon icon="solar:medal-star-bold" className="text-xl text-amber-600" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-slate-700">{t("คะแนนรวม", "Total score")}</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Input
                                                                            type="text"
                                                                            inputMode="decimal"
                                                                            pattern={SCORE_INPUT_PATTERN}
                                                                            placeholder="0"
                                                                            value={newScore}
                                                                            onValueChange={(value) => setNewScore(sanitizeScoreInput(value, assignment.max_score))}
                                                                            min={0}
                                                                            max={assignment.max_score}
                                                                            step="0.01"
                                                                            className="w-20"
                                                                            size="sm"
                                                                            variant="bordered"
                                                                            classNames={{
                                                                                input: "text-center font-semibold",
                                                                                inputWrapper: "bg-white border-slate-200",
                                                                            }}
                                                                        />
                                                                        <span className="text-sm text-slate-500">/ {assignment.max_score}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <label className="text-slate-600 font-medium text-sm mb-2 flex items-center gap-2">
                                                            <Icon icon="solar:document-text-bold" className="text-slate-400" />
                                                            {t("เหตุผลในการแก้ไข *", "Reason for edit *")}
                                                        </label>
                                                        <Select
                                                            placeholder={t("เลือกเหตุผลในการแก้ไข", "Select a reason")}
                                                            selectedKeys={editReasonType ? new Set([editReasonType]) : new Set()}
                                                            onSelectionChange={(keys) => {
                                                                const selected = Array.from(keys)[0] as string;
                                                                setEditReasonType(selected || "");
                                                                if (selected !== "other") {
                                                                    setEditReasonCustom("");
                                                                }
                                                            }}
                                                            variant="bordered"
                                                            classNames={{
                                                                trigger: "bg-white border-slate-200",
                                                            }}
                                                        >
                                                            {PRESET_EDIT_REASONS.map((reason) => (
                                                                <SelectItem key={reason.key} textValue={getPresetEditReasonLabel(reason)}>
                                                                    {getPresetEditReasonLabel(reason)}
                                                                </SelectItem>
                                                            ))}
                                                        </Select>


                                                        {editReasonType === "other" && (
                                                            <Textarea
                                                                placeholder={t("กรุณาระบุเหตุผลในการขอแก้ไขคะแนน...", "Please describe the reason for this score edit request...")}
                                                                value={editReasonCustom}
                                                                onValueChange={setEditReasonCustom}
                                                                variant="bordered"
                                                                minRows={3}
                                                                isRequired
                                                                classNames={{
                                                                    inputWrapper: "bg-white border-slate-200",
                                                                }}
                                                            />
                                                        )}
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            {t("* เหตุผลในการแก้ไขจะถูกบันทึกไว้เพื่อการตรวจสอบ", "* The edit reason will be stored for review.")}
                                                        </p>
                                                    </div>

                                                    {/* Image Upload */}
                                                    <div className="space-y-3">
                                                        <label className="text-slate-600 font-medium text-sm mb-2 flex items-center gap-2">
                                                            <Icon icon="solar:camera-bold" className="text-slate-400" />
                                                            {t("แนบรูปภาพประกอบ (ไม่บังคับ, สูงสุด 3 รูป)", "Attach images (optional, up to 3)")}
                                                        </label>

                                                        {/* Image Previews */}
                                                        {editImagePreviews.length > 0 && (
                                                            <div className="flex flex-wrap gap-2">
                                                                {editImagePreviews.map((preview, index) => (
                                                                    <div key={index} className="relative group">
                                                                        <img
                                                                            src={preview}
                                                                            alt={isEnglish ? `Image preview ${index + 1}` : `Preview ${index + 1}`}
                                                                            className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveImage(index)}
                                                                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        >
                                                                            <Icon icon="solar:close-circle-bold" className="text-sm" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {editImages.length < 3 && (
                                                            <div>
                                                                <input
                                                                    type="file"
                                                                    ref={imageInputRef}
                                                                    accept="image/*"
                                                                    multiple
                                                                    onChange={handleImageUpload}
                                                                    className="hidden"
                                                                />
                                                                <Button
                                                                    variant="bordered"
                                                                    size="sm"
                                                                    onPress={() => imageInputRef.current?.click()}
                                                                    startContent={<Icon icon="solar:upload-bold" />}
                                                                >
                                                                    {t("เพิ่มรูปภาพ", "Add image")} ({editImages.length}/3)
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </ModalBody>

                <ModalFooter className="px-6 py-4 border-t border-slate-200">
                    <div className="w-full space-y-3">
                        {!isCourseActive && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                                {t("รายวิชานี้ถูกปิดแล้ว สามารถดูข้อมูลคะแนนได้อย่างเดียว", "This course is closed. Scores are view-only.")}
                            </div>
                        )}
                        {activeTab === "edit" && editConfirmationLines.length > 0 && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs font-semibold text-amber-800 mb-2">{t("สรุปรายการที่จะส่งแก้ไข", "Summary of edits to submit")}</p>
                                <div className="space-y-1">
                                    {editConfirmationLines.map((line, index) => (
                                        <p key={`${line}-${index}`} className="text-xs text-amber-900">{line}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end w-full">
                            <Button variant="light" onPress={onClose}>
                                {t("ปิด", "Close")}
                            </Button>
                            {activeTab === "grade" ? (
                                <Button
                                    color="primary"
                                    onPress={handleSubmitGrade}
                                    isDisabled={!canSubmitGrade || !isCourseActive}
                                    isLoading={isSubmitting}
                                    className="bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                                >
                                    {t("บันทึกคะแนน", "Save score")}
                                </Button>
                            ) : (
                                <Button
                                    color="warning"
                                    onPress={handleSubmitEdit}
                                    isDisabled={!canSubmitEdit || !isCourseActive}
                                    isLoading={isSubmitting}
                                >
                                    {t("ส่งคำขอแก้ไข", "Submit edit request")}
                                </Button>
                            )}
                        </div>
                    </div>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
