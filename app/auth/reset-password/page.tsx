"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody } from "@heroui/card";
import { Link } from "@heroui/link";
import { Spinner } from "@heroui/spinner";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { authService } from "@/services";

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [isValidating, setIsValidating] = useState(true);
    const [isValidToken, setIsValidToken] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);

    // Password validation helpers - memoized
    const passwordValidation = useMemo(() => ({
        minLength: newPassword.length >= 8,
        hasLowercase: /[a-z]/.test(newPassword),
        hasUppercase: /[A-Z]/.test(newPassword),
        hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
    }), [newPassword]);
    
    const isPasswordValid = useMemo(() => 
        passwordValidation.minLength && 
        passwordValidation.hasLowercase && 
        passwordValidation.hasUppercase && 
        passwordValidation.hasSpecialChar
    , [passwordValidation]);

    // Validate token on mount
    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setIsValidating(false);
                setIsValidToken(false);
                return;
            }

            try {
                const result = await authService.validateResetToken(token);
                setIsValidToken(result.success && result.valid === true);
            } catch (error) {
                setIsValidToken(false);
            } finally {
                setIsValidating(false);
            }
        };

        validateToken();
    }, [token]);

    const handleResetPassword = async () => {
        if (!isPasswordValid) {
            addToast({
                title: "รหัสผ่านไม่ผ่านเงื่อนไข",
                description: "กรุณาตรวจสอบเงื่อนไขรหัสผ่าน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            addToast({
                title: "รหัสผ่านไม่ตรงกัน",
                description: "กรุณากรอกรหัสผ่านให้ตรงกันทั้ง 2 ช่อง",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsResetting(true);
        try {
            const result = await authService.resetPassword(token!, newPassword);
            if (result.success) {
                setResetSuccess(true);
                addToast({
                    title: "สำเร็จ",
                    description: "รหัสผ่านถูกเปลี่ยนเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                addToast({
                    title: "เกิดข้อผิดพลาด",
                    description: result.error || "ไม่สามารถรีเซ็ตรหัสผ่านได้",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsResetting(false);
        }
    };

    // Loading state
    if (isValidating) {
        return (
            <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 p-3 sm:p-4">
                <div className="flex-1 flex items-center justify-center">
                    <Card className="w-full max-w-md overflow-hidden shadow-2xl border border-blue-100">
                        <CardBody className="p-8 flex flex-col items-center justify-center gap-4">
                            <Spinner size="lg" color="primary" />
                            <p className="text-slate-500">กำลังตรวจสอบลิงก์...</p>
                        </CardBody>
                    </Card>
                </div>
            </div>
        );
    }

    // Invalid or expired token
    if (!isValidToken) {
        return (
            <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 p-3 sm:p-4">
                <div className="flex-1 flex items-center justify-center">
                    <Card className="w-full max-w-md overflow-hidden shadow-2xl border border-red-200">
                        <CardBody className="p-8">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="p-4 bg-red-100 rounded-full">
                                    <Icon icon="solar:close-circle-bold" className="text-4xl text-red-500" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-800 mb-2">
                                        ลิงก์ไม่ถูกต้องหรือหมดอายุ
                                    </h1>
                                    <p className="text-slate-500 mb-6">
                                        ลิงก์รีเซ็ตรหัสผ่านนี้ไม่ถูกต้อง ถูกใช้ไปแล้ว หรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่
                                    </p>
                                </div>
                                <Button
                                    color="primary"
                                    onPress={() => router.push("/login")}
                                    className="w-full font-medium bg-gradient-to-r from-blue-400 to-indigo-500"
                                    startContent={<Icon icon="solar:arrow-left-bold" className="text-lg" />}
                                >
                                    กลับไปหน้าเข้าสู่ระบบ
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                </div>
                <div className="mt-2 pb-2 text-center text-slate-400 text-xs sm:text-sm px-4 font-light">
                    © 2025 ITII Assist classroom. All Rights Reserved.
                </div>
            </div>
        );
    }

    // Success state
    if (resetSuccess) {
        return (
            <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 p-3 sm:p-4">
                <div className="flex-1 flex items-center justify-center">
                    <Card className="w-full max-w-md overflow-hidden shadow-2xl border border-green-200">
                        <CardBody className="p-8">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="p-4 bg-green-100 rounded-full">
                                    <Icon icon="solar:check-circle-bold" className="text-4xl text-green-500" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-800 mb-2">
                                        เปลี่ยนรหัสผ่านสำเร็จ!
                                    </h1>
                                    <p className="text-slate-500 mb-6">
                                        รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่
                                    </p>
                                </div>
                                <Button
                                    color="primary"
                                    onPress={() => router.push("/login")}
                                    className="w-full font-medium bg-gradient-to-r from-blue-400 to-indigo-500"
                                    startContent={<Icon icon="solar:login-3-bold" className="text-lg" />}
                                >
                                    ไปหน้าเข้าสู่ระบบ
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                </div>
                <div className="mt-2 pb-2 text-center text-slate-400 text-xs sm:text-sm px-4 font-light">
                    © 2025 ITII Assist classroom. All Rights Reserved.
                </div>
            </div>
        );
    }

    // Reset password form
    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 p-3 sm:p-4">
            <div className="flex-1 flex items-center justify-center">
                <Card className="w-full max-w-md overflow-hidden shadow-2xl border border-blue-100">
                    <CardBody className="p-6 sm:p-8">
                        {/* Header */}
                        <div className="flex flex-col items-center text-center gap-4 mb-6">
                            <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg shadow-amber-500/30">
                                <Icon icon="solar:key-bold" className="text-3xl text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">
                                    ตั้งรหัสผ่านใหม่
                                </h1>
                                <p className="text-slate-500 mt-1">
                                    กรอกรหัสผ่านใหม่สำหรับบัญชีของคุณ
                                </p>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="space-y-4">
                            {/* New Password */}
                            <Input
                                label="รหัสผ่านใหม่"
                                labelPlacement="outside"
                                placeholder="กรอกรหัสผ่านใหม่"
                                variant="bordered"
                                size="md"
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onValueChange={setNewPassword}
                                startContent={<Icon icon="solar:lock-password-linear" className="text-blue-400 text-xl" />}
                                endContent={
                                    <button
                                        className="focus:outline-none"
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                    >
                                        <Icon
                                            icon={showNewPassword ? "solar:eye-linear" : "solar:eye-closed-linear"}
                                            className="text-blue-400 text-xl hover:text-blue-500 transition-colors"
                                        />
                                    </button>
                                }
                                classNames={{
                                    inputWrapper: "border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            />
                            <div className="pt-1"></div>

                            {/* Confirm Password */}
                            <Input
                                label="ยืนยันรหัสผ่าน"
                                labelPlacement="outside"
                                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                                variant="bordered"
                                size="md"
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onValueChange={setConfirmPassword}
                                startContent={<Icon icon="solar:lock-password-linear" className="text-blue-400 text-xl" />}
                                endContent={
                                    <button
                                        className="focus:outline-none"
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        <Icon
                                            icon={showConfirmPassword ? "solar:eye-linear" : "solar:eye-closed-linear"}
                                            className="text-blue-400 text-xl hover:text-blue-500 transition-colors"
                                        />
                                    </button>
                                }
                                classNames={{
                                    inputWrapper: "border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                                isInvalid={confirmPassword !== "" && newPassword !== confirmPassword}
                                errorMessage={confirmPassword !== "" && newPassword !== confirmPassword ? "รหัสผ่านไม่ตรงกัน" : ""}
                            />

                            {/* Password Requirements */}
                            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                                <p className="text-xs font-medium text-slate-600 mb-2">ข้อกำหนดรหัสผ่าน:</p>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Icon 
                                            icon={passwordValidation.minLength ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                                            className={passwordValidation.minLength ? "text-green-500" : "text-slate-400"} 
                                        />
                                        <span className={`text-xs ${passwordValidation.minLength ? "text-green-600" : "text-slate-500"}`}>
                                            อย่างน้อย 8 ตัวอักษร
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon 
                                            icon={passwordValidation.hasLowercase ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                                            className={passwordValidation.hasLowercase ? "text-green-500" : "text-slate-400"} 
                                        />
                                        <span className={`text-xs ${passwordValidation.hasLowercase ? "text-green-600" : "text-slate-500"}`}>
                                            มีตัวอักษรพิมพ์เล็ก (a-z)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon 
                                            icon={passwordValidation.hasUppercase ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                                            className={passwordValidation.hasUppercase ? "text-green-500" : "text-slate-400"} 
                                        />
                                        <span className={`text-xs ${passwordValidation.hasUppercase ? "text-green-600" : "text-slate-500"}`}>
                                            มีตัวอักษรพิมพ์ใหญ่ (A-Z)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon 
                                            icon={passwordValidation.hasSpecialChar ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                                            className={passwordValidation.hasSpecialChar ? "text-green-500" : "text-slate-400"} 
                                        />
                                        <span className={`text-xs ${passwordValidation.hasSpecialChar ? "text-green-600" : "text-slate-500"}`}>
                                            มีอักขระพิเศษ (!@#$%^&* ฯลฯ)
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <Button
                                color="primary"
                                onPress={handleResetPassword}
                                isLoading={isResetting}
                                isDisabled={!isPasswordValid || newPassword !== confirmPassword}
                                className="w-full font-medium mt-2 bg-gradient-to-r from-blue-400 to-indigo-500"
                                startContent={!isResetting && <Icon icon="solar:key-bold" className="text-lg" />}
                            >
                                ตั้งรหัสผ่านใหม่
                            </Button>

                            {/* Back to login */}
                            <div className="text-center mt-4">
                                <Link href="/login" className="text-blue-400 hover:text-blue-500 text-sm">
                                    ← กลับไปหน้าเข้าสู่ระบบ
                                </Link>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>
            <div className="mt-2 pb-2 text-center text-slate-400 text-xs sm:text-sm px-4 font-light">
                © 2025 ITII Assist classroom. All Rights Reserved.
            </div>
        </div>
    );
}


export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 p-3 sm:p-4">
                <div className="flex-1 flex items-center justify-center">
                    <Card className="w-full max-w-md overflow-hidden shadow-2xl border border-blue-100">
                        <CardBody className="p-8 flex flex-col items-center justify-center gap-4">
                            <Spinner size="lg" color="primary" />
                            <p className="text-slate-500">กำลังโหลด...</p>
                        </CardBody>
                    </Card>
                </div>
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}
