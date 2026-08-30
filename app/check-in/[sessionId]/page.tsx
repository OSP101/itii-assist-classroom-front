"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { InputOtp } from "@heroui/input-otp";
import { Spinner } from "@heroui/spinner";
import { Avatar } from "@heroui/avatar";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { getRealtimeSocketBaseUrl, io, Socket } from "@/services/realtime-socket";
import attendanceService, { AttendanceRequestError, type AttendanceSession } from "@/services/attendance.service";
import { authService } from "@/services/auth.service";
import { storeOAuthReturnPath } from "@/lib/auth-resume";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useI18n } from "@/hooks/useI18n";
import { useAttendancePinPresentation } from "@/hooks/useAttendancePinPresentation";
import { buildCourseTitleContext, buildPageTitle } from "@/lib/page-title";
import { collectClientDeviceSignals, type ClientDeviceSignals } from "@/lib/device-signals";

// Check-in step type
type Step = "loading" | "redirecting" | "session-info" | "google-login" | "location" | "pin-entry" | "success" | "error" | "already-checked-in" | "blocked";

type NetworkGuardCheck = "device" | "network" | "domain";

const NETWORK_GUARD_MESSAGES: Record<NetworkGuardCheck, { th: string; en: string; icon: string }> = {
    device: {
        th: "ต้องเช็กชื่อผ่านมือถือหรือแท็บเล็ตเท่านั้น ไม่รองรับคอมพิวเตอร์/โน้ตบุ๊ก",
        en: "Check-in requires a mobile phone or tablet — desktop/laptop is not supported.",
        icon: "solar:smartphone-2-bold-duotone",
    },
    domain: {
        th: "กรุณาเข้าผ่านลิงก์ของคณะ (cocolabs.computing.kku.ac.th) เท่านั้น",
        en: "Please open the check-in link on the faculty domain (cocolabs.computing.kku.ac.th) only.",
        icon: "solar:link-bold-duotone",
    },
    network: {
        th: "กรุณาเชื่อมต่อ Wi-Fi ของมหาวิทยาลัยขอนแก่น (ห้ามใช้ VPN หรืออินเทอร์เน็ตมือถือ)",
        en: "Please connect to KKU campus Wi-Fi (VPN and mobile data are not allowed).",
        icon: "solar:wi-fi-router-bold-duotone",
    },
};

function getAttendanceErrorInfo(error: unknown, fallbackTitle: string, fallbackMessage: string) {
    if (error instanceof AttendanceRequestError) {
        return {
            title: error.title || fallbackTitle,
            message: error.message || fallbackMessage,
            code: error.code,
        };
    }

    if (error instanceof Error) {
        return {
            title: fallbackTitle,
            message: error.message || fallbackMessage,
        };
    }

    return {
        title: fallbackTitle,
        message: fallbackMessage,
    };
}

