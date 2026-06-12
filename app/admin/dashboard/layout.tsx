import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ภาพรวม",
  description: "ภาพรวมระบบจัดการ LabTAS",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
