"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { InputOtp } from "@heroui/input-otp";
import { Avatar } from "@heroui/avatar";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { IoSchool } from "react-icons/io5";
import { io, Socket } from "@/services/realtime-socket";

import { API_BASE_URL } from "@/config/api";
import { useNotification } from "@/contexts/NotificationContext";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
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
}

interface BookingResult {
    id: number;
    queue_number: number;
    session_title: string;
    booking_type: string;
    desk_number: string;
    status: string;
}

interface BookingStatus {
    id: number;
    queue_number: number;
    booking_type: string;
    desk_number: string;
    status: string;
    position_in_queue: number;
    completed_at?: string;
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

    // Step states
    const [step, setStep] = useState<"pin" | "form" | "status">("pin");
    const [isInitializing, setIsInitializing] = useState(true);

    // Desk notice modal
    const [isDeskNoticeOpen, setIsDeskNoticeOpen] = useState(true);
    const [deskNoticeCountdown, setDeskNoticeCountdown] = useState(3);

    // Countdown timer for desk notice modal
    useEffect(() => {
        if (!isDeskNoticeOpen || deskNoticeCountdown <= 0) return;
        const timer = setTimeout(() => {
            setDeskNoticeCountdown((prev) => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [isDeskNoticeOpen, deskNoticeCountdown]);

    // PIN verification
    const [pinCode, setPinCode] = useState(initialPin);
    const [sessionInfo, setSessionInfo] = useState<VerifyPINResponse | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);

    // Booking form
    const [studentId, setStudentId] = useState("");
    const [deskNumber, setDeskNumber] = useState("");
    const [bookingType, setBookingType] = useState<"grading" | "help">("grading");
    const [note, setNote] = useState("");
    const [isBooking, setIsBooking] = useState(false);

    // Validation states
    const [isValidating, setIsValidating] = useState(false);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
    const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
    const [deskInfo, setDeskInfo] = useState<DeskInfo | null>(null);
    const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
            }
        } catch (error) {
            console.error("Error validating:", error);
        } finally {
            setIsValidating(false);
        }
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

            const result = await response.json();

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

    // Fetch booking status
    const fetchBookingStatus = useCallback(async (bookingId: number) => {
        try {
            console.log("Fetching booking status for:", bookingId);
            const response = await fetch(`${API_BASE_URL}/queue/bookings/${bookingId}/status`);
            const result = await response.json();

            console.log("Booking status result:", result);
            if (result.success) {
                setBookingStatus(result.data);
                console.log("BookingStatus set:", result.data);
                console.log("Score details:", result.data.score_details);
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
        const socket = io(SOCKET_URL, {
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            console.log("Socket connected, socketId:", socket.id);
            socket.emit("join-booking", bookingId);
            console.log("Joined booking room:", bookingId);
            // Also join queue session room to receive position updates
            if (sessionId) {
                socket.emit("join-queue", sessionId);
                console.log("Joined queue session room:", sessionId);
            }
        });

        socket.on("your-booking-completed", (data) => {
            console.log("=== RECEIVED your-booking-completed ===", data);
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

        // Listen for queue position updates (when other bookings complete)
        socket.on("queue-position-updated", () => {
            // Re-fetch status to get updated position
            fetchBookingStatus(bookingId);
        });

        socketRef.current = socket;

        // Also poll every 10 seconds as backup
        intervalRef.current = setInterval(() => {
            fetchBookingStatus(bookingId);
        }, 10000);

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
            waiting: { label: "รอคิว", color: "primary", icon: "solar:hourglass-bold" },
            in_progress: { label: "กำลังตรวจ", color: "warning", icon: "solar:clipboard-check-bold" },
            completed: { label: "เสร็จสิ้น", color: "success", icon: "solar:check-circle-bold" },
            cancelled: { label: "ยกเลิก", color: "danger", icon: "solar:close-circle-bold" },
            no_show: { label: "ไม่พบ", color: "default", icon: "solar:user-cross-bold" },
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
                        className="w-full max-w-[200px] bg-gradient-to-r from-blue-400 to-indigo-500"
                        isDisabled={deskNoticeCountdown > 0}
                        onPress={() => setIsDeskNoticeOpen(false)}
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
            <div className="min-h-screen bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
                {deskNoticeModal}
                <Card className="w-full max-w-md shadow-2xl">
                    <CardBody className="p-8">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center text-white text-4xl">
                                <IoSchool />
                            </div>
                            <Spinner size="lg" color="primary" />
                            <p className="text-slate-500">กำลังตรวจสอบสถานะ...</p>
                        </div>
                    </CardBody>
                </Card>
            </div>
        );
    }

    // Render PIN step
    if (step === "pin") {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
                {deskNoticeModal}
                <Card className="w-full max-w-md shadow-2xl">
                    <CardBody className="p-6">
                        {/* Header */}
                        <div className="text-center mb-6 pb-6 border-b border-slate-100">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                <Icon icon="solar:ticket-bold" className="text-3xl text-white" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-800">จองคิวตรวจงาน</h1>
                            <p className="text-slate-500 text-sm mt-1">
                                กรอก PIN Code เพื่อเริ่มจองคิว
                            </p>
                        </div>

                        {/* PIN Input */}
                        <div className="text-center">
                            <Icon icon="solar:key-bold-duotone" className="text-6xl text-blue-500 mx-auto mb-4" />
                            <h2 className="text-lg font-semibold text-slate-800 mb-2">กรอกรหัส PIN</h2>
                            <p className="text-slate-500 text-sm mb-6">กรอกรหัส PIN 6 หลักที่ได้รับจาก TA</p>

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

                            <Button
                                color="primary"
                                size="lg"
                                className="w-full bg-gradient-to-r from-blue-400 to-indigo-500"
                                onPress={handleVerifyPIN}
                                isLoading={isVerifying}
                                isDisabled={pinCode.length !== 6}
                            >
                                ยืนยัน PIN
                            </Button>

                            <p className="text-xs text-slate-400 mt-4">
                                PIN ได้รับจาก TA หรืออาจารย์ในห้องเรียน
                            </p>
                        </div>
                    </CardBody>
                </Card>
            </div>
        );
    }

    // Render form step
    if (step === "form" && sessionInfo) {
        const studentError = validationErrors.find(e => e.field === "student_id");
        const deskError = validationErrors.find(e => e.field === "desk_number");
        const existingBookingWarning = validationWarnings.find(w => w.existing_booking);

        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
                {deskNoticeModal}
                <Card className="w-full max-w-md shadow-2xl">
                    <CardBody className="p-6">
                        {/* Session Info Header */}
                        <div className="text-center mb-6 pb-6 border-b border-slate-100">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                <Icon icon="solar:ticket-bold" className="text-3xl text-white" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-800">{sessionInfo.title}</h1>
                            <p className="text-slate-500 text-sm mt-1">
                                {sessionInfo.course.code} - {sessionInfo.course.name}
                            </p>
                            <p className="text-slate-400 text-xs mt-1">
                                ห้อง {sessionInfo.classroom.name} • {sessionInfo.classroom.building}
                            </p>
                        </div>

                        {/* Form */}
                        <div className="space-y-4">
                            {/* Student ID */}
                            <div>
                                <Input
                                    label="รหัสนักศึกษา (แบบมีขีด)"
                                    placeholder="เช่น 65010000-0"
                                    value={studentId}
                                    onValueChange={(val) => {
                                        setStudentId(val);
                                        setStudentInfo(null);
                                        setValidationErrors(prev => prev.filter(e => e.field !== "student_id"));
                                    }}
                                    labelPlacement="outside"
                                    size="md"
                                    isRequired
                                    variant="bordered"
                                    isInvalid={!!studentError}
                                    errorMessage={studentError?.message}
                                    color={studentError ? "danger" : studentInfo ? "success" : "default"}
                                    startContent={<Icon icon="solar:user-id-bold" className="text-slate-400" />}
                                    endContent={
                                        isValidating ? (
                                            <Spinner size="sm" />
                                        ) : studentError ? (
                                            <Icon icon="solar:close-circle-bold" className="text-red-500" />
                                        ) : studentInfo ? (
                                            <Icon icon="solar:check-circle-bold" className="text-emerald-500" />
                                        ) : null
                                    }
                                    classNames={{
                                        inputWrapper: studentError 
                                            ? "bg-red-50 border-red-300" 
                                            : studentInfo 
                                            ? "bg-emerald-50 border-emerald-300" 
                                            : "bg-slate-50",
                                        label: "text-sm font-medium text-slate-700 mb-1.5 block"
                                    }}
                                />
                                {/* Show student name when validated */}
                                {studentInfo && !studentError && (
                                    <div className="mt-2 p-2 bg-emerald-50 rounded-lg flex items-center gap-2">
                                        <Icon icon="solar:user-check-bold" className="text-emerald-500" />
                                        <span className="text-sm text-emerald-700">{studentInfo.full_name}</span>
                                    </div>
                                )}
                            </div>

                            {/* Desk Number */}
                            <div className="pt-1">
                                <Input
                                    placeholder="เช่น 1, 2, 3..."
                                    label="เลขโต๊ะ"
                                    description="กรุณาดูเลขโต๊ะจากแผนผังที่แสดงบนหน้าจอโปรเจกเตอร์เท่านั้น"
                                    value={deskNumber}
                                    onValueChange={(val) => {
                                        setDeskNumber(val);
                                        setDeskInfo(null);
                                        setValidationErrors(prev => prev.filter(e => e.field !== "desk_number"));
                                    }}
                                    variant="bordered"
                                    isRequired
                                    isInvalid={!!deskError}
                                    errorMessage={deskError?.message}
                                    color={deskError ? "danger" : deskInfo ? "success" : "default"}
                                    labelPlacement="outside"
                                    size="md"
                                    type="number"
                                    startContent={<Icon icon="solar:chair-bold" className="text-slate-400" />}
                                    endContent={
                                        isValidating ? (
                                            <Spinner size="sm" />
                                        ) : deskError ? (
                                            <Icon icon="solar:close-circle-bold" className="text-red-500" />
                                        ) : deskInfo ? (
                                            <Icon icon="solar:check-circle-bold" className="text-emerald-500" />
                                        ) : null
                                    }
                                    classNames={{
                                        inputWrapper: deskError 
                                            ? "bg-red-50 border-red-300" 
                                            : deskInfo 
                                            ? "bg-emerald-50 border-emerald-300" 
                                            : "bg-slate-50",
                                        label: "text-sm font-medium text-slate-700 mb-1.5 block"
                                    }}
                                />
                                {/* Show desk info when validated */}
                                {deskInfo && !deskError && (
                                    <div className="mt-2 p-2 bg-emerald-50 rounded-lg flex items-center gap-2">
                                        <Icon icon="solar:check-circle-bold" className="text-emerald-500" />
                                        <span className="text-sm text-emerald-700">
                                            โต๊ะหมายเลข {deskInfo.number} พร้อมใช้งาน
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Existing booking warning */}
                            {existingBookingWarning && (
                                <div className="p-3 bg-blue-50 text-blue-700 rounded-xl text-sm">
                                    <div className="flex items-start gap-2">
                                        <Icon icon="solar:info-circle-bold" className="text-lg flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-medium">{existingBookingWarning.message}</p>
                                            <p className="text-xs mt-1 text-blue-600">
                                                กดปุ่ม "จองคิว" เพื่อดูสถานะคิวที่มีอยู่
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Booking Type */}
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">
                                    ประเภทการจอง
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setBookingType("grading")}
                                        className={`p-3 rounded-xl border-2 transition-all ${
                                            bookingType === "grading"
                                                ? "border-emerald-500 bg-emerald-50"
                                                : "border-slate-200 hover:border-slate-300 bg-slate-50"
                                        }`}
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <Icon 
                                                icon="solar:clipboard-check-bold" 
                                                className={`text-2xl ${
                                                    bookingType === "grading" ? "text-emerald-500" : "text-slate-400"
                                                }`}
                                            />
                                            <span className={`text-sm font-medium ${
                                                bookingType === "grading" ? "text-emerald-700" : "text-slate-600"
                                            }`}>
                                                ตรวจงาน
                                            </span>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBookingType("help")}
                                        className={`p-3 rounded-xl border-2 transition-all ${
                                            bookingType === "help"
                                                ? "border-amber-500 bg-amber-50"
                                                : "border-slate-200 hover:border-slate-300 bg-slate-50"
                                        }`}
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <Icon 
                                                icon="solar:hand-shake-bold" 
                                                className={`text-2xl ${
                                                    bookingType === "help" ? "text-amber-500" : "text-slate-400"
                                                }`}
                                            />
                                            <span className={`text-sm font-medium ${
                                                bookingType === "help" ? "text-amber-700" : "text-slate-600"
                                            }`}>
                                                ขอความช่วยเหลือ
                                            </span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {sessionInfo.require_attendance && (
                                <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-sm flex items-center gap-2">
                                    <Icon icon="solar:info-circle-bold" className="text-lg flex-shrink-0" />
                                    <span>ต้องเช็คชื่อก่อนจึงจะจองคิวได้</span>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="flat"
                                    size="lg"
                                    className="flex-1"
                                    onPress={() => setStep("pin")}
                                >
                                    กลับ
                                </Button>
                                <Button
                                    color="primary"
                                    size="lg"
                                    className="flex-1 bg-gradient-to-r from-blue-400 to-indigo-500"
                                    onPress={handleCreateBooking}
                                    isLoading={isBooking}
                                    isDisabled={!studentId || !deskNumber || validationErrors.length > 0}
                                >
                                    {existingBookingWarning ? "ดูคิวที่มีอยู่" : "จองคิว"}
                                </Button>
                            </div>
                        </div>
                    </CardBody>
                </Card>
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

        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
                {deskNoticeModal}
                <Card className="w-full max-w-md shadow-2xl">
                    <CardBody className="p-6">
                        {/* Header */}
                        <div className="text-center mb-6 pb-6 border-b border-slate-100">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                <Icon icon="solar:ticket-bold" className="text-3xl text-white" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-800">สถานะการจอง</h1>
                            <p className="text-slate-500 text-sm mt-1">
                                {sessionInfo?.course.code} - {sessionInfo?.title}
                            </p>
                        </div>

                        {/* Status Content */}
                        <div className="text-center">
                            {/* Status Icon */}
                            <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                                isCompleted 
                                    ? "bg-emerald-100" 
                                    : isInProgress
                                    ? "bg-amber-100"
                                    : "bg-blue-100"
                            }`}>
                                {isWaiting ? (
                                    <Spinner size="lg" color="primary" />
                                ) : (
                                    <Icon 
                                        icon={statusDisplay.icon} 
                                        className={`text-4xl ${
                                            isCompleted 
                                                ? "text-emerald-600" 
                                                : isInProgress
                                                ? "text-amber-600"
                                                : "text-blue-600"
                                        }`}
                                    />
                                )}
                            </div>

                            {/* Queue Number */}
                            <p className="text-sm text-slate-400 mb-1">หมายเลขคิว</p>
                            <p className="text-5xl font-bold text-slate-800 mb-3">
                                {status.queue_number}
                            </p>

                            {/* Status Chip */}
                            <Chip 
                                size="lg" 
                                color={statusDisplay.color} 
                                variant="flat"
                                className="mb-6"
                            >
                                {statusDisplay.label}
                            </Chip>

                            {/* Details */}
                            <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-left">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">โต๊ะ</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800">{status.desk_number}</span>
                                        {bookingStatus?.zone && (
                                            <Chip size="sm" variant="flat" color="secondary">
                                                {bookingStatus.zone.name}
                                            </Chip>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">ประเภท</span>
                                    <Chip 
                                        size="sm" 
                                        color={status.booking_type === "grading" ? "success" : "warning"}
                                        variant="flat"
                                    >
                                        {status.booking_type === "grading" ? "ตรวจงาน" : "ช่วยเหลือ"}
                                    </Chip>
                                </div>
                                {bookingStatus && isWaiting && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">ตำแหน่งในคิว</span>
                                        <span className="font-semibold text-blue-600">
                                            {bookingStatus.position_in_queue === 0 
                                                ? "ถัดไป!" 
                                                : `${bookingStatus.position_in_queue} คน ข้างหน้า`
                                            }
                                        </span>
                                    </div>
                                )}
                                {bookingStatus?.assignedWorker && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">ผู้ตรวจ</span>
                                        <span className="font-semibold text-slate-800">
                                            {bookingStatus.assignedWorker.full_name}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Instructions */}
                            {isWaiting && (
                                <>
                                    <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-xl text-sm">
                                        <Icon icon="solar:info-circle-bold" className="inline mr-1" />
                                        กรุณารออยู่ที่โต๊ะ {status.desk_number}{bookingStatus?.zone ? ` (${bookingStatus.zone.name})` : ""} ระบบจะแจ้งเตือนเมื่อถึงคิว
                                    </div>
                                    
                                    {/* Cancel Booking Button */}
                                    <Button
                                        color="danger"
                                        variant="flat"
                                        className="mt-4 w-full"
                                        onPress={handleCancelBooking}
                                        isLoading={isCancelling}
                                        startContent={!isCancelling && <Icon icon="solar:close-circle-bold" className="text-lg" />}
                                    >
                                        {isCancelling ? "กำลังยกเลิก..." : "ยกเลิกการจอง"}
                                    </Button>
                                </>
                            )}

                            {isInProgress && (
                                <div className="mt-4 p-3 bg-amber-50 text-amber-700 rounded-xl text-sm">
                                    <Icon icon="solar:bell-bold" className="inline mr-1" />
                                    กำลังตรวจงานของคุณ กรุณารอ TA ที่โต๊ะ {status.desk_number}{bookingStatus?.zone ? ` (${bookingStatus.zone.name})` : ""}
                                </div>
                            )}

                            {isCompleted && (
                                <div className="mt-6 space-y-4">
                                    {/* Success message */}
                                    <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm">
                                        <Icon icon="solar:check-circle-bold" className="inline mr-1" />
                                        ตรวจงานเสร็จสิ้น
                                    </div>

                                    {/* Score Details */}
                                    {bookingStatus?.score_details && (
                                        <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3">
                                            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                                <Icon icon="solar:document-text-bold" className="text-blue-500" />
                                                <span className="font-semibold text-slate-700">
                                                    {bookingStatus.score_details.assignment_name}
                                                </span>
                                            </div>

                                            {/* Single Score */}
                                            {bookingStatus.score_details.type === 'single' && (
                                                <>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500">คะแนน</span>
                                                        <span className="font-bold text-lg text-emerald-600">
                                                            {bookingStatus.score_details.score} / {bookingStatus.score_details.max_score}
                                                        </span>
                                                    </div>
                                                    {bookingStatus.score_details.comment && (
                                                        <div className="text-sm text-slate-600 bg-white p-2 rounded-lg">
                                                            <span className="text-slate-400">หมายเหตุ: </span>
                                                            {bookingStatus.score_details.comment}
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Sub-item Scores */}
                                            {bookingStatus.score_details.type === 'sub_items' && bookingStatus.score_details.sub_items && (
                                                <>
                                                    <div className="space-y-2">
                                                        {bookingStatus.score_details.sub_items.map((item, idx) => (
                                                            <div key={item.id} className="flex justify-between items-center bg-white p-2 rounded-lg">
                                                                <span className="text-slate-600 text-sm">
                                                                    {idx + 1}. {item.name}
                                                                </span>
                                                                <span className="font-semibold text-emerald-600">
                                                                    {item.score} / {item.max_score}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                                        <span className="font-medium text-slate-700">รวม</span>
                                                        <span className="font-bold text-lg text-emerald-600">
                                                            {bookingStatus.score_details.total_score} / {bookingStatus.score_details.total_max_score}
                                                        </span>
                                                    </div>
                                                </>
                                            )}

                                            {/* Grader info */}
                                            <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-200">
                                                <span>
                                                    <Icon icon="solar:user-bold" className="inline mr-1" />
                                                    ตรวจโดย: {bookingStatus.score_details.graded_by || bookingStatus.assignedWorker?.full_name || '-'}
                                                </span>
                                                {bookingStatus.completed_at && (
                                                    <span>
                                                        <Icon icon="solar:clock-circle-bold" className="inline mr-1" />
                                                        {new Date(bookingStatus.completed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Student info summary */}
                                    {bookingStatus?.student && (
                                        <div className="flex items-center gap-2 text-sm text-slate-500 justify-center">
                                            <Icon icon="solar:user-id-bold" className="text-slate-400" />
                                            <span>{bookingStatus.student.student_id} - {bookingStatus.student.full_name}</span>
                                        </div>
                                    )}

                                    <Button
                                        color="primary"
                                        size="lg"
                                        className="w-full bg-gradient-to-r from-blue-400 to-indigo-500"
                                        onPress={() => {
                                            // Cleanup polling/socket before resetting
                                            cleanupPolling();
                                            currentBookingIdRef.current = null;
                                            // Clear localStorage
                                            clearBookingState();
                                            
                                            setStep("pin");
                                            setPinCode("");
                                            setStudentId("");
                                            setDeskNumber("");
                                            setNote("");
                                            setBookingResult(null);
                                            setBookingStatus(null);
                                            setSessionInfo(null);
                                            setStudentInfo(null);
                                            setDeskInfo(null);
                                            setValidationErrors([]);
                                            setValidationWarnings([]);
                                        }}
                                    >
                                        จองคิวใหม่
                                    </Button>
                                </div>
                            )}

                            {!isCompleted && (
                                <p className="text-xs text-slate-400 mt-4">
                                    หน้านี้จะอัพเดทอัตโนมัติ
                                </p>
                            )}
                        </div>
                    </CardBody>
                </Card>
            </div>
        );
    }

    return null;
}

export default function BookQueuePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Spinner size="lg" color="primary" />
            </div>
        }>
            <BookQueueContent />
        </Suspense>
    );
}
