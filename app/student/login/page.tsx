"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@heroui/button";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
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

export default function StudentLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useI18n();
  const nextPath = normalizeAppReturnPath(searchParams.get("next")) || "/student";
  const refTurnstile = useRef<TurnstileInstance>(null);
  const [turnstileKey, setTurnstileKey] = useState<string | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);

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
    const key = process.env.NEXT_PUBLIC_CLOUD ?? null;

    setCanSubmit(false);
    setTurnstileReady(false);
    setTurnstileKey(key);
    setWidgetInstanceKey((current) => current + 1);

    if (!key) {
      addToast({
        title: "Turnstile ยังไม่พร้อมใช้งาน",
        description: "ยังไม่ได้ตั้งค่า site key สำหรับการยืนยันตัวตน",
        color: "warning",
        timeout: 4000,
        shouldShowTimeoutProgress: true,
      });
    }
  }, []);

  const handleGoogleLogin = () => {
    if (!canSubmit) {
      addToast({
        title: "ยืนยันตัวตนก่อนเข้าสู่ระบบ",
        description: "กรุณายืนยันว่าคุณไม่ใช่บอท",
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
    <div data-auth-shell="true" className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex h-20 items-center justify-between bg-transparent px-6 max-sm:bg-transparent dark:max-sm:bg-slate-950 sm:px-10">
        <Link href="/" aria-label={t("itiiAssistClassroomHome")} className="inline-flex items-center">
          <AppMark />
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:max-sm:border-white/12 dark:max-sm:bg-white/8 dark:max-sm:text-slate-100 dark:max-sm:hover:border-sky-400/45 dark:max-sm:hover:bg-sky-400/10 dark:sm:text-slate-700"
        >
          <span>เข้าสู่ระบบผู้สอน</span>
          <Icon icon="solar:arrow-right-linear" className="text-base" />
        </Link>
      </header>

      <main className="flex w-full flex-1 flex-col items-center justify-start bg-transparent px-5 pb-6 pt-4 max-sm:bg-transparent dark:max-sm:bg-slate-950 sm:min-h-[calc(100vh-128px)] sm:justify-center sm:px-6 sm:pb-16 sm:pt-10">
        <section className="w-full max-w-112.5 bg-transparent px-2 py-4 max-sm:border-0 max-sm:shadow-none dark:max-sm:bg-transparent sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white sm:px-12 sm:py-12 sm:shadow-sm sm:shadow-slate-200/60 dark:sm:shadow-zinc-950/50">
          <div className="mb-7">
            <h1 className="text-[25px] font-semibold leading-tight tracking-[-0.01em] text-slate-800 dark:max-sm:text-white">
              เข้าสู่ระบบนักศึกษา
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:max-sm:text-slate-300">
              ใช้บัญชี KKUMail ของนักศึกษาเพื่อเข้าสู่ระบบ ITII Assist Classroom
            </p>
          </div>

          <div className="space-y-4">
            <Button
              type="button"
              variant="bordered"
              radius="sm"
              className="h-10.5 w-full border-blue-200 bg-white text-[15px] font-medium text-slate-700 data-[hover=true]:border-blue-300 data-[hover=true]:bg-blue-50 dark:max-sm:border-white/12 dark:max-sm:bg-white/8 dark:max-sm:text-white dark:max-sm:data-[hover=true]:border-sky-400/45 dark:max-sm:data-[hover=true]:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-55"
              onPress={handleGoogleLogin}
              startContent={<SocialIconGoogle />}
              isDisabled={!canSubmit}
            >
              เข้าสู่ระบบด้วย Google
            </Button>

            <div className="pt-1">
              <p className="mb-2 text-[14px] font-medium text-slate-600 dark:max-sm:text-slate-200 dark:sm:text-slate-700">
                ยืนยันว่าคุณไม่ใช่บอท
              </p>
              <div className="w-full" suppressHydrationWarning>
                {turnstileKey ? (
                  <Turnstile
                    key={widgetInstanceKey}
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
                      refTurnstile.current?.reset();
                    }}
                    onExpire={() => {
                      setCanSubmit(false);
                      refTurnstile.current?.reset();
                    }}
                    onWidgetLoad={() => {
                      setCanSubmit(false);
                      setTurnstileReady(true);
                    }}
                    options={{
                      theme: "auto",
                      size: "flexible",
                      retry: "never",
                      refreshExpired: "manual",
                      refreshTimeout: "manual",
                    }}
                  />
                ) : !turnstileReady ? (
                  <div className="flex h-16.25 w-full items-center justify-between border border-blue-100 bg-blue-50/40 px-3 dark:max-sm:border-white/12 dark:max-sm:bg-white/8">
                    <div className="flex items-center gap-3">
                      <span className="h-6 w-6 rounded-sm border-2 border-blue-300 bg-white dark:max-sm:border-sky-300/50 dark:max-sm:bg-slate-950" />
                      <span className="text-[14px] text-slate-700 dark:max-sm:text-slate-100">กำลังเตรียมการยืนยันตัวตน</span>
                    </div>
                    <AppMark className="scale-75" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:max-sm:border-amber-400/30 dark:max-sm:bg-amber-500/10 dark:max-sm:text-amber-100">
                    ไม่พบการตั้งค่า Turnstile site key จึงยังไม่สามารถเปิดปุ่มเข้าสู่ระบบได้
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
