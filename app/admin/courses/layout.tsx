import { Metadata } from "next";

export const metadata: Metadata = {
  title: "จัดการรายวิชา",
  description: "จัดการข้อมูลรายวิชาและการลงทะเบียน",
};

export default function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
