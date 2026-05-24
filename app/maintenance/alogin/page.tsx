"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Icon } from "@iconify/react";
import { authService } from "@/services";
import { storePendingAuthReturnPath } from "@/lib/auth-resume";

export default function AdminBypassLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // If already logged in as admin, go straight to settings
  useEffect(() => {
    authService.getMe().then((result) => {
      if (result.success && result.user?.role === "admin") {
        clearMaintenanceCookie();
        router.replace("/admin/settings");
      }
    });
  }, [router]);

  function clearMaintenanceCookie() {
    document.cookie =
      "maintenance_active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await authService.login({ username, password });

      if (result.success && result.user) {
        if (result.user.role !== "admin") {
          authService.logout();
          setError("ไม่มีสิทธิ์เข้าถึง");
          setIsLoading(false);
          return;
        }
        clearMaintenanceCookie();
        router.replace("/admin/settings");
        return;
      }

      // Handle 2FA requirement
      if (result.requiresTwoFactor && result.twoFactorData) {
        sessionStorage.setItem("twoFactorData", JSON.stringify(result.twoFactorData));
        storePendingAuthReturnPath("/admin/settings");
        clearMaintenanceCookie();
        router.push("/auth/verify-2fa");
        return;
      }

      setError(result.error ?? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }

    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-2xl bg-white px-8 py-10 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-slate-600 to-slate-800 text-white shadow-sm">
            <Icon icon="solar:lock-keyhole-bold-duotone" className="text-2xl" />
          </div>
          <p className="text-sm text-slate-400">ระบุข้อมูลเพื่อดำเนินการต่อ</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="ชื่อผู้ใช้"
            value={username}
            onValueChange={setUsername}
            autoComplete="username"
            autoFocus
            variant="bordered"
            classNames={{ inputWrapper: "dark:border-slate-600" }}
          />
          <Input
            label="รหัสผ่าน"
            value={password}
            onValueChange={setPassword}
            type={isVisible ? "text" : "password"}
            autoComplete="current-password"
            variant="bordered"
            classNames={{ inputWrapper: "dark:border-slate-600" }}
            endContent={
              <button
                type="button"
                onClick={() => setIsVisible(!isVisible)}
                className="text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                <Icon
                  icon={isVisible ? "solar:eye-closed-bold" : "solar:eye-bold"}
                  className="text-lg"
                />
              </button>
            }
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          <Button
            type="submit"
            isLoading={isLoading}
            isDisabled={!username || !password}
            className="w-full bg-linear-to-r from-slate-700 to-slate-900 font-medium text-white"
          >
            ดำเนินการต่อ
          </Button>
        </form>
      </div>
    </div>
  );
}
