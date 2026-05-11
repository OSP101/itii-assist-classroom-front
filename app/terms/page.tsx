import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import { termsSections } from '@/config/support-content';

export const metadata: Metadata = {
    title: 'Terms of Use',
    description: 'ข้อกำหนดการใช้งาน ITII Assist Classroom สำหรับผู้ใช้ทุกบทบาท รวมถึงข้อห้ามและความรับผิดชอบพื้นฐาน',
};

export default function TermsPage() {
    return (
        <PublicPageShell
            eyebrow="Terms of Use"
            title="ข้อกำหนดการใช้งานที่ออกแบบให้ตรงกับบริบทของระบบเรียนการสอน"
            description="เอกสารนี้อธิบายเงื่อนไขพื้นฐานในการใช้งาน ITII Assist Classroom สำหรับนักศึกษา TA ผู้สอน และผู้ดูแลระบบ เพื่อให้ workflow ดำเนินไปอย่างปลอดภัยและเป็นธรรม"
            icon="solar:document-text-bold"
            backHref="/support"
            backLabel="กลับศูนย์ช่วยเหลือ"
            actions={
                <>
                    <Link href="/privacy" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                        ดูนโยบายความเป็นส่วนตัว
                    </Link>
                    <Link href="/cookies" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600">
                        ดูนโยบายคุกกี้
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-3">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Audience</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">นักศึกษา, TA, ผู้สอน, ผู้ดูแลระบบ</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">บทบาทต่างกัน แต่ใช้บริการร่วมกันในพื้นที่เดียว จึงต้องมีข้อตกลงที่ชัดเจน</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Published</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">10 พ.ค. 2026</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">การใช้งานต่อเนื่องหลังการเปลี่ยนแปลงนโยบายอาจถือเป็นการยอมรับฉบับล่าสุด</p>
                    </div>
                </div>
            }
        >
            <div className="space-y-5">
                {termsSections.map((section) => (
                    <section key={section.title} className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <div className="flex items-center gap-3">
                            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                                <Icon icon={section.icon} className="text-xl" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
                        </div>
                        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                            {section.items.map((item) => (
                                <li key={item} className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>

            <section className="mt-10 rounded-4xl border border-blue-200 bg-linear-to-r from-blue-50 via-white to-indigo-50 p-8">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">เอกสารนโยบายอื่นที่เกี่ยวข้อง</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">ข้อกำหนดการใช้งานควรอ่านควบคู่กับนโยบายความเป็นส่วนตัว นโยบายคุกกี้ และแนวทางแจ้งเหตุด้านความปลอดภัย</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Link href="/privacy" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                            Privacy Policy
                        </Link>
                        <Link href="/security" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-200 px-5 py-3 text-sm font-semibold text-blue-700">
                            Security
                        </Link>
                    </div>
                </div>
            </section>
        </PublicPageShell>
    );
}