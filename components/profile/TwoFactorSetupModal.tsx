"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Input } from "@heroui/input";
import { InputOtp } from "@heroui/input-otp";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Tabs, Tab } from "@heroui/tabs";
import { Chip } from "@heroui/chip";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
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
                        setError(result.error || "ไม่สามารถเริ่มตั้งค่าได้");
                    }
                } catch (err) {
                    console.error('2FA reconfigure error:', err);
                    setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
                } finally {
                    setIsLoading(false);
                }
            };
            startReconfigure();
        }
    }, [isOpen, isReconfiguring]);

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
                    setError(result.error || "ไม่สามารถเริ่มตั้งค่าได้");
                }
            } else {
                const result = await twoFactorService.setupEmail();
                if (result.success) {
                    setStep("verify");
                    setResendCooldown(60); // Start 60s cooldown after initial send
                } else {
                    setError(result.error || "ไม่สามารถส่งรหัสยืนยันได้");
                }
            }
        } catch (err) {
            console.error('2FA setup error:', err);
            setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
        } finally {
            setIsLoading(false);
        }
    }, [method]);

    const handleVerify = useCallback(async (codeOverride?: string) => {
        const code = codeOverride || verificationCode;
        if (!code.trim()) {
            setError("กรุณากรอกรหัสยืนยัน");
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
                    title: "สำเร็จ",
                    description: "เปิดใช้งานการยืนยันตัวตนสองขั้นตอนสำเร็จ",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                setError(result.error || "รหัสไม่ถูกต้อง");
            }
        } catch (err) {
            setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
        } finally {
            setIsLoading(false);
        }
    }, [verificationCode, method]);

    const handleResendEmail = useCallback(async () => {
        if (resendCooldown > 0) return;
        
        setIsLoading(true);
        setError("");

        try {
            const result = await twoFactorService.resendEmailCode();
            if (result.success) {
                setResendCooldown(60); // Start 60s cooldown
                addToast({
                    title: "ส่งรหัสใหม่แล้ว",
                    description: "กรุณาตรวจสอบอีเมลของคุณ",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                setError(result.error || "ไม่สามารถส่งรหัสใหม่ได้");
            }
        } catch (err) {
            setError("เกิดข้อผิดพลาด");
        } finally {
            setIsLoading(false);
        }
    }, [resendCooldown]);

    const handleCopyCode = useCallback((code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    }, []);

    const handleCopyAllCodes = useCallback(() => {
        const allCodes = backupCodes.join("\n");
        navigator.clipboard.writeText(allCodes);
        addToast({
            title: "คัดลอกแล้ว",
            description: "คัดลอกรหัสสำรองทั้งหมดแล้ว",
            color: "success",
            timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
    }, [backupCodes]);

    const handleDownloadCodes = useCallback(() => {
        const date = new Date().toISOString().split('T')[0];
        const content = `ITII Assist - รหัสสำรอง 2FA\n=============================\nสร้างเมื่อ: ${date}\n\nรหัสสำรอง (ใช้ได้ครั้งเดียวต่อรหัส):\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\n⚠️ เก็บรหัสเหล่านี้ไว้ในที่ปลอดภัย\n⚠️ ใช้เมื่อไม่สามารถเข้าถึงแอป Authenticator ได้`;

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
            title: "ดาวน์โหลดสำเร็จ",
            description: "ไฟล์รหัสสำรองถูกดาวน์โหลดแล้ว",
            color: "success",
            timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
    }, [backupCodes]);

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
                    <h3 className="text-lg font-semibold text-default-900">เพิ่มความปลอดภัยให้บัญชีของคุณ</h3>
                    <p className="text-sm text-default-500 mt-1">
                        เลือกวิธีการยืนยันตัวตนสองขั้นตอนที่ต้องการใช้
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
                                        <h4 className="font-semibold text-default-900">Authenticator App</h4>
                                        <Chip size="sm" color="success" variant="flat">แนะนำ</Chip>
                                    </div>
                                    <p className="text-sm text-default-500 mt-1">
                                        ใช้แอปเช่น Google Authenticator, Authy หรือ Microsoft Authenticator เพื่อสร้างรหัส
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
                                    <h4 className="font-semibold text-default-900">Email Authentication</h4>
                                    <p className="text-sm text-default-500 mt-1">
                                        {hasEmail
                                            ? "รับรหัสยืนยันผ่านทางอีเมลทุกครั้งที่เข้าสู่ระบบ"
                                            : "กรุณาเพิ่มอีเมลในโปรไฟล์ก่อนใช้งาน"
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
                    ยกเลิก
                </Button>
                <Button color="primary" onPress={handleStartSetup} isLoading={isLoading} className="bg-gradient-to-br from-blue-400 to-indigo-500">
                    ดำเนินการต่อ
                </Button>
            </ModalFooter>
        </>
    );

    const renderTOTPSetup = () => (
        <>
            <ModalBody className="py-6">
                <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold text-default-900">ตั้งค่า Authenticator App</h3>
                    <p className="text-sm text-default-500 mt-1">
                        สแกน QR Code ด้วยแอป Authenticator ของคุณ
                    </p>
                </div>

                {totpData && (
                    <>
                        {/* QR Code */}
                        <div className="flex justify-center mb-6">
                            <div className="p-4 bg-white rounded-xl shadow-sm border border-default-200">
                                <Image
                                    src={totpData.qrCode}
                                    alt="QR Code"
                                    width={200}
                                    height={200}
                                    className="rounded-lg"
                                />
                            </div>
                        </div>

                        {/* Manual Entry */}
                        <div className="bg-default-50 rounded-lg p-4 mb-6">
                            <p className="text-xs text-default-500 mb-2 text-center">
                                หรือกรอกรหัสด้วยตนเอง:
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
                            <label className="text-sm text-default-600">รหัสยืนยัน 6 หลัก</label>
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
                    ย้อนกลับ
                </Button>
                <Button
                    color="primary"
                    onPress={() => handleVerify()}
                    isLoading={isLoading}
                    isDisabled={verificationCode.length !== 6}
                    className="bg-gradient-to-br from-blue-400 to-indigo-500"
                >
                    ยืนยัน
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
                    <h3 className="text-lg font-semibold text-default-900">ยืนยันทาง Email</h3>
                    <p className="text-sm text-default-500 mt-1">
                        เราได้ส่งรหัสยืนยัน 6 หลักไปที่อีเมลของคุณแล้ว
                    </p>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <label className="text-sm text-default-600">รหัสยืนยัน 6 หลัก</label>
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
                        {resendCooldown > 0 ? `ส่งรหัสใหม่ได้ใน ${resendCooldown} วินาที` : "ส่งรหัสใหม่"}
                    </Button>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="light" onPress={() => setStep("select")}>
                    ย้อนกลับ
                </Button>
                <Button
                    color="primary"
                    onPress={() => handleVerify()}
                    isLoading={isLoading}
                    isDisabled={verificationCode.length !== 6}
                    className="bg-gradient-to-br from-blue-400 to-indigo-500"
                >
                    ยืนยัน
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
                    <h3 className="text-lg font-semibold text-default-900">บันทึกรหัสสำรอง</h3>
                    <p className="text-sm text-default-500 mt-1">
                        เก็บรหัสเหล่านี้ไว้ในที่ปลอดภัย ใช้เมื่อไม่สามารถเข้าถึงอุปกรณ์ยืนยันได้
                    </p>
                </div>

                <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-4">
                    <div className="flex gap-3">
                        <Icon icon="solar:danger-triangle-bold" className="text-xl text-warning flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-warning-800">
                            <strong>สำคัญ:</strong> นี่คือครั้งเดียวที่คุณจะเห็นรหัสเหล่านี้ กรุณาบันทึกไว้ก่อนปิด
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
                        คัดลอกทั้งหมด
                    </Button>
                    <Button
                        variant="flat"
                        color="primary"
                        className="flex-1"
                        startContent={<Icon icon="solar:download-bold" />}
                        onPress={handleDownloadCodes}
                    >
                        ดาวน์โหลด .txt
                    </Button>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button color="primary" onPress={handleComplete} className="w-full">
                    เสร็จสิ้น
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
                    <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
                        <Icon icon="solar:shield-check-bold" className="text-xl text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">
                            {isReconfiguring ? "เปลี่ยนแอปยืนยันตัวตน" : "ตั้งค่าการยืนยันตัวตนสองขั้นตอน"}
                        </h2>
                        <p className="text-xs text-default-500 font-normal">
                            {isReconfiguring ? "Reconfigure Authenticator App" : "Two-Factor Authentication (2FA)"}
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
