import { Metadata } from "next";
import { AppFooter } from "@/components/Footer";

export const metadata = {
  title: "ค้นหาคะแนนรายบุคคล",
  description: "ตรวจสอบคะแนนเก็บและความคืบหน้าการเรียนของคุณได้ทันที",
  image: "/cp-image-login.jpg",
};

  export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false
  }

export default function MyscoreViewLayout({
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
