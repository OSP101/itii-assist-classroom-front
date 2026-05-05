import { Metadata } from "next";
import { AppFooter } from "@/components/Footer";

export const metadata: Metadata = {
  title: "เช็คชื่อเข้าเรียน",
  description: "เช็คชื่อเข้าเรียนสำหรับนักศึกษา",
};

export default function CheckInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}
