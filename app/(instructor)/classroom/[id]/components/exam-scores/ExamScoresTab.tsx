"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Tabs, Tab } from "@heroui/tabs";
import { Button } from "@heroui/button";
import { Switch } from "@heroui/switch";
import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { ScoresSkeleton } from "../Skeletons";
import examScoreService, { 
    ExamSetting, 
    Student, 
    ExamScore,
    getExamTypeLabel, 
    getComponentLabel,
    getExamName,
    parseExcelData
} from "@/services/examScore.service";

function formatCount(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

function getBulkStatusText(
    status: "valid" | "not_found" | "score_exceeds" | "invalid_score" | "negative_score",
    isEnglish: boolean,
    maxScore?: number,
): string {
    switch (status) {
        case "valid":
            return isEnglish ? "Valid" : "ถูกต้อง";
        case "not_found":
            return isEnglish ? "Student not found" : "ไม่พบนักศึกษา";
        case "score_exceeds":
            return isEnglish ? `Exceeds max score (${maxScore ?? 0})` : `เกินคะแนนเต็ม (${maxScore ?? 0})`;
        case "invalid_score":
            return isEnglish ? "Invalid score" : "คะแนนไม่ถูกต้อง";
        case "negative_score":
            return isEnglish ? "Score cannot be negative" : "คะแนนต้องไม่ติดลบ";
        default:
            return "-";
    }
}

interface ExamScoresTabProps {
    courseId: string;
    isCourseActive?: boolean;
    canCreateExamScores?: boolean;
    canUpdateExamScores?: boolean;
    canUpdateExamSettings?: boolean;
}

interface ScoreMap {
    [settingId: number]: {
        [studentId: number]: ExamScore;
    };
}

export default function ExamScoresTab({
    courseId,
    isCourseActive = true,
    canCreateExamScores = false,
    canUpdateExamScores = false,
    canUpdateExamSettings = false,
}: ExamScoresTabProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState<ExamSetting[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [scoreMap, setScoreMap] = useState<ScoreMap>({});
    const [activeTab, setActiveTab] = useState<string>("midterm");
    const [searchQuery, setSearchQuery] = useState("");
    const [editingScore, setEditingScore] = useState<{settingId: number, studentId: number, value: string} | null>(null);
    
    // Bulk import modal
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkSettingId, setBulkSettingId] = useState<number | null>(null);
    const [bulkData, setBulkData] = useState("");
    const [isBulkSaving, setIsBulkSaving] = useState(false);
    
    // Parsed bulk data for validation display
    interface ParsedBulkItem {
        inputStudentId: string;
        inputScore: string;
        status: "valid" | "not_found" | "score_exceeds" | "invalid_score" | "negative_score";
        matchedStudent?: Student;
        parsedScore?: number | null;
    }
    const [parsedBulkData, setParsedBulkData] = useState<ParsedBulkItem[]>([]);

    // Settings modal
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [settingsData, setSettingsData] = useState<{[id: number]: Partial<ExamSetting>}>({});

    // Load data
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [settingsRes, scoresRes] = await Promise.all([
                examScoreService.getExamSettings(courseId),
                examScoreService.getExamScores(courseId),
            ]);
            
            setSettings(settingsRes);
            setStudents(scoresRes.students);

            // Build score map
            const map: ScoreMap = {};
            scoresRes.settings.forEach(s => {
                map[s.id] = {};
                s.scores?.forEach(score => {
                    map[s.id][score.student_id] = score;
                });
            });
            setScoreMap(map);
        } catch (error) {
            console.error("Failed to load exam data:", error);
            addToast({
                title: isEnglish ? "Unable to load exam data" : "ไม่สามารถโหลดข้อมูลได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, [courseId, isEnglish]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filter settings by tab
    const filteredSettings = useMemo(() => {
        if (!settings) return [];
        return settings.filter(s => s.exam_type === activeTab && s.is_active);
    }, [settings, activeTab]);

    // Filter students by search
    const filteredStudents = useMemo(() => {
        if (!students) return [];
        if (!searchQuery) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(s => 
            s.student_id.toLowerCase().includes(q) ||
            s.full_name.toLowerCase().includes(q)
        );
    }, [students, searchQuery]);

    // Save single score
    const handleSaveScore = async (settingId: number, studentId: number, scoreValue: string) => {
        if (!isCourseActive) return;
        
        const score = scoreValue === "" ? null : parseFloat(scoreValue);
        if (scoreValue !== "" && isNaN(score as number)) {
            addToast({
                title: isEnglish ? "Invalid score" : "คะแนนไม่ถูกต้อง",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        // Check if score exceeds max_score
        const setting = settings.find(s => s.id === settingId);
        if (setting && score !== null && score > setting.max_score) {
            addToast({
                title: isEnglish ? `Score exceeds max score (${setting.max_score})` : `คะแนนเกินคะแนนเต็ม (${setting.max_score})`,
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        if (score !== null && score < 0) {
            addToast({
                title: isEnglish ? "Score cannot be negative" : "คะแนนต้องไม่ติดลบ",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSaving(true);
        try {
            const result = await examScoreService.saveExamScore(courseId, {
                exam_setting_id: settingId,
                student_id: studentId,
                score,
            });

            // Update local state
            setScoreMap(prev => ({
                ...prev,
                [settingId]: {
                    ...prev[settingId],
                    [studentId]: result,
                },
            }));
            setEditingScore(null);
            addToast({
                title: isEnglish ? "Score saved" : "บันทึกคะแนนสำเร็จ",
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } catch (error: any) {
            addToast({
                title: isEnglish ? "Unable to save the score" : (error?.response?.data?.message || "ไม่สามารถบันทึกได้"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Validate bulk data when pasted
    const validateBulkData = useCallback((data: string, settingId: number | null) => {
        if (!data.trim() || !settingId) {
            setParsedBulkData([]);
            return;
        }

        const setting = settings.find(s => s.id === settingId);
        const maxScore = setting?.max_score ?? 100;
        
        // Create a map of student_id to student for quick lookup
        const studentMap = new Map<string, Student>();
        students.forEach(s => {
            studentMap.set(s.student_id.toLowerCase(), s);
        });

        const lines = data.split(/\r?\n/).filter(line => line.trim());
        const parsed: ParsedBulkItem[] = [];

        for (const line of lines) {
            // Split by tab or comma
            const parts = line.split(/[\t,]/).map(p => p.trim());
            if (parts.length < 2) continue;

            const inputStudentId = parts[0];
            const inputScore = parts[1];
            
            // Find student
            const matchedStudent = studentMap.get(inputStudentId.toLowerCase());
            
            // Parse score
            const scoreNum = inputScore === "" || inputScore === "-" ? null : parseFloat(inputScore);
            const isValidScore = inputScore === "" || inputScore === "-" || !isNaN(scoreNum as number);
            
            let status: ParsedBulkItem["status"] = "valid";
            
            if (!matchedStudent) {
                status = "not_found";
            } else if (!isValidScore) {
                status = "invalid_score";
            } else if (scoreNum !== null && scoreNum < 0) {
                status = "negative_score";
            } else if (scoreNum !== null && scoreNum > maxScore) {
                status = "score_exceeds";
            }
            
            parsed.push({
                inputStudentId,
                inputScore,
                status,
                matchedStudent,
                parsedScore: isValidScore ? scoreNum : undefined,
            });
        }

        setParsedBulkData(parsed);
    }, [settings, students]);

    // Handle bulk import
    const handleBulkImport = async () => {
        if (!bulkSettingId) return;
        
        // Get only valid items
        const validItems = parsedBulkData.filter(p => p.status === "valid" && p.matchedStudent);
        if (validItems.length === 0) {
            addToast({
                title: isEnglish ? "No valid rows found. Please review the data." : "ไม่มีข้อมูลที่ถูกต้อง กรุณาตรวจสอบข้อมูล",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        const scores = validItems.map(item => ({
            student_id: item.inputStudentId,
            score: item.parsedScore ?? null,
        }));

        setIsBulkSaving(true);
        try {
            const result = await examScoreService.bulkSaveExamScores(courseId, {
                exam_setting_id: bulkSettingId,
                scores,
            });

            addToast({
                title: isEnglish ? "Import complete" : "สำเร็จ",
                description: isEnglish ? `Saved ${formatCount(result.saved, "row", "rows")}.` : (result.message || `บันทึกคะแนน ${result.saved} รายการสำเร็จ`),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            if (result.errors.length > 0) {
                addToast({
                    title: isEnglish ? "Warning" : "เตือน",
                    description: isEnglish ? `${formatCount(result.errors.length, "row", "rows")} failed to import.` : `มี ${result.errors.length} รายการที่ไม่สำเร็จ`,
                    color: "warning",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }

            // Reload data
            await loadData();
            setIsBulkModalOpen(false);
            setBulkData("");
            setBulkSettingId(null);
            setParsedBulkData([]);
        } catch (error: any) {
            addToast({
                title: isEnglish ? "Unable to import scores" : (error?.response?.data?.message || "ไม่สามารถนำเข้าได้"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsBulkSaving(false);
        }
    };

    // Save settings
    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            const updates = Object.entries(settingsData);
            for (const [idStr, data] of updates) {
                const id = parseInt(idStr);
                await examScoreService.updateExamSetting(courseId, id, data);
            }
            addToast({
                title: isEnglish ? "Exam settings saved" : "บันทึกการตั้งค่าสำเร็จ",
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            await loadData();
            setIsSettingsModalOpen(false);
            setSettingsData({});
        } catch (error: any) {
            addToast({
                title: isEnglish ? "Unable to save exam settings" : (error?.response?.data?.message || "ไม่สามารถบันทึกได้"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Get score value for display
    const getScoreDisplay = (settingId: number, studentId: number): string => {
        const score = scoreMap[settingId]?.[studentId]?.score;
        return score !== null && score !== undefined ? String(score) : "";
    };

    if (isLoading) {
        return <ScoresSkeleton />;
    }

    const activeSettings = settings?.filter(s => s.is_active) || [];
    const hasActiveSettings = activeSettings.length > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{isEnglish ? "Exam scores" : "คะแนนสอบ"}</h2>
                    <p className="text-sm text-default-500">{isEnglish ? "Manage midterm and final exam scores." : "จัดการคะแนนสอบกลางภาคและปลายภาค"}</p>
                </div>
                <Button
                    className="font-medium bg-linear-to-r from-blue-400 to-indigo-500 text-white shadow-md hover:shadow-lg"
                    startContent={<Icon icon="solar:settings-bold" />}
                    onPress={() => {
                        // Initialize settings data
                        const data: {[id: number]: Partial<ExamSetting>} = {};
                        settings.forEach(s => {
                            data[s.id] = {
                                max_score: s.max_score,
                                is_visible: s.is_visible,
                                is_active: s.is_active,
                            };
                        });
                        setSettingsData(data);
                        setIsSettingsModalOpen(true);
                    }}
                >
                    {isEnglish ? "Exam settings" : "ตั้งค่าการสอบ"}
                </Button>
            </div>

            {!hasActiveSettings ? (
                // No active settings
                <Card className="border border-dashed border-default-300 bg-content2/50 shadow-sm">
                    <CardBody className="text-center py-16">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                            <Icon icon="solar:document-add-bold-duotone" className="text-5xl text-blue-500" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-default-700">{isEnglish ? "Exam scoring is not enabled yet" : "ยังไม่เปิดใช้งานการสอบ"}</h3>
                        <p className="mx-auto mb-6 max-w-md text-default-500">
                            {isEnglish ? "Click \"Exam settings\" to enable exam components and set the maximum score for each exam." : "กดปุ่ม \"ตั้งค่าการสอบ\" เพื่อเปิดใช้งานและกำหนดคะแนนเต็มของแต่ละการสอบ"}
                        </p>
                    </CardBody>
                </Card>
            ) : (
                <>
                    {/* Tabs */}
                    <Tabs
                        selectedKey={activeTab}
                        onSelectionChange={(key) => setActiveTab(key as string)}
                        variant="underlined"
                        classNames={{
                            tabList: "gap-6",
                            cursor: "bg-blue-500",
                            tab: "px-0 h-11",
                            tabContent: "group-data-[selected=true]:text-blue-600 text-default-500 font-medium"
                        }}
                    >
                        <Tab
                            key="midterm"
                            title={
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:notebook-bold" className="text-lg" />
                                    <span>{isEnglish ? "Midterm" : "สอบกลางภาค"}</span>
                                </div>
                            }
                        />
                        <Tab
                            key="final"
                            title={
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:diploma-bold" className="text-lg" />
                                    <span>{isEnglish ? "Final" : "สอบปลายภาค"}</span>
                                </div>
                            }
                        />
                    </Tabs>

                    {/* Search & Actions */}
                    <Card className="border border-default-200 bg-content1 shadow-sm">
                        <CardBody className="py-3 px-4">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                <Input
                                    placeholder={isEnglish ? "Search by student ID or name..." : "ค้นหารหัสหรือชื่อนักศึกษา..."}
                                    value={searchQuery}
                                    onValueChange={setSearchQuery}
                                    startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                                    className="w-full sm:max-w-sm"
                                    size="md"
                                    variant="bordered"
                                    isClearable
                                />
                                <div className="flex items-center gap-2">
                                    <Chip size="md" variant="flat" className="bg-content3 text-default-600">
                                        {isEnglish ? formatCount(filteredStudents.length, "student", "students") : `${filteredStudents.length} คน`}
                                    </Chip>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Score Tables */}
                    {filteredSettings.length > 0 ? (
                        <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {filteredSettings.map(setting => {
                                // Calculate statistics for this setting (using all students, not filtered)
                                // Only include valid numeric scores that exist
                                const allSettingScores = students
                                    .map(s => {
                                        const rawScore = scoreMap[setting.id]?.[s.id]?.score;
                                        if (rawScore === null || rawScore === undefined) return null;
                                        const numScore = typeof rawScore === 'string' ? parseFloat(rawScore) : rawScore;
                                        return isNaN(numScore) ? null : numScore;
                                    })
                                    .filter((score): score is number => score !== null);
                                
                                const avgScore = allSettingScores.length > 0 
                                    ? (allSettingScores.reduce((a, b) => a + b, 0) / allSettingScores.length).toFixed(2)
                                    : "-";
                                const highScore = allSettingScores.length > 0 ? Math.max(...allSettingScores) : "-";
                                const lowScore = allSettingScores.length > 0 ? Math.min(...allSettingScores) : "-";

                                return (
                                <Card key={setting.id} className="overflow-hidden border border-default-200 bg-content1 shadow-lg">
                                    {/* Header */}
                                    <CardHeader className={`px-5 py-4 border-b-0 
                                     
                                    `}>
                                        {/* ${setting.component === 'lab' ? 'bg-emerald-500' : 'bg-blue-500'} */}
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-content2/80 backdrop-blur-sm">
                                                    <Icon 
                                                        icon={setting.component === 'lab' ? 'solar:monitor-bold' : 'solar:book-bold'} 
                                                        className={`text-2xl ${setting.component === 'lab' ? 'text-emerald-500' : 'text-blue-500'}`} 
                                                    />
                                                </div>
                                                <div className="text-foreground">
                                                    <p className="font-bold text-lg">
                                                        {setting.component === 'lab'
                                                            ? (isEnglish ? 'Lab component' : 'ปฏิบัติการ (Lab)')
                                                            : (isEnglish ? 'Lecture component' : 'บรรยาย (Lecture)')}
                                                    </p>
                                                    {/* <p className="text-sm text-white/80">
                                                        Max {setting.max_score} คะแนน
                                                    </p> */}
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md"
                                                startContent={<Icon icon="solar:document-add-bold" />}
                                                isDisabled={!isCourseActive || !canCreateExamScores}
                                                onPress={() => {
                                                    setBulkSettingId(setting.id);
                                                    setIsBulkModalOpen(true);
                                                }}
                                            >
                                                {isEnglish ? "Import from Excel" : "ดึงจาก Excel"}
                                            </Button>
                                        </div>
                                    </CardHeader>

                                    {/* Statistics Cards - Above Table */}
                                    <div className="border-b border-divider bg-content1 px-4 py-3">
                                        <div className="grid grid-cols-4 gap-2">
                                            <div className="flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 dark:border-blue-500/25 dark:bg-blue-500/12">
                                                {/* <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center">
                                                    <Icon icon="solar:calculator-bold" className="text-white text-lg" />
                                                </div> */}
                                                <div>
                                                    <p className="text-sm font-medium uppercase tracking-wide text-blue-700 dark:text-blue-200">{isEnglish ? "Average" : "คะแนนเฉลี่ย"}</p>
                                                    <p className="text-base font-bold text-blue-950 dark:text-blue-50">{avgScore}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/25 dark:bg-emerald-500/12">
                                                {/* <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
                                                    <Icon icon="solar:arrow-up-bold" className="text-white text-lg" />
                                                </div> */}
                                                <div>
                                                    <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-200">{isEnglish ? "Highest" : "คะแนนสูงสุด"}</p>
                                                    <p className="text-base font-bold text-emerald-950 dark:text-emerald-50">{highScore}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2.5 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2.5 dark:border-orange-500/25 dark:bg-orange-500/12">
                                                {/* <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
                                                    <Icon icon="solar:arrow-down-bold" className="text-white text-lg" />
                                                </div> */}
                                                <div>
                                                    <p className="text-sm font-medium uppercase tracking-wide text-orange-700 dark:text-orange-200">{isEnglish ? "Lowest" : "คะแนนต่ำสุด"}</p>
                                                    <p className="text-base font-bold text-orange-950 dark:text-orange-50">{lowScore}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2.5 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 dark:border-violet-500/25 dark:bg-violet-500/12">
                                                {/* <div className="w-9 h-9 rounded-xl bg-purple-500 flex items-center justify-center">
                                                    <Icon icon="solar:star-bold" className="text-white text-lg" />
                                                </div> */}
                                                <div>
                                                    <p className="text-sm font-medium uppercase tracking-wide text-violet-700 dark:text-violet-200">{isEnglish ? "Max score" : "คะแนนเต็ม"}</p>
                                                    <p className="text-base font-bold text-violet-950 dark:text-violet-50">{setting.max_score}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Table - single scroll container for synced horizontal/vertical scroll */}
                                    <CardBody className="max-h-112.5 overflow-auto p-0">
                                      <div className="min-w-125">
                                        {/* Table Header - sticky top */}
                                        <div className="sticky top-0 z-20 flex items-center border-b border-divider bg-content1">
                                            <div className="shrink-0 w-32 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-default-500">
                                                {isEnglish ? "Student ID" : "รหัสนักศึกษา"}
                                            </div>
                                            <div className="min-w-35 flex-1 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-default-500">
                                                {isEnglish ? "Student name" : "ชื่อ-นามสกุล"}
                                            </div>
                                            <div className="shrink-0 w-20 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-default-500">
                                                Section
                                            </div>
                                            <div className="sticky right-0 z-30 shrink-0 w-32 bg-content1 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-default-500 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.28)]">
                                                {isEnglish ? "Score" : "คะแนน"}
                                            </div>
                                        </div>

                                        {/* Table Body */}
                                            {filteredStudents.map((student, idx) => {
                                                const isEditing = editingScore?.settingId === setting.id && editingScore?.studentId === student.id;
                                                const scoreValue = getScoreDisplay(setting.id, student.id);
                                                const hasScore = scoreValue !== "";
                                                
                                                return (
                                                    <div 
                                                        key={student.id} 
                                                        className={`flex items-center border-b border-divider transition-colors last:border-b-0 hover:bg-content2/80 ${idx % 2 === 0 ? 'bg-content1' : 'bg-content2/50'}`}
                                                    >
                                                        <div className="shrink-0 w-32 px-3 py-3">
                                                            <span className="text-sm text-default-600">
                                                                {student.student_id}
                                                            </span>
                                                        </div>
                                                        <div className="min-w-35 flex-1 truncate px-3 py-3 text-sm text-default-700">
                                                            {student.full_name}
                                                        </div>
                                                        <div className="shrink-0 w-20 px-3 py-3 text-center text-sm text-default-600">
                                                            {student.section_no || "-"}
                                                        </div>
                                                        <div className={`sticky right-0 z-10 flex shrink-0 w-32 items-center justify-end gap-2 px-3 py-3 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.28)] ${idx % 2 === 0 ? 'bg-content1' : 'bg-content2/50'}`}>
                                                            {isEditing ? (
                                                                <div className="flex items-center gap-1">
                                                                    <Input
                                                                        type="number"
                                                                        size="sm"
                                                                        variant="bordered"
                                                                        className="w-16"
                                                                        classNames={{
                                                                            input: "text-center font-semibold",
                                                                            inputWrapper: "h-8 min-h-8",
                                                                        }}
                                                                        value={editingScore.value}
                                                                        onValueChange={(v) => setEditingScore({...editingScore, value: v})}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                handleSaveScore(setting.id, student.id, editingScore.value);
                                                                            } else if (e.key === 'Escape') {
                                                                                setEditingScore(null);
                                                                            }
                                                                        }}
                                                                        autoFocus
                                                                    />
                                                                    <Button
                                                                        isIconOnly
                                                                        size="sm"
                                                                        color="danger"
                                                                        variant="flat"
                                                                        className="min-w-7 w-7 h-7"
                                                                        onPress={() => setEditingScore(null)}
                                                                    >
                                                                        <Icon icon="solar:close-circle-bold" />
                                                                    </Button>
                                                                    <Button
                                                                        isIconOnly
                                                                        size="sm"
                                                                        color="success"
                                                                        variant="flat"
                                                                        isLoading={isSaving}
                                                                        className="min-w-7 w-7 h-7"
                                                                        onPress={() => handleSaveScore(setting.id, student.id, editingScore.value)}
                                                                    >
                                                                        <Icon icon="solar:check-circle-bold" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    className="group flex items-center gap-2"
                                                                    onClick={() => setEditingScore({
                                                                        settingId: setting.id,
                                                                        studentId: student.id,
                                                                        value: scoreValue,
                                                                    })}
                                                                    disabled={!isCourseActive || !canUpdateExamScores}
                                                                >
                                                                    {(() => {
                                                                        const numScore = parseFloat(scoreValue);
                                                                        const percent = hasScore ? (numScore / setting.max_score) * 100 : 0;
                                                                        let colorClass = 'bg-content3 text-default-400';
                                                                        if (hasScore) {
                                                                            if (percent >= 80) colorClass = 'bg-emerald-500 text-white';
                                                                            else if (percent >= 60) colorClass = 'bg-blue-500 text-white';
                                                                            else if (percent >= 40) colorClass = 'bg-amber-500 text-white';
                                                                            else colorClass = 'bg-red-500 text-white';
                                                                        }
                                                                        return (
                                                                            <span className={`inline-flex min-w-12.5 items-center justify-center rounded-md px-2.5 py-1 text-sm font-semibold ${colorClass}`}>
                                                                                {hasScore ? parseFloat(scoreValue).toFixed(2) : "0.00"}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                    {isCourseActive && canUpdateExamScores && (
                                                                        <Icon 
                                                                            icon="solar:pen-2-linear" 
                                                                            className="text-default-400 transition-colors group-hover:text-blue-500" 
                                                                        />
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                        {filteredStudents.length === 0 && (
                                            <div className="py-8 text-center text-default-500">
                                                {isEnglish ? "No students found" : "ไม่พบนักศึกษา"}
                                            </div>
                                        )}
                                      </div>
                                    </CardBody>
                                </Card>
                                );
                            })}
                        </div>
                        </>
                    ) : (
                        <Card className="border border-default-200 bg-content1 shadow-sm">
                            <CardBody className="text-center py-12">
                                <Icon icon="solar:document-text-linear" className="mx-auto mb-3 text-4xl text-default-300" />
                                <p className="text-default-500">
                                    {isEnglish
                                        ? `${activeTab === 'midterm' ? 'Midterm' : 'Final'} exam scoring is not enabled`
                                        : `ยังไม่เปิดใช้งานสอบ${activeTab === 'midterm' ? 'กลางภาค' : 'ปลายภาค'}`}
                                </p>
                                <p className="mt-1 text-sm text-default-400">
                                    {isEnglish ? 'Click "Exam settings" to enable it.' : 'กดปุ่ม "ตั้งค่าการสอบ" เพื่อเปิดใช้งาน'}
                                </p>
                            </CardBody>
                        </Card>
                    )}
                </>
            )}

            {/* Bulk Import Modal */}
            <Modal 
                isOpen={isBulkModalOpen} 
                onClose={() => {
                    setIsBulkModalOpen(false);
                    setBulkData("");
                    setParsedBulkData([]);
                }} 
                size="3xl"
                scrollBehavior="inside"
            >
                <ModalContent>
                    <ModalHeader className="flex items-center gap-3">
                        <div className="p-2 bg-linear-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
                            <Icon icon="solar:import-bold" className="text-xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">{isEnglish ? "Import scores from Excel" : "นำเข้าคะแนนจาก Excel"}</h3>
                            <p className="text-sm font-normal text-default-500">
                                {isEnglish ? "Copy data from Excel and paste it into the field below." : "คัดลอกข้อมูลจาก Excel แล้ววางในช่องด้านล่าง"}
                            </p>
                        </div>
                    </ModalHeader>
                    <ModalBody className="space-y-4">
                        {/* Format Info */}
                        <div className="rounded-xl border border-default-200 bg-content2 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Icon icon="solar:info-circle-bold" className="text-blue-500" />
                                <span className="text-sm font-medium text-default-700">{isEnglish ? "Data format" : "รูปแบบข้อมูล"}</span>
                            </div>
                            <p className="mb-3 text-sm text-default-600">{isEnglish ? "Copy the Excel data in this column order:" : "คัดลอกข้อมูลจาก Excel โดยเรียงคอลัมน์ดังนี้:"}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                                <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700">{isEnglish ? "Column A: Student ID" : "คอลัมน์ A: รหัสนักศึกษา"}</Chip>
                                <Chip size="sm" variant="flat" className="bg-emerald-100 text-emerald-700">{isEnglish ? "Column B: Score" : "คอลัมน์ B: คะแนน"}</Chip>
                            </div>
                            <div className="flex items-start gap-2 text-xs text-default-500">
                                <Icon icon="solar:lightbulb-bolt-bold" className="text-amber-500 mt-0.5" />
                                <span>{isEnglish ? "After pasting from Excel, the system will split the data automatically." : "เมื่อคัดลอกจาก Excel แล้ววาง ระบบจะแยกข้อมูลอัตโนมัติ"}</span>
                            </div>
                        </div>

                        {/* Textarea for paste */}
                        <div className="rounded-xl border border-default-200 bg-content2 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Icon icon="solar:clipboard-list-bold" className="text-default-500" />
                                <span className="text-sm font-medium text-default-700">{isEnglish ? "Score data" : "ข้อมูลคะแนน"}</span>
                                {bulkSettingId && settings.find(s => s.id === bulkSettingId) && (
                                    <Chip size="sm" variant="flat" className="bg-purple-100 text-purple-700 ml-auto">
                                        {isEnglish ? "Max score" : "คะแนนเต็ม"}: {settings.find(s => s.id === bulkSettingId)?.max_score}
                                    </Chip>
                                )}
                            </div>
                            <textarea
                                className="h-40 w-full resize-none rounded-lg border border-default-200 bg-content1 p-3 font-mono text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder={isEnglish ? "Example: 650705010-1    85" : "ตัวอย่าง: 650705010-1    85"}
                                value={bulkData}
                                onChange={(e) => {
                                    setBulkData(e.target.value);
                                    validateBulkData(e.target.value, bulkSettingId);
                                }}
                            />
                        </div>

                        {/* Validation Results */}
                        {parsedBulkData.length > 0 && (
                            <div className="space-y-3">
                                {/* Summary Chips */}
                                <div className="flex flex-wrap gap-2">
                                    <Chip size="sm" color="success" variant="flat" startContent={<Icon icon="solar:check-circle-bold" width={14} />}>
                                        {isEnglish ? `Valid ${parsedBulkData.filter(p => p.status === "valid").length}` : `ถูกต้อง ${parsedBulkData.filter(p => p.status === "valid").length}`}
                                    </Chip>
                                    <Chip size="sm" color="danger" variant="flat" startContent={<Icon icon="solar:user-cross-bold" width={14} />}>
                                        {isEnglish ? `Not found ${parsedBulkData.filter(p => p.status === "not_found").length}` : `ไม่พบรหัส ${parsedBulkData.filter(p => p.status === "not_found").length}`}
                                    </Chip>
                                    <Chip size="sm" color="warning" variant="flat" startContent={<Icon icon="solar:danger-triangle-bold" width={14} />}>
                                        {isEnglish ? `Exceeds max ${parsedBulkData.filter(p => p.status === "score_exceeds").length}` : `คะแนนเกิน ${parsedBulkData.filter(p => p.status === "score_exceeds").length}`}
                                    </Chip>
                                    {parsedBulkData.filter(p => p.status === "invalid_score" || p.status === "negative_score").length > 0 && (
                                        <Chip size="sm" color="danger" variant="flat" startContent={<Icon icon="solar:close-circle-bold" width={14} />}>
                                            {isEnglish ? `Invalid ${parsedBulkData.filter(p => p.status === "invalid_score" || p.status === "negative_score").length}` : `คะแนนไม่ถูกต้อง ${parsedBulkData.filter(p => p.status === "invalid_score" || p.status === "negative_score").length}`}
                                        </Chip>
                                    )}
                                </div>

                                {/* Validation List */}
                                <div className="max-h-64 overflow-y-auto rounded-lg border border-default-200 divide-y divide-divider">
                                    {parsedBulkData.map((item, index) => (
                                        <div 
                                            key={index}
                                            className={`p-3 flex items-center justify-between ${
                                                item.status === "valid" ? "bg-emerald-50" :
                                                item.status === "not_found" ? "bg-red-50" :
                                                item.status === "score_exceeds" ? "bg-amber-50" :
                                                "bg-red-50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon 
                                                    icon={
                                                        item.status === "valid" ? "solar:check-circle-bold" :
                                                        item.status === "not_found" ? "solar:user-cross-bold" :
                                                        item.status === "score_exceeds" ? "solar:danger-triangle-bold" :
                                                        "solar:close-circle-bold"
                                                    }
                                                    className={`text-lg ${
                                                        item.status === "valid" ? "text-emerald-500" :
                                                        item.status === "not_found" ? "text-red-500" :
                                                        item.status === "score_exceeds" ? "text-amber-500" :
                                                        "text-red-500"
                                                    }`}
                                                />
                                                <div>
                                                    <span className="font-mono text-sm font-medium">{item.inputStudentId}</span>
                                                    <span className="mx-2 text-default-400">→</span>
                                                    <span className="font-mono text-sm">{item.inputScore || "-"}</span>
                                                </div>
                                            </div>
                                            <div className="text-right text-sm">
                                                {item.status === "valid" && item.matchedStudent && (
                                                    <span className="text-emerald-600">{item.matchedStudent.full_name}</span>
                                                )}
                                                {item.status !== "valid" && (
                                                    <span className={item.status === "score_exceeds" ? "text-amber-600" : "text-red-600"}>
                                                        {getBulkStatusText(item.status, isEnglish, settings.find(s => s.id === bulkSettingId)?.max_score)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button 
                            variant="flat"
                            className="bg-content3 text-default-600"
                            onPress={() => {
                                setIsBulkModalOpen(false);
                                setBulkData("");
                                setParsedBulkData([]);
                            }}
                        >
                            {isEnglish ? "Cancel" : "ยกเลิก"}
                        </Button>
                        <Button 
                            color="primary"
                            className="bg-linear-to-r from-blue-400 to-indigo-500 text-white shadow-md"
                            onPress={handleBulkImport}
                            isLoading={isBulkSaving}
                            isDisabled={parsedBulkData.filter(p => p.status === "valid").length === 0}
                            startContent={!isBulkSaving && <Icon icon="solar:import-bold" />}
                        >
                            {isEnglish ? "Import data" : "นำเข้าข้อมูล"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Settings Modal */}
            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} size="3xl" scrollBehavior="inside">
                <ModalContent>
                    <ModalHeader className="flex items-center gap-3">
                        <div className="p-2 bg-linear-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
                            <Icon icon="solar:settings-bold" className="text-xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">{isEnglish ? "Exam settings" : "ตั้งค่าการสอบ"}</h3>
                            <p className="text-sm font-normal text-default-500">{isEnglish ? "Configure activation, maximum score, and visibility." : "กำหนดการเปิดใช้งาน คะแนนเต็ม และการแสดงผล"}</p>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <div className="space-y-6">
                            {/* Midterm */}
                            <div>
                                <h4 className="mb-3 flex items-center gap-2 font-medium text-default-700">
                                    <Icon icon="solar:notebook-bold" className="text-blue-500" />
                                    {isEnglish ? "Midterm" : "สอบกลางภาค"}
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {(settings || []).filter(s => s.exam_type === 'midterm').map(setting => (
                                        <Card key={setting.id} className="border border-default-200 bg-content1">
                                            <CardBody className="p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <Icon 
                                                            icon={setting.component === 'lab' ? 'solar:monitor-bold' : 'solar:book-bold'}
                                                            className={setting.component === 'lab' ? 'text-emerald-500' : 'text-blue-500'}
                                                        />
                                                        <span className="font-medium">{getComponentLabel(setting.component, isEnglish)}</span>
                                                    </div>
                                                    <Switch
                                                        size="sm"
                                                        isSelected={settingsData[setting.id]?.is_active ?? setting.is_active}
                                                        onValueChange={(v) => setSettingsData(prev => ({                                                            
                                                            ...prev,
                                                            [setting.id]: { ...prev[setting.id], is_active: v }
                                                        }))}
                                                        isDisabled={!isCourseActive || !canUpdateExamSettings}
                                                    />
                                                </div>
                                                <div className="space-y-3">
                                                    <Input
                                                        type="number"
                                                        label={isEnglish ? "Max score" : "คะแนนเต็ม"}
                                                        size="sm"
                                                        variant="bordered"
                                                        value={String(settingsData[setting.id]?.max_score ?? setting.max_score)}
                                                        onValueChange={(v) => setSettingsData(prev => ({                                                            
                                                            ...prev,
                                                            [setting.id]: { ...prev[setting.id], max_score: parseFloat(v) || 0 }
                                                        }))}
                                                        isDisabled={!isCourseActive || !canUpdateExamSettings || !settingsData[setting.id]?.is_active}
                                                    />
                                                    <Checkbox
                                                        size="sm"
                                                        isSelected={settingsData[setting.id]?.is_visible ?? setting.is_visible}
                                                        onValueChange={(v) => setSettingsData(prev => ({                                                            
                                                            ...prev,
                                                            [setting.id]: { ...prev[setting.id], is_visible: v }
                                                        }))}
                                                        isDisabled={!isCourseActive || !canUpdateExamSettings || !settingsData[setting.id]?.is_active}
                                                    >
                                                        <span className="text-sm">{isEnglish ? "Allow students to view scores" : "เปิดให้นักศึกษาดูคะแนน"}</span>
                                                    </Checkbox>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    ))}
                                </div>
                            </div>

                            {/* Final */}
                            <div>
                                <h4 className="mb-3 flex items-center gap-2 font-medium text-default-700">
                                    <Icon icon="solar:notebook-bold" className="text-indigo-500" />
                                    {isEnglish ? "Final" : "สอบปลายภาค"}
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {(settings || []).filter(s => s.exam_type === 'final').map(setting => (
                                        <Card key={setting.id} className="border border-default-200 bg-content1">
                                            <CardBody className="p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <Icon 
                                                            icon={setting.component === 'lab' ? 'solar:monitor-bold' : 'solar:book-bold'}
                                                            className={setting.component === 'lab' ? 'text-emerald-500' : 'text-blue-500'}
                                                        />
                                                        <span className="font-medium">{getComponentLabel(setting.component, isEnglish)}</span>
                                                    </div>
                                                    <Switch
                                                        size="sm"
                                                        isSelected={settingsData[setting.id]?.is_active ?? setting.is_active}
                                                        onValueChange={(v) => setSettingsData(prev => ({                                                            
                                                            ...prev,
                                                            [setting.id]: { ...prev[setting.id], is_active: v }
                                                        }))}
                                                        isDisabled={!isCourseActive || !canUpdateExamSettings}
                                                    />
                                                </div>
                                                <div className="space-y-3">
                                                    <Input
                                                        type="number"
                                                        label={isEnglish ? "Max score" : "คะแนนเต็ม"}
                                                        size="sm"
                                                        variant="bordered"
                                                        value={String(settingsData[setting.id]?.max_score ?? setting.max_score)}
                                                        onValueChange={(v) => setSettingsData(prev => ({                                                            
                                                            ...prev,
                                                            [setting.id]: { ...prev[setting.id], max_score: parseFloat(v) || 0 }
                                                        }))}
                                                        isDisabled={!isCourseActive || !canUpdateExamSettings || !settingsData[setting.id]?.is_active}
                                                    />
                                                    <Checkbox
                                                        size="sm"
                                                        isSelected={settingsData[setting.id]?.is_visible ?? setting.is_visible}
                                                        onValueChange={(v) => setSettingsData(prev => ({                                                            
                                                            ...prev,
                                                            [setting.id]: { ...prev[setting.id], is_visible: v }
                                                        }))}
                                                        isDisabled={!isCourseActive || !canUpdateExamSettings || !settingsData[setting.id]?.is_active}
                                                    >
                                                        <span className="text-sm">{isEnglish ? "Allow students to view scores" : "เปิดให้นักศึกษาดูคะแนน"}</span>
                                                    </Checkbox>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setIsSettingsModalOpen(false)}>
                            {isEnglish ? "Cancel" : "ยกเลิก"}
                        </Button>
                        <Button 
                            color="primary" 
                            onPress={handleSaveSettings}
                            isLoading={isSaving}
                            isDisabled={!isCourseActive || !canUpdateExamSettings}
                        >
                            {isEnglish ? "Save" : "บันทึก"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}