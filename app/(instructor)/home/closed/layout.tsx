import { Metadata } from "next";

import { getRequestLanguage } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();

  return {
    title: language === "en" ? "Closed Courses" : "วิชาที่ปิดใช้งาน",
    description: language === "en" ? "Courses you have disabled and can restore." : "รายวิชาที่คุณปิดใช้งานไว้และสามารถเปิดใช้งานอีกครั้งได้",
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ClosedCoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
