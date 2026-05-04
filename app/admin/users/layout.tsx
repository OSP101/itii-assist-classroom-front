import { Metadata } from "next";

export const metadata: Metadata = {
  title: "จัดการผู้ใช้งาน",
  description: "จัดการข้อมูลผู้ใช้งานระบบ Admin, Instructor, TA",
};

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
