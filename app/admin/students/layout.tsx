import { Metadata } from "next";

export const metadata: Metadata = {
  title: "จัดการนักศึกษา",
  description: "จัดการข้อมูลนักศึกษาในระบบ",
};

export default function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
