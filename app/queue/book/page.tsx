"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@heroui/button";
import { InputOtp } from "@heroui/input-otp";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { getRealtimeSocketBaseUrl, io, Socket } from "@/services/realtime-socket";
import { authService } from "@/services/auth.service";

import { API_BASE_URL } from "@/config/api";
import { csrfHeader } from "@/lib/csrf";
import { useNotification } from "@/contexts/NotificationContext";
import { IosInstallHint } from "@/components/system/IosInstallHint";
import { getQueueBookingStatusLabel, getQueueBookingTypeLabel } from "@/services/queue.service";

const STORAGE_KEY = "queue_booking_state";

interface VerifyPINResponse {
    session_id: number;
    title: string;
    course: {
        id: string;
        code: string;
        name: string;
    };
    classroom: {
        id: number;
        name: string;
        building: string;
    };
    require_attendance: boolean;
    is_cutoff_enabled?: boolean;
    cutoff_at?: string | null;
    cutoff_note?: string;
}

interface BookingResult {
    id: number;
    queue_number: number;
    session_title: string;
    booking_type: string;
    // number over the wire (models.QueueBooking.DeskNumber is an int),
    // string when this page fills it in from the form field
    desk_number: number | string;
    status: string;
    is_late_booking?: boolean;
    late_reason?: string;
}

interface BookingStatus {
    id: number;
    queue_number: number;
    booking_type: string;
    desk_number: number | string;
    status: string;
    assigned_worker_id?: number | null;
    position_in_queue: number;
    is_late_booking?: boolean;
    late_reason?: string;
    completed_at?: string;
    worker_note?: string | null;
    zone?: {
        id: string;
        name: string;
        color?: string;
    } | null;
    assignedWorker?: {
        id: number;
        full_name: string;
    };
    queueSession?: {
        id: number;
        title: string;
        status: string;
        is_cutoff_enabled?: boolean;
        cutoff_at?: string | null;
        cutoff_note?: string;
    };
    student?: {
        id: number;
        student_id: string;
        full_name: string;
    };
    score_details?: {
        type: 'single' | 'sub_items';
        assignment_name: string;
        score?: number;
        max_score?: number;
        graded_by?: string;
        graded_at?: string;
        comment?: string;
        sub_items?: {
            id: number;
            name: string;
            score: number;
            max_score: number;
            graded_by?: string;
            graded_at?: string;
        }[];
        total_score?: number;
        total_max_score?: number;
    };
}

interface ValidationError {
    field: string;
    message: string;
}

interface ValidationWarning {
    field: string;
    message: string;
    existing_booking?: {
        id: number;
        queue_number: number;
        booking_type: string;
        status: string;
    };
}

interface BookingValidationResult {
    valid: boolean;
    errors?: ValidationError[];
    warnings?: ValidationWarning[];
    student?: StudentInfo | null;
    desk?: DeskInfo | null;
    booking_type_availability?: {
        grading?: {
            allowed: boolean;
            reason?: string;
        };
        help?: {
            allowed: boolean;
            reason?: string;
        };
    };
    is_cutoff_enabled?: boolean;
    cutoff_at?: string | null;
    cutoff_note?: string;
    is_late_booking_preview?: boolean;
    late_reason_preview?: string;
}

interface StudentInfo {
    id: number;
    student_id: string;
    full_name: string;
}

interface DeskInfo {
    id: number;
    number: string;
    type: string;
}

// Save booking state to localStorage
const saveBookingState = (pinCode: string, studentId: string, bookingId: number) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        pinCode,
        studentId,
        bookingId,
        timestamp: Date.now(),
    }));
};

// Get booking state from localStorage
const getBookingState = (): { pinCode: string; studentId: string; bookingId: number } | null => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            // Check if data is less than 24 hours old
            if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
                return data;
            }
        }
    } catch (e) {
        console.error("Error reading booking state:", e);
    }
    return null;
};

// Clear booking state from localStorage
const clearBookingState = () => {
    localStorage.removeItem(STORAGE_KEY);
};

/**
 * Renders "who this result belongs to" for a screen a stranger may be looking
 * at: the last four digits of the student id and the given name only.
 *
 * Enough for the owner to recognise themselves at a glance, not enough for the
 * next person at the desk to walk away with someone's full student id and full
 * name. Short or missing values degrade to whatever is safe to show.
 */
function maskStudentIdentity(studentCode?: string, fullName?: string): string {
    const code = (studentCode || "").trim();
    const masked = code.length > 4 ? `••••${code.slice(-4)}` : code;
    const givenName = (fullName || "").trim().split(/\s+/)[0] || "";
    return [masked, givenName].filter(Boolean).join(" ");
}

