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
import { getRequestLanguage } from '@/lib/server-i18n';

function getSecurityPageCopy(language: 'th' | 'en') {
    if (language === 'en') {
        return {
            metadataTitle: 'Security Reporting',
            metadataDescription: 'Responsible disclosure guidance and channels for reporting security issues in ITII Assist Classroom.',
            eyebrow: 'Security Reporting',
            title: 'Report security issues responsibly and help the team respond quickly',
            description: 'Use this page for account takeover, data exposure, privilege issues, abuse, or vulnerabilities that could affect trust in the platform. Avoid public disclosure before the risk has been assessed.',
            backLabel: 'Back to Help Center',
            primaryActionLabel: 'Open a security case',
            secondaryActionLabel: statusLiveLink.type === 'external' ? 'Follow live status' : 'Follow public status',
            urgentPanelLabel: 'For urgent issues',
            urgentPanelValue: 'Use the subject prefix [SECURITY]',
            urgentPanelDescription: 'It helps the team separate security incidents from general support requests faster.',
            safePanelLabel: 'Safe reporting',
            safePanelValue: 'Private first, minimal impact',
            safePanelDescription: 'Demonstrate the issue only as far as necessary and avoid accessing other users’ data or disrupting live services.',
            channelsTitle: 'Reporting channels',
            channelsDescription: 'Choose the channel that matches the urgency and the sensitivity of the information you need to share.',
            disclosureTitle: 'Responsible disclosure process',
            safeHarborTitle: 'Safe harbor expectations',
            urgentExamplesTitle: 'Examples of urgent cases',
            channels: [
                {
                    label: 'Email',
                    value: 'support@itii.ac.th',
                    note: 'Use the subject prefix [SECURITY] and describe the potential impact clearly.',
                },
                {
                    label: 'Support Portal',
                    value: '/support/contact',
                    note: 'Best for incidents that need ongoing coordination or several supporting attachments.',
                },
                {
                    label: 'Status Communication',
                    value: statusLiveLink.type === 'external' ? 'Live status page' : '/status',
                    note: statusLiveLink.type === 'external'
                        ? 'Use it to follow live incident notices and maintenance updates from the public status provider.'
                        : 'Use it to follow public incident notices and maintenance updates.',
                },
            ],
            disclosureSteps: [
                'Report the issue as quickly as possible with the impact, scope, affected systems, timeline, and safe reproduction steps when available.',
                'Attach only the evidence that is necessary, such as screenshots, logs, or sanitized requests, so the team can assess severity correctly.',
                'Avoid accessing other users’ data, modifying real records, or disrupting the service beyond what is strictly necessary to demonstrate the issue.',
                'Do not disclose the issue publicly until the operations team has had a reasonable opportunity to review it, reduce risk, and communicate a response plan.',
                'If the incident is urgent, such as account takeover, data exposure, privilege escalation, or active abuse, state that urgency clearly in the subject and the report.',
            ],
            safeHarbor: [
                'Testing must stay within the accounts and data that you are authorized to access.',
                'Do not use social engineering, phishing, spam, DDoS, or destructive actions to prove a finding.',
                'Do not download, copy, or disclose personal data beyond what is strictly necessary to demonstrate the vulnerability.',
                'The team will review good-faith reports and aims to respond according to the severity of the incident.',
            ],
            urgentExamples: [
                'You discovered an account that appears to be accessed without authorization or a session behaving suspiciously.',
                'You can see course data or user data that should not be visible with your current permissions.',
                'You found a vulnerability that could lead to data modification, privilege escalation, or data leakage.',
            ],
        };
    }

    return {
        metadataTitle: 'การแจ้งปัญหาความปลอดภัย',
        metadataDescription: 'แนวทาง Responsible Disclosure และช่องทางแจ้งปัญหาความปลอดภัยของ ITII Assist Classroom',
        eyebrow: 'การแจ้งปัญหาความปลอดภัย',
        title: 'รายงานเหตุด้านความปลอดภัยอย่างรับผิดชอบ และให้ทีมงานตอบสนองได้เร็ว',
        description: 'ใช้หน้านี้สำหรับ account takeover, data exposure, privilege issues, abuse, หรือช่องโหว่ที่กระทบความเชื่อมั่นของระบบ โดยหลีกเลี่ยงการเปิดเผยสู่สาธารณะก่อนการประเมินความเสี่ยง',
        backLabel: 'กลับศูนย์ช่วยเหลือ',
        primaryActionLabel: 'เปิดเคส Security',
        secondaryActionLabel: statusLiveLink.type === 'external' ? 'ติดตาม live status' : 'ติดตามสถานะสาธารณะ',
        urgentPanelLabel: 'กรณีเร่งด่วน',
        urgentPanelValue: 'ใส่หัวข้อ [SECURITY]',
        urgentPanelDescription: 'ช่วยให้ทีมงานแยกเคสด้านความปลอดภัยออกจาก support ทั่วไปได้เร็วขึ้น',
        safePanelLabel: 'แนวทางแจ้งอย่างปลอดภัย',
        safePanelValue: 'Private first, minimal impact',
        safePanelDescription: 'พิสูจน์ปัญหาเท่าที่จำเป็น หลีกเลี่ยงการเข้าถึงข้อมูลผู้อื่นหรือการกระทบต่อบริการจริง',
        channelsTitle: 'ช่องทางรายงาน',
        channelsDescription: 'เลือกช่องทางที่เหมาะกับความเร่งด่วนและระดับข้อมูลที่ต้องแนบ',
        disclosureTitle: 'กระบวนการ Responsible Disclosure',
        safeHarborTitle: 'ขอบเขตการทดสอบที่คาดหวัง',
        urgentExamplesTitle: 'ตัวอย่างเคสเร่งด่วน',
        channels: [
            {
                label: 'อีเมล',
                value: 'support@itii.ac.th',
                note: 'ใช้หัวข้อ [SECURITY] และอธิบายผลกระทบที่อาจเกิดขึ้นอย่างชัดเจน',
            },
            {
                label: 'Support Portal',
                value: '/support/contact',
                note: 'เหมาะสำหรับเหตุที่ต้องการประสานงานต่อเนื่องหรือมีข้อมูลประกอบหลายรายการ',
            },
            {
                label: 'การสื่อสารสถานะ',
                value: statusLiveLink.type === 'external' ? 'หน้าสถานะสด' : '/status',
                note: statusLiveLink.type === 'external'
                    ? 'ใช้ติดตามประกาศเหตุขัดข้องสาธารณะ การบำรุงรักษา และการสื่อสาร incident แบบสด'
                    : 'ใช้ติดตามประกาศเหตุขัดข้องสาธารณะและการบำรุงรักษา',
            },
        ],
        disclosureSteps: securityDisclosureSteps,
        safeHarbor: securitySafeHarbor,
        urgentExamples: [
            'พบว่าบัญชีถูกเข้าถึงโดยไม่ได้รับอนุญาตหรือ session มีพฤติกรรมผิดปกติ',
            'พบข้อมูลรายวิชาหรือข้อมูลผู้ใช้ที่ไม่ควรมองเห็นได้ตามสิทธิ์ปัจจุบัน',
            'พบช่องโหว่ที่อาจนำไปสู่การแก้ไขข้อมูล การยกระดับสิทธิ์ หรือการรั่วไหลของข้อมูล',
        ],
    };
}

