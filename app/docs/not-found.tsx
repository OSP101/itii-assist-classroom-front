import Link from "next/link";
import { Icon } from "@iconify/react";

export default function DocsNotFound() {
  return (
    <main className="min-h-screen bg-white px-4 py-16 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Icon icon="solar:document-add-broken" className="h-7 w-7" />
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-normal">ไม่พบบทความคู่มือ</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          บทความนี้อาจถูกย้าย เปลี่ยนชื่อ หรือยังไม่ได้เผยแพร่ สามารถกลับไปค้นหาคู่มือทั้งหมดหรือส่งคำถามให้ทีมสนับสนุนได้
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Icon icon="solar:magnifer-linear" className="h-4 w-4" />
            ค้นหาคู่มือ
          </Link>
          <Link
            href="/support/contact"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            <Icon icon="solar:chat-round-dots-bold-duotone" className="h-4 w-4" />
            ติดต่อทีมสนับสนุน
          </Link>
        </div>
      </div>
    </main>
  );
}
