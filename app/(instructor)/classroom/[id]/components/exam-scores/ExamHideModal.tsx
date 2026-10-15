"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Icon } from "@iconify/react";
import type { ExamScoreWithSetting } from "@/services/examScore.service";
import { HIDE_REASONS, shortExamName } from "./examScoreUtils";

interface ExamHideModalProps {
    isOpen: boolean;
    setting: ExamScoreWithSetting | null;
    totalStudents: number;
    isSubmitting: boolean;
    isEnglish: boolean;
    onClose: () => void;
    onConfirm: (reason: string, notifyViewers: boolean) => void;
}

/**
 * B4: confirm before hiding published scores. Tells the instructor how many
 * students have already seen the score, keeps the scores themselves, and
 * optionally emails the students who saw it.
 */
export default function ExamHideModal({ isOpen, setting, totalStudents, isSubmitting, isEnglish, onClose, onConfirm }: ExamHideModalProps) {
    const [reasonKey, setReasonKey] = useState<string>(HIDE_REASONS[0].key);
    const [notifyViewers, setNotifyViewers] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setReasonKey(HIDE_REASONS[0].key);
            setNotifyViewers(false);
        }
    }, [isOpen]);

    if (!setting) return null;
    const viewed = setting.viewed_count ?? 0;
    const isScheduledOnly = !setting.is_visible && !!setting.scheduled_publish_at;
    const reasonText = HIDE_REASONS.find((r) => r.key === reasonKey);
    const name = shortExamName(setting, isEnglish);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300">
                        <Icon icon="solar:eye-closed-linear" width={22} />
                    </span>
                    <div>
                        <h3 className="text-lg font-semibold">
                            {isScheduledOnly
                                ? (isEnglish ? `Cancel scheduled publish: ${name}` : `ยกเลิกการตั้งเวลาประกาศ ${name}`)
                                : (isEnglish ? `Hide scores: ${name}` : `ซ่อนคะแนน ${name}`)}
                        </h3>
                        <p className="text-sm font-normal text-default-500">
                            {isScheduledOnly
                                ? (isEnglish ? "The scores will stay a draft until you publish them again." : "คะแนนจะคงเป็นร่างจนกว่าจะกดประกาศใหม่")
                                : (isEnglish ? "Students stop seeing this score immediately and the item goes back to the review step." : "นักศึกษาจะมองไม่เห็นคะแนนนี้ทันที และรายการจะกลับไปอยู่ขั้นตรวจทาน")}
                        </p>
                    </div>
                </ModalHeader>
                <ModalBody className="gap-3">
                    {!isScheduledOnly && (
                        <>
                            <div className="flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 p-3 dark:border-warning-500/30 dark:bg-warning-500/10">
                                <Icon icon="solar:danger-triangle-linear" className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400" width={20} />
                                <div className="text-sm">
                                    <p className="font-medium text-warning-800 dark:text-warning-200">
                                        {isEnglish ? `${viewed} of ${totalStudents} students have already opened this score` : `มีนักศึกษา ${viewed} จาก ${totalStudents} คนเปิดดูคะแนนนี้ไปแล้ว`}
                                    </p>
                                    <p className="mt-0.5 text-warning-700 dark:text-warning-300">
                                        {isEnglish ? "Students who already saw it will now see that the instructor has temporarily withdrawn the score." : "คนที่ดูไปแล้วจะเห็นว่าอาจารย์ปิดการแสดงคะแนนชั่วคราว แทนตัวเลขเดิม"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 rounded-xl bg-content2 p-3">
                                <Icon icon="solar:info-circle-linear" className="mt-0.5 shrink-0 text-default-500" width={20} />
                                <div className="text-sm">
                                    <p className="font-medium">{isEnglish ? "Entered scores are kept" : "คะแนนที่กรอกไว้ไม่หาย"}</p>
                                    <p className="mt-0.5 text-default-500">
                                        {isEnglish ? "Keep editing as usual and publish again when ready. No email is sent when hiding unless you choose to below." : "แก้ไขต่อได้ตามปกติ และประกาศใหม่ได้เมื่อพร้อม ระบบจะไม่ส่งอีเมลตอนซ่อน เว้นแต่จะเลือกด้านล่าง"}
                                    </p>
                                </div>
                            </div>
                            <Select
                                label={isEnglish ? "Reason (kept in history, not sent to students)" : "เหตุผลที่ซ่อน (บันทึกในประวัติ ไม่ส่งถึงนักศึกษา)"}
                                variant="bordered"
                                selectedKeys={[reasonKey]}
                                onSelectionChange={(keys) => {
                                    const key = Array.from(keys)[0];
                                    if (typeof key === "string") setReasonKey(key);
                                }}
                                disallowEmptySelection
                            >
                                {HIDE_REASONS.map((r) => (
                                    <SelectItem key={r.key}>{isEnglish ? r.en : r.th}</SelectItem>
                                ))}
                            </Select>
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-default-200 p-3">
                                <div className="text-sm">
                                    <p className="font-medium">{isEnglish ? `Email the ${viewed} students who already saw it` : `แจ้งนักศึกษาที่เปิดดูแล้ว ${viewed} คนทางอีเมล`}</p>
                                    <p className="text-default-500">{isEnglish ? "A neutral system message; the reason is not included." : "ข้อความกลางของระบบ ไม่ระบุเหตุผล"}</p>
                                </div>
                                <Switch size="sm" isSelected={notifyViewers} onValueChange={setNotifyViewers} isDisabled={viewed === 0} aria-label={isEnglish ? "Email viewers" : "แจ้งนักศึกษาที่ดูแล้ว"} />
                            </div>
                        </>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="bordered" onPress={onClose} isDisabled={isSubmitting}>{isEnglish ? "Cancel" : "ยกเลิก"}</Button>
                    <Button
                        color="warning"
                        className="font-semibold text-white"
                        isLoading={isSubmitting}
                        onPress={() => onConfirm(isScheduledOnly ? "" : (reasonText ? reasonText.th : ""), notifyViewers)}
                    >
                        {isScheduledOnly
                            ? (isEnglish ? "Cancel schedule" : "ยกเลิกการตั้งเวลา")
                            : (isEnglish ? "Hide from students" : "ซ่อนคะแนนจากนักศึกษา")}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
