"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@heroui/button";
import { addToast } from "@heroui/toast";
import { IoSchool } from "react-icons/io5";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { authService } from "@/services";
import { AppFooter } from "@/components/Footer";
import { useI18n } from "@/hooks/useI18n";
import { getDefaultRouteForRole, isStudentRole } from "@/lib/auth-routing";
import { normalizeAppReturnPath, storeOAuthReturnPath } from "@/lib/auth-resume";

const Turnstile = dynamic(
  () => import("@marsidev/react-turnstile").then((mod) => mod.Turnstile),
  { ssr: false },
);

function AppMark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-blue-600 text-2xl text-white shadow-sm shadow-sky-200 ${className}`}
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

export default function StudentLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useI18n();
  const nextPath = normalizeAppReturnPath(searchParams.get("next")) || "/student";
  const bypassTurnstile = process.env.NODE_ENV !== "production";
  const refTurnstile = useRef<TurnstileInstance>(null);
  const [turnstileKey, setTurnstileKey] = useState<string | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [turnstileReady, setTurnstileReady] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      addToast({
        title: t("signInFailed"),
        description: decodeURIComponent(error),
        color: "danger",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
      });
    }
  }, [searchParams, t]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await authService.getMe();
        if (!result.success || !result.user) {
          return;
        }

        if (isStudentRole(result.user.role)) {
          router.replace(nextPath);
          return;
        }

        router.replace(getDefaultRouteForRole(result.user.role));
      } catch {
        // stay on page
      }
    };

    checkAuth();
  }, [nextPath, router]);

  useEffect(() => {
    if (bypassTurnstile) {
      setTurnstileReady(true);
      setCanSubmit(true);
      return;
    }

    const key = process.env.NEXT_PUBLIC_CLOUD;
    if (key) {
      setTurnstileKey(key);
      setCanSubmit(false);
      return;
    }

    setTurnstileReady(true);
    setCanSubmit(true);
  }, [bypassTurnstile]);

  const handleGoogleLogin = () => {
    if (!bypassTurnstile && !canSubmit) {
      addToast({
        title: "ยืนยันตัวตนก่อนเข้าสู่ระบบ",
        description: "กรุณายืนยันว่าคุณไม่ใช่หุ่นยนต์",
        color: "warning",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
      });
      return;
    }

    storeOAuthReturnPath(nextPath);
    window.location.href = authService.getGoogleAuthUrl("student");
  };

  return (
    <div data-auth-shell="true" className="flex min-h-dvh flex-col bg-linear-to-b from-slate-50 via-white to-sky-50 text-foreground">
      <header className="flex h-20 items-center px-6 sm:px-10">
        <Link href="/" aria-label={t("itiiAssistClassroomHome")} className="inline-flex items-center">
          <AppMark />
        </Link>
      </header>

      <main className="flex w-full flex-1 flex-col items-center justify-start px-4 pb-6 pt-2 sm:min-h-[calc(100vh-128px)] sm:justify-center sm:px-6 sm:pb-16 sm:pt-8">
        <section className="w-full max-w-5xl overflow-hidden rounded-4xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)] shadow-slate-200/70">
          <div className="grid md:grid-cols-[1.02fr_0.98fr]">
            <div className="relative overflow-hidden bg-slate-100">
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pb-0 pt-5 sm:px-6 md:px-8">
                {/* <div className="rounded-full border border-white/70 bg-white/88 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-sky-700 backdrop-blur uppercase">
                  นักศึกษา
                </div> */}
              </div>

              <Image
                src="/images/cp-image-login.jpg"
                alt="ภาพเข้าสู่ระบบนักศึกษา"
                width={1200}
                height={900}
                priority
                className="h-72 w-full object-cover sm:h-84 md:h-full md:min-h-135"
              />

              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-slate-950/45 via-slate-950/8 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-6 md:p-8">
                <p className="text-[13px] font-medium tracking-[0.14em] text-white/80 uppercase">ITII Assist Classroom</p>
                <h2 className="mt-2 max-w-sm text-2xl font-semibold leading-tight sm:text-[28px]">
                  เข้าสู่ระบบนักศึกษา
                </h2>
              </div>
            </div>

            <div className="flex items-center bg-white px-5 py-6 sm:px-8 sm:py-8 md:px-10 md:py-10">
              <div className="w-full">
                <div className="mb-7 border-b border-slate-100 pb-5">
                  <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-slate-900 sm:text-[32px]">
                    ยินดีต้อนรับสู่ ITII Assist Classroom
                  </h1>
                  {/* <p className="mt-2 text-sm text-slate-500">
                    ITII Assist Classroom
                  </p> */}
                </div>

                <div className="mb-4">
                  <p className="mb-2 text-[14px] font-medium text-slate-600">ยืนยันว่าคุณไม่ใช่หุ่นยนต์</p>
                  <div className="w-full" suppressHydrationWarning>
                    {turnstileKey ? (
                      <Turnstile
                        id="student-turnstile"
                        ref={refTurnstile}
                        siteKey={turnstileKey}
                        onSuccess={() => {
                          setCanSubmit(true);
                          setTurnstileReady(true);
                        }}
                        onError={() => {
                          setCanSubmit(false);
                          setTurnstileReady(true);
                        }}
                        onExpire={() => {
                          setCanSubmit(false);
                        }}
                        onWidgetLoad={() => {
                          setTurnstileReady(true);
                        }}
                        options={{
                          theme: "auto",
                          size: "flexible",
                        }}
                      />
                    ) : !turnstileReady ? (
                      <div className="flex h-16.25 w-full items-center justify-between border border-blue-100 bg-blue-50/40 px-3">
                        <div className="flex items-center gap-3">
                          <span className="h-6 w-6 rounded-sm border-2 border-blue-300 bg-white" />
                          <span className="text-[14px] text-slate-700">ยืนยันว่าคุณไม่ใช่หุ่นยนต์</span>
                        </div>
                        <AppMark className="scale-75" />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <Button
                    type="button"
                    variant="bordered"
                    radius="sm"
                    className="h-11 border-blue-200 bg-white text-[15px] font-medium text-slate-700 shadow-sm shadow-slate-100 data-[hover=true]:border-blue-300 data-[hover=true]:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-55"
                    onPress={handleGoogleLogin}
                    startContent={<SocialIconGoogle />}
                    isDisabled={!bypassTurnstile && !canSubmit}
                  >
                    เข้าสู่ระบบด้วย Google
                  </Button>
                </div>

              </div>
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}