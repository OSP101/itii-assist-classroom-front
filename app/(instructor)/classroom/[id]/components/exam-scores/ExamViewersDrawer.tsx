"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@heroui/drawer";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import examScoreService, { type ExamScoreWithSetting, type ExamViewersSummary } from "@/services/examScore.service";
import { formatDateTime, formatScore, shortExamName } from "./examScoreUtils";

interface ExamViewersDrawerProps {
    courseId: string;
    setting: ExamScoreWithSetting | null;
    isOpen: boolean;
    canRemind: boolean;
    isEnglish: boolean;
    onClose: () => void;
}

type Filter = "all" | "unviewed" | "viewed";

/**
 * B3: who has opened the published score. "Viewed" means the student's
 * course page showed the score after publish time, not that an email was
 * opened. Lets the instructor email just the ones who have not looked.
 */
export default function ExamViewersDrawer({ courseId, setting, isOpen, canRemind, isEnglish, onClose }: ExamViewersDrawerProps) {
    const [data, setData] = useState<ExamViewersSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isReminding, setIsReminding] = useState(false);
    const [filter, setFilter] = useState<Filter>("unviewed");
    const [query, setQuery] = useState("");

    const load = useCallback(async () => {
        if (!setting) return;
        setIsLoading(true);
        try {
            setData(await examScoreService.getViewers(courseId, setting.id));
        } catch {
            addToast({ title: isEnglish ? "Unable to load viewers" : "โหลดรายชื่อผู้ดูไม่สำเร็จ", color: "danger", timeout: 3000 });
        } finally {
            setIsLoading(false);
        }
    }, [courseId, setting, isEnglish]);

    useEffect(() => {
        if (isOpen && setting) {
            setFilter("unviewed");
            setQuery("");
            void load();
        }
    }, [isOpen, setting, load]);

    const rows = useMemo(() => {
        if (!data) return [];
        const q = query.trim().toLowerCase();
        return data.rows.filter((row) => {
            if (filter === "viewed" && !row.first_viewed_at) return false;
            if (filter === "unviewed" && row.first_viewed_at) return false;
            if (!q) return true;
            return row.student_code.toLowerCase().includes(q) || row.full_name.toLowerCase().includes(q);
        });
    }, [data, filter, query]);

    const pendingReminders = useMemo(() => (data?.rows ?? []).filter((r) => r.has_result && !r.first_viewed_at && r.email).length, [data]);

    const handleRemind = async () => {
        if (!setting) return;
        setIsReminding(true);
        try {
            const result = await examScoreService.remindUnviewed(courseId, setting.id);
            addToast({ title: isEnglish ? `Sending reminders to ${result.count} students` : (result.message || `กำลังส่งอีเมลเตือน ${result.count} คน`), color: "success", timeout: 3000 });
            await load();
        } catch (error: any) {
            addToast({ title: isEnglish ? "Unable to send reminders" : (error?.response?.data?.message || "ส่งอีเมลเตือนไม่สำเร็จ"), color: "danger", timeout: 3000 });
        } finally {
            setIsReminding(false);
        }
    };

    const downloadCsv = () => {
        if (!data || !setting) return;
        const header = ["student_id", "full_name", "score", "email_status", "first_viewed_at", "last_viewed_at", "view_count"];
        const lines = data.rows.map((r) => [
            r.student_code,
            `"${r.full_name.replace(/"/g, '""')}"`,
            r.is_absent ? "absent" : formatScore(r.score),
            r.notification_kind ? (r.notification_sent_at ? "sent" : "failed") : "",
            r.first_viewed_at ?? "",
            r.last_viewed_at ?? "",
            String(r.view_count),
        ].join(","));
        const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `exam-viewers-${setting.exam_type}-${setting.component}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const filterButton = (key: Filter, label: string) => (
        <button
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`h-8 px-3 text-xs font-medium transition-colors ${filter === key ? "bg-foreground text-background" : "bg-content1 text-default-600 hover:bg-content2"}`}
        >
            {label}
        </button>
    );

    return (
        <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="lg">
            <DrawerContent>
                <DrawerHeader className="flex flex-col gap-1 border-b border-divider">
                    <p className="text-xs font-normal text-default-500">{setting ? shortExamName(setting, isEnglish) : ""}</p>
                    <h3 className="text-lg font-semibold">{isEnglish ? "Who has opened the score" : "ใครเปิดดูคะแนนแล้วบ้าง"}</h3>
                    {data?.meta.published_at && (
                        <p className="text-xs font-normal text-success-700 dark:text-success-400">
                            {isEnglish ? "Published" : "ประกาศ"} {formatDateTime(data.meta.published_at, isEnglish)}
                            {data.meta.published_by_name ? ` ${isEnglish ? "by" : "โดย"} ${data.meta.published_by_name}` : ""}
                        </p>
                    )}
                </DrawerHeader>
                <DrawerBody className="gap-3 px-0 py-0">
                    {isLoading && !data ? (
                        <div className="flex justify-center py-12"><Spinner /></div>
                    ) : data ? (
                        <>
                            <div className="grid grid-cols-3 gap-2 border-b border-divider px-5 py-4">
                                <div className="rounded-xl bg-success-50 p-3 dark:bg-success-500/10">
                                    <p className="text-xs text-success-700 dark:text-success-300">{isEnglish ? "Viewed" : "เปิดดูแล้ว"}</p>
                                    <p className="text-xl font-semibold text-success-800 dark:text-success-200">{data.viewed_count}</p>
                                </div>
                                <div className="rounded-xl bg-warning-50 p-3 dark:bg-warning-500/10">
                                    <p className="text-xs text-warning-700 dark:text-warning-300">{isEnglish ? "Not yet" : "ยังไม่เปิดดู"}</p>
                                    <p className="text-xl font-semibold text-warning-800 dark:text-warning-200">{data.unviewed_count}</p>
                                </div>
                                <div className="rounded-xl bg-content2 p-3">
                                    <p className="text-xs text-default-500">{isEnglish ? "Email sent" : "อีเมลส่งสำเร็จ"}</p>
                                    <p className="text-xl font-semibold">
                                        {data.email_sent}
                                        {data.email_failed > 0 && <span className="ml-1 text-xs font-normal text-danger">{isEnglish ? `failed ${data.email_failed}` : `ตีกลับ ${data.email_failed}`}</span>}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 border-b border-divider px-5 py-3">
                                <div role="group" aria-label={isEnglish ? "Filter" : "กรอง"} className="inline-flex overflow-hidden rounded-lg border border-default-300">
                                    {filterButton("all", isEnglish ? `All ${data.total_students}` : `ทั้งหมด ${data.total_students}`)}
                                    {filterButton("unviewed", isEnglish ? `Not yet ${data.unviewed_count}` : `ยังไม่เปิดดู ${data.unviewed_count}`)}
                                    {filterButton("viewed", isEnglish ? `Viewed ${data.viewed_count}` : `ดูแล้ว ${data.viewed_count}`)}
                                </div>
                                <Input
                                    size="sm"
                                    variant="bordered"
                                    className="min-w-40 flex-1"
                                    placeholder={isEnglish ? "Search" : "ค้นหา"}
                                    aria-label={isEnglish ? "Search" : "ค้นหา"}
                                    value={query}
                                    onValueChange={setQuery}
                                    startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                                    isClearable
                                />
                            </div>
                            <div className="flex-1 overflow-auto">
                                <table className="w-full min-w-[520px] text-sm">
                                    <thead className="sticky top-0 bg-content1">
                                        <tr className="border-b border-divider text-left text-xs font-semibold text-default-500">
                                            <th className="px-5 py-2">{isEnglish ? "ID" : "รหัส"}</th>
                                            <th className="px-2 py-2">{isEnglish ? "Name" : "ชื่อ"}</th>
                                            <th className="px-2 py-2 text-right">{isEnglish ? "Score" : "คะแนน"}</th>
                                            <th className="px-2 py-2">{isEnglish ? "Email" : "อีเมลแจ้ง"}</th>
                                            <th className="px-2 py-2 pr-5">{isEnglish ? "Last viewed" : "เปิดดูล่าสุด"}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr key={row.student_id} className="border-b border-divider last:border-b-0">
                                                <td className="px-5 py-2 font-mono text-[13px] text-default-600">{row.student_code}</td>
                                                <td className="px-2 py-2">{row.full_name}</td>
                                                <td className="px-2 py-2 text-right font-medium">
                                                    {row.is_absent ? <span className="text-xs font-normal text-default-500">{isEnglish ? "Absent" : "ขาดสอบ"}</span> : row.score === null ? <span className="text-xs font-normal text-warning-700 dark:text-warning-400">{isEnglish ? "No score" : "ยังไม่มีคะแนน"}</span> : formatScore(row.score)}
                                                </td>
                                                <td className="px-2 py-2 text-xs">
                                                    {!row.notification_kind
                                                        ? <span className="text-default-400">{row.has_result ? (isEnglish ? "Not sent" : "ยังไม่ส่ง") : "-"}</span>
                                                        : row.notification_sent_at
                                                            ? <span className="text-success-700 dark:text-success-400">{isEnglish ? "Sent" : "ส่งแล้ว"}</span>
                                                            : <span className="text-danger" title={row.notification_error}>{isEnglish ? "Failed" : "ตีกลับ"}</span>}
                                                </td>
                                                <td className="px-2 py-2 pr-5 text-xs">
                                                    {row.last_viewed_at
                                                        ? <span className="text-success-700 dark:text-success-400">{formatDateTime(row.last_viewed_at, isEnglish)}{row.view_count > 1 ? ` (${row.view_count})` : ""}</span>
                                                        : <span className="text-warning-700 dark:text-warning-400">{isEnglish ? "Not yet" : "ยังไม่เปิดดู"}</span>}
                                                </td>
                                            </tr>
                                        ))}
                                        {rows.length === 0 && (
                                            <tr><td colSpan={5} className="px-5 py-8 text-center text-default-500">{isEnglish ? "No students in this filter" : "ไม่มีนักศึกษาในกลุ่มนี้"}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : null}
                </DrawerBody>
                <DrawerFooter className="flex-col items-stretch gap-2 border-t border-divider">
                    <p className="text-xs text-default-500">
                        {isEnglish
                            ? "Counted when the student opens the course score page after publish time, not when the email is opened. Hiding and republishing restarts the count."
                            : "นับว่าเปิดดูเมื่อนักศึกษาเปิดหน้าคะแนนของรายวิชานี้หลังเวลาประกาศ ไม่ใช่การเปิดอีเมล ถ้าซ่อนแล้วประกาศใหม่ ตัวนับจะเริ่มใหม่"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {canRemind && (
                            <Button color="primary" className="font-semibold" isLoading={isReminding} isDisabled={pendingReminders === 0} onPress={() => void handleRemind()}>
                                {isEnglish ? `Email reminder to ${pendingReminders} students` : `ส่งอีเมลเตือน ${pendingReminders} คนที่ยังไม่เปิดดู`}
                            </Button>
                        )}
                        <Button variant="bordered" onPress={downloadCsv} isDisabled={!data}>{isEnglish ? "Download CSV" : "ดาวน์โหลด CSV"}</Button>
                    </div>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
