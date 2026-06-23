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
import { useNotification } from "@/contexts/NotificationContext";
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
    desk_number: string;
    status: string;
    is_late_booking?: boolean;
    late_reason?: string;
}

interface BookingStatus {
    id: number;
    queue_number: number;
    booking_type: string;
    desk_number: string;
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

function BookQueueContent() {
    const searchParams = useSearchParams();
    const initialPin = searchParams.get("pin") || "";
    const initialDesk = searchParams.get("desk") || "";
    const initialType = (searchParams.get("type") === "help" ? "help" : "grading") as "grading" | "help";
    const fromScan = !!(searchParams.get("desk") && searchParams.get("type"));

    // Step states
    const [step, setStep] = useState<"pin" | "form" | "status">("pin");
    const [isInitializing, setIsInitializing] = useState(true);

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

    // Notification (FCM)
    const { 
        isSupported: notificationSupported, 
        permissionStatus, 
        requestPermission, 
        registerFcmToken,
        fcmToken,
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
                        headers: { "Content-Type": "application/json" },
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
                            headers: { "Content-Type": "application/json" },
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
    }, []);

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
                headers: { "Content-Type": "application/json" },
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
    }, [pinCode, studentId, deskNumber, bookingType]);

    const validateBookingForSubmit = useCallback(async (): Promise<BookingValidationResult | null> => {
        const response = await fetch(`${API_BASE_URL}/queue/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
    }, [pinCode, studentId, deskNumber, bookingType]);

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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin_code: pinCode }),
            });

            const result = await response.json();

            if (result.success) {
                setSessionInfo(result.data);
                setStep("form");
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pin_code: pinCode,
                student_id: studentId,
                desk_number: deskNumber,
                booking_type: bookingType,
                note: note || undefined,
            }),
        });

        return response.json();
    }, [pinCode, studentId, deskNumber, bookingType, note]);

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

        // Check for validation errors
        if (validationErrors.length > 0) {
            addToast({
                title: "ไม่สามารถจองได้",
                description: validationErrors[0].message,
                color: "danger",
            });
            return;
        }

        // Check for warnings with existing booking
        const existingBookingWarning = validationWarnings.find(w => w.existing_booking);
        if (existingBookingWarning && existingBookingWarning.existing_booking) {
            // If there's an existing booking, restore it instead
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

                if (validation.is_late_booking_preview) {
                    setLatePreviewInfo({
                        cutoffAt: validation.cutoff_at,
                        reason: validation.late_reason_preview || validation.cutoff_note,
                    });
                    setIsLateConfirmOpen(true);
                    return;
                }
            }

            const result = await createBookingRequest();

            if (result.success) {
                setBookingResult(result.data);
                setStep("status");
                // Save to localStorage
                saveBookingState(pinCode, studentId, result.data.id);
                
                // Request notification permission and register for push notifications
                if (notificationSupported && permissionStatus !== "granted") {
                    const granted = await requestPermission();
                    if (granted) {
                        await registerFcmToken("student", result.data.id);
                    }
                } else if (fcmToken) {
                    await registerFcmToken("student", result.data.id);
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
                    const granted = await requestPermission();
                    if (granted) {
                        await registerFcmToken("student", result.data.id);
                    }
                } else if (fcmToken) {
                    await registerFcmToken("student", result.data.id);
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
                headers: { "Content-Type": "application/json" },
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
            classNames={{ backdrop: "bg-black/60" }}
        >
            <ModalContent>
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
                <ModalFooter className="justify-center pb-6">
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
    if (step === "pin") {
        return (
            <div data-theme-scope="adaptive queue" className="min-h-screen bg-slate-50 px-4 pb-10 pt-6 flex flex-col">
                {deskNoticeModal}
                <div className="mx-auto w-full max-w-md space-y-4">
                    {/* Hero card */}
                    <div className="relative overflow-hidden rounded-4xl bg-linear-to-br from-sky-700 via-sky-600 to-cyan-500 p-5 shadow-xl shadow-sky-300/40">
                        <span className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
                        <span className="pointer-events-none absolute -bottom-8 -left-6 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl" />
                        <div className="relative flex items-center gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/30 backdrop-blur-sm">
                                <Icon icon="solar:ticket-bold-duotone" className="text-xl text-white" />
                            </span>
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-200/80">จองคิวตรวจงาน</p>
                                <h1 className="text-lg font-bold text-white leading-snug">กรอก PIN เพื่อเริ่มต้น</h1>
                            </div>
                        </div>
                    </div>

                    {/* PIN input card */}
                    <div className="rounded-4xl border border-slate-100 bg-white/90 p-6 shadow-sm text-center">
                        <div className="mb-3 mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-50 border border-sky-100">
                            <Icon icon="solar:key-bold-duotone" className="text-3xl text-sky-500" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-800 mb-1">กรอกรหัส PIN</h2>
                        <p className="text-sm text-slate-400 mb-6">กรอกรหัส PIN 6 หลักที่ได้รับจาก TA</p>
                        <div className="flex justify-center mb-6">
                            <InputOtp
                                length={6}
                                value={pinCode}
                                onValueChange={setPinCode}
                                size="lg"
                                variant="bordered"
                                color="primary"
                                onComplete={handleVerifyPIN}
                                classNames={{
                                    segment: "w-11 h-14 text-xl font-bold",
                                    segmentWrapper: "gap-1.5",
                                }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleVerifyPIN}
                            disabled={pinCode.length !== 6 || isVerifying}
                            className="w-full rounded-full bg-linear-to-r from-sky-600 to-cyan-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-300/40 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isVerifying ? "กำลังตรวจสอบ..." : "ยืนยัน PIN"}
                        </button>
                        <p className="mt-4 text-xs text-slate-400">PIN ได้รับจาก TA หรืออาจารย์ในห้องเรียน</p>
                    </div>
                </div>
            </div>
        );
    }

    // Render form step
    if (step === "form" && sessionInfo) {
        const studentError = validationErrors.find(e => e.field === "student_id");
        const deskError = validationErrors.find(e => e.field === "desk_number");
        const existingBookingWarning = validationWarnings.find(w => w.existing_booking);
        const gradingDisabled = bookingTypeAvailability?.grading?.allowed === false;
        const gradingDisabledReason = bookingTypeAvailability?.grading?.reason;

        // When from QR scan + logged in: show auto-booking loader instead of full form
        if (fromScan && loggedInUser && isBooking) {
            return (
                <div data-theme-scope="adaptive queue" className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                    {deskNoticeModal}
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="h-16 w-16 flex items-center justify-center rounded-3xl bg-linear-to-br from-sky-600 to-cyan-500 shadow-xl shadow-sky-300/40">
                            <Icon icon="solar:ticket-bold-duotone" className="text-3xl text-white" />
                        </div>
                        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-sky-400 border-t-transparent" />
                        <div>
                            <p className="text-sm font-semibold text-slate-700">กำลังจองคิว...</p>
                            <p className="text-xs text-slate-400 mt-1">{sessionInfo.title} · โต๊ะ {deskNumber}</p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div data-theme-scope="adaptive queue" className="min-h-screen bg-slate-50 px-4 pb-10 pt-6 flex flex-col">
                {deskNoticeModal}
                <div className="mx-auto w-full max-w-md space-y-4">

                    {/* Hero card */}
                    <div className="relative overflow-hidden rounded-4xl bg-linear-to-br from-sky-700 via-sky-600 to-cyan-500 p-5 shadow-xl shadow-sky-300/40">
                        <span className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
                        <span className="pointer-events-none absolute -bottom-8 -left-6 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl" />
                        <div className="relative flex items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/30 backdrop-blur-sm">
                                <Icon icon="solar:ticket-bold-duotone" className="text-xl text-white" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-200/80">จองคิวตรวจงาน</p>
                                <h1 className="truncate text-lg font-bold text-white leading-snug">{sessionInfo.title}</h1>
                                <p className="text-xs text-sky-100/70 mt-0.5">
                                    {sessionInfo.course.code} · {sessionInfo.course.name}
                                </p>
                                <p className="text-xs text-sky-100/50 mt-0.5">
                                    ห้อง {sessionInfo.classroom.name} · {sessionInfo.classroom.building}
                                </p>
                                {sessionInfo.is_cutoff_enabled && sessionInfo.cutoff_at && (
                                    <div className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-semibold text-amber-200">
                                        <Icon icon="solar:clock-circle-bold" className="shrink-0 text-sm" />
                                        cutoff: {new Date(sessionInfo.cutoff_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Form card */}
                    <div className="rounded-4xl border border-slate-100 bg-white/90 p-6 shadow-sm space-y-5">

                        {/* Student identity — show pill if logged in, show input if not */}
                        {loggedInUser ? (
                            <div className="flex items-center gap-3 rounded-3xl bg-sky-50 border border-sky-100 px-4 py-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-100 border border-sky-200">
                                    <Icon icon="solar:user-id-bold" className="text-lg text-sky-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-semibold text-sky-500">เข้าสู่ระบบแล้ว</p>
                                    <p className="text-sm font-semibold text-slate-800 truncate">{loggedInUser.full_name}</p>
                                    <p className="text-xs text-slate-500">{loggedInUser.username}</p>
                                </div>
                                <Icon icon="solar:check-circle-bold" className="shrink-0 text-xl text-sky-500" />
                            </div>
                        ) : (
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                    รหัสนักศึกษา (แบบมีขีด) <span className="text-rose-500">*</span>
                                </label>
                                <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition ${
                                    studentError
                                        ? "border-rose-300 bg-rose-50"
                                        : studentInfo
                                        ? "border-emerald-300 bg-emerald-50"
                                        : "border-slate-200 bg-slate-50 focus-within:border-sky-400 focus-within:bg-white"
                                }`}>
                                    <Icon icon="solar:user-id-bold" className="shrink-0 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="เช่น 65010000-0"
                                        value={studentId}
                                        onChange={(e) => {
                                            setStudentId(e.target.value);
                                            setStudentInfo(null);
                                            setValidationErrors(prev => prev.filter(err => err.field !== "student_id"));
                                        }}
                                        className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                                    />
                                    {isValidating && <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />}
                                    {!isValidating && studentError && <Icon icon="solar:close-circle-bold" className="shrink-0 text-rose-500" />}
                                    {!isValidating && studentInfo && <Icon icon="solar:check-circle-bold" className="shrink-0 text-emerald-500" />}
                                </div>
                                {studentError && <p className="mt-1 text-xs text-rose-600">{studentError.message}</p>}
                                {studentInfo && !studentError && (
                                    <p className="mt-1.5 text-xs font-medium text-emerald-600">
                                        <Icon icon="solar:user-check-bold" className="inline mr-1" />
                                        {studentInfo.full_name}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Desk Number */}
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                เลขโต๊ะ <span className="text-rose-500">*</span>
                            </label>
                            {fromScan ? (
                                <div className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-2.5">
                                    <Icon icon="solar:chair-bold" className="shrink-0 text-emerald-500" />
                                    <span className="flex-1 text-sm font-semibold text-slate-800">{deskNumber}</span>
                                    <Icon icon="solar:check-circle-bold" className="shrink-0 text-emerald-500" />
                                </div>
                            ) : (
                                <>
                                    <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition ${
                                        deskError
                                            ? "border-rose-300 bg-rose-50"
                                            : deskInfo
                                            ? "border-emerald-300 bg-emerald-50"
                                            : "border-slate-200 bg-slate-50 focus-within:border-sky-400 focus-within:bg-white"
                                    }`}>
                                        <Icon icon="solar:chair-bold" className="shrink-0 text-slate-400" />
                                        <input
                                            type="number"
                                            placeholder="เช่น 1, 2, 3..."
                                            value={deskNumber}
                                            onChange={(e) => {
                                                setDeskNumber(e.target.value);
                                                setDeskInfo(null);
                                                setValidationErrors(prev => prev.filter(err => err.field !== "desk_number"));
                                            }}
                                            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        {isValidating && <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />}
                                        {!isValidating && deskError && <Icon icon="solar:close-circle-bold" className="shrink-0 text-rose-500" />}
                                        {!isValidating && deskInfo && <Icon icon="solar:check-circle-bold" className="shrink-0 text-emerald-500" />}
                                    </div>
                                    {deskError && <p className="mt-1 text-xs text-rose-600">{deskError.message}</p>}
                                    {deskInfo && !deskError && (
                                        <p className="mt-1.5 text-xs font-medium text-emerald-600">
                                            <Icon icon="solar:check-circle-bold" className="inline mr-1" />
                                            โต๊ะหมายเลข {deskInfo.number} พร้อมใช้งาน
                                        </p>
                                    )}
                                    <p className="mt-1.5 text-xs text-slate-400">ดูเลขโต๊ะจากแผนผังบนหน้าจอโปรเจกเตอร์เท่านั้น</p>
                                </>
                            )}
                        </div>

                        {/* Existing booking warning */}
                        {existingBookingWarning && (
                            <div className="flex items-start gap-2.5 rounded-3xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                                <Icon icon="solar:info-circle-bold" className="mt-0.5 shrink-0 text-lg" />
                                <div>
                                    <p className="font-medium">{existingBookingWarning.message}</p>
                                    <p className="mt-0.5 text-xs text-sky-500">กดปุ่ม "ดูคิวที่มีอยู่" เพื่อดูสถานะ</p>
                                </div>
                            </div>
                        )}

                        {/* Booking type */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">ประเภทการจอง</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!gradingDisabled) setBookingType("grading");
                                    }}
                                    disabled={gradingDisabled}
                                    className={`rounded-3xl border-2 p-4 transition active:scale-[0.98] ${
                                        gradingDisabled
                                            ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
                                            : bookingType === "grading"
                                            ? "border-emerald-400 bg-emerald-50"
                                            : "border-slate-100 bg-slate-50 hover:border-slate-200"
                                    }`}
                                >
                                    <Icon
                                        icon="solar:clipboard-check-bold-duotone"
                                        className={`mx-auto mb-2 text-3xl ${bookingType === "grading" ? "text-emerald-500" : "text-slate-300"}`}
                                    />
                                    <p className={`text-sm font-semibold ${bookingType === "grading" ? "text-emerald-700" : "text-slate-500"}`}>
                                        ตรวจงาน
                                    </p>
                                </button>
                                {gradingDisabledReason && (
                                    <p className="col-span-2 -mt-1 text-xs text-slate-500">
                                        {gradingDisabledReason}
                                    </p>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setBookingType("help")}
                                    className={`rounded-3xl border-2 p-4 transition active:scale-[0.98] ${
                                        bookingType === "help"
                                            ? "border-amber-400 bg-amber-50"
                                            : "border-slate-100 bg-slate-50 hover:border-slate-200"
                                    }`}
                                >
                                    <Icon
                                        icon="solar:hand-shake-bold-duotone"
                                        className={`mx-auto mb-2 text-3xl ${bookingType === "help" ? "text-amber-500" : "text-slate-300"}`}
                                    />
                                    <p className={`text-sm font-semibold ${bookingType === "help" ? "text-amber-700" : "text-slate-500"}`}>
                                        ขอความช่วยเหลือ
                                    </p>
                                </button>
                            </div>
                        </div>

                        {/* Optional note */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowNote(v => !v)}
                                className="flex items-center gap-1.5 text-sm font-medium text-sky-600 transition hover:text-sky-700"
                            >
                                <Icon icon={showNote ? "solar:minus-circle-bold" : "solar:add-circle-bold"} className="text-base" />
                                {showNote ? "ซ่อนหมายเหตุ" : "เพิ่มหมายเหตุ (ไม่บังคับ)"}
                            </button>
                            {showNote && (
                                <textarea
                                    placeholder="เช่น ต้องการให้ตรวจส่วนที่ 2..."
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    rows={2}
                                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-sky-400 focus:bg-white"
                                />
                            )}
                        </div>

                        {sessionInfo.require_attendance && (
                            <div className="flex items-center gap-2 rounded-3xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                <Icon icon="solar:info-circle-bold" className="shrink-0 text-lg" />
                                <span>ต้องเช็คชื่อก่อนจึงจะจองคิวได้</span>
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-3 pt-1">
                            <button
                                type="button"
                                onClick={() => setStep("pin")}
                                className="flex-1 rounded-full border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition active:scale-[0.98] hover:bg-slate-50"
                            >
                                กลับ
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateBooking}
                                disabled={isBooking || !studentId || !deskNumber || validationErrors.length > 0 || (bookingType === "grading" && gradingDisabled)}
                                className="flex-1 rounded-full bg-linear-to-r from-sky-600 to-cyan-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-300/40 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isBooking ? "กำลังจอง..." : existingBookingWarning ? "ดูคิวที่มีอยู่" : "จองคิว"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Late confirm modal */}
                <Modal isOpen={isLateConfirmOpen} onClose={() => setIsLateConfirmOpen(false)}>
                    <ModalContent>
                        <ModalHeader>
                            <div className="flex items-center gap-2 text-rose-700">
                                <Icon icon="solar:danger-triangle-bold" className="text-xl" />
                                <span>จองหลัง Cutoff</span>
                            </div>
                        </ModalHeader>
                        <ModalBody>
                            <p className="text-sm text-slate-700">
                                การจองนี้เกิดขึ้นหลังเวลาที่กำหนด อาจมีเกณฑ์ให้คะแนนต่างจากผู้ที่จองตรงเวลา
                            </p>
                            {latePreviewInfo?.reason && (
                                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                                    {latePreviewInfo.reason}
                                </div>
                            )}
                            {latePreviewInfo?.cutoffAt && (
                                <p className="text-xs text-slate-500">
                                    cutoff: {formatCutoffDateTime(latePreviewInfo.cutoffAt)}
                                </p>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" onPress={() => setIsLateConfirmOpen(false)}>
                                ยกเลิก
                            </Button>
                            <Button color="danger" onPress={handleConfirmLateBooking} isLoading={isBooking}>
                                ยืนยันจองต่อ
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            </div>
        );
    }

    // Render status step
    if (step === "status" && bookingResult) {
        const status = bookingStatus || bookingResult;
        const statusDisplay = getStatusDisplay(status.status);
        const isCompleted = status.status === "completed";
        const isWaiting = status.status === "waiting";
        const isInProgress = status.status === "in_progress";
        const isEnded = status.status === "cancelled" || status.status === "no_show";

        const heroGradient = isCompleted
            ? "from-emerald-600 to-teal-500 shadow-emerald-300/40"
            : isEnded
            ? "from-rose-500 to-orange-500 shadow-rose-300/40"
            : isInProgress
            ? "from-amber-500 to-orange-500 shadow-amber-300/40"
            : "from-sky-700 via-sky-600 to-cyan-500 shadow-sky-300/40";

        const statusPillClass = isCompleted
            ? "bg-white/20 text-white"
            : isInProgress
            ? "bg-white/20 text-white"
            : "bg-white/20 text-white";

        return (
            <div data-theme-scope="adaptive queue" className="min-h-screen bg-slate-50 px-4 pb-10 pt-6 flex flex-col">
                {deskNoticeModal}
                <div className="mx-auto w-full max-w-md space-y-4">

                    {/* Hero card — queue number */}
                    <div className={`relative overflow-hidden rounded-4xl bg-linear-to-br ${heroGradient} p-6 shadow-xl text-center`}>
                        <span className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
                        <span className="pointer-events-none absolute -bottom-8 -left-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                        <div className="relative">
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70 mb-1">หมายเลขคิว</p>
                            <p className="text-8xl font-bold text-white leading-none mb-3">{status.queue_number}</p>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${statusPillClass} ring-1 ring-white/30`}>
                                <Icon icon={statusDisplay.icon} className="text-base" />
                                {statusDisplay.label}
                            </span>
                        </div>
                    </div>

                    {/* Details card */}
                    <div className="rounded-4xl border border-slate-100 bg-white/90 p-5 shadow-sm">
                        <p className="text-xs text-slate-400 font-medium mb-3">{sessionInfo?.course.code} · {sessionInfo?.title}</p>

                        {status.is_late_booking && (
                            <div className="mb-3 flex items-start gap-2 rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                <Icon icon="solar:danger-triangle-bold" className="mt-0.5 shrink-0 text-lg" />
                                <div>
                                    <p className="font-medium">จองหลัง cutoff</p>
                                    {status.late_reason && <p className="mt-0.5 text-xs text-rose-600">{status.late_reason}</p>}
                                </div>
                            </div>
                        )}

                        <div className="divide-y divide-slate-100">
                            <div className="flex items-center justify-between py-2.5">
                                <span className="text-sm text-slate-500">โต๊ะ</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-800">{status.desk_number}</span>
                                    {bookingStatus?.zone && (
                                        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                                            {bookingStatus.zone.name}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <span className="text-sm text-slate-500">ประเภท</span>
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    status.booking_type === "grading"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-amber-100 text-amber-700"
                                }`}>
                                    {getQueueBookingTypeLabel(status.booking_type as "grading" | "help", false)}
                                </span>
                            </div>
                            {bookingStatus && isWaiting && (
                                <div className="flex items-center justify-between py-2.5">
                                    <span className="text-sm text-slate-500">ตำแหน่งในคิว</span>
                                    <span className="text-sm font-semibold text-sky-600">
                                        {bookingStatus.position_in_queue === 0
                                            ? "ถัดไป!"
                                            : `${bookingStatus.position_in_queue} คนข้างหน้า`}
                                    </span>
                                </div>
                            )}
                            {bookingStatus?.assignedWorker && bookingStatus.status !== "waiting" && (
                                <div className="flex items-center justify-between py-2.5">
                                    <span className="text-sm text-slate-500">ผู้ตรวจ</span>
                                    <span className="text-sm font-semibold text-slate-800">
                                        {bookingStatus.assignedWorker.full_name}
                                    </span>
                                </div>
                            )}
                            {bookingStatus?.status === "waiting" && bookingStatus.assigned_worker_id && (
                                <div className="flex items-center justify-between py-2.5">
                                    <span className="text-sm text-slate-500">ผู้ตรวจ</span>
                                    <span className="text-sm font-semibold text-sky-600">
                                        ผู้ตรวจกำลังรับงาน...รอสักครู่
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Waiting instructions + cancel */}
                    {isWaiting && (
                        <>
                            <div className="flex items-center gap-2 rounded-3xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                                <Icon icon="solar:info-circle-bold" className="shrink-0 text-lg" />
                                <span>กรุณารออยู่ที่โต๊ะ {status.desk_number}{bookingStatus?.zone ? ` (${bookingStatus.zone.name})` : ""} ระบบจะแจ้งเตือนเมื่อถึงคิว</span>
                            </div>
                            {notificationSupported && permissionStatus !== "granted" && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const granted = await requestPermission();
                                        if (granted && bookingResult) {
                                            await registerFcmToken("student", bookingResult.id);
                                        }
                                    }}
                                    className="flex w-full items-center gap-3 rounded-3xl border border-violet-100 bg-violet-50 px-4 py-3 text-left text-sm transition active:scale-[0.98] hover:bg-violet-100"
                                >
                                    <Icon icon="solar:bell-bing-bold" className="shrink-0 text-lg text-violet-500" />
                                    <div className="flex-1">
                                        <p className="font-semibold text-violet-700">รับการแจ้งเตือนเมื่อถึงคิว</p>
                                        <p className="text-xs text-violet-500">แตะเพื่อเปิดการแจ้งเตือน</p>
                                    </div>
                                    <Icon icon="solar:arrow-right-bold" className="shrink-0 text-violet-400" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleCancelBooking}
                                disabled={isCancelling}
                                className="w-full rounded-full border border-rose-200 bg-rose-50 py-3.5 text-sm font-semibold text-rose-600 transition active:scale-[0.98] disabled:opacity-50"
                            >
                                {isCancelling ? "กำลังยกเลิก..." : "ยกเลิกการจอง"}
                            </button>
                        </>
                    )}

                    {/* In-progress notice */}
                    {isInProgress && (
                        <div className="flex items-center gap-2 rounded-3xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            <Icon icon="solar:bell-bold" className="shrink-0 text-lg" />
                            <span>กำลังตรวจงานของคุณ กรุณารอ TA ที่โต๊ะ {status.desk_number}{bookingStatus?.zone ? ` (${bookingStatus.zone.name})` : ""}</span>
                        </div>
                    )}

                    {/* Completed */}
                    {isCompleted && (
                        <>
                            <div className="flex items-center gap-2 rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                <Icon icon="solar:check-circle-bold" className="shrink-0 text-lg" />
                                <span>ตรวจงานเสร็จสิ้น</span>
                            </div>

                            {/* Score Details */}
                            {bookingStatus?.score_details && (
                                <div className="rounded-4xl border border-slate-100 bg-white/90 p-5 shadow-sm space-y-3">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-sky-50 border border-sky-100">
                                            <Icon icon="solar:document-text-bold" className="text-sky-500" />
                                        </div>
                                        <span className="font-semibold text-slate-700 text-sm">
                                            {bookingStatus.score_details.assignment_name}
                                        </span>
                                    </div>

                                    {bookingStatus.score_details.type === "single" && (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-500">คะแนน</span>
                                                <span className="text-xl font-bold text-emerald-600">
                                                    {bookingStatus.score_details.score} / {bookingStatus.score_details.max_score}
                                                </span>
                                            </div>
                                            {bookingStatus.score_details.comment && (
                                                <p className="rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                                                    <span className="text-slate-400">หมายเหตุ: </span>
                                                    {bookingStatus.score_details.comment}
                                                </p>
                                            )}
                                        </>
                                    )}

                                    {bookingStatus.score_details.type === "sub_items" && bookingStatus.score_details.sub_items && (
                                        <>
                                            <div className="space-y-2">
                                                {bookingStatus.score_details.sub_items.map((item, idx) => (
                                                    <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5">
                                                        <span className="text-sm text-slate-600">{idx + 1}. {item.name}</span>
                                                        <span className="text-sm font-semibold text-emerald-600">
                                                            {item.score} / {item.max_score}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                                <span className="text-sm font-medium text-slate-700">รวม</span>
                                                <span className="text-xl font-bold text-emerald-600">
                                                    {bookingStatus.score_details.total_score} / {bookingStatus.score_details.total_max_score}
                                                </span>
                                            </div>
                                        </>
                                    )}

                                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
                                        <span>
                                            ตรวจโดย: {bookingStatus.score_details.graded_by || bookingStatus.assignedWorker?.full_name || "-"}
                                        </span>
                                        {bookingStatus.completed_at && (
                                            <span>
                                                {new Date(bookingStatus.completed_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {bookingStatus?.student && (
                                <p className="text-center text-xs text-slate-400">
                                    <Icon icon="solar:user-id-bold" className="inline mr-1" />
                                    {bookingStatus.student.student_id} · {bookingStatus.student.full_name}
                                </p>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    cleanupPolling();
                                    currentBookingIdRef.current = null;
                                    clearBookingState();
                                    setStep("pin");
                                    setPinCode("");
                                    if (!loggedInUser) setStudentId("");
                                    setDeskNumber("");
                                    setNote("");
                                    setShowNote(false);
                                    setBookingResult(null);
                                    setBookingStatus(null);
                                    setSessionInfo(null);
                                    setStudentInfo(null);
                                    setDeskInfo(null);
                                    setValidationErrors([]);
                                    setValidationWarnings([]);
                                }}
                                className="w-full rounded-full bg-linear-to-r from-sky-600 to-cyan-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-300/40 transition active:scale-[0.98]"
                            >
                                จองคิวใหม่
                            </button>
                            <Link href="/student" className="block py-2 text-center text-sm font-medium text-sky-600 transition hover:text-sky-700">
                                กลับหน้าหลัก
                            </Link>
                        </>
                    )}

                    {isEnded && (
                        <>
                            <div className="flex items-center gap-2 rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                <Icon icon={status.status === "cancelled" ? "solar:close-circle-bold" : "solar:user-cross-bold"} className="shrink-0 text-lg" />
                                <span>
                                    {status.status === "cancelled"
                                        ? "คิวนี้ถูกยกเลิกแล้ว"
                                        : "คิวนี้ถูกผู้ตรวจข้ามแล้ว"}
                                </span>
                            </div>
                            {status.status === "no_show" && bookingStatus?.worker_note && (
                                <div className="rounded-3xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                    <span className="font-semibold">เหตุผลจากผู้ตรวจ: </span>
                                    <span>{bookingStatus.worker_note}</span>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    cleanupPolling();
                                    currentBookingIdRef.current = null;
                                    clearBookingState();
                                    setBookingResult(null);
                                    setBookingStatus(null);
                                    setStep("form");
                                }}
                                className="w-full rounded-full bg-linear-to-r from-sky-600 to-cyan-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-300/40 transition active:scale-[0.98]"
                            >
                                กลับไปจองใหม่
                            </button>
                        </>
                    )}

                    {!isCompleted && (
                        <p className="text-center text-xs text-slate-400">หน้านี้จะอัพเดทอัตโนมัติ</p>
                    )}
                </div>
            </div>
        );
    }

    return null;
}

export default function BookQueuePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-sky-400 border-t-transparent" />
            </div>
        }>
            <BookQueueContent />
        </Suspense>
    );
}
