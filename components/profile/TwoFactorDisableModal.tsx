"use client";

import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Input } from "@heroui/input";
import { InputOtp } from "@heroui/input-otp";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { twoFactorService } from "@/services/twoFactor.service";

interface TwoFactorDisableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  method: "totp" | "email" | null;
}

function TwoFactorDisableModal({
  isOpen,
  onClose,
  onSuccess,
  method,
}: TwoFactorDisableModalProps) {
  const { language } = useGlobalSettings();
  const copy = language === "en"
    ? {
        sendCodeError: "Could not send the verification code",
        sendCodeGenericError: "Something went wrong while sending the code",
        resentTitle: "Code sent again",
        resentDescription: "Check your email for the latest code.",
        passwordRequired: "Please enter your password",
        successTitle: "Two-factor disabled",
        successDescription: "Two-factor authentication was turned off.",
        disableError: "Could not disable two-factor authentication",
        genericError: "Something went wrong. Please try again.",
        modalTitle: "Turn off two-factor authentication",
        modalSubtitle: "Disable Two-Factor Authentication",
        warningTitle: "Warning",
        warningDescription: "Turning off 2FA reduces the security of your account. This is not recommended.",
        currentPassword: "Current password",
        sixDigitTotp: "6-digit 2FA code",
        sixDigitEmail: "6-digit email verification code",
        recoveryCode: "Recovery code",
        recoveryPlaceholder: "XXXX-XXXX",
        useRecoveryInstead: "Use a recovery code instead",
        useAuthenticatorInstead: "Use an Authenticator app code",
        useEmailInstead: "Use the email code",
        sendingEmail: "Sending a code to your email...",
        emailSent: "A verification code was sent to your email",
        resendIn: "You can resend in {seconds}s",
        resend: "Resend code",
        cancel: "Cancel",
        disableSubmit: "Turn off 2FA",
      }
    : {
        sendCodeError: "ไม่สามารถส่งรหัสได้",
        sendCodeGenericError: "เกิดข้อผิดพลาดในการส่งรหัส",
        resentTitle: "ส่งรหัสใหม่แล้ว",
        resentDescription: "กรุณาตรวจสอบอีเมลของคุณ",
        passwordRequired: "กรุณากรอกรหัสผ่าน",
        successTitle: "สำเร็จ",
        successDescription: "ปิดใช้งานการยืนยันตัวตนสองขั้นตอนสำเร็จ",
        disableError: "ไม่สามารถปิดการใช้งานได้",
        genericError: "เกิดข้อผิดพลาด กรุณาลองใหม่",
        modalTitle: "ปิดการยืนยันตัวตนสองขั้นตอน",
        modalSubtitle: "Disable Two-Factor Authentication",
        warningTitle: "คำเตือน",
        warningDescription: "การปิด 2FA จะทำให้บัญชีของคุณมีความปลอดภัยน้อยลง ไม่แนะนำให้ปิดการใช้งานนี้",
        currentPassword: "รหัสผ่านปัจจุบัน",
        sixDigitTotp: "รหัส 2FA 6 หลัก",
        sixDigitEmail: "รหัสยืนยัน 6 หลักจากอีเมล",
        recoveryCode: "รหัสสำรอง (Recovery Code)",
        recoveryPlaceholder: "XXXX-XXXX",
        useRecoveryInstead: "ใช้รหัสสำรองแทน",
        useAuthenticatorInstead: "ใช้รหัสจาก Authenticator App",
        useEmailInstead: "ใช้รหัสจากอีเมล",
        sendingEmail: "กำลังส่งรหัสไปยังอีเมล...",
        emailSent: "ส่งรหัสไปยังอีเมลแล้ว",
        resendIn: "ส่งรหัสใหม่ได้ใน {seconds} วินาที",
        resend: "ส่งรหัสใหม่",
        cancel: "ยกเลิก",
        disableSubmit: "ปิดการใช้งาน 2FA",
      };
  const formatTemplate = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [inputMode, setInputMode] = useState<"otp" | "recovery">("otp");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const emailSentRef = useRef(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      setCode("");
      setRecoveryCode("");
      setInputMode("otp");
      setShowPassword(false);
      setError("");
      setIsSendingEmail(false);
      setEmailSent(false);
      setResendCooldown(0);
      emailSentRef.current = false;
    }
  }, [isOpen]);

  // Auto-send email code when modal opens for email method
  useEffect(() => {
    if (isOpen && method === "email" && !emailSentRef.current) {
      emailSentRef.current = true;
      sendEmailCode();
    }
  }, [isOpen, method]);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const sendEmailCode = async () => {
    setIsSendingEmail(true);
    try {
      const result = await twoFactorService.resendEmailCode();
      if (result.success) {
        setEmailSent(true);
        setResendCooldown(60);
      } else {
        setError(result.error || copy.sendCodeError);
      }
    } catch (err) {
      setError(copy.sendCodeGenericError);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    await sendEmailCode();
    if (!error) {
      addToast({
        title: copy.resentTitle,
        description: copy.resentDescription,
        color: "success",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
    }
  };

  const handleDisable = useCallback(async () => {
    if (!password.trim()) {
      setError(copy.passwordRequired);
      return;
    }

    const codeToSend = inputMode === "otp" ? code : recoveryCode;

    setIsLoading(true);
    setError("");

    try {
      const result = await twoFactorService.disable(password, codeToSend || undefined);
      if (result.success) {
        addToast({
          title: copy.successTitle,
          description: copy.successDescription,
          color: "success",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
        onSuccess();
        onClose();
      } else {
        setError(result.error || copy.disableError);
      }
    } catch (err) {
      setError(copy.genericError);
    } finally {
      setIsLoading(false);
    }
  }, [code, copy.disableError, copy.genericError, copy.passwordRequired, copy.successDescription, copy.successTitle, inputMode, onClose, onSuccess, password, recoveryCode]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      placement="center"
    //   classNames={{
    //     backdrop: "bg-black/50 backdrop-blur-sm",
    //   }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3 border-b border-default-200">
          <div className="p-2 bg-linear-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
            <Icon icon="solar:shield-warning-bold" className="text-xl text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{copy.modalTitle}</h2>
            <p className="text-xs text-default-500 font-normal">{copy.modalSubtitle}</p>
          </div>
        </ModalHeader>
        <ModalBody className="py-6">
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <Icon icon="solar:danger-triangle-bold" className="text-xl text-danger shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-danger-800 font-medium">{copy.warningTitle}</p>
                <p className="text-sm text-danger-700 mt-1">
                  {copy.warningDescription}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              type={showPassword ? "text" : "password"}
              label={copy.currentPassword}
              labelPlacement="outside"
              variant="bordered"
              placeholder=" "
              value={password}
              onValueChange={(v) => {
                setPassword(v);
                setError("");
              }}
              endContent={
                <Button 
                  isIconOnly 
                  variant="light" 
                  size="sm"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Icon icon={showPassword ? "solar:eye-closed-linear" : "solar:eye-linear"} />
                </Button>
              }
            />

            {method === "totp" && (
              <div className="space-y-4">
                {inputMode === "otp" ? (
                  <div className="flex flex-col items-center gap-2">
                    <label className="text-sm text-default-600">{copy.sixDigitTotp}</label>
                    <InputOtp
                      length={6}
                      value={code}
                      onValueChange={(value) => {
                        setCode(value);
                        setError("");
                      }}
                      size="lg"
                      variant="bordered"
                      classNames={{
                        segment: "w-11 h-12 text-lg",
                      }}
                    />
                  </div>
                ) : (
                  <Input
                    label={copy.recoveryCode}
                    labelPlacement="outside"
                    placeholder={copy.recoveryPlaceholder}
                    value={recoveryCode}
                    onValueChange={(v) => {
                      setRecoveryCode(v.toUpperCase());
                      setError("");
                    }}
                    classNames={{
                      input: "text-center font-mono tracking-wider",
                    }}
                  />
                )}
                <div className="text-center">
                  <Link
                    as="button"
                    size="sm"
                    onPress={() => {
                      setInputMode(inputMode === "otp" ? "recovery" : "otp");
                      setCode("");
                      setRecoveryCode("");
                      setError("");
                    }}
                    className="text-default-600 hover:text-primary"
                  >
                    {inputMode === "otp" ? copy.useRecoveryInstead : copy.useAuthenticatorInstead}
                  </Link>
                </div>
              </div>
            )}

            {method === "email" && (
              <div className="space-y-4">
                {/* Email sending status */}
                {isSendingEmail && (
                  <div className="flex items-center justify-center gap-2 text-default-500">
                    <Icon icon="svg-spinners:ring-resize" className="text-lg" />
                    <span className="text-sm">{copy.sendingEmail}</span>
                  </div>
                )}
                
                {emailSent && !isSendingEmail && (
                  <div className="flex items-center justify-center gap-2 text-success">
                    <Icon icon="solar:check-circle-bold" className="text-lg" />
                    <span className="text-sm">{copy.emailSent}</span>
                  </div>
                )}

                {inputMode === "otp" ? (
                  <>
                    <div className="flex flex-col items-center gap-2">
                      <label className="text-sm text-default-600">{copy.sixDigitEmail}</label>
                      <InputOtp
                        length={6}
                        value={code}
                        onValueChange={(value) => {
                          setCode(value);
                          setError("");
                        }}
                        size="lg"
                        variant="bordered"
                        classNames={{
                          segment: "w-11 h-12 text-lg",
                        }}
                      />
                    </div>
                    <div className="text-center">
                      <Button
                        variant="light"
                        size="sm"
                        onPress={handleResendEmail}
                        isLoading={isSendingEmail}
                        isDisabled={resendCooldown > 0}
                        startContent={resendCooldown > 0 ? <Icon icon="solar:clock-circle-outline" className="text-lg" /> : <Icon icon="solar:refresh-linear" className="text-lg" />}
                      >
                        {resendCooldown > 0 ? formatTemplate(copy.resendIn, { seconds: resendCooldown }) : copy.resend}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Input
                    label={copy.recoveryCode}
                    labelPlacement="outside"
                    placeholder={copy.recoveryPlaceholder}
                    value={recoveryCode}
                    onValueChange={(v) => {
                      setRecoveryCode(v.toUpperCase());
                      setError("");
                    }}
                    classNames={{
                      input: "text-center font-mono tracking-wider",
                    }}
                  />
                )}
                <div className="text-center">
                  <Link
                    as="button"
                    size="sm"
                    onPress={() => {
                      setInputMode(inputMode === "otp" ? "recovery" : "otp");
                      setCode("");
                      setRecoveryCode("");
                      setError("");
                    }}
                    className="text-default-600 hover:text-primary"
                  >
                    {inputMode === "otp" ? copy.useRecoveryInstead : copy.useEmailInstead}
                  </Link>
                </div>
              </div>
            )}
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
          <Button 
            color="primary" 
            onPress={handleDisable} 
            isLoading={isLoading}
            isDisabled={!password.trim()}
            className="bg-linear-to-r from-blue-400 to-indigo-500 text-white"
          >
            {copy.disableSubmit}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default memo(TwoFactorDisableModal);
