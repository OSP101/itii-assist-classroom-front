import { Metadata } from "next";

export const metadata: Metadata = {
  title: "เช็กชื่อเข้าเรียน",
  description: "เช็กชื่อเข้าเรียนสำหรับนักศึกษา",
};

/**
 * Check-in is a task the student came here to finish, not a place to browse:
 * no site footer, and the shell fills the dynamic viewport so the action bar
 * can sit above the mobile browser's own toolbar.
 */
export default function CheckInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-theme-scope="student" className="cg-scope app-mobile-screen">
      <div className="app-mobile-scroll mx-auto w-full max-w-2xl px-4 app-safe-x">{children}</div>
    </div>
  );
}
