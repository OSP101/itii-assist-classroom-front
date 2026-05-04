import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'จัดการ Feedback - ITII Assist Classroom',
  description: 'รายงานข้อผิดพลาดและข้อเสนอแนะ',
};

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
