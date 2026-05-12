import { Metadata } from "next";

import { getRequestLanguage } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();

  return {
    title: language === "en" ? "Classroom" : "ห้องเรียน",
    description: language === "en"
      ? "View course details and classroom workflows."
      : "ดูข้อมูลรายวิชาและ workflow ภายในห้องเรียน",
  };
}

  export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false
  }

export default function ClassroomViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
