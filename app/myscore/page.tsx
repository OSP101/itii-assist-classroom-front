"use client";

import { useState, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { Tabs, Tab } from "@heroui/tabs";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Link } from "@heroui/link";
import { Tooltip } from "@heroui/tooltip";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { studentService, StudentScoreLookupResponse, CourseScoreData, AssignmentScore, ExamScoreData } from "@/services/student.service";

export default function MyScorePage() {
    const [studentId, setStudentId] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<StudentScoreLookupResponse | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [searchHistory, setSearchHistory] = useState<Array<{ id: string, name: string }>>([]);
    const [showHistory, setShowHistory] = useState(false);

    // Load search history from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("myscore_search_history");
        if (saved) {
            try {
                setSearchHistory(JSON.parse(saved));
            } catch {
                setSearchHistory([]);
            }
        }
    }, []);

    // Save to search history
    const saveToHistory = (id: string, name: string) => {
        const newHistory = [
            { id, name },
            ...searchHistory.filter(h => h.id !== id)
        ].slice(0, 10); // Keep only last 10 searches
        setSearchHistory(newHistory);
        localStorage.setItem("myscore_search_history", JSON.stringify(newHistory));
    };

    // Remove from history
    const removeFromHistory = (id: string) => {
        const newHistory = searchHistory.filter(h => h.id !== id);
        setSearchHistory(newHistory);
        localStorage.setItem("myscore_search_history", JSON.stringify(newHistory));
    };

    // Clear all history
    const clearHistory = () => {
        setSearchHistory([]);
        localStorage.removeItem("myscore_search_history");
    };

    // Cooldown timer
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const handleSearch = async () => {
        if (!studentId.trim()) {
            addToast({
                title: "กรุณากรอกรหัสนักศึกษา",
                description: "กรุณากรอกรหัสนักศึกษาเพื่อค้นหาคะแนน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (cooldown > 0) return;

        setIsLoading(true);
        setHasSearched(true);
        setCooldown(5); // Start 5 second cooldown

        try {
            const response = await studentService.lookupStudentScores(studentId.trim());
            if (response.success && response.data) {
                setData(response.data);
                saveToHistory(studentId.trim(), response.data.student.full_name);
                addToast({
                    title: "ค้นหาสำเร็จ",
                    description: `พบข้อมูลของ ${response.data.student.full_name}`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                setData(null);
                addToast({
                    title: "ไม่พบข้อมูล",
                    description: "ไม่พบข้อมูลนักศึกษาในระบบ",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: unknown) {
            setData(null);
            const errorMessage = error instanceof Error ? error.message : "ไม่พบข้อมูลนักศึกษาในระบบ";
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: errorMessage,
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    const getAttendanceConfig = (status: string) => {
        const config: Record<string, { color: "success" | "warning" | "secondary" | "danger"; label: string; icon: string; bg: string }> = {
            present: { color: "success", label: "มาเรียน", icon: "solar:check-circle-bold", bg: "bg-green-50 border-green-200" },
            late: { color: "warning", label: "สาย", icon: "solar:clock-circle-bold", bg: "bg-amber-50 border-amber-200" },
            leave: { color: "secondary", label: "ลา", icon: "solar:document-text-bold", bg: "bg-gray-50 border-gray-200" },
            absent: { color: "danger", label: "ขาด", icon: "solar:close-circle-bold", bg: "bg-red-50 border-red-200" },
        };
        return config[status] || { color: "secondary" as const, label: status, icon: "solar:question-circle-bold", bg: "bg-gray-50" };
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleString("th-TH", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatShortDate = (dateString: string | null) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleString("th-TH", {
            day: "numeric",
            month: "short",
        });
    };

    const getScoreColor = (score: number | null, maxScore: number, isGraded: boolean = true) => {
        if (score === null || !isGraded) return "text-gray-400";
        const percentage = (score / maxScore) * 100;
        if (percentage >= 80) return "text-green-600";
        if (percentage >= 60) return "text-blue-600";
        if (percentage >= 40) return "text-amber-600";
        return "text-red-500";
    };

    const getDisplayScore = (score: number | null, isGraded: boolean): string => {
        if (!isGraded) return "0";
        if (score === null) return "0";
        return score.toFixed(1);
    };

    const renderAssignmentCard = (assignment: AssignmentScore) => {
        const hasSubItems = assignment.sub_items && assignment.sub_items.length > 0;
        const isGroupWork = assignment.is_group_assignment || assignment.type === "group" || assignment.type === "permanent_group" || assignment.type === "weekly_group";

        // คำนวณคะแนนจาก sub_items ที่ตรวจแล้วเท่านั้น
        const getCalculatedScore = () => {
            if (hasSubItems) {
                const gradedSubItems = assignment.sub_items.filter(s => s.score !== null);
                return gradedSubItems.reduce((sum, s) => sum + (s.score || 0), 0);
            }
            return assignment.score || 0;
        };

        const getGradedMaxScore = () => {
            if (hasSubItems) {
                const gradedSubItems = assignment.sub_items.filter(s => s.score !== null);
                return gradedSubItems.reduce((sum, s) => sum + s.max_score, 0);
            }
            return assignment.max_score;
        };

        const calculatedScore = getCalculatedScore();
        const gradedMaxScore = getGradedMaxScore();
        const allSubItemsGraded = hasSubItems && assignment.sub_items.every(s => s.score !== null);
        const someSubItemsGraded = hasSubItems && assignment.sub_items.some(s => s.score !== null);

        return (
            <div
                key={assignment.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-50">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-semibold text-gray-800 truncate">{assignment.title}</h4>
                                {isGroupWork && (
                                    <Chip
                                        size="sm"
                                        variant="flat"
                                        color="secondary"
                                        startContent={<Icon icon="solar:users-group-rounded-bold" className="text-xs" />}
                                    >
                                        กลุ่ม
                                    </Chip>
                                )}
                            </div>
                            {assignment.group_info && (
                                <p className="text-xs text-purple-600 flex items-center gap-1">
                                    <Icon icon="solar:users-group-rounded-linear" />
                                    {assignment.group_info.name}
                                </p>
                            )}
                        </div>
                        <div className="text-right flex-shrink-0">
                            <div className={`text-2xl font-bold ${hasSubItems 
                                ? getScoreColor(calculatedScore, gradedMaxScore, someSubItemsGraded)
                                : getScoreColor(assignment.score, assignment.max_score, assignment.status === "graded")
                            }`}>
                                {hasSubItems 
                                    ? (someSubItemsGraded ? calculatedScore.toFixed(1) : "0")
                                    : getDisplayScore(assignment.score, assignment.status === "graded")
                                }
                                <span className="text-xs text-gray-400">
                                    / {assignment.max_score}
                                </span>
                            </div>
                            {hasSubItems && !allSubItemsGraded && someSubItemsGraded && (
                                <p className="text-[10px] text-amber-500">
                                    ตรวจแล้ว {assignment.sub_items.filter(s => s.score !== null).length}/{assignment.sub_items.length} ข้อ
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sub Items */}
                {hasSubItems && (
                    <div className="px-4 py-3 bg-linear-to-r from-blue-50/50 to-indigo-50/50">
                        <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                            <Icon icon="solar:list-check-linear" />
                            รายละเอียดคะแนน
                        </p>
                        <div className="space-y-2">
                            {assignment.sub_items.map((subItem) => {
                                const subItemGraded = subItem.score !== null;
                                return (
                                    <div key={subItem.id} className="bg-white/60 rounded-lg px-3 py-2 flex items-center justify-between">
                                        <span className="text-sm text-gray-700">{subItem.name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm font-bold ${subItemGraded ? "text-blue-600" : "text-gray-400"
                                                }`}>
                                                {subItemGraded ? subItem.score : 0}/{subItem.max_score}
                                            </span>
                                            {subItemGraded ? (
                                                <Tooltip content={subItem.grader ? `ตรวจโดย ${subItem.grader}` : "ตรวจแล้ว"}>
                                                    <span className="text-[10px] text-green-600 flex items-center gap-0.5 cursor-help whitespace-nowrap">
                                                        <Icon icon="solar:check-circle-bold" className="text-xs" />
                                                        {formatShortDate(subItem.graded_at)}
                                                    </span>
                                                </Tooltip>
                                            ) : (
                                                <span className="text-[10px] text-amber-500 flex items-center gap-0.5 whitespace-nowrap">
                                                    <Icon icon="solar:clock-circle-bold" className="text-xs" />
                                                    รอตรวจ
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="px-4 py-2 bg-gray-50/50 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                        {assignment.status === "graded" ? (
                            <span className="flex items-center gap-1 text-green-600">
                                <Icon icon="solar:check-circle-bold" />
                                ตรวจแล้ว
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-amber-500">
                                <Icon icon="solar:clock-circle-bold" />
                                รอตรวจ
                            </span>
                        )}
                    </div>
                    {assignment.status === "graded" && (
                        <div className="flex items-center gap-2">
                            {assignment.grader && (
                                <span className="flex items-center gap-1">
                                    <Icon icon="solar:user-check-linear" />
                                    {assignment.grader}
                                </span>
                            )}
                            {assignment.graded_at && (
                                <span className="flex items-center gap-1 text-gray-400">
                                    <Icon icon="solar:calendar-linear" />
                                    {formatDate(assignment.graded_at)}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Comment */}
                {assignment.comment && (
                    <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
                        <p className="text-xs text-amber-700 flex items-start gap-1">
                            <Icon icon="solar:chat-square-text-linear" className="mt-0.5 flex-shrink-0" />
                            <span className="italic">&quot;{assignment.comment}&quot;</span>
                        </p>
                    </div>
                )}
            </div>
        );
    };

    const renderCourseCard = (courseData: CourseScoreData, index: number) => {
        const { course, assignments, totalScore, totalMaxScore, progress, attendance, bonusScore } = courseData;
        const gradedCount = assignments.filter(a => a.status === "graded").length;

        // Separate assignments by type
        const labAssignments = assignments.filter(a => a.type === "individual");
        const homeworkAssignments = assignments.filter(a => a.type === "assignment");
        const groupAssignments = assignments.filter(a => a.type === "permanent_group" || a.type === "weekly_group");

        // Calculate scores by type
        const labScore = labAssignments.reduce((sum, a) => sum + (a.score || 0), 0);
        const labMaxScore = labAssignments.reduce((sum, a) => sum + a.max_score, 0);
        const homeworkScore = homeworkAssignments.reduce((sum, a) => sum + (a.score || 0), 0);
        const homeworkMaxScore = homeworkAssignments.reduce((sum, a) => sum + a.max_score, 0);
        const groupScore = groupAssignments.reduce((sum, a) => sum + (a.score || 0), 0);
        const groupMaxScore = groupAssignments.reduce((sum, a) => sum + a.max_score, 0);

        // Sort function for assignments - newest first by id
        const sortAssignments = (list: AssignmentScore[]) => [...list].sort((a, b) => b.id - a.id);

        const sortedLabAssignments = sortAssignments(labAssignments);
        const sortedHomeworkAssignments = sortAssignments(homeworkAssignments);
        const sortedGroupAssignments = sortAssignments(groupAssignments);

        // Sort attendance records by date (newest first)
        const sortedAttendance = [...attendance.records].sort((a, b) => {
            if (a.date && b.date) {
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            }
            return 0;
        });

        // Sort bonus records by given_at (newest first)
        const sortedBonusRecords = bonusScore ? [...bonusScore.records].sort((a, b) => {
            if (a.given_at && b.given_at) {
                return new Date(b.given_at).getTime() - new Date(a.given_at).getTime();
            }
            return 0;
        }) : [];

        // Check which types exist
        const hasLab = labAssignments.length > 0;
        const hasHomework = homeworkAssignments.length > 0;
        const hasGroup = groupAssignments.length > 0;
        const hasAttendance = attendance.records.length > 0;
        const hasBonus = bonusScore && (bonusScore.total > 0 || bonusScore.records.length > 0);
        const hasExamScores = courseData.examScores && courseData.examScores.length > 0;

        // Separate exam scores by type
        const midtermScores = courseData.examScores?.filter((e: ExamScoreData) => e.exam_type === 'midterm') || [];
        const finalScores = courseData.examScores?.filter((e: ExamScoreData) => e.exam_type === 'final') || [];

        return (
            <AccordionItem
                key={String(index)}
                aria-label={`${course.code} - ${course.name}`}
                classNames={{
                    base: "group shadow-md hover:shadow-lg transition-shadow border border-gray-100 rounded-2xl overflow-hidden bg-white",
                    trigger: "px-4 py-4 sm:px-6 data-[hover=true]:bg-gray-50/50",
                    content: "px-0 pb-0",
                    title: "flex-1",
                    indicator: "text-gray-400 data-[open=true]:text-blue-500 text-lg",
                }}
                startContent={
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <Icon icon="solar:book-2-bold" className="text-white text-xl" />
                    </div>
                }
                title={
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 w-full ml-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base sm:text-lg font-bold text-gray-800">{course.code}</h3>
                                <Chip size="sm" variant="flat" color="primary" className="text-xs">
                                    {course.year}/{course.semester}
                                </Chip>
                            </div>
                            <p className="text-gray-500 text-sm truncate">{course.name}</p>
                        </div>
                        {/* <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap">
                            {bonusScore && bonusScore.total > 0 && (
                                <div className="flex items-center gap-1 bg-amber-50 text-amber-600 rounded-lg px-2 py-1">
                                    <Icon icon="solar:star-bold" className="text-sm" />
                                    <span className="text-sm font-bold">+{bonusScore.total}</span>
                                </div>
                            )}
                            {/* <div className="flex items-baseline gap-0.5 bg-blue-50 text-blue-600 rounded-lg px-3 py-1.5">
                                <span className="text-xl sm:text-2xl font-bold">{totalScore.toFixed(1)}</span>
                                <span className="text-xs text-blue-400">/{totalMaxScore.toFixed(1)}</span>
                            </div> */}

                        
                    </div>
                }
            >

                <div className="bg-white">
                    <Tabs
                        aria-label="Course tabs"
                        color="primary"
                        variant="underlined"
                        classNames={{
                            base: "w-full",
                            tabList: "gap-4 sm:gap-6 w-full relative rounded-none p-0 px-4 border-b border-divider flex flex-nowrap overflow-x-scroll scrollbar-hide [-webkit-overflow-scrolling:touch]",
                            cursor: "bg-blue-500",
                            tab: "w-auto px-0 h-12 shrink-0 data-[focus-visible=true]:outline-none",
                            tabContent: "group-data-[selected=true]:text-blue-600 whitespace-nowrap",
                            panel: "p-0",
                        }}
                    >
                        {hasLab && (
                            <Tab
                                key="lab"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Icon icon="solar:monitor-bold" className="text-lg text-indigo-500" />
                                        <span>Laboratory</span>
                                        <Chip size="sm" variant="flat" className="bg-indigo-100 text-indigo-600">{sortedLabAssignments.length}</Chip>
                                    </div>
                                }
                            >
                                <div className="p-4 sm:p-5">
                                    {/* Lab Summary */}
                                    <div className="bg-linear-to-r from-indigo-50 to-blue-50 rounded-xl p-4 mb-4 border border-indigo-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                                                    <Icon icon="solar:monitor-bold" className="text-white text-lg" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-600">คะแนน Laboratory</p>
                                                    <p className="text-2xl font-bold text-indigo-600">
                                                        {labScore.toFixed(1)} <span className="text-sm text-gray-400">/ {labMaxScore}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-3xl font-bold text-indigo-600">
                                                    {labMaxScore > 0 ? ((labScore / labMaxScore) * 100).toFixed(0) : 0}%
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    ตรวจแล้ว {labAssignments.filter(a => a.status === "graded").length}/{labAssignments.length}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="h-3 bg-indigo-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-linear-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                                                style={{ width: `${labMaxScore > 0 ? (labScore / labMaxScore) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:gap-4">
                                        {sortedLabAssignments.map(renderAssignmentCard)}
                                    </div>
                                </div>
                            </Tab>
                        )}

                        {hasHomework && (
                            <Tab
                                key="assignment"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Icon icon="solar:document-text-bold" className="text-lg text-amber-500" />
                                        <span>Assignment</span>
                                        <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-600">{sortedHomeworkAssignments.length}</Chip>
                                    </div>
                                }
                            >
                                <div className="p-4 sm:p-5">
                                    {/* Assignment Summary */}
                                    <div className="bg-linear-to-r from-amber-50 to-orange-50 rounded-xl p-4 mb-4 border border-amber-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                                                    <Icon icon="solar:document-text-bold" className="text-white text-lg" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-600">คะแนน Assignment</p>
                                                    <p className="text-2xl font-bold text-amber-600">
                                                        {homeworkScore.toFixed(1)} <span className="text-sm text-gray-400">/ {homeworkMaxScore}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-3xl font-bold text-amber-600">
                                                    {homeworkMaxScore > 0 ? ((homeworkScore / homeworkMaxScore) * 100).toFixed(0) : 0}%
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    ตรวจแล้ว {homeworkAssignments.filter(a => a.status === "graded").length}/{homeworkAssignments.length}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="h-3 bg-amber-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-linear-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                                                style={{ width: `${homeworkMaxScore > 0 ? (homeworkScore / homeworkMaxScore) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:gap-4">
                                        {sortedHomeworkAssignments.map(renderAssignmentCard)}
                                    </div>
                                </div>
                            </Tab>
                        )}

                        {/* Group Tab - only show if has group assignments */}
                        {hasGroup && (
                            <Tab
                                key="group"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Icon icon="solar:users-group-rounded-bold" className="text-lg text-emerald-500" />
                                        <span>งานกลุ่ม</span>
                                        <Chip size="sm" variant="flat" className="bg-emerald-100 text-emerald-600">{sortedGroupAssignments.length}</Chip>
                                    </div>
                                }
                            >
                                <div className="p-4 sm:p-5">
                                    {/* Group Summary */}
                                    <div className="bg-linear-to-r from-emerald-50 to-teal-50 rounded-xl p-4 mb-4 border border-emerald-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                                                    <Icon icon="solar:users-group-rounded-bold" className="text-white text-lg" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-600">คะแนนงานกลุ่ม</p>
                                                    <p className="text-2xl font-bold text-emerald-600">
                                                        {groupScore.toFixed(1)} <span className="text-sm text-gray-400">/ {groupMaxScore}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-3xl font-bold text-emerald-600">
                                                    {groupMaxScore > 0 ? ((groupScore / groupMaxScore) * 100).toFixed(0) : 0}%
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    ตรวจแล้ว {groupAssignments.filter(a => a.status === "graded").length}/{groupAssignments.length}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="h-3 bg-emerald-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-linear-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                                                style={{ width: `${groupMaxScore > 0 ? (groupScore / groupMaxScore) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:gap-4">
                                        {sortedGroupAssignments.map(renderAssignmentCard)}
                                    </div>
                                </div>
                            </Tab>
                        )}

                        {hasAttendance && (
                            <Tab
                                key="attendance"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Icon icon="solar:calendar-mark-linear" className="text-lg text-sky-500" />
                                        <span>เช็คชื่อ</span>
                                        <Chip size="sm" variant="flat" className="bg-sky-100 text-sky-600">{sortedAttendance.length}</Chip>
                                    </div>
                                }
                            >
                                <div className="p-4 sm:p-5">
                                    {/* Attendance Summary with Progress */}
                                    <div className="bg-linear-to-r from-sky-50 to-cyan-50 rounded-xl p-4 mb-4 border border-sky-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center">
                                                    <Icon icon="solar:calendar-mark-bold" className="text-white text-lg" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-600">สถิติการเข้าเรียน</p>
                                                    <p className="text-2xl font-bold text-sky-600">
                                                        {attendance.summary.present + attendance.summary.late} <span className="text-sm text-gray-400">/ {sortedAttendance.length} ครั้ง</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-3xl font-bold text-sky-600">
                                                    {sortedAttendance.length > 0 
                                                        ? (((attendance.summary.present + attendance.summary.late) / sortedAttendance.length) * 100).toFixed(0) 
                                                        : 0}%
                                                </p>
                                                <p className="text-xs text-gray-500">อัตราการเข้าเรียน</p>
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="h-3 bg-sky-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-linear-to-r from-sky-500 to-cyan-500 rounded-full transition-all duration-500"
                                                style={{ width: `${sortedAttendance.length > 0 ? ((attendance.summary.present + attendance.summary.late) / sortedAttendance.length) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Attendance Stats Grid */}
                                    <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4">
                                        {[
                                            { key: "present", label: "มาเรียน", color: "bg-green-500", icon: "solar:check-circle-bold" },
                                            { key: "late", label: "สาย", color: "bg-amber-500", icon: "solar:clock-circle-bold" },
                                            { key: "leave", label: "ลา", color: "bg-gray-400", icon: "solar:document-text-bold" },
                                            { key: "absent", label: "ขาด", color: "bg-red-500", icon: "solar:close-circle-bold" },
                                        ].map((item) => (
                                            <div
                                                key={item.key}
                                                className="bg-white rounded-xl p-3 text-center border border-gray-100 shadow-sm"
                                            >
                                                <div className={`w-8 h-8 ${item.color} rounded-full flex items-center justify-center mx-auto mb-1`}>
                                                    <Icon icon={item.icon} className="text-white text-sm" />
                                                </div>
                                                <p className="text-xl font-bold text-gray-700">
                                                    {attendance.summary[item.key as keyof typeof attendance.summary]}
                                                </p>
                                                <p className="text-xs text-gray-500">{item.label}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Attendance Records */}
                                    <div className="space-y-2">
                                        {sortedAttendance.map((record) => {
                                            const config = getAttendanceConfig(record.status);
                                            return (
                                                <div
                                                    key={record.id}
                                                    className={`flex items-center justify-between p-3 rounded-xl border ${config.bg}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${record.status === "present" ? "bg-green-100" :
                                                                record.status === "late" ? "bg-amber-100" :
                                                                    record.status === "absent" ? "bg-red-100" : "bg-gray-100"
                                                            }`}>
                                                            <Icon icon={config.icon} className={`text-lg ${record.status === "present" ? "text-green-600" :
                                                                    record.status === "late" ? "text-amber-600" :
                                                                        record.status === "absent" ? "text-red-600" : "text-gray-600"
                                                                }`} />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-800 text-sm">{record.session_title}</p>
                                                            <p className="text-xs text-gray-500">{formatShortDate(record.date)}</p>
                                                        </div>
                                                    </div>
                                                    <Chip size="sm" color={config.color} variant="flat">
                                                        {config.label}
                                                    </Chip>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </Tab>
                        )}

                        {hasBonus && (
                            <Tab
                                key="bonus"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Icon icon="solar:star-bold" className="text-lg text-amber-500" />
                                        <span>พิเศษ</span>
                                        {bonusScore && bonusScore.total > 0 && (
                                            <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-600">+{bonusScore.total}</Chip>
                                        )}
                                    </div>
                                }
                            >
                                <div className="p-4 sm:p-5">
                                    {/* Bonus Score Summary */}
                                    <div className="flex items-center justify-center gap-4 mb-6 p-4 bg-linear-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                                        <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                                            <Icon icon="solar:star-bold" className="text-3xl text-white" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-amber-700">คะแนนพิเศษรวม</p>
                                            <p className="text-4xl font-bold text-amber-600">+{bonusScore?.total || 0}</p>
                                            <p className="text-xs text-amber-500">คะแนน</p>
                                        </div>
                                    </div>

                                    {/* Bonus Score Records */}
                                    {sortedBonusRecords.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                                                <Icon icon="solar:history-linear" />
                                                ประวัติการได้รับคะแนน ({sortedBonusRecords.length} รายการ)
                                            </p>
                                            {sortedBonusRecords.map((record, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-100 hover:border-amber-300 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                                                            <Icon icon="solar:star-bold" className="text-lg text-amber-500" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-800 text-sm">{record.reason}</p>
                                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                                {record.given_by && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Icon icon="solar:user-check-linear" />
                                                                        {record.given_by}
                                                                    </span>
                                                                )}
                                                                <span className="flex items-center gap-1">
                                                                    <Icon icon="solar:calendar-linear" />
                                                                    {formatDate(record.given_at)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Chip size="sm" color="warning" variant="flat" className="font-bold">
                                                        +{record.score}
                                                    </Chip>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Tab>
                        )}

                        {hasExamScores && (
                            <Tab
                                key="exam"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Icon icon="solar:diploma-bold" className="text-lg text-purple-500" />
                                        <span>คะแนนสอบ</span>
                                        <Chip size="sm" variant="flat" className="bg-purple-100 text-purple-600">
                                            {courseData.examScores.length}
                                        </Chip>
                                    </div>
                                }
                            >
                                <div className="p-4 sm:p-5 space-y-6">
                                    {/* Midterm Section */}
                                    {midtermScores.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <Icon icon="solar:notebook-bold" className="text-blue-500" />
                                                <h4 className="font-medium text-gray-700">สอบกลางภาค</h4>
                                            </div>
                                            
                                            {/* Midterm Statistics */}
                                            {/* {(() => {
                                                const gradedMidterm = midtermScores.filter((e: ExamScoreData) => e.score !== null);
                                                if (gradedMidterm.length > 0) {
                                                    const midtermTotal = gradedMidterm.reduce((sum: number, e: ExamScoreData) => sum + (e.score || 0), 0);
                                                    const midtermMaxTotal = gradedMidterm.reduce((sum: number, e: ExamScoreData) => sum + e.max_score, 0);
                                                    return (
                                                        <div className="bg-linear-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-4 border border-blue-100">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                                                                        <Icon icon="solar:notebook-bold" className="text-white text-lg" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-medium text-gray-600">คะแนนสอบกลางภาค</p>
                                                                        <p className="text-2xl font-bold text-blue-600">
                                                                            {midtermTotal.toFixed(1)} <span className="text-sm text-gray-400">/ {midtermMaxTotal}</span>
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-3xl font-bold text-blue-600">
                                                                        {midtermMaxTotal > 0 ? ((midtermTotal / midtermMaxTotal) * 100).toFixed(0) : 0}%
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">
                                                                        ตรวจแล้ว {gradedMidterm.length}/{midtermScores.length}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="h-3 bg-blue-100 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="h-full bg-linear-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                                                                    style={{ width: `${midtermMaxTotal > 0 ? (midtermTotal / midtermMaxTotal) * 100 : 0}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()} */}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {midtermScores.map((exam: ExamScoreData) => (
                                                    <div
                                                        key={exam.id}
                                                        className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm"
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <Icon 
                                                                    icon={exam.component === 'lab' ? 'solar:monitor-bold' : 'solar:book-bold'} 
                                                                    className={exam.component === 'lab' ? 'text-emerald-500' : 'text-blue-500'} 
                                                                />
                                                                <span className="font-medium text-gray-700">
                                                                    {exam.component === 'lab' ? 'ปฏิบัติการ' : 'บรรยาย'}
                                                                </span>
                                                            </div>
                                                            <Chip 
                                                                size="sm" 
                                                                color={exam.score !== null ? "success" : "default"} 
                                                                variant="flat"
                                                            >
                                                                {exam.score !== null ? "ตรวจแล้ว" : "รอตรวจ"}
                                                            </Chip>
                                                        </div>
                                                        <div className="text-center py-3">
                                                            {(() => {
                                                                const percent = exam.score !== null ? (exam.score / exam.max_score) * 100 : 0;
                                                                let colorClass = 'text-gray-400';
                                                                if (exam.score !== null) {
                                                                    if (percent >= 80) colorClass = 'text-emerald-600';
                                                                    else if (percent >= 60) colorClass = 'text-blue-600';
                                                                    else if (percent >= 40) colorClass = 'text-amber-600';
                                                                    else colorClass = 'text-red-600';
                                                                }
                                                                return (
                                                                    <span className={`text-3xl font-bold ${colorClass}`}>
                                                                        {exam.score !== null ? exam.score.toFixed(1) : '-'}
                                                                    </span>
                                                                );
                                                            })()}
                                                            <span className="text-gray-400 text-lg">/{exam.max_score}</span>
                                                        </div>
                                                        {exam.grader && (
                                                            <p className="text-xs text-gray-500 text-center">
                                                                ตรวจโดย {exam.grader}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Final Section */}
                                    {finalScores.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <Icon icon="solar:diploma-bold" className="text-indigo-500" />
                                                <h4 className="font-medium text-gray-700">สอบปลายภาค</h4>
                                            </div>
                                            
                                            {/* Final Statistics */}
                                            {/* {(() => {
                                                const gradedFinal = finalScores.filter((e: ExamScoreData) => e.score !== null);
                                                if (gradedFinal.length > 0) {
                                                    const finalTotal = gradedFinal.reduce((sum: number, e: ExamScoreData) => sum + (e.score || 0), 0);
                                                    const finalMaxTotal = gradedFinal.reduce((sum: number, e: ExamScoreData) => sum + e.max_score, 0);
                                                    return (
                                                        <div className="bg-linear-to-r from-indigo-50 to-purple-50 rounded-xl p-4 mb-4 border border-indigo-100">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                                                                        <Icon icon="solar:diploma-bold" className="text-white text-lg" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-medium text-gray-600">คะแนนสอบปลายภาค</p>
                                                                        <p className="text-2xl font-bold text-indigo-600">
                                                                            {finalTotal.toFixed(1)} <span className="text-sm text-gray-400">/ {finalMaxTotal}</span>
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-3xl font-bold text-indigo-600">
                                                                        {finalMaxTotal > 0 ? ((finalTotal / finalMaxTotal) * 100).toFixed(0) : 0}%
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">
                                                                        ตรวจแล้ว {gradedFinal.length}/{finalScores.length}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="h-3 bg-indigo-100 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="h-full bg-linear-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                                                                    style={{ width: `${finalMaxTotal > 0 ? (finalTotal / finalMaxTotal) * 100 : 0}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()} */}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {finalScores.map((exam: ExamScoreData) => (
                                                    <div
                                                        key={exam.id}
                                                        className="bg-white rounded-xl p-4 border border-indigo-100 shadow-sm"
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <Icon 
                                                                    icon={exam.component === 'lab' ? 'solar:monitor-bold' : 'solar:book-bold'} 
                                                                    className={exam.component === 'lab' ? 'text-emerald-500' : 'text-indigo-500'} 
                                                                />
                                                                <span className="font-medium text-gray-700">
                                                                    {exam.component === 'lab' ? 'ปฏิบัติการ' : 'บรรยาย'}
                                                                </span>
                                                            </div>
                                                            <Chip 
                                                                size="sm" 
                                                                color={exam.score !== null ? "success" : "default"} 
                                                                variant="flat"
                                                            >
                                                                {exam.score !== null ? "ตรวจแล้ว" : "รอตรวจ"}
                                                            </Chip>
                                                        </div>
                                                        <div className="text-center py-3">
                                                            {(() => {
                                                                const percent = exam.score !== null ? (exam.score / exam.max_score) * 100 : 0;
                                                                let colorClass = 'text-gray-400';
                                                                if (exam.score !== null) {
                                                                    if (percent >= 80) colorClass = 'text-emerald-600';
                                                                    else if (percent >= 60) colorClass = 'text-blue-600';
                                                                    else if (percent >= 40) colorClass = 'text-amber-600';
                                                                    else colorClass = 'text-red-600';
                                                                }
                                                                return (
                                                                    <span className={`text-3xl font-bold ${colorClass}`}>
                                                                        {exam.score !== null ? exam.score.toFixed(1) : '-'}
                                                                    </span>
                                                                );
                                                            })()}
                                                            <span className="text-gray-400 text-lg">/{exam.max_score}</span>
                                                        </div>
                                                        {exam.grader && (
                                                            <p className="text-xs text-gray-500 text-center">
                                                                ตรวจโดย {exam.grader}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Tab>
                        )}
                    </Tabs>
                </div>
            </AccordionItem>
        );
    };

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-60 left-90 w-35 h-35 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 right-0 w-60 h-60 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
                    <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
                </div>

                <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-12">
                    <div className="text-center">
                        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-4">
                            <Icon icon="solar:graduation-cap-bold" className="text-lg" />
                            <span className="text-sm font-medium">ITII Assist Classroom</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold mb-3">ค้นหาคะแนนรายบุคคล</h1>
                        <p className="text-blue-100 text-sm sm:text-base max-w-md mx-auto">
                            ตรวจสอบคะแนนเก็บและความคืบหน้าการเรียนของคุณได้ทันที
                        </p>
                    </div>
                </div>
            </div>

            {/* Search Section */}
            <div className="max-w-4xl mx-auto w-full px-4 -mt-6 z-10">
                <Card className="shadow-xl border-none">
                    <CardBody className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                placeholder="กรอกรหัสนักศึกษา เช่น 660705010-1"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                onKeyPress={handleKeyPress}
                                size="lg"
                                variant="bordered"
                                isClearable
                                onClear={() => setStudentId("")}
                                startContent={
                                    <Icon icon="solar:user-id-bold" className="text-blue-500 text-xl" />
                                }
                                classNames={{
                                    inputWrapper: "border-gray-200 hover:border-blue-400 focus-within:!border-blue-500 h-14",
                                    input: "text-base",
                                }}
                            />
                            <Button
                                color="primary"
                                size="lg"
                                onPress={handleSearch}
                                isLoading={isLoading}
                                isDisabled={cooldown > 0 && !isLoading}
                                className="bg-linear-to-r from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 h-14 min-w-[140px] text-base font-medium"
                            >
                                {cooldown > 0 && !isLoading ? `รอ ${cooldown} วินาที` : "ค้นหาคะแนน"}
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Content */}
            <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 sm:py-8">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="relative">
                            <Spinner size="lg" color="primary" />
                        </div>
                        <p className="text-gray-500 mt-4 animate-pulse">กำลังค้นหาข้อมูล...</p>
                    </div>
                ) : data ? (
                    <>
                        {/* Student Info Card */}
                        <Card className="mb-6 shadow-lg border-none overflow-hidden">
                            <CardBody className="p-0">
                                <div className="bg-linear-to-r from-slate-700 to-slate-800 p-5 sm:p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg">
                                            <Icon icon="solar:user-bold" className="text-white text-3xl sm:text-4xl" />
                                        </div>
                                        <div className="text-white">
                                            <h2 className="text-xl sm:text-2xl font-bold mb-1">
                                                {data.student.full_name}
                                            </h2>
                                            <div className="flex items-center gap-2 text-slate-300 text-sm">
                                                <Icon icon="solar:card-2-linear" />
                                                <span>{data.student.student_id}</span>
                                            </div>
                                            {data.student.email && (
                                                <div className="flex items-center gap-2 text-slate-400 text-xs mt-1">
                                                    <Icon icon="solar:letter-linear" />
                                                    <span>{data.student.email}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Stats */}
                                {/* <div className="grid grid-cols-3 divide-x divide-gray-100">
                                    <div className="p-4 text-center">
                                        <p className="text-3xl font-bold text-blue-600">{data.courses.length}</p>
                                        <p className="text-xs text-gray-500 mt-1">รายวิชา</p>
                                    </div>
                                    <div className="p-4 text-center">
                                        <p className="text-3xl font-bold text-green-600">
                                            {data.courses.reduce((sum, c) => sum + c.assignments.filter(a => a.status === "graded").length, 0)}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">ตรวจแล้ว</p>
                                    </div>
                                    <div className="p-4 text-center">
                                        <p className="text-3xl font-bold text-purple-600">
                                            {data.courses.reduce((sum, c) => sum + c.attendance.records.length, 0)}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">เช็คชื่อ</p>
                                    </div>
                                </div> */}
                            </CardBody>
                        </Card>

                        {/* Course Cards - only show active courses */}
                        {data.courses.filter(c => c.course.is_active).length > 0 ? (
                            <Accordion
                                selectionMode="multiple"
                                variant="light"
                                className="px-0 flex flex-col gap-4"
                            >
                                {data.courses
                                    .filter(c => c.course.is_active)
                                    .map((courseData, index) => renderCourseCard(courseData, index))}
                            </Accordion>
                        ) : (
                            <Card className="shadow-lg border-none">
                                <CardBody className="p-12 text-center">
                                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Icon icon="solar:notebook-linear" className="text-4xl text-gray-400" />
                                    </div>
                                    <p className="text-gray-600 font-medium mb-1">ไม่พบรายวิชา</p>
                                    <p className="text-gray-400 text-sm">นักศึกษายังไม่ได้ลงทะเบียนรายวิชาใดๆ</p>
                                </CardBody>
                            </Card>
                        )}
                    </>
                ) : hasSearched ? (
                    <Card className="shadow-lg border-none">
                        <CardBody className="p-12 text-center">
                            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Icon icon="solar:user-cross-bold" className="text-5xl text-red-400" />
                            </div>
                            <p className="text-gray-700 font-semibold text-lg mb-2">ไม่พบข้อมูลนักศึกษา</p>
                            <p className="text-gray-400 text-sm">กรุณาตรวจสอบรหัสนักศึกษาและลองใหม่อีกครั้ง</p>
                        </CardBody>
                    </Card>
                ) : (
                    <Card className="shadow-lg border-none">
                        <CardBody className="p-12 text-center">
                            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Icon icon="solar:magnifer-bold" className="text-5xl text-blue-400" />
                            </div>
                            <p className="text-gray-700 font-semibold text-lg mb-2">เริ่มต้นค้นหาคะแนน</p>
                            <p className="text-gray-400 text-sm">กรอกรหัสนักศึกษาด้านบนเพื่อดูคะแนนและการเช็คชื่อ</p>
                        </CardBody>
                    </Card>
                )}
            </div>

            {/* Footer */}
            <div className="mt-auto py-4 text-center text-slate-400 text-xs sm:text-sm px-4 font-light bg-white/50">
                © 2025 ITII Assist Classroom. All Rights Reserved. Made with ❤️ by{" "}
                <Link href="https://github.com/OSP101" target="_blank" className="text-blue-500 hover:text-blue-600">
                    OSP101
                </Link>
            </div>
        </div>
    );
}