"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { Modal, ModalContent, ModalBody } from "@heroui/modal";
import { Input } from "@heroui/input";
import { InputOtp } from "@heroui/input-otp";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { useI18n } from "@/hooks/useI18n";
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
  const t = useI18n();
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
        setError(result.error || t("unableToSendCodeTryAgain"));
      }
    } catch (err) {
      setError(t("unableToSendCodeTryAgain"));
    } finally {
      setIsSendingCode(false);
    }
  }, [t, twoFactorData?.userId]);

  const handleVerify = useCallback(async () => {
    const codeToVerify = inputMode === "otp" ? otpCode : recoveryCode.trim();
    
    if (!codeToVerify || !twoFactorData?.userId) {
      setError(inputMode === "otp" ? t("enterSixDigitCode") : t("enterBackupCode"));
      return;
    }

    // Validate OTP is 6 digits
    if (inputMode === "otp" && otpCode.length !== 6) {
      setError(t("enterSixDigitCode"));
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
        setError(result.error || t("invalidCodeTryAgain"));
      }
    } catch (err) {
      setError(t("tryAgain"));
    } finally {
      setIsLoading(false);
    }
  }, [inputMode, onSuccess, otpCode, recoveryCode, t, twoFactorData?.userId]);

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
      return t("enterRecoveryCodeSavedDuringSetup");
    }
    if (twoFactorData?.twoFactorMethod === "totp") {
      return t("enterCodeFromAuthenticator");
    }
    return twoFactorData?.email 
      ? t("enterCodeSentToEmailAddress", { email: twoFactorData.email })
      : t("enterCodeFromEmail");
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
              {t("twoFactorAuthentication")}
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
                {t("verify")}
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
                  {t("resendCode")}
                </Button>
              )}

              <Link
                as="button"
                size="sm"
                color="primary"
                onPress={toggleInputMode}
                className="mt-4"
              >
                {t("useRecoveryCode")}
              </Link>
            </div>
          ) : (
            /* Recovery Code Input Mode */
            <div className="flex flex-col items-center gap-4">
              <Input
                label={t("recoveryCode")}
                placeholder={t("recoveryCode")}
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
                {t("verify")}
              </Button>

              <Link
                as="button"
                size="sm"
                color="primary"
                onPress={toggleInputMode}
                className="mt-4"
              >
                {twoFactorData?.twoFactorMethod === "email" ? t("useEmailCode") : t("useAuthenticatorAppCode")}
              </Link>
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default memo(TwoFactorVerifyModal);
