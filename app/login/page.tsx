"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { API_BASE_URL } from "@/config/api";
import { authService } from "@/services";
import { AppFooter } from "@/components/Footer";
import { loginPolicyLinks } from "@/config/public-links";
import { useI18n } from "@/hooks/useI18n";
import { getDefaultRouteForRole } from "@/lib/auth-routing";
import { normalizeAppReturnPath, storeOAuthReturnPath, storePendingAuthReturnPath } from "@/lib/auth-resume";
import { LEGACY_SOCIAL_LOGIN_ENABLED, TEMP_GOOGLE_FALLBACK_ON_KKU_DOMAIN } from "@/lib/auth-providers";
import { useLoginProviderMode } from "@/hooks/useLoginProviderMode";
import { KKUSSOButton } from "@/components/auth/KKUSSOButton";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

function AppMark({ className = "h-8" }: { className?: string }) {
    return (
        <>
            <Image
                src="/images/logo-cp-full.png"
                alt="ITII Assist Classroom"
                width={692}
                height={200}
                priority
                className={`w-auto object-contain dark:max-sm:hidden ${className}`}
            />
            <Image
                src="/images/logo-cp-full-black.png"
                alt="ITII Assist Classroom"
                width={305}
                height={89}
                priority
                className={`hidden w-auto object-contain dark:max-sm:block ${className}`}
            />
        </>
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

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useI18n();
    const loginProviderMode = useLoginProviderMode();
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: "",
        password: "",
    });
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
    const nextPath = normalizeAppReturnPath(searchParams.get("next"));
    const isStudentLoginMode = !!nextPath && (
        nextPath.startsWith("/student") ||
        nextPath.startsWith("/check-in/") ||
        nextPath.startsWith("/queue/book")
    );

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

    // Check if user is already logged in, then check maintenance status
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const result = await authService.getMe();
                if (result.success && result.user) {
                    // User is already logged in, redirect based on role
                    router.replace(nextPath || getDefaultRouteForRole(result.user.role));
                    return; // Don't set isCheckingAuth to false, we're redirecting
                }
            } catch {
                // Not logged in
            }
            // Proactively check maintenance status so fresh browsers are redirected
            try {
                const maintRes = await fetch(`${API_BASE_URL}/maintenance-status`);
                if (maintRes.ok) {
                    const maintData = await maintRes.json();
                    if (maintData.success && maintData.data?.active) {
                        router.replace('/maintenance');
                        return;
                    }
                }
            } catch {
                // Cannot reach backend — fall through to show login form
            }
            setIsCheckingAuth(false);
        };
        checkAuth();
    }, [nextPath, router]);

    const toggleVisibility = () => setIsVisible(!isVisible);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.username || !formData.password) {
            addToast({
                title: t("pleaseFillInformation"),
                description: t("pleaseEnterUsernameAndPassword"),
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
                    storePendingAuthReturnPath(nextPath);
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
                        title: t("signInSuccessful"),
                        description: t("welcomeUser", { username: formData.username }),
                        color: "success",
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });

                    // Redirect based on role
                    router.push(nextPath || getDefaultRouteForRole(result.user.role));
                }
            } else {
                // Handle error - might be string or object
                let errorMessage = t("invalidUsernameOrPassword");
                if (typeof result.error === 'string') {
                    errorMessage = result.error;
                } else if (result.error && typeof result.error === 'object') {
                    errorMessage = (result.error as { message?: string }).message || errorMessage;
                }

                addToast({
                    title: t("signInFailed"),
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: t("somethingWentWrong"),
                description: t("cannotConnectToServer"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleForceChangePassword = async () => {
        if (!isPasswordValid) {
            addToast({
                title: t("passwordRequirementFailed"),
                description: t("pleaseCheckPasswordRequirements"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            addToast({
                title: t("passwordsDoNotMatch"),
                description: t("pleaseEnterMatchingPasswords"),
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
                    title: t("passwordChangedSuccessfully"),
                    description: t("signInAgainWithNewPassword"),
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
                    title: t("somethingWentWrong"),
                    description: result.error || t("unableToChangePassword"),
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: t("somethingWentWrong"),
                description: t("unableToChangePassword"),
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
        storeOAuthReturnPath(nextPath);
        window.location.href = authService.getGoogleAuthUrl(isStudentLoginMode ? "student" : undefined);
    };

    const handleGitHubLogin = () => {
        // Redirect to GitHub OAuth
        storeOAuthReturnPath(nextPath);
        window.location.href = authService.getGitHubAuthUrl();
    };

    const handleKKULogin = () => {
        storeOAuthReturnPath(nextPath);
        window.location.href = authService.getKKUAuthUrl(isStudentLoginMode ? "student" : undefined);
    };

    const handleUnavailableLogin = (provider: string) => {
        addToast({
            title: t("unsupportedSignInWithProvider", { provider }),
            description: t("pleaseSignInWithGoogleOrGitHub"),
            color: "default",
            timeout: 3000,
            shouldShowTimeoutProgress: true,
        });
    };

    const handleForgotPassword = async () => {
        if (!forgotPasswordEmail) {
            addToast({
                title: t("pleaseEnterEmail"),
                description: t("pleaseEnterYourEmail"),
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
                title: t("invalidEmailFormat"),
                description: t("pleaseEnterValidEmail"),
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
            <div data-auth-shell="true" className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
                <div className="flex flex-col items-center gap-4" aria-label={t("checkingSignInStatus")}>
                    <AppMark className="h-12" />
                    <div className="h-1 w-12 overflow-hidden rounded-full bg-blue-100">
                        <div className="h-full w-5 animate-pulse rounded-full bg-linear-to-r from-blue-400 to-indigo-500" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div data-auth-shell="true" className="flex min-h-dvh flex-col bg-background text-foreground">
            <header className="flex h-20 items-center justify-between bg-transparent px-6 max-sm:bg-transparent dark:max-sm:bg-slate-950 sm:px-10">
                <Link href="/" aria-label={t("itiiAssistClassroomHome")} className="inline-flex items-center">
                    <AppMark />
                </Link>
                <Link
                    href="/student/login"
                    className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:max-sm:border-white/12 dark:max-sm:bg-white/8 dark:max-sm:text-slate-100 dark:max-sm:hover:border-sky-400/45 dark:max-sm:hover:bg-sky-400/10 dark:sm:text-slate-700"
                >
                    <span>ล็อกอินนักศึกษา</span>
                    <Icon icon="solar:arrow-right-linear" className="text-base" />
                </Link>
            </header>

            <main className="flex w-full flex-1 flex-col items-center justify-start bg-transparent px-5 pb-6 pt-4 max-sm:bg-transparent dark:max-sm:bg-slate-950 sm:min-h-[calc(100vh-128px)] sm:justify-center sm:px-6 sm:pb-16 sm:pt-10">
                <section className="w-full max-w-112.5 bg-transparent px-2 py-4 max-sm:border-0 max-sm:shadow-none dark:max-sm:bg-transparent sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white sm:px-12 sm:py-12 sm:shadow-sm sm:shadow-slate-200/60 dark:sm:shadow-zinc-950/50">
                    {nextPath ? (
                        <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:max-sm:border-sky-500/30 dark:max-sm:bg-sky-500/10 dark:max-sm:text-sky-100">
                            {isStudentLoginMode
                                ? <>เข้าสู่ระบบนักศึกษาด้วย <span className="font-medium">KKU SSO</span> เพื่อไปยัง <span className="font-medium">{nextPath}</span></>
                                : <>Sign in to continue to <span className="font-medium">{nextPath}</span></>}
                        </div>
                    ) : null}
                    <h1 className="mb-7 text-[25px] font-semibold leading-tight tracking-[-0.01em] text-slate-800 dark:max-sm:text-white">
                        {t("signInToITIIAssistClassroom")}
                    </h1>

                    {loginProviderMode === null ? (
                        // ยังไม่รู้ hostname (รอบ hydrate แรก) กันปุ่มกระพริบสลับช่องทาง
                        <div className="h-10.5 w-full animate-pulse rounded-md bg-slate-100 dark:max-sm:bg-white/10" />
                    ) : loginProviderMode === "kku" ? (
                        <KKUSSOButton onPress={handleKKULogin} />
                    ) : (
                        <GoogleSignInButton onPress={handleGoogleLogin} />
                    )}

                    {/* TEMP_GOOGLE_FALLBACK_ON_KKU_DOMAIN — ทางสำรองระหว่างรอสำนักอัปเดตข้อมูลใน SSO
                        ลบทั้งบล็อกนี้เมื่อข้อมูลครบแล้ว ดู lib/auth-providers.ts */}
                    {/* {loginProviderMode === "kku" && TEMP_GOOGLE_FALLBACK_ON_KKU_DOMAIN ? (
                            <GoogleSignInButton onPress={handleGoogleLogin} />
                    ) : null} */}

                    {LEGACY_SOCIAL_LOGIN_ENABLED ? (
                        <div className={`mt-2 grid gap-2 ${isStudentLoginMode ? "grid-cols-1" : "grid-cols-2"}`}>
                            <Button
                                type="button"
                                variant="bordered"
                                radius="sm"
                                className="h-10.5 border-blue-200 bg-white text-[15px] font-medium text-slate-700 data-[hover=true]:border-blue-300 data-[hover=true]:bg-blue-50 dark:max-sm:border-white/12 dark:max-sm:bg-white/8 dark:max-sm:text-white dark:max-sm:data-[hover=true]:border-sky-400/45 dark:max-sm:data-[hover=true]:bg-sky-400/10"
                                onPress={handleGoogleLogin}
                                startContent={<SocialIconGoogle />}
                            >
                                Google
                            </Button>
                            {!isStudentLoginMode ? (
                                <Button
                                    type="button"
                                    variant="bordered"
                                    radius="sm"
                                    className="h-10.5 border-blue-200 bg-white text-[15px] font-medium text-slate-700 data-[hover=true]:border-blue-300 data-[hover=true]:bg-blue-50 dark:max-sm:border-white/12 dark:max-sm:bg-white/8 dark:max-sm:text-white dark:max-sm:data-[hover=true]:border-sky-400/45 dark:max-sm:data-[hover=true]:bg-sky-400/10"
                                    onPress={handleGitHubLogin}
                                    startContent={<Icon icon="fa6-brands:github" className="text-[16px] text-slate-700 dark:max-sm:text-white" />}
                                >
                                    GitHub
                                </Button>
                            ) : null}
                        </div>
                    ) : null}

                    {!isStudentLoginMode ? (
                        <>
                            <div className="my-5 flex items-center gap-3">
                                <div className="h-px flex-1 bg-slate-200" />
                                <span className="text-sm text-slate-400 dark:max-sm:text-slate-300 dark:sm:text-slate-500">{t("or")}</span>
                                <div className="h-px flex-1 bg-slate-200" />
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label={t("username")}
                                    labelPlacement="outside"
                                    placeholder={t("enterUsername")}
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
                                        base: "gap-1 dark:sm:[&_[data-slot=label]]:!text-slate-800",
                                        label: "text-[14px] font-medium text-slate-600 dark:max-sm:text-slate-100 dark:sm:text-slate-800",
                                        inputWrapper: "h-10.5 min-h-10.5 rounded-md border-blue-200 bg-white shadow-none data-[hover=true]:border-blue-300 group-data-[focus=true]:!border-blue-400 group-data-[focus=true]:ring-1 group-data-[focus=true]:ring-blue-300 dark:max-sm:border-white/12 dark:max-sm:bg-white/8 dark:max-sm:data-[hover=true]:border-sky-400/45 dark:max-sm:group-data-[focus=true]:ring-sky-400/30",
                                        input: "login-desktop-dark-input text-[15px] text-slate-800 placeholder:text-slate-400 dark:max-sm:text-slate-100 dark:max-sm:placeholder:text-slate-400 dark:max-sm:autofill:[-webkit-text-fill-color:rgb(241_245_249)] dark:sm:text-slate-800 dark:sm:placeholder:text-slate-500 dark:sm:autofill:[-webkit-text-fill-color:rgb(30_41_59)]",
                                    }}
                                />

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[14px] font-medium text-slate-600 dark:max-sm:text-slate-100 dark:sm:text-slate-800">{t("password")}</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsForgotPasswordModalOpen(true)}
                                            className="text-[13px] text-blue-400 underline-offset-2 hover:text-blue-500 hover:underline dark:max-sm:text-sky-300 dark:max-sm:hover:text-sky-200"
                                        >
                                            {t("forgotPassword")}
                                        </button>
                                    </div>

                                    <Input
                                        aria-label={t("password")}
                                        placeholder={t("enterPassword")}
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
                                                aria-label={isVisible ? t("hidePassword") : t("showPassword")}
                                            >
                                                <Icon
                                                    icon={isVisible ? "solar:eye-linear" : "solar:eye-closed-linear"}
                                                    className="text-[17px]"
                                                />
                                            </button>
                                        }
                                        type={isVisible ? "text" : "password"}
                                        classNames={{
                                            inputWrapper: "h-10.5 min-h-10.5 rounded-md border-blue-200 bg-white shadow-none data-[hover=true]:border-blue-300 group-data-[focus=true]:!border-blue-400 group-data-[focus=true]:ring-1 group-data-[focus=true]:ring-blue-300 dark:max-sm:border-white/12 dark:max-sm:bg-white/8 dark:max-sm:data-[hover=true]:border-sky-400/45 dark:max-sm:group-data-[focus=true]:ring-sky-400/30",
                                            input: "login-desktop-dark-input text-[15px] text-slate-800 placeholder:text-slate-400 dark:max-sm:text-slate-100 dark:max-sm:placeholder:text-slate-400 dark:max-sm:autofill:[-webkit-text-fill-color:rgb(241_245_249)] dark:sm:text-slate-800 dark:sm:placeholder:text-slate-500 dark:sm:autofill:[-webkit-text-fill-color:rgb(30_41_59)]",
                                        }}
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    radius="sm"
                                    className="h-10.5 w-full bg-linear-to-r from-blue-400 to-indigo-500 text-[15px] font-semibold text-white shadow-lg shadow-blue-300/40 data-[hover=true]:from-blue-500 data-[hover=true]:to-indigo-600"
                                    isLoading={isLoading}
                                >
                                    {t("signIn")}
                                </Button>
                            </form>
                        </>
                    ) : (
                        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600 dark:max-sm:border-white/10 dark:max-sm:bg-white/8 dark:max-sm:text-slate-200">
                            Student accounts use Google as the identity source for classroom access. Username/password and GitHub sign-in are disabled for student routes.
                        </div>
                    )}

                </section>

                <p className="mt-5 max-w-85 text-center text-[13px] leading-5 text-slate-500 dark:max-sm:text-slate-300 dark:sm:text-slate-300">
                    {t("continuingMeansAccept")}{" "}
                    <Link href={loginPolicyLinks.terms} className="text-[13px] text-slate-500 underline hover:text-blue-500 dark:max-sm:text-slate-200 dark:max-sm:hover:text-sky-300 dark:sm:text-slate-200 dark:sm:hover:text-sky-300">
                        {t("termsOfUse")}
                    </Link>
                    ,{" "}
                    <Link href={loginPolicyLinks.privacy} className="text-[13px] text-slate-500 underline hover:text-blue-500 dark:max-sm:text-slate-200 dark:max-sm:hover:text-sky-300 dark:sm:text-slate-200 dark:sm:hover:text-sky-300">
                        {t("privacyPolicy")}
                    </Link>
                    , และ{" "}
                    <Link href={loginPolicyLinks.cookies} className="text-[13px] text-slate-500 underline hover:text-blue-500 dark:max-sm:text-slate-200 dark:max-sm:hover:text-sky-300 dark:sm:text-slate-200 dark:sm:hover:text-sky-300">
                        {t("cookiePolicy")}
                    </Link>
                    {" "}{t("ofITIIAssistClassroom")}
                </p>
            </main>

            <AppFooter />


            {/* Force Change Password Modal */}
            <Modal
                isOpen={isChangePasswordModalOpen}
                onClose={() => { }}
                isDismissable={false}
                isKeyboardDismissDisabled={true}
                size="md"
            >
                <ModalContent className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:key-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t("resetPasswordTitle")}</h3>
                                <p className="mt-1 text-sm font-normal text-slate-500 dark:text-slate-300">{t("enterNewPasswordForAccount")}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        <div className="space-y-4">
                            {/* Info Box */}
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                                <div className="flex items-start gap-3">
                                    <Icon icon="solar:info-circle-bold" className="mt-0.5 text-xl text-blue-500 dark:text-blue-300" />
                                    <div className="text-sm text-blue-700 dark:text-blue-100">
                                        <p className="font-semibold">{t("welcomeFirstLogin", { username: pendingUser?.username || "" })}</p>
                                        <p className="mt-1">{t("firstLoginSetNewPassword")}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {/* New Password */}
                                <Input
                                    label={t("newPassword")}
                                    labelPlacement="outside"
                                    placeholder={t("enterNewPassword")}
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
                                        inputWrapper: "border-slate-200 bg-white hover:border-blue-300 focus-within:!border-blue-400 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-blue-500 dark:focus-within:!border-blue-400",
                                        input: "text-slate-800 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500",
                                        label: "text-sm font-medium text-slate-700 dark:text-slate-200",
                                    }}
                                />

                                {/* Confirm Password */}
                                <Input
                                    label={t("confirmNewPasswordLabel")}
                                    labelPlacement="outside"
                                    placeholder={t("confirmNewPassword")}
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
                                        inputWrapper: "border-slate-200 bg-white hover:border-blue-300 focus-within:!border-blue-400 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-blue-500 dark:focus-within:!border-blue-400",
                                        input: "text-slate-800 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500",
                                        label: "text-sm font-medium text-slate-700 dark:text-slate-200",
                                        errorMessage: "text-red-600 dark:text-red-400",
                                    }}
                                    isInvalid={confirmPassword !== "" && newPassword !== confirmPassword}
                                    errorMessage={confirmPassword !== "" && newPassword !== confirmPassword ? t("passwordsDoNotMatch") : ""}
                                />
                            </div>

                            {/* Password Requirements */}
                            <div className="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/80">
                                <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">{t("passwordRequirements")}</p>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Icon 
                                            icon={passwordValidation.minLength ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                                            className={passwordValidation.minLength ? "text-green-500 dark:text-green-400" : "text-slate-400 dark:text-slate-500"} 
                                        />
                                        <span className={`text-xs ${passwordValidation.minLength ? "text-green-600 dark:text-green-300" : "text-slate-500 dark:text-slate-300"}`}>
                                            {t("atLeastEightCharacters")}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon 
                                            icon={passwordValidation.hasLowercase ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                                            className={passwordValidation.hasLowercase ? "text-green-500 dark:text-green-400" : "text-slate-400 dark:text-slate-500"} 
                                        />
                                        <span className={`text-xs ${passwordValidation.hasLowercase ? "text-green-600 dark:text-green-300" : "text-slate-500 dark:text-slate-300"}`}>
                                            {t("containsLowercaseLetter")}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon 
                                            icon={passwordValidation.hasUppercase ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                                            className={passwordValidation.hasUppercase ? "text-green-500 dark:text-green-400" : "text-slate-400 dark:text-slate-500"} 
                                        />
                                        <span className={`text-xs ${passwordValidation.hasUppercase ? "text-green-600 dark:text-green-300" : "text-slate-500 dark:text-slate-300"}`}>
                                            {t("containsUppercaseLetter")}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon 
                                            icon={passwordValidation.hasSpecialChar ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                                            className={passwordValidation.hasSpecialChar ? "text-green-500 dark:text-green-400" : "text-slate-400 dark:text-slate-500"} 
                                        />
                                        <span className={`text-xs ${passwordValidation.hasSpecialChar ? "text-green-600 dark:text-green-300" : "text-slate-500 dark:text-slate-300"}`}>
                                            {t("containsSpecialCharacter")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                        <Button
                            color="primary"
                            onPress={handleForceChangePassword}
                            isLoading={isChangingPassword}
                            isDisabled={!isPasswordValid || newPassword !== confirmPassword}
                            className="w-full font-medium bg-linear-to-r from-blue-400 to-indigo-500"
                            startContent={!isChangingPassword && <Icon icon="solar:key-bold" className="text-lg" />}
                        >
                            {t("resetPasswordTitle")}
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
                <ModalContent className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:key-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t("forgotPasswordTitle")}</h3>
                                <p className="mt-1 text-sm font-normal text-slate-500 dark:text-slate-300">
                                    {resetEmailSent ? t("checkYourEmail") : t("enterEmailToResetPassword")}
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4">
                        {resetEmailSent ? (
                            <div className="space-y-4">
                                {/* Success Message */}
                                <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-500/30 dark:bg-green-500/10">
                                    <div className="flex items-start gap-3">
                                        <div className="rounded-full bg-green-100 p-2 dark:bg-green-500/15">
                                            <Icon icon="solar:check-circle-bold" className="text-xl text-green-600 dark:text-green-300" />
                                        </div>
                                        <div className="text-sm text-green-700 dark:text-green-100">
                                            <p className="font-semibold">{t("resetEmailSent")}</p>
                                            <p className="mt-1">{t("resetEmailSentDescription")}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Instructions */}
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                                    <div className="flex items-start gap-3">
                                        <Icon icon="solar:info-circle-bold" className="mt-0.5 text-xl text-blue-500 dark:text-blue-300" />
                                        <div className="text-sm text-blue-700 dark:text-blue-100">
                                            <p className="font-semibold">{t("nextSteps")}</p>
                                            <ul className="mt-2 space-y-1 list-disc list-inside">
                                                <li>{t("checkYourInbox")}</li>
                                                <li>{t("checkSpamFolder")}</li>
                                                <li>{t("linkExpiresInOneHour")}</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Info */}
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                                    <div className="flex items-start gap-3">
                                        <Icon icon="solar:info-circle-bold" className="mt-0.5 text-xl text-amber-500 dark:text-amber-300" />
                                        <div className="text-sm text-amber-700 dark:text-amber-100">
                                            <p>{t("enterRegisteredEmailToReset")}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Email Input */}
                                <Input
                                    label={t("email")}
                                    labelPlacement="outside"
                                    placeholder={t("pleaseEnterYourEmail")}
                                    type="email"
                                    variant="bordered"
                                    size="md"
                                    value={forgotPasswordEmail}
                                    onValueChange={setForgotPasswordEmail}
                                    startContent={<Icon icon="solar:letter-linear" className="text-amber-400 text-xl" />}
                                    classNames={{
                                        inputWrapper: "border-slate-200 bg-white hover:border-amber-300 focus-within:!border-amber-400 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-amber-500 dark:focus-within:!border-amber-400",
                                        input: "text-slate-800 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500",
                                        label: "text-sm font-medium text-slate-700 dark:text-slate-200",
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
                    <ModalFooter className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                        {resetEmailSent ? (
                            <Button
                                color="primary"
                                onPress={closeForgotPasswordModal}
                                className="w-full font-medium bg-linear-to-r from-blue-400 to-indigo-500"
                            >
                                {t("backToLoginPage")}
                            </Button>
                        ) : (
                            <div className="flex gap-3">
                                <Button
                                    variant="bordered"
                                    onPress={closeForgotPasswordModal}
                                    className="flex-1 border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                                >
                                    {t("cancel")}
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={handleForgotPassword}
                                    isLoading={isSendingResetEmail}
                                    isDisabled={!forgotPasswordEmail}
                                    className="flex-1 font-medium bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                                >
                                    {t("sendResetLink")}
                                </Button>
                            </div>
                        )}
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
