import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "จองคิวตรวจงาน",
  description: "จองคิวตรวจงานสำหรับนักศึกษา",
};

/**
 * Booking a queue slot is a task the student came here to finish, so the shell
 * drops the site footer and fills the dynamic viewport — that lets the action
 * bar sit above the mobile browser's own toolbar instead of behind it.
 */
export default function BookQueueLayout({
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
