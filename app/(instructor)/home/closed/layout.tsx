import { Metadata } from "next";

import { getRequestLanguage } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getRequestLanguage();

  return {
    title:
      language === "en"
        ? "Closed Courses"
        : "\u0e23\u0e32\u0e22\u0e27\u0e34\u0e0a\u0e32\u0e17\u0e35\u0e48\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19",
    description:
      language === "en"
        ? "Courses you have disabled and can restore."
        : "\u0e23\u0e32\u0e22\u0e27\u0e34\u0e0a\u0e32\u0e17\u0e35\u0e48\u0e04\u0e38\u0e13\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e44\u0e27\u0e49 \u0e41\u0e25\u0e30\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07\u0e44\u0e14\u0e49",
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
