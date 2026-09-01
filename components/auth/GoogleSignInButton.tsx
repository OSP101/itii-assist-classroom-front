"use client";

// ปุ่มเข้าสู่ระบบด้วย Google ใช้เป็นช่องทางหลักของโดเมนสำรอง (Cloudflare Tunnel)
// ที่ใช้ KKU SSO ไม่ได้ เพราะ Redirect Login URL ผูกกับโดเมนของมหาวิทยาลัย
// ดูเหตุผลเต็มที่ lib/auth-providers.ts

import { Button } from "@heroui/button";

interface GoogleSignInButtonProps {
  onPress: () => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  className?: string;
}

export function GoogleLogoMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function GoogleSignInButton({
  onPress,
  size = "md",
  fullWidth = true,
  isLoading = false,
  isDisabled = false,
  className = "",
}: GoogleSignInButtonProps) {
  const isCompact = size === "sm";

  return (
    <Button
      type="button"
      variant="bordered"
      radius="sm"
      size={isCompact ? "sm" : "md"}
      isLoading={isLoading}
      isDisabled={isDisabled}
      className={[
        isCompact ? "h-9 px-3 text-[13px]" : "h-10.5 text-[15px]",
        fullWidth ? "w-full" : "",
        "shrink-0 whitespace-nowrap border-blue-200 bg-white font-medium text-slate-700 data-[hover=true]:border-blue-300 data-[hover=true]:bg-blue-50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onPress={onPress}
      startContent={isLoading ? null : <GoogleLogoMark className={isCompact ? "h-4 w-4" : "h-4.5 w-4.5"} />}
    >
      Login with Google Account
    </Button>
  );
}

export default GoogleSignInButton;
