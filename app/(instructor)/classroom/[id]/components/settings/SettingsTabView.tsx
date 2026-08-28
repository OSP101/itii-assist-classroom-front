"use client";

import { memo } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Switch } from "@heroui/switch";
import { Slider } from "@heroui/slider";
import { Divider } from "@heroui/divider";
import { Icon } from "@iconify/react";
import {
    instructorLightButtonClass,
    instructorPrimaryButtonClass,
} from "@/components/ui/instructor-button-styles";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import type { Course } from "@/services/course.service";
import type { SettingsFormData, UseSettingsTabReturn } from "./useSettingsTab";
import { CourseCoverEditor, buildCourseCoverRecommendedSizeText } from "@/components/course";

interface SettingsTabViewProps {
    course: Course;
    isEditing: boolean;
    isSaving: boolean;
    formData: SettingsFormData;
    hasWarningChanges: boolean;
    isDisablingCourse: boolean;
    isExporting: boolean;
    isCoverSaving: boolean;
    stats: UseSettingsTabReturn["stats"];
    onUpdateField: <K extends keyof SettingsFormData>(field: K, value: SettingsFormData[K]) => void;
    onUpdateCover: (cover: Pick<SettingsFormData, "image" | "cover_position_x" | "cover_position_y" | "cover_zoom">) => void;
    onSave: () => void;
    onCancel: () => void;
    onStartEditing: () => void;
    onExportAll: () => void;
    getSemesterText: (semester: number) => string;
}

