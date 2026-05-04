import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'โปรไฟล์ - ITII Assist Classroom',
  description: 'จัดการโปรไฟล์และข้อมูลส่วนตัว',
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
