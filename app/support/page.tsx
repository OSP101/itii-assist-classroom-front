import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import { SupportCenterClient } from '@/components/support/SupportCenterClient';
import { getStatusLinkProps, statusLiveLink, statusProvider } from '@/config/status-provider';
import { supportHeroHighlights } from '@/config/support-content';

export const metadata: Metadata = {
    title: 'ศูนย์ช่วยเหลือ',
    description: statusProvider
        ? `ค้นหาคำตอบ อ่านคู่มือการใช้งาน ตรวจสอบสถานะระบบผ่าน ${statusProvider.name} และติดต่อทีมสนับสนุน ITII Assist Classroom ได้จากที่เดียว`
        : 'ค้นหาคำตอบจากคำถามที่พบบ่อย อ่านคู่มือการใช้งาน ตรวจสอบสถานะระบบ และติดต่อทีมสนับสนุน ITII Assist Classroom ได้จากที่เดียว',
};

export default function SupportPage() {
    return (
        <PublicPageShell
            variant="landing"
            eyebrow="Help Center"
            title="ศูนย์ช่วยเหลือ ITII Assist Classroom"
            description={
                statusProvider
                    ? `ค้นหาคำตอบจากคำถามที่พบบ่อย อ่านคู่มือรายหัวข้อ ตรวจสอบสถานะระบบผ่าน ${statusProvider.name} หรือส่งคำขอถึงทีมสนับสนุนได้จากที่นี่`
                    : 'ค้นหาคำตอบจากคำถามที่พบบ่อย อ่านคู่มือรายหัวข้อ ตรวจสอบสถานะระบบ หรือส่งคำขอถึงทีมสนับสนุนได้จากที่นี่'
            }
            icon="solar:question-circle-bold"
            actions={
                <>
                    <Link href="/docs" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400">
                        อ่านคู่มือการใช้งาน
                    </Link>
                    <Link
                        {...getStatusLinkProps()}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                    >
                        {statusLiveLink.type === 'external' ? 'ดูสถานะระบบสด' : 'ตรวจสอบสถานะระบบ'}
                    </Link>
                    <Link href="/support/contact" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:text-white">
                        ติดต่อทีมสนับสนุน
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-slate-900">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <Icon icon="solar:shield-check-bold" className="text-2xl" />
                        </div>
                        <div>
                            <p className="text-lg font-semibold">ศูนย์ช่วยเหลือสาธารณะ</p>
                            <p className="text-sm text-slate-500">
                                {statusProvider
                                    ? `ออกแบบให้ค้นหาคำตอบและส่งต่อปัญหาได้รวดเร็ว พร้อมเชื่อมต่อกับ ${statusProvider.name} เมื่อต้องติดตามเหตุขัดข้องแบบสด`
                                    : 'ออกแบบให้ค้นหาคำตอบและส่งต่อปัญหาได้รวดเร็วตามขั้นตอนที่ชัดเจน'}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {supportHeroHighlights.map((highlight) => (
                            <div key={highlight.label} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                                <div className="text-[11px] font-medium uppercase tracking-widest text-slate-400">{highlight.label}</div>
                                <div className="mt-1 text-base font-semibold text-slate-900">{highlight.value}</div>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{highlight.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            }
        >
            <SupportCenterClient />
        </PublicPageShell>
    );
}