export default function StudentCheckInPage() {
    const router = useRouter();
    const params = useParams();
    const sessionId = Number(params.sessionId);
    const { language } = useGlobalSettings();
    const t = useI18n();
    const locale = language === "en" ? "en-US" : "th-TH";

    // State
    const [step, setStep] = useState<Step>("loading");
    const [session, setSession] = useState<AttendanceSession | null>(null);
    const [googleUser, setGoogleUser] = useState<{
        email: string;
        name: string;
        googleId: string;
        idToken: string;
        picture?: string;
    } | null>(null);
    const [studentInfo, setStudentInfo] = useState<{
        id: number;
        student_id: string;
        full_name: string;
        email: string;
    } | null>(null);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [pinCode, setPinCode] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitElapsedSeconds, setSubmitElapsedSeconds] = useState(0);
    const [checkInResult, setCheckInResult] = useState<{
        status: string;
        check_in_time: string;
        location_verified: boolean;
        distance_meters: number | null;
    } | null>(null);
    const [errorTitle, setErrorTitle] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
    const [alreadyCheckedIn, setAlreadyCheckedIn] = useState<{
        status: string;
        check_in_time: string;
    } | null>(null);
    const [blockedReasons, setBlockedReasons] = useState<NetworkGuardCheck[]>([]);
    const redirectingRef = useRef(false);

    // Force check-in links onto the canonical faculty domain — whatever
    // domain the link was opened from (an alias, an IP, anything), the
    // backend's campus network guard only trusts the private LAN IP when
    // the request actually arrives on the canonical host, so bounce there
    // immediately before fetching anything.
    useEffect(() => {
        const canonical = (process.env.NEXT_PUBLIC_FRONTEND_URL || "").replace(/\/$/, "");
        if (!canonical || typeof window === "undefined") {
            return;
        }
        if (window.location.origin === canonical) {
            return;
        }
        redirectingRef.current = true;
        setStep("redirecting");
        window.location.replace(`${canonical}${window.location.pathname}${window.location.search}`);
    }, []);

    useEffect(() => {
        const pageLabel = language === "en" ? "Student Check-In" : "เช็กชื่อเข้าเรียน";
        const courseContext = buildCourseTitleContext(session?.course);
        document.title = buildPageTitle(pageLabel, courseContext);
    }, [language, session?.course]);

    useEffect(() => {
        const shouldAutoRedirect = step === "error" && authService.isAuthenticated();
        if (!shouldAutoRedirect) {
            setRedirectCountdown(null);
            return;
        }

        setRedirectCountdown(5);
        const interval = window.setInterval(() => {
            setRedirectCountdown((prev) => {
                if (prev == null) {
                    return 5;
                }
                if (prev <= 1) {
                    window.clearInterval(interval);
                    router.replace("/student/scan");
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            window.clearInterval(interval);
        };
    }, [router, step]);

    // Socket ref
    const socketRef = useRef<Socket | null>(null);
    const checkInRequestIdRef = useRef("");

    // Kept in a ref (not state) so re-collecting never triggers a re-render;
    // started fresh after every attempt (see handleCheckIn) rather than once
    // for the whole page, so a retry reports the device state at the time of
    // that retry instead of a stale snapshot from page load.
    const clientSignalsRef = useRef<Promise<ClientDeviceSignals> | null>(null);
    const startCollectingClientSignals = useCallback(() => {
        clientSignalsRef.current = collectClientDeviceSignals();
    }, []);

    // Kicked off on mount (not at submit time) so the ~400ms motion-event
    // wait (see lib/device-signals.ts) has usually already resolved by the
    // time the student finishes entering the PIN on their first attempt.
    useEffect(() => {
        startCollectingClientSignals();
    }, [startCollectingClientSignals]);

    const { secondsLeft, totalSeconds } = useAttendancePinPresentation(session);
    const pinCountdown = secondsLeft;
    const pinTotal = totalSeconds;

    // Fetch session info
    const fetchSessionInfo = useCallback(async () => {
        try {
            const data = await attendanceService.getSessionInfo(sessionId);
            if (data) {
                setSession(data);
                if (data.status === "active") {
                    if (data.network_guard && !data.network_guard.exempt && !data.network_guard.allowed) {
                        setBlockedReasons(data.network_guard.failed_checks);
                        setStep("blocked");
                        return;
                    }
                    if (authService.isAuthenticated()) {
                        try {
                            const result = await attendanceService.verifyCurrentStudentSession(sessionId);
                            if (result) {
                                setStudentInfo(result.student);
                                setGoogleUser({
                                    email: result.student.email,
                                    name: result.student.full_name,
                                    googleId: "",
                                    idToken: "",
                                });

                                if (result.already_checked_in) {
                                    setAlreadyCheckedIn({
                                        status: result.status || "present",
                                        check_in_time: result.check_in_time || "",
                                    });
                                    setStep("already-checked-in");
                                } else if (data.check_location) {
                                    setStep("location");
                                } else {
                                    setStep("pin-entry");
                                }
                                return;
                            }
                        } catch {
                            router.replace("/student/scan");
                            return;
                        }
                    }

                    setStep("google-login");
                } else if (data.status === "closed") {
                    setErrorTitle(t("accessUnavailable"));
                    setErrorMessage(t("sessionClosedAlready"));
                    setStep("error");
                } else {
                    setErrorTitle(t("accessUnavailable"));
                    setErrorMessage(t("sessionNotOpenYet"));
                    setStep("error");
                }
            } else {
                setErrorTitle(t("accessUnavailable"));
                setErrorMessage(t("attendanceSessionNotFound"));
                setStep("error");
            }
        } catch (error: unknown) {
            console.error("Error fetching session:", error);
            const info = getAttendanceErrorInfo(error, t("accessUnavailable"), t("unableToLoadData"));
            setErrorTitle(info.title);
            setErrorMessage(info.message);
            setStep("error");
        }
    }, [router, sessionId, t]);

    // Pulls only the rotating-PIN fields and merges them into the session the
    // same way the "attendance-pin-updated" socket event does. Deliberately
    // does NOT touch `step` the way fetchSessionInfo does — resyncing the PIN
    // must never bounce a student who is already at the PIN entry step back to
    // the location or login step.
    const refreshPinState = useCallback(async () => {
        try {
            const data = await attendanceService.getSessionInfo(sessionId);
            if (!data) {
                return;
            }
            setSession((prev) => prev
                ? {
                    ...prev,
                    pin_code: data.pin_code ?? prev.pin_code,
                    pin_rotates_at: data.pin_rotates_at ?? prev.pin_rotates_at,
                    pin_issued_at: data.pin_issued_at ?? prev.pin_issued_at,
                    auto_rotate_pin: data.auto_rotate_pin ?? prev.auto_rotate_pin,
                    pin_mode: data.pin_mode ?? prev.pin_mode,
                }
                : prev);
        } catch (error) {
            // Non-fatal: the socket event or the next poll attempt recovers.
            console.error("Failed to refresh attendance PIN state:", error);
        }
    }, [sessionId]);

    // Google login: a full top-level redirect through the backend OAuth flow
    // (same one /student/login uses), not the Google Identity Services JS
    // widget. GIS's button relies on a popup or FedCM, both of which Google
    // blocks or browsers can silently no-op inside embedded in-app browsers
    // (QR scanner apps, LINE, etc.) — the button renders but taps do
    // nothing. A plain navigation works everywhere. fetchSessionInfo()
    // already knows how to resume the check-in flow once the redirect back
    // here finds an authenticated session (see the isAuthenticated() branch
    // above).
    const handleGoogleLogin = () => {
        storeOAuthReturnPath(`/check-in/${sessionId}`);
        window.location.href = authService.getGoogleAuthUrl("student");
    };

    // Get current location
    const getLocation = () => {
        setIsGettingLocation(true);
        setLocationError(null);

        if (!navigator.geolocation) {
            setLocationError(t("browserDoesNotSupportGeolocation"));
            setIsGettingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
                setIsGettingLocation(false);
                setStep("pin-entry");
            },
            (error) => {
                console.error("Geolocation error:", error);
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        setLocationError(t("pleaseAllowLocationAccess"));
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setLocationError(t("locationUnavailable"));
                        break;
                    case error.TIMEOUT:
                        setLocationError(t("locationTimeout"));
                        break;
                    default:
                        setLocationError(t("locationError"));
                }
                setIsGettingLocation(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    };

    // Skip location (proceed without location)
    const skipLocation = () => {
        setStep("pin-entry");
    };

    // Submit check-in
    const handleCheckIn = async () => {
        if (isSubmitting) {
            return;
        }

        if (pinCode.length !== 6) {
            addToast({
                title: t("incompleteInformation"),
                description: t("pleaseEnterSixDigitPin"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        const isAuthenticatedStudent = authService.isAuthenticated();
        if (!isAuthenticatedStudent && (!googleUser || !googleUser.idToken)) {
            addToast({
                title: t("signInFailed"),
                description: t("signInWithGoogle"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            setStep("google-login");
            return;
        }

        if (!checkInRequestIdRef.current) {
            checkInRequestIdRef.current = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${sessionId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }

        setSubmitElapsedSeconds(0);
        setIsSubmitting(true);
        try {
            const clientSignals = await (clientSignalsRef.current ?? (clientSignalsRef.current = collectClientDeviceSignals()));
            // Start the next snapshot immediately so a retry after a failed
            // attempt reports a fresh reading instead of reusing this one.
            startCollectingClientSignals();
            const result = await attendanceService.studentCheckIn(sessionId, {
                pin_code: pinCode,
                google_email: googleUser?.email,
                google_id: googleUser?.googleId,
                google_token: googleUser?.idToken || undefined,
                client_request_id: checkInRequestIdRef.current,
                student_id: studentInfo?.id,
                location_lat: location?.lat,
                location_lng: location?.lng,
                client_signals: clientSignals,
            });

            if (result) {
                if (result.is_duplicate) {
                    addToast({
                        title: language === "en" ? "Already checked in" : "เช็กชื่อไว้แล้ว",
                        description: language === "en" ? "Your previous check-in was already recorded." : "ระบบบันทึกการเช็กชื่อก่อนหน้านี้ไว้แล้ว",
                        color: "primary",
                        timeout: 3500,
                        shouldShowTimeoutProgress: true,
                    });
                }
                setCheckInResult(result);
                setStep("success");
                checkInRequestIdRef.current = "";

                // Emit socket event
                if (socketRef.current) {
                    socketRef.current.emit("student-check-in", {
                        sessionId,
                        studentName: result.student.full_name,
                    });
                }
            }
        } catch (error: unknown) {
            console.error("Error checking in:", error);
            const info = getAttendanceErrorInfo(error, t("checkInFailed"), t("pleaseCheckPinAndTryAgain"));
            const msg = info.message;
            const isBlockingError = info.code !== "ATTENDANCE_INVALID_PIN";

            if (isBlockingError) {
                setErrorTitle(info.title || t("checkInFailed"));
                setErrorMessage(msg);
                setStep("error");
                return;
            }

            const isLocationError = info.title.includes("ตำแหน่ง") || info.title.includes("พื้นที่") || msg.includes("ตำแหน่ง") || msg.includes("พื้นที่") || msg.includes("location");
            addToast({
                title: info.title || (isLocationError ? "ตำแหน่งไม่อยู่ในพื้นที่" : t("checkInFailed")),
                description: msg,
                color: "danger",
                timeout: isLocationError ? 6000 : 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
            setSubmitElapsedSeconds(0);
        }
    };

    const handlePinValueChange = (value: string) => {
        setPinCode(value);
        checkInRequestIdRef.current = "";
    };

    useEffect(() => {
        if (!isSubmitting) {
            return;
        }

        const startedAt = Date.now();
        const interval = window.setInterval(() => {
            setSubmitElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);

        return () => {
            window.clearInterval(interval);
        };
    }, [isSubmitting]);

    // Initialize socket
    useEffect(() => {
    if (redirectingRef.current) {
        return;
    }
    const socketUrl = getRealtimeSocketBaseUrl();

    const socket = io(socketUrl);

        // Every rotation that happened while the socket was down was missed, so
        // a reconnect has to pull the current PIN rather than wait for the next
        // event. The first connect is skipped — fetchSessionInfo just ran.
        let hasConnectedBefore = false;

        socket.on("connect", () => {
            socket.emit("join-attendance", sessionId);
            if (hasConnectedBefore) {
                void refreshPinState();
            }
            hasConnectedBefore = true;
        });

        socket.on("session-closed", () => {
            setErrorTitle(t("accessUnavailable"));
            setErrorMessage(t("sessionHasBeenClosed"));
            setStep("error");
        });

        socket.on("attendance-pin-updated", (data: { pin_code?: string; pin_issued_at?: string | null; pin_rotates_at?: string | null; auto_rotate_pin?: boolean; pin_mode?: AttendanceSession["pin_mode"] }) => {
            setSession((prev) => prev
                ? {
                    ...prev,
                    pin_code: data.pin_code ?? prev.pin_code,
                    pin_rotates_at: data.pin_rotates_at ?? prev.pin_rotates_at,
                    pin_issued_at: data.pin_issued_at ?? prev.pin_issued_at,
                    auto_rotate_pin: data.auto_rotate_pin ?? prev.auto_rotate_pin,
                    pin_mode: data.pin_mode ?? prev.pin_mode,
                }
                : prev);
            setPinCode("");
        });

        socketRef.current = socket;

        return () => {
            socket.emit("leave-attendance", sessionId);
            socket.disconnect();
        };
    }, [refreshPinState, sessionId, t]);

    // Fetch session on mount
    useEffect(() => {
        if (redirectingRef.current) {
            return;
        }
        fetchSessionInfo();
    }, [fetchSessionInfo]);

    const isRotatingPin =
        session?.status === "active" &&
        (session.pin_mode === "rotating" || (session.pin_mode == null && !!session.auto_rotate_pin));

    // Fallback resync, mirroring the one the projector page already runs. The
    // "attendance-pin-updated" socket event is the fast path, but when it never
    // arrives (socket dropped, proxy killed the upgrade, phone slept through
    // the rotation) the countdown used to sit at 0s forever showing a PIN that
    // no longer matches the projector. Polling starts when the window expires
    // and stops as soon as a fresh pin_rotates_at pushes the countdown back
    // above zero, or after maxAttempts so a closed/stuck session can't poll
    // forever.
    useEffect(() => {
        if (!isRotatingPin || pinCountdown === null || pinCountdown > 0) {
            return;
        }

        let disposed = false;
        let attempts = 0;
        const maxAttempts = 12;

        const syncPin = () => {
            if (!disposed) {
                void refreshPinState();
            }
        };

        syncPin();
        const interval = window.setInterval(() => {
            attempts += 1;
            if (attempts >= maxAttempts) {
                window.clearInterval(interval);
                return;
            }
            syncPin();
        }, 1500);

        return () => {
            disposed = true;
            window.clearInterval(interval);
        };
    }, [isRotatingPin, pinCountdown, refreshPinState]);

    // A phone that was locked or backgrounded misses every socket event while
    // it sleeps, so catch up on the current PIN the moment the page is looked
    // at again.
    useEffect(() => {
        if (!isRotatingPin) {
            return;
        }

        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                void refreshPinState();
            }
        };

        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [isRotatingPin, refreshPinState]);

    // Status display
    const statusDisplay: Record<string, { label: string; color: string; icon: string }> = {
        present: { label: t("attendanceStatusPresent"), color: "text-emerald-600 bg-emerald-100", icon: "solar:check-circle-bold" },
        late: { label: t("attendanceStatusLate"), color: "text-amber-600 bg-amber-100", icon: "solar:clock-circle-bold" },
    };

    // Format time
    const formatTime = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    const isEn = language === "en";

    // The guard reports only what failed; showing the passing checks too turns a
    // dead end into a checklist the student can actually work through.
    const guardChecks: Array<{ key: NetworkGuardCheck; label: string; ok: string; fix: string }> = [
        {
            key: "device",
            label: isEn ? "Device" : "อุปกรณ์",
            ok: isEn ? "Using a phone or tablet" : "ใช้โทรศัพท์มือถือหรือแท็บเล็ต",
            fix: isEn
                ? "Open this link on your phone and scan the QR at the front of the room again. Reloading on a computer will not help."
                : "กรุณาใช้โทรศัพท์มือถือ สแกน QR ที่หน้าห้องอีกครั้ง ทั้งนี้ การกดโหลดหน้าใหม่บนคอมพิวเตอร์จะยังไม่สามารถเช็กชื่อได้",
        },
        {
            key: "domain",
            label: isEn ? "Link" : "ลิงก์ที่เข้า",
            ok: isEn ? "Opened on the faculty domain" : "เปิดผ่านโดเมนของคณะแล้ว",
            fix: isEn
                ? "Open the check-in link on cocolabs.computing.kku.ac.th only."
                : "กรุณาเปิดลิงก์เช็กชื่อผ่าน cocolabs.computing.kku.ac.th เท่านั้น",
        },
        {
            key: "network",
            label: isEn ? "Network" : "เครือข่าย",
            ok: isEn ? "Connected to campus Wi-Fi" : "เชื่อมต่อ Wi-Fi ของมหาวิทยาลัยแล้ว",
            fix: isEn
                ? "Open Settings then Wi-Fi and join KKU-WiFi. Turn off any VPN first, then check again."
                : "เปิด ตั้งค่า แล้วเลือก Wi-Fi ของมหาวิทยาลัย หากเปิดใช้งาน VPN อยู่ กรุณาปิดก่อน จากนั้นกดตรวจสอบอีกครั้ง",
        },
    ];

    const deviceBlocked = blockedReasons.includes("device");

    // Which of the three preparation steps the student is on.
    const flowSteps: Array<"google-login" | "location" | "pin-entry"> = [
        ...(!authService.isAuthenticated() ? (["google-login"] as const) : []),
        ...(session?.check_location ? (["location"] as const) : []),
        "pin-entry",
    ];
    const stepIndex = flowSteps.indexOf(step as (typeof flowSteps)[number]);

    const TaskHeader = ({ title }: { title: string }) => (
        <div className="cg-task-top">
            <Link href="/student/scan" className="cg-task-btn" aria-label={isEn ? "Close" : "ปิด"}>
                <Icon icon="solar:close-circle-linear" width={17} height={17} />
            </Link>
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{title}</span>
            <Link href="/student" className="cg-task-btn" aria-label={isEn ? "Home" : "หน้าหลัก"}>
                <Icon icon="solar:home-2-linear" width={17} height={17} />
            </Link>
        </div>
    );

    const SessionCard = () => (
        <div className="cg-card">
            <p className="text-[11px] font-normal" style={{ color: "var(--cg-text-3)" }}>
                {isEn ? "Session you are checking in to" : "คาบเรียนที่กำลังเช็กชื่อ"}
            </p>
            <h1 className="mt-1.5 text-[17px] font-medium leading-relaxed">{session?.title || t("loading")}</h1>
            {session?.course && (
                <p className="mt-1 text-xs font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
                    {session.course.code} {session.course.name}
                </p>
            )}
        </div>
    );

    return (
        <>
            {/* ── loading / redirecting ─────────────────────────────── */}
            {(step === "loading" || step === "redirecting") && (
                <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: "70dvh" }}>
                    <Spinner size="lg" color="primary" />
                    <p className="text-sm font-light" style={{ color: "var(--cg-text-2)" }}>
                        {step === "redirecting"
                            ? (isEn ? "Redirecting to the faculty domain" : "กำลังเปลี่ยนเส้นทางไปยังโดเมนของคณะ")
                            : t("loading")}
                    </p>
                </div>
            )}

            {/* ── blocked by the campus network guard ───────────────── */}
            {step === "blocked" && (
                <div className="cg-task-screen pb-6">
                    <TaskHeader title={isEn ? "Check-in" : "เช็กชื่อเข้าเรียน"} />

                    <div className="flex flex-col items-center gap-2 pt-5 text-center">
                        <span className="cg-state-badge" style={{ background: "var(--cg-warning-soft)", color: "var(--cg-warning)" }}>
                            <Icon icon="solar:shield-warning-linear" width={40} height={40} />
                        </span>
                        <h2 className="mt-1 text-[21px] font-semibold leading-snug">
                            {deviceBlocked
                                ? (isEn ? "Check in from a phone" : "ต้องเช็กชื่อจากมือถือ")
                                : (isEn ? "Cannot check in yet" : "ยังเช็กชื่อไม่ได้")}
                        </h2>
                        <p className="max-w-[32ch] text-[12.5px] font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
                            {deviceBlocked
                                ? (isEn
                                    ? "This page is open on a computer, which cannot be used to check in."
                                    : "ขณะนี้เปิดหน้าเว็บบนคอมพิวเตอร์ ซึ่งไม่รองรับการเช็กชื่อ")
                                : (isEn
                                    ? `${blockedReasons.length} requirement(s) not met. Fix them on this device, then check again.`
                                    : `ไม่ผ่านเงื่อนไข ${blockedReasons.length} ข้อ กรุณาแก้ไขที่เครื่อง แล้วกดตรวจสอบอีกครั้ง`)}
                        </p>
                    </div>

                    <SessionCard />

                    <section className="flex flex-col gap-2">
                        <p className="cg-section-label">{isEn ? "Requirements" : "เงื่อนไขการเช็กชื่อ"}</p>
                        <div className="cg-list">
                            {guardChecks.map((check) => {
                                const failed = blockedReasons.includes(check.key);
                                return (
                                    <div key={check.key} className="cg-check-block">
                                        <div className="cg-row">
                                            <span
                                                className="cg-check-mark"
                                                style={failed
                                                    ? { background: "var(--cg-danger-soft)", color: "var(--cg-danger)" }
                                                    : { background: "var(--cg-success-soft)", color: "var(--cg-success)" }}
                                            >
                                                <Icon icon={failed ? "solar:close-circle-linear" : "solar:check-circle-linear"} width={15} height={15} />
                                            </span>
                                            <span className="cg-row-body">
                                                <span className="cg-row-title" style={failed ? { color: "var(--cg-danger)" } : undefined}>
                                                    {check.label}
                                                </span>
                                                <span className="cg-row-sub">
                                                    {failed
                                                        ? (isEn ? NETWORK_GUARD_MESSAGES[check.key].en : NETWORK_GUARD_MESSAGES[check.key].th)
                                                        : check.ok}
                                                </span>
                                            </span>
                                            <Icon
                                                icon={NETWORK_GUARD_MESSAGES[check.key].icon}
                                                width={17}
                                                height={17}
                                                className="mt-1 shrink-0"
                                                style={{ color: failed ? "var(--cg-danger)" : "var(--cg-text-3)" }}
                                            />
                                        </div>
                                        {failed && (
                                            <div className="cg-hint">
                                                <Icon icon="solar:lightbulb-linear" width={15} height={15} className="mt-0.5 shrink-0" />
                                                <p className="m-0">{check.fix}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <div className="cg-task-cta">
                        {/* Reloading cannot change the device, so that case gets no action
                            that pretends it might. */}
                        {!deviceBlocked && (
                            <button type="button" className="cg-btn" onClick={() => window.location.reload()}>
                                {isEn ? "Check again" : "ตรวจสอบอีกครั้ง"}
                            </button>
                        )}
                        <Link href="/student" className="cg-btn-ghost text-center">
                            {isEn ? "Back to home" : "กลับหน้าหลัก"}
                        </Link>
                    </div>
                </div>
            )}

            {/* ── error ─────────────────────────────────────────────── */}
            {step === "error" && (
                <div className="cg-task-screen pb-6">
                    <TaskHeader title={isEn ? "Check-in" : "เช็กชื่อเข้าเรียน"} />

                    <div className="flex flex-col items-center gap-2 pt-5 text-center">
                        <span className="cg-state-badge" style={{ background: "var(--cg-danger-soft)", color: "var(--cg-danger)" }}>
                            <Icon icon="solar:danger-triangle-linear" width={40} height={40} />
                        </span>
                        <h2 className="mt-1 text-[21px] font-semibold leading-snug">{errorTitle || t("accessUnavailable")}</h2>
                        <p className="max-w-[32ch] text-[12.5px] font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
                            {errorMessage}
                        </p>
                    </div>

                    {authService.isAuthenticated() && redirectCountdown !== null && (
                        <div className="cg-card">
                            <p className="mb-2 text-[11.5px] font-light" style={{ color: "var(--cg-text-2)" }}>
                                {isEn
                                    ? `Returning to the scanner in ${redirectCountdown}s`
                                    : `กำลังพากลับไปหน้าสแกนใน ${redirectCountdown} วินาที`}
                            </p>
                            <div className="cg-progress">
                                <i
                                    className="transition-[width] duration-700 ease-linear"
                                    style={{ width: `${Math.max(0, (redirectCountdown / 5) * 100)}%`, background: "var(--cg-accent)" }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="cg-task-cta">
                        <button
                            type="button"
                            className="cg-btn"
                            onClick={() => {
                                if (authService.isAuthenticated()) {
                                    router.replace("/student/scan");
                                    return;
                                }
                                window.location.reload();
                            }}
                        >
                            {authService.isAuthenticated()
                                ? (isEn ? "Back to scanner" : "กลับหน้าสแกน")
                                : t("reloadPage")}
                        </button>
                    </div>
                </div>
            )}

            {/* ── active flow ───────────────────────────────────────── */}
            {step !== "loading" && step !== "error" && step !== "redirecting" && step !== "blocked" && (
                <div className="cg-task-screen pb-6">
                    <TaskHeader title={isEn ? "Check-in" : "เช็กชื่อเข้าเรียน"} />

                    {stepIndex >= 0 && flowSteps.length > 1 && (
                        <div className="cg-steps">
                            {flowSteps.map((s, i) => (
                                <span key={s} data-state={i < stepIndex ? "done" : i === stepIndex ? "now" : undefined} />
                            ))}
                        </div>
                    )}

                    <SessionCard />

                    {/* ── sign in ── */}
                    {step === "google-login" && (
                        <>
                            <div className="cg-card flex flex-col items-center gap-4 text-center">
                                <span className="cg-state-badge" style={{ background: "var(--cg-accent-soft)", color: "var(--cg-accent)" }}>
                                    <Icon icon="solar:user-circle-linear" width={40} height={40} />
                                </span>
                                <div>
                                    <h2 className="text-[17px] font-medium leading-relaxed">{t("signInWithGoogle")}</h2>
                                    <p className="mt-1 text-[12.5px] font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
                                        {t("useStudentEmail")}
                                    </p>
                                </div>
                                <p className="text-[11px] font-light" style={{ color: "var(--cg-text-3)" }}>
                                    {t("systemVerifiesStudentEmail")}
                                </p>
                            </div>
                            <div className="cg-task-cta">
                                <button type="button" className="cg-btn" onClick={handleGoogleLogin}>
                                    {t("signInWithGoogle")}
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── location ── */}
                    {step === "location" && (
                        <>
                            <div className="cg-card flex flex-col items-center gap-4 text-center">
                                <span className="cg-state-badge" style={{ background: "var(--cg-accent-soft)", color: "var(--cg-accent)" }}>
                                    <Icon icon="solar:map-point-linear" width={40} height={40} />
                                </span>
                                <div>
                                    <h2 className="text-[17px] font-medium leading-relaxed">{t("verifyLocation")}</h2>
                                    <p className="mt-1 text-[12.5px] font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
                                        {session?.radius_meters
                                            ? t("locationWithinRadius", { radius: session.radius_meters })
                                            : t("locationRequiredForSession")}
                                    </p>
                                </div>
                                {locationError && (
                                    <p className="cg-badge cg-badge-danger w-full justify-center py-2">{locationError}</p>
                                )}
                                {location && (
                                    <p className="cg-badge cg-badge-success w-full justify-center py-2">
                                        {t("locationVerifiedSuccessfully")}
                                    </p>
                                )}
                                <p className="text-[11px] font-light" style={{ color: "var(--cg-text-3)" }}>
                                    {t("ifNoLocationMayBeMarked")}
                                </p>
                            </div>
                            <div className="cg-task-cta">
                                <button type="button" className="cg-btn" disabled={isGettingLocation} onClick={getLocation}>
                                    {isGettingLocation ? t("checkingStatus") : t("allowLocationAccess")}
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── PIN ── */}
                    {step === "pin-entry" && (
                        <>
                            {studentInfo && (
                                <div className="cg-list">
                                    <div className="cg-row">
                                        <Avatar
                                            name={studentInfo.full_name}
                                            src={googleUser?.picture}
                                            size="sm"
                                            className="shrink-0"
                                            classNames={{ base: "bg-[var(--cg-accent)] text-white" }}
                                        />
                                        <span className="cg-row-body">
                                            <span className="cg-row-title truncate">{studentInfo.full_name}</span>
                                            <span className="cg-row-sub cg-mono">{studentInfo.student_id}</span>
                                        </span>
                                        <span className="cg-badge cg-badge-success">{isEn ? "Verified" : "ยืนยันแล้ว"}</span>
                                    </div>
                                    {location && (
                                        <div className="cg-row">
                                            <span className="cg-row-ico" style={{ background: "var(--cg-success-soft)", color: "var(--cg-success)" }}>
                                                <Icon icon="solar:map-point-linear" width={17} height={17} />
                                            </span>
                                            <span className="cg-row-body">
                                                <span className="cg-row-title">{t("locationCaptured")}</span>
                                            </span>
                                            <Icon icon="solar:check-circle-linear" width={18} height={18} style={{ color: "var(--cg-success)" }} />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="cg-card">
                                <div className="flex items-center justify-between gap-2.5">
                                    <p className="cg-section-label" style={{ padding: 0 }}>{t("enterPin")}</p>
                                    {(session?.pin_mode === "rotating" || (session?.pin_mode == null && session?.auto_rotate_pin)) && pinCountdown !== null && pinTotal !== null && (
                                        <span
                                            className="cg-badge cg-mono"
                                            style={pinCountdown <= 10
                                                ? { background: "var(--cg-danger-soft)", color: "var(--cg-danger)" }
                                                : pinCountdown <= 20
                                                ? { background: "var(--cg-warning-soft)", color: "var(--cg-warning)" }
                                                : { background: "var(--cg-info-soft)", color: "var(--cg-info)" }}
                                        >
                                            {pinCountdown}s
                                        </span>
                                    )}
                                </div>
                                <p className="mb-4 mt-1.5 text-[11.5px] font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
                                    {t("sixDigitsFromClassroomDisplay")}
                                    {(session?.pin_mode === "rotating" || (session?.pin_mode == null && session?.auto_rotate_pin))
                                        ? (isEn ? " The PIN changes every minute." : " รหัสเปลี่ยนทุก 1 นาที")
                                        : ""}
                                </p>

                                <div className="flex justify-center">
                                    <InputOtp
                                        length={6}
                                        value={pinCode}
                                        onValueChange={handlePinValueChange}
                                        size="lg"
                                        variant="bordered"
                                        color="primary"
                                        onComplete={handleCheckIn}
                                        classNames={{
                                            segment: "w-12 h-14 text-2xl font-medium rounded-2xl",
                                            segmentWrapper: "gap-2",
                                        }}
                                    />
                                </div>

                                {isSubmitting && (
                                    <p className="mt-3.5 text-center text-[11.5px] font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
                                        {submitElapsedSeconds < 4
                                            ? (isEn ? "Submitting check-in request" : "กำลังส่งคำขอเช็กชื่อ")
                                            : submitElapsedSeconds < 10
                                            ? (isEn ? "Confirming your attendance with server" : "กำลังยืนยันข้อมูลกับเซิร์ฟเวอร์")
                                            : (isEn
                                                ? "Still processing due to high traffic. Please keep this page open."
                                                : "ระบบกำลังประมวลผลจากผู้ใช้งานจำนวนมาก กรุณาอย่าปิดหน้านี้")}
                                    </p>
                                )}
                            </div>

                            <div className="cg-task-cta">
                                <button
                                    type="button"
                                    className="cg-btn inline-flex items-center justify-center gap-2"
                                    disabled={pinCode.length !== 6 || isSubmitting}
                                    onClick={handleCheckIn}
                                >
                                    {isSubmitting && <Spinner size="sm" color="white" />}
                                    {t("checkInAction")}
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── success ── */}
                    {step === "success" && checkInResult && (
                        <>
                            <div className="flex flex-col items-center gap-2 pt-2 text-center">
                                <span className="cg-state-badge" style={{ background: "var(--cg-success-soft)", color: "var(--cg-success)" }}>
                                    <Icon icon={statusDisplay[checkInResult.status]?.icon || "solar:check-circle-linear"} width={42} height={42} />
                                </span>
                                <h2 className="mt-1 text-[22px] font-semibold leading-snug">{t("checkInSuccessful")}</h2>
                                <span className={`cg-badge ${checkInResult.status === "late" ? "cg-badge-warning" : "cg-badge-success"}`} style={{ fontSize: 13, padding: "6px 15px" }}>
                                    {statusDisplay[checkInResult.status]?.label ?? checkInResult.status}
                                </span>
                            </div>

                            <div className="cg-list">
                                <div className="cg-row">
                                    <span className="cg-row-ico">
                                        <Icon icon="solar:clock-circle-linear" width={17} height={17} />
                                    </span>
                                    <span className="cg-row-body"><span className="cg-row-title">{t("checkInTime")}</span></span>
                                    <span className="cg-mono text-[13.5px] font-medium">{formatTime(checkInResult.check_in_time)}</span>
                                </div>
                                {checkInResult.location_verified && (
                                    <div className="cg-row">
                                        <span className="cg-row-ico">
                                            <Icon icon="solar:map-point-linear" width={17} height={17} />
                                        </span>
                                        <span className="cg-row-body"><span className="cg-row-title">{t("locationPermission")}</span></span>
                                        <span className="cg-badge cg-badge-success">
                                            {t("locationVerifiedWithDistance", { distance: checkInResult.distance_meters?.toFixed(0) || 0 })}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="cg-task-cta">
                                <Link href="/student" className="cg-btn text-center">{isEn ? "Back to home" : "กลับหน้าหลัก"}</Link>
                            </div>
                        </>
                    )}

                    {/* ── already checked in ── */}
                    {step === "already-checked-in" && alreadyCheckedIn && (
                        <>
                            <div className="flex flex-col items-center gap-2 pt-2 text-center">
                                <span className="cg-state-badge" style={{ background: "var(--cg-accent-soft)", color: "var(--cg-accent)" }}>
                                    <Icon icon="solar:check-circle-linear" width={42} height={42} />
                                </span>
                                <h2 className="mt-1 text-[22px] font-semibold leading-snug">{t("alreadyCheckedIn")}</h2>
                                <span className={`cg-badge ${alreadyCheckedIn.status === "late" ? "cg-badge-warning" : "cg-badge-success"}`} style={{ fontSize: 13, padding: "6px 15px" }}>
                                    {statusDisplay[alreadyCheckedIn.status]?.label ?? alreadyCheckedIn.status}
                                </span>
                                <p className="max-w-[32ch] text-[12.5px] font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
                                    {t("checkedInThisSessionAt", { time: formatTime(alreadyCheckedIn.check_in_time) })}
                                </p>
                            </div>

                            <div className="cg-task-cta">
                                <Link href="/student" className="cg-btn text-center">{isEn ? "Back to home" : "กลับหน้าหลัก"}</Link>
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
}
