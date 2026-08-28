import { Metadata } from "next";

export const metadata: Metadata = {
  title: "สรุปการเช็กชื่อ",
  description: "ดูสรุปผลการเช็กชื่อของนักศึกษา",
};

export default function AttendanceSummaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
