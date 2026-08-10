"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { InputOtp } from "@heroui/input-otp";
import { Link } from "@heroui/link";
import { Spinner } from "@heroui/spinner";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { twoFactorService, TwoFactorLoginData } from "@/services/twoFactor.service";
import type { User } from "@/services/auth.service";
import { useI18n } from "@/hooks/useI18n";
import { getDefaultRouteForRole } from "@/lib/auth-routing";
import { buildPreferredLoginHref, consumePendingAuthReturnPath, peekPendingAuthReturnPath } from "@/lib/auth-resume";

type InputMode = "otp" | "recovery";

const AUTH_PAGE_SHELL = "flex min-h-screen flex-col bg-background p-3 text-foreground sm:p-4";
const AUTH_PAGE_CARD = "w-full max-w-md border border-slate-200 bg-white text-slate-900 shadow-2xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:shadow-zinc-950/50";

export default function VerifyTwoFactorPage() {
  const router = useRouter();
  const t = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [twoFactorData, setTwoFactorData] = useState<TwoFactorLoginData | null>(null);
  const emailSentRef = useRef(false);
  
  // Input states
  const [otpCode, setOtpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("otp");
  const [error, setError] = useState("");

  // Send email code for email 2FA
  const sendEmailCode = useCallback(async (userId: number, isResend = false) => {
    if (isSendingEmail || cooldown > 0) return;
    
    setIsSendingEmail(true);
    setError("");
    
    try {
      const result = await twoFactorService.sendLoginCode(userId);
      if (result.success) {
        setEmailSent(true);
        setCooldown(60); // 60 seconds cooldown
        if (isResend) {
          addToast({
            title: t("resendCodeSent"),
            description: t("resendCodeSentDescription"),
            color: "success",
            timeout: 3000,
                shouldShowTimeoutProgress: true,
          });
        }
      } else {
        setError(result.error || t("unableToSendCodeTryAgain"));
      }
    } catch {
      setError(t("pleaseTryAgain"));
    } finally {
      setIsSendingEmail(false);
    }
  }, [cooldown, isSendingEmail, t]);

  // Load 2FA data from sessionStorage on mount
  useEffect(() => {
    const storedData = sessionStorage.getItem("twoFactorData");
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData) as TwoFactorLoginData;
        setTwoFactorData(parsed);
        setIsLoading(false);
        
        // Auto-send email code for email 2FA (only once)
        if (parsed.twoFactorMethod === "email" && !emailSentRef.current) {
          emailSentRef.current = true;
          sendEmailCode(parsed.userId, false);
        }
      } catch {
        // Invalid data, redirect to login
        router.push("/login");
      }
    } else {
      // No 2FA data, redirect to login
      router.push("/login");
    }
  }, [router, sendEmailCode]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleVerify = useCallback(async (codeOverride?: string) => {
    if (!twoFactorData) return;

    const code = codeOverride || (inputMode === "otp" ? otpCode : recoveryCode);

    if (inputMode === "otp" && code.length !== 6) {
      setError(t("enterSixDigitCode"));
      return;
    }

    if (inputMode === "recovery" && !code.trim()) {
      setError(t("enterBackupCode"));
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const result = await twoFactorService.completeLogin(
        twoFactorData.userId,
        code
      );

      if (result.success && result.data) {
        // The backend's /auth/2fa/complete-login response already set the
        // httpOnly access/refresh cookies (plus the readable csrf_token) —
        // nothing to store client-side for the session itself. `user` isn't
        // a credential, just a display cache, so it still goes to localStorage.
        if (!result.data.user) {
          setError(t("pleaseTryAgain"));
          return;
        }

        // Clear stored 2FA data
        sessionStorage.removeItem("twoFactorData");

        if (typeof window !== "undefined") {
          localStorage.setItem("user", JSON.stringify(result.data.user));
        }

        const user = result.data.user as User;

        // Check if user must change password - store in sessionStorage and redirect
        if (result.data.mustChangePassword) {
          sessionStorage.setItem("mustChangePassword", "true");
          sessionStorage.setItem("pendingUser", JSON.stringify({ username: user.username, role: user.role }));
          router.push("/login?changePassword=true");
          return;
        }

        addToast({
          title: t("signInSuccessful"),
          description: t("welcomeUser", { username: user.username }),
          color: "success",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });

        // Redirect based on role
        router.push(consumePendingAuthReturnPath() || getDefaultRouteForRole(user.role));
      } else {
        setError(result.error || t("invalidCodeTryAgain"));
        if (inputMode === "otp") {
          setOtpCode("");
        }
      }
    } catch {
      setError(t("pleaseTryAgain"));
    } finally {
      setIsVerifying(false);
    }
  }, [twoFactorData, otpCode, recoveryCode, inputMode, router, t]);

  const toggleInputMode = () => {
    setInputMode(inputMode === "otp" ? "recovery" : "otp");
    setError("");
    setOtpCode("");
    setRecoveryCode("");
  };

  const handleBackToLogin = () => {
    sessionStorage.removeItem("twoFactorData");
    router.push(buildPreferredLoginHref(peekPendingAuthReturnPath()));
  };

  // Show loading spinner while checking session
  if (isLoading) {
    return (
      <div data-auth-shell="true" className={AUTH_PAGE_SHELL}>
        <div className="flex-1 flex items-center justify-center">
          <Card className={AUTH_PAGE_CARD}>
            <CardBody className="flex flex-col items-center py-12">
              <Spinner size="lg" color="primary" />
              <p className="mt-4 text-slate-500 dark:text-slate-400">{t("loading")}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div data-auth-shell="true" className={AUTH_PAGE_SHELL}>
      <div className="flex-1 flex items-center justify-center">
        <Card className={AUTH_PAGE_CARD}>
          <CardBody className="p-6 sm:p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center dark:bg-primary-500/20">
                <Icon
                  icon={twoFactorData?.twoFactorMethod === "totp" ? "solar:shield-keyhole-bold" : "solar:letter-bold"}
                  className="text-3xl text-primary"
                />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {t("twoFactorVerification")}
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                {twoFactorData?.twoFactorMethod === "totp"
                  ? t("enterCodeFromAuthenticator")
                  : t("enterCodeFromEmail")}
              </p>
            </div>

            {/* Input Section */}
            <div className="space-y-6">
              {inputMode === "otp" ? (
                <div className="flex flex-col items-center gap-4">
                  {/* Email sending status */}
                  {twoFactorData?.twoFactorMethod === "email" && (
                    <div className="w-full">
                      {isSendingEmail ? (
                        <div className="flex items-center justify-center gap-2 rounded-lg border border-primary-200 bg-primary-50 p-3 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300">
                          <Spinner size="sm" color="primary" />
                          <span className="text-sm">{t("sendingCodeToEmail")}</span>
                        </div>
                      ) : emailSent ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                          <p className="flex items-center justify-center gap-2 text-center text-sm text-emerald-700 dark:text-emerald-300">
                            <Icon icon="solar:check-circle-bold" className="text-lg" />
                            {t("codeSentToYourEmail")}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <InputOtp
                    length={6}
                    value={otpCode}
                    onValueChange={(value) => {
                      setOtpCode(value);
                      setError("");
                      // Auto-submit when 6 digits entered - pass value directly to avoid stale closure
                      if (value.length === 6) {
                        setTimeout(() => {
                          handleVerify(value);
                        }, 100);
                      }
                    }}
                    size="lg"
                    variant="bordered"
                    classNames={{
                      segment: "h-14 w-12 border-slate-300 bg-white text-xl text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
                    }}
                    isDisabled={isVerifying || (twoFactorData?.twoFactorMethod === "email" && isSendingEmail)}
                  />

                  {/* Resend email button for email 2FA */}
                  {twoFactorData?.twoFactorMethod === "email" && emailSent && (
                    <Button
                      variant="light"
                      size="sm"
                      onPress={() => sendEmailCode(twoFactorData.userId, true)}
                      isLoading={isSendingEmail}
                      isDisabled={cooldown > 0}
                      startContent={cooldown === 0 ? <Icon icon="solar:refresh-bold" className="text-lg" /> : null}
                    >
                      {cooldown > 0 ? t("resendCodeInSeconds", { seconds: cooldown }) : t("resendCode")}
                    </Button>
                  )}
                </div>
              ) : (
                <Input
                  label={t("recoveryCode")}
                  placeholder="XXXX-XXXX"
                  value={recoveryCode}
                  onValueChange={(v) => {
                    setRecoveryCode(v.toUpperCase());
                    setError("");
                  }}
                  size="lg"
                  variant="bordered"
                  classNames={{
                    input: "text-center font-mono tracking-wider text-slate-900 dark:text-slate-100",
                    inputWrapper: "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900",
                    label: "text-slate-700 dark:text-slate-300",
                  }}
                  isDisabled={isVerifying}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && recoveryCode.trim()) {
                      handleVerify();
                    }
                  }}
                />
              )}

              {/* Error Message */}
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
                  <p className="text-center text-sm text-rose-700 dark:text-rose-300">{error}</p>
                </div>
              )}

              {/* Verify Button */}
              <Button
                color="primary"
                size="lg"
                className="w-full font-semibold"
                onPress={() => handleVerify()}
                isLoading={isVerifying}
                isDisabled={inputMode === "otp" ? otpCode.length !== 6 : !recoveryCode.trim()}
                startContent={!isVerifying && <Icon icon="solar:shield-check-bold" className="text-lg" />}
              >
                {t("verify")}
              </Button>

              {/* Toggle Mode Link */}
              <div className="text-center">
                <Link
                  as="button"
                  size="sm"
                  onPress={toggleInputMode}
                  className="text-slate-600 hover:text-primary dark:text-slate-300"
                >
                  {inputMode === "otp"
                    ? t("useRecoveryCode")
                    : twoFactorData?.twoFactorMethod === "totp"
                      ? t("useAuthenticatorAppCode")
                      : t("useEmailCode")}
                </Link>
              </div>

              {/* Back to Login */}
              <div className="border-t border-slate-200 pt-4 text-center dark:border-slate-800">
                <Button
                  variant="light"
                  size="sm"
                  onPress={handleBackToLogin}
                  startContent={<Icon icon="solar:arrow-left-linear" />}
                >
                  {t("backToLogin")}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          LabTAS - {t("twoFactorAuthentication")}
        </p>
      </div>
    </div>
  );
}
