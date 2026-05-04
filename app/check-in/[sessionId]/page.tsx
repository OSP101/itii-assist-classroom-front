"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { InputOtp } from "@heroui/input-otp";
import { Spinner } from "@heroui/spinner";
import { Avatar } from "@heroui/avatar";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { IoSchool } from "react-icons/io5";
import { io, Socket } from "socket.io-client";
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
        <div className="min-h-screen bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-2xl">
                <CardBody className="p-6">
                    {/* Loading */}
                    {step === "loading" && (
                        <div className="flex flex-col items-center gap-4 py-10">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center text-white text-4xl">
                                <IoSchool />
                            </div>
                            <Spinner size="lg" color="primary" />
                            <p className="text-slate-500">กำลังโหลด...</p>
                        </div>
                    )}

                    {/* Session Info Header */}
                    {step !== "loading" && session && step !== "error" && (
                        <div className="text-center mb-6 pb-6 border-b border-slate-100">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                <Icon icon="solar:clipboard-check-bold" className="text-3xl text-white" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-800">{session.title}</h1>
                            <p className="text-slate-500 text-sm mt-1">
                                {session.course?.code} - {session.course?.name}
                            </p>
                        </div>
                    )}

                    {/* Google Login Step */}
                    {step === "google-login" && (
                        <div className="text-center">
                            <Icon icon="solar:user-circle-bold-duotone" className="text-6xl text-blue-500 mx-auto mb-4" />
                            <h2 className="text-lg font-semibold text-slate-800 mb-2">เข้าสู่ระบบด้วย Google</h2>
                            <p className="text-slate-500 text-sm mb-6">
                                กรุณาเข้าสู่ระบบด้วยอีเมลนักศึกษา (@kkumail.com)
                            </p>
                            <div ref={googleButtonRef} className="flex justify-center mb-4" />
                            <p className="text-xs text-slate-400 mt-4">
                                ระบบจะตรวจสอบอีเมลกับฐานข้อมูลนักศึกษา
                            </p>
                        </div>
                    )}

                    {/* Location Step */}
                    {step === "location" && (
                        <div className="text-center">
                            <Icon icon="solar:map-point-bold-duotone" className="text-6xl text-blue-500 mx-auto mb-4" />
                            <h2 className="text-lg font-semibold text-slate-800 mb-2">ยืนยันตำแหน่งที่ตั้ง</h2>
                            <p className="text-slate-500 text-sm mb-6">
                                รอบการเช็คชื่อนี้ต้องยืนยันตำแหน่งที่ตั้ง
                                <br />
                                <span className="text-xs text-slate-400">
                                    (รัศมี {session?.radius_meters} เมตรจากห้องเรียน)
                                </span>
                            </p>

                            {locationError && (
                                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                                    <Icon icon="solar:danger-triangle-bold" className="inline mr-2" />
                                    {locationError}
                                </div>
                            )}

                            {location && (
                                <div className="mb-4 p-3 bg-emerald-50 text-emerald-600 rounded-xl text-sm">
                                    <Icon icon="solar:check-circle-bold" className="inline mr-2" />
                                    ระบุตำแหน่งสำเร็จ
                                </div>
                            )}

                            <div className="space-y-3">
                                <Button
                                    color="primary"
                                    size="lg"
                                    className="w-full bg-gradient-to-r from-blue-400 to-indigo-500"
                                    startContent={
                                        !isGettingLocation && <Icon icon="solar:gps-bold" className="text-xl" />
                                    }
                                    isLoading={isGettingLocation}
                                    onPress={getLocation}
                                >
                                    {isGettingLocation ? "กำลังระบุตำแหน่ง..." : "อนุญาตการเข้าถึงตำแหน่ง"}
                                </Button>
                                {/* <Button
                                    variant="flat"
                                    size="lg"
                                    className="w-full"
                                    onPress={skipLocation}
                                >
                                    ข้ามขั้นตอนนี้
                                </Button> */}
                            </div>

                            <p className="text-xs text-slate-400 mt-4">
                                หากไม่ยืนยันตำแหน่ง อาจถูกบันทึกว่า "ขาด" หรือ "สาย"
                            </p>
                        </div>
                    )}

                    {/* PIN Entry Step */}
                    {step === "pin-entry" && (
                        <div className="text-center">
                            {studentInfo && (
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-6 text-left">
                                    <Avatar
                                        name={studentInfo.full_name}
                                        src={googleUser?.picture}
                                        size="md"
                                        className="bg-blue-500"
                                    />
                                    <div>
                                        <p className="font-medium text-slate-800">{studentInfo.full_name}</p>
                                        <p className="text-sm text-slate-500">{studentInfo.student_id}</p>
                                    </div>
                                </div>
                            )}

                            <Icon icon="solar:key-bold-duotone" className="text-6xl text-blue-500 mx-auto mb-4" />
                            <h2 className="text-lg font-semibold text-slate-800 mb-2">กรอกรหัส PIN</h2>
                            <p className="text-slate-500 text-sm mb-6">กรอกรหัส PIN 6 หลักที่แสดงในห้องเรียน</p>

                            <div className="flex justify-center">
                                <InputOtp
                                    length={6}
                                    value={pinCode}
                                    onValueChange={setPinCode}
                                    size="lg"
                                    variant="bordered"
                                    color="primary"
                                    onComplete={handleCheckIn}
                                    classNames={{
                                        segment: "w-11 h-14 text-xl font-bold",
                                        segmentWrapper: "gap-1.5",
                                    }}
                                />
                            </div>

                            {location && (
                                <div className="mt-4 p-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs flex items-center justify-center gap-1">
                                    <Icon icon="solar:map-point-bold" />
                                    ตำแหน่งที่ตั้งถูกระบุแล้ว
                                </div>
                            )}

                            <Button
                                color="primary"
                                size="lg"
                                className="w-full mt-6 bg-gradient-to-r from-blue-400 to-indigo-500"
                                isDisabled={pinCode.length !== 6}
                                isLoading={isSubmitting}
                                onPress={handleCheckIn}
                            >
                                เช็คชื่อ
                            </Button>
                        </div>
                    )}

                    {/* Success Step */}
                    {step === "success" && checkInResult && (
                        <div className="text-center py-6">
                            <div
                                className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                                    statusDisplay[checkInResult.status]?.color || "bg-emerald-100"
                                }`}
                            >
                                <Icon
                                    icon={statusDisplay[checkInResult.status]?.icon || "solar:check-circle-bold"}
                                    className="text-4xl"
                                />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-2">เช็คชื่อสำเร็จ!</h2>
                            <Chip
                                size="lg"
                                className={statusDisplay[checkInResult.status]?.color}
                            >
                                {statusDisplay[checkInResult.status]?.label}
                            </Chip>

                            <div className="mt-6 p-4 bg-slate-50 rounded-xl text-left space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">เวลาเช็คชื่อ</span>
                                    <span className="font-mono font-semibold">
                                        {formatTime(checkInResult.check_in_time)}
                                    </span>
                                </div>
                                {checkInResult.location_verified && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">ตำแหน่ง</span>
                                        <span className="text-emerald-600 flex items-center gap-1">
                                            <Icon icon="solar:check-circle-bold" />
                                            ยืนยันแล้ว ({checkInResult.distance_meters?.toFixed(0)}m)
                                        </span>
                                    </div>
                                )}
                            </div>

                            <p className="text-sm text-slate-400 mt-6">คุณสามารถปิดหน้านี้ได้</p>
                        </div>
                    )}

                    {/* Already Checked In */}
                    {step === "already-checked-in" && alreadyCheckedIn && (
                        <div className="text-center py-6">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                                <Icon icon="solar:info-circle-bold" className="text-4xl text-blue-600" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-2">เช็คชื่อไปแล้ว</h2>
                            <p className="text-slate-500 mb-4">
                                คุณได้เช็คชื่อในรอบนี้ไปแล้วเมื่อเวลา {formatTime(alreadyCheckedIn.check_in_time)}
                            </p>
                            <Chip
                                size="lg"
                                className={statusDisplay[alreadyCheckedIn.status]?.color || "bg-slate-100"}
                            >
                                {statusDisplay[alreadyCheckedIn.status]?.label || alreadyCheckedIn.status}
                            </Chip>
                        </div>
                    )}

                    {/* Error Step */}
                    {step === "error" && (
                        <div className="text-center py-6">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                                <Icon icon="solar:danger-triangle-bold" className="text-4xl text-red-600" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-2">เกิดข้อผิดพลาด</h2>
                            <p className="text-slate-500">{errorMessage}</p>
                            <Button
                                variant="flat"
                                className="mt-6"
                                onPress={() => window.location.reload()}
                            >
                                ลองใหม่
                            </Button>
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
