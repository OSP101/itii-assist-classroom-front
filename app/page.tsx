"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Spinner } from "@heroui/spinner";
import { authService } from "@/services/auth.service";
import { getDefaultRouteForRole } from "@/lib/auth-routing";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.replace("/login");
          return;
        }

        // Redirect immediately from locally persisted profile to avoid
        // an extra /api/me roundtrip on slow mobile networks.
        const storedUser = authService.getStoredUser();
        if (storedUser) {
          router.replace(getDefaultRouteForRole(storedUser.role));
          void authService.getCurrentUser().catch(() => {
            // Ignore background validation errors; destination screens
            // already handle unauthenticated state.
          });
          return;
        }

        const user = await authService.getCurrentUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        router.replace(getDefaultRouteForRole(user.role));
      } catch (error) {
        console.error("Auth check failed:", error);
        router.replace("/login");
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 via-sky-50 to-indigo-100">
      <div className="flex flex-col items-center gap-4">
        <Image
          src="/images/logo-cp.png"
          alt="ITII Assist Classroom"
          width={60}
          height={60}
          priority
          className="h-15 w-15 rounded object-contain"
        />
        <Spinner size="lg" color="primary" />
      </div>
    </div>
  );
}
