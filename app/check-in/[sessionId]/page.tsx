"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { InputOtp } from "@heroui/input-otp";
import { Spinner } from "@heroui/spinner";
import { Avatar } from "@heroui/avatar";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { io, Socket } from "@/services/realtime-socket";
import attendanceService, { type AttendanceSession } from "@/services/attendance.service";

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

    // Socket ref
    const socketRef = useRef<Socket | null>(null);

    // Google Sign In ref
    const googleButtonRef = useRef<HTMLDivElement>(null);

    // Fetch session info
    const fetchSessionInfo = useCallback(async () => {
        try {
            const data = await attendanceService.getSessionInfo(sessionId);
            if (data) {
                setSession(data);
                if (data.status === "active") {
                    setStep("google-login");
                } else if (data.status === "closed") {
                    setErrorMessage("รอบการเช็คชื่อนี้ปิดไปแล้ว");
                    setStep("error");
                } else {
                    setErrorMessage("รอบการเช็คชื่อยังไม่เปิดรับ");
                    setStep("error");
                }
            } else {
                setErrorMessage("ไม่พบรอบการเช็คชื่อนี้");
                setStep("error");
            }
        } catch (error: unknown) {
            console.error("Error fetching session:", error);
            setErrorMessage((error as Error).message || "ไม่สามารถโหลดข้อมูลได้");
            setStep("error");
        }
    }, [sessionId]);

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
    }, [step]);

    // Handle Google login response
    const handleGoogleResponse = async (response: { credential: string }) => {
        const decoded = decodeJWT(response.credential);
        if (!decoded) {
            addToast({
                title: "เข้าสู่ระบบไม่สำเร็จ",
                description: "ไม่สามารถอ่านข้อมูลจาก Google ได้",
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
            setErrorMessage((error as Error).message || "ไม่พบข้อมูลนักศึกษาในระบบ");
            setStep("error");
        }
    };

    // Get current location
    const getLocation = () => {
        setIsGettingLocation(true);
        setLocationError(null);

        if (!navigator.geolocation) {
            setLocationError("เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง");
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
                        setLocationError("กรุณาอนุญาตการเข้าถึงตำแหน่งที่ตั้ง");
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setLocationError("ไม่สามารถระบุตำแหน่งได้");
                        break;
                    case error.TIMEOUT:
                        setLocationError("หมดเวลาในการระบุตำแหน่ง");
                        break;
                    default:
                        setLocationError("เกิดข้อผิดพลาดในการระบุตำแหน่ง");
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
                title: "ข้อมูลไม่ครบ",
                description: "กรุณากรอก PIN 6 หลัก",
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
            addToast({
                title: "เช็คชื่อไม่สำเร็จ",
                description: (error as Error).message || "กรุณาตรวจสอบ PIN และลองใหม่",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Initialize socket
    useEffect(() => {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || window.location.origin;
  
  const socket = io(socketUrl, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
  });

        socket.on("connect", () => {
            socket.emit("join-attendance", sessionId);
        });

        socket.on("session-closed", () => {
            setErrorMessage("รอบการเช็คชื่อถูกปิดแล้ว");
            setStep("error");
        });

        socketRef.current = socket;

        return () => {
            socket.emit("leave-attendance", sessionId);
            socket.disconnect();
        };
    }, [sessionId]);

    // Fetch session on mount
    useEffect(() => {
        fetchSessionInfo();
    }, [fetchSessionInfo]);

    // Status display
    const statusDisplay: Record<string, { label: string; color: string; icon: string }> = {
        present: { label: "มาเรียน", color: "text-emerald-600 bg-emerald-100", icon: "solar:check-circle-bold" },
        late: { label: "มาสาย", color: "text-amber-600 bg-amber-100", icon: "solar:clock-circle-bold" },
    };

    // Format time
    const formatTime = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ── Loading state (full screen) ── */}
            {step === "loading" && (
                <div className="flex min-h-screen flex-col items-center justify-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                        <Icon icon="solar:clipboard-check-bold" className="text-3xl text-white" />
                    </div>
                    <Spinner size="lg" color="primary" />
                    <p className="text-sm text-slate-500">กำลังโหลด…</p>
                </div>
            )}

            {/* ── Error state (full screen) ── */}
            {step === "error" && (
                <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
                    <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                        <Icon icon="solar:danger-triangle-bold-duotone" className="text-4xl text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">ไม่สามารถเข้าถึงได้</h2>
                    <p className="text-sm text-slate-500 mb-6 max-w-xs">{errorMessage}</p>
                    <Button variant="flat" radius="lg" onPress={() => window.location.reload()}>
                        ลองใหม่
                    </Button>
                </div>
            )}

            {/* ── All non-loading, non-error states ── */}
            {step !== "loading" && step !== "error" && (
                <>
                    {/* Top hero strip — session info */}
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-5 pb-8 pt-10 text-white">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                                <Icon icon="solar:clipboard-check-bold-duotone" className="text-2xl text-white" />
                            </div>
                            <div>
                                <p className="text-xs text-blue-200 font-medium">เช็คชื่อเข้าเรียน</p>
                                <h1 className="text-lg font-bold leading-tight line-clamp-1">
                                    {session?.title || "กำลังโหลด…"}
                                </h1>
                            </div>
                        </div>
                        {session?.course && (
                            <p className="text-sm text-blue-100">
                                {session.course.code} · {session.course.name}
                            </p>
                        )}
                    </div>

                    {/* Pull-up white sheet */}
                    <div className="-mt-4 min-h-[calc(100vh-8rem)] rounded-t-3xl bg-slate-50 px-5 pt-7 pb-12">

                        {/* ── Google Login ── */}
                        {step === "google-login" && (
                            <div className="flex flex-col items-center text-center gap-5">
                                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                                    <Icon icon="solar:user-circle-bold-duotone" className="text-4xl text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">เข้าสู่ระบบด้วย Google</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        ใช้อีเมลนักศึกษา (@kkumail.com)
                                    </p>
                                </div>
                                <div ref={googleButtonRef} className="flex justify-center w-full" />
                                <p className="text-xs text-slate-400">
                                    ระบบจะตรวจสอบอีเมลกับฐานข้อมูลนักศึกษาอัตโนมัติ
                                </p>
                            </div>
                        )}

                        {/* ── Location Step ── */}
                        {step === "location" && (
                            <div className="flex flex-col items-center text-center gap-5">
                                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100">
                                    <Icon icon="solar:map-point-bold-duotone" className="text-4xl text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">ยืนยันตำแหน่ง</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        รอบนี้ต้องยืนยันตำแหน่ง
                                        {session?.radius_meters ? ` ภายในรัศมี ${session.radius_meters} ม.` : ""}
                                    </p>
                                </div>

                                {locationError && (
                                    <div className="w-full rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                                        <Icon icon="solar:danger-triangle-bold" className="shrink-0 text-lg" />
                                        <span>{locationError}</span>
                                    </div>
                                )}
                                {location && (
                                    <div className="w-full rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                                        <Icon icon="solar:check-circle-bold" className="shrink-0 text-lg" />
                                        <span>ระบุตำแหน่งสำเร็จแล้ว</span>
                                    </div>
                                )}

                                <Button
                                    color="primary"
                                    size="lg"
                                    radius="lg"
                                    className="w-full bg-linear-to-r from-blue-500 to-indigo-600 font-semibold"
                                    startContent={!isGettingLocation && <Icon icon="solar:gps-bold" className="text-xl" />}
                                    isLoading={isGettingLocation}
                                    onPress={getLocation}
                                >
                                    {isGettingLocation ? "กำลังระบุตำแหน่ง…" : "อนุญาตการเข้าถึงตำแหน่ง"}
                                </Button>
                                <p className="text-xs text-slate-400">
                                    หากไม่ยืนยันตำแหน่ง อาจถูกบันทึกว่า "ขาด" หรือ "สาย"
                                </p>
                            </div>
                        )}

                        {/* ── PIN Entry ── */}
                        {step === "pin-entry" && (
                            <div className="flex flex-col items-center gap-5">
                                {/* Student identity pill */}
                                {studentInfo && (
                                    <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                        <Avatar
                                            name={studentInfo.full_name}
                                            src={googleUser?.picture}
                                            size="md"
                                            className="shrink-0 bg-blue-500"
                                        />
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-900 truncate">{studentInfo.full_name}</p>
                                            <p className="text-xs text-slate-500">{studentInfo.student_id}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col items-center text-center gap-3 pt-2">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                                        <Icon icon="solar:key-bold-duotone" className="text-3xl text-blue-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900">กรอกรหัส PIN</h2>
                                        <p className="mt-1 text-sm text-slate-500">6 หลัก จากจอหน้าห้องเรียน</p>
                                    </div>
                                </div>

                                <InputOtp
                                    length={6}
                                    value={pinCode}
                                    onValueChange={setPinCode}
                                    size="lg"
                                    variant="bordered"
                                    color="primary"
                                    onComplete={handleCheckIn}
                                    classNames={{
                                        segment: "w-12 h-14 text-2xl font-bold",
                                        segmentWrapper: "gap-2",
                                    }}
                                />

                                {location && (
                                    <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                                        <Icon icon="solar:map-point-bold" />
                                        ตำแหน่งที่ตั้งถูกระบุแล้ว
                                    </div>
                                )}

                                <Button
                                    color="primary"
                                    size="lg"
                                    radius="lg"
                                    className="w-full bg-linear-to-r from-blue-500 to-indigo-600 font-semibold mt-2"
                                    isDisabled={pinCode.length !== 6}
                                    isLoading={isSubmitting}
                                    onPress={handleCheckIn}
                                >
                                    เช็คชื่อ
                                </Button>
                            </div>
                        )}

                        {/* ── Success ── */}
                        {step === "success" && checkInResult && (
                            <div className="flex flex-col items-center text-center gap-6 pt-4">
                                {/* Big status circle */}
                                <div className={`flex h-24 w-24 items-center justify-center rounded-full ${
                                    checkInResult.status === "present" ? "bg-emerald-100" :
                                    checkInResult.status === "late" ? "bg-amber-100" : "bg-slate-100"
                                }`}>
                                    <Icon
                                        icon={statusDisplay[checkInResult.status]?.icon || "solar:check-circle-bold"}
                                        className={`text-5xl ${
                                            checkInResult.status === "present" ? "text-emerald-600" :
                                            checkInResult.status === "late" ? "text-amber-600" : "text-slate-600"
                                        }`}
                                    />
                                </div>

                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">เช็คชื่อสำเร็จ!</h2>
                                    <Chip
                                        size="lg"
                                        className={`mt-2 ${statusDisplay[checkInResult.status]?.color}`}
                                    >
                                        {statusDisplay[checkInResult.status]?.label}
                                    </Chip>
                                </div>

                                {/* Info card */}
                                <div className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left space-y-3 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-500">เวลาเช็คชื่อ</span>
                                        <span className="font-mono font-semibold text-slate-900">
                                            {formatTime(checkInResult.check_in_time)}
                                        </span>
                                    </div>
                                    {checkInResult.location_verified && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-500">ตำแหน่ง</span>
                                            <span className="text-emerald-600 flex items-center gap-1 text-sm font-medium">
                                                <Icon icon="solar:check-circle-bold" />
                                                ยืนยันแล้ว ({checkInResult.distance_meters?.toFixed(0)} ม.)
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <p className="text-sm text-slate-400">คุณสามารถปิดหน้านี้ได้แล้ว</p>
                            </div>
                        )}

                        {/* ── Already Checked In ── */}
                        {step === "already-checked-in" && alreadyCheckedIn && (
                            <div className="flex flex-col items-center text-center gap-5 pt-4">
                                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-100">
                                    <Icon icon="solar:info-circle-bold-duotone" className="text-4xl text-sky-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">เช็คชื่อไปแล้ว</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        รอบนี้เมื่อ {formatTime(alreadyCheckedIn.check_in_time)}
                                    </p>
                                </div>
                                <Chip
                                    size="lg"
                                    className={statusDisplay[alreadyCheckedIn.status]?.color || "bg-slate-100 text-slate-700"}
                                >
                                    {statusDisplay[alreadyCheckedIn.status]?.label || alreadyCheckedIn.status}
                                </Chip>
                            </div>
                        )}

                    </div>
                </>
            )}
        </div>
    );
}
