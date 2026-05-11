import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import { getStatusLinkProps, statusLiveLink } from '@/config/status-provider';
import {
    securityChannels,
    securityDisclosureSteps,
    securitySafeHarbor,
} from '@/config/support-content';

export const metadata: Metadata = {
    title: 'Security Reporting',
    description: 'แนวทาง Responsible Disclosure และช่องทางแจ้งปัญหาความปลอดภัยของ ITII Assist Classroom',
};

const urgentExamples = [
    'พบว่าบัญชีถูกเข้าถึงโดยไม่ได้รับอนุญาตหรือ session มีพฤติกรรมผิดปกติ',
    'พบข้อมูลรายวิชาหรือข้อมูลผู้ใช้ที่ไม่ควรมองเห็นได้ตามสิทธิ์ปัจจุบัน',
    'พบช่องโหว่ที่อาจนำไปสู่การแก้ไขข้อมูล การยกระดับสิทธิ์ หรือการรั่วไหลของข้อมูล',
];

export default function SecurityPage() {
    return (
        <PublicPageShell
            eyebrow="Security Reporting"
            title="รายงานเหตุด้านความปลอดภัยอย่างรับผิดชอบ และให้ทีมงานตอบสนองได้เร็ว"
            description="ใช้หน้านี้สำหรับ account takeover, data exposure, privilege issues, abuse, หรือช่องโหว่ที่กระทบความเชื่อมั่นของระบบ โดยหลีกเลี่ยงการเปิดเผยสู่สาธารณะก่อนการประเมินความเสี่ยง"
            icon="solar:shield-warning-bold"
            backHref="/support"
            backLabel="กลับศูนย์ช่วยเหลือ"
            actions={
                <>
                    <Link href="/support/contact" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                        เปิดเคส Security
                    </Link>
                    <Link {...getStatusLinkProps()} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600">
                        {statusLiveLink.type === 'external' ? 'ติดตาม live status' : 'ติดตามสถานะสาธารณะ'}
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-3">
                    <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-red-700">For urgent issues</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">ใส่หัวข้อ [SECURITY]</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">ช่วยให้ทีมงานแยกเคสด้านความปลอดภัยออกจาก support ทั่วไปได้เร็วขึ้น</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Safe reporting</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">Private first, minimal impact</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">พิสูจน์ปัญหาเท่าที่จำเป็น หลีกเลี่ยงการเข้าถึงข้อมูลผู้อื่นหรือการกระทบต่อบริการจริง</p>
                    </div>
                </div>
            }
        >
            <section>
                <h2 className="text-2xl font-bold text-slate-900">ช่องทางรายงาน</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">เลือกช่องทางที่เหมาะกับความเร่งด่วนและระดับข้อมูลที่ต้องแนบ</p>
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    {securityChannels.map((channel) => (
                        <Link
                            key={channel.href}
                            href={channel.href}
                            target={channel.type === 'external' ? '_blank' : undefined}
                            rel={channel.type === 'external' ? 'noopener noreferrer' : undefined}
                            className="block rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 transition hover:border-blue-200"
                        >
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                                <Icon icon={channel.icon} className="text-2xl" />
                            </div>
                            <div className="mt-5 text-lg font-semibold text-slate-900">{channel.label}</div>
                            <div className="mt-1 text-sm font-medium text-blue-600">{channel.value}</div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{channel.note}</p>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                    <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                        <Icon icon="solar:steps-bold" className="text-2xl text-blue-500" />
                        Responsible disclosure process
                    </h2>
                    <div className="mt-5 space-y-3">
                        {securityDisclosureSteps.map((step, index) => (
                            <div key={step} className="flex items-start gap-4 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-blue-600 shadow-sm shadow-slate-200/50">
                                    {index + 1}
                                </div>
                                <p className="text-sm leading-6 text-slate-600">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:shield-check-bold" className="text-2xl text-blue-500" />
                            Safe harbor expectations
                        </h2>
                        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                            {securitySafeHarbor.map((item) => (
                                <li key={item} className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-4xl border border-red-200 bg-red-50/70 p-6 shadow-sm shadow-red-100/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:danger-triangle-bold" className="text-2xl text-red-500" />
                            ตัวอย่างเคสเร่งด่วน
                        </h2>
                        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
                            {urgentExamples.map((item) => (
                                <li key={item} className="flex items-start gap-3 rounded-3xl border border-red-200 bg-white/80 px-4 py-4">
                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-red-500" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>
        </PublicPageShell>
    );
}