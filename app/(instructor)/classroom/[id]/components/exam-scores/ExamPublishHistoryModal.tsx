"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Spinner } from "@heroui/spinner";
import { Icon } from "@iconify/react";
import examScoreService, { type ExamPublishHistoryEntry } from "@/services/examScore.service";
import { formatDateTime, shortExamName } from "./examScoreUtils";

interface ExamPublishHistoryModalProps {
    courseId: string;
    isOpen: boolean;
    isEnglish: boolean;
    onClose: () => void;
}

function actionMeta(action: string, isEnglish: boolean): { label: string; icon: string; cls: string } {
    switch (action) {
        case "publish_exam_scores":
            return { label: isEnglish ? "Published" : "ประกาศคะแนน", icon: "solar:eye-linear", cls: "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-300" };
        case "schedule_exam_scores_publish":
            return { label: isEnglish ? "Scheduled" : "ตั้งเวลาประกาศ", icon: "solar:clock-circle-linear", cls: "bg-primary-100 text-primary dark:bg-primary-500/20" };
        case "cancel_exam_scores_schedule":
            return { label: isEnglish ? "Schedule cancelled" : "ยกเลิกการตั้งเวลา", icon: "solar:close-circle-linear", cls: "bg-default-100 text-default-600" };
        case "hide_exam_scores":
            return { label: isEnglish ? "Hidden" : "ซ่อนคะแนน", icon: "solar:eye-closed-linear", cls: "bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300" };
        case "remind_exam_scores":
            return { label: isEnglish ? "Reminder sent" : "ส่งอีเมลเตือน", icon: "solar:letter-linear", cls: "bg-default-100 text-default-600" };
        default:
            return { label: action, icon: "solar:history-linear", cls: "bg-default-100 text-default-600" };
    }
}

function detailLine(entry: ExamPublishHistoryEntry, isEnglish: boolean): string {
    const d = entry.detail ?? {};
    const parts: string[] = [];
    if (entry.action === "publish_exam_scores") {
        if (typeof d.scored_count === "number") parts.push(isEnglish ? `${d.scored_count} scored` : `มีคะแนน ${d.scored_count}`);
        if (typeof d.absent_count === "number" && d.absent_count > 0) parts.push(isEnglish ? `${d.absent_count} absent` : `ไม่มาสอบ ${d.absent_count}`);
        if (typeof d.missing_count === "number" && d.missing_count > 0) parts.push(isEnglish ? `${d.missing_count} missing` : `ยังไม่กรอก ${d.missing_count}`);
        parts.push(d.send_email ? (isEnglish ? "email sent" : "ส่งอีเมล") : (isEnglish ? "no email" : "ไม่ส่งอีเมล"));
        if (d.scheduled) parts.push(isEnglish ? "by schedule" : "ตามเวลาที่ตั้งไว้");
    } else if (entry.action === "schedule_exam_scores_publish" && typeof d.scheduled_at === "string") {
        parts.push(`${isEnglish ? "at" : "เวลา"} ${formatDateTime(d.scheduled_at, isEnglish)}`);
    } else if (entry.action === "hide_exam_scores") {
        if (typeof d.reason === "string" && d.reason) parts.push(d.reason);
        if (typeof d.viewed_count === "number") parts.push(isEnglish ? `${d.viewed_count} had viewed` : `ดูไปแล้ว ${d.viewed_count} คน`);
    } else if (entry.action === "remind_exam_scores" && typeof d.count === "number") {
        parts.push(isEnglish ? `${d.count} students` : `${d.count} คน`);
    }
    return parts.join(" ");
}

export default function ExamPublishHistoryModal({ courseId, isOpen, isEnglish, onClose }: ExamPublishHistoryModalProps) {
    const [entries, setEntries] = useState<ExamPublishHistoryEntry[] | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setEntries(null);
        examScoreService.getPublishHistory(courseId).then(setEntries).catch(() => setEntries([]));
    }, [isOpen, courseId]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-0.5">
                    <h3 className="text-lg font-semibold">{isEnglish ? "Publish history" : "ประวัติการประกาศ"}</h3>
                    <p className="text-sm font-normal text-default-500">{isEnglish ? "Every publish, schedule, hide and reminder, with who did it and when." : "ทุกการประกาศ ตั้งเวลา ซ่อน และส่งเตือน พร้อมชื่อผู้กดและเวลา"}</p>
                </ModalHeader>
                <ModalBody>
                    {entries === null ? (
                        <div className="flex justify-center py-10"><Spinner /></div>
                    ) : entries.length === 0 ? (
                        <p className="py-10 text-center text-sm text-default-500">{isEnglish ? "Nothing has been published yet." : "ยังไม่มีประวัติการประกาศ"}</p>
                    ) : (
                        <ol className="divide-y divide-divider">
                            {entries.map((entry) => {
                                const meta = actionMeta(entry.action, isEnglish);
                                const detail = detailLine(entry, isEnglish);
                                return (
                                    <li key={entry.id} className="flex items-start gap-3 py-3">
                                        <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.cls}`}>
                                            <Icon icon={meta.icon} width={18} />
                                        </span>
                                        <div className="min-w-0 flex-1 text-sm">
                                            <p className="font-medium">
                                                {meta.label}
                                                {entry.exam_type && entry.component && (
                                                    <span className="ml-1 font-normal text-default-600">{shortExamName({ exam_type: entry.exam_type, component: entry.component }, isEnglish)}</span>
                                                )}
                                            </p>
                                            {detail && <p className="text-xs text-default-500">{detail}</p>}
                                            <p className="text-xs text-default-400">{formatDateTime(entry.created_at, isEnglish)} {isEnglish ? "by" : "โดย"} {entry.actor_name || "-"}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="bordered" onPress={onClose}>{isEnglish ? "Close" : "ปิด"}</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
