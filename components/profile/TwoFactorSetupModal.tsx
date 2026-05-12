"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Input } from "@heroui/input";
import { InputOtp } from "@heroui/input-otp";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { twoFactorService, TOTPSetupResponse } from "@/services/twoFactor.service";
import Image from "next/image";

interface TwoFactorSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    hasEmail?: boolean;
    isReconfiguring?: boolean;
}

type SetupStep = "select" | "setup" | "verify" | "backup";
type Method = "totp" | "email";

function TwoFactorSetupModal({
    isOpen,
    onClose,
    onSuccess,
    hasEmail = true,
    isReconfiguring = false,
}: TwoFactorSetupModalProps) {
    const { language } = useGlobalSettings();
    const copy = language === "en"
        ? {
            setupStartError: "Could not start setup",
            sendVerificationError: "Could not send the verification code",
            genericError: "Something went wrong. Please try again.",
            genericShortError: "Something went wrong",
            verificationRequired: "Please enter the verification code",
            successTitle: "Two-factor enabled",
            successDescription: "Two-factor authentication is now active.",
            invalidCode: "Invalid verification code",
            resendTitle: "Code sent again",
            resendDescription: "Check your email for the latest code.",
            resendError: "Could not send a new code",
            copiedTitle: "Copied",
            copiedDescription: "All backup codes were copied.",
            downloadTitle: "Downloaded",
            downloadDescription: "The backup codes file was downloaded.",
            downloadFileTitle: "ITII Assist - 2FA Backup Codes",
            downloadFileCreatedAt: "Created at",
            downloadFileCodes: "Backup codes (each code can be used once):",
            downloadFileWarning1: "Store these codes somewhere safe.",
            downloadFileWarning2: "Use them when you cannot access your Authenticator app.",
            selectTitle: "Add extra protection to your account",
            selectDescription: "Choose the two-factor method you want to use.",
            authAppTitle: "Authenticator App",
            recommended: "Recommended",
            authAppDescription: "Use Google Authenticator, Authy, or Microsoft Authenticator to generate sign-in codes.",
            emailTitle: "Email Authentication",
            emailDescription: "Receive a verification code by email every time you sign in.",
            emailMissing: "Add an email address to your profile before using this method.",
            cancel: "Cancel",
            continue: "Continue",
            setupTotpTitle: "Set up your Authenticator app",
            setupTotpDescription: "Scan this QR code with your Authenticator app.",
            qrCodeAlt: "Two-factor QR code",
            manualEntry: "Or enter the secret manually:",
            verificationCodeLabel: "6-digit verification code",
            back: "Back",
            verify: "Verify",
            emailVerifyTitle: "Verify by email",
            emailVerifyDescription: "We sent a 6-digit verification code to your email.",
            resendIn: "You can resend in {seconds}s",
            resend: "Resend code",
            backupTitle: "Save your backup codes",
            backupDescription: "Keep these codes somewhere safe. Use them when you cannot access your verification device.",
            importantPrefix: "Important:",
            importantDescription: "This is the only time these backup codes will be shown. Save them before closing this dialog.",
            copyAll: "Copy all",
            download: "Download .txt",
            finish: "Done",
            configureTitle: "Set up two-factor authentication",
            configureSubtitle: "Two-Factor Authentication (2FA)",
            reconfigureTitle: "Change your Authenticator app",
            reconfigureSubtitle: "Reconfigure Authenticator App",
        }
        : {
            setupStartError: "ไม่สามารถเริ่มตั้งค่าได้",
            sendVerificationError: "ไม่สามารถส่งรหัสยืนยันได้",
            genericError: "เกิดข้อผิดพลาด กรุณาลองใหม่",
            genericShortError: "เกิดข้อผิดพลาด",
            verificationRequired: "กรุณากรอกรหัสยืนยัน",
            successTitle: "สำเร็จ",
            successDescription: "เปิดใช้งานการยืนยันตัวตนสองขั้นตอนสำเร็จ",
            invalidCode: "รหัสไม่ถูกต้อง",
            resendTitle: "ส่งรหัสใหม่แล้ว",
            resendDescription: "กรุณาตรวจสอบอีเมลของคุณ",
            resendError: "ไม่สามารถส่งรหัสใหม่ได้",
            copiedTitle: "คัดลอกแล้ว",
            copiedDescription: "คัดลอกรหัสสำรองทั้งหมดแล้ว",
            downloadTitle: "ดาวน์โหลดสำเร็จ",
            downloadDescription: "ไฟล์รหัสสำรองถูกดาวน์โหลดแล้ว",
            downloadFileTitle: "ITII Assist - รหัสสำรอง 2FA",
            downloadFileCreatedAt: "สร้างเมื่อ",
            downloadFileCodes: "รหัสสำรอง (ใช้ได้ครั้งเดียวต่อรหัส):",
            downloadFileWarning1: "เก็บรหัสเหล่านี้ไว้ในที่ปลอดภัย",
            downloadFileWarning2: "ใช้เมื่อไม่สามารถเข้าถึงแอป Authenticator ได้",
            selectTitle: "เพิ่มความปลอดภัยให้บัญชีของคุณ",
            selectDescription: "เลือกวิธีการยืนยันตัวตนสองขั้นตอนที่ต้องการใช้",
            authAppTitle: "Authenticator App",
            recommended: "แนะนำ",
            authAppDescription: "ใช้แอปเช่น Google Authenticator, Authy หรือ Microsoft Authenticator เพื่อสร้างรหัส",
            emailTitle: "Email Authentication",
            emailDescription: "รับรหัสยืนยันผ่านทางอีเมลทุกครั้งที่เข้าสู่ระบบ",
            emailMissing: "กรุณาเพิ่มอีเมลในโปรไฟล์ก่อนใช้งาน",
            cancel: "ยกเลิก",
            continue: "ดำเนินการต่อ",
            setupTotpTitle: "ตั้งค่า Authenticator App",
            setupTotpDescription: "สแกน QR Code ด้วยแอป Authenticator ของคุณ",
            qrCodeAlt: "QR Code",
            manualEntry: "หรือกรอกรหัสด้วยตนเอง:",
            verificationCodeLabel: "รหัสยืนยัน 6 หลัก",
            back: "ย้อนกลับ",
            verify: "ยืนยัน",
            emailVerifyTitle: "ยืนยันทาง Email",
            emailVerifyDescription: "เราได้ส่งรหัสยืนยัน 6 หลักไปที่อีเมลของคุณแล้ว",
            resendIn: "ส่งรหัสใหม่ได้ใน {seconds} วินาที",
            resend: "ส่งรหัสใหม่",
            backupTitle: "บันทึกรหัสสำรอง",
            backupDescription: "เก็บรหัสเหล่านี้ไว้ในที่ปลอดภัย ใช้เมื่อไม่สามารถเข้าถึงอุปกรณ์ยืนยันได้",
            importantPrefix: "สำคัญ:",
            importantDescription: "นี่คือครั้งเดียวที่คุณจะเห็นรหัสเหล่านี้ กรุณาบันทึกไว้ก่อนปิด",
            copyAll: "คัดลอกทั้งหมด",
            download: "ดาวน์โหลด .txt",
            finish: "เสร็จสิ้น",
            configureTitle: "ตั้งค่าการยืนยันตัวตนสองขั้นตอน",
            configureSubtitle: "Two-Factor Authentication (2FA)",
            reconfigureTitle: "เปลี่ยนแอปยืนยันตัวตน",
            reconfigureSubtitle: "Reconfigure Authenticator App",
        };
    const formatTemplate = (template: string, values: Record<string, string | number>) =>
        template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
    const [step, setStep] = useState<SetupStep>("select");
    const [method, setMethod] = useState<Method>("totp");
    const [isLoading, setIsLoading] = useState(false);
    const [totpData, setTotpData] = useState<TOTPSetupResponse | null>(null);
    const [verificationCode, setVerificationCode] = useState("");
    const [error, setError] = useState("");
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [showSecret, setShowSecret] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [resendCooldown, setResendCooldown] = useState(0);

    // Reset state when modal closes or auto-start for reconfiguring
    useEffect(() => {
        if (!isOpen) {
            setStep("select");
            setMethod("totp");
            setIsLoading(false);
            setTotpData(null);
            setVerificationCode("");
            setError("");
            setBackupCodes([]);
            setShowSecret(false);
            setResendCooldown(0);
        } else if (isReconfiguring) {
            // Auto-start TOTP setup when reconfiguring
            setMethod("totp");
            const startReconfigure = async () => {
                setIsLoading(true);
                setError("");
                try {
                    const result = await twoFactorService.setupTOTP();
                    if (result.success && result.data) {
                        setTotpData(result.data);
                        setStep("setup");
                    } else {
                        setError(result.error || copy.setupStartError);
                    }
                } catch (err) {
                    console.error('2FA reconfigure error:', err);
                    setError(copy.genericError);
                } finally {
                    setIsLoading(false);
                }
            };
            startReconfigure();
        }
    }, [copy.genericError, copy.setupStartError, isOpen, isReconfiguring]);

    // Countdown timer for resend button
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const handleStartSetup = useCallback(async () => {
        setIsLoading(true);
        setError("");

        try {
            if (method === "totp") {
                const result = await twoFactorService.setupTOTP();
                if (result.success && result.data) {
                    setTotpData(result.data);
                    setStep("setup");
                } else {
                    setError(result.error || copy.setupStartError);
                }
            } else {
                const result = await twoFactorService.setupEmail();
                if (result.success) {
                    setStep("verify");
                    setResendCooldown(60); // Start 60s cooldown after initial send
                } else {
                    setError(result.error || copy.sendVerificationError);
                }
            }
        } catch (err) {
            console.error('2FA setup error:', err);
            setError(copy.genericError);
        } finally {
            setIsLoading(false);
        }
    }, [copy.genericError, copy.sendVerificationError, copy.setupStartError, method]);

    const handleVerify = useCallback(async (codeOverride?: string) => {
        const code = codeOverride || verificationCode;
        if (!code.trim()) {
            setError(copy.verificationRequired);
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const result = await twoFactorService.verify(code, method);
            if (result.success && result.data) {
                setBackupCodes(result.data.backupCodes);
                setStep("backup");
                addToast({
                    title: copy.successTitle,
                    description: copy.successDescription,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                setError(result.error || copy.invalidCode);
            }
        } catch (err) {
            setError(copy.genericError);
        } finally {
            setIsLoading(false);
        }
    }, [copy.genericError, copy.invalidCode, copy.successDescription, copy.successTitle, copy.verificationRequired, method, verificationCode]);

    const handleResendEmail = useCallback(async () => {
        if (resendCooldown > 0) return;
        
        setIsLoading(true);
        setError("");

        try {
            const result = await twoFactorService.resendEmailCode();
            if (result.success) {
                setResendCooldown(60); // Start 60s cooldown
                addToast({
                    title: copy.resendTitle,
                    description: copy.resendDescription,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                setError(result.error || copy.resendError);
            }
        } catch (err) {
            setError(copy.genericShortError);
        } finally {
            setIsLoading(false);
        }
    }, [copy.genericShortError, copy.resendDescription, copy.resendError, copy.resendTitle, resendCooldown]);

    const handleCopyCode = useCallback((code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    }, []);

    const handleCopyAllCodes = useCallback(() => {
        const allCodes = backupCodes.join("\n");
        navigator.clipboard.writeText(allCodes);
        addToast({
            title: copy.copiedTitle,
            description: copy.copiedDescription,
            color: "success",
            timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
    }, [backupCodes, copy.copiedDescription, copy.copiedTitle]);

    const handleDownloadCodes = useCallback(() => {
        const date = new Date().toISOString().split('T')[0];
        const content = `${copy.downloadFileTitle}\n=============================\n${copy.downloadFileCreatedAt}: ${date}\n\n${copy.downloadFileCodes}\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\n⚠️ ${copy.downloadFileWarning1}\n⚠️ ${copy.downloadFileWarning2}`;

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `itii-assist-backup-codes-${date}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        addToast({
            title: copy.downloadTitle,
            description: copy.downloadDescription,
            color: "success",
            timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
    }, [backupCodes, copy.downloadDescription, copy.downloadFileCodes, copy.downloadFileCreatedAt, copy.downloadFileTitle, copy.downloadFileWarning1, copy.downloadFileWarning2, copy.downloadTitle]);

    const handleComplete = useCallback(() => {
        onSuccess();
        onClose();
    }, [onSuccess, onClose]);

    const renderSelectMethod = () => (
        <>
            <ModalBody className="py-6">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                        <Icon icon="solar:shield-check-bold" className="text-3xl text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-default-900">{copy.selectTitle}</h3>
                    <p className="text-sm text-default-500 mt-1">
                        {copy.selectDescription}
                    </p>
                </div>

                <div className="space-y-3">
                    {/* Authenticator App Option */}
                    <Card
                        isPressable
                        className={`w-full border-2 transition-all ${method === "totp" ? "border-primary bg-primary-50/50" : "border-default-200"}`}
                        onPress={() => setMethod("totp")}
                    >
                        <CardBody className="p-4">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${method === "totp" ? "bg-primary-100" : "bg-default-100"}`}>
                                    <Icon icon="solar:smartphone-bold" className={`text-2xl ${method === "totp" ? "text-primary" : "text-default-500"}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-default-900">{copy.authAppTitle}</h4>
                                        <Chip size="sm" color="success" variant="flat">{copy.recommended}</Chip>
                                    </div>
                                    <p className="text-sm text-default-500 mt-1">
                                        {copy.authAppDescription}
                                    </p>
                                </div>
                                {method === "totp" && (
                                    <Icon icon="solar:check-circle-bold" className="text-xl text-primary" />
                                )}
                            </div>
                        </CardBody>
                    </Card>

                    {/* Email Option */}
                    <Card
                        isPressable={hasEmail}
                        isDisabled={!hasEmail}
                        className={`border-2 transition-all ${method === "email" ? "border-primary bg-primary-50/50" : "border-default-200"} ${!hasEmail ? "opacity-50" : ""} w-full`}
                        onPress={() => hasEmail && setMethod("email")}
                    >
                        <CardBody className="p-4">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${method === "email" ? "bg-primary-100" : "bg-default-100"}`}>
                                    <Icon icon="solar:letter-bold" className={`text-2xl ${method === "email" ? "text-primary" : "text-default-500"}`} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-default-900">{copy.emailTitle}</h4>
                                    <p className="text-sm text-default-500 mt-1">
                                        {hasEmail
                                            ? copy.emailDescription
                                            : copy.emailMissing
                                        }
                                    </p>
                                </div>
                                {method === "email" && hasEmail && (
                                    <Icon icon="solar:check-circle-bold" className="text-xl text-primary" />
                                )}
                            </div>
                        </CardBody>
                    </Card>
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-danger-50 border border-danger-200 rounded-lg">
                        <p className="text-sm text-danger">{error}</p>
                    </div>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="light" onPress={onClose}>
                    {copy.cancel}
                </Button>
                <Button color="primary" onPress={handleStartSetup} isLoading={isLoading} className="bg-linear-to-br from-blue-400 to-indigo-500">
                    {copy.continue}
                </Button>
            </ModalFooter>
        </>
    );

    const renderTOTPSetup = () => (
        <>
            <ModalBody className="py-6">
                <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold text-default-900">{copy.setupTotpTitle}</h3>
                    <p className="text-sm text-default-500 mt-1">
                        {copy.setupTotpDescription}
                    </p>
                </div>

                {totpData && (
                    <>
                        {/* QR Code */}
                        <div className="flex justify-center mb-6">
                            <div className="p-4 bg-white rounded-xl shadow-sm border border-default-200">
                                <Image
                                    src={totpData.qrCode}
                                    alt={copy.qrCodeAlt}
                                    width={200}
                                    height={200}
                                    className="rounded-lg"
                                />
                            </div>
                        </div>

                        {/* Manual Entry */}
                        <div className="bg-default-50 rounded-lg p-4 mb-6">
                            <p className="text-xs text-default-500 mb-2 text-center">
                                {copy.manualEntry}
                            </p>
                            <div className="flex items-center justify-center gap-2">
                                {showSecret ? (
                                    <code className="text-sm font-mono bg-default-100 px-3 py-2 rounded">
                                        {totpData.secret}
                                    </code>
                                ) : (
                                    <code className="text-sm font-mono bg-default-100 px-3 py-2 rounded">
                                        ••••••••••••••••
                                    </code>
                                )}
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    onPress={() => setShowSecret(!showSecret)}
                                >
                                    <Icon icon={showSecret ? "solar:eye-closed-linear" : "solar:eye-linear"} />
                                </Button>
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    onPress={() => handleCopyCode(totpData.secret)}
                                >
                                    <Icon icon={copiedCode === totpData.secret ? "solar:check-read-linear" : "solar:copy-linear"} />
                                </Button>
                            </div>
                        </div>

                        {/* Verification Input */}
                        <div className="flex flex-col items-center gap-2">
                            <label className="text-sm text-default-600">{copy.verificationCodeLabel}</label>
                            <InputOtp
                                length={6}
                                value={verificationCode}
                                onValueChange={(value) => {
                                    setVerificationCode(value);
                                    setError("");
                                    if (value.length === 6) {
                                        handleVerify(value);
                                    }
                                }}
                                size="lg"
                                variant="bordered"
                                classNames={{
                                    segment: "w-12 h-14 text-xl",
                                }}
                            />
                            {error && <p className="text-danger text-sm">{error}</p>}
                        </div>
                    </>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="light" onPress={() => setStep("select")}>
                    {copy.back}
                </Button>
                <Button
                    color="primary"
                    onPress={() => handleVerify()}
                    isLoading={isLoading}
                    isDisabled={verificationCode.length !== 6}
                    className="bg-linear-to-br from-blue-400 to-indigo-500"
                >
                    {copy.verify}
                </Button>
            </ModalFooter>
        </>
    );

    const renderEmailVerify = () => (
        <>
            <ModalBody className="py-6">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                        <Icon icon="solar:letter-bold" className="text-3xl text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-default-900">{copy.emailVerifyTitle}</h3>
                    <p className="text-sm text-default-500 mt-1">
                        {copy.emailVerifyDescription}
                    </p>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <label className="text-sm text-default-600">{copy.verificationCodeLabel}</label>
                    <InputOtp
                        length={6}
                        value={verificationCode}
                        onValueChange={(value) => {
                            setVerificationCode(value);
                            setError("");
                            if (value.length === 6) {
                                handleVerify(value);
                            }
                        }}
                        size="lg"
                        variant="bordered"
                        classNames={{
                            segment: "w-12 h-14 text-xl",
                        }}
                    />
                    {error && <p className="text-danger text-sm">{error}</p>}
                </div>

                <div className="text-center mt-4">
                    <Button
                        variant="light"
                        size="sm"
                        onPress={handleResendEmail}
                        isLoading={isLoading}
                        isDisabled={resendCooldown > 0}
                        startContent={resendCooldown > 0 ? <Icon icon="solar:clock-circle-outline" className="text-lg" /> : <Icon icon="solar:refresh-linear" className="text-lg" />}
                    >
                        {resendCooldown > 0 ? formatTemplate(copy.resendIn, { seconds: resendCooldown }) : copy.resend}
                    </Button>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="light" onPress={() => setStep("select")}>
                    {copy.back}
                </Button>
                <Button
                    color="primary"
                    onPress={() => handleVerify()}
                    isLoading={isLoading}
                    isDisabled={verificationCode.length !== 6}
                    className="bg-linear-to-br from-blue-400 to-indigo-500"
                >
                    {copy.verify}
                </Button>
            </ModalFooter>
        </>
    );

    const renderBackupCodes = () => (
        <>
            <ModalBody className="py-6">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-success-100 rounded-full flex items-center justify-center">
                        <Icon icon="solar:key-bold" className="text-3xl text-success" />
                    </div>
                    <h3 className="text-lg font-semibold text-default-900">{copy.backupTitle}</h3>
                    <p className="text-sm text-default-500 mt-1">
                        {copy.backupDescription}
                    </p>
                </div>

                <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-4">
                    <div className="flex gap-3">
                        <Icon icon="solar:danger-triangle-bold" className="text-xl text-warning shrink-0 mt-0.5" />
                        <p className="text-sm text-warning-800">
                            <strong>{copy.importantPrefix}</strong> {copy.importantDescription}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                    {backupCodes.map((code, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between bg-default-100 rounded-lg px-3 py-2 cursor-pointer hover:bg-default-200 transition-colors"
                            onClick={() => handleCopyCode(code)}
                        >
                            <code className="font-mono text-sm">{code}</code>
                            <Icon
                                icon={copiedCode === code ? "solar:check-read-linear" : "solar:copy-linear"}
                                className="text-default-400 text-sm"
                            />
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="flat"
                        className="flex-1"
                        startContent={<Icon icon="solar:copy-linear" />}
                        onPress={handleCopyAllCodes}
                    >
                        {copy.copyAll}
                    </Button>
                    <Button
                        variant="flat"
                        color="primary"
                        className="flex-1"
                        startContent={<Icon icon="solar:download-bold" />}
                        onPress={handleDownloadCodes}
                    >
                        {copy.download}
                    </Button>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button color="primary" onPress={handleComplete} className="w-full">
                    {copy.finish}
                </Button>
            </ModalFooter>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={step === "backup" ? handleComplete : onClose}
            size="lg"
            placement="center"
            isDismissable={step !== "backup"}
            hideCloseButton={step === "backup"}
        //   classNames={{
        //     backdrop: "bg-black/50 backdrop-blur-sm",
        //   }}
        >
            <ModalContent>
                <ModalHeader className="flex items-center gap-3 border-b border-default-200">
                    <div className="p-2 bg-linear-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
                        <Icon icon="solar:shield-check-bold" className="text-xl text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">
                            {isReconfiguring ? copy.reconfigureTitle : copy.configureTitle}
                        </h2>
                        <p className="text-xs text-default-500 font-normal">
                            {isReconfiguring ? copy.reconfigureSubtitle : copy.configureSubtitle}
                        </p>
                    </div>
                </ModalHeader>

                {step === "select" && renderSelectMethod()}
                {step === "setup" && method === "totp" && renderTOTPSetup()}
                {step === "verify" && method === "email" && renderEmailVerify()}
                {step === "verify" && method === "totp" && renderTOTPSetup()}
                {step === "backup" && renderBackupCodes()}
            </ModalContent>
        </Modal>
    );
}

export default memo(TwoFactorSetupModal);
