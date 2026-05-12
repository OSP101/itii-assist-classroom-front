import { Metadata } from "next";

import { getRequestLanguage } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();

  return {
    title: language === "en" ? "My Courses" : "รายวิชาของฉัน",
    description: language === "en" ? "Courses you teach or assist." : "รายวิชาที่คุณสอนหรือช่วยสอน",
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ClassroomViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
