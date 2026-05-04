import { Metadata } from "next";

export const metadata: Metadata = {
  title: "รายวิชาของฉัน",
  description: "รายวิชาของฉันในฐานะผู้สอน",
};

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
