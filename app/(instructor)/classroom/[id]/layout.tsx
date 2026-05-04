import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ห้องเรียน",
  description: "ดูข้อมูลห้องเรียนและจัดการโต๊ะเรียน",
};

  export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false
  }

export default function ClassroomViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