// ─── Reusable Section Card Header ───────────────────────────────────────────
function SectionCardHeader({
    icon,
    title,
    subtitle,
    gradientFrom,
    gradientTo,
}: {
    icon: string;
    title: string;
    subtitle: string;
    gradientFrom: string;
    gradientTo: string;
}) {
    return (
        <CardHeader className="border-b border-divider px-5 py-4">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-sm`}>
                    <Icon icon={icon} className="text-xl text-white" />
                </div>
                <div>
                    <h3 className="text-base font-semibold text-foreground">{title}</h3>
                    <p className="text-xs text-default-500">{subtitle}</p>
                </div>
            </div>
        </CardHeader>
    );
}

// ─── Read-only field display ─────────────────────────────────────────────────
function ReadField({ icon, value }: { icon: string; value: string }) {
    return (
        <div className="flex items-center gap-2 rounded-lg border border-default-200 bg-content2 px-3 py-2.5">
            <Icon icon={icon} className="shrink-0 text-default-400" />
            <span className="text-sm font-medium text-foreground">{value}</span>
        </div>
    );
}

function formatSettingsDate(dateValue: string | null | undefined, isEnglish: boolean) {
    if (!dateValue) return "-";

    return new Date(dateValue).toLocaleDateString(isEnglish ? "en-US" : "th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

// ─── Main Component ──────────────────────────────────────────────────────────
function SettingsTabViewComponent({
    course,
    isEditing,
    isSaving,
    formData,
    hasWarningChanges,
    isDisablingCourse,
    isExporting,
    isCoverSaving,
    stats,
    onUpdateField,
    onUpdateCover,
    onSave,
    onCancel,
    onStartEditing,
    onExportAll,
    getSemesterText,
}: SettingsTabViewProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const thresholdColor =
        formData.attention_threshold < 50 ? "danger" : formData.attention_threshold < 70 ? "warning" : "success";
    const thresholdBarColor =
        formData.attention_threshold < 50 ? "bg-red-500" : formData.attention_threshold < 70 ? "bg-amber-500" : "bg-emerald-500";
    const hasPendingChanges =
        formData.code !== (course.code || "") ||
        formData.name !== (course.name || "") ||
        formData.year !== (course.year || formData.year) ||
        formData.semester !== (course.semester || 1) ||
        formData.description !== (course.description || "") ||
        formData.image !== (course.image || "") ||
        formData.cover_position_x !== (course.cover_position_x ?? 50) ||
        formData.cover_position_y !== (course.cover_position_y ?? 50) ||
        formData.cover_zoom !== (course.cover_zoom ?? 1) ||
        formData.attention_threshold !== (course.attention_threshold ?? 60) ||
        formData.is_active !== (course.is_active ?? true);
    const courseCoverEditorText = {
        title: isEnglish ? "Course cover image" : "รูปปกรายวิชา",
        emptyTitle: isEnglish ? "Click to upload a course cover image" : "คลิกเพื่ออัปโหลดรูปปกรายวิชา",
        emptyHint: isEnglish ? "Supports JPG and PNG files up to 2MB" : "รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 2MB",
        recommendedSize: buildCourseCoverRecommendedSizeText(isEnglish ? "Recommended size" : "ขนาดแนะนำ"),
        editCover: isEnglish ? "Course cover image" : "รูปปกรายวิชา",
        changeImage: isEnglish ? "Change image" : "เปลี่ยนรูป",
        removeImage: isEnglish ? "Remove image" : "ลบรูป",
        adjustCover: isEnglish ? "Adjust cover" : "ปรับตำแหน่ง Cover",
        modalTitle: isEnglish ? "Adjust course cover" : "ปรับแต่งภาพ Cover รายวิชา",
        modalHint: isEnglish
            ? "Move and scale the image so the important area fits inside the cover frame used across the app."
            : "จัดตำแหน่งและขนาดภาพให้พอดีกับกรอบ Cover ที่จะแสดงทุกหน้า",
        horizontalPosition: isEnglish ? "Move left to right" : "เลื่อนซ้าย-ขวา",
        verticalPosition: isEnglish ? "Move top to bottom" : "เลื่อนบน-ล่าง",
        zoom: isEnglish ? "Zoom image" : "ซูมภาพ",
        cancel: isEnglish ? "Cancel" : "ยกเลิก",
        apply: isEnglish ? "Apply cover settings" : "ใช้การตั้งค่านี้",
        invalidFileType: isEnglish ? "Please choose an image file only." : "กรุณาเลือกไฟล์รูปภาพเท่านั้น",
        fileTooLarge: isEnglish ? "Supports JPG and PNG files up to 2MB" : "รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 2MB",
        dragHint: isEnglish ? "Drag image to reposition · Scroll to zoom" : "ลากภาพเพื่อปรับตำแหน่ง · เลื่อนล้อเมาส์เพื่อซูม",
    };

    return (
        <div className="space-y-5">

            {/* ── Hero Header ─────────────────────────────────────────────── */}
            <Card className="shadow-md border-0 bg-linear-to-br from-slate-700 via-slate-800 to-slate-900 text-white overflow-hidden">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                </div>
                <CardBody className="relative p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                                <Icon icon="solar:settings-bold-duotone" className="text-2xl text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl font-bold">{isEnglish ? "Course settings" : "ตั้งค่ารายวิชา"}</h1>
                                    <Chip
                                        size="sm"
                                        className={`border-0 text-xs ${course.is_active ? "bg-emerald-500/30 text-emerald-100" : "bg-red-500/30 text-red-100"}`}
                                        startContent={
                                            <div className={`w-1.5 h-1.5 rounded-full ${course.is_active ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                                        }
                                    >
                                        {course.is_active ? (isEnglish ? "Active" : "เปิดใช้งาน") : (isEnglish ? "Closed" : "ปิดใช้งาน")}
                                    </Chip>
                                </div>
                                <p className="text-white/60 text-sm">{course.code} · {getSemesterText(course.semester)} · {course.year}</p>
                            </div>
                        </div>

                        {/* Action buttons */}
                        {!isEditing ? (
                            <Button
                                className={instructorLightButtonClass("bg-white/15 border border-white/25 text-white hover:bg-white/25 backdrop-blur-sm")}
                                onPress={onStartEditing}
                                size="sm"
                                isDisabled={!course.is_active}
                            >
                                {isEnglish ? "Edit details" : "แก้ไขข้อมูล"}
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    className={instructorLightButtonClass("bg-white/10 border border-white/20 text-white hover:bg-white/20")}
                                    onPress={onCancel}
                                >
                                    {isEnglish ? "Cancel" : "ยกเลิก"}
                                </Button>
                                <Button
                                    size="sm"
                                    className={instructorPrimaryButtonClass()}
                                    isLoading={isSaving}
                                    isDisabled={!hasPendingChanges || !formData.code.trim() || !formData.name.trim()}
                                    onPress={onSave}
                                >
                                    {isEnglish ? "Save" : "บันทึก"}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Quick stat pills */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
                        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs text-white/80">
                            <Icon icon="solar:users-group-rounded-bold" className="text-sm" />
                            {stats.totalStudents} {isEnglish ? "students" : "นักศึกษา"}
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs text-white/80">
                            <Icon icon="solar:notebook-bold" className="text-sm" />
                            {stats.sectionsCount} {isEnglish ? "sections" : "กลุ่มเรียน"}
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs text-white/80">
                            <Icon icon="solar:user-speak-bold" className="text-sm" />
                            {stats.instructorsCount} {isEnglish ? "instructors" : "อาจารย์"}
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs text-white/80">
                            <Icon icon="solar:star-bold" className="text-sm" />
                            {stats.tasCount} {isEnglish ? "teaching assistants" : "ผู้ช่วยสอน"}
                        </div>
                    </div>

                    {!course.is_active && (
                        <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                            {isEnglish
                                ? "This course is closed. Settings are read-only here until the course is reopened."
                                : "รายวิชานี้ถูกปิดอยู่ ตอนนี้หน้า settings จะดูข้อมูลได้อย่างเดียวจนกว่าจะเปิดวิชากลับ"}
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* ── Course Info ──────────────────────────────────────────────── */}
            <CourseCoverEditor
                value={{
                    image: formData.image,
                    cover_position_x: formData.cover_position_x,
                    cover_position_y: formData.cover_position_y,
                    cover_zoom: formData.cover_zoom,
                }}
                onChange={(value) => onUpdateCover(value)}
                text={courseCoverEditorText}
                accentClassName="text-indigo-500"
                disabled={!isEditing || !course.is_active}
            />
            {isEditing && course.is_active && isCoverSaving && (
                <div className="-mt-2 rounded-lg border border-default-200 bg-content1 px-3 py-2 text-xs text-default-500">
                    {isEnglish ? "Saving cover changes..." : "กำลังบันทึกการปรับรูปปกรายวิชา..."}
                </div>
            )}

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <SectionCardHeader
                    icon="solar:document-text-bold"
                    title={isEnglish ? "Course information" : "ข้อมูลรายวิชา"}
                    subtitle={isEnglish ? "Edit the core details of this course" : "แก้ไขข้อมูลพื้นฐานของรายวิชา"}
                    gradientFrom="from-blue-500"
                    gradientTo="to-indigo-600"
                />
                <CardBody className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Course Code */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium uppercase tracking-wide text-default-500">{isEnglish ? "Course code" : "รหัสวิชา"}</label>
                            {isEditing ? (
                                <Input
                                    value={formData.code}
                                    onValueChange={(v) => onUpdateField("code", v)}
                                    placeholder={isEnglish ? "e.g. 01076001" : "เช่น 01076001"}
                                    variant="bordered"
                                    size="sm"
                                    startContent={<Icon icon="solar:hashtag-bold" className="text-sm text-default-400" />}
                                    classNames={{ inputWrapper: "border-default-300 bg-content1" }}
                                />
                            ) : (
                                <ReadField icon="solar:hashtag-bold" value={course.code} />
                            )}
                        </div>

                        {/* Course Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium uppercase tracking-wide text-default-500">{isEnglish ? "Course name" : "ชื่อวิชา"}</label>
                            {isEditing ? (
                                <Input
                                    value={formData.name}
                                    onValueChange={(v) => onUpdateField("name", v)}
                                    placeholder={isEnglish ? "Course name" : "ชื่อรายวิชา"}
                                    variant="bordered"
                                    size="sm"
                                    startContent={<Icon icon="solar:book-bold" className="text-sm text-default-400" />}
                                    classNames={{ inputWrapper: "border-default-300 bg-content1" }}
                                />
                            ) : (
                                <ReadField icon="solar:book-bold" value={course.name} />
                            )}
                        </div>

                        {/* Academic Year */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium uppercase tracking-wide text-default-500">{isEnglish ? "Academic year" : "ปีการศึกษา"}</label>
                            {isEditing ? (
                                <Input
                                    type="number"
                                    value={String(formData.year)}
                                    onValueChange={(v) => onUpdateField("year", parseInt(v) || formData.year)}
                                    placeholder={isEnglish ? "Academic year" : "พ.ศ."}
                                    variant="bordered"
                                    size="sm"
                                    startContent={<Icon icon="solar:calendar-bold" className="text-sm text-default-400" />}
                                    classNames={{ inputWrapper: "border-default-300 bg-content1" }}
                                />
                            ) : (
                                <ReadField icon="solar:calendar-bold" value={String(course.year)} />
                            )}
                        </div>

                        {/* Semester */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium uppercase tracking-wide text-default-500">{isEnglish ? "Semester" : "ภาคเรียน"}</label>
                            {isEditing ? (
                                <div className="flex gap-2">
                                    {[1, 2, 3].map((sem) => (
                                        <Button
                                            key={sem}
                                            size="sm"
                                            variant={formData.semester === sem ? "solid" : "bordered"}
                                            color={formData.semester === sem ? "primary" : "default"}
                                            className={formData.semester === sem ? "flex-1 bg-linear-to-r from-blue-400 to-indigo-500 text-white" : "flex-1 border-default-300 bg-content1 text-default-600"}
                                            onPress={() => onUpdateField("semester", sem)}
                                        >
                                            {sem === 3 ? (isEnglish ? "Summer" : "ฤดูร้อน") : (isEnglish ? `Semester ${sem}` : `ภาค ${sem}`)}
                                        </Button>
                                    ))}
                                </div>
                            ) : (
                                <ReadField icon="solar:calendar-date-bold" value={getSemesterText(course.semester)} />
                            )}
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-default-500">{isEnglish ? "Course description" : "คำอธิบายรายวิชา"}</label>
                            {isEditing ? (
                                <Textarea
                                    value={formData.description}
                                    onValueChange={(v) => onUpdateField("description", v)}
                                    placeholder={isEnglish ? "Additional description (optional)" : "คำอธิบายเพิ่มเติม (ไม่บังคับ)"}
                                    variant="bordered"
                                    minRows={2}
                                    classNames={{ inputWrapper: "border-default-300 bg-content1" }}
                                />
                            ) : (
                                <div className="min-h-15 rounded-lg border border-default-200 bg-content2 px-3 py-2.5">
                                    {course.description
                                        ? <p className="text-sm text-default-700">{course.description}</p>
                                        : <p className="text-sm italic text-default-400">{isEnglish ? "No description provided" : "ไม่มีคำอธิบาย"}</p>
                                    }
                                </div>
                            )}
                        </div>

                        {/* Warning */}
                        {isEditing && hasWarningChanges && (
                            <div className="md:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                <div className="flex items-start gap-2">
                                    <Icon icon="solar:info-circle-bold" className="text-lg text-amber-600 mt-0.5 shrink-0" />
                                    <p className="text-sm text-amber-700">
                                        {isEnglish
                                            ? <>
                                                Updating <strong>course code / academic year / semester</strong> will trigger a duplicate-course check. The form cannot be saved if a duplicate course already exists.
                                            </>
                                            : <>
                                                การเปลี่ยน<strong>รหัสวิชา / ปี / ภาคเรียน</strong> ระบบจะตรวจสอบว่าไม่มีรายวิชาซ้ำ หากพบรายวิชาซ้ำจะไม่สามารถบันทึกได้
                                            </>}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </CardBody>
            </Card>

            {/* ── Two-column row: Threshold + Status ──────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Attention Threshold */}
                <Card className="border border-default-200 bg-content1 shadow-sm">
                    <SectionCardHeader
                        icon="solar:bell-bold"
                        title={isEnglish ? "Attention threshold" : "เกณฑ์การแจ้งเตือน"}
                        subtitle={isEnglish ? "Highlight students who may need additional support" : "ไฮไลท์นักศึกษาที่ต้องดูแลเป็นพิเศษ"}
                        gradientFrom="from-amber-500"
                        gradientTo="to-orange-600"
                    />
                    <CardBody className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-default-600">{isEnglish ? "Highlight students whose total score is below" : "นักศึกษาที่คะแนนรวมต่ำกว่า"}</p>
                            <Chip size="sm" color={thresholdColor} variant="flat" className="font-bold">
                                {formData.attention_threshold}%
                            </Chip>
                        </div>

                        {isEditing ? (
                            <Slider
                                aria-label="Attention Threshold"
                                step={5}
                                minValue={0}
                                maxValue={100}
                                value={formData.attention_threshold}
                                onChange={(v) => onUpdateField("attention_threshold", v as number)}
                                color={thresholdColor}
                                showTooltip
                                marks={[
                                    { value: 0, label: "0%" },
                                    { value: 50, label: "50%" },
                                    { value: 100, label: "100%" },
                                ]}
                                showSteps
                            />
                        ) : (
                            <div className="space-y-2">
                                <div className="h-2 overflow-hidden rounded-full bg-content3">
                                    <div
                                        className={`h-full rounded-full transition-all ${thresholdBarColor}`}
                                        style={{ width: `${formData.attention_threshold}%` }}
                                    />
                                </div>
                                <p className="text-xs text-default-500">
                                    {isEnglish ? "These students will be highlighted in the at-risk student list." : "จะถูกไฮไลท์ในรายการ \"นักศึกษาที่ควรได้รับการดูแลเพิ่มเติม\""}
                                </p>
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Course Status */}
                <Card className="border border-default-200 bg-content1 shadow-sm">
                    <SectionCardHeader
                        icon={formData.is_active ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                        title={isEnglish ? "Course status" : "สถานะรายวิชา"}
                        subtitle={isEnglish ? "Open or close access to this course" : "เปิด/ปิดการใช้งานรายวิชา"}
                        gradientFrom={formData.is_active ? "from-emerald-500" : "from-red-500"}
                        gradientTo={formData.is_active ? "to-teal-600" : "to-rose-600"}
                    />
                    <CardBody className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    {formData.is_active ? (isEnglish ? "Currently active" : "เปิดใช้งานอยู่") : (isEnglish ? "Currently closed" : "ปิดใช้งานอยู่")}
                                </p>
                                <p className="mt-0.5 text-xs text-default-500">
                                    {formData.is_active
                                        ? (isEnglish ? "Students and TAs can access this course." : "นักศึกษาและ TA สามารถเข้าถึงรายวิชาได้")
                                        : (isEnglish ? "Students and TAs cannot access this course." : "นักศึกษาและ TA ไม่สามารถเข้าถึงรายวิชาได้")}
                                </p>
                            </div>
                            {isEditing ? (
                                <Switch
                                    isSelected={formData.is_active}
                                    onValueChange={(v) => onUpdateField("is_active", v)}
                                    color="success"
                                    size="lg"
                                />
                            ) : (
                                <Chip
                                    color={formData.is_active ? "success" : "danger"}
                                    variant="flat"
                                    size="sm"
                                    startContent={
                                        <Icon icon={formData.is_active ? "solar:check-circle-bold" : "solar:close-circle-bold"} />
                                    }
                                >
                                    {formData.is_active ? (isEnglish ? "Active" : "เปิดใช้งาน") : (isEnglish ? "Closed" : "ปิดใช้งาน")}
                                </Chip>
                            )}
                        </div>

                        {isEditing && isDisablingCourse && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                                <div className="flex items-start gap-2">
                                    <Icon icon="solar:danger-triangle-bold" className="text-lg text-red-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-red-800">{isEnglish ? "Warning: closing this course" : "คำเตือน: การปิดใช้งานรายวิชา"}</p>
                                        <ul className="text-xs text-red-600 mt-1 space-y-0.5 list-disc list-inside">
                                            <li>{isEnglish ? "Students will no longer see this course in their list." : "นักศึกษาจะไม่เห็นรายวิชาในรายการ"}</li>
                                            <li>{isEnglish ? "Teaching assistants will lose access." : "ผู้ช่วยสอนจะไม่สามารถเข้าถึงได้"}</li>
                                            <li>{isEnglish ? "All data will remain intact and the course can be reopened later." : "ข้อมูลทั้งหมดยังคงอยู่ และสามารถเปิดได้อีกครั้ง"}</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            {/* ── Export Data ──────────────────────────────────────────────── */}
            <Card className="border border-default-200 bg-content1 shadow-sm">
                <SectionCardHeader
                    icon="solar:download-bold"
                    title={isEnglish ? "Export report" : "ส่งออกรายงาน"}
                    subtitle={isEnglish ? "Download a complete Excel workbook for this course" : "ดาวน์โหลดรายงานครบถ้วนในรูปแบบ Excel บันทึกเดียว 6 แผ่น"}
                    gradientFrom="from-emerald-500"
                    gradientTo="to-teal-600"
                />
                <CardBody className="p-5">
                    {/* Sheet preview badges */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {[
                            { label: isEnglish ? "Lab scores" : "คะแนนแลป",        icon: "solar:test-tube-bold",                  color: "bg-blue-100 text-blue-700" },
                            { label: isEnglish ? "Homework scores" : "คะแนนการบ้าน",    icon: "solar:document-text-bold",              color: "bg-indigo-100 text-indigo-700" },
                            { label: isEnglish ? "Group scores" : "คะแนนกลุ่ม",      icon: "solar:users-group-two-rounded-bold",    color: "bg-violet-100 text-violet-700" },
                            { label: isEnglish ? "Attendance" : "เช็กชื่อ",         icon: "solar:check-square-bold",               color: "bg-emerald-100 text-emerald-700" },
                            { label: isEnglish ? "TA performance" : "การทำงานทีเอ",    icon: "solar:star-bold",                       color: "bg-amber-100 text-amber-700" },
                            { label: isEnglish ? "Exam scores" : "คะแนนสอบ",       icon: "solar:diploma-bold",                    color: "bg-purple-100 text-purple-700" },
                            { label: isEnglish ? "Score summary" : "สรุปคะแนน",       icon: "solar:chart-2-bold",                    color: "bg-rose-100 text-rose-700" },
                        ].map(({ label, icon, color }) => (
                            <div key={label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${color}`}>
                                <Icon icon={icon} className="text-sm" />
                                {label}
                            </div>
                        ))}
                    </div>


                    <Button
                        className="w-full bg-linear-to-r from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/20"
                        size="md"
                        isLoading={isExporting}
                        onPress={onExportAll}
                    >
                        {isExporting ? (isEnglish ? "Generating report file..." : "กำลังสร้างไฟล์รายงาน...") : (isEnglish ? "Download Excel report (.xlsx)" : "ดาวน์โหลดรายงาน Excel (.xlsx)")}
                    </Button>

                    <p className="mt-3 flex items-center gap-1 text-xs text-default-400">
                        <Icon icon="solar:info-circle-linear" className="text-sm" />
                        {isEnglish ? "This .xlsx file can be opened directly in Microsoft Excel, Google Sheets, or LibreOffice Calc." : "ไฟล์ .xlsx เปิดด้วย Microsoft Excel, Google Sheets หรือ LibreOffice Calc ได้ทันที"}
                    </p>
                </CardBody>
            </Card>
            {/* ── System Info ──────────────────────────────────────────────── */}
            <Card className="border border-default-200 bg-content1 shadow-sm">
                <SectionCardHeader
                    icon="solar:info-circle-bold"
                    title={isEnglish ? "System information" : "ข้อมูลระบบ"}
                    subtitle={isEnglish ? "Additional metadata for this course" : "ข้อมูลเพิ่มเติมของรายวิชาในระบบ"}
                    gradientFrom="from-slate-500"
                    gradientTo="to-slate-700"
                />
                <CardBody className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-0.5 rounded-xl border border-default-200 bg-content2 p-3">
                            <p className="text-xs text-default-400">{isEnglish ? "Course ID" : "รหัสรายวิชา (ID)"}</p>
                            <p className="text-sm font-semibold text-foreground">{course.id}</p>
                        </div>
                        <div className="space-y-0.5 rounded-xl border border-default-200 bg-content2 p-3">
                            <p className="text-xs text-default-400">{isEnglish ? "Lead instructor" : "อาจารย์หลัก"}</p>
                            <p className="truncate text-sm font-semibold text-foreground">{stats.primaryInstructor}</p>
                        </div>
                        <div className="space-y-0.5 rounded-xl border border-default-200 bg-content2 p-3">
                            <p className="text-xs text-default-400">{isEnglish ? "Created" : "วันที่สร้าง"}</p>
                            <p className="text-sm font-semibold text-foreground">
                                {formatSettingsDate(course.created_at, isEnglish)}
                            </p>
                        </div>
                        <div className="space-y-0.5 rounded-xl border border-default-200 bg-content2 p-3">
                            <p className="text-xs text-default-400">{isEnglish ? "Last updated" : "แก้ไขล่าสุด"}</p>
                            <p className="text-sm font-semibold text-foreground">
                                {formatSettingsDate(course.updated_at, isEnglish)}
                            </p>
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}


// Export memoized component to prevent unnecessary re-renders
export const SettingsTabView = memo(SettingsTabViewComponent);
