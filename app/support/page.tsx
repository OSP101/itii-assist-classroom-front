import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import { SupportCenterClient, type SupportDocLite } from '@/components/support/SupportCenterClient';
import { getStatusLinkProps, statusLiveLink, statusProvider } from '@/config/status-provider';
import { getAllDocs } from '@/lib/docs.server';
import { getRequestLanguage } from '@/lib/server-i18n';

function getSupportPageCopy(language: 'th' | 'en') {
    if (language === 'en') {
        return {
            metadataTitle: 'Help Center',
            metadataDescription: statusProvider
                ? `Answers, the full illustrated LabTAS manual, live status from ${statusProvider.name}, and a direct line to the support team.`
                : 'Answers, the full illustrated LabTAS manual, live system status, and a direct line to the support team.',
            eyebrow: 'Help Center',
            title: 'How can we help you today?',
            description:
                'Open the illustrated LabTAS manual, search the FAQ and task guides, or send a case straight to the team — all in one place.',
            openFullManual: 'Open the full manual',
            readGuides: 'Task guides',
            viewLiveStatus: 'View live status',
            checkStatus: 'System status',
            contactSupport: 'Contact support',
        };
    }

    return {
        metadataTitle: 'ศูนย์ช่วยเหลือ',
        metadataDescription: statusProvider
            ? `เปิดคู่มือฉบับสมบูรณ์ของ LabTAS ค้นคำตอบ ตรวจสถานะระบบผ่าน ${statusProvider.name} และติดต่อทีมงานได้ในหน้าเดียว`
            : 'เปิดคู่มือฉบับสมบูรณ์ของ LabTAS ค้นคำตอบ ตรวจสถานะระบบ และติดต่อทีมงานได้ในหน้าเดียว',
        eyebrow: 'ศูนย์ช่วยเหลือ',
        title: 'มีอะไรให้เราช่วยไหม?',
        description:
            'เปิดคู่มือฉบับสมบูรณ์ที่มีภาพหน้าจอจริงประกอบทุกขั้นตอน ค้นคำตอบและคู่มือรายหัวข้อในระบบ หรือส่งเรื่องถึงทีมงานได้ทันที',
        openFullManual: 'เปิดคู่มือฉบับสมบูรณ์',
        readGuides: 'คู่มือรายหัวข้อ',
        viewLiveStatus: 'ดูสถานะระบบสด',
        checkStatus: 'สถานะระบบ',
        contactSupport: 'ติดต่อทีมงาน',
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

    const docsFull = getAllDocs(language);
    const docs: SupportDocLite[] = docsFull.map((doc) => ({
        slug: doc.slug,
        title: doc.title,
        description: doc.description,
        category: doc.category,
        categoryLabel: doc.categoryLabel,
        audience: doc.audience,
        icon: doc.icon,
        readingTime: doc.readingTime,
        updatedAt: doc.updatedAt,
        sections: doc.sections.slice(0, 12).map((section) => ({
            id: section.id,
            title: section.title,
            level: section.level,
        })),
        excerpt: doc.content
            .replace(/[#>*_`\-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 600),
    }));

    return (
        <PublicPageShell
            variant="landing"
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            icon="solar:question-circle-bold"
            actions={
                <>
                    <Link
                        href="/manual"
                        target="_blank"
                        rel="noopener"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-900/40 transition hover:bg-blue-400"
                    >
                        <Icon icon="solar:book-2-bold" className="text-base" />
                        {copy.openFullManual}
                        <Icon icon="solar:arrow-right-up-linear" className="text-sm opacity-80" />
                    </Link>
                    <Link
                        href="/docs"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
                    >
                        <Icon icon="solar:book-bookmark-bold" className="text-base" />
                        {copy.readGuides}
                    </Link>
                    <Link
                        {...getStatusLinkProps()}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
                    >
                        <Icon icon="solar:server-path-bold" className="text-base" />
                        {statusLiveLink.type === 'external' ? copy.viewLiveStatus : copy.checkStatus}
                    </Link>
                    <Link
                        href="/support/contact"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:text-white"
                    >
                        <Icon icon="solar:chat-round-dots-linear" className="text-base" />
                        {copy.contactSupport}
                    </Link>
                </>
            }
        >
            <SupportCenterClient docs={docs} />
        </PublicPageShell>
    );
}
