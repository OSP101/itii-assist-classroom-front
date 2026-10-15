"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { ScoresSkeleton } from "../Skeletons";
import examScoreService, {
    type ExamScore,
    type ExamScoreWithSetting,
    type Student,
    getExamLifecycleStage,
    isAbsentInput,
} from "@/services/examScore.service";
import { parseScoreInput } from "@/lib/score-input";
import ExamLifecycleRow from "./ExamLifecycleRow";
import ExamScoreTable from "./ExamScoreTable";
import ExamBulkImportModal from "./ExamBulkImportModal";
import ExamSettingsModal from "./ExamSettingsModal";
import ExamHideModal from "./ExamHideModal";
import ExamViewersDrawer from "./ExamViewersDrawer";
import ExamPublishHistoryModal from "./ExamPublishHistoryModal";
import { formatScore, shortExamName, summarizeSetting } from "./examScoreUtils";

interface ExamScoresTabProps {
    courseId: string;
    isCourseActive?: boolean;
    canCreateExamScores?: boolean;
    canUpdateExamScores?: boolean;
    canUpdateExamSettings?: boolean;
}

type ScoreMap = Record<number, Record<number, ExamScore>>;

/**
 * แบบ B: every exam component starts as a draft, goes through a review page,
 * and only then becomes visible to students. The page leads with "what
 * students can see right now" so an instructor never has to guess.
 */
