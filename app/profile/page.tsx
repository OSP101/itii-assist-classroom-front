"use client";

import { useRouter } from "next/navigation";
import ProfilePage from "@/components/profile/ProfilePage";

export default function UserProfilePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-default-50">
      <div className="container mx-auto py-6 sm:py-8 px-4">
        <ProfilePage variant="user" onBack={() => router.back()} />
      </div>
    </div>
  );
}
