"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/spinner";
import { IoSchool } from "react-icons/io5";
import { authService } from "@/services/auth.service";

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/login");
          return;
        }

        const user = await authService.getCurrentUser();
        
        if (!user) {
          router.push("/login");
          return;
        }

        switch (user.role) {
          case "admin":
            router.push("/admin/dashboard");
            break;
          case "instructor":
          case "ta":
            router.push("/home");
            break;
          default:
            router.push("/login");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
      } finally {
        setIsChecking(false);
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
