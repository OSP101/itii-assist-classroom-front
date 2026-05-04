"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/spinner";
import ProfilePage from "@/components/profile/ProfilePage";

function AdminProfileContent() {
  const router = useRouter();
  
  return (
    <ProfilePage 
      variant="admin" 
      onBack={() => router.push("/admin/dashboard")} 
    />
  );
}

export default function AdminProfilePage() {
  return (
    <div className="p-4 sm:p-6">
      <Suspense fallback={
        <div className="flex justify-center items-center min-h-[400px]">
          <Spinner size="lg" />
        </div>
      }>
        <AdminProfileContent />
      </Suspense>
    </div>
  );
}
