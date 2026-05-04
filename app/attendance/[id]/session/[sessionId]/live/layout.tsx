import { Metadata } from "next";

export const metadata: Metadata = {
  title: "เช็คชื่อ Live",
  description: "ดูการเช็คชื่อแบบ Realtime",
};

export default function AttendanceLiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
