import { Metadata } from "next";

export const metadata: Metadata = {
  title: "วิชาที่ปิดใช้งาน - ITII Assist Classroom",
  description: "รายวิชาที่คุณได้ปิดใช้งานไว้",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
}

export default function ClosedCoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
