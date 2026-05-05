import { Metadata } from 'next';
import { AppFooter } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'โปรไฟล์ของฉัน',
  description: 'จัดการโปรไฟล์และข้อมูลส่วนตัว',
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}
