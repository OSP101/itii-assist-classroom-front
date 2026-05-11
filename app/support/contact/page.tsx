import type { Metadata } from 'next';
import { ContactSupportForm } from '@/components/support/contact-support-form';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';

export const metadata: Metadata = {
    title: 'ติดต่อทีมสนับสนุน',
    description: 'ส่งคำขอช่วยเหลือพร้อมบริบทที่ทีมงานใช้แก้ปัญหาได้ทันที ระบุหมวดปัญหา รายวิชา บทบาท และรายละเอียดที่เกี่ยวข้อง',
};
import {
    supportChecklist,
    supportGuideSections,
    supportResponseLanes,
} from '@/config/support-content';

const guideHrefById: Record<string, string> = {
    onboarding: '/docs/getting-started',
    assignments: '/docs/assignments',
    attendance: '/docs/attendance',
    queue: '/docs/queue-workflow',
    scores: '/docs/scores-appeals',
    account: '/docs/account-security',
    permissions: '/docs/browser-permissions',
    security: '/docs/security-reporting',
    troubleshooting: '/docs/troubleshooting-guide',
    roles: '/docs/role-permission-matrix',
    instructor: '/docs/instructor-end-to-end',
    ta: '/docs/ta-operations',
    student: '/docs/student-step-by-step',
};

function getGuideHref(id: string) {
    return guideHrefById[id] ?? '/docs';
}

export default function ContactSupportPage() {
    return (
        <PublicPageShell
            variant="landing"
            eyebrow="Contact Support"
            title="ส่งคำขอช่วยเหลือพร้อมบริบทที่ทีมงานใช้แก้ปัญหาได้ทันที"
            description="ระบุหมวดปัญหา รายวิชา บทบาท และรายละเอียดที่เกี่ยวข้องให้ครบ เพื่อให้ทีม support triage และตอบกลับได้แม่นยำขึ้น"
            icon="solar:chat-round-dots-bold"
            actions={
                <>
                    <Link href="/docs" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400">
                        เปิดคู่มือก่อนส่งเคส
                    </Link>
                    <Link href="/security" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20">
                        แจ้งเหตุด้านความปลอดภัย
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-3">
                    {supportResponseLanes.map((lane) => (
                        <div key={lane.title} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                            <div className="flex items-center gap-3">
                                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600">
                                    <Icon icon={lane.icon} className="text-xl" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">{lane.title}</div>
                                    <div className="text-xs text-slate-500">{lane.responseTime}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            }
        >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
                <div>
                    <ContactSupportForm />
                </div>

                <div className="space-y-6">
                    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                            <Icon icon="solar:checklist-bold" className="text-xl text-blue-500" />
                            Checklist ก่อนส่งคำขอ
                        </h3>
                        <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                            {supportChecklist.map((item) => (
                                <li key={item} className="flex items-start gap-3">
                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                            <Icon icon="solar:book-bookmark-bold" className="text-xl text-blue-500" />
                            ลองดูหัวข้อที่มักช่วยได้ทันที
                        </h3>
                        <div className="mt-4 space-y-3">
                            {supportGuideSections.slice(0, 4).map((guide) => (
                                <Link key={guide.id} href={getGuideHref(guide.id)} className="block rounded-3xl border border-slate-200 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/40">
                                    <div className="text-sm font-semibold text-slate-900">{guide.title}</div>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">{guide.summary}</p>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-4xl border border-blue-200 bg-linear-to-br from-blue-50 to-indigo-50 p-6 shadow-sm shadow-blue-100/50">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                            <Icon icon="solar:mailbox-bold" className="text-xl text-blue-500" />
                            ช่องทางเพิ่มเติม
                        </h3>
                        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                            <p><span className="font-medium text-slate-900">Email:</span> support@itii.ac.th</p>
                            <p><span className="font-medium text-slate-900">LINE:</span> @itii-classroom</p>
                            <p><span className="font-medium text-slate-900">Security:</span> ใช้หัวข้อ [SECURITY] เมื่อต้องการแจ้งเหตุที่มีผลกระทบด้านความปลอดภัย</p>
                        </div>
                    </div>
                </div>
            </div>
        </PublicPageShell>
    );
}
