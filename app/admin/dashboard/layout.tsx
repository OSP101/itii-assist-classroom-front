import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ภาพรวม",
  description: "ภาพรวมระบบจัดการ ITII Assist Classroom",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
