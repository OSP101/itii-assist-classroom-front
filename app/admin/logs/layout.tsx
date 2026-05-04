import { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Logs",
  description: "ดูประวัติการใช้งานและ Log ของระบบ",
};

export default function LogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
