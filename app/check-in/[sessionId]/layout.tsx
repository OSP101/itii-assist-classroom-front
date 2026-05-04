import { Metadata } from "next";

export const metadata: Metadata = {
  title: "เช็คชื่อเข้าเรียน",
  description: "เช็คชื่อเข้าเรียนสำหรับนักศึกษา",
};

export default function CheckInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
