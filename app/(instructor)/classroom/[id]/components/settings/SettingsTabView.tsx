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
import type { Course } from "@/services/course.service";
import type { SettingsFormData, UseSettingsTabReturn } from "./useSettingsTab";

interface SettingsTabViewProps {
    course: Course;
    isEditing: boolean;
    isSaving: boolean;
    formData: SettingsFormData;
    hasWarningChanges: boolean;
    isDisablingCourse: boolean;
    isExporting: boolean;
    stats: UseSettingsTabReturn["stats"];
    onUpdateField: <K extends keyof SettingsFormData>(field: K, value: SettingsFormData[K]) => void;
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
        <CardHeader className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-sm`}>
                    <Icon icon={icon} className="text-xl text-white" />
                </div>
                <div>
                    <h3 className="text-base font-semibold text-slate-800">{title}</h3>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                </div>
            </div>
        </CardHeader>
    );
}

// ─── Read-only field display ─────────────────────────────────────────────────
function ReadField({ icon, value }: { icon: string; value: string }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <Icon icon={icon} className="text-slate-400 flex-shrink-0" />
            <span className="text-slate-800 font-medium text-sm">{value}</span>
        </div>
    );
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
    stats,
    onUpdateField,
    onSave,
    onCancel,
    onStartEditing,
    onExportAll,
    getSemesterText,
}: SettingsTabViewProps) {
    const thresholdColor =
        formData.attention_threshold < 50 ? "danger" : formData.attention_threshold < 70 ? "warning" : "success";
    const thresholdBarColor =
        formData.attention_threshold < 50 ? "bg-red-500" : formData.attention_threshold < 70 ? "bg-amber-500" : "bg-emerald-500";

    return (
        <div className="space-y-5">

            {/* ── Hero Header ─────────────────────────────────────────────── */}
            <Card className="shadow-md border-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white overflow-hidden">
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
                                    <h1 className="text-xl font-bold">ตั้งค่ารายวิชา</h1>
                                    <Chip
                                        size="sm"
                                        className={`border-0 text-xs ${course.is_active ? "bg-emerald-500/30 text-emerald-100" : "bg-red-500/30 text-red-100"}`}
                                        startContent={
                                            <div className={`w-1.5 h-1.5 rounded-full ${course.is_active ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                                        }
                                    >
                                        {course.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                                    </Chip>
                                </div>
                                <p className="text-white/60 text-sm">{course.code} · {getSemesterText(course.semester)} · {course.year}</p>
                            </div>
                        </div>

                        {/* Action buttons */}
                        {!isEditing ? (
                            <Button
                                className="bg-white/15 border border-white/25 text-white hover:bg-white/25 backdrop-blur-sm"
                                startContent={<Icon icon="solar:pen-bold" />}
                                onPress={onStartEditing}
                                size="sm"
                            >
                                แก้ไขข้อมูล
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                                    onPress={onCancel}
                                >
                                    ยกเลิก
                                </Button>
                                <Button
                                    size="sm"
                                    className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-lg"
                                    isLoading={isSaving}
                                    startContent={!isSaving && <Icon icon="solar:check-circle-bold" />}
                                    onPress={onSave}
                                >
                                    บันทึก
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Quick stat pills */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
                        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs text-white/80">
                            <Icon icon="solar:users-group-rounded-bold" className="text-sm" />
                            {stats.totalStudents} นักศึกษา
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs text-white/80">
                            <Icon icon="solar:notebook-bold" className="text-sm" />
                            {stats.sectionsCount} กลุ่มเรียน
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs text-white/80">
                            <Icon icon="solar:user-speak-bold" className="text-sm" />
                            {stats.instructorsCount} อาจารย์
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs text-white/80">
                            <Icon icon="solar:star-bold" className="text-sm" />
                            {stats.tasCount} ผู้ช่วยสอน
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* ── Course Info ──────────────────────────────────────────────── */}
            <Card className="shadow-sm border border-slate-200">
                <SectionCardHeader
                    icon="solar:document-text-bold"
                    title="ข้อมูลรายวิชา"
                    subtitle="แก้ไขข้อมูลพื้นฐานของรายวิชา"
                    gradientFrom="from-blue-500"
                    gradientTo="to-indigo-600"
                />
                <CardBody className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Course Code */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">รหัสวิชา</label>
                            {isEditing ? (
                                <Input
                                    value={formData.code}
                                    onValueChange={(v) => onUpdateField("code", v)}
                                    placeholder="เช่น 01076001"
                                    variant="bordered"
                                    size="sm"
                                    startContent={<Icon icon="solar:hashtag-bold" className="text-slate-400 text-sm" />}
                                    classNames={{ inputWrapper: "border-slate-300" }}
                                />
                            ) : (
                                <ReadField icon="solar:hashtag-bold" value={course.code} />
                            )}
                        </div>

                        {/* Course Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">ชื่อวิชา</label>
                            {isEditing ? (
                                <Input
                                    value={formData.name}
                                    onValueChange={(v) => onUpdateField("name", v)}
                                    placeholder="ชื่อรายวิชา"
                                    variant="bordered"
                                    size="sm"
                                    startContent={<Icon icon="solar:book-bold" className="text-slate-400 text-sm" />}
                                    classNames={{ inputWrapper: "border-slate-300" }}
                                />
                            ) : (
                                <ReadField icon="solar:book-bold" value={course.name} />
                            )}
                        </div>

                        {/* Academic Year */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">ปีการศึกษา</label>
                            {isEditing ? (
                                <Input
                                    type="number"
                                    value={String(formData.year)}
                                    onValueChange={(v) => onUpdateField("year", parseInt(v) || formData.year)}
                                    placeholder="พ.ศ."
                                    variant="bordered"
                                    size="sm"
                                    startContent={<Icon icon="solar:calendar-bold" className="text-slate-400 text-sm" />}
                                    classNames={{ inputWrapper: "border-slate-300" }}
                                />
                            ) : (
                                <ReadField icon="solar:calendar-bold" value={String(course.year)} />
                            )}
                        </div>

                        {/* Semester */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">ภาคเรียน</label>
                            {isEditing ? (
                                <div className="flex gap-2">
                                    {[1, 2, 3].map((sem) => (
                                        <Button
                                            key={sem}
                                            size="sm"
                                            variant={formData.semester === sem ? "solid" : "bordered"}
                                            color={formData.semester === sem ? "primary" : "default"}
                                            className={formData.semester === sem ? "bg-gradient-to-r from-blue-400 to-indigo-500 text-white flex-1" : "flex-1 border-slate-300"}
                                            onPress={() => onUpdateField("semester", sem)}
                                        >
                                            {sem === 3 ? "ฤดูร้อน" : `ภาค ${sem}`}
                                        </Button>
                                    ))}
                                </div>
                            ) : (
                                <ReadField icon="solar:calendar-date-bold" value={getSemesterText(course.semester)} />
                            )}
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">คำอธิบายรายวิชา</label>
                            {isEditing ? (
                                <Textarea
                                    value={formData.description}
                                    onValueChange={(v) => onUpdateField("description", v)}
                                    placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
                                    variant="bordered"
                                    minRows={2}
                                    classNames={{ inputWrapper: "border-slate-300" }}
                                />
                            ) : (
                                <div className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200 min-h-[60px]">
                                    {course.description
                                        ? <p className="text-slate-700 text-sm">{course.description}</p>
                                        : <p className="text-slate-400 italic text-sm">ไม่มีคำอธิบาย</p>
                                    }
                                </div>
                            )}
                        </div>

                        {/* Warning */}
                        {isEditing && hasWarningChanges && (
                            <div className="md:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                <div className="flex items-start gap-2">
                                    <Icon icon="solar:info-circle-bold" className="text-lg text-amber-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-amber-700">
                                        การเปลี่ยน<strong>รหัสวิชา / ปี / ภาคเรียน</strong> ระบบจะตรวจสอบว่าไม่มีรายวิชาซ้ำ หากพบรายวิชาซ้ำจะไม่สามารถบันทึกได้
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
                <Card className="shadow-sm border border-slate-200">
                    <SectionCardHeader
                        icon="solar:bell-bold"
                        title="เกณฑ์การแจ้งเตือน"
                        subtitle="ไฮไลท์นักศึกษาที่ต้องดูแลเป็นพิเศษ"
                        gradientFrom="from-amber-500"
                        gradientTo="to-orange-600"
                    />
                    <CardBody className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-600">นักศึกษาที่คะแนนรวมต่ำกว่า</p>
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
                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${thresholdBarColor}`}
                                        style={{ width: `${formData.attention_threshold}%` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-500">
                                    จะถูกไฮไลท์ในรายการ &quot;นักศึกษาที่ควรได้รับการดูแลเพิ่มเติม&quot;
                                </p>
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Course Status */}
                <Card className="shadow-sm border border-slate-200">
                    <SectionCardHeader
                        icon={formData.is_active ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                        title="สถานะรายวิชา"
                        subtitle="เปิด/ปิดการใช้งานรายวิชา"
                        gradientFrom={formData.is_active ? "from-emerald-500" : "from-red-500"}
                        gradientTo={formData.is_active ? "to-teal-600" : "to-rose-600"}
                    />
                    <CardBody className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-slate-800 text-sm">
                                    {formData.is_active ? "เปิดใช้งานอยู่" : "ปิดใช้งานอยู่"}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {formData.is_active
                                        ? "นักศึกษาและ TA สามารถเข้าถึงรายวิชาได้"
                                        : "นักศึกษาและ TA ไม่สามารถเข้าถึงรายวิชาได้"}
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
                                    {formData.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                                </Chip>
                            )}
                        </div>

                        {isEditing && isDisablingCourse && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                                <div className="flex items-start gap-2">
                                    <Icon icon="solar:danger-triangle-bold" className="text-lg text-red-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-red-800">คำเตือน: การปิดใช้งานรายวิชา</p>
                                        <ul className="text-xs text-red-600 mt-1 space-y-0.5 list-disc list-inside">
                                            <li>นักศึกษาจะไม่เห็นรายวิชาในรายการ</li>
                                            <li>ผู้ช่วยสอนจะไม่สามารถเข้าถึงได้</li>
                                            <li>ข้อมูลทั้งหมดยังคงอยู่ และสามารถเปิดได้อีกครั้ง</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            {/* ── Export Data ──────────────────────────────────────────────── */}
            <Card className="shadow-sm border border-slate-200">
                <SectionCardHeader
                    icon="solar:download-bold"
                    title="ส่งออกรายงาน"
                    subtitle="ดาวน์โหลดรายงานครบถ้วนในรูปแบบ Excel บันทึกเดียว 6 แผ่น"
                    gradientFrom="from-emerald-500"
                    gradientTo="to-teal-600"
                />
                <CardBody className="p-5">
                    {/* Sheet preview badges */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {[
                            { label: "คะแนนแลป",        icon: "solar:test-tube-bold",                  color: "bg-blue-100 text-blue-700" },
                            { label: "คะแนนการบ้าน",    icon: "solar:document-text-bold",              color: "bg-indigo-100 text-indigo-700" },
                            { label: "คะแนนกลุ่ม",      icon: "solar:users-group-two-rounded-bold",    color: "bg-violet-100 text-violet-700" },
                            { label: "เช็คชื่อ",         icon: "solar:check-square-bold",               color: "bg-emerald-100 text-emerald-700" },
                            { label: "การทำงานทีเอ",    icon: "solar:star-bold",                       color: "bg-amber-100 text-amber-700" },
                            { label: "คะแนนสอบ",       icon: "solar:diploma-bold",                    color: "bg-purple-100 text-purple-700" },
                            { label: "สรุปคะแนน",       icon: "solar:chart-2-bold",                    color: "bg-rose-100 text-rose-700" },
                        ].map(({ label, icon, color }) => (
                            <div key={label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${color}`}>
                                <Icon icon={icon} className="text-sm" />
                                {label}
                            </div>
                        ))}
                    </div>


                    <Button
                        className="w-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/20"
                        size="md"
                        startContent={!isExporting && <Icon icon="solar:file-download-bold" className="text-lg" />}
                        isLoading={isExporting}
                        onPress={onExportAll}
                    >
                        {isExporting ? "กำลังสร้างไฟล์รายงาน..." : "ดาวน์โหลดรายงาน Excel (.xlsx)"}
                    </Button>

                    <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                        <Icon icon="solar:info-circle-linear" className="text-sm" />
                        ไฟล์ .xlsx เปิดด้วย Microsoft Excel, Google Sheets หรือ LibreOffice Calc ได้ทันที
                    </p>
                </CardBody>
            </Card>
            {/* ── System Info ──────────────────────────────────────────────── */}
            <Card className="shadow-sm border border-slate-200">
                <SectionCardHeader
                    icon="solar:info-circle-bold"
                    title="ข้อมูลระบบ"
                    subtitle="ข้อมูลเพิ่มเติมของรายวิชาในระบบ"
                    gradientFrom="from-slate-500"
                    gradientTo="to-slate-700"
                />
                <CardBody className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                            <p className="text-xs text-slate-400">รหัสรายวิชา (ID)</p>
                            <p className="font-semibold text-slate-800 text-sm">{course.id}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                            <p className="text-xs text-slate-400">อาจารย์หลัก</p>
                            <p className="font-semibold text-slate-800 text-sm truncate">{stats.primaryInstructor}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                            <p className="text-xs text-slate-400">วันที่สร้าง</p>
                            <p className="font-semibold text-slate-800 text-sm">
                                {course.created_at
                                    ? new Date(course.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
                                    : "-"}
                            </p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                            <p className="text-xs text-slate-400">แก้ไขล่าสุด</p>
                            <p className="font-semibold text-slate-800 text-sm">
                                {course.updated_at
                                    ? new Date(course.updated_at).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
                                    : "-"}
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
