"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/spinner";
import { IoSchool } from "react-icons/io5";
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
        <div className="w-15 h-15 bg-linear-to-br from-blue-400 to-indigo-500 rounded flex items-center justify-center text-white text-4xl">
          <IoSchool />
        </div>
        <Spinner size="lg" color="primary" />
      </div>
    </div>
  );
}
