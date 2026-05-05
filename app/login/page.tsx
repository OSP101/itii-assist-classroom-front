"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { IoSchool } from "react-icons/io5";
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { addToast } from "@heroui/toast";
import { authService } from "@/services";

// Dynamic import Turnstile - completely skip SSR
const Turnstile = dynamic(
    () => import('@marsidev/react-turnstile').then(mod => mod.Turnstile),
    { ssr: false }
);

function AppMark({ className = "" }: { className?: string }) {
    return (
        <div
            className={`flex h-8 w-8 items-center justify-center rounded bg-linear-to-br from-blue-400 to-indigo-500 text-xl text-white shadow-sm shadow-blue-200 ${className}`}
            aria-hidden="true"
        >
            <IoSchool />
        </div>
    );
}

function SocialIconGoogle() {
    return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}

function FooterLink({ children, href = "#" }: { children: React.ReactNode; href?: string }) {
    return (
        <Link href={href} className="text-[13px] text-slate-500 hover:text-blue-500">
            {children}
        </Link>
    );
}

export default function LoginPage() {
    const router = useRouter();
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: "",
        password: "",
    });
    const [canSubmit, setCanSubmit] = useState(true);
    const [turnstileKey, setTurnstileKey] = useState<string | null>(null);
    const [turnstileReady, setTurnstileReady] = useState(false);
    const refTurnstile = useRef<TurnstileInstance>(null);

    // Force change password modal state
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [pendingUser, setPendingUser] = useState<{ username: string; role: string } | null>(null);

    // Forgot password modal state
    const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
    const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
    const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);

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

    // Check if user is already logged in
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const result = await authService.getMe();
                if (result.success && result.user) {
                    // User is already logged in, redirect based on role
                    switch (result.user.role) {
                        case 'admin':
                            router.replace('/admin/dashboard');
                            break;
                        case 'instructor':
                        case 'ta':
                            router.replace('/home');
                            break;
                        default:
                            router.replace('/');
                    }
                    return; // Don't set isCheckingAuth to false, we're redirecting
                }
            } catch (error) {
                // Not logged in, stay on login page
            }
            setIsCheckingAuth(false);
        };
        checkAuth();
    }, [router]);

    // Get Turnstile key only on client side to avoid hydration mismatch
    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_CLOUD;
        if (key) {
            setTurnstileKey(key);
        } else {
            // No Turnstile key, allow submit
            setTurnstileReady(true);
        }
    }, []);


    const toggleVisibility = () => setIsVisible(!isVisible);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.username || !formData.password) {
            addToast({
                title: "กรุณากรอกข้อมูล",
                description: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsLoading(true);

        try {
            const result = await authService.login({
                username: formData.username,
                password: formData.password,
            });

            if (result.success) {
                // Check if 2FA is required - redirect to verification page
                if (result.requiresTwoFactor && result.twoFactorData) {
                    // Store 2FA data in sessionStorage and redirect
                    sessionStorage.setItem("twoFactorData", JSON.stringify(result.twoFactorData));
                    router.push("/auth/verify-2fa");
                    setIsLoading(false);
                    return;
                }

                if (result.user) {
                    // Check if user must change password
                    if (result.mustChangePassword) {
                        setPendingUser({ username: result.user.username, role: result.user.role });
                        setIsChangePasswordModalOpen(true);
                        setIsLoading(false);
                        return;
                    }

                    addToast({
                        title: "เข้าสู่ระบบสำเร็จ",
                        description: `ยินดีต้อนรับ ${formData.username}`,
                        color: "success",
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });

                    // Redirect based on role
                    switch (result.user.role) {
                        case 'admin':
                            router.push('/admin/dashboard');
                            break;
                        case 'instructor':
                            router.push('/home');
                            break;
                        case 'ta':
                            router.push('/home');
                            break;
                        default:
                            router.push('/');
                    }
                }
            } else {
                // Handle error - might be string or object
                let errorMessage = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
                if (typeof result.error === 'string') {
                    errorMessage = result.error;
                } else if (result.error && typeof result.error === 'object') {
                    errorMessage = (result.error as { message?: string }).message || errorMessage;
                }

                addToast({
                    title: "เข้าสู่ระบบไม่สำเร็จ",
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                refTurnstile.current?.reset();
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            refTurnstile.current?.reset();
        } finally {
            setIsLoading(false);
        }
    };

    const handleForceChangePassword = async () => {
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

        setIsChangingPassword(true);
        try {
            const result = await authService.forceChangePassword(newPassword);
            if (result.success) {
                addToast({
                    title: "เปลี่ยนรหัสผ่านสำเร็จ",
                    description: "กรุณาเข้าสู่ระบบอีกครั้งด้วยรหัสผ่านใหม่",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsChangePasswordModalOpen(false);
                setNewPassword("");
                setConfirmPassword("");
                setPendingUser(null);
                setFormData({ username: formData.username, password: "" });
            } else {
                addToast({
                    title: "เกิดข้อผิดพลาด",
                    description: result.error || "ไม่สามารถเปลี่ยนรหัสผ่านได้",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถเปลี่ยนรหัสผ่านได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleGoogleLogin = () => {
        // Redirect to Google OAuth
        window.location.href = authService.getGoogleAuthUrl();
    };

    const handleGitHubLogin = () => {
        // Redirect to GitHub OAuth
        window.location.href = authService.getGitHubAuthUrl();
    };

    const handleUnavailableLogin = (provider: string) => {
        addToast({
            title: `ยังไม่รองรับการเข้าสู่ระบบด้วย ${provider}`,
            description: "กรุณาเข้าสู่ระบบด้วยบัญชีของคุณ Google หรือ GitHub",
            color: "default",
            timeout: 3000,
            shouldShowTimeoutProgress: true,
        });
    };

    const handleForgotPassword = async () => {
        if (!forgotPasswordEmail) {
            addToast({
                title: "กรุณากรอกอีเมล",
                description: "กรุณากรอกอีเมลของคุณ",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        // Simple email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(forgotPasswordEmail)) {
            addToast({
                title: "รูปแบบอีเมลไม่ถูกต้อง",
                description: "กรุณากรอกอีเมลให้ถูกต้อง",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSendingResetEmail(true);
        try {
            const result = await authService.forgotPassword(forgotPasswordEmail);
            // Always show success (for security - don't reveal if email exists)
            setResetEmailSent(true);
        } catch (error) {
            // Still show success for security
            setResetEmailSent(true);
        } finally {
            setIsSendingResetEmail(false);
        }
    };

    const closeForgotPasswordModal = () => {
        setIsForgotPasswordModalOpen(false);
        setForgotPasswordEmail("");
        setResetEmailSent(false);
    };

    // Show loading while checking auth
    if (isCheckingAuth) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafafa]">
                <div className="flex flex-col items-center gap-4" aria-label="กำลังตรวจสอบสถานะการเข้าสู่ระบบ">
                    <AppMark />
                    <div className="h-1 w-12 overflow-hidden rounded-full bg-blue-100">
                        <div className="h-full w-5 animate-pulse rounded-full bg-linear-to-r from-blue-400 to-indigo-500" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fafafa] text-[#111827]">
            <header className="flex h-20 items-center px-6 sm:px-10">
                <Link href="/" aria-label="ITII Assist Classroom home" className="inline-flex items-center">
                    <AppMark />
                </Link>
            </header>

            <main className="flex min-h-[calc(100vh-128px)] flex-col items-center justify-center px-5 pb-16 pt-10 sm:px-6">
                <section className="w-full max-w-[450px] rounded-[16px] border border-[#d9d9d9] bg-white px-8 py-12 shadow-[0_1px_2px_rgba(0,0,0,0.06)] sm:px-12">
                    <h1 className="mb-7 text-[25px] font-semibold leading-tight tracking-[-0.01em] text-[#0b0f19]">
                        เข้าสู่ระบบ ITII Assist Classroom
                    </h1>

                    <div className="grid grid-cols-3 gap-2">
                        <Button
                            type="button"
                            variant="bordered"
                            radius="sm"
                            className="h-[42px] border-blue-200 bg-white text-[15px] font-medium text-slate-700 data-[hover=true]:border-blue-300 data-[hover=true]:bg-blue-50"
                            onPress={handleGoogleLogin}
                            startContent={<SocialIconGoogle />}
                        >
                            Google
                        </Button>
                        <Button
                            type="button"
                            variant="bordered"
                            radius="sm"
                            className="h-[42px] border-blue-200 bg-white text-[15px] font-medium text-slate-700 data-[hover=true]:border-blue-300 data-[hover=true]:bg-blue-50"
                            onPress={() => handleUnavailableLogin("Apple")}
                            startContent={<Icon icon="fa6-brands:apple" className="text-[17px] text-slate-700" />}
                        >
                            Apple
                        </Button>
                        <Button
                            type="button"
                            variant="bordered"
                            radius="sm"
                            className="h-[42px] border-blue-200 bg-white text-[15px] font-medium text-slate-700 data-[hover=true]:border-blue-300 data-[hover=true]:bg-blue-50"
                            onPress={handleGitHubLogin}
                            startContent={<Icon icon="fa6-brands:github" className="text-[16px] text-slate-700" />}
                        >
                            GitHub
                        </Button>
                    </div>

                    {/* <Button
                        type="button"
                        variant="bordered"
                        radius="sm"
                        className="mt-2 h-[42px] w-full border-blue-200 bg-white text-[15px] font-medium text-slate-700 data-[hover=true]:border-blue-300 data-[hover=true]:bg-blue-50"
                        onPress={() => handleUnavailableLogin("SSO")}
                        startContent={<Icon icon="solar:lock-keyhole-minimalistic-linear" className="text-[17px] text-blue-400" />}
                    >
                        เข้าสู่ระบบด้วย SSO
                    </Button> */}

                    <div className="my-5 flex items-center gap-3">
                        <div className="h-px flex-1 bg-[#d9d9d9]" />
                        <span className="text-sm text-slate-400">หรือ</span>
                        <div className="h-px flex-1 bg-[#d9d9d9]" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="ชื่อผู้ใช้"
                            labelPlacement="outside"
                            placeholder="กรอกชื่อผู้ใช้"
                            type="text"
                            variant="bordered"
                            radius="sm"
                            size="md"
                            value={formData.username}
                            onChange={(e) =>
                                setFormData({ ...formData, username: e.target.value })
                            }
                            startContent={
                                <Icon
                                    icon="solar:user-linear"
                                    className="text-lg text-blue-400"
                                />
                            }
                            classNames={{
                                base: "gap-1",
                                label: "text-[14px] font-medium text-slate-600",
                                inputWrapper: "h-[42px] min-h-[42px] rounded-md border-blue-200 bg-white shadow-none data-[hover=true]:border-blue-300 group-data-[focus=true]:!border-blue-400 group-data-[focus=true]:ring-1 group-data-[focus=true]:ring-blue-300",
                                input: "text-[15px] text-slate-800 placeholder:text-slate-400",
                            }}
                        />

                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-[14px] font-medium text-slate-600">รหัสผ่าน</label>
                                <button
                                    type="button"
                                    onClick={() => setIsForgotPasswordModalOpen(true)}
                                    className="text-[13px] text-blue-400 underline-offset-2 hover:text-blue-500 hover:underline"
                                >
                                    ลืมรหัสผ่าน?
                                </button>
                            </div>

                            <Input
                                aria-label="รหัสผ่าน"
                                placeholder="กรอกรหัสผ่าน"
                                variant="bordered"
                                radius="sm"
                                size="md"
                                value={formData.password}
                                onChange={(e) =>
                                    setFormData({ ...formData, password: e.target.value })
                                }
                                startContent={
                                    <Icon
                                        icon="solar:lock-password-linear"
                                        className="text-lg text-blue-400"
                                    />
                                }
                                endContent={
                                    <button
                                        className="flex h-6 w-6 items-center justify-center text-blue-400 hover:text-blue-500"
                                        type="button"
                                        onClick={toggleVisibility}
                                        aria-label={isVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                                    >
                                        <Icon
                                            icon={isVisible ? "solar:eye-linear" : "solar:eye-closed-linear"}
                                            className="text-[17px]"
                                        />
                                    </button>
                                }
                                type={isVisible ? "text" : "password"}
                                classNames={{
                                    inputWrapper: "h-[42px] min-h-[42px] rounded-md border-blue-200 bg-white shadow-none data-[hover=true]:border-blue-300 group-data-[focus=true]:!border-blue-400 group-data-[focus=true]:ring-1 group-data-[focus=true]:ring-blue-300",
                                    input: "text-[15px] text-slate-800 placeholder:text-slate-400",
                                }}
                            />
                        </div>

                        <div className="pt-1">
                            <p className="mb-2 text-[14px] text-slate-600">ยืนยันว่าคุณไม่ใช่บอท</p>
                            <div className="w-full" suppressHydrationWarning>
                                {turnstileKey ? (
                                    <Turnstile
                                        id='turnstile-1'
                                        ref={refTurnstile}
                                        siteKey={turnstileKey ?? ""}
                                        onSuccess={() => {
                                            setCanSubmit(false);
                                            setTurnstileReady(true);
                                        }}
                                        onError={() => {
                                            setCanSubmit(true);
                                            setTurnstileReady(true);
                                        }}
                                        onExpire={() => {
                                            setCanSubmit(true);
                                        }}
                                        onWidgetLoad={() => {
                                            setTurnstileReady(true);
                                        }}
                                        options={{
                                            theme: 'light',
                                            size: 'flexible',
                                        }}
                                    />
                                ) : !turnstileReady ? (
                                    <div className="flex h-[65px] w-full items-center justify-between border border-blue-100 bg-blue-50/40 px-3">
                                        <div className="flex items-center gap-3">
                                            <span className="h-6 w-6 rounded-sm border-2 border-blue-300 bg-white" />
                                            <span className="text-[14px] text-slate-700">ยืนยันว่าคุณไม่ใช่บอท</span>
                                        </div>
                                        <AppMark className="scale-75" />
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <Button
                            type="submit"
                            radius="sm"
                            className="h-[42px] w-full bg-gradient-to-r from-blue-400 to-indigo-500 text-[15px] font-semibold text-white shadow-lg shadow-blue-300/40 data-[hover=true]:from-blue-500 data-[hover=true]:to-indigo-600"
                            isLoading={isLoading}
                        >
                            เข้าสู่ระบบ
                        </Button>
                    </form>

                </section>

                <p className="mt-5 max-w-[340px] text-center text-[13px] leading-5 text-slate-500">
                    การดำเนินการต่อถือว่าคุณยอมรับ{" "}
                    <Link href="#" className="text-[13px] text-slate-500 underline hover:text-blue-500">
                        ข้อกำหนดการใช้งาน
                    </Link>
                    ,{" "}
                    <Link href="#" className="text-[13px] text-slate-500 underline hover:text-blue-500">
                        นโยบายความเป็นส่วนตัว
                    </Link>
                    , และ{" "}
                    <Link href="#" className="text-[13px] text-slate-500 underline hover:text-blue-500">
                        นโยบายคุกกี้
                    </Link>
                    ของ ITII Assist Classroom
                </p>
            </main>

            <footer className="flex min-h-12 flex-col items-center justify-center gap-2 border-t border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-500 lg:flex-row">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                    <FooterLink>ช่วยเหลือ</FooterLink>
                    <FooterLink>สถานะระบบ</FooterLink>
                    <FooterLink>ข้อกำหนดการใช้งาน</FooterLink>
                    <FooterLink>แจ้งปัญหาความปลอดภัย</FooterLink>
                    <FooterLink>นโยบายความเป็นส่วนตัว</FooterLink>
                </div>
                <span className="text-slate-400">© 2026 ITII Assist Classroom.</span>
            </footer>


            {/* Force Change Password Modal */}
            <Modal
                isOpen={isChangePasswordModalOpen}
                onClose={() => { }}
                isDismissable={false}
                isKeyboardDismissDisabled={true}
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:key-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">เปลี่ยนรหัสผ่าน</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">กรุณาตั้งรหัสผ่านใหม่เพื่อความปลอดภัย</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-4">
                            {/* Info Box */}
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <Icon icon="solar:info-circle-bold" className="text-blue-500 text-xl mt-0.5" />
                                    <div className="text-sm text-blue-700">
                                        <p className="font-semibold">ยินดีต้อนรับ {pendingUser?.username}!</p>
                                        <p className="mt-1">นี่คือการเข้าสู่ระบบครั้งแรกของคุณ กรุณาตั้งรหัสผ่านใหม่เพื่อความปลอดภัย</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
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
                            </div>

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
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button
                            color="primary"
                            onPress={handleForceChangePassword}
                            isLoading={isChangingPassword}
                            isDisabled={!isPasswordValid || newPassword !== confirmPassword}
                            className="w-full font-medium bg-gradient-to-r from-blue-400 to-indigo-500"
                            startContent={!isChangingPassword && <Icon icon="solar:key-bold" className="text-lg" />}
                        >
                            เปลี่ยนรหัสผ่าน
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Forgot Password Modal */}
            <Modal
                isOpen={isForgotPasswordModalOpen}
                onClose={closeForgotPasswordModal}
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:key-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">ลืมรหัสผ่าน</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">
                                    {resetEmailSent ? "ตรวจสอบอีเมลของคุณ" : "กรอกอีเมลเพื่อรีเซ็ตรหัสผ่าน"}
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        {resetEmailSent ? (
                            <div className="space-y-4">
                                {/* Success Message */}
                                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-green-100 rounded-full">
                                            <Icon icon="solar:check-circle-bold" className="text-green-600 text-xl" />
                                        </div>
                                        <div className="text-sm text-green-700">
                                            <p className="font-semibold">ส่งอีเมลแล้ว!</p>
                                            <p className="mt-1">
                                                เราได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมลและทำตามขั้นตอนเพื่อรีเซ็ตรหัสผ่านของคุณ
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Instructions */}
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                    <div className="flex items-start gap-3">
                                        <Icon icon="solar:info-circle-bold" className="text-blue-500 text-xl mt-0.5" />
                                        <div className="text-sm text-blue-700">
                                            <p className="font-semibold">ขั้นตอนต่อไป:</p>
                                            <ul className="mt-2 space-y-1 list-disc list-inside">
                                                <li>ตรวจสอบกล่องจดหมายของคุณ</li>
                                                <li>ตรวจสอบโฟลเดอร์สแปมด้วย</li>
                                                <li>ลิงก์จะหมดอายุใน 1 ชั่วโมง</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Info */}
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                    <div className="flex items-start gap-3">
                                        <Icon icon="solar:info-circle-bold" className="text-amber-500 text-xl mt-0.5" />
                                        <div className="text-sm text-amber-700">
                                            <p>กรอกอีเมลที่ลงทะเบียนไว้ในระบบ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณ</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Email Input */}
                                <Input
                                    label="อีเมล"
                                    labelPlacement="outside"
                                    placeholder="กรอกอีเมลของคุณ"
                                    type="email"
                                    variant="bordered"
                                    size="md"
                                    value={forgotPasswordEmail}
                                    onValueChange={setForgotPasswordEmail}
                                    startContent={<Icon icon="solar:letter-linear" className="text-amber-400 text-xl" />}
                                    classNames={{
                                        inputWrapper: "border-slate-200 hover:border-amber-300 focus-within:!border-amber-400",
                                        label: "text-slate-600 font-medium text-sm",
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !isSendingResetEmail) {
                                            handleForgotPassword();
                                        }
                                    }}
                                    className="pt-4"
                                />
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter className="px-6 py-4">
                        {resetEmailSent ? (
                            <Button
                                color="primary"
                                onPress={closeForgotPasswordModal}
                                className="w-full font-medium bg-gradient-to-r from-blue-400 to-indigo-500"
                            >
                                กลับไปหน้าเข้าสู่ระบบ
                            </Button>
                        ) : (
                            <div className="flex gap-3">
                                <Button
                                    variant="bordered"
                                    onPress={closeForgotPasswordModal}
                                    className="flex-1"
                                >
                                    ยกเลิก
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={handleForgotPassword}
                                    isLoading={isSendingResetEmail}
                                    isDisabled={!forgotPasswordEmail}
                                    className="flex-1 font-medium bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                                    startContent={!isSendingResetEmail && <Icon icon="solar:letter-bold" className="text-lg" />}
                                >
                                    ส่งลิงก์รีเซ็ต
                                </Button>
                            </div>
                        )}
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