export default function ExamScoresTab({
    courseId,
    isCourseActive = true,
    canCreateExamScores = false,
    canUpdateExamScores = false,
    canUpdateExamSettings = false,
}: ExamScoresTabProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [settings, setSettings] = useState<ExamScoreWithSetting[]>([]);
    const [scoreMap, setScoreMap] = useState<ScoreMap>({});
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const [settingsModal, setSettingsModal] = useState<{ open: boolean; focusId: number | null }>({ open: false, focusId: null });
    const [bulkSetting, setBulkSetting] = useState<ExamScoreWithSetting | null>(null);
    const [hideSetting, setHideSetting] = useState<ExamScoreWithSetting | null>(null);
    const [isHiding, setIsHiding] = useState(false);
    const [viewersSetting, setViewersSetting] = useState<ExamScoreWithSetting | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const canEditScores = isCourseActive && canUpdateExamScores;
    const canImport = isCourseActive && canCreateExamScores;
    const canPublish = isCourseActive && canUpdateExamSettings;

    const loadData = useCallback(async () => {
        try {
            const data = await examScoreService.getExamScores(courseId);
            setStudents(data.students);
            setSettings(data.settings);
            const map: ScoreMap = {};
            for (const s of data.settings) {
                map[s.id] = {};
                for (const score of s.scores ?? []) map[s.id][score.student_id] = score;
            }
            setScoreMap(map);
        } catch (error) {
            console.error("Failed to load exam data:", error);
            addToast({ title: isEnglish ? "Unable to load exam data" : "ไม่สามารถโหลดข้อมูลได้", color: "danger", timeout: 3000 });
        } finally {
            setIsLoading(false);
        }
    }, [courseId, isEnglish]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const filteredStudents = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return students;
        return students.filter((s) => s.student_id.toLowerCase().includes(q) || s.full_name.toLowerCase().includes(q));
    }, [students, searchQuery]);

    const summaries = useMemo(() => {
        const out: Record<number, ReturnType<typeof summarizeSetting>> = {};
        for (const s of settings) out[s.id] = summarizeSetting(students, scoreMap[s.id]);
        return out;
    }, [settings, students, scoreMap]);

    const activeSettings = settings.filter((s) => s.is_active);
    const visibleSettings = activeSettings.filter((s) => s.is_visible);

    const handleSaveScore = async (settingId: number, studentId: number, rawValue: string, comment: string): Promise<boolean> => {
        const setting = settings.find((s) => s.id === settingId);
        if (!setting || !canEditScores) return false;
        const trimmed = rawValue.trim();
        const isAbsent = isAbsentInput(trimmed);
        let score: number | null = null;
        if (!isAbsent && trimmed !== "") {
            const parsed = parseScoreInput(trimmed);
            if (parsed === null) {
                addToast({ title: isEnglish ? "Invalid score" : "คะแนนไม่ถูกต้อง", color: "danger", timeout: 3000 });
                return false;
            }
            if (parsed < 0) {
                addToast({ title: isEnglish ? "Score cannot be negative" : "คะแนนต้องไม่ติดลบ", color: "danger", timeout: 3000 });
                return false;
            }
            if (parsed > setting.max_score) {
                addToast({ title: isEnglish ? `Score exceeds max score (${formatScore(setting.max_score)})` : `คะแนนเกินคะแนนเต็ม (${formatScore(setting.max_score)})`, color: "danger", timeout: 3000 });
                return false;
            }
            score = parsed;
        }
        setIsSaving(true);
        try {
            const saved = await examScoreService.saveExamScore(courseId, { exam_setting_id: settingId, student_id: studentId, score, is_absent: isAbsent, comment });
            setScoreMap((prev) => ({ ...prev, [settingId]: { ...prev[settingId], [studentId]: saved } }));
            return true;
        } catch (error: any) {
            addToast({ title: isEnglish ? "Unable to save the score" : (error?.response?.data?.message || "บันทึกไม่สำเร็จ"), color: "danger", timeout: 3000 });
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleHide = async (reason: string, notifyViewers: boolean) => {
        if (!hideSetting) return;
        setIsHiding(true);
        try {
            const result = await examScoreService.hide(courseId, hideSetting.id, { reason, notify_viewers: notifyViewers });
            addToast({ title: result.message || (isEnglish ? "Done" : "เรียบร้อย"), color: "success", timeout: 3000 });
            setHideSetting(null);
            await loadData();
        } catch (error: any) {
            addToast({ title: isEnglish ? "Unable to hide scores" : (error?.response?.data?.message || "ซ่อนคะแนนไม่สำเร็จ"), color: "danger", timeout: 3000 });
        } finally {
            setIsHiding(false);
        }
    };

    if (isLoading) return <ScoresSkeleton />;

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{isEnglish ? "Exam scores" : "คะแนนสอบ"}</h2>
                    <p className="text-sm text-default-500">
                        {isEnglish ? "Every item starts as a draft. Students only see items that passed review and were published." : "ทุกรายการเริ่มเป็นร่าง นักศึกษาจะเห็นเฉพาะรายการที่ผ่านการตรวจทานและประกาศแล้ว"}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="bordered" startContent={<Icon icon="solar:settings-linear" width={18} />} onPress={() => setSettingsModal({ open: true, focusId: null })}>
                        {isEnglish ? "Max scores and items" : "คะแนนเต็มและรายการสอบ"}
                    </Button>
                    <Button variant="bordered" startContent={<Icon icon="solar:history-linear" width={18} />} onPress={() => setIsHistoryOpen(true)}>
                        {isEnglish ? "Publish history" : "ประวัติการประกาศ"}
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-default-200 bg-content1 px-4 py-3">
                <span className="text-xs font-medium text-default-500">{isEnglish ? "What students see right now" : "สิ่งที่นักศึกษาเห็นตอนนี้"}</span>
                {activeSettings.length === 0 && (
                    <span className="text-xs text-default-400">{isEnglish ? "No exam items enabled yet" : "ยังไม่เปิดใช้รายการสอบ"}</span>
                )}
                {activeSettings.map((s) => s.is_visible ? (
                    <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-1 text-xs font-medium text-success-800 dark:bg-success-500/20 dark:text-success-200">
                        <Icon icon="solar:eye-linear" width={14} />
                        {shortExamName(s, isEnglish)}
                    </span>
                ) : (
                    <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-default-100 px-2.5 py-1 text-xs font-medium text-default-600">
                        <Icon icon="solar:eye-closed-linear" width={14} />
                        {shortExamName(s, isEnglish)} {isEnglish ? "hidden" : "ยังมองไม่เห็น"}
                    </span>
                ))}
                {activeSettings.length > 0 && visibleSettings.length === 0 && (
                    <span className="text-xs text-default-400">{isEnglish ? "(nothing is visible to students yet)" : "(ยังไม่มีรายการไหนที่นักศึกษาเห็น)"}</span>
                )}
            </div>

            {activeSettings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-default-300 bg-content1/60 px-6 py-14 text-center">
                    <Icon icon="solar:document-add-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                    <h3 className="mb-1 text-base font-semibold text-default-700">{isEnglish ? "Exam scoring is not enabled yet" : "ยังไม่เปิดใช้งานการสอบ"}</h3>
                    <p className="mx-auto mb-5 max-w-md text-sm text-default-500">
                        {isEnglish ? "Enable the exam items you grade and set a max score for each. Nothing is shown to students until you publish." : "เปิดใช้รายการสอบที่ต้องการและกำหนดคะแนนเต็ม นักศึกษาจะยังไม่เห็นอะไรจนกว่าจะกดประกาศ"}
                    </p>
                    {canPublish && (
                        <Button color="primary" onPress={() => setSettingsModal({ open: true, focusId: null })}>{isEnglish ? "Set up exam items" : "ตั้งค่ารายการสอบ"}</Button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {settings.map((setting) => {
                        const stage = getExamLifecycleStage(setting);
                        const isExpanded = expandedId === setting.id;
                        return (
                            <ExamLifecycleRow
                                key={setting.id}
                                setting={setting}
                                stage={stage}
                                summary={summaries[setting.id]}
                                isExpanded={isExpanded}
                                isEnglish={isEnglish}
                                canImport={canImport}
                                canPublish={canPublish}
                                canEnable={canPublish}
                                onToggle={() => setExpandedId(isExpanded ? null : setting.id)}
                                onImport={() => setBulkSetting(setting)}
                                onReview={() => router.push(`/classroom/${courseId}/exam-scores/${setting.id}/review`)}
                                onViewers={() => setViewersSetting(setting)}
                                onHide={() => setHideSetting(setting)}
                                onEnable={() => setSettingsModal({ open: true, focusId: setting.id })}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                                    <Input
                                        size="sm"
                                        variant="bordered"
                                        className="w-full sm:max-w-xs"
                                        placeholder={isEnglish ? "Search by student ID or name" : "ค้นหารหัสหรือชื่อนักศึกษา"}
                                        aria-label={isEnglish ? "Search students" : "ค้นหานักศึกษา"}
                                        value={searchQuery}
                                        onValueChange={setSearchQuery}
                                        startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                                        isClearable
                                    />
                                    <p className="text-xs text-default-500">
                                        {summaries[setting.id].average !== null
                                            ? (isEnglish
                                                ? `Average ${formatScore(summaries[setting.id].average)} from ${summaries[setting.id].scored} students who sat the exam. Max ${formatScore(summaries[setting.id].max)}, min ${formatScore(summaries[setting.id].min)}`
                                                : `เฉลี่ย ${formatScore(summaries[setting.id].average)} คิดจาก ${summaries[setting.id].scored} คนที่เข้าสอบ สูงสุด ${formatScore(summaries[setting.id].max)} ต่ำสุด ${formatScore(summaries[setting.id].min)}`)
                                            : (isEnglish ? "No scores yet" : "ยังไม่มีคะแนน")}
                                    </p>
                                </div>
                                <ExamScoreTable
                                    setting={setting}
                                    students={filteredStudents}
                                    scores={scoreMap[setting.id]}
                                    canEdit={canEditScores}
                                    isSaving={isSaving}
                                    isEnglish={isEnglish}
                                    onSave={(studentId, raw, comment) => handleSaveScore(setting.id, studentId, raw, comment)}
                                />
                            </ExamLifecycleRow>
                        );
                    })}
                </div>
            )}

            <ExamSettingsModal
                courseId={courseId}
                settings={settings}
                isOpen={settingsModal.open}
                focusSettingId={settingsModal.focusId}
                canEdit={canPublish}
                isEnglish={isEnglish}
                onClose={() => setSettingsModal({ open: false, focusId: null })}
                onSaved={loadData}
            />
            <ExamBulkImportModal
                courseId={courseId}
                setting={bulkSetting}
                students={students}
                isOpen={bulkSetting !== null}
                isEnglish={isEnglish}
                onClose={() => setBulkSetting(null)}
                onImported={loadData}
            />
            <ExamHideModal
                isOpen={hideSetting !== null}
                setting={hideSetting}
                totalStudents={students.length}
                isSubmitting={isHiding}
                isEnglish={isEnglish}
                onClose={() => setHideSetting(null)}
                onConfirm={(reason, notify) => void handleHide(reason, notify)}
            />
            <ExamViewersDrawer
                courseId={courseId}
                setting={viewersSetting}
                isOpen={viewersSetting !== null}
                canRemind={canPublish}
                isEnglish={isEnglish}
                onClose={() => {
                    setViewersSetting(null);
                    void loadData();
                }}
            />
            <ExamPublishHistoryModal courseId={courseId} isOpen={isHistoryOpen} isEnglish={isEnglish} onClose={() => setIsHistoryOpen(false)} />
        </div>
    );
}
