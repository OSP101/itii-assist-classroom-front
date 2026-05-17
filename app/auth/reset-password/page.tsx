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
import { useI18n } from "@/hooks/useI18n";
import { authService } from "@/services";

const AUTH_PAGE_SHELL = "flex min-h-screen flex-col bg-background p-3 text-foreground sm:p-4";
const AUTH_PAGE_CARD = "w-full max-w-md overflow-hidden border border-default-200 bg-content1 shadow-2xl shadow-slate-200/40 dark:shadow-zinc-950/50";
const AUTH_PAGE_FOOTER = "mt-2 px-4 pb-2 text-center text-xs font-light text-slate-400 sm:text-sm";

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useI18n();
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

        setIsResetting(true);
        try {
            const result = await authService.resetPassword(token!, newPassword);
            if (result.success) {
                setResetSuccess(true);
                addToast({
                    title: t("success"),
                    description: t("passwordChangedSuccessfully"),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                addToast({
                    title: t("somethingWentWrong"),
                    description: result.error || t("unableToResetPassword"),
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
            setIsResetting(false);
        }
    };

    // Loading state
    if (isValidating) {
        return (
            <div data-auth-shell="true" className={AUTH_PAGE_SHELL}>
                <div className="flex-1 flex items-center justify-center">
                    <Card className={AUTH_PAGE_CARD}>
                        <CardBody className="p-8 flex flex-col items-center justify-center gap-4">
                            <Spinner size="lg" color="primary" />
                            <p className="text-slate-500">{t("validatingResetLink")}</p>
                        </CardBody>
                    </Card>
                </div>
            </div>
        );
    }

    // Invalid or expired token
    if (!isValidToken) {
        return (
            <div data-auth-shell="true" className={AUTH_PAGE_SHELL}>
                <div className="flex-1 flex items-center justify-center">
                    <Card className={AUTH_PAGE_CARD}>
                        <CardBody className="p-8">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="p-4 bg-red-100 rounded-full">
                                    <Icon icon="solar:close-circle-bold" className="text-4xl text-red-500" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-800 mb-2">
                                        {t("invalidOrExpiredResetLink")}
                                    </h1>
                                    <p className="text-slate-500 mb-6">
                                        {t("invalidOrExpiredResetLinkDescription")}
                                    </p>
                                </div>
                                <Button
                                    color="primary"
                                    onPress={() => router.push("/login")}
                                    className="w-full font-medium bg-linear-to-r from-blue-400 to-indigo-500"
                                    startContent={<Icon icon="solar:arrow-left-bold" className="text-lg" />}
                                >
                                    {t("backToLoginPage")}
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                </div>
                <div className={AUTH_PAGE_FOOTER}>
                    © 2026 ITII Assist Classroom v1.2.90. สงวนลิขสิทธิ์
                </div>
            </div>
        );
    }

    // Success state
    if (resetSuccess) {
        return (
            <div data-auth-shell="true" className={AUTH_PAGE_SHELL}>
                <div className="flex-1 flex items-center justify-center">
                    <Card className={AUTH_PAGE_CARD}>
                        <CardBody className="p-8">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="p-4 bg-green-100 rounded-full">
                                    <Icon icon="solar:check-circle-bold" className="text-4xl text-green-500" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-800 mb-2">
                                        {t("passwordChangedSuccessfully")}
                                    </h1>
                                    <p className="text-slate-500 mb-6">
                                        {t("signInAgainWithNewPassword")}
                                    </p>
                                </div>
                                <Button
                                    color="primary"
                                    onPress={() => router.push("/login")}
                                    className="w-full font-medium bg-linear-to-r from-blue-400 to-indigo-500"
                                    startContent={<Icon icon="solar:login-3-bold" className="text-lg" />}
                                >
                                    {t("backToLoginPage")}
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                </div>
                <div className={AUTH_PAGE_FOOTER}>
                    © 2026 ITII Assist Classroom v1.2.90. สงวนลิขสิทธิ์
                </div>
            </div>
        );
    }

    // Reset password form
    return (
        <div data-auth-shell="true" className={AUTH_PAGE_SHELL}>
            <div className="flex-1 flex items-center justify-center">
                <Card className={AUTH_PAGE_CARD}>
                    <CardBody className="p-6 sm:p-8">
                        {/* Header */}
                        <div className="flex flex-col items-center text-center gap-4 mb-6">
                            <div className="p-4 bg-linear-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg shadow-amber-500/30">
                                <Icon icon="solar:key-bold" className="text-3xl text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">
                                    {t("resetPasswordTitle")}
                                </h1>
                                <p className="text-slate-500 mt-1">
                                    {t("enterNewPasswordForAccount")}
                                </p>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="space-y-4">
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
                                    inputWrapper: "border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                            />
                            <div className="pt-1"></div>

                            {/* Confirm Password */}
                            <Input
                                label={t("confirmPassword")}
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
                                    inputWrapper: "border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                    label: "text-slate-600 font-medium text-sm",
                                }}
                                isInvalid={confirmPassword !== "" && newPassword !== confirmPassword}
                                errorMessage={confirmPassword !== "" && newPassword !== confirmPassword ? t("passwordsDoNotMatch") : ""}
                            />

                            {/* Password Requirements */}
                            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                                <p className="text-xs font-medium text-slate-600 mb-2">{t("passwordRequirements")}</p>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Icon 
                                            icon={passwordValidation.minLength ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                                            className={passwordValidation.minLength ? "text-green-500" : "text-slate-400"} 
                                        />
                                        <span className={`text-xs ${passwordValidation.minLength ? "text-green-600" : "text-slate-500"}`}>
                                            {t("atLeastEightCharacters")}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon 
                                            icon={passwordValidation.hasLowercase ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                                            className={passwordValidation.hasLowercase ? "text-green-500" : "text-slate-400"} 
                                        />
                                        <span className={`text-xs ${passwordValidation.hasLowercase ? "text-green-600" : "text-slate-500"}`}>
                                            {t("containsLowercaseLetter")}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon 
                                            icon={passwordValidation.hasUppercase ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                                            className={passwordValidation.hasUppercase ? "text-green-500" : "text-slate-400"} 
                                        />
                                        <span className={`text-xs ${passwordValidation.hasUppercase ? "text-green-600" : "text-slate-500"}`}>
                                            {t("containsUppercaseLetter")}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon 
                                            icon={passwordValidation.hasSpecialChar ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                                            className={passwordValidation.hasSpecialChar ? "text-green-500" : "text-slate-400"} 
                                        />
                                        <span className={`text-xs ${passwordValidation.hasSpecialChar ? "text-green-600" : "text-slate-500"}`}>
                                            {t("containsSpecialCharacter")}
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
                                className="w-full font-medium mt-2 bg-linear-to-r from-blue-400 to-indigo-500"
                                startContent={!isResetting && <Icon icon="solar:key-bold" className="text-lg" />}
                            >
                                {t("resetPasswordAction")}
                            </Button>

                            {/* Back to login */}
                            <div className="text-center mt-4">
                                <Link href="/login" className="text-blue-400 hover:text-blue-500 text-sm">
                                    {`\u2190 ${t("backToLoginPage")}`}
                                </Link>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>
            <div className={AUTH_PAGE_FOOTER}>
                © 2026 ITII Assist Classroom v1.2.90. สงวนลิขสิทธิ์
            </div>
        </div>
    );
}


export default function ResetPasswordPage() {
    const t = useI18n();

    return (
        <Suspense fallback={
            <div data-auth-shell="true" className={AUTH_PAGE_SHELL}>
                <div className="flex-1 flex items-center justify-center">
                    <Card className={AUTH_PAGE_CARD}>
                        <CardBody className="p-8 flex flex-col items-center justify-center gap-4">
                            <Spinner size="lg" color="primary" />
                            <p className="text-slate-500">{t("loading")}</p>
                        </CardBody>
                    </Card>
                </div>
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}
