"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Switch } from "@heroui/switch";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import examScoreService, { type ExamScoreWithSetting, getExamTypeLabel } from "@/services/examScore.service";
import { componentTitle, formatScore } from "./examScoreUtils";

interface ExamSettingsModalProps {
    courseId: string;
    settings: ExamScoreWithSetting[];
    isOpen: boolean;
    canEdit: boolean;
    isEnglish: boolean;
    focusSettingId?: number | null;
    onClose: () => void;
    onSaved: () => Promise<void> | void;
}

interface Draft {
    is_active: boolean;
    max_score: string;
}

/**
 * Max score and enable/disable only. Visibility used to be a checkbox in
 * this dialog; it now lives in the publish flow so saving a max score can
 * never reveal scores by accident.
 */
export default function ExamSettingsModal({ courseId, settings, isOpen, canEdit, isEnglish, focusSettingId, onClose, onSaved }: ExamSettingsModalProps) {
    const [drafts, setDrafts] = useState<Record<number, Draft>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const next: Record<number, Draft> = {};
        for (const s of settings) {
            next[s.id] = { is_active: focusSettingId === s.id ? true : s.is_active, max_score: formatScore(s.max_score) };
        }
        setDrafts(next);
    }, [isOpen, settings, focusSettingId]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            for (const s of settings) {
                const draft = drafts[s.id];
                if (!draft) continue;
                const maxScore = parseFloat(draft.max_score);
                const changed = draft.is_active !== s.is_active || (Number.isFinite(maxScore) && maxScore !== s.max_score);
                if (!changed) continue;
                if (draft.is_active && (!Number.isFinite(maxScore) || maxScore <= 0)) {
                    addToast({ title: isEnglish ? `Set a max score for ${getExamTypeLabel(s.exam_type, true)} ${s.component}` : `กรุณากำหนดคะแนนเต็มของ${getExamTypeLabel(s.exam_type)} ${componentTitle(s, false)}`, color: "warning", timeout: 3000 });
                    setIsSaving(false);
                    return;
                }
                await examScoreService.updateExamSetting(courseId, s.id, {
                    is_active: draft.is_active,
                    max_score: Number.isFinite(maxScore) ? maxScore : s.max_score,
                });
            }
            addToast({ title: isEnglish ? "Exam settings saved" : "บันทึกการตั้งค่าแล้ว", color: "success", timeout: 2500 });
            await onSaved();
            onClose();
        } catch (error: any) {
            addToast({ title: isEnglish ? "Unable to save exam settings" : (error?.response?.data?.message || "บันทึกไม่สำเร็จ"), color: "danger", timeout: 3000 });
        } finally {
            setIsSaving(false);
        }
    };

    const group = (examType: "midterm" | "final") => (
        <div>
            <h4 className="mb-2 text-sm font-semibold text-default-700">{isEnglish ? `${getExamTypeLabel(examType, true)} exam` : `สอบ${getExamTypeLabel(examType)}`}</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {settings.filter((s) => s.exam_type === examType).map((s) => {
                    const draft = drafts[s.id];
                    if (!draft) return null;
                    return (
                        <div key={s.id} className={`rounded-xl border p-4 ${draft.is_active ? "border-default-200 bg-content1" : "border-dashed border-default-300 bg-content2/50"}`}>
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 text-sm font-medium">
                                    <Icon icon={s.component === "lab" ? "solar:monitor-linear" : "solar:book-2-linear"} className={s.component === "lab" ? "text-success" : "text-primary"} width={18} />
                                    {componentTitle(s, isEnglish)}
                                </span>
                                <Switch
                                    size="sm"
                                    isSelected={draft.is_active}
                                    isDisabled={!canEdit}
                                    aria-label={isEnglish ? "Enable" : "เปิดใช้"}
                                    onValueChange={(v) => setDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], is_active: v } }))}
                                />
                            </div>
                            <Input
                                type="number"
                                size="sm"
                                variant="bordered"
                                label={isEnglish ? "Max score" : "คะแนนเต็ม"}
                                value={draft.max_score}
                                min={0}
                                step="0.5"
                                isDisabled={!canEdit || !draft.is_active}
                                onValueChange={(v) => setDrafts((prev) => ({ ...prev, [s.id]: { ...prev[s.id], max_score: v } }))}
                            />
                            {s.is_visible && (
                                <p className="mt-2 text-xs text-success-700 dark:text-success-400">
                                    {isEnglish ? "Published. Changing the max score does not hide it." : "ประกาศแล้ว การแก้คะแนนเต็มไม่ทำให้คะแนนถูกซ่อน"}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-content2 text-default-600">
                        <Icon icon="solar:settings-linear" width={22} />
                    </span>
                    <div>
                        <h3 className="text-lg font-semibold">{isEnglish ? "Max scores and exam items" : "คะแนนเต็มและรายการสอบ"}</h3>
                        <p className="text-sm font-normal text-default-500">
                            {isEnglish ? "Enable the items you grade and set each max score. Publishing to students is a separate step." : "เปิดใช้รายการที่ต้องการและกำหนดคะแนนเต็ม การประกาศให้นักศึกษาเห็นเป็นอีกขั้นตอนหนึ่ง"}
                        </p>
                    </div>
                </ModalHeader>
                <ModalBody className="gap-5">
                    {group("midterm")}
                    {group("final")}
                </ModalBody>
                <ModalFooter>
                    <Button variant="bordered" onPress={onClose} isDisabled={isSaving}>{isEnglish ? "Cancel" : "ยกเลิก"}</Button>
                    <Button color="primary" className="font-semibold" onPress={() => void handleSave()} isLoading={isSaving} isDisabled={!canEdit}>{isEnglish ? "Save" : "บันทึก"}</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
