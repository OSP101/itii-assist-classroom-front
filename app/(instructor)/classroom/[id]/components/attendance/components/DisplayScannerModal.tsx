/**
 * DisplayScannerModal - Two-step display pairing
 *
 * Step 1 (scan)       - Camera only; finds pairing QR on the projector screen.
 * Step 2 (code-ready) - OTP-bank-style verification code with ref, countdown,
 *                       and security confirmation - instructor types on projector.
 */

"use client";

import React, {
    memo,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    Modal,
    ModalContent,
    ModalBody,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import jsQR from "jsqr";

import attendanceDisplayService, {
    type AttendanceDisplayClaimResult,
} from "@/services/attendance-display.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { type SessionWithComputedStatus } from "../config";

// --- types -------------------------------------------------------------------

type ScanStep =
    | "idle"
    | "requesting-camera"
    | "scanning"
    | "claiming"
    | "code-ready"
    | "camera-denied"
    | "error";

interface DisplayScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: SessionWithComputedStatus | null;
}

// --- helpers -----------------------------------------------------------------

function extractPairingToken(raw: string): string | null {
    try {
        const url = new URL(raw);
        return url.searchParams.get("t");
    } catch {
        return null;
    }
}

function formatCountdown(s: number): string {
    if (s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
}

function buildRefCode(pairingId: string): string {
    return pairingId.slice(-8).toUpperCase();
}

// --- component ---------------------------------------------------------------

const DisplayScannerModal = memo(function DisplayScannerModal({
    isOpen,
    onClose,
    session,
}: DisplayScannerModalProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    const t = (th: string, en: string) => (isEnglish ? en : th);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);
    const claimedRef = useRef(false);

    const [step, setStep] = useState<ScanStep>("idle");
    const [claimResult, setClaimResult] = useState<AttendanceDisplayClaimResult | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [secondsLeft, setSecondsLeft] = useState(0);

    // expiry countdown
    useEffect(() => {
        if (step !== "code-ready" || !claimResult) return;

        const compute = () => {
            const now = Date.now();
            const exp = new Date(claimResult.pairing.expires_at).getTime();
            return Math.max(0, Math.floor((exp - now) / 1000));
        };

        setSecondsLeft(compute());
        const id = setInterval(() => {
            const s = compute();
            setSecondsLeft(s);
            if (s <= 0) clearInterval(id);
        }, 1000);

        return () => clearInterval(id);
    }, [step, claimResult]);

    const stopCamera = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    const claimPairing = useCallback(
        async (token: string) => {
            if (!session) return;
            claimedRef.current = true;
            stopCamera();
            setStep("claiming");

            try {
                const result = await attendanceDisplayService.claimPairing(token, session.id);
                setClaimResult(result);
                setStep("code-ready");
            } catch (err) {
                setErrorMessage(
                    err instanceof Error
                        ? err.message
                        : t("ยืนยันไม่สำเร็จ กรุณาลองอีกครั้ง", "Claim failed. Please try again."),
                );
                setStep("error");
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [session, stopCamera],
    );

    const startScanLoop = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        const tick = () => {
            if (claimedRef.current) return;

            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, canvas.width, canvas.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code?.data) {
                    const token = extractPairingToken(code.data);
                    if (token) {
                        claimPairing(token);
                        return;
                    }
                }
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
    }, [claimPairing]);

    const startCamera = useCallback(async () => {
        claimedRef.current = false;
        setStep("requesting-camera");
        setClaimResult(null);
        setErrorMessage("");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });

            if (!videoRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }

            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();

            setStep("scanning");
            startScanLoop();
        } catch (err) {
            const name = (err as DOMException)?.name;
            if (name === "NotAllowedError" || name === "PermissionDeniedError") {
                setStep("camera-denied");
            } else {
                setErrorMessage(
                    err instanceof Error ? err.message : t("ไม่สามารถเปิดกล้องได้", "Unable to open camera"),
                );
                setStep("error");
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startScanLoop]);

    useEffect(() => {
        if (isOpen && session) {
            startCamera();
        }
        return () => {
            stopCamera();
            claimedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, session]);

    const handleClose = () => {
        stopCamera();
        claimedRef.current = false;
        setStep("idle");
        setClaimResult(null);
        setErrorMessage("");
        onClose();
    };

    const handleRetry = () => {
        setStep("idle");
        setClaimResult(null);
        setErrorMessage("");
        startCamera();
    };

    const copyCode = () => {
        if (!claimResult?.verification_code) return;
        navigator.clipboard.writeText(claimResult.verification_code);
        addToast({
            title: t("คัดลอกแล้ว", "Copied"),
            description: t("รหัสยืนยันถูกคัดลอกแล้ว", "Verification code copied."),
            color: "success",
            timeout: 2000,
            shouldShowTimeoutProgress: true,
        });
    };

    // ---------------------------------------------------------------------------
    // STEP 1: SCAN VIEW
    // ---------------------------------------------------------------------------
    const isScanPhase =
        step === "idle" || step === "requesting-camera" || step === "scanning" || step === "claiming";

    const renderScanView = () => (
        <>
            <div className="relative overflow-hidden bg-linear-to-br from-sky-700 via-sky-600 to-cyan-500 px-5 py-4 rounded-t-xl">
                <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-2 ring-white/30">
                            <Icon icon="solar:camera-minimalistic-bold-duotone" className="text-lg text-white" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-200/80">
                                {t("สแกน QR หน้าจอฉาย", "Scan projector QR")}
                            </p>
                            <p className="truncate text-sm font-bold text-white">{session?.title}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                    >
                        <Icon icon="solar:close-circle-bold" className="text-lg" />
                    </button>
                </div>
            </div>

            <div className="relative w-full overflow-hidden bg-black aspect-[4/3]">
                <style>{`
                    @keyframes scan-line {
                        0%   { transform: translateY(0px);   opacity: 1; }
                        50%  { transform: translateY(208px); opacity: 0.9; }
                        100% { transform: translateY(0px);   opacity: 1; }
                    }
                `}</style>

                <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" autoPlay playsInline muted />
                <canvas ref={canvasRef} className="hidden" />

                {(step === "idle" || step === "requesting-camera") && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
                        <Spinner color="primary" size="lg" />
                        <p className="text-sm text-white/60">{t("กำลังเปิดกล้อง...", "Opening camera...")}</p>
                    </div>
                )}

                {step === "claiming" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/95 backdrop-blur-sm">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-900/50 ring-2 ring-sky-400/30">
                            <Spinner color="primary" size="lg" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-white">{t("พบ QR Code!", "QR code found!")}</p>
                            <p className="mt-0.5 text-xs text-white/50">{t("กำลังสร้างรหัสยืนยัน...", "Generating verification code...")}</p>
                        </div>
                    </div>
                )}

                {step === "scanning" && (
                    <>
                        <div className="pointer-events-none absolute inset-0 bg-black/40" />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="relative h-52 w-52">
                                <span className="absolute left-0 top-0 h-9 w-9 border-l-[3px] border-t-[3px] border-sky-400 rounded-tl-xl" />
                                <span className="absolute right-0 top-0 h-9 w-9 border-r-[3px] border-t-[3px] border-sky-400 rounded-tr-xl" />
                                <span className="absolute bottom-0 left-0 h-9 w-9 border-b-[3px] border-l-[3px] border-sky-400 rounded-bl-xl" />
                                <span className="absolute bottom-0 right-0 h-9 w-9 border-b-[3px] border-r-[3px] border-sky-400 rounded-br-xl" />
                                <div
                                    className="absolute inset-x-3 h-[2px] rounded-full bg-gradient-to-r from-transparent via-sky-400 to-transparent"
                                    style={{ animation: "scan-line 2s ease-in-out infinite" }}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="flex items-center justify-center gap-2 bg-slate-950 py-3 rounded-b-xl min-h-[44px]">
                {step === "scanning" && (
                    <>
                        <Icon icon="solar:monitor-bold-duotone" className="text-base text-sky-400 shrink-0" />
                        <p className="text-xs text-slate-400">
                            {t("ชี้กล้องนี้ไปที่ QR Code บนจอหน้าห้อง", "Point this camera at the QR code on the projector")}
                        </p>
                    </>
                )}
            </div>
        </>
    );

    // ---------------------------------------------------------------------------
    // STEP 2: CODE READY (OTP-bank style)
    // ---------------------------------------------------------------------------
    const renderCodeView = () => {
        if (!claimResult) return null;

        const digits = claimResult.verification_code.split("");
        const refCode = buildRefCode(claimResult.pairing.id);
        const isExpired = secondsLeft <= 0;
        const isUrgent = secondsLeft > 0 && secondsLeft <= 30;

        return (
            <>
                <div className="relative overflow-hidden rounded-t-xl bg-linear-to-br from-sky-700 via-sky-600 to-cyan-500 px-5 py-5">
                    <span className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
                    <span className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" />
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/30">
                                <Icon icon="solar:monitor-smartphone-bold-duotone" className="text-xl text-white" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-200/80">
                                    {t("รหัสยืนยันการเชื่อมต่อ", "Display verification code")}
                                </p>
                                <p className="truncate text-base font-bold text-white">{session?.title}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                        >
                            <Icon icon="solar:close-circle-bold" className="text-lg" />
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-5">
                    <div className="flex flex-col items-center gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-default-400">
                            {t("กรอกรหัสนี้บนจอฉาย", "Enter this code on the projector")}
                        </p>

                        <button
                            onClick={copyCode}
                            className="group flex gap-2 focus:outline-none"
                            title={t("แตะเพื่อคัดลอก", "Tap to copy")}
                        >
                            {digits.map((digit, i) => (
                                <div
                                    key={i}
                                    className={[
                                        "flex h-14 w-10 items-center justify-center rounded-xl font-mono text-2xl font-bold shadow-inner transition",
                                        "sm:h-16 sm:w-12 sm:text-3xl",
                                        isExpired
                                            ? "bg-slate-200 text-slate-400 ring-2 ring-slate-300"
                                            : isUrgent
                                                ? "bg-rose-900 text-rose-100 ring-2 ring-rose-600 group-hover:ring-rose-400"
                                                : "bg-slate-900 text-white ring-2 ring-slate-700 group-hover:ring-sky-500",
                                    ].join(" ")}
                                >
                                    {isExpired ? "-" : digit}
                                </div>
                            ))}
                        </button>

                        {!isExpired && (
                            <div className="flex items-center gap-1.5 text-default-400">
                                <Icon icon="solar:copy-line-duotone" className="text-sm" />
                                <span className="text-xs">{t("แตะรหัสเพื่อคัดลอก", "Tap code to copy")}</span>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-default-200 bg-default-50 overflow-hidden divide-y divide-default-100">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-default-100/60">
                            <span className="text-[11px] font-semibold uppercase tracking-widest text-default-400">
                                {t("รายละเอียดการเชื่อมต่อ", "Connection details")}
                            </span>
                            {!isExpired ? (
                                <span className={["flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold font-mono", isUrgent ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-700"].join(" ")}>
                                    <Icon icon={isUrgent ? "solar:danger-circle-bold-duotone" : "solar:clock-circle-bold-duotone"} className="text-sm" />
                                    {formatCountdown(secondsLeft)}
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                                    <Icon icon="solar:close-circle-bold" className="text-sm" />
                                    {t("หมดอายุแล้ว", "Expired")}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:hashtag-square-bold-duotone" className="text-base text-default-400 shrink-0" />
                                <span className="text-sm text-default-500">{t("รหัสอ้างอิง (Ref.)", "Reference code")}</span>
                            </div>
                            <span className="font-mono text-sm font-bold tracking-widest text-foreground">{refCode}</span>
                        </div>

                        <div className="flex items-center justify-between gap-4 px-4 py-3">
                            <div className="flex items-center gap-2 shrink-0">
                                <Icon icon="solar:calendar-bold-duotone" className="text-base text-default-400 shrink-0" />
                                <span className="text-sm text-default-500">{t("เซสชัน", "Session")}</span>
                            </div>
                            <span className="text-sm font-medium text-foreground text-right truncate max-w-[180px]">{session?.title}</span>
                        </div>

                        <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:lock-keyhole-bold-duotone" className="text-base text-default-400 shrink-0" />
                                <span className="text-sm text-default-500">{t("ใช้งานได้ครั้งเดียว", "One-time use")}</span>
                            </div>
                            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                                {t("1 ครั้งเท่านั้น", "Single use")}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                        <Icon icon="solar:shield-warning-bold-duotone" className="mt-0.5 shrink-0 text-xl text-amber-500" />
                        <p className="text-xs leading-relaxed text-amber-700">
                            {t(
                                "ตรวจสอบ Ref. ให้ตรงกับที่แสดงบนจอฉาย ห้ามแชร์รหัสกับนักศึกษา รหัสนี้ให้สิทธิ์ควบคุมหน้าเช็คชื่อทันที",
                                "Verify Ref. matches the projector. Never share this code with students - it grants immediate control of the attendance display.",
                            )}
                        </p>
                    </div>

                    <div className="space-y-2">
                        {[
                            { icon: "solar:monitor-bold-duotone", text: t("บนจอฉาย: กรอกรหัส 6 หลักในช่องยืนยัน", "On projector: enter the 6-digit code in the Verify field") },
                            { icon: "solar:check-circle-bold-duotone", text: t("จอฉายจะเปิดหน้าแสดงผลเช็คชื่อโดยอัตโนมัติ", "The projector will open the live attendance display automatically") },
                        ].map(({ icon, text }, idx) => (
                            <div key={idx} className="flex items-start gap-3 rounded-xl bg-content2 px-3 py-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-[11px] font-bold text-sky-600">
                                    {idx + 1}
                                </span>
                                <div className="flex items-center gap-2 min-w-0">
                                    <Icon icon={icon} className="text-base text-default-400 shrink-0" />
                                    <p className="text-xs text-default-600 leading-relaxed">{text}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2 pt-1">
                        <Button variant="flat" size="sm" className="flex-1 text-default-500" onPress={handleRetry}>
                            <Icon icon="solar:camera-add-bold" className="text-base" />
                            {t("สแกนใหม่", "Scan again")}
                        </Button>
                        <Button variant="flat" size="sm" color="primary" className="flex-1" onPress={copyCode} isDisabled={isExpired}>
                            <Icon icon="solar:copy-bold" className="text-base" />
                            {t("คัดลอกรหัส", "Copy code")}
                        </Button>
                    </div>
                    <Button
                        variant="flat"
                        size="sm"
                        className="w-full text-default-500"
                        onPress={handleClose}
                    >
                        <Icon icon="solar:close-circle-bold-duotone" className="text-base" />
                        {t("ปิด", "Close")}
                    </Button>
                </div>
            </>
        );
    };

    // ---------------------------------------------------------------------------
    // ERROR / PERMISSION DENIED
    // ---------------------------------------------------------------------------
    const renderErrorView = () => (
        <>
            <div className="relative overflow-hidden rounded-t-xl bg-linear-to-br from-sky-700 via-sky-600 to-cyan-500 px-5 py-4">
                <div className="relative flex items-center justify-between">
                    <p className="font-bold text-white">
                        {step === "camera-denied" ? t("ไม่ได้รับอนุญาตใช้กล้อง", "Camera permission denied") : t("เกิดข้อผิดพลาด", "An error occurred")}
                    </p>
                    <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
                        <Icon icon="solar:close-circle-bold" className="text-lg" />
                    </button>
                </div>
            </div>

            <div className="flex flex-col items-center gap-4 p-6">
                <div className={["flex h-16 w-16 items-center justify-center rounded-full ring-4", step === "camera-denied" ? "bg-amber-50 ring-amber-100" : "bg-rose-50 ring-rose-100"].join(" ")}>
                    <Icon
                        icon={step === "camera-denied" ? "solar:camera-square-bold-duotone" : "solar:close-circle-bold-duotone"}
                        className={["text-3xl", step === "camera-denied" ? "text-amber-500" : "text-rose-500"].join(" ")}
                    />
                </div>

                <p className="text-center text-sm text-default-500">
                    {step === "camera-denied"
                        ? t("กรุณาอนุญาตการเข้าถึงกล้องในการตั้งค่าเบราว์เซอร์ แล้วลองใหม่อีกครั้ง", "Allow camera access in browser settings, then try again.")
                        : errorMessage}
                </p>

                {step === "camera-denied" && (
                    <div className="w-full rounded-2xl border border-default-100 bg-content2 px-4 py-3 text-center">
                        <p className="text-xs text-default-500">
                            {t("หรือเปิดลิงก์ /m/pair บนมือถือเพื่อจับคู่ด้วยตนเอง", "Or open /m/pair on your phone to pair manually.")}
                        </p>
                    </div>
                )}

                <Button color="primary" onPress={handleRetry}>
                    <Icon icon="solar:restart-bold" className="mr-1" />
                    {t("ลองอีกครั้ง", "Try again")}
                </Button>
            </div>
        </>
    );

    // ---------------------------------------------------------------------------
    // MODAL SHELL
    // ---------------------------------------------------------------------------
    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            size="md"
            classNames={{ base: "max-w-md overflow-hidden", body: "p-0" }}
        >
            <ModalContent>
                <ModalBody>
                    {(step === "camera-denied" || step === "error") && renderErrorView()}
                    {step === "code-ready" && renderCodeView()}
                    {isScanPhase && renderScanView()}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
});

export default DisplayScannerModal;
