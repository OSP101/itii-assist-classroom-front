import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'โปรไฟล์ของฉัน',
  description: 'จัดการโปรไฟล์และข้อมูลส่วนตัว',
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
