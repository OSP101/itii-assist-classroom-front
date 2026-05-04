import { Metadata } from "next";

export const metadata: Metadata = {
  title: "จัดการห้องเรียน",
  description: "จัดการข้อมูลห้องเรียนและโต๊ะเรียน",
};

export default function ClassroomsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
