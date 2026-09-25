"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { addToast } from "@heroui/toast";
import { authService } from "@/services";
import { useI18n } from "@/hooks/useI18n";
import { getDefaultRouteForRole, isStudentRole } from "@/lib/auth-routing";
import { normalizeAppReturnPath, storeOAuthReturnPath } from "@/lib/auth-resume";
import { LEGACY_SOCIAL_LOGIN_ENABLED } from "@/lib/auth-providers";
import { useLoginProviderMode } from "@/hooks/useLoginProviderMode";
import { KKUSSOHeroButton } from "@/components/auth/KKUSSOButton";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { LoginShell } from "@/components/auth/LoginShell";

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
  const loginProviderMode = useLoginProviderMode();
  const nextPath = normalizeAppReturnPath(searchParams.get("next")) || "/student";

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

  const handleGoogleLogin = () => {
    storeOAuthReturnPath(nextPath);
    window.location.href = authService.getGoogleAuthUrl("student");
  };

  const handleKKULogin = () => {
    storeOAuthReturnPath(nextPath);
    window.location.href = authService.getKKUAuthUrl('student');
  };

  return (
    <LoginShell
      title={t("studentSignIn")}
      subtitle={t("studentLoginSubtitle")}
      switchHref="/login"
      switchLabel={t("instructorSignIn")}
    >
      <div className="flex flex-col gap-4">
        {loginProviderMode === null ? (
          // ยังไม่รู้ hostname (รอบ hydrate แรก) กันปุ่มกระพริบสลับช่องทาง
          <div className="h-14 w-full animate-pulse rounded-xl bg-default-100" />
        ) : loginProviderMode === "kku" ? (
          <KKUSSOHeroButton
            onPress={handleKKULogin}
            label={t("loginWithKKUAccount")}
            description={t("kkuAccountHint")}
          />
        ) : (
          <GoogleSignInButton onPress={handleGoogleLogin} />
        )}

        {LEGACY_SOCIAL_LOGIN_ENABLED ? (
          <Button
            type="button"
            variant="bordered"
            radius="sm"
            className="h-10.5 w-full border-default-200 text-[15px] font-medium"
            onPress={handleGoogleLogin}
            startContent={<SocialIconGoogle />}
          >
            เข้าสู่ระบบด้วย Google
          </Button>
        ) : null}
      </div>
    </LoginShell>
  );
}
