import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Attendance",
  description: "View real-time attendance activity.",
};

export default function AttendanceLiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
