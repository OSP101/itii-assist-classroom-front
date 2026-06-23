"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { InputOtp } from "@heroui/input-otp";
import { Spinner } from "@heroui/spinner";
import { Avatar } from "@heroui/avatar";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { getRealtimeSocketBaseUrl, io, Socket } from "@/services/realtime-socket";
import attendanceService, { type AttendanceSession } from "@/services/attendance.service";
import { authService } from "@/services/auth.service";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useI18n } from "@/hooks/useI18n";
import { useAttendancePinPresentation } from "@/hooks/useAttendancePinPresentation";
import { buildCourseTitleContext, buildPageTitle } from "@/lib/page-title";

// Declare Google Auth type
declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string;
                        callback: (response: { credential: string }) => void;
                        auto_select?: boolean;
                    }) => void;
                    renderButton: (
                        element: HTMLElement,
                        config: {
                            theme?: "outline" | "filled_blue" | "filled_black";
                            size?: "large" | "medium" | "small";
                            text?: "signin_with" | "signup_with" | "continue_with" | "signin";
                            shape?: "rectangular" | "pill" | "circle" | "square";
                            logo_alignment?: "left" | "center";
                            width?: number;
                            locale?: string;
                        }
                    ) => void;
                    prompt: () => void;
                };
            };
        };
    }
}

