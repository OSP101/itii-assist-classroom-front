"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Icon } from "@iconify/react";
import type { QueueSession } from "@/services/queue.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";

interface QueueCreatedModalProps {
    session: QueueSession | null;
    courseId: string;
    roomLabel?: string;
    /** Set when "open now" was chosen but the queue could not start. */
    startProblem?: string | null;
    onClose: () => void;
}

function QueueCreatedModalComponent({ session, courseId, roomLabel, startProblem, onClose }: QueueCreatedModalProps) {
    const router = useRouter();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const t = (th: string, en: string) => (isEnglish ? en : th);
    const [feedback, setFeedback] = useState("");
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => {
        setFeedback("");
    }, [session]);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    if (!session) return null;

    const isOpen = session.status === "active";
    const pin = session.pin_code || "";
    const say = (text: string) => {
        setFeedback(text);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setFeedback(""), 4000);
    };
    const copyPin = async () => {
        try {
            await navigator.clipboard.writeText(pin);
            say(t("คัดลอก PIN แล้ว", "PIN copied"));
        } catch {
            say(t("คัดลอกไม่สำเร็จ", "Couldn't copy"));
        }
    };
    const openProjector = () => window.open(`/queue/projector/${session.id}`, "_blank", "noopener");
    const goWorker = () => {
        onClose();
        router.push(`/classroom/${courseId}/queue/${session.id}/worker`);
    };

    const tone = isOpen
        ? { icon: "bg-emerald-600", banner: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100", dot: "bg-emerald-500 ring-[5px] ring-emerald-500/20" }
        : { icon: "bg-indigo-600", banner: "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100", dot: "bg-indigo-500" };

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="2xl"
            placement="center"
            scrollBehavior="inside"
            hideCloseButton
            classNames={{
                wrapper: "overflow-hidden",
                base: "!m-0 h-full max-h-full w-full max-w-full !rounded-none sm:!m-6 sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:max-w-2xl sm:!rounded-2xl",
            }}
        >
            <ModalContent className="flex flex-col overflow-hidden bg-content1 text-foreground">
                <ModalHeader className="flex shrink-0 items-center gap-4 px-4 pb-3 pt-5 sm:px-7 sm:pt-6">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white sm:h-14 sm:w-14 ${tone.icon}`}>
                        <Icon icon="solar:check-read-linear" className="text-3xl" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-semibold leading-tight text-foreground sm:text-[1.375rem]">
                            {isOpen ? t("สร้างและเปิดคิวแล้ว", "Queue created and open") : t("สร้างคิวแล้ว", "Queue created")}
                        </h2>
                        <p className="mt-0.5 break-words text-sm font-normal text-default-600">{session.title}</p>
                    </div>
                    <Button isIconOnly variant="light" className="h-11 w-11 min-w-11 shrink-0 text-default-600" aria-label={t("ปิด", "Close")} onPress={onClose}>
                        <Icon icon="solar:close-circle-linear" className="text-2xl" aria-hidden="true" />
                    </Button>
                </ModalHeader>

                <ModalBody className="min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-5 pt-1 sm:px-7">
                    <div role="status" className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 ${tone.banner}`}>
                        <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${tone.dot}`} />
                        <span>
                            <span className="block text-base font-semibold">{isOpen ? t("เปิดให้จองแล้ว", "Open for booking") : t("เก็บเป็นฉบับร่าง", "Saved as a draft")}</span>
                            <span className="text-sm">
                                {isOpen
                                    ? t("นักศึกษาจองได้ด้วย PIN ด้านล่าง เปิดจอฉายเพื่อแสดง QR และลำดับคิวในห้อง", "Students book with the PIN below. Open the projector view to show the QR and the queue in the room.")
                                    : t("นักศึกษายังจองไม่ได้ กดเริ่มคิวจากรายการเมื่อพร้อม", "Students can't book yet. Start it from the list when you're ready.")}
                            </span>
                        </span>
                    </div>

                    {startProblem && (
                        <div className="flex flex-col gap-0.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm leading-relaxed text-amber-900 sm:flex-row sm:gap-2.5 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                            <b className="shrink-0 font-semibold">{t("ยังไม่ได้เปิด", "Not opened")}</b>
                            <span>{startProblem}</span>
                        </div>
                    )}

                    {roomLabel && (
                        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-2xl border border-default-200 px-4 py-3.5 text-sm leading-relaxed">
                            <dt className="text-default-600">{t("ห้อง", "Room")}</dt>
                            <dd className="font-medium text-foreground">{roomLabel}</dd>
                        </dl>
                    )}

                    {pin && (
                        <div className="flex flex-col gap-3 rounded-2xl border border-default-200 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[0.9375rem] font-semibold">{t("รหัส PIN สำหรับจองคิว", "Booking PIN")}</span>
                                {!isOpen && <span className="rounded-full bg-default-100 px-2.5 py-0.5 text-xs font-medium text-default-700">{t("ใช้ได้เมื่อเริ่มคิว", "Works once started")}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-3.5">
                                <div aria-label={`PIN ${pin}`} className="flex gap-1.5 sm:gap-2">
                                    {pin.split("").map((d, i) => (
                                        <span key={i} aria-hidden="true" className="flex h-14 w-11 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-[1.875rem] font-bold tabular-nums text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-100">{d}</span>
                                    ))}
                                </div>
                                <Button variant="bordered" className="h-11 border-default-300 text-sm font-medium" onPress={copyPin}>
                                    {t("คัดลอก PIN", "Copy PIN")}
                                </Button>
                            </div>
                        </div>
                    )}
                </ModalBody>

                <ModalFooter className="shrink-0 flex-col-reverse gap-2 border-t border-divider px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-3.5">
                    <span aria-live="polite" className="min-h-5 text-center text-sm font-medium text-emerald-700 sm:text-left dark:text-emerald-400">{feedback}</span>
                    <div className="flex w-full gap-2.5 sm:w-auto">
                        {isOpen ? (
                            <>
                                <Button variant="bordered" className="h-12 flex-1 border-default-300 text-[0.9375rem] font-medium sm:h-11 sm:flex-none" startContent={<Icon icon="solar:monitor-linear" className="text-lg" aria-hidden="true" />} onPress={openProjector}>
                                    {t("เปิดจอฉาย", "Projector view")}
                                </Button>
                                <Button className="h-12 flex-[2] bg-emerald-700 px-6 text-[0.9375rem] font-medium text-white data-[hover=true]:bg-emerald-800 sm:h-11 sm:flex-none" endContent={<Icon icon="solar:arrow-right-linear" className="text-lg" aria-hidden="true" />} onPress={goWorker}>
                                    {t("ไปหน้ารับคิว", "Go to worker view")}
                                </Button>
                            </>
                        ) : (
                            <Button className="h-12 flex-1 bg-foreground px-6 text-[0.9375rem] font-medium text-background sm:h-11 sm:flex-none" onPress={onClose}>
                                {t("เสร็จสิ้น", "Done")}
                            </Button>
                        )}
                    </div>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

export const QueueCreatedModal = memo(QueueCreatedModalComponent);
