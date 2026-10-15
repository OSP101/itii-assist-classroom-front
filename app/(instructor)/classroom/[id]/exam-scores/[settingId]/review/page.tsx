"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
import { Radio, RadioGroup } from "@heroui/radio";
import { Spinner } from "@heroui/spinner";
import { Switch } from "@heroui/switch";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import examScoreService, { type ExamSettingReview } from "@/services/examScore.service";
import { courseService, type Course } from "@/services/course.service";
import { formatDateTime, formatScore, shortExamName } from "../../../components/exam-scores/examScoreUtils";

type When = "now" | "scheduled";

function toLocalInputValue(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * B2: the review step between draft and published. Shows the numbers the
 * way an instructor checks them (attended / absent / missing, distribution,
 * what one student will see) and asks for an explicit confirmation before
 * anything reaches students.
 */
export default function ExamScoreReviewPage() {
    const params = useParams<{ id: string; settingId: string }>();
    const router = useRouter();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const courseId = params.id;
    const settingId = Number.parseInt(params.settingId, 10);
    const backHref = `/classroom/${courseId}/exam-scores`;

    const [review, setReview] = useState<ExamSettingReview | null>(null);
    const [course, setCourse] = useState<Course | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    const [when, setWhen] = useState<When>("now");
    const [scheduledAt, setScheduledAt] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
    const [sendEmail, setSendEmail] = useState(true);
    const [showAverage, setShowAverage] = useState(true);
    const [showComments, setShowComments] = useState(true);
    const [confirmed, setConfirmed] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const [reviewData, courseRes] = await Promise.all([
                examScoreService.getReview(courseId, settingId),
                courseService.getCourseById(courseId).catch(() => null),
            ]);
            setReview(reviewData);
            setShowAverage(reviewData.meta.show_average);
            setShowComments(reviewData.meta.show_comments);
            setSendEmail(reviewData.meta.notify_by_email);
            setCourse(courseRes?.data ?? null);
        } catch (error: any) {
            setLoadError(error?.response?.data?.message || (isEnglish ? "Unable to load the review" : "โหลดข้อมูลตรวจทานไม่สำเร็จ"));
        } finally {
            setIsLoading(false);
        }
    }, [courseId, settingId, isEnglish]);

    useEffect(() => {
        if (Number.isFinite(settingId)) void load();
    }, [load, settingId]);

    const maxBucket = useMemo(() => Math.max(1, ...(review?.distribution ?? []).map((b) => b.count)), [review]);
    const resultCount = (review?.scored_count ?? 0) + (review?.absent_count ?? 0);
    const scheduledDate = when === "scheduled" ? new Date(scheduledAt) : null;
    const scheduleInvalid = when === "scheduled" && (!scheduledDate || Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now());
    const canSubmit = confirmed && !scheduleInvalid && resultCount > 0 && !isPublishing;

    const handlePublish = async () => {
        if (!review || !canSubmit) return;
        setIsPublishing(true);
        try {
            const result = await examScoreService.publish(courseId, settingId, {
                send_email: sendEmail,
                show_average: showAverage,
                show_comments: showComments,
                scheduled_at: when === "scheduled" && scheduledDate ? scheduledDate.toISOString() : null,
                confirmed: true,
            });
            addToast({ title: result.message || (isEnglish ? "Published" : "ประกาศแล้ว"), color: "success", timeout: 3000 });
            router.push(backHref);
        } catch (error: any) {
            addToast({ title: isEnglish ? "Unable to publish" : (error?.response?.data?.message || "ประกาศไม่สำเร็จ"), color: "danger", timeout: 4000 });
            setIsPublishing(false);
        }
    };

    const stat = (label: string, value: string, sub?: string, tone?: "warning") => (
        <div className="rounded-xl border border-default-200 bg-content1 p-4">
            <p className="text-xs text-default-500">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${tone === "warning" ? "text-warning-700 dark:text-warning-400" : ""}`}>{value}</p>
            {sub && <p className="mt-1 text-xs text-default-500">{sub}</p>}
        </div>
    );

    if (isLoading) {
        return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;
    }
    if (loadError || !review) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-16 text-center">
                <p className="text-default-600">{loadError}</p>
                <Button as={Link} href={backHref} variant="bordered" className="mt-4">{isEnglish ? "Back to exam scores" : "กลับไปหน้าคะแนนสอบ"}</Button>
            </div>
        );
    }

    const name = shortExamName(review.setting, isEnglish);
    const alreadyVisible = review.setting.is_visible;

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
            <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <Icon icon="solar:arrow-left-linear" width={16} />
                {isEnglish ? "Back to exam scores" : "กลับไปหน้าคะแนนสอบ"}
            </Link>
            <h1 className="mt-3 text-2xl font-semibold">{isEnglish ? `Review before publishing: ${name}` : `ตรวจทานก่อนประกาศ ${name}`}</h1>
            <p className="mt-1 text-sm text-default-500">
                {course ? `${course.code} ${course.name}. ` : ""}
                {isEnglish ? "Step 2 of 3. Nothing is sent to students until you press publish." : "ขั้นที่ 2 จาก 3 ตรวจสอบตัวเลขและสิ่งที่นักศึกษาจะเห็น ยังไม่มีอะไรถูกส่งออกไปจนกว่าจะกดประกาศ"}
            </p>

            {alreadyVisible && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-success-200 bg-success-50 p-4 text-sm dark:border-success-500/30 dark:bg-success-500/10">
                    <Icon icon="solar:eye-linear" className="mt-0.5 text-success" width={20} />
                    <div>
                        <p className="font-medium text-success-800 dark:text-success-200">{isEnglish ? "This item is already published." : "รายการนี้ประกาศไปแล้ว"}</p>
                        <p className="text-success-700 dark:text-success-300">{isEnglish ? "Published" : "ประกาศเมื่อ"} {formatDateTime(review.meta.published_at, isEnglish)}{review.meta.published_by_name ? ` ${isEnglish ? "by" : "โดย"} ${review.meta.published_by_name}` : ""}. {isEnglish ? "Hide it from the exam scores page if you need to change it." : "ถ้าต้องการแก้ไข ให้กดซ่อนคะแนนจากหน้าคะแนนสอบก่อน"}</p>
                    </div>
                </div>
            )}

            <div className="mt-6 flex flex-wrap items-start gap-6">
                <div className="min-w-0 flex-[999_1_560px] space-y-4">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {stat(
                            isEnglish ? "Sat the exam and scored" : "เข้าสอบและมีคะแนน",
                            `${review.scored_count}`,
                            isEnglish ? `absent ${review.absent_count}, missing ${review.missing_count}` : `ไม่มาสอบ ${review.absent_count} ยังไม่กรอก ${review.missing_count}`,
                            review.missing_count > 0 ? "warning" : undefined,
                        )}
                        {stat(
                            isEnglish ? "Average" : "เฉลี่ย",
                            review.average === null ? "-" : `${formatScore(review.average)} / ${formatScore(review.setting.max_score)}`,
                            isEnglish ? `from ${review.scored_count} students who sat the exam` : `คิดจาก ${review.scored_count} คนที่เข้าสอบ`,
                        )}
                        {stat(isEnglish ? "Max / min" : "สูงสุด / ต่ำสุด", review.max === null ? "-" : `${formatScore(review.max)} / ${formatScore(review.min)}`)}
                        {stat(isEnglish ? "Below half" : "ต่ำกว่าครึ่ง", `${review.below_half_count}`, isEnglish ? "students" : "คน")}
                    </div>

                    <section className="rounded-xl border border-default-200 bg-content1 p-5">
                        <h2 className="text-sm font-semibold">{isEnglish ? "Score distribution" : "การกระจายคะแนน"}</h2>
                        {review.distribution.length === 0 ? (
                            <p className="mt-2 text-sm text-default-500">{isEnglish ? "Set a max score to see the distribution." : "กำหนดคะแนนเต็มก่อนจึงจะเห็นการกระจาย"}</p>
                        ) : (
                            <div className="mt-4 grid h-36 grid-cols-6 items-end gap-2">
                                {review.distribution.map((bucket, i) => (
                                    <div key={i} className="flex h-full flex-col justify-end">
                                        <span className="mb-1 text-center text-xs font-medium text-default-600">{bucket.count || ""}</span>
                                        <span aria-hidden="true" className="block rounded-t bg-primary" style={{ height: `${Math.max(bucket.count > 0 ? 4 : 0, (bucket.count / maxBucket) * 100)}%` }} />
                                        <span className="mt-1 text-center text-[11px] text-default-500">{formatScore(bucket.from)} {isEnglish ? "to" : "ถึง"} {formatScore(bucket.to)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="space-y-2 rounded-xl border border-default-200 bg-content1 p-5">
                        <h2 className="text-sm font-semibold">{isEnglish ? "Check before publishing" : "สิ่งที่ควรดูก่อนประกาศ"}</h2>
                        {review.missing_count > 0 ? (
                            <div className="flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm dark:border-warning-500/30 dark:bg-warning-500/10">
                                <Icon icon="solar:danger-triangle-linear" className="mt-0.5 shrink-0 text-warning-600 dark:text-warning-400" width={20} />
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-warning-800 dark:text-warning-200">{isEnglish ? `${review.missing_count} students have no score yet` : `ยังไม่มีคะแนน ${review.missing_count} คน`}</p>
                                    <ul className="mt-1 max-h-32 list-disc overflow-auto pl-5 text-warning-700 dark:text-warning-300">
                                        {review.missing.map((s) => <li key={s.id}>{s.student_id} {s.full_name}</li>)}
                                    </ul>
                                    <p className="mt-1 text-warning-700 dark:text-warning-300">{isEnglish ? "They will see \"no score yet\" and get their email when a score is entered later." : "พวกเขาจะเห็นข้อความ ยังไม่มีคะแนน และจะได้รับอีเมลเมื่อกรอกคะแนนเพิ่มทีหลัง"}</p>
                                </div>
                                <Link href={backHref} className="shrink-0 text-xs font-medium text-primary">{isEnglish ? "Go back and enter" : "กลับไปกรอก"}</Link>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 rounded-xl bg-content2 p-3 text-sm">
                                <Icon icon="solar:check-circle-linear" className="text-success" width={20} />
                                <p>{isEnglish ? "Every student has a result" : "นักศึกษาทุกคนมีผลแล้ว"}</p>
                            </div>
                        )}
                        {review.absent_count > 0 && (
                            <div className="flex items-start gap-3 rounded-xl bg-content2 p-3 text-sm">
                                <Icon icon="solar:info-circle-linear" className="mt-0.5 shrink-0 text-default-500" width={20} />
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium">{isEnglish ? `${review.absent_count} absent` : `ไม่มาสอบ ${review.absent_count} คน`}</p>
                                    <p className="text-default-500">{review.absent.map((s) => `${s.student_id} ${s.full_name}`).join(", ")}</p>
                                    <p className="text-default-500">{isEnglish ? "They will see \"absent\" instead of a number. Not counted in the average or as attended." : "จะเห็นข้อความ ขาดสอบ แทนตัวเลข ไม่นำไปคิดค่าเฉลี่ยและไม่นับเป็นผู้เข้าสอบ"}</p>
                                </div>
                            </div>
                        )}
                        {review.invalid_count > 0 ? (
                            <div className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm dark:border-danger-500/30 dark:bg-danger-500/10">
                                <Icon icon="solar:close-circle-linear" className="mt-0.5 shrink-0 text-danger" width={20} />
                                <div>
                                    <p className="font-medium text-danger">{isEnglish ? `${review.invalid_count} scores are above the max or negative` : `มีคะแนนเกิน ${formatScore(review.setting.max_score)} หรือติดลบ ${review.invalid_count} รายการ`}</p>
                                    <p className="text-danger-600">{review.invalid.map((s) => `${s.student_id} ${s.full_name} (${formatScore(s.score)})`).join(", ")}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 rounded-xl bg-content2 p-3 text-sm">
                                <Icon icon="solar:check-circle-linear" className="text-success" width={20} />
                                <p>{isEnglish ? `No score above ${formatScore(review.setting.max_score)} or below zero` : `ไม่มีคะแนนเกิน ${formatScore(review.setting.max_score)} หรือติดลบ`}</p>
                            </div>
                        )}
                    </section>

                    {review.preview && (
                        <section className="rounded-xl border border-default-200 bg-content1 p-5">
                            <h2 className="text-sm font-semibold">{isEnglish ? "What a student will see" : "ตัวอย่างที่นักศึกษาจะเห็น"}</h2>
                            <p className="text-xs text-default-500">{isEnglish ? `View of ${review.preview.full_name} on the student scores page` : `มุมมองของ ${review.preview.full_name} ในหน้าคะแนนของนักศึกษา`}</p>
                            <div className="mt-3 max-w-sm space-y-1.5 rounded-2xl border border-default-200 bg-content2/60 p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-default-500">{name}</span>
                                    <span className="rounded-full bg-success-100 px-2 py-0.5 text-[11px] font-medium text-success-800 dark:bg-success-500/20 dark:text-success-200">{isEnglish ? "New" : "ใหม่"}</span>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl font-semibold">{formatScore(review.preview.score)}</span>
                                    <span className="text-sm text-default-500">/ {formatScore(review.setting.max_score)}</span>
                                </div>
                                {showComments && review.preview.comment && (
                                    <p className="text-sm text-default-600">{isEnglish ? "Note from instructor:" : "หมายเหตุจากอาจารย์"} {review.preview.comment}</p>
                                )}
                                {showAverage && review.average !== null && (
                                    <p className="text-xs text-default-500">{isEnglish ? `Class average ${formatScore(review.average)} from ${review.scored_count} students who sat the exam` : `ค่าเฉลี่ยกลุ่ม ${formatScore(review.average)} จากผู้เข้าสอบ ${review.scored_count} คน`}</p>
                                )}
                            </div>
                        </section>
                    )}
                </div>

                <aside className="w-full max-w-sm flex-[1_1_320px] space-y-4 rounded-2xl border border-default-200 bg-content1 p-5">
                    <h2 className="text-base font-semibold">{isEnglish ? "Publish options" : "ตัวเลือกการประกาศ"}</h2>

                    <RadioGroup label={isEnglish ? "When" : "เวลาประกาศ"} value={when} onValueChange={(v) => setWhen(v as When)} size="sm" isDisabled={alreadyVisible}>
                        <Radio value="now" description={isEnglish ? "Students see it as soon as you press the button" : "นักศึกษาเห็นทันทีที่กดปุ่ม"}>{isEnglish ? "Publish now" : "ประกาศทันที"}</Radio>
                        <Radio value="scheduled" description={isEnglish ? "For example after class on Friday" : "เช่น หลังเลิกเรียนวันศุกร์"}>{isEnglish ? "Schedule" : "ตั้งเวลา"}</Radio>
                    </RadioGroup>
                    {when === "scheduled" && (
                        <Input
                            type="datetime-local"
                            size="sm"
                            variant="bordered"
                            label={isEnglish ? "Publish at" : "วันและเวลาประกาศ"}
                            value={scheduledAt}
                            onValueChange={setScheduledAt}
                            isInvalid={scheduleInvalid}
                            errorMessage={scheduleInvalid ? (isEnglish ? "Pick a time in the future" : "กรุณาเลือกเวลาในอนาคต") : undefined}
                        />
                    )}

                    <div className="space-y-3 border-t border-divider pt-4">
                        <label className="flex items-center justify-between gap-3">
                            <span className="text-sm">
                                <span className="block font-medium">{isEnglish ? `Email the ${review.emailable_count} students with a result` : `ส่งอีเมลแจ้ง ${review.emailable_count} คนที่มีผลแล้ว`}</span>
                                <span className="block text-xs text-default-500">{isEnglish ? `${review.scored_count} scored, ${review.absent_count} absent. Students without a score are emailed when it is entered.` : `${review.scored_count} คนมีคะแนน ${review.absent_count} คนขาดสอบ คนที่ยังไม่กรอกจะได้รับเมื่อกรอกเพิ่ม`}</span>
                            </span>
                            <Switch size="sm" isSelected={sendEmail} onValueChange={setSendEmail} isDisabled={alreadyVisible} aria-label={isEnglish ? "Send email" : "ส่งอีเมล"} />
                        </label>
                        <label className="flex items-center justify-between gap-3">
                            <span className="text-sm">
                                <span className="block font-medium">{isEnglish ? "Show class average" : "แสดงค่าเฉลี่ยกลุ่ม"}</span>
                                <span className="block text-xs text-default-500">{isEnglish ? "Students see only their own score plus the average" : "นักศึกษาเห็นเฉพาะคะแนนตัวเองและค่าเฉลี่ย"}</span>
                            </span>
                            <Switch size="sm" isSelected={showAverage} onValueChange={setShowAverage} isDisabled={alreadyVisible} aria-label={isEnglish ? "Show average" : "แสดงค่าเฉลี่ย"} />
                        </label>
                        <label className="flex items-center justify-between gap-3">
                            <span className="text-sm">
                                <span className="block font-medium">{isEnglish ? "Show per-student notes" : "แสดงหมายเหตุรายคน"}</span>
                                <span className="block text-xs text-default-500">{isEnglish ? `${review.comment_count} students have a note` : `มี ${review.comment_count} คนที่มีหมายเหตุ`}</span>
                            </span>
                            <Switch size="sm" isSelected={showComments} onValueChange={setShowComments} isDisabled={alreadyVisible} aria-label={isEnglish ? "Show notes" : "แสดงหมายเหตุ"} />
                        </label>
                    </div>

                    <div className="space-y-3 border-t border-divider pt-4">
                        <Checkbox size="sm" isSelected={confirmed} onValueChange={setConfirmed} isDisabled={alreadyVisible}>
                            {isEnglish ? `I have reviewed the scores and understand that ${review.total_students} students will see them` : `ฉันตรวจทานคะแนนแล้ว เข้าใจว่านักศึกษา ${review.total_students} คนจะเห็นคะแนนนี้`}
                        </Checkbox>
                        <Button color="primary" className="w-full font-semibold" size="lg" isDisabled={!canSubmit || alreadyVisible} isLoading={isPublishing} onPress={() => void handlePublish()}>
                            {when === "scheduled" ? (isEnglish ? "Schedule publish" : "ตั้งเวลาประกาศ") : (isEnglish ? "Publish to students" : "ประกาศคะแนนให้นักศึกษา")}
                        </Button>
                        <Button as={Link} href={backHref} variant="bordered" className="w-full">{isEnglish ? "Not yet, keep as draft" : "ยังไม่ประกาศ เก็บเป็นร่างต่อ"}</Button>
                        <p className="text-xs text-default-500">{isEnglish ? "Every publish and hide is recorded in the history with who did it and when." : "การประกาศและการซ่อนทุกครั้งถูกบันทึกไว้ในประวัติพร้อมชื่อผู้กดและเวลา"}</p>
                    </div>
                </aside>
            </div>
        </div>
    );
}
