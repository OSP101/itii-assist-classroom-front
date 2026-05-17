import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/Footer";

export const metadata: Metadata = {
  title: "จองคิวตรวจงาน",
  description: "จองคิวตรวจงานสำหรับนักศึกษา",
};

export default function BookQueueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Floating home button */}
      <Link
        href="/student"
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 text-sm font-semibold text-sky-600 shadow-md shadow-sky-300/30 backdrop-blur border border-slate-200/70 transition active:scale-95 hover:bg-white"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M10.55 2.532a2.25 2.25 0 0 1 2.9 0l6.75 5.692c.507.428.8 1.057.8 1.72v9.306a1.75 1.75 0 0 1-1.75 1.75H15a1.75 1.75 0 0 1-1.75-1.75v-3.5a1.25 1.25 0 1 0-2.5 0v3.5A1.75 1.75 0 0 1 9 20.75H4.75A1.75 1.75 0 0 1 3 19v-9.056c0-.663.293-1.292.8-1.72z"/></svg>
        หน้าหลัก
      </Link>
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}
