import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import { SupportCenterClient } from '@/components/support/SupportCenterClient';
import { getStatusLinkProps, statusLiveLink, statusProvider } from '@/config/status-provider';
import { getRequestLanguage } from '@/lib/server-i18n';

function getSupportPageCopy(language: 'th' | 'en') {
    if (language === 'en') {
        return {
            metadataTitle: 'Help Center',
            metadataDescription: statusProvider
                ? `Find answers, read guides, check system status through ${statusProvider.name}, and contact the ITII Assist Classroom support team from one place.`
                : 'Find answers, read guides, check system status, and contact the ITII Assist Classroom support team from one place.',
            eyebrow: 'Help Center',
            title: 'ITII Assist Classroom Help Center',
            description: statusProvider
                ? `Find answers in the FAQ, read task-based guides, check system status through ${statusProvider.name}, or send a request to the support team from here.`
                : 'Find answers in the FAQ, read task-based guides, check system status, or send a request to the support team from here.',
            readGuides: 'Read the guides',
            viewLiveStatus: 'View live system status',
            checkStatus: 'Check system status',
            contactSupport: 'Contact support',
            publicCenterTitle: 'Public help center',
            publicCenterDescription: statusProvider
                ? `Designed to help users find answers quickly and route issues clearly, with direct links to ${statusProvider.name} for live incident updates.`
                : 'Designed to help users find answers quickly and route issues clearly through a straightforward support flow.',
            highlights: [
                {
                    label: 'First response target',
                    value: 'Within 1 business day',
                    description: 'General cases receive an initial reply by email or through the contact channel provided by the requester.',
                },
                {
                    label: 'Coverage',
                    value: 'Assignments, attendance, queues, scores',
                    description: 'Covers the main workflows used by students, TAs, and instructors in the classroom.',
                },
                {
                    label: 'Escalation',
                    value: 'Support + Security',
                    description: 'Uses separate paths for general platform issues and security-sensitive incidents.',
                },
            ],
        };
    }

    return {
        metadataTitle: 'ศูนย์ช่วยเหลือ',
        metadataDescription: statusProvider
            ? `ค้นหาคำตอบ อ่านคู่มือการใช้งาน ตรวจสอบสถานะระบบผ่าน ${statusProvider.name} และติดต่อทีมสนับสนุน ITII Assist Classroom ได้จากที่เดียว`
            : 'ค้นหาคำตอบจากคำถามที่พบบ่อย อ่านคู่มือการใช้งาน ตรวจสอบสถานะระบบ และติดต่อทีมสนับสนุน ITII Assist Classroom ได้จากที่เดียว',
        eyebrow: 'ศูนย์ช่วยเหลือ',
        title: 'ศูนย์ช่วยเหลือ ITII Assist Classroom',
        description: statusProvider
            ? `ค้นหาคำตอบจากคำถามที่พบบ่อย อ่านคู่มือรายหัวข้อ ตรวจสอบสถานะระบบผ่าน ${statusProvider.name} หรือส่งคำขอถึงทีมสนับสนุนได้จากที่นี่`
            : 'ค้นหาคำตอบจากคำถามที่พบบ่อย อ่านคู่มือรายหัวข้อ ตรวจสอบสถานะระบบ หรือส่งคำขอถึงทีมสนับสนุนได้จากที่นี่',
        readGuides: 'อ่านคู่มือการใช้งาน',
        viewLiveStatus: 'ดูสถานะระบบสด',
        checkStatus: 'ตรวจสอบสถานะระบบ',
        contactSupport: 'ติดต่อทีมสนับสนุน',
        publicCenterTitle: 'ศูนย์ช่วยเหลือสาธารณะ',
        publicCenterDescription: statusProvider
            ? `ออกแบบให้ค้นหาคำตอบและส่งต่อปัญหาได้รวดเร็ว พร้อมเชื่อมต่อกับ ${statusProvider.name} เมื่อต้องติดตามเหตุขัดข้องแบบสด`
            : 'ออกแบบให้ค้นหาคำตอบและส่งต่อปัญหาได้รวดเร็วตามขั้นตอนที่ชัดเจน',
        highlights: [
            {
                label: 'เป้าหมายเวลาตอบกลับครั้งแรก',
                value: 'ภายใน 1 วันทำการ',
                description: 'เคสทั่วไปจะได้รับการตอบกลับครั้งแรกทางอีเมลหรือช่องทางที่ผู้ใช้ระบุ',
            },
            {
                label: 'ขอบเขตการช่วยเหลือ',
                value: 'งาน, เช็คชื่อ, คิว, คะแนน',
                description: 'ครอบคลุม workflow หลักของนักศึกษา, TA, และผู้สอนในห้องเรียน',
            },
            {
                label: 'การส่งต่อเหตุ',
                value: 'ซัพพอร์ต + ความปลอดภัย',
                description: 'มีแยกเส้นทางสำหรับเหตุขัดข้องทั่วไปและประเด็นด้านความปลอดภัยของระบบ',
            },
        ],
    };
}

export async function generateMetadata(): Promise<Metadata> {
    const language = await getRequestLanguage();
    const copy = getSupportPageCopy(language);

    return {
        title: copy.metadataTitle,
        description: copy.metadataDescription,
    };
}

export default async function SupportPage() {
    const language = await getRequestLanguage();
    const copy = getSupportPageCopy(language);

    return (
        <PublicPageShell
            variant="landing"
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            icon="solar:question-circle-bold"
            actions={
                <>
                    <Link href="/docs" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400">
                        {copy.readGuides}
                    </Link>
                    <Link
                        {...getStatusLinkProps()}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                    >
                        {statusLiveLink.type === 'external' ? copy.viewLiveStatus : copy.checkStatus}
                    </Link>
                    <Link href="/support/contact" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:text-white">
                        {copy.contactSupport}
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
                            <p className="text-lg font-semibold">{copy.publicCenterTitle}</p>
                            <p className="text-sm text-slate-500">{copy.publicCenterDescription}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {copy.highlights.map((highlight) => (
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
