import { Metadata } from "next";

export const metadata: Metadata = {
  title: "สรุปการเช็คชื่อ",
  description: "ดูสรุปผลการเช็คชื่อของนักศึกษา",
};

export default function AttendanceSummaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
