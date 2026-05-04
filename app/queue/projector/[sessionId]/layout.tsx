import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "หน้าจอแสดงผลคิว",
  description: "หน้าจอแสดงผังห้องและสถานะคิวสำหรับโปรเจคเตอร์",
};

export default function ProjectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-900">
      {children}
    </div>
  );
}