function BookQueueContent() {
    const searchParams = useSearchParams();
    const initialPin = searchParams.get("pin") || "";
    const initialDesk = searchParams.get("desk") || "";
    const initialType = (searchParams.get("type") === "help" ? "help" : "grading") as "grading" | "help";
    const fromScan = !!(searchParams.get("desk") && searchParams.get("type"));

    // Step states
    const [step, setStep] = useState<"pin" | "select-course" | "form" | "status">("pin");
    const [isInitializing, setIsInitializing] = useState(true);

    // Group PIN state — populated when a shared (multi-course) PIN is entered
    type GroupSessionOption = {
        session_id: string; title: string; course_id: string; status: string;
        pin_code: string; require_attendance: boolean;
        is_cutoff_enabled: boolean; cutoff_at?: string | null; cutoff_note?: string;
        course: { id: string; code: string; name: string } | null;
        classroom: { id: string; name: string; building: string } | null;
    };
    const [groupSessions, setGroupSessions] = useState<GroupSessionOption[]>([]);

    // Desk notice modal — skip when coming from QR scan (desk already known)
    const [isDeskNoticeOpen, setIsDeskNoticeOpen] = useState(!fromScan);
    const [deskNoticeCountdown, setDeskNoticeCountdown] = useState(3);

    // Countdown timer for desk notice modal
    useEffect(() => {
        if (!isDeskNoticeOpen || deskNoticeCountdown <= 0) return;
        const timer = setTimeout(() => {
            setDeskNoticeCountdown((prev) => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [isDeskNoticeOpen, deskNoticeCountdown]);

    // Show desk notice only once per browser session (skip entirely when from scan)
    useEffect(() => {
        if (fromScan || sessionStorage.getItem("desk_notice_shown")) {
            setIsDeskNoticeOpen(false);
        }
    }, []);

    // PIN verification
    const [pinCode, setPinCode] = useState(initialPin);
    const [sessionInfo, setSessionInfo] = useState<VerifyPINResponse | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);

    // Current user (if logged in)
    const [loggedInUser] = useState(() => authService.getStoredUser());

    // This page is reachable anonymously (PIN-based booking, no login
    // required), so it must not assume a session exists — but when the
    // browser DOES carry one (student/staff already logged in elsewhere),
    // the httpOnly access cookie is sent automatically via `credentials:
    // "include"` on each fetch below, and the CSRF header is only added
    // when there's actually a session to protect.
    const buildQueueRequestHeaders = useCallback((includeContentType: boolean = true) => {
        const headers: Record<string, string> = { "X-Client-Type": "web" };
        if (includeContentType) {
            headers["Content-Type"] = "application/json";
        }

        Object.assign(headers, csrfHeader());

        return headers;
    }, []);

    // Booking form
    const [studentId, setStudentId] = useState(() => authService.getStoredUser()?.username ?? "");
    const [deskNumber, setDeskNumber] = useState(initialDesk);
    const [bookingType, setBookingType] = useState<"grading" | "help">(initialType);
    const [note, setNote] = useState("");
    const [showNote, setShowNote] = useState(false);
    const [isBooking, setIsBooking] = useState(false);

    // Validation states
    const [isValidating, setIsValidating] = useState(false);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
    const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
    const [deskInfo, setDeskInfo] = useState<DeskInfo | null>(null);
    const [bookingTypeAvailability, setBookingTypeAvailability] = useState<BookingValidationResult["booking_type_availability"] | null>(null);
    const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isLateConfirmOpen, setIsLateConfirmOpen] = useState(false);
    const [latePreviewInfo, setLatePreviewInfo] = useState<{ cutoffAt?: string | null; reason?: string } | null>(null);

    // Auto-book tracking (from QR scan)
    const autoBookTriggeredRef = useRef(false);

    // Booking status
    const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
    const [bookingStatus, setBookingStatus] = useState<BookingStatus | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    // Socket and polling refs
    const socketRef = useRef<Socket | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const currentBookingIdRef = useRef<number | null>(null);

    // Notification (self-hosted Web Push, VAPID)
    const { 
        isSupported: notificationSupported, 
        permissionStatus, 
        requestPermission, 
        registerPushToken,
        pushSubscribed,
    } = useNotification();

    // Check for existing booking on mount
    useEffect(() => {
        const checkSavedBooking = async () => {
            const savedState = getBookingState();
            if (savedState) {
                try {
                    // Check if booking still exists
                    const response = await fetch(`${API_BASE_URL}/queue/check-existing`, {
                        method: "POST",
                        credentials: "include",
                        headers: buildQueueRequestHeaders(),
                        body: JSON.stringify({
                            pin_code: savedState.pinCode,
                            student_id: savedState.studentId,
                        }),
                    });
                    const result = await response.json();

                    if (result.success && result.data.has_booking) {
                        // Restore session info first
                        const pinResponse = await fetch(`${API_BASE_URL}/queue/verify-pin`, {
                            method: "POST",
                            credentials: "include",
                            headers: buildQueueRequestHeaders(),
                            body: JSON.stringify({ pin_code: savedState.pinCode }),
                        });
                        const pinResult = await pinResponse.json();

                        if (pinResult.success) {
                            setPinCode(savedState.pinCode);
                            setStudentId(savedState.studentId);
                            setSessionInfo(pinResult.data);
                            setBookingResult({
                                id: result.data.booking.id,
                                queue_number: result.data.booking.queue_number,
                                booking_type: result.data.booking.booking_type,
                                desk_number: result.data.booking.desk_number,
                                status: result.data.booking.status,
                                session_title: pinResult.data.title,
                            });
                            setStep("status");
                            startStatusPolling(result.data.booking.id, pinResult.data.session_id);

                            addToast({
                                title: "พบการจองที่ยังไม่เสร็จ",
                                description: `กำลังแสดงคิวที่ ${result.data.booking.queue_number}`,
                                color: "primary",
                            });
                        }
                    } else {
                        // Booking completed or not found, clear state
                        clearBookingState();
                    }
                } catch (error) {
                    console.error("Error checking saved booking:", error);
                    clearBookingState();
                }
            }

            // Auto verify if PIN is in URL
            if (initialPin && !savedState) {
                setPinCode(initialPin);
            }

            setIsInitializing(false);
        };

        checkSavedBooking();
    }, [buildQueueRequestHeaders]);

    // Auto verify PIN when set from URL (after initialization)
    useEffect(() => {
        if (!isInitializing && initialPin && step === "pin") {
            handleVerifyPIN();
        }
    }, [isInitializing, initialPin]);

    // Auto-book when coming from QR scan and all data is known
    useEffect(() => {
        if (
            step === "form" &&
            fromScan &&
            loggedInUser &&
            deskNumber &&
            !isValidating &&
            bookingTypeAvailability &&
            !(bookingType === "grading" && bookingTypeAvailability.grading?.allowed === false) &&
            !autoBookTriggeredRef.current
        ) {
            autoBookTriggeredRef.current = true;
            handleCreateBooking();
        }
    }, [step, fromScan, loggedInUser, deskNumber, isValidating, bookingTypeAvailability, bookingType]);

    // Validate booking info with debounce
    const validateBookingInfo = useCallback(async () => {
        if (!pinCode || !studentId || !deskNumber) {
            return;
        }

        setIsValidating(true);
        try {
            const response = await fetch(`${API_BASE_URL}/queue/validate`, {
                method: "POST",
                credentials: "include",
                headers: buildQueueRequestHeaders(),
                body: JSON.stringify({
                    pin_code: pinCode,
                    student_id: studentId,
                    desk_number: deskNumber,
                    booking_type: bookingType,
                }),
            });

            const result = await response.json();

            if (result.success) {
                setValidationErrors(result.data.errors || []);
                setValidationWarnings(result.data.warnings || []);
                setStudentInfo(result.data.student);
                setDeskInfo(result.data.desk);
                setBookingTypeAvailability(result.data.booking_type_availability || null);
            }
        } catch (error) {
            console.error("Error validating:", error);
        } finally {
            setIsValidating(false);
        }
    }, [pinCode, studentId, deskNumber, bookingType, buildQueueRequestHeaders]);

    const validateBookingForSubmit = useCallback(async (): Promise<BookingValidationResult | null> => {
        const response = await fetch(`${API_BASE_URL}/queue/validate`, {
            method: "POST",
            credentials: "include",
            headers: buildQueueRequestHeaders(),
            body: JSON.stringify({
                pin_code: pinCode,
                student_id: studentId,
                desk_number: deskNumber,
                booking_type: bookingType,
            }),
        });

        const result = await response.json();
        if (!result.success) {
            return null;
        }

        return result.data as BookingValidationResult;
    }, [pinCode, studentId, deskNumber, bookingType, buildQueueRequestHeaders]);

    // Debounced validation when inputs change
    useEffect(() => {
        if (step !== "form" || !studentId || !deskNumber) {
            return;
        }

        if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current);
        }

        validationTimeoutRef.current = setTimeout(() => {
            validateBookingInfo();
        }, 500);

        return () => {
            if (validationTimeoutRef.current) {
                clearTimeout(validationTimeoutRef.current);
            }
        };
    }, [studentId, deskNumber, bookingType, step, validateBookingInfo]);

    useEffect(() => {
        if (step !== "form" || fromScan) return;
        if (bookingType !== "grading") return;
        if (bookingTypeAvailability?.grading?.allowed === false && bookingTypeAvailability?.help?.allowed !== false) {
            setBookingType("help");
        }
    }, [bookingType, bookingTypeAvailability, fromScan, step]);

    // Auto-refresh validation while waiting for attendance status propagation.
    useEffect(() => {
        const hasAttendancePendingError = validationErrors.some(
            (error) => error.field === "student_id" && error.message.includes("เช็กชื่อ")
        );

        if (
            step !== "form" ||
            !sessionInfo?.require_attendance ||
            !studentId ||
            !deskNumber ||
            !hasAttendancePendingError ||
            isBooking ||
            isValidating
        ) {
            return;
        }

        const timer = setInterval(() => {
            validateBookingInfo();
        }, 3000);

        return () => {
            clearInterval(timer);
        };
    }, [
        step,
        sessionInfo?.require_attendance,
        studentId,
        deskNumber,
        validationErrors,
        isBooking,
        isValidating,
        validateBookingInfo,
    ]);

    // Verify PIN
    const handleVerifyPIN = async () => {
        if (!pinCode.trim()) {
            addToast({
                title: "กรุณากรอก PIN",
                description: "กรุณากรอก PIN Code",
                color: "warning",
            });
            return;
        }

        setIsVerifying(true);
        try {
            const response = await fetch(`${API_BASE_URL}/queue/verify-pin`, {
                method: "POST",
                credentials: "include",
                headers: buildQueueRequestHeaders(),
                body: JSON.stringify({ pin_code: pinCode }),
            });

            const result = await response.json();

            if (result.success) {
                if (result.data?.is_group) {
                    setGroupSessions(result.data.sessions || []);
                    setStep("select-course");
                } else {
                    setSessionInfo(result.data);
                    setStep("form");
                }
            } else {
                const isPaused = result.error?.code === "SESSION_PAUSED";
                addToast({
                    title: isPaused ? "ปิดรับการจองคิว" : "PIN ไม่ถูกต้อง",
                    description: result.error?.message || "ไม่พบการจองคิวที่เปิดอยู่",
                    color: isPaused ? "warning" : "danger",
                });
            }
        } catch (error) {
            console.error("Error verifying PIN:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถตรวจสอบ PIN ได้",
                color: "danger",
            });
        } finally {
            setIsVerifying(false);
        }
    };

    // Create booking
    const createBookingRequest = useCallback(async () => {
        const response = await fetch(`${API_BASE_URL}/queue/bookings`, {
            method: "POST",
            credentials: "include",
            headers: buildQueueRequestHeaders(),
            body: JSON.stringify({
                pin_code: pinCode,
                student_id: studentId,
                desk_number: deskNumber,
                booking_type: bookingType,
                note: note || undefined,
            }),
        });

        return response.json();
    }, [pinCode, studentId, deskNumber, bookingType, note, buildQueueRequestHeaders]);

    const handleCreateBooking = async () => {
        if (!studentId.trim()) {
            addToast({
                title: "กรุณากรอกรหัสนักศึกษา",
                color: "warning",
            });
            return;
        }

        if (!deskNumber.trim()) {
            addToast({
                title: "กรุณากรอกเลขโต๊ะ",
                color: "warning",
            });
            return;
        }

        setIsBooking(true);
        try {
            const validation = await validateBookingForSubmit();
            if (validation) {
                setValidationErrors(validation.errors || []);
                setValidationWarnings(validation.warnings || []);
                setStudentInfo(validation.student || null);
                setDeskInfo(validation.desk || null);
                setBookingTypeAvailability(validation.booking_type_availability || null);

                if (validation.errors && validation.errors.length > 0) {
                    addToast({
                        title: "ไม่สามารถจองได้",
                        description: validation.errors[0].message,
                        color: "danger",
                    });
                    return;
                }

                const existingBookingWarning = (validation.warnings || []).find(w => w.existing_booking);
                if (existingBookingWarning?.existing_booking) {
                    setBookingResult({
                        id: existingBookingWarning.existing_booking.id,
                        queue_number: existingBookingWarning.existing_booking.queue_number,
                        booking_type: existingBookingWarning.existing_booking.booking_type,
                        desk_number: deskNumber,
                        status: existingBookingWarning.existing_booking.status,
                        session_title: sessionInfo?.title || "",
                    });
                    setStep("status");
                    saveBookingState(pinCode, studentId, existingBookingWarning.existing_booking.id);
                    startStatusPolling(existingBookingWarning.existing_booking.id, sessionInfo?.session_id);
                    addToast({
                        title: "พบการจองที่มีอยู่แล้ว",
                        description: `กำลังแสดงคิวที่ ${existingBookingWarning.existing_booking.queue_number}`,
                        color: "primary",
                    });
                    return;
                }

                if (validation.is_late_booking_preview) {
                    setLatePreviewInfo({
                        cutoffAt: validation.cutoff_at,
                        reason: validation.late_reason_preview || validation.cutoff_note,
                    });
                    setIsLateConfirmOpen(true);
                    return;
                }
            } else {
                addToast({
                    title: "ไม่สามารถตรวจสอบข้อมูลได้",
                    description: "กรุณาลองใหม่อีกครั้ง",
                    color: "danger",
                });
                return;
            }

            const result = await createBookingRequest();

            if (result.success) {
                setBookingResult(result.data);
                setStep("status");
                // Save to localStorage
                saveBookingState(pinCode, studentId, result.data.id);
                
                // Request notification permission and register for push notifications
                if (notificationSupported && permissionStatus !== "granted") {
                    const permissionResult = await requestPermission();
                    if (permissionResult.granted) {
                        await registerPushToken("student", result.data.id);
                    }
                } else if (pushSubscribed || permissionStatus === "granted") {
                    await registerPushToken("student", result.data.id);
                }
                
                addToast({
                    title: "จองคิวสำเร็จ!",
                    description: `คิวที่ ${result.data.queue_number}`,
                    color: "success",
                });

                // Start polling status with session ID for real-time position updates
                startStatusPolling(result.data.id, sessionInfo?.session_id);
            } else {
                const isPaused = result.error?.code === "SESSION_PAUSED";
                addToast({
                    title: isPaused ? "ปิดรับการจองคิว" : "จองคิวไม่สำเร็จ",
                    description: result.error?.message || "เกิดข้อผิดพลาด",
                    color: isPaused ? "warning" : "danger",
                });
            }
        } catch (error) {
            console.error("Error creating booking:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถจองคิวได้",
                color: "danger",
            });
        } finally {
            setIsBooking(false);
        }
    };

    const handleConfirmLateBooking = async () => {
        setIsLateConfirmOpen(false);
        setIsBooking(true);
        try {
            const result = await createBookingRequest();
            if (result.success) {
                setBookingResult(result.data);
                setStep("status");
                saveBookingState(pinCode, studentId, result.data.id);

                if (notificationSupported && permissionStatus !== "granted") {
                    const permissionResult = await requestPermission();
                    if (permissionResult.granted) {
                        await registerPushToken("student", result.data.id);
                    }
                } else if (pushSubscribed || permissionStatus === "granted") {
                    await registerPushToken("student", result.data.id);
                }

                addToast({
                    title: "จองคิวสำเร็จ!",
                    description: `คิวที่ ${result.data.queue_number}`,
                    color: "success",
                });

                startStatusPolling(result.data.id, sessionInfo?.session_id);
            } else {
                const isPaused = result.error?.code === "SESSION_PAUSED";
                addToast({
                    title: isPaused ? "ปิดรับการจองคิว" : "จองคิวไม่สำเร็จ",
                    description: result.error?.message || "เกิดข้อผิดพลาด",
                    color: isPaused ? "warning" : "danger",
                });
            }
        } catch (error) {
            console.error("Error creating late booking:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถจองคิวได้",
                color: "danger",
            });
        } finally {
            setIsBooking(false);
        }
    };

    const formatCutoffDateTime = (value?: string | null) => {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleString("th-TH", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Fetch booking status
    const fetchBookingStatus = useCallback(async (bookingId: number) => {
        try {
            const response = await fetch(`${API_BASE_URL}/queue/bookings/${bookingId}/status`);
            const result = await response.json();

            if (result.success) {
                setBookingStatus(result.data);
                if (["completed", "cancelled", "no_show"].includes(result.data.status)) {
                    clearBookingState();
                }
            }
        } catch (error) {
            console.error("Error fetching status:", error);
        }
    }, []);

    // Cleanup previous polling/socket
    const cleanupPolling = useCallback(() => {
        if (socketRef.current) {
            if (currentBookingIdRef.current) {
                socketRef.current.emit("leave-booking", currentBookingIdRef.current);
            }
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // Cancel booking
    const handleCancelBooking = async () => {
        if (!bookingResult) return;

        setIsCancelling(true);
        try {
            const response = await fetch(`${API_BASE_URL}/queue/bookings/${bookingResult.id}/cancel`, {
                method: "POST",
                credentials: "include",
                headers: buildQueueRequestHeaders(),
            });

            const result = await response.json();

            if (result.success) {
                // Clear localStorage
                clearBookingState();
                // Cleanup socket/polling
                cleanupPolling();
                
                addToast({
                    title: "ยกเลิกการจองสำเร็จ",
                    description: `คิวที่ ${bookingResult.queue_number} ถูกยกเลิกแล้ว`,
                    color: "success",
                });

                // Reset to form step so user can book again
                setBookingResult(null);
                setBookingStatus(null);
                setStep("form");
            } else {
                addToast({
                    title: "ยกเลิกไม่สำเร็จ",
                    description: result.error?.message || "เกิดข้อผิดพลาด",
                    color: "danger",
                });
            }
        } catch (error) {
            console.error("Error cancelling booking:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถยกเลิกการจองได้",
                color: "danger",
            });
        } finally {
            setIsCancelling(false);
        }
    };

    // Start status polling and socket connection
    const startStatusPolling = useCallback((bookingId: number, sessionId?: number) => {
        // Cleanup any existing connections first
        cleanupPolling();
        
        // Set current booking ID
        currentBookingIdRef.current = bookingId;
        
        // Reset booking status for new booking
        setBookingStatus(null);
        
        // Initial fetch
        fetchBookingStatus(bookingId);

        // Connect to socket for real-time updates
        const socket = io(getRealtimeSocketBaseUrl());

        socket.on("connect", () => {
            socket.emit("join-booking", bookingId);
            // Also join queue session room to receive position updates
            if (sessionId) {
                socket.emit("join-queue", sessionId);
            }
        });

        socket.on("your-booking-completed", (data) => {
            // Wait a bit for score to be saved before fetching
            setTimeout(() => {
                fetchBookingStatus(bookingId);
            }, 500);
            // Clear localStorage when booking is completed
            clearBookingState();
            addToast({
                title: "ตรวจเสร็จแล้ว!",
                description: "คิวของคุณเสร็จสิ้นแล้ว",
                color: "success",
            });
        });

        socket.on("booking-assigned", () => {
            fetchBookingStatus(bookingId);
        });

        socket.on("booking-cancelled", () => {
            fetchBookingStatus(bookingId);
            clearBookingState();
            addToast({
                title: "คิวถูกยกเลิกแล้ว",
                description: "รายการจองนี้ไม่อยู่ในคิวแล้ว",
                color: "warning",
            });
        });

        socket.on("booking-skipped", () => {
            fetchBookingStatus(bookingId);
            clearBookingState();
            addToast({
                title: "คิวถูกข้าม",
                description: "ผู้ตรวจข้ามคิวของคุณแล้ว กรุณาจองคิวใหม่หากยังต้องการความช่วยเหลือ",
                color: "warning",
            });
        });

        socket.on("booking-completed", () => {
            fetchBookingStatus(bookingId);
        });

        socket.on("booking-requeued", () => {
            fetchBookingStatus(bookingId);
        });

        // Listen for queue position updates (when other bookings complete)
        socket.on("queue-position-updated", () => {
            // Re-fetch status to get updated position
            fetchBookingStatus(bookingId);
        });

        socketRef.current = socket;

        // Also poll every 30 seconds as backup - socket handles real-time updates
        intervalRef.current = setInterval(() => {
            fetchBookingStatus(bookingId);
        }, 30000);

        return () => {
            cleanupPolling();
        };
    }, [fetchBookingStatus, cleanupPolling]);

    // Cleanup socket and interval on unmount
    useEffect(() => {
        return () => {
            cleanupPolling();
        };
    }, [cleanupPolling]);

    // Get status display
    const getStatusDisplay = (status: string) => {
        const statusMap: Record<string, { label: string; color: "default" | "primary" | "secondary" | "success" | "warning" | "danger"; icon: string }> = {
            waiting: { label: getQueueBookingStatusLabel("waiting", false), color: "primary", icon: "solar:hourglass-bold" },
            in_progress: { label: getQueueBookingStatusLabel("in_progress", false), color: "warning", icon: "solar:clipboard-check-bold" },
            completed: { label: getQueueBookingStatusLabel("completed", false), color: "success", icon: "solar:check-circle-bold" },
            cancelled: { label: getQueueBookingStatusLabel("cancelled", false), color: "danger", icon: "solar:close-circle-bold" },
            no_show: { label: getQueueBookingStatusLabel("no_show", false), color: "default", icon: "solar:user-cross-bold" },
        };
        return statusMap[status] || { label: status, color: "default", icon: "solar:question-circle-bold" };
    };

    // Desk notice modal element (rendered in all steps)
    const deskNoticeModal = (
        <Modal
            isOpen={isDeskNoticeOpen}
            hideCloseButton
            isDismissable={false}
            isKeyboardDismissDisabled
            size="sm"
            placement="center"
            classNames={{
                backdrop: "bg-slate-900/35 backdrop-blur-[2px]",
                base: "border border-slate-200 bg-white shadow-2xl shadow-slate-900/10",
                header: "bg-white",
                body: "bg-white",
                footer: "bg-white",
            }}
        >
            <ModalContent className="bg-white">
                <ModalHeader className="flex flex-col items-center gap-2 pt-6 pb-2">
                    <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                        <Icon icon="solar:monitor-bold-duotone" className="text-3xl text-amber-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 text-center">แจ้งเตือนสำคัญ</h3>
                </ModalHeader>
                <ModalBody className="px-6 pb-2 pt-0">
                    <p className="text-center text-slate-600 text-sm leading-relaxed">
                        กรุณาดูเลขโต๊ะจากแผนผังที่แสดงบน
                        <span className="font-semibold text-amber-700"> หน้าจอโปรเจกเตอร์ </span>
                        เท่านั้น
                    </p>
                </ModalBody>
                <ModalFooter className="justify-center pb-6 pt-3">
                    <Button
                        color="primary"
                        size="lg"
                        className="w-full max-w-50 bg-linear-to-r from-sky-600 to-cyan-500"
                        isDisabled={deskNoticeCountdown > 0}
                        onPress={() => {
                            setIsDeskNoticeOpen(false);
                            sessionStorage.setItem("desk_notice_shown", "1");
                        }}
                    >
                        {deskNoticeCountdown > 0 ? `ตกลง (${deskNoticeCountdown})` : "ตกลง"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );

    // Show loading while initializing
    if (isInitializing) {
        return (
            <div data-theme-scope="adaptive queue" className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                {deskNoticeModal}
                <div className="flex flex-col items-center gap-4">
                    <div className="h-16 w-16 flex items-center justify-center rounded-3xl bg-linear-to-br from-sky-600 to-cyan-500 shadow-xl shadow-sky-300/40">
                        <Icon icon="solar:ticket-bold-duotone" className="text-3xl text-white" />
                    </div>
                    <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-sky-400 border-t-transparent" />
                    <p className="text-sm text-slate-400">กำลังตรวจสอบสถานะ...</p>
                </div>
            </div>
        );
    }

    // Render PIN step
    const TaskHeader = ({ title, onBack }: { title: string; onBack?: () => void }) => (
        <div className="cg-task-top">
            {onBack ? (
                <button type="button" className="cg-task-btn" onClick={onBack} aria-label="ย้อนกลับ">
                    <Icon icon="solar:alt-arrow-left-linear" width={17} height={17} />
                </button>
            ) : (
                <Link href="/student/scan" className="cg-task-btn" aria-label="ปิด">
                    <Icon icon="solar:close-circle-linear" width={17} height={17} />
                </Link>
            )}
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{title}</span>
            <Link href="/student" className="cg-task-btn" aria-label="หน้าหลัก">
                <Icon icon="solar:home-2-linear" width={17} height={17} />
            </Link>
        </div>
    );

    // ── step 1: PIN ──────────────────────────────────────────────────
    if (step === "pin") {
        return (
            <div className="cg-task-screen pb-6">
                {deskNoticeModal}
                <TaskHeader title="จองคิวตรวจงาน" />

                <div className="cg-steps">
                    <span data-state="now" /><span /><span />
                </div>

                <div className="cg-card">
                    <p className="cg-section-label" style={{ padding: 0 }}>กรอกรหัส PIN 6 หลัก</p>
                    <p className="mb-4 mt-1.5 text-[11.5px] font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
                        รหัสได้รับจากผู้ตรวจหรืออาจารย์ในห้องเรียน
                    </p>
                    <div className="flex justify-center">
                        <InputOtp
                            length={6}
                            value={pinCode}
                            onValueChange={setPinCode}
                            size="lg"
                            variant="bordered"
                            color="primary"
                            onComplete={handleVerifyPIN}
                            classNames={{ segment: "w-11 h-14 text-xl font-medium rounded-2xl", segmentWrapper: "gap-1.5" }}
                        />
                    </div>
                </div>

                <div className="cg-task-cta">
                    <button type="button" className="cg-btn" onClick={handleVerifyPIN} disabled={pinCode.length !== 6 || isVerifying}>
                        {isVerifying ? "กำลังตรวจสอบ" : "ยืนยันรหัส"}
                    </button>
                </div>
            </div>
        );
    }

    // ── step 2: pick the course when one PIN opens several ───────────
    if (step === "select-course") {
        return (
            <div className="cg-task-screen pb-6">
                {deskNoticeModal}
                <TaskHeader title="เลือกรายวิชา" onBack={() => { setGroupSessions([]); setStep("pin"); }} />

                <div className="cg-steps">
                    <span data-state="done" /><span data-state="now" /><span />
                </div>

                <p className="cg-page-sub" style={{ paddingTop: 0 }}>
                    ห้องนี้เปิดรับคิวหลายรายวิชาพร้อมกัน กรุณาเลือกรายวิชาของท่าน
                </p>

                <div className="cg-list">
                    {groupSessions.map((gs) => (
                        <button
                            key={gs.session_id}
                            type="button"
                            className="cg-row"
                            onClick={() => {
                                setPinCode(gs.pin_code);
                                setSessionInfo({
                                    session_id: gs.session_id as unknown as number,
                                    title: gs.title,
                                    course: gs.course || { id: gs.course_id, code: "", name: "" },
                                    classroom: gs.classroom ? { id: Number(gs.classroom.id), name: gs.classroom.name, building: gs.classroom.building } : { id: 0, name: "", building: "" },
                                    require_attendance: gs.require_attendance,
                                    is_cutoff_enabled: gs.is_cutoff_enabled,
                                    cutoff_at: gs.cutoff_at,
                                    cutoff_note: gs.cutoff_note,
                                });
                                setStep("form");
                            }}
                        >
                            <span className="cg-row-ico" style={{ background: "var(--cg-accent-soft)", color: "var(--cg-accent)" }}>
                                <Icon icon="solar:notebook-linear" width={17} height={17} />
                            </span>
                            <span className="cg-row-body">
                                <span className="cg-row-title truncate">{gs.title}</span>
                                <span className="cg-row-sub truncate">{gs.course?.name || gs.course_id}</span>
                                {gs.classroom?.name && (
                                    <span className="cg-row-sub truncate" style={{ color: "var(--cg-text-3)" }}>
                                        ห้อง {gs.classroom.name}{gs.classroom.building ? ` ${gs.classroom.building}` : ""}
                                    </span>
                                )}
                            </span>
                            <Icon icon="solar:alt-arrow-right-linear" className="cg-chevron" width={15} height={15} />
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ── step 3: booking form ─────────────────────────────────────────
    if (step === "form" && sessionInfo) {
        const studentError = validationErrors.find(e => e.field === "student_id");
        const deskError = validationErrors.find(e => e.field === "desk_number");
        const existingBookingWarning = validationWarnings.find(w => w.existing_booking);
        const gradingDisabled = bookingTypeAvailability?.grading?.allowed === false;
        const gradingDisabledReason = bookingTypeAvailability?.grading?.reason;

        // Scanned a desk QR while already signed in: nothing left to ask for.
        if (fromScan && loggedInUser && isBooking) {
            return (
                <div className="flex flex-col items-center justify-center gap-4 text-center" style={{ minHeight: "70dvh" }}>
                    {deskNoticeModal}
                    <div className="h-7 w-7 animate-spin rounded-full border-[3px]" style={{ borderColor: "var(--cg-accent)", borderTopColor: "transparent" }} />
                    <div>
                        <p className="text-sm font-medium">กำลังจองคิว</p>
                        <p className="mt-1 text-xs font-light" style={{ color: "var(--cg-text-2)" }}>
                            {sessionInfo.title} โต๊ะ {deskNumber}
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <div className="cg-task-screen pb-6">
                {deskNoticeModal}
                <TaskHeader title="จองคิวตรวจงาน" onBack={() => setStep("pin")} />

                <div className="cg-steps">
                    <span data-state="done" /><span data-state="done" /><span data-state="now" />
                </div>

                <div className="cg-card">
                    <p className="text-[11px] font-normal" style={{ color: "var(--cg-text-3)" }}>รอบตรวจงานที่เปิดอยู่</p>
                    <h1 className="mt-1.5 text-[17px] font-medium leading-relaxed">{sessionInfo.title}</h1>
                    <p className="mt-1 text-xs font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
                        {sessionInfo.course.code} {sessionInfo.course.name}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5 border-t pt-3" style={{ borderColor: "var(--cg-line)" }}>
                        <span className="flex items-center gap-1.5 text-[11.5px] font-light" style={{ color: "var(--cg-text-2)" }}>
                            <Icon icon="solar:buildings-linear" width={13} height={13} style={{ color: "var(--cg-text-3)" }} />
                            ห้อง {sessionInfo.classroom.name} {sessionInfo.classroom.building}
                        </span>
                        {sessionInfo.is_cutoff_enabled && sessionInfo.cutoff_at && (
                            <span className="flex items-center gap-1.5 text-[11.5px] font-light" style={{ color: "var(--cg-warning)" }}>
                                <Icon icon="solar:clock-circle-linear" width={13} height={13} />
                                ปิดรับ {new Date(sessionInfo.cutoff_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                            </span>
                        )}
                    </div>
                </div>

                {/* who is booking */}
                {loggedInUser ? (
                    <div className="cg-list">
                        <div className="cg-row">
                            <span className="cg-row-ico" style={{ background: "var(--cg-accent-soft)", color: "var(--cg-accent)" }}>
                                <Icon icon="solar:user-id-linear" width={17} height={17} />
                            </span>
                            <span className="cg-row-body">
                                <span className="cg-row-title truncate">{loggedInUser.full_name}</span>
                                <span className="cg-row-sub cg-mono">{loggedInUser.username}</span>
                            </span>
                            <span className="cg-badge cg-badge-success">เข้าสู่ระบบแล้ว</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="q-student-id" className="text-xs font-normal" style={{ color: "var(--cg-text-2)" }}>
                            รหัสนักศึกษา (แบบมีขีด)
                        </label>
                        <div className="cg-field-box" style={studentError ? { borderColor: "var(--cg-danger)" } : studentInfo ? { borderColor: "var(--cg-success)" } : undefined}>
                            <Icon icon="solar:user-id-linear" width={17} height={17} style={{ color: "var(--cg-text-3)" }} />
                            <input
                                id="q-student-id"
                                type="text"
                                inputMode="text"
                                autoCapitalize="off"
                                autoCorrect="off"
                                placeholder="เช่น 65010000-0"
                                value={studentId}
                                onChange={(e) => {
                                    setStudentId(e.target.value);
                                    setStudentInfo(null);
                                    setValidationErrors(prev => prev.filter(err => err.field !== "student_id"));
                                }}
                            />
                            {isValidating && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2" style={{ borderColor: "var(--cg-accent)", borderTopColor: "transparent" }} />}
                            {!isValidating && studentError && <Icon icon="solar:close-circle-linear" width={18} height={18} style={{ color: "var(--cg-danger)" }} />}
                            {!isValidating && studentInfo && <Icon icon="solar:check-circle-linear" width={18} height={18} style={{ color: "var(--cg-success)" }} />}
                        </div>
                        {studentError && <p className="px-1 text-[11px] font-light" style={{ color: "var(--cg-danger)" }}>{studentError.message}</p>}
                        {studentInfo && !studentError && (
                            <p className="px-1 text-[11px] font-light" style={{ color: "var(--cg-success)" }}>{studentInfo.full_name}</p>
                        )}
                    </div>
                )}

                {/* desk */}
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="q-desk" className="text-xs font-normal" style={{ color: "var(--cg-text-2)" }}>เลขโต๊ะที่นั่งอยู่</label>
                    {fromScan ? (
                        <div className="cg-field-box" style={{ borderColor: "var(--cg-success)" }}>
                            <Icon icon="solar:armchair-linear" width={17} height={17} style={{ color: "var(--cg-success)" }} />
                            <span className="flex-1 text-base font-medium">{deskNumber}</span>
                            <Icon icon="solar:check-circle-linear" width={18} height={18} style={{ color: "var(--cg-success)" }} />
                        </div>
                    ) : (
                        <>
                            <div className="cg-field-box" style={deskError ? { borderColor: "var(--cg-danger)" } : deskInfo ? { borderColor: "var(--cg-success)" } : undefined}>
                                <Icon icon="solar:armchair-linear" width={17} height={17} style={{ color: "var(--cg-text-3)" }} />
                                <input
                                    id="q-desk"
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="เช่น 1, 2, 3"
                                    value={deskNumber}
                                    onChange={(e) => {
                                        setDeskNumber(e.target.value.replace(/[^0-9]/g, ""));
                                        setDeskInfo(null);
                                        setValidationErrors(prev => prev.filter(err => err.field !== "desk_number"));
                                    }}
                                />
                                {isValidating && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2" style={{ borderColor: "var(--cg-accent)", borderTopColor: "transparent" }} />}
                                {!isValidating && deskError && <Icon icon="solar:close-circle-linear" width={18} height={18} style={{ color: "var(--cg-danger)" }} />}
                                {!isValidating && deskInfo && <Icon icon="solar:check-circle-linear" width={18} height={18} style={{ color: "var(--cg-success)" }} />}
                            </div>
                            {deskError && <p className="px-1 text-[11px] font-light" style={{ color: "var(--cg-danger)" }}>{deskError.message}</p>}
                            {deskInfo && !deskError && (
                                <p className="px-1 text-[11px] font-light" style={{ color: "var(--cg-success)" }}>โต๊ะหมายเลข {deskInfo.number} พร้อมใช้งาน</p>
                            )}
                            <p className="px-1 text-[11px] font-light" style={{ color: "var(--cg-text-3)" }}>
                                ดูเลขโต๊ะจากแผนผังบนหน้าจอโปรเจกเตอร์เท่านั้น
                            </p>
                        </>
                    )}
                </div>

                {existingBookingWarning && (
                    <div className="cg-note" style={{ background: "var(--cg-info-soft)" }}>
                        <Icon icon="solar:info-circle-linear" width={16} height={16} className="mt-0.5 shrink-0" style={{ color: "var(--cg-info)" }} />
                        <p className="m-0">
                            {existingBookingWarning.message} กดปุ่มด้านล่างเพื่อดูสถานะคิวที่มีอยู่
                        </p>
                    </div>
                )}

                {/* booking type */}
                <div className="flex flex-col gap-2">
                    <p className="cg-section-label">ต้องการให้ช่วยเรื่องอะไร</p>
                    <div className="grid grid-cols-2 gap-2.5">
                        <button
                            type="button"
                            onClick={() => { if (!gradingDisabled) setBookingType("grading"); }}
                            disabled={gradingDisabled}
                            className="flex flex-col items-center gap-1.5 rounded-2xl p-4 disabled:opacity-50"
                            style={{
                                background: bookingType === "grading" ? "var(--cg-accent-soft)" : "var(--cg-surface)",
                                border: `1.5px solid ${bookingType === "grading" ? "var(--cg-accent)" : "transparent"}`,
                                boxShadow: "var(--cg-shadow-1)",
                            }}
                        >
                            <Icon icon="solar:clipboard-check-linear" width={24} height={24}
                                style={{ color: bookingType === "grading" ? "var(--cg-accent)" : "var(--cg-text-3)" }} />
                            <b className="text-[13px] font-medium" style={{ color: bookingType === "grading" ? "var(--cg-accent-strong)" : "var(--cg-text)" }}>ตรวจงาน</b>
                            <span className="text-center text-[10.5px] font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
                                ส่งงานให้ผู้ตรวจพิจารณาให้คะแนน
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setBookingType("help")}
                            className="flex flex-col items-center gap-1.5 rounded-2xl p-4"
                            style={{
                                background: bookingType === "help" ? "var(--cg-accent-soft)" : "var(--cg-surface)",
                                border: `1.5px solid ${bookingType === "help" ? "var(--cg-accent)" : "transparent"}`,
                                boxShadow: "var(--cg-shadow-1)",
                            }}
                        >
                            <Icon icon="solar:hand-shake-linear" width={24} height={24}
                                style={{ color: bookingType === "help" ? "var(--cg-accent)" : "var(--cg-text-3)" }} />
                            <b className="text-[13px] font-medium" style={{ color: bookingType === "help" ? "var(--cg-accent-strong)" : "var(--cg-text)" }}>ขอความช่วยเหลือ</b>
                            <span className="text-center text-[10.5px] font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
                                ต้องการให้ผู้ตรวจมาช่วยตรวจสอบ
                            </span>
                        </button>
                    </div>
                    {gradingDisabledReason && (
                        <p className="px-1 text-[11px] font-light" style={{ color: "var(--cg-text-2)" }}>{gradingDisabledReason}</p>
                    )}
                </div>

                {/* note */}
                <div className="flex flex-col gap-2">
                    <button type="button" className="cg-link self-start" onClick={() => setShowNote(v => !v)}>
                        <Icon icon={showNote ? "solar:minus-circle-linear" : "solar:add-circle-linear"} width={15} height={15} />
                        {showNote ? "ซ่อนหมายเหตุ" : "เพิ่มหมายเหตุถึงผู้ตรวจ (ไม่บังคับ)"}
                    </button>
                    {showNote && (
                        <textarea
                            placeholder="เช่น ต้องการให้ตรวจส่วนที่ 2"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={2}
                            className="w-full resize-none rounded-2xl px-3.5 py-3 outline-none"
                            style={{
                                background: "var(--cg-surface)",
                                border: "1.5px solid var(--cg-line)",
                                color: "var(--cg-text)",
                                boxShadow: "var(--cg-shadow-1)",
                                fontSize: 16,
                                fontWeight: 400,
                            }}
                        />
                    )}
                </div>

                {sessionInfo.require_attendance && (
                    <div className="cg-note">
                        <Icon icon="solar:info-circle-linear" width={16} height={16} className="mt-0.5 shrink-0" style={{ color: "var(--cg-warning)" }} />
                        <p className="m-0">ต้องเช็กชื่อก่อนจึงจะจองคิวได้</p>
                    </div>
                )}

                <div className="cg-task-cta">
                    <button
                        type="button"
                        className="cg-btn"
                        onClick={handleCreateBooking}
                        disabled={isBooking || !studentId || !deskNumber || (bookingType === "grading" && gradingDisabled)}
                    >
                        {isBooking ? "กำลังจอง" : existingBookingWarning ? "ดูคิวที่มีอยู่" : "จองคิว"}
                    </button>
                </div>

                <Modal isOpen={isLateConfirmOpen} onClose={() => setIsLateConfirmOpen(false)}>
                    <ModalContent>
                        <ModalHeader>
                            <span className="flex items-center gap-2" style={{ color: "var(--cg-danger)" }}>
                                <Icon icon="solar:danger-triangle-linear" width={20} height={20} />
                                จองหลังเวลาปิดรับ
                            </span>
                        </ModalHeader>
                        <ModalBody>
                            <p className="text-sm">การจองนี้เกิดขึ้นหลังเวลาที่กำหนด อาจมีเกณฑ์ให้คะแนนต่างจากผู้ที่จองตรงเวลา</p>
                            {latePreviewInfo?.reason && (
                                <div className="cg-note" style={{ background: "var(--cg-danger-soft)" }}>
                                    <p className="m-0">{latePreviewInfo.reason}</p>
                                </div>
                            )}
                            {latePreviewInfo?.cutoffAt && (
                                <p className="text-xs" style={{ color: "var(--cg-text-2)" }}>
                                    ปิดรับเมื่อ {formatCutoffDateTime(latePreviewInfo.cutoffAt)}
                                </p>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" onPress={() => setIsLateConfirmOpen(false)}>ยกเลิก</Button>
                            <Button color="danger" onPress={handleConfirmLateBooking} isLoading={isBooking}>ยืนยันจองต่อ</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            </div>
        );
    }

    // ── step 4: live status ──────────────────────────────────────────
    if (step === "status" && bookingResult) {
        const status = bookingStatus || bookingResult;
        const statusDisplay = getStatusDisplay(status.status);
        const isCompleted = status.status === "completed";
        const isWaiting = status.status === "waiting";
        const isInProgress = status.status === "in_progress";
        const isEnded = status.status === "cancelled" || status.status === "no_show";

        const resetToForm = (keepDesk: boolean) => {
            cleanupPolling();
            currentBookingIdRef.current = null;
            clearBookingState();
            setBookingResult(null);
            setBookingStatus(null);
            setStep("form");
            if (keepDesk) {
                if (loggedInUser) setStudentId(loggedInUser.username ?? "");
                // The API sends desk_number as a JSON number; this state feeds a
                // text input and String.trim() on submit, so it must be a string
                // or the next "จองคิว" press throws and the button looks dead.
                setDeskNumber(status.desk_number == null ? "" : String(status.desk_number));
                setBookingType(status.booking_type === "help" ? "help" : "grading");
                setNote("");
                setShowNote(false);
                setStudentInfo(null);
                setDeskInfo(null);
                setValidationErrors([]);
                setValidationWarnings([]);
                setBookingTypeAvailability(null);
                setLatePreviewInfo(null);
                setIsLateConfirmOpen(false);
            }
        };

        return (
            <div className="cg-task-screen pb-6">
                {deskNoticeModal}
                <TaskHeader title="คิวของฉัน" />

                {/* the number is the whole point of this screen */}
                <div className={isEnded ? "cg-spent" : undefined}>
                    <div className="cg-card flex flex-col items-center text-center">
                        <span className="text-[11.5px] font-normal" style={{ color: "var(--cg-text-3)" }}>
                            {isEnded ? "คิวที่สิ้นสุดแล้ว" : "หมายเลขคิว"}
                        </span>
                        <span className="cg-queue-num mt-1">{status.queue_number}</span>
                        <span
                            className={`cg-badge mt-2.5 ${
                                isCompleted ? "cg-badge-success" : isEnded ? "cg-badge-danger" : isInProgress ? "cg-badge-warning" : "cg-badge-info"
                            }`}
                            style={{ fontSize: 12.5, padding: "5px 13px" }}
                        >
                            <Icon icon={statusDisplay.icon} width={14} height={14} />
                            {statusDisplay.label}
                        </span>
                        {isWaiting && bookingStatus && (
                            <span className="mt-2.5 text-[13px] font-normal" style={{ color: "var(--cg-text-2)" }}>
                                {bookingStatus.position_in_queue === 0
                                    ? "ถัดไปคือคิวของท่าน"
                                    : <>อีก <b className="font-semibold" style={{ color: "var(--cg-text)" }}>{bookingStatus.position_in_queue} คิว</b> จะถึงลำดับของท่าน</>}
                            </span>
                        )}
                    </div>
                </div>

                {status.is_late_booking && (
                    <div className="cg-note" style={{ background: "var(--cg-danger-soft)" }}>
                        <Icon icon="solar:danger-triangle-linear" width={16} height={16} className="mt-0.5 shrink-0" style={{ color: "var(--cg-danger)" }} />
                        <p className="m-0">
                            <b className="font-medium">จองหลังเวลาปิดรับ</b>
                            {status.late_reason ? ` ${status.late_reason}` : ""}
                        </p>
                    </div>
                )}

                {status.status === "no_show" && bookingStatus?.worker_note && (
                    <div className="cg-note">
                        <Icon icon="solar:megaphone-linear" width={16} height={16} className="mt-0.5 shrink-0" style={{ color: "var(--cg-warning)" }} />
                        <p className="m-0"><b className="font-medium">เหตุผลจากผู้ตรวจ:</b> {bookingStatus.worker_note}</p>
                    </div>
                )}

                {/* details */}
                <div className="cg-list">
                    <div className="cg-row">
                        <span className="cg-row-ico" style={{ background: "var(--cg-info-soft)", color: "var(--cg-info)" }}>
                            <Icon icon={status.booking_type === "grading" ? "solar:clipboard-check-linear" : "solar:hand-shake-linear"} width={17} height={17} />
                        </span>
                        <span className="cg-row-body">
                            <span className="cg-row-title">{getQueueBookingTypeLabel(status.booking_type as "grading" | "help", false)}</span>
                            <span className="cg-row-sub truncate">{sessionInfo?.course.code} {sessionInfo?.title}</span>
                        </span>
                    </div>
                    <div className="cg-row">
                        <span className="cg-row-ico">
                            <Icon icon="solar:armchair-linear" width={17} height={17} />
                        </span>
                        <span className="cg-row-body">
                            <span className="cg-row-title">
                                โต๊ะ {status.desk_number}{bookingStatus?.zone ? ` โซน ${bookingStatus.zone.name}` : ""}
                            </span>
                            {bookingStatus?.assignedWorker && bookingStatus.status !== "waiting" && (
                                <span className="cg-row-sub">ผู้ตรวจ {bookingStatus.assignedWorker.full_name}</span>
                            )}
                            {bookingStatus?.status === "waiting" && bookingStatus.assigned_worker_id && (
                                <span className="cg-row-sub" style={{ color: "var(--cg-accent)" }}>ผู้ตรวจกำลังรับงาน กรุณารอสักครู่</span>
                            )}
                        </span>
                    </div>
                </div>

                {/* waiting */}
                {isWaiting && (
                    <>
                        <div className="cg-note" style={{ background: "var(--cg-info-soft)" }}>
                            <Icon icon="solar:info-circle-linear" width={16} height={16} className="mt-0.5 shrink-0" style={{ color: "var(--cg-info)" }} />
                            <p className="m-0">
                                กรุณารออยู่ที่โต๊ะ {status.desk_number}{bookingStatus?.zone ? ` โซน ${bookingStatus.zone.name}` : ""} ระบบจะแจ้งเตือนเมื่อใกล้ถึงลำดับคิว หากไม่พบผู้จอง ผู้ตรวจจะข้ามคิวไปก่อน
                            </p>
                        </div>

                        <IosInstallHint />

                        {notificationSupported && permissionStatus !== "granted" && (
                            <div className="cg-list">
                                <button
                                    type="button"
                                    className="cg-row"
                                    onClick={async () => {
                                        const permissionResult = await requestPermission();
                                        if (permissionResult.granted && bookingResult) {
                                            await registerPushToken("student", bookingResult.id);
                                        }
                                    }}
                                >
                                    <span className="cg-row-ico" style={{ background: "var(--cg-violet-soft)", color: "var(--cg-violet)" }}>
                                        <Icon icon="solar:bell-bing-linear" width={17} height={17} />
                                    </span>
                                    <span className="cg-row-body">
                                        <span className="cg-row-title">รับการแจ้งเตือนเมื่อถึงคิว</span>
                                        <span className="cg-row-sub">แตะเพื่อเปิดการแจ้งเตือน</span>
                                    </span>
                                    <Icon icon="solar:alt-arrow-right-linear" className="cg-chevron" width={15} height={15} />
                                </button>
                            </div>
                        )}
                    </>
                )}

                {isInProgress && (
                    <div className="cg-note">
                        <Icon icon="solar:bell-linear" width={16} height={16} className="mt-0.5 shrink-0" style={{ color: "var(--cg-warning)" }} />
                        <p className="m-0">
                            กำลังตรวจงานของท่าน กรุณารอผู้ตรวจที่โต๊ะ {status.desk_number}{bookingStatus?.zone ? ` โซน ${bookingStatus.zone.name}` : ""}
                        </p>
                    </div>
                )}

                {/* completed: always confirm the request is done, even when there's no
                    score to show — a "help" booking has nothing to grade, so
                    score_details is legitimately absent for it. */}
                {isCompleted && !bookingStatus?.score_details && (
                    <div className="cg-note" style={{ background: "var(--cg-success-soft)" }}>
                        <Icon icon="solar:check-circle-linear" width={16} height={16} className="mt-0.5 shrink-0" style={{ color: "var(--cg-success)" }} />
                        <p className="m-0">
                            {status.booking_type === "help" ? "ผู้ตรวจดำเนินการให้ความช่วยเหลือเรียบร้อยแล้ว" : "ตรวจงานเสร็จสิ้นแล้ว"}
                            {bookingStatus?.assignedWorker ? ` โดย ${bookingStatus.assignedWorker.full_name}` : ""}
                        </p>
                    </div>
                )}

                {/* completed: the score is what the student came back for */}
                {isCompleted && bookingStatus?.score_details && (
                    <section className="flex flex-col gap-2">
                        <p className="cg-section-label">ผลการตรวจ {bookingStatus.score_details.assignment_name}</p>
                        <div className="cg-list">
                            {bookingStatus.score_details.type === "single" && (
                                <div className="cg-row">
                                    <span className="cg-row-body"><span className="cg-row-title">คะแนน</span></span>
                                    <span className="cg-mono text-lg font-semibold" style={{ color: "var(--cg-success)" }}>
                                        {bookingStatus.score_details.score} / {bookingStatus.score_details.max_score}
                                    </span>
                                </div>
                            )}
                            {bookingStatus.score_details.type === "sub_items" && bookingStatus.score_details.sub_items && (
                                <>
                                    {bookingStatus.score_details.sub_items.map((item, idx) => (
                                        <div key={item.id} className="cg-row">
                                            <span className="cg-row-body">
                                                <span className="cg-row-title">{idx + 1}. {item.name}</span>
                                            </span>
                                            <span className="cg-mono text-[13px] font-medium" style={{ color: "var(--cg-success)" }}>
                                                {item.score} / {item.max_score}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="cg-row">
                                        <span className="cg-row-body"><span className="cg-row-title">รวม</span></span>
                                        <span className="cg-mono text-lg font-semibold" style={{ color: "var(--cg-success)" }}>
                                            {bookingStatus.score_details.total_score} / {bookingStatus.score_details.total_max_score}
                                        </span>
                                    </div>
                                </>
                            )}
                            {bookingStatus.score_details.comment && (
                                <div className="cg-row">
                                    <span className="cg-row-body">
                                        <span className="cg-row-sub" style={{ marginTop: 0 }}>หมายเหตุจากผู้ตรวจ</span>
                                        <span className="cg-row-title" style={{ fontWeight: 400 }}>{bookingStatus.score_details.comment}</span>
                                    </span>
                                </div>
                            )}
                            <div className="cg-row">
                                <span className="cg-row-body">
                                    <span className="cg-row-sub" style={{ marginTop: 0 }}>
                                        ตรวจโดย {bookingStatus.score_details.graded_by || bookingStatus.assignedWorker?.full_name || "-"}
                                        {bookingStatus.completed_at
                                            ? ` เมื่อ ${new Date(bookingStatus.completed_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`
                                            : ""}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </section>
                )}

                {/* On the shared desk-scan flow (fromScan) this screen can be seen on a
                    classroom terminal other students also use — show whose result this
                    is so a student can catch a mismatch before trusting it.

                    Masked on purpose. The whole reason this line exists is that
                    someone else is looking at the screen, so printing a full
                    student id and full name here would hand the next person in
                    the queue exactly the identifiers they should not have. The
                    owner recognises their own last four digits and given name
                    instantly; a stranger learns nothing useful. */}
                {isCompleted && bookingStatus?.student && (
                    <p className="text-center text-[11px] font-light" style={{ color: "var(--cg-text-3)" }}>
                        <Icon icon="solar:user-id-linear" width={12} height={12} className="mr-1 inline" />
                        {maskStudentIdentity(bookingStatus.student.student_id, bookingStatus.student.full_name)}
                    </p>
                )}

                {!isCompleted && !isEnded && (
                    <p className="text-center text-[11px] font-light" style={{ color: "var(--cg-text-3)" }}>
                        หน้านี้จะอัปเดตอัตโนมัติ
                    </p>
                )}

                <div className="cg-task-cta">
                    {isWaiting && (
                        <button type="button" className="cg-btn-danger" onClick={handleCancelBooking} disabled={isCancelling}>
                            {isCancelling ? "กำลังยกเลิก" : "ยกเลิกการจอง"}
                        </button>
                    )}
                    {(isCompleted || isEnded) && (
                        <button type="button" className="cg-btn" onClick={() => resetToForm(isCompleted)}>
                            จองคิวใหม่
                        </button>
                    )}
                    <Link href="/student" className="cg-btn-ghost text-center">กลับหน้าหลัก</Link>
                </div>
            </div>
        );
    }

    return null;
}

export default function BookQueuePage() {
    return (
        <Suspense fallback={
            <div data-theme-scope="student" className="cg-scope app-mobile-screen flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px]" style={{ borderColor: 'var(--cg-accent)', borderTopColor: 'transparent' }} />
            </div>
        }>
            <BookQueueContent />
        </Suspense>
    );
}
