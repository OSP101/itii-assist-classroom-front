"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/spinner";
import ProfilePage from "@/components/profile/ProfilePage";

function ProfileContent() {
  const router = useRouter();
  
  return (
    <ProfilePage 
      variant="user" 
      onBack={() => router.back()} 
    />
  );
}

export default function UserProfilePage() {
  return (
    <div className="min-h-screen bg-default-50">
      <div className="container mx-auto py-6 sm:py-8 px-4">
        <Suspense fallback={
          <div className="flex justify-center items-center min-h-[400px]">
            <Spinner size="lg" />
          </div>
        }>
          <ProfileContent />
        </Suspense>
      </div>
    </div>
  );
}