// JWT decode helper
function decodeJWT(token: string): { email: string; name: string; sub: string; picture?: string } | null {
    try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

// Check-in step type
type Step = "loading" | "session-info" | "google-login" | "location" | "pin-entry" | "success" | "error" | "already-checked-in";

export default function StudentCheckInPage() {
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
    const [checkInResult, setCheckInResult] = useState<{
        status: string;
        check_in_time: string;
        location_verified: boolean;
        distance_meters: number | null;
    } | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [alreadyCheckedIn, setAlreadyCheckedIn] = useState<{
        status: string;
        check_in_time: string;
    } | null>(null);

    useEffect(() => {
        const pageLabel = language === "en" ? "Student Check-In" : "เช็คชื่อเข้าเรียน";
        const courseContext = buildCourseTitleContext(session?.course);
        document.title = buildPageTitle(pageLabel, courseContext);
    }, [language, session?.course]);

    // Socket ref
    const socketRef = useRef<Socket | null>(null);

    // Google Sign In ref
    const googleButtonRef = useRef<HTMLDivElement>(null);
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
                    // If already logged in, skip Google login — use stored user directly
                    const storedUser = authService.getStoredUser();
                    if (storedUser?.email) {
                        setGoogleUser({
                            email: storedUser.email,
                            name: storedUser.full_name,
                            googleId: "",
                            picture: storedUser.avatar ?? undefined,
                        });
                        try {
                            const result = await attendanceService.verifyStudent(storedUser.email, sessionId);
                            if (result) {
                                setStudentInfo(result.student);
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
                            }
                        } catch (err: unknown) {
                            setErrorMessage((err as Error).message || t("studentNotFoundInSystem"));
                            setStep("error");
                        }
                    } else {
                        setStep("google-login");
                    }
                } else if (data.status === "closed") {
                    setErrorMessage(t("sessionClosedAlready"));
                    setStep("error");
                } else {
                    setErrorMessage(t("sessionNotOpenYet"));
                    setStep("error");
                }
            } else {
                setErrorMessage(t("attendanceSessionNotFound"));
                setStep("error");
            }
        } catch (error: unknown) {
            console.error("Error fetching session:", error);
            setErrorMessage((error as Error).message || t("unableToLoadData"));
            setStep("error");
        }
    }, [sessionId, t]);

    // Initialize Google Sign In
    useEffect(() => {
        if (step !== "google-login" || !googleButtonRef.current) return;

        const initGoogle = () => {
            if (window.google) {
                window.google.accounts.id.initialize({
                    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
                    callback: handleGoogleResponse,
                });

                window.google.accounts.id.renderButton(googleButtonRef.current!, {
                    theme: "filled_blue",
                    size: "large",
                    text: "continue_with",
                    shape: "rectangular",
                    width: 280,
                    locale: language,
                });
            }
        };

        // Check if script is already loaded
        if (window.google) {
            initGoogle();
        } else {
            // Load Google Sign In script
            const script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            script.onload = initGoogle;
            document.body.appendChild(script);

            return () => {
                document.body.removeChild(script);
            };
        }
    }, [language, step]);

    // Handle Google login response
    const handleGoogleResponse = async (response: { credential: string }) => {
        const decoded = decodeJWT(response.credential);
        if (!decoded) {
            addToast({
                title: t("signInFailed"),
                description: t("unableToReadGoogleData"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setGoogleUser({
            email: decoded.email,
            name: decoded.name,
            googleId: decoded.sub,
            picture: decoded.picture,
        });

        // Verify student
        try {
            const result = await attendanceService.verifyStudent(decoded.email, sessionId);
            if (result) {
                setStudentInfo(result.student);
                if (result.already_checked_in) {
                    setAlreadyCheckedIn({
                        status: result.status || "present",
                        check_in_time: result.check_in_time || "",
                    });
                    setStep("already-checked-in");
                } else if (session?.check_location) {
                    setStep("location");
                } else {
                    setStep("pin-entry");
                }
            }
        } catch (error: unknown) {
            console.error("Error verifying student:", error);
            setErrorMessage((error as Error).message || t("studentNotFoundInSystem"));
            setStep("error");
        }
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
        if (!googleUser || pinCode.length !== 6) {
            addToast({
                title: t("incompleteInformation"),
                description: t("pleaseEnterSixDigitPin"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await attendanceService.studentCheckIn(sessionId, {
                pin_code: pinCode,
                google_email: googleUser.email,
                google_id: googleUser.googleId,
                location_lat: location?.lat,
                location_lng: location?.lng,
            });

            if (result) {
                setCheckInResult(result);
                setStep("success");

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
            const msg = (error as Error).message || t("pleaseCheckPinAndTryAgain");
            const isLocationError = msg.includes("นอกพื้นที่") || msg.includes("ห่าง") || msg.includes("location");
            addToast({
                title: isLocationError ? "ตำแหน่งไม่อยู่ในพื้นที่" : t("checkInFailed"),
                description: msg,
                color: "danger",
                timeout: isLocationError ? 6000 : 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Initialize socket
    useEffect(() => {
    const socketUrl = getRealtimeSocketBaseUrl();
  
    const socket = io(socketUrl);

        socket.on("connect", () => {
            socket.emit("join-attendance", sessionId);
        });

        socket.on("session-closed", () => {
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
    }, [sessionId, t]);

    // Fetch session on mount
    useEffect(() => {
        fetchSessionInfo();
    }, [fetchSessionInfo]);

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

    return (
        <div data-theme-scope="adaptive check-in" className="min-h-screen bg-slate-50">

            {/* ── Loading ── */}
            {step === "loading" && (
                <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-linear-to-br from-sky-600 to-cyan-500 shadow-lg shadow-sky-300/40">
                        <Icon icon="solar:clipboard-check-bold-duotone" className="text-2xl text-white" />
                    </div>
                    <Spinner size="lg" color="primary" />
                    <p className="text-sm text-slate-400">{t("loading")}</p>
                </div>
            )}

            {/* ── Error ── */}
            {step === "error" && (
                <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
                    <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-4xl bg-rose-50 border border-rose-100">
                        <Icon icon="solar:danger-triangle-bold-duotone" className="text-4xl text-rose-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">{t("accessUnavailable")}</h2>
                    <p className="text-sm text-slate-500 mb-6 max-w-xs">{errorMessage}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 active:scale-95"
                    >
                        <Icon icon="solar:restart-bold" />
                        {t("reloadPage")}
                    </button>
                </div>
            )}

            {/* ── All active states ── */}
            {step !== "loading" && step !== "error" && (
                <div className="space-y-4 px-4 pb-10 pt-4 sm:px-5">

                    {/* ── Hero header card ── */}
                    <div className="relative overflow-hidden rounded-4xl bg-linear-to-br from-sky-700 via-sky-600 to-cyan-500 p-5 shadow-xl shadow-sky-300/40">
                        {/* decorative blobs */}
                        <span className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
                        <span className="pointer-events-none absolute -bottom-10 -left-6 h-36 w-36 rounded-full bg-cyan-300/20 blur-2xl" />

                        <div className="relative flex items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/30 backdrop-blur-sm">
                                <Icon icon="solar:clipboard-check-bold-duotone" className="text-xl text-white" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-200/80">{t("attendanceCheckIn")}</p>
                                <h1 className="mt-0.5 truncate text-lg font-bold leading-snug text-white">
                                    {session?.title || t("loading")}
                                </h1>
                                {session?.course && (
                                    <p className="mt-0.5 text-xs text-sky-100/70">
                                        {session.course.code} · {session.course.name}
                                    </p>
                                )}
                            </div>
                            <Link
                                href="/student"
                                className="flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm transition active:scale-95 hover:bg-white/30"
                            >
                                <Icon icon="solar:home-2-bold" className="text-sm" />
                                หน้าหลัก
                            </Link>
                        </div>

                        {/* step indicator pills */}
                        <div className="relative mt-4 flex gap-2">
                            {(["google-login", "location", "pin-entry"] as const)
                                .filter((s) => {
                                    if (s === "google-login") return !authService.getStoredUser();
                                    if (s === "location") return session?.check_location;
                                    return true;
                                })
                                .map((s, idx, arr) => (
                                    <span
                                        key={s}
                                        className={`h-1.5 flex-1 rounded-full transition-all ${
                                            step === s || (step === "pin-entry" && idx === arr.length - 1 && s === "pin-entry")
                                                ? "bg-white"
                                                : step === "success" || step === "already-checked-in"
                                                ? "bg-white/60"
                                                : arr.indexOf(step as typeof s) > idx
                                                ? "bg-white/60"
                                                : "bg-white/20"
                                        }`}
                                    />
                                ))}
                        </div>
                    </div>

                    {/* ── Google Login ── */}
                    {step === "google-login" && (
                        <div className="rounded-4xl border border-slate-100 bg-white/90 p-6 shadow-sm">
                            <div className="flex flex-col items-center text-center gap-5">
                                <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-50 border border-sky-100">
                                    <Icon icon="solar:user-circle-bold-duotone" className="text-3xl text-sky-600" />
                                </span>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">{t("signInWithGoogle")}</h2>
                                    <p className="mt-1 text-sm text-slate-500">{t("useStudentEmail")}</p>
                                </div>
                                <div ref={googleButtonRef} className="flex justify-center w-full" />
                                <p className="text-xs text-slate-400">{t("systemVerifiesStudentEmail")}</p>
                            </div>
                        </div>
                    )}

                    {/* ── Location ── */}
                    {step === "location" && (
                        <div className="rounded-4xl border border-slate-100 bg-white/90 p-6 shadow-sm">
                            <div className="flex flex-col items-center text-center gap-5">
                                <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-50 border border-sky-100">
                                    <Icon icon="solar:map-point-bold-duotone" className="text-3xl text-sky-600" />
                                </span>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">{t("verifyLocation")}</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {session?.radius_meters
                                            ? t("locationWithinRadius", { radius: session.radius_meters })
                                            : t("locationRequiredForSession")}
                                    </p>
                                </div>

                                {locationError && (
                                    <div className="w-full rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 flex items-center gap-2">
                                        <Icon icon="solar:danger-triangle-bold" className="shrink-0 text-lg" />
                                        <span>{locationError}</span>
                                    </div>
                                )}
                                {location && (
                                    <div className="w-full rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                                        <Icon icon="solar:check-circle-bold" className="shrink-0 text-lg" />
                                        <span>{t("locationVerifiedSuccessfully")}</span>
                                    </div>
                                )}

                                <button
                                    disabled={isGettingLocation}
                                    onClick={getLocation}
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-sky-600 to-cyan-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-300/40 transition active:scale-[0.98] disabled:opacity-60"
                                >
                                    {isGettingLocation ? (
                                        <Spinner size="sm" color="white" />
                                    ) : (
                                        <Icon icon="solar:gps-bold" className="text-xl" />
                                    )}
                                    {isGettingLocation ? t("checkingStatus") : t("allowLocationAccess")}
                                </button>
                                <p className="text-xs text-slate-400">{t("ifNoLocationMayBeMarked")}</p>
                            </div>
                        </div>
                    )}

                    {/* ── PIN Entry ── */}
                    {step === "pin-entry" && (
                        <div className="space-y-3">
                            {/* student identity card */}
                            {studentInfo && (
                                <div className="flex items-center gap-3 rounded-4xl border border-slate-100 bg-white/90 px-4 py-3.5 shadow-sm">
                                    <Avatar
                                        name={studentInfo.full_name}
                                        src={googleUser?.picture}
                                        size="md"
                                        className="shrink-0"
                                        classNames={{ base: "bg-sky-500 text-white" }}
                                    />
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-900 truncate">{studentInfo.full_name}</p>
                                        <p className="text-xs text-slate-500">{studentInfo.student_id}</p>
                                    </div>
                                </div>
                            )}

                            {/* PIN card */}
                            <div className="rounded-4xl border border-slate-100 bg-white/90 p-6 shadow-sm">
                                <div className="flex flex-col items-center text-center gap-5">
                                    <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-50 border border-sky-100">
                                        <Icon icon="solar:key-bold-duotone" className="text-2xl text-sky-600" />
                                    </span>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">{t("enterPin")}</h2>
                                        <p className="mt-1 text-sm text-slate-500">{t("sixDigitsFromClassroomDisplay")}</p>
                                    </div>
                                    {(session?.pin_mode === "rotating" || (session?.pin_mode == null && session?.auto_rotate_pin)) && pinCountdown !== null && pinTotal !== null && (
                                        <div className="w-full">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-slate-400">
                                                    {language === "en" ? "PIN rotates every minute" : "PIN เปลี่ยนทุก 1 นาที"}
                                                </span>
                                                <span className={`text-xs font-mono font-semibold tabular-nums ${
                                                    pinCountdown <= 10 ? "text-red-500" :
                                                    pinCountdown <= 20 ? "text-amber-500" : "text-sky-500"
                                                }`}>{pinCountdown}s</span>
                                            </div>
                                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                                <div
                                                    className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                                                        pinCountdown <= 10 ? "bg-red-500" :
                                                        pinCountdown <= 20 ? "bg-amber-400" : "bg-sky-500"
                                                    }`}
                                                    style={{ width: `${Math.max(0, (pinCountdown / pinTotal) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <InputOtp
                                        length={6}
                                        value={pinCode}
                                        onValueChange={setPinCode}
                                        size="lg"
                                        variant="bordered"
                                        color="primary"
                                        onComplete={handleCheckIn}
                                        classNames={{
                                            segment: "w-12 h-14 text-2xl font-bold rounded-2xl",
                                            segmentWrapper: "gap-2",
                                        }}
                                    />

                                    {location && (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                            <Icon icon="solar:map-point-bold" />
                                            {t("locationCaptured")}
                                        </span>
                                    )}

                                    <button
                                        disabled={pinCode.length !== 6 || isSubmitting}
                                        onClick={handleCheckIn}
                                        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-sky-600 to-cyan-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-300/40 transition active:scale-[0.98] disabled:opacity-50"
                                    >
                                        {isSubmitting ? <Spinner size="sm" color="white" /> : <Icon icon="solar:check-circle-bold" className="text-lg" />}
                                        {t("checkInAction")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Success ── */}
                    {step === "success" && checkInResult && (
                        <div className="rounded-4xl border border-slate-100 bg-white/90 p-6 shadow-sm">
                            <div className="flex flex-col items-center text-center gap-5">
                                <span className={`flex h-20 w-20 items-center justify-center rounded-4xl ${
                                    checkInResult.status === "present" ? "bg-emerald-50 border border-emerald-100" :
                                    checkInResult.status === "late"    ? "bg-amber-50  border border-amber-100"   :
                                                                         "bg-slate-50  border border-slate-100"
                                }`}>
                                    <Icon
                                        icon={statusDisplay[checkInResult.status]?.icon || "solar:check-circle-bold"}
                                        className={`text-4xl ${
                                            checkInResult.status === "present" ? "text-emerald-600" :
                                            checkInResult.status === "late"    ? "text-amber-500"   : "text-slate-500"
                                        }`}
                                    />
                                </span>

                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">{t("checkInSuccessful")}</h2>
                                    <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-bold ${statusDisplay[checkInResult.status]?.color}`}>
                                        {statusDisplay[checkInResult.status]?.label}
                                    </span>
                                </div>

                                <div className="w-full rounded-3xl border border-slate-100 bg-slate-50/80 px-5 py-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-500">{t("checkInTime")}</span>
                                        <span className="font-mono text-sm font-bold text-slate-900">
                                            {formatTime(checkInResult.check_in_time)}
                                        </span>
                                    </div>
                                    {checkInResult.location_verified && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-500">{t("locationPermission")}</span>
                                            <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                                                <Icon icon="solar:check-circle-bold" />
                                                {t("locationVerifiedWithDistance", { distance: checkInResult.distance_meters?.toFixed(0) || 0 })}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <p className="text-sm text-slate-400">{t("youCanCloseThisPage")}</p>
                            </div>
                        </div>
                    )}

                    {/* ── Already Checked In ── */}
                    {step === "already-checked-in" && alreadyCheckedIn && (
                        <div className="rounded-4xl border border-sky-100 bg-sky-50/80 p-6 shadow-sm">
                            <div className="flex flex-col items-center text-center gap-5">
                                <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-100 border border-sky-200">
                                    <Icon icon="solar:info-circle-bold-duotone" className="text-3xl text-sky-600" />
                                </span>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">{t("alreadyCheckedIn")}</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {t("checkedInThisSessionAt", { time: formatTime(alreadyCheckedIn.check_in_time) })}
                                    </p>
                                </div>
                                <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold ${statusDisplay[alreadyCheckedIn.status]?.color || "bg-slate-100 text-slate-700"}`}>
                                    {statusDisplay[alreadyCheckedIn.status]?.label || alreadyCheckedIn.status}
                                </span>
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}
