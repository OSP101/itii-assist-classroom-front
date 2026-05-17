"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { InputOtp } from "@heroui/input-otp";
import { Chip } from "@heroui/chip";
import { addToast } from "@heroui/toast";
import { Modal, ModalContent, ModalBody } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";

import attendanceDisplayService, {
    AttendanceDisplayCurrent,
    AttendanceDisplayError,
    AttendanceDisplayBootstrap,
} from "@/services/attendance-display.service";
import { type AttendanceRecord } from "@/services/attendance.service";
import { getRealtimeSocketBaseUrl, io, type Socket } from "@/services/realtime-socket";

type DisplayState = "loading" | "pairing" | "active" | "error";

function formatDateTime(dateString?: string | null): string {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function getCountdownLabel(dateString?: string | null): string {
    if (!dateString) return "-";
    const diffMs = new Date(dateString).getTime() - Date.now();
    if (diffMs <= 0) return "หมดเวลาแล้ว";
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")} นาที`;
}

function formatTime(dateString?: string | null): string {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function upsertRecord(records: AttendanceRecord[], record: AttendanceRecord): AttendanceRecord[] {
    const index = records.findIndex((item) => item.id === record.id);
    if (index === -1) {
        return [...records, record];
    }

    return records.map((item) => item.id === record.id ? record : item);
}

export default function AttendanceDisplayPage() {
    const router = useRouter();
    const [pageState, setPageState] = useState<DisplayState>("loading");
    const [bootstrap, setBootstrap] = useState<AttendanceDisplayBootstrap | null>(null);
    const [current, setCurrent] = useState<AttendanceDisplayCurrent | null>(null);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [verificationCode, setVerificationCode] = useState("");
    const [isSubmittingCode, setIsSubmittingCode] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [showPinModal, setShowPinModal] = useState(false);
    const [, setTick] = useState(0);
    const socketRef = useRef<Socket | null>(null);

    const origin = useMemo(() => {
        if (typeof window === "undefined") {
            return process.env.NEXT_PUBLIC_FRONTEND_URL || "";
        }
        return window.location.origin;
    }, []);

    const pairUrl = bootstrap ? `${origin}/m/pair?t=${encodeURIComponent(bootstrap.pairing_token)}` : "";
    const checkInUrl = current ? `${origin}/check-in/${current.attendance_session_id}` : "";
    const socketUrl = getRealtimeSocketBaseUrl();

    const stats = useMemo(() => ({
        total: records.length,
        checkedIn: records.filter((record) => Boolean(record.check_in_time)).length,
        present: records.filter((record) => record.status === "present").length,
        late: records.filter((record) => record.status === "late").length,
        leave: records.filter((record) => record.status === "leave").length,
        absent: records.filter((record) => record.status === "absent").length,
    }), [records]);

    const recentRecords = useMemo(() => {
        return [...records]
            .filter((record) => Boolean(record.check_in_time))
            .sort((left, right) => new Date(right.check_in_time || 0).getTime() - new Date(left.check_in_time || 0).getTime())
            .slice(0, 8);
    }, [records]);

    const bootstrapPairing = useCallback(async () => {
        setPageState("loading");
        setErrorMessage("");
        setCurrent(null);
        setRecords([]);
        setVerificationCode("");
        try {
            const result = await attendanceDisplayService.bootstrap();
            setBootstrap(result);
            setPageState("pairing");
        } catch (error) {
            console.error("Failed to bootstrap attendance display:", error);
            setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถเปิดหน้าจอเช็คชื่อได้");
            setPageState("error");
        }
    }, []);

    const loadDisplayRecords = useCallback(async () => {
        try {
            const nextRecords = await attendanceDisplayService.getRecords();
            setRecords(nextRecords);
        } catch (error) {
            if (error instanceof AttendanceDisplayError && [401, 404, 410].includes(error.status)) {
                await bootstrapPairing();
                return;
            }
            console.error("Failed to load display records:", error);
        }
    }, [bootstrapPairing]);

    const resolveDisplayState = useCallback(async () => {
        try {
            const result = await attendanceDisplayService.getCurrent();
            setCurrent(result);
            setBootstrap(null);
            setPageState("active");
            await loadDisplayRecords();
        } catch (error) {
            if (error instanceof AttendanceDisplayError && [401, 404, 410].includes(error.status)) {
                await bootstrapPairing();
                return;
            }
            console.error("Failed to load current display session:", error);
            setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดสถานะหน้าจอได้");
            setPageState("error");
        }
    }, [bootstrapPairing, loadDisplayRecords]);

    useEffect(() => {
        resolveDisplayState();
    }, [resolveDisplayState]);

    // Drive re-render every second so getCountdownLabel() stays live
    useEffect(() => {
        if (pageState !== "pairing") return;
        const id = setInterval(() => setTick((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, [pageState]);

    // Poll pairing status every 3s — auto-open PIN modal when instructor scans QR
    useEffect(() => {
        if (pageState !== "pairing" || !bootstrap || showPinModal) return;

        const id = setInterval(async () => {
            try {
                const { status } = await attendanceDisplayService.getPairingStatus(bootstrap.pairing_id);
                if (status === "claimed") {
                    setVerificationCode("");
                    setShowPinModal(true);
                } else if (status === "expired" || status === "cancelled") {
                    clearInterval(id);
                }
            } catch {
                // Silently ignore poll errors (network hiccup, etc.)
            }
        }, 3000);

        return () => clearInterval(id);
    }, [pageState, bootstrap, showPinModal]);

    useEffect(() => {
        if (pageState !== "active") {
            return;
        }

        const timer = window.setInterval(async () => {
            try {
                const result = await attendanceDisplayService.heartbeat();
                setCurrent(result);
            } catch (error) {
                if (error instanceof AttendanceDisplayError && [401, 404, 410].includes(error.status)) {
                    addToast({
                        title: "หน้าจอหมดอายุ",
                        description: "ระบบจะสร้าง QR ใหม่เพื่อรอการยืนยันอีกครั้ง",
                        color: "warning",
                        timeout: 3000,
                        shouldShowTimeoutProgress: true,
                    });
                    await bootstrapPairing();
                    return;
                }
                console.error("Heartbeat failed:", error);
            }
        }, 30000);

        return () => window.clearInterval(timer);
    }, [pageState, bootstrapPairing]);

    useEffect(() => {
        if (pageState !== "active" || !current || !socketUrl) {
            return;
        }

        let disposed = false;
        let activeSocket: Socket | null = null;

        const connectDisplaySocket = async () => {
            try {
                const ticket = await attendanceDisplayService.getSocketTicket();
                if (disposed) {
                    return;
                }

                activeSocket = io(socketUrl, {
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                });
                socketRef.current = activeSocket;

                activeSocket.on("connect", () => {
                    activeSocket?.emit("join-display", { ticket: ticket.ticket });
                });

                activeSocket.on("student-checked-in", (data?: { record?: AttendanceRecord }) => {
                    const record = data?.record;
                    if (!record) return;
                    setRecords((currentRecords) => upsertRecord(currentRecords, record));
                });

                activeSocket.on("attendance-updated", (data?: { record?: AttendanceRecord }) => {
                    const record = data?.record;
                    if (!record) return;
                    setRecords((currentRecords) => upsertRecord(currentRecords, record));
                });

                activeSocket.on("session-closed", () => {
                    setCurrent((value) => value ? {
                        ...value,
                        session: value.session ? { ...value.session, status: "closed" } : value.session,
                    } : value);
                    addToast({
                        title: "ปิดรอบเช็คชื่อแล้ว",
                        description: "หน้าจอนี้ยังดูข้อมูลล่าสุดได้ แต่จะไม่รับเช็คชื่อเพิ่ม",
                        color: "warning",
                        timeout: 3000,
                        shouldShowTimeoutProgress: true,
                    });
                });
            } catch (error) {
                console.error("Failed to initialize display socket:", error);
            }
        };

        connectDisplaySocket();

        return () => {
            disposed = true;
            activeSocket?.disconnect();
            if (socketRef.current === activeSocket) {
                socketRef.current = null;
            }
        };
    }, [pageState, current, socketUrl]);

    const handleConfirm = useCallback(async () => {
        if (!bootstrap || verificationCode.length !== 6) {
            addToast({
                title: "ข้อมูลไม่ครบ",
                description: "กรอกรหัสยืนยัน 6 หลักจากมือถือก่อน",
                color: "warning",
                timeout: 2500,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmittingCode(true);
        try {
            const result = await attendanceDisplayService.confirm(bootstrap.pairing_id, verificationCode);
            setCurrent(result);
            setBootstrap(null);
            setVerificationCode("");
            setShowPinModal(false);
            addToast({
                title: "จับคู่สำเร็จ",
                description: "กำลังเปิดหน้าเช็คชื่อ...",
                color: "success",
                timeout: 2000,
                shouldShowTimeoutProgress: true,
            });
            router.push(`/display/live/${result.course_id}/${result.attendance_session_id}`);
        } catch (error) {
            console.error("Failed to confirm display pairing:", error);
            addToast({
                title: "ยืนยันไม่สำเร็จ",
                description: error instanceof Error ? error.message : "กรุณาตรวจสอบรหัสและลองอีกครั้ง",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            if (error instanceof AttendanceDisplayError && error.status === 410) {
                setShowPinModal(false);
                await bootstrapPairing();
            }
        } finally {
            setIsSubmittingCode(false);
        }
    }, [bootstrap, verificationCode, bootstrapPairing, loadDisplayRecords]);

    const handleResetDisplay = useCallback(async () => {
        addToast({
            title: "รีเซ็ตหน้าจอแล้ว",
            description: "ระบบจะสร้าง QR ใหม่และรอการยืนยันอีกครั้ง",
            color: "primary",
            timeout: 2500,
            shouldShowTimeoutProgress: true,
        });
        await bootstrapPairing();
    }, [bootstrapPairing]);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-6 text-slate-900 lg:px-8">
            <div className="mx-auto max-w-6xl space-y-6">
                {pageState === "loading" && (
                    <Card className="border border-slate-200 bg-white/80">
                        <CardBody className="flex min-h-105 items-center justify-center gap-4">
                            <Icon icon="solar:monitor-smartphone-bold-duotone" className="text-6xl text-sky-500" />
                            <div className="text-center">
                                <p className="text-lg font-semibold text-slate-800">กำลังเตรียมหน้าจอ</p>
                                <p className="text-sm text-slate-500">ระบบกำลังตรวจสอบว่าเครื่องนี้เคยยืนยันไว้แล้วหรือไม่</p>
                            </div>
                        </CardBody>
                    </Card>
                )}

                {pageState === "error" && (
                    <Card className="border border-rose-100 bg-white/90">
                        <CardBody className="flex min-h-90 flex-col items-center justify-center gap-4 text-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                                <Icon icon="solar:danger-triangle-bold" className="text-4xl" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-slate-900">ไม่สามารถเปิดหน้าจอได้</h2>
                                <p className="max-w-lg text-sm text-slate-600">{errorMessage || "กรุณาลองใหม่อีกครั้ง หรือให้ผู้ดูแลระบบตรวจสอบการเชื่อมต่อ API"}</p>
                            </div>
                            <Button color="primary" className="bg-sky-600" onPress={bootstrapPairing}>
                                ลองเริ่มใหม่
                            </Button>
                        </CardBody>
                    </Card>
                )}

                {pageState === "pairing" && bootstrap && (
                    <>
                        {/* ── QR-only pairing card ── */}
                        <Card className="overflow-hidden border border-slate-200 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                            <CardBody className="flex flex-col items-center gap-0 p-0">

                                {/* Sky gradient header */}
                                <div className="relative w-full overflow-hidden bg-linear-to-br from-sky-700 via-sky-600 to-cyan-500 px-8 py-7 text-center">
                                    <span className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
                                    <span className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-cyan-300/20 blur-2xl" />
                                    <div className="relative space-y-2">
                                        <div className="flex justify-center">
                                            <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/20 ring-2 ring-white/30">
                                                <Icon icon="solar:qr-code-bold-duotone" className="text-3xl text-white" />
                                            </span>
                                        </div>
                                        <h2 className="text-2xl font-black text-white">สแกน QR เพื่อเชื่อมต่อหน้าจอ</h2>
                                        <p className="mx-auto max-w-lg text-sm text-sky-100/80">
                                            ใช้มือถืออาจารย์หรือ TA ที่ล็อกอินแล้วสแกน QR นี้ เพื่อเลือกรอบเช็คชื่อและสร้างรหัสยืนยันสำหรับจอนี้
                                        </p>
                                    </div>
                                </div>

                                {/* QR code + device code */}
                                <div className="flex flex-col items-center gap-6 px-8 py-8 w-full max-w-sm mx-auto">

                                    {/* QR frame */}
                                    <div className="relative">
                                        <div className="rounded-[32px] border-2 border-slate-200 bg-white p-6 shadow-[0_8px_40px_rgba(15,23,42,0.10)]">
                                            <QRCodeSVG value={pairUrl} size={240} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                                        </div>
                                        {/* Corner accent marks */}
                                        <span className="absolute -left-1 -top-1 h-6 w-6 rounded-tl-xl border-l-[3px] border-t-[3px] border-sky-500" />
                                        <span className="absolute -right-1 -top-1 h-6 w-6 rounded-tr-xl border-r-[3px] border-t-[3px] border-sky-500" />
                                        <span className="absolute -bottom-1 -left-1 h-6 w-6 rounded-bl-xl border-b-[3px] border-l-[3px] border-sky-500" />
                                        <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-br-xl border-b-[3px] border-r-[3px] border-sky-500" />
                                    </div>

                                    {/* Device code */}
                                    <div className="flex w-full items-center justify-between gap-4 rounded-2xl bg-slate-950 px-5 py-4">
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-400">Device Code</p>
                                            <p className="mt-0.5 text-xs text-slate-400">ต้องตรงกับในมือถือ</p>
                                        </div>
                                        <span className="font-mono text-3xl font-black tracking-[0.2em] text-white">
                                            {bootstrap.pairing_id.slice(-4).toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Expiry + waiting status */}
                                    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-default-100 bg-default-50 px-4 py-3">
                                        <div className="flex items-center gap-2 text-sm text-default-500">
                                            <Icon icon="solar:clock-circle-bold-duotone" className="text-base text-amber-500" />
                                            หมดอายุใน
                                        </div>
                                        <Chip className="bg-amber-100 font-mono text-amber-700">{getCountdownLabel(bootstrap.expires_at)}</Chip>
                                    </div>

                                    {/* Pulse waiting indicator */}
                                    <div className="flex items-center gap-2.5 rounded-full border border-sky-100 bg-sky-50 px-4 py-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
                                        </span>
                                        <p className="text-xs font-medium text-sky-700">รอให้อาจารย์หรือ TA สแกน QR…</p>
                                    </div>

                                    {/* Enter code button */}
                                    <Button
                                        color="primary"
                                        className="w-full h-12 bg-sky-600 text-base font-semibold"
                                        onPress={() => { setVerificationCode(""); setShowPinModal(true); }}
                                    >
                                        <Icon icon="solar:key-bold-duotone" className="text-lg" />
                                        ได้รับรหัสแล้ว — กรอกยืนยัน
                                    </Button>

                                    <button
                                        onClick={bootstrapPairing}
                                        className="text-xs text-default-400 underline-offset-2 hover:text-default-600 hover:underline"
                                    >
                                        สร้าง QR ใหม่
                                    </button>
                                </div>

                            </CardBody>
                        </Card>

                        {/* ── PIN entry modal ── */}
                        <Modal
                            isOpen={showPinModal}
                            onClose={() => { setShowPinModal(false); setVerificationCode(""); }}
                            size="sm"
                            classNames={{ base: "max-w-sm overflow-hidden", body: "p-0" }}
                        >
                            <ModalContent>
                                <ModalBody>
                                    {/* Modal header */}
                                    <div className="relative overflow-hidden rounded-t-xl bg-linear-to-br from-sky-700 via-sky-600 to-cyan-500 px-5 py-5">
                                        <span className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
                                        <span className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" />
                                        <div className="relative flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/30">
                                                    <Icon icon="solar:key-bold-duotone" className="text-xl text-white" />
                                                </span>
                                                <div>
                                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-200/80">ยืนยันการเชื่อมต่อ</p>
                                                    <p className="text-base font-bold text-white">กรอกรหัส 6 หลัก</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setShowPinModal(false); setVerificationCode(""); }}
                                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
                                            >
                                                <Icon icon="solar:close-circle-bold" className="text-lg" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Modal body */}
                                    <div className="p-5 space-y-5">
                                        {/* OTP input */}
                                        <div className="flex flex-col items-center gap-3">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-default-400">
                                                รหัสจากมือถืออาจารย์ / TA
                                            </p>
                                            <InputOtp
                                                length={6}
                                                value={verificationCode}
                                                onValueChange={setVerificationCode}
                                                onComplete={handleConfirm}
                                                variant="bordered"
                                                color="primary"
                                                classNames={{
                                                    segment: "h-14 w-11 text-2xl font-bold bg-slate-900 text-white border-slate-700 data-[active=true]:border-sky-500",
                                                    segmentWrapper: "gap-2",
                                                }}
                                            />
                                        </div>

                                        {/* Ref / detail card */}
                                        <div className="rounded-2xl border border-default-200 bg-default-50 overflow-hidden divide-y divide-default-100">
                                            <div className="flex items-center justify-between px-4 py-2.5 bg-default-100/60">
                                                <span className="text-[11px] font-semibold uppercase tracking-widest text-default-400">รายละเอียดการจับคู่</span>
                                            </div>
                                            <div className="flex items-center justify-between px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Icon icon="solar:monitor-bold-duotone" className="text-base text-default-400 shrink-0" />
                                                    <span className="text-sm text-default-500">Device Code (Ref.)</span>
                                                </div>
                                                <span className="font-mono text-sm font-bold tracking-[0.2em] text-foreground">
                                                    {bootstrap.pairing_id.slice(-4).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Icon icon="solar:lock-keyhole-bold-duotone" className="text-base text-default-400 shrink-0" />
                                                    <span className="text-sm text-default-500">ใช้งานได้ครั้งเดียว</span>
                                                </div>
                                                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">Single use</span>
                                            </div>
                                            <div className="flex items-center justify-between px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Icon icon="solar:clock-circle-bold-duotone" className="text-base text-default-400 shrink-0" />
                                                    <span className="text-sm text-default-500">หมดอายุใน</span>
                                                </div>
                                                <span className="font-mono text-sm font-semibold text-amber-600">{getCountdownLabel(bootstrap.expires_at)}</span>
                                            </div>
                                        </div>

                                        {/* Security notice */}
                                        <div className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                                            <Icon icon="solar:shield-warning-bold-duotone" className="mt-0.5 shrink-0 text-xl text-amber-500" />
                                            <p className="text-xs leading-relaxed text-amber-700">
                                                ตรวจสอบว่า Device Code ตรงกับที่แสดงในมือถือของอาจารย์ เพื่อป้องกันการจับคู่ผิดจอ
                                            </p>
                                        </div>

                                        {/* Confirm button */}
                                        <Button
                                            color="primary"
                                            className="w-full h-12 bg-sky-600 text-base font-semibold"
                                            isDisabled={verificationCode.length !== 6}
                                            isLoading={isSubmittingCode}
                                            onPress={handleConfirm}
                                        >
                                            <Icon icon="solar:check-circle-bold-duotone" className="text-lg" />
                                            ยืนยันหน้าจอนี้
                                        </Button>
                                    </div>
                                </ModalBody>
                            </ModalContent>
                        </Modal>
                    </>
                )}

                {pageState === "active" && current && (
                    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="space-y-6">
                            <Card className="border border-emerald-100 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                                <CardBody className="gap-6 p-6 lg:p-8">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="space-y-2">
                                            <Chip className="bg-emerald-100 px-3 text-emerald-700">Display Active</Chip>
                                            <h2 className="text-2xl font-black text-slate-900">{current.session?.title || "Attendance Session"}</h2>
                                            <p className="text-sm text-slate-500">
                                                {current.session?.course?.code} {current.session?.course?.name ? `- ${current.session.course.name}` : ""}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                            สิทธิ์นี้หมดอายุ {formatDateTime(current.expires_at)}
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <div className="rounded-3xl bg-sky-600 p-5 text-white">
                                            <p className="text-xs uppercase tracking-[0.2em] text-sky-100">Session Status</p>
                                            <p className="mt-2 text-lg font-bold">{current.session?.status === "active" ? "กำลังเปิดรับ" : current.session?.status === "draft" ? "ยังไม่เปิด" : "ปิดแล้ว"}</p>
                                        </div>
                                        <div className="rounded-3xl bg-sky-50 p-5">
                                            <p className="text-xs uppercase tracking-[0.2em] text-sky-700">Check-In Window</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-800">{formatDateTime(current.session?.start_time)} - {formatDateTime(current.session?.end_time)}</p>
                                        </div>
                                        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Section</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-800">{current.session?.section?.section_no || "ทุก section"}</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-4">
                                        <div className="rounded-3xl bg-emerald-50 p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Checked In</p>
                                            <p className="mt-2 text-3xl font-black text-emerald-700">{stats.checkedIn}</p>
                                        </div>
                                        <div className="rounded-3xl bg-sky-50 p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-sky-700">Present</p>
                                            <p className="mt-2 text-3xl font-black text-sky-700">{stats.present}</p>
                                        </div>
                                        <div className="rounded-3xl bg-amber-50 p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Late</p>
                                            <p className="mt-2 text-3xl font-black text-amber-700">{stats.late}</p>
                                        </div>
                                        <div className="rounded-3xl bg-rose-50 p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-rose-700">Absent</p>
                                            <p className="mt-2 text-3xl font-black text-rose-700">{stats.absent}</p>
                                        </div>
                                    </div>

                                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">หน้านี้พร้อมให้เช็คชื่อแล้ว</p>
                                                <p className="text-sm text-slate-500">ให้นักศึกษาสแกน QR หรือเข้า URL ด้านขวาเพื่อไปยังหน้ากรอก PIN ส่วนรายการด้านล่างจะอัปเดตสดแบบ read-only</p>
                                            </div>
                                            <Button variant="flat" color="warning" onPress={handleResetDisplay}>
                                                รีเซ็ตหน้าจอ
                                            </Button>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>

                            <Card className="border border-slate-200 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                                <CardBody className="gap-4 p-6 lg:p-8">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900">รายการเช็คชื่อล่าสุด</h3>
                                            <p className="text-sm text-slate-500">แสดงเฉพาะข้อมูลที่จำเป็นสำหรับจอห้องเรียน</p>
                                        </div>
                                        <Chip className="bg-slate-100 text-slate-700">ทั้งหมด {stats.total}</Chip>
                                    </div>

                                    {recentRecords.length === 0 ? (
                                        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                                            ยังไม่มีนักศึกษาเช็คชื่อในรอบนี้
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {recentRecords.map((record) => (
                                                <div key={record.id} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold text-slate-900">{record.student?.full_name || "นักศึกษา"}</p>
                                                        <p className="text-xs text-slate-500">{record.student?.student_id || "-"}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Chip className={record.status === "present" ? "bg-emerald-100 text-emerald-700" : record.status === "late" ? "bg-amber-100 text-amber-700" : record.status === "leave" ? "bg-slate-100 text-slate-700" : "bg-rose-100 text-rose-700"}>
                                                            {record.status === "present" ? "มา" : record.status === "late" ? "สาย" : record.status === "leave" ? "ลา" : "ขาด"}
                                                        </Chip>
                                                        <span className="min-w-18 text-right font-mono text-sm text-slate-600">{formatTime(record.check_in_time)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </div>

                        <Card className="border border-slate-200 bg-white/95">
                            <CardBody className="items-center gap-5 p-6 text-center lg:p-8">
                                <div className="space-y-2">
                                    <Chip className="bg-sky-100 px-3 text-sky-700">Student Check-In</Chip>
                                    <h3 className="text-xl font-bold text-slate-900">QR สำหรับนักศึกษา</h3>
                                    <p className="text-sm text-slate-500">นักศึกษาจะยังต้องล็อกอิน Google และกรอก PIN ตาม flow เดิมของระบบ</p>
                                </div>

                                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-inner">
                                    <QRCodeSVG value={checkInUrl} size={240} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                                </div>

                                <div className="w-full rounded-3xl bg-slate-950 px-5 py-4 text-left text-white">
                                    <p className="text-xs uppercase tracking-[0.24em] text-sky-200">Check-In URL</p>
                                    <p className="mt-2 break-all font-mono text-xs text-sky-50">{checkInUrl}</p>
                                </div>

                                <div className="grid w-full grid-cols-2 gap-3">
                                    <div className="rounded-3xl bg-slate-100 px-4 py-3 text-left">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Leave</p>
                                        <p className="mt-2 text-2xl font-black text-slate-700">{stats.leave}</p>
                                    </div>
                                    <div className="rounded-3xl bg-white px-4 py-3 text-left ring-1 ring-slate-200">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Live Feed</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-800">{socketRef.current ? "เชื่อมต่ออยู่" : "กำลังเชื่อมต่อ"}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}