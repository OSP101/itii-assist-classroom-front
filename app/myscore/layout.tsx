import { Metadata } from "next";

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
  return children;
}
