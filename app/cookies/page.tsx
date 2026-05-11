import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import { cookieSections } from '@/config/support-content';

export const metadata: Metadata = {
    title: 'Cookie Policy',
    description: 'นโยบายคุกกี้ของ ITII Assist Classroom สำหรับ session การตั้งค่า และกลไกด้านความปลอดภัยที่จำเป็นต่อการให้บริการ',
};

const managementTips = [
    'เปิดใช้งานคุกกี้ที่จำเป็นสำหรับโดเมนของระบบนี้เพื่อให้การเข้าสู่ระบบและ session ทำงานได้ถูกต้อง',
    'หากล้าง browser storage บ่อย ควรเตรียมพร้อมสำหรับการเข้าสู่ระบบใหม่และการยืนยันตัวตนเพิ่มเติม',
    'หากหน้า login หรือแบบฟอร์มสาธารณะติด challenge ซ้ำ ให้ตรวจสอบส่วนขยายหรือการตั้งค่าความเป็นส่วนตัวของ browser ที่อาจบล็อก storage สำคัญ',
];

export default function CookiesPage() {
    return (
        <PublicPageShell
            eyebrow="Cookie Policy"
            title="คุกกี้และ storage ถูกใช้เท่าที่จำเป็นต่อ session ความปลอดภัย และประสบการณ์ใช้งาน"
            description="เอกสารนี้อธิบายการใช้ข้อมูลฝั่ง browser สำหรับการยืนยันตัวตน การป้องกัน abuse และการตั้งค่าที่จำเป็นต่อการใช้งาน ITII Assist Classroom"
            icon="solar:cookie-bold"
            backHref="/support"
            backLabel="กลับศูนย์ช่วยเหลือ"
            actions={
                <>
                    <Link href="/privacy" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                        ดู Privacy Policy
                    </Link>
                    <Link href="/support/contact" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600">
                        ขอความช่วยเหลือ
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-3">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Core purpose</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">Session + Security + Preferences</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">เราออกแบบให้ใช้ storage ฝั่ง browser เท่าที่จำเป็นต่อความเสถียรและความปลอดภัยของระบบ</p>
                    </div>
                </div>
            }
        >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-5">
                    {cookieSections.map((section) => (
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

                <div className="space-y-6">
                    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:settings-bold" className="text-2xl text-blue-500" />
                            คำแนะนำในการจัดการ browser
                        </h2>
                        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                            {managementTips.map((tip) => (
                                <li key={tip} className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <span>{tip}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="rounded-4xl border border-blue-200 bg-linear-to-br from-blue-50 to-indigo-50 p-6 shadow-sm shadow-blue-100/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:shield-keyhole-bold" className="text-2xl text-blue-500" />
                            ปัญหา login หรือ verification
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-slate-600">หาก browser บล็อก storage ที่จำเป็น หน้า login อาจทำงานไม่ครบหรือ challenge อาจแสดงซ้ำได้ ในกรณีดังกล่าวให้ลองปิดส่วนขยายที่เกี่ยวกับ privacy ชั่วคราวสำหรับโดเมนนี้หรือเปิดเคสกับทีม support</p>
                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                            <Link href="/support/contact" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                                ติดต่อทีมสนับสนุน
                            </Link>
                            <Link href="/privacy" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-200 px-5 py-3 text-sm font-semibold text-blue-700">
                                อ่าน Privacy เพิ่มเติม
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </PublicPageShell>
    );
}