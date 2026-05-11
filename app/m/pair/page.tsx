"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";

import authService from "@/services/auth.service";
import attendanceDisplayService, {
    AttendanceDisplayClaimResult,
    AttendanceDisplayPairing,
} from "@/services/attendance-display.service";
import attendanceService, { AttendanceSession } from "@/services/attendance.service";
import { Course, courseService } from "@/services/course.service";

function formatDateTime(dateString?: string | null): string {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

export default function AttendancePairMobilePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pairingToken = (searchParams.get("t") || "").trim();
    const preselectedSessionId = searchParams.get("session_id")
        ? Number(searchParams.get("session_id"))
        : null;

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isBootLoading, setIsBootLoading] = useState(true);
    const [pairing, setPairing] = useState<AttendanceDisplayPairing | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState<string>("");
    const [sessions, setSessions] = useState<AttendanceSession[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [claimResult, setClaimResult] = useState<AttendanceDisplayClaimResult | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [isSessionsLoading, setIsSessionsLoading] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [user, setUser] = useState<ReturnType<typeof authService.getStoredUser>>(null);

    const loadSessions = useCallback(async (courseId: string) => {
        if (!courseId) {
            setSessions([]);
            setSelectedSessionId(null);
            return;
        }
        setIsSessionsLoading(true);
        try {
            const items = await attendanceService.getSessions(courseId);
            const available = items.filter((session) => session.status !== "closed");
            setSessions(available);
            setSelectedSessionId((current) => {
                // Honour session_id from URL if present and valid
                if (preselectedSessionId && available.some((s) => s.id === preselectedSessionId)) {
                    return preselectedSessionId;
                }
                if (current && available.some((session) => session.id === current)) {
                    return current;
                }
                return available[0]?.id ?? null;
            });
        } catch (error) {
            console.error("Failed to load attendance sessions:", error);
            setSessions([]);
            setSelectedSessionId(null);
            setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดรอบเช็คชื่อได้");
        } finally {
            setIsSessionsLoading(false);
        }
    }, [preselectedSessionId]);

    const boot = useCallback(async () => {
        if (!pairingToken) {
            setErrorMessage("ลิงก์ยืนยันไม่ถูกต้องหรือไม่มี pairing token");
            setIsBootLoading(false);
            return;
        }

        const authenticated = authService.isAuthenticated();
        setIsAuthenticated(authenticated);
        if (!authenticated) {
            setIsBootLoading(false);
            return;
        }

        setUser(authService.getStoredUser());

        try {
            const [pairingData, courseResponse] = await Promise.all([
                attendanceDisplayService.getPairing(pairingToken),
                courseService.getMyCourses({ limit: 1000 }),
            ]);

            setPairing(pairingData);
            const availableCourses = courseResponse.success && courseResponse.data
                ? courseResponse.data.courses.filter((course) => course.is_active)
                : [];
            setCourses(availableCourses);

            const initialCourseId = pairingData.course_id || availableCourses[0]?.id || "";
            setSelectedCourseId(initialCourseId);
            if (initialCourseId) {
                await loadSessions(initialCourseId);
            }
        } catch (error) {
            console.error("Failed to initialize mobile pairing page:", error);
            setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดคำขอจับคู่ได้");
        } finally {
            setIsBootLoading(false);
        }
    }, [pairingToken, loadSessions]);

    useEffect(() => {
        boot();
    }, [boot]);

    const handleCourseSelect = useCallback(async (courseId: string) => {
        setSelectedCourseId(courseId);
        setClaimResult(null);
        await loadSessions(courseId);
    }, [loadSessions]);

    const handleClaim = useCallback(async () => {
        if (!selectedSessionId) {
            addToast({
                title: "ยังไม่ได้เลือกรอบเช็คชื่อ",
                description: "เลือกรอบที่ต้องการแสดงบนจอห้องเรียนก่อน",
                color: "warning",
                timeout: 2500,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsClaiming(true);
        try {
            const result = await attendanceDisplayService.claimPairing(pairingToken, selectedSessionId);
            setClaimResult(result);
            setPairing(result.pairing);
            addToast({
                title: "สร้างรหัสยืนยันแล้ว",
                description: "นำรหัสนี้ไปกรอกบนจอหน้าห้องภายในเวลาที่กำหนด",
                color: "success",
                timeout: 2500,
                shouldShowTimeoutProgress: true,
            });
        } catch (error) {
            console.error("Failed to claim pairing:", error);
            addToast({
                title: "สร้างรหัสไม่สำเร็จ",
                description: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsClaiming(false);
        }
    }, [pairingToken, selectedSessionId]);

    // ─── Full-screen loading ────────────────────────────────────────────────────
    if (isBootLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
                <Spinner size="lg" color="primary" />
                <p className="text-sm text-slate-500">กำลังโหลด…</p>
            </div>
        );
    }

    // ─── Not authenticated ───────────────────────────────────────────────────────
    if (!isAuthenticated) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-5">
                <div className="w-full max-w-sm space-y-5 text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-100">
                        <Icon icon="solar:smartphone-bold-duotone" className="text-4xl text-sky-600" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-xl font-bold text-slate-900">ต้องล็อกอินก่อน</h1>
                        <p className="text-sm text-slate-500">
                            ให้ใช้อุปกรณ์ของอาจารย์หรือ TA ที่ล็อกอินในระบบอยู่แล้ว
                            จากนั้นกลับมาที่ลิงก์เดิม
                        </p>
                    </div>
                    <Button className="w-full bg-sky-600 text-white" size="lg" onPress={() => router.push("/login")}>
                        ไปหน้าเข้าสู่ระบบ
                    </Button>
                </div>
            </div>
        );
    }

    // ─── Boot error ──────────────────────────────────────────────────────────────
    if (errorMessage && !pairing) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-5">
                <div className="w-full max-w-sm space-y-5 text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-100">
                        <Icon icon="solar:danger-triangle-bold" className="text-4xl text-rose-500" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-xl font-bold text-slate-900">เปิดคำขอไม่ได้</h1>
                        <p className="text-sm text-slate-500">{errorMessage}</p>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Main page ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50">

            {/* ── Top hero strip ── */}
            <div className="bg-linear-to-br from-sky-600 to-indigo-700 px-5 pb-8 pt-10 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                        <Icon icon="solar:monitor-smartphone-bold-duotone" className="text-2xl text-white" />
                    </div>
                    <div>
                        <p className="text-xs text-sky-200 font-medium">Mobile Approval</p>
                        <h1 className="text-lg font-bold leading-tight">ยืนยันหน้าจอเช็คชื่อ</h1>
                    </div>
                </div>
                <p className="text-sm text-sky-100 leading-relaxed">
                    ล็อกอินในฐานะ <span className="font-semibold text-white">{user?.full_name || user?.email}</span>
                    {" — "}เลือกรอบแล้วนำรหัส 6 หลักไปกรอกบนจอหน้าห้อง
                </p>
            </div>

            {/* ── Pull-up card sheet ── */}
            <div className="-mt-4 rounded-t-3xl bg-slate-50 px-4 pt-6 pb-10 space-y-5">

                {/* Device info pill */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Device Code bar — must match display screen */}
                    <div className="flex items-center gap-3 bg-slate-950 px-4 py-3">
                        <div className="flex-1">
                            <p className="text-xs font-medium uppercase tracking-widest text-sky-300">Device Code</p>
                            <p className="text-xs text-slate-400 mt-0.5">ตรวจสอบกับจอหน้าห้อง</p>
                        </div>
                        <span className="font-mono text-3xl font-black tracking-[0.18em] text-white">
                            {pairing?.id ? pairing.id.slice(-4).toUpperCase() : "----"}
                        </span>
                    </div>
                    {/* Device detail row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-400">จอที่รอการยืนยัน</p>
                            <p className="truncate text-sm font-semibold text-slate-800">
                                {pairing?.device_hint || "Unknown device"}
                            </p>
                        </div>
                    <Chip
                        size="sm"
                        className={
                            pairing?.status === "confirmed"
                                ? "bg-emerald-100 text-emerald-700"
                                : pairing?.status === "claimed"
                                    ? "bg-sky-100 text-sky-700"
                                    : "bg-amber-100 text-amber-700"
                        }
                    >
                        {pairing?.status === "confirmed" ? "จับคู่แล้ว" : pairing?.status === "claimed" ? "สร้างรหัสแล้ว" : "รอเลือก"}
                    </Chip>
                    </div>
                </div>

                {/* ── Verification code (shown after claim) ── */}
                {claimResult && (
                    <div className="rounded-3xl bg-slate-900 px-5 py-7 text-center shadow-lg">
                        <p className="text-xs font-medium uppercase tracking-widest text-sky-300">รหัสยืนยัน</p>
                        <p className="mt-3 font-mono text-6xl font-black tracking-[0.2em] text-white">
                            {claimResult.verification_code}
                        </p>
                        <p className="mt-4 text-sm text-slate-400">นำรหัสนี้ไปกรอกบนจอหน้าห้องทันที</p>
                    </div>
                )}

                {/* ── Section: เลือกรายวิชา ── */}
                <div className="space-y-3">
                    <p className="px-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
                        รายวิชา
                    </p>
                    <div className="space-y-2">
                        {courses.map((course) => {
                            const selected = selectedCourseId === course.id;
                            return (
                                <button
                                    key={course.id}
                                    type="button"
                                    onClick={() => handleCourseSelect(course.id)}
                                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-all active:scale-[0.98] ${
                                        selected
                                            ? "border-sky-400 bg-sky-50 shadow-[0_0_0_3px_rgba(14,165,233,0.15)]"
                                            : "border-slate-200 bg-white"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-sky-100" : "bg-slate-100"}`}>
                                            <Icon
                                                icon="solar:book-bold-duotone"
                                                className={`text-xl ${selected ? "text-sky-600" : "text-slate-400"}`}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-semibold ${selected ? "text-sky-700" : "text-slate-800"}`}>
                                                {course.code}
                                            </p>
                                            <p className="truncate text-xs text-slate-500">{course.name}</p>
                                        </div>
                                        {selected && (
                                            <Icon icon="solar:check-circle-bold" className="shrink-0 text-lg text-sky-500" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <Divider />

                {/* ── Section: เลือกรอบเช็คชื่อ ── */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                            รอบเช็คชื่อ
                        </p>
                        {isSessionsLoading && <Spinner size="sm" color="primary" />}
                    </div>

                    {sessions.length === 0 && !isSessionsLoading && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-8 text-center text-sm text-slate-400">
                            ไม่พบรอบเช็คชื่อที่ยังใช้งานได้
                        </div>
                    )}

                    <div className="space-y-2">
                        {sessions.map((session) => {
                            const selected = selectedSessionId === session.id;
                            const isActive = session.status === "active";
                            return (
                                <button
                                    key={session.id}
                                    type="button"
                                    onClick={() => setSelectedSessionId(session.id)}
                                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-all active:scale-[0.98] ${
                                        selected
                                            ? "border-sky-400 bg-sky-50 shadow-[0_0_0_3px_rgba(14,165,233,0.15)]"
                                            : "border-slate-200 bg-white"
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                            isActive ? "bg-emerald-100" : "bg-amber-50"
                                        }`}>
                                            <Icon
                                                icon={isActive ? "solar:play-circle-bold-duotone" : "solar:clock-circle-bold-duotone"}
                                                className={`text-xl ${isActive ? "text-emerald-600" : "text-amber-500"}`}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-slate-900">{session.title}</p>
                                            <p className="mt-0.5 text-xs text-slate-500">
                                                {formatDateTime(session.start_time)}
                                            </p>
                                        </div>
                                        <Chip
                                            size="sm"
                                            className={isActive ? "bg-emerald-100 text-emerald-700 shrink-0" : "bg-amber-100 text-amber-700 shrink-0"}
                                        >
                                            {isActive ? "เปิดรับ" : "รอเริ่ม"}
                                        </Chip>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Confirm button ── */}
                <div className="pt-2">
                    <Button
                        className="w-full bg-sky-600 text-white font-semibold"
                        size="lg"
                        radius="lg"
                        isLoading={isClaiming}
                        isDisabled={!selectedSessionId}
                        onPress={handleClaim}
                        startContent={!isClaiming && <Icon icon="solar:key-bold-duotone" className="text-xl" />}
                    >
                        สร้างรหัสยืนยัน
                    </Button>
                    <p className="mt-2 text-center text-xs text-slate-400">
                        รหัสใช้ได้ครั้งเดียว สำหรับจอนี้เท่านั้น
                    </p>
                </div>

            </div>
        </div>
    );
}