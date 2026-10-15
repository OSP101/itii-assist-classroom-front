"use client";

import type { ReactNode } from "react";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import type { ExamLifecycleStage, ExamScoreWithSetting } from "@/services/examScore.service";
import ExamLifecycleStepper from "./ExamLifecycleStepper";
import { componentTitle, examTypeTitle, formatDateTime, formatScore, type SettingSummary } from "./examScoreUtils";

interface ExamLifecycleRowProps {
    setting: ExamScoreWithSetting;
    stage: ExamLifecycleStage;
    summary: SettingSummary;
    isExpanded: boolean;
    isEnglish: boolean;
    canImport: boolean;
    canPublish: boolean;
    canEnable: boolean;
    onToggle: () => void;
    onImport: () => void;
    onReview: () => void;
    onViewers: () => void;
    onHide: () => void;
    onEnable: () => void;
    children?: ReactNode;
}

/**
 * B1: one exam component as a lifecycle row. Draft rows carry the score
 * progress and lead to the review page; published rows show who has seen
 * the score and offer the hide action.
 */
export default function ExamLifecycleRow({
    setting, stage, summary, isExpanded, isEnglish, canImport, canPublish, canEnable,
    onToggle, onImport, onReview, onViewers, onHide, onEnable, children,
}: ExamLifecycleRowProps) {
    const isLab = setting.component === "lab";

    if (stage === "inactive") {
        return (
            <section aria-label={`${examTypeTitle(setting, isEnglish)} ${componentTitle(setting, isEnglish)}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-default-300 bg-content1/60 px-5 py-4 text-default-500">
                <div className="min-w-0 flex-1 basis-60">
                    <p className="text-xs">{examTypeTitle(setting, isEnglish)}</p>
                    <h3 className="text-base font-semibold text-default-600">{componentTitle(setting, isEnglish)}</h3>
                    <p className="text-xs">{isEnglish ? "Not enabled. Students never see this item." : "ยังไม่เปิดใช้รายการนี้ นักศึกษาจะไม่เห็นหัวข้อนี้เลย"}</p>
                </div>
                {canEnable && (
                    <Button size="sm" variant="bordered" onPress={onEnable}>{isEnglish ? "Enable and set max score" : "เปิดใช้และกำหนดคะแนนเต็ม"}</Button>
                )}
            </section>
        );
    }

    const hasAnyResult = summary.scored + summary.absent > 0;
    const borderClass = stage === "published"
        ? "border-success-300 dark:border-success-500/40"
        : isExpanded
            ? "border-primary"
            : "border-default-200";

    let statusLine: ReactNode;
    if (stage === "published") {
        statusLine = (
            <p className="text-xs text-success-700 dark:text-success-400">
                {isEnglish ? "Published" : "ประกาศเมื่อ"} {formatDateTime(setting.published_at, isEnglish)}
                {setting.published_by_name ? ` ${isEnglish ? "by" : "โดย"} ${setting.published_by_name}` : ""}
            </p>
        );
    } else if (stage === "scheduled") {
        statusLine = (
            <p className="text-xs text-primary">
                {isEnglish ? "Scheduled to publish" : "ตั้งเวลาประกาศ"} {formatDateTime(setting.scheduled_publish_at, isEnglish)}
                {setting.scheduled_by_name ? ` ${isEnglish ? "by" : "โดย"} ${setting.scheduled_by_name}` : ""}
            </p>
        );
    } else if (setting.hidden_at) {
        statusLine = (
            <p className="text-xs text-warning-700 dark:text-warning-400">
                {isEnglish ? "Hidden" : "ซ่อนเมื่อ"} {formatDateTime(setting.hidden_at, isEnglish)}
                {setting.hidden_by_name ? ` ${isEnglish ? "by" : "โดย"} ${setting.hidden_by_name}` : ""}
                {setting.hide_reason ? ` (${setting.hide_reason})` : ""}
            </p>
        );
    } else if (setting.last_graded_at) {
        statusLine = (
            <p className="text-xs text-default-500">
                {isEnglish ? "Draft, last edited" : "ร่าง แก้ไขล่าสุด"} {formatDateTime(setting.last_graded_at, isEnglish)}
                {setting.last_graded_by_name ? ` ${isEnglish ? "by" : "โดย"} ${setting.last_graded_by_name}` : ""}
            </p>
        );
    } else {
        statusLine = <p className="text-xs text-default-500">{isEnglish ? "Draft, no scores yet" : "ร่าง ยังไม่มีคะแนน"}</p>;
    }

    const scoredPct = summary.total > 0 ? (summary.scored / summary.total) * 100 : 0;
    const absentPct = summary.total > 0 ? (summary.absent / summary.total) * 100 : 0;
    const viewedPct = summary.total > 0 ? Math.min(100, (setting.viewed_count / summary.total) * 100) : 0;

    return (
        <section aria-label={`${examTypeTitle(setting, isEnglish)} ${componentTitle(setting, isEnglish)}`} className={`overflow-hidden rounded-2xl border-2 bg-content1 shadow-sm ${borderClass}`}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
                <div className="min-w-0 flex-1 basis-56">
                    <p className="text-xs text-default-500">{examTypeTitle(setting, isEnglish)}</p>
                    <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
                        <Icon icon={isLab ? "solar:monitor-linear" : "solar:book-2-linear"} className={isLab ? "text-success" : "text-primary"} width={18} />
                        {componentTitle(setting, isEnglish)}
                        <span className="text-sm font-normal text-default-500">{isEnglish ? "max" : "เต็ม"} {formatScore(setting.max_score)}</span>
                    </h3>
                    {statusLine}
                </div>

                <ExamLifecycleStepper stage={stage} isEnglish={isEnglish} />

                <div className="flex basis-52 flex-col gap-1.5">
                    {stage === "published" ? (
                        <>
                            <span className="text-xs font-medium text-success-700 dark:text-success-400">
                                {isEnglish ? `Viewed by ${setting.viewed_count} of ${summary.total}` : `ดูแล้ว ${setting.viewed_count} จาก ${summary.total} คน`}
                            </span>
                            <span className="block h-2 overflow-hidden rounded-full bg-success-100 dark:bg-success-500/20">
                                <span className="block h-full bg-success" style={{ width: `${viewedPct}%` }} />
                            </span>
                            {summary.missing > 0 && (
                                <span className="text-xs text-warning-700 dark:text-warning-400">{isEnglish ? `${summary.missing} still without a score` : `ยังไม่กรอก ${summary.missing} คน`}</span>
                            )}
                        </>
                    ) : (
                        <>
                            <span className={`text-xs font-medium ${summary.missing > 0 ? "text-warning-700 dark:text-warning-400" : "text-default-600"}`}>
                                {isEnglish
                                    ? `Scored ${summary.scored}, absent ${summary.absent}, missing ${summary.missing}`
                                    : `มีคะแนน ${summary.scored} ไม่มาสอบ ${summary.absent} ยังไม่กรอก ${summary.missing}`}
                            </span>
                            <span className="flex h-2 overflow-hidden rounded-full bg-default-200">
                                <span className="block h-full bg-primary" style={{ width: `${scoredPct}%` }} />
                                <span className="block h-full bg-default-400" style={{ width: `${absentPct}%` }} />
                            </span>
                        </>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    {stage === "published" ? (
                        <>
                            <Button size="sm" variant="bordered" startContent={<Icon icon="solar:users-group-rounded-linear" width={16} />} onPress={onViewers}>
                                {isEnglish ? "Who has viewed" : "ใครเปิดดูแล้ว"}
                            </Button>
                            <Button size="sm" variant="bordered" onPress={onToggle}>
                                {isExpanded ? (isEnglish ? "Hide table" : "ซ่อนตาราง") : (isEnglish ? "Open table" : "เปิดตาราง")}
                            </Button>
                            {canPublish && (
                                <Button size="sm" variant="flat" color="warning" startContent={<Icon icon="solar:eye-closed-linear" width={16} />} onPress={onHide}>
                                    {isEnglish ? "Hide scores" : "ซ่อนคะแนน"}
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            {canImport && (
                                <Button size="sm" variant="bordered" onPress={onImport}>{isEnglish ? "Import from Excel" : "ดึงจาก Excel"}</Button>
                            )}
                            <Button size="sm" variant="bordered" onPress={onToggle}>
                                {isExpanded ? (isEnglish ? "Hide table" : "ซ่อนตาราง") : (isEnglish ? "Open table" : "เปิดตาราง")}
                            </Button>
                            {stage === "scheduled" ? (
                                canPublish && (
                                    <Button size="sm" variant="flat" color="warning" onPress={onHide}>{isEnglish ? "Cancel schedule" : "ยกเลิกตั้งเวลา"}</Button>
                                )
                            ) : (
                                canPublish && (
                                    <Button
                                        size="sm"
                                        color="primary"
                                        className="font-semibold"
                                        isDisabled={!hasAnyResult}
                                        endContent={<Icon icon="solar:arrow-right-linear" width={16} />}
                                        onPress={onReview}
                                    >
                                        {isEnglish ? "Review and publish" : "ตรวจทานและประกาศ"}
                                    </Button>
                                )
                            )}
                        </>
                    )}
                </div>
            </div>
            {isExpanded && <div className="border-t border-divider">{children}</div>}
        </section>
    );
}