export async function generateMetadata(): Promise<Metadata> {
    const language = await getRequestLanguage();
    const copy = getSecurityPageCopy(language);

    return {
        title: copy.metadataTitle,
        description: copy.metadataDescription,
    };
}

export default async function SecurityPage() {
    const language = await getRequestLanguage();
    const copy = getSecurityPageCopy(language);

    return (
        <PublicPageShell
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            icon="solar:shield-warning-bold"
            backHref="/support"
            backLabel={copy.backLabel}
            actions={
                <>
                    <Link href="/support/contact" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                        {copy.primaryActionLabel}
                    </Link>
                    <Link {...getStatusLinkProps()} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600">
                        {copy.secondaryActionLabel}
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-3">
                    <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-red-700">{copy.urgentPanelLabel}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{copy.urgentPanelValue}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{copy.urgentPanelDescription}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{copy.safePanelLabel}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{copy.safePanelValue}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{copy.safePanelDescription}</p>
                    </div>
                </div>
            }
        >
            <section>
                <h2 className="text-2xl font-bold text-slate-900">{copy.channelsTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy.channelsDescription}</p>
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    {securityChannels.map((channel, index) => {
                        const localizedChannel = copy.channels[index];

                        return (
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
                            <div className="mt-5 text-lg font-semibold text-slate-900">{localizedChannel?.label ?? channel.label}</div>
                            <div className="mt-1 text-sm font-medium text-blue-600">{localizedChannel?.value ?? channel.value}</div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{localizedChannel?.note ?? channel.note}</p>
                        </Link>
                    );})}
                </div>
            </section>

            <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                    <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                        <Icon icon="solar:steps-bold" className="text-2xl text-blue-500" />
                        {copy.disclosureTitle}
                    </h2>
                    <div className="mt-5 space-y-3">
                        {securityDisclosureSteps.map((step, index) => (
                            <div key={step} className="flex items-start gap-4 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-blue-600 shadow-sm shadow-slate-200/50">
                                    {index + 1}
                                </div>
                                <p className="text-sm leading-6 text-slate-600">{copy.disclosureSteps[index] ?? step}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:shield-check-bold" className="text-2xl text-blue-500" />
                            {copy.safeHarborTitle}
                        </h2>
                        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                            {securitySafeHarbor.map((item, index) => (
                                <li key={item} className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <span>{copy.safeHarbor[index] ?? item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-4xl border border-red-200 bg-red-50/70 p-6 shadow-sm shadow-red-100/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:danger-triangle-bold" className="text-2xl text-red-500" />
                            {copy.urgentExamplesTitle}
                        </h2>
                        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
                            {copy.urgentExamples.map((item) => (
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