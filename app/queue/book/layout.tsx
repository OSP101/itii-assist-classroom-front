import type { Metadata } from "next";
import { AppFooter } from "@/components/Footer";

export const metadata: Metadata = {
  title: "จองคิวตรวจงาน",
  description: "จองคิวตรวจงานสำหรับนักศึกษา",
};

export default function BookQueueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}
