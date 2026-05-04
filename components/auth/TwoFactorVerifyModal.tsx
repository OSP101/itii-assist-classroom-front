"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { Modal, ModalContent, ModalBody } from "@heroui/modal";
import { Input } from "@heroui/input";
import { InputOtp } from "@heroui/input-otp";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { twoFactorService, TwoFactorLoginData } from "@/services/twoFactor.service";

interface TwoFactorVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { user: unknown; accessToken: string; refreshToken: string; mustChangePassword: boolean }) => void;
  twoFactorData: TwoFactorLoginData | null;
}

type InputMode = "otp" | "recovery";

function TwoFactorVerifyModal({
  isOpen,
  onClose,
  onSuccess,
  twoFactorData,
}: TwoFactorVerifyModalProps) {
  const [otpCode, setOtpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("otp");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setOtpCode("");
      setRecoveryCode("");
      setInputMode("otp");
      setError("");
      setCodeSent(false);
      
      // Auto-send email code if method is email
      if (twoFactorData?.twoFactorMethod === "email") {
        handleSendEmailCode();
      }
    }
  }, [isOpen, twoFactorData?.twoFactorMethod]);

  const handleSendEmailCode = useCallback(async () => {
    if (!twoFactorData?.userId) return;

    setIsSendingCode(true);
    setError("");

    try {
      const result = await twoFactorService.sendLoginCode(twoFactorData.userId);
      if (result.success) {
        setCodeSent(true);
      } else {
        setError(result.error || "ไม่สามารถส่งรหัสได้");
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setIsSendingCode(false);
    }
  }, [twoFactorData?.userId]);

  const handleVerify = useCallback(async () => {
    const codeToVerify = inputMode === "otp" ? otpCode : recoveryCode.trim();
    
    if (!codeToVerify || !twoFactorData?.userId) {
      setError("กรุณากรอกรหัสยืนยัน");
      return;
    }

    // Validate OTP is 6 digits
    if (inputMode === "otp" && otpCode.length !== 6) {
      setError("กรุณากรอกรหัส 6 หลักให้ครบ");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await twoFactorService.completeLogin(twoFactorData.userId, codeToVerify);
      if (result.success && result.data) {
        onSuccess({
          user: result.data.user,
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken,
          mustChangePassword: result.data.mustChangePassword,
        });
      } else {
        setError(result.error || "รหัสไม่ถูกต้อง");
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setIsLoading(false);
    }
  }, [inputMode, otpCode, recoveryCode, twoFactorData?.userId, onSuccess]);

  // Auto-submit when OTP is complete
  useEffect(() => {
    if (inputMode === "otp" && otpCode.length === 6 && !isLoading) {
      handleVerify();
    }
  }, [otpCode, inputMode, isLoading, handleVerify]);

  const toggleInputMode = useCallback(() => {
    setInputMode(prev => prev === "otp" ? "recovery" : "otp");
    setError("");
    setOtpCode("");
    setRecoveryCode("");
  }, []);

  const getMethodDescription = () => {
    if (inputMode === "recovery") {
      return "กรอกรหัสสำรองที่คุณบันทึกไว้ตอนตั้งค่า 2FA";
    }
    if (twoFactorData?.twoFactorMethod === "totp") {
      return "เปิดแอป Authenticator แล้วกรอกรหัส 6 หลัก";
    }
    return twoFactorData?.email 
      ? `กรอกรหัสที่ส่งไปยัง ${twoFactorData.email}`
      : "กรอกรหัสที่ส่งไปยังอีเมลของคุณ";
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      placement="center"
      isDismissable={!isLoading}
      size="md"
    >
      <ModalContent>
        <ModalBody className="py-8 px-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-default-900 mb-2">
              Two-Factor Authentication
            </h2>
            <p className="text-sm text-default-500">
              {getMethodDescription()}
            </p>
          </div>

          {inputMode === "otp" ? (
            /* OTP Input Mode */
            <div className="flex flex-col items-center gap-4">
              <InputOtp
                length={6}
                value={otpCode}
                onValueChange={(value) => {
                  setOtpCode(value);
                  setError("");
                }}
                size="lg"
                variant="bordered"
                isInvalid={!!error}
                classNames={{
                  segment: "w-12 h-14 text-xl",
                  segmentWrapper: "gap-2",
                }}
              />
              
              {error && (
                <p className="text-danger text-sm">{error}</p>
              )}

              <Button
                color="primary"
                size="lg"
                className="w-full mt-4"
                onPress={handleVerify}
                isLoading={isLoading}
                isDisabled={otpCode.length !== 6}
              >
                Verify
              </Button>

              {twoFactorData?.twoFactorMethod === "email" && (
                <Button 
                  variant="light" 
                  size="sm" 
                  onPress={handleSendEmailCode}
                  isLoading={isSendingCode}
                  isDisabled={isSendingCode}
                  className="mt-2"
                >
                  {codeSent ? "ส่งรหัสใหม่" : "ส่งรหัสอีกครั้ง"}
                </Button>
              )}

              <Link
                as="button"
                size="sm"
                color="primary"
                onPress={toggleInputMode}
                className="mt-4"
              >
                Use a recovery code
              </Link>
            </div>
          ) : (
            /* Recovery Code Input Mode */
            <div className="flex flex-col items-center gap-4">
              <Input
                label="Recovery Code"
                placeholder="Enter recovery code"
                value={recoveryCode}
                onValueChange={(v) => {
                  setRecoveryCode(v.toUpperCase());
                  setError("");
                }}
                size="lg"
                variant="bordered"
                classNames={{
                  input: "text-center font-mono tracking-wider",
                }}
                isInvalid={!!error}
                errorMessage={error}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && recoveryCode.trim()) {
                    handleVerify();
                  }
                }}
              />

              <Button
                color="primary"
                size="lg"
                className="w-full mt-4"
                onPress={handleVerify}
                isLoading={isLoading}
                isDisabled={!recoveryCode.trim()}
              >
                Verify
              </Button>

              <Link
                as="button"
                size="sm"
                color="primary"
                onPress={toggleInputMode}
                className="mt-4"
              >
                Use an authenticator app
              </Link>
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default memo(TwoFactorVerifyModal);
