"use client";

import { useRouter } from "next/navigation";
import ProfilePage from "@/components/profile/ProfilePage";

export default function AdminProfilePage() {
  const router = useRouter();

  return (
    <div className="p-4 sm:p-6">
      <ProfilePage variant="admin" onBack={() => router.push("/admin/dashboard")} />
    </div>
  );
}
