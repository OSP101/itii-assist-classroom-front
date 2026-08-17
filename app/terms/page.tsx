import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import { termsSections } from '@/config/support-content';
import { getRequestLanguage } from '@/lib/server-i18n';

function getTermsPageCopy(language: 'th' | 'en') {
    if (language === 'en') {
        return {
            metadataTitle: 'Terms of Use',
            metadataDescription: 'The COCO LABS terms of use for students, TAs, instructors, and administrators, including core responsibilities and prohibited behavior.',
            eyebrow: 'Terms of Use',
            title: 'Terms designed for the realities of an academic workflow',
            description: 'This document outlines the basic conditions for using COCO LABS for students, TAs, instructors, and administrators so classroom workflows can stay safe and fair.',
            backLabel: 'Back to Help Center',
            privacyActionLabel: 'View Privacy Policy',
            cookiesActionLabel: 'View Cookie Policy',
            audienceLabel: 'Audience',
            audienceValue: 'Students, TAs, instructors, and administrators',
            audienceDescription: 'Different roles share the same platform, so the expectations for responsible use must be clear.',
            publishedLabel: 'Published',
            publishedValue: 'May 10, 2026',
            publishedDescription: 'Continued use after a material policy change may be treated as acceptance of the latest version.',
            relatedTitle: 'Related policy documents',
            relatedDescription: 'These terms should be read together with the privacy policy, cookie policy, and security reporting guidance.',
            relatedPrivacyLabel: 'Privacy Policy',
            relatedSecurityLabel: 'Security Reporting',
            sections: [
                {
                    title: 'Acceptance of the agreement',
                    items: [
                        'Signing in to or using COCO LABS means the user acknowledges and accepts these terms together with the related privacy, cookie, and security policies.',
                        'If a user acts on behalf of a course, department, or institution, that user must be authorized to act in that role.',
                        'If course rules, institutional policies, or applicable law impose stricter requirements, those requirements apply alongside these terms.',
                    ],
                },
                {
                    title: 'Accounts and user responsibilities',
                    items: [
                        'Users must keep sign-in credentials confidential, set an appropriate password, enable 2FA when available, and remain responsible for activity performed through their account.',
                        'Users must not share accounts, impersonate another person, use a role they are not assigned, or attempt to bypass the platform permission model.',
                        'When suspicious access is detected, users must change their password, revoke unknown sessions, and notify the support team promptly.',
                        'Information submitted through support, feedback, classroom workflows, or score appeals must be accurate, honest, and must not harm other users.',
                    ],
                },
                {
                    title: 'Permitted use and prohibited behavior',
                    items: [
                        'The platform may be used only for teaching, learning, course coordination, grading, attendance, queue management, and related support activities.',
                        'Users must not attempt to access, modify, download, or disclose classroom, user, or system data that they are not authorized to view.',
                        'Users must not disrupt the platform through intentional request flooding, unauthorized automation, out-of-scope security testing, or direct attacks on the service.',
                        'Users must not upload or transmit illegal, privacy-invasive, threatening, harassing, or otherwise harmful material through the platform.',
                    ],
                },
                {
                    title: 'Course content and user data',
                    items: [
                        'Users retain ownership of the work or content they submit, subject to the rules of the course and the institution.',
                        'Instructors, TAs, and administrators may access data that is necessary for teaching operations, grading, review of score appeals, and investigation of abnormal events.',
                        'The platform may surface role-appropriate information such as scores, queues, attendance, assignment status, or activity logs so workflows can function correctly.',
                        'Users must not disclose other people’s scores, attendance records, names, or personal data outside the platform unless they are clearly authorized to do so.',
                    ],
                },
                {
                    title: 'Service availability and change management',
                    items: [
                        'The team aims to keep the platform available, but does not guarantee uninterrupted service free of incidents, latency, or maintenance windows at all times.',
                        'Features, screens, workflows, and policies may change when appropriate. Material changes should be communicated through the support or status surfaces.',
                        'The team may limit, suspend, or revoke access to accounts or data when necessary to prevent harm, enforce the terms, or reduce security risk.',
                        'This document is a standard operational draft and should be reviewed by the responsible institution before it is treated as a formal external policy.',
                    ],
                },
            ],
        };
    }

    return {
        metadataTitle: 'ข้อกำหนดการใช้งาน',
        metadataDescription: 'ข้อกำหนดการใช้งาน COCO LABS สำหรับผู้ใช้ทุกบทบาท รวมถึงข้อห้ามและความรับผิดชอบพื้นฐาน',
        eyebrow: 'ข้อกำหนดการใช้งาน',
        title: 'ข้อกำหนดการใช้งานที่ออกแบบให้ตรงกับบริบทของระบบเรียนการสอน',
        description: 'เอกสารนี้อธิบายเงื่อนไขพื้นฐานในการใช้งาน COCO LABS สำหรับนักศึกษา TA ผู้สอน และผู้ดูแลระบบ เพื่อให้ workflow ดำเนินไปอย่างปลอดภัยและเป็นธรรม',
        backLabel: 'กลับศูนย์ช่วยเหลือ',
        privacyActionLabel: 'ดูนโยบายความเป็นส่วนตัว',
        cookiesActionLabel: 'ดูนโยบายคุกกี้',
        audienceLabel: 'กลุ่มผู้ใช้งาน',
        audienceValue: 'นักศึกษา, TA, ผู้สอน, ผู้ดูแลระบบ',
        audienceDescription: 'บทบาทต่างกัน แต่ใช้บริการร่วมกันในพื้นที่เดียว จึงต้องมีข้อตกลงที่ชัดเจน',
        publishedLabel: 'เผยแพร่',
        publishedValue: '10 พ.ค. 2026',
        publishedDescription: 'การใช้งานต่อเนื่องหลังการเปลี่ยนแปลงนโยบายอาจถือเป็นการยอมรับฉบับล่าสุด',
        relatedTitle: 'เอกสารนโยบายอื่นที่เกี่ยวข้อง',
        relatedDescription: 'ข้อกำหนดการใช้งานควรอ่านควบคู่กับนโยบายความเป็นส่วนตัว นโยบายคุกกี้ และแนวทางแจ้งเหตุด้านความปลอดภัย',
        relatedPrivacyLabel: 'นโยบายความเป็นส่วนตัว',
        relatedSecurityLabel: 'การแจ้งปัญหาความปลอดภัย',
        sections: termsSections.map((section) => ({
            title: section.title,
            items: section.items,
        })),
    };
}

export async function generateMetadata(): Promise<Metadata> {
    const language = await getRequestLanguage();
    const copy = getTermsPageCopy(language);

    return {
        title: copy.metadataTitle,
        description: copy.metadataDescription,
    };
}

export default async function TermsPage() {
    const language = await getRequestLanguage();
    const copy = getTermsPageCopy(language);

    return (
        <PublicPageShell
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            icon="solar:document-text-bold"
            backHref="/support"
            backLabel={copy.backLabel}
            actions={
                <>
                    <Link href="/privacy" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                        {copy.privacyActionLabel}
                    </Link>
                    <Link href="/cookies" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600">
                        {copy.cookiesActionLabel}
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-3">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{copy.audienceLabel}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{copy.audienceValue}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{copy.audienceDescription}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{copy.publishedLabel}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{copy.publishedValue}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{copy.publishedDescription}</p>
                    </div>
                </div>
            }
        >
            <div className="space-y-5">
                {termsSections.map((section, index) => {
                    const localizedSection = copy.sections[index];

                    return (
                    <section key={`${section.title}-${index}`} className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <div className="flex items-center gap-3">
                            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                                <Icon icon={section.icon} className="text-xl" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900">{localizedSection?.title ?? section.title}</h2>
                        </div>
                        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                            {section.items.map((item, itemIndex) => (
                                <li key={item} className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <span>{localizedSection?.items[itemIndex] ?? item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                );})}
            </div>

            <section className="mt-10 rounded-4xl border border-blue-200 bg-linear-to-r from-blue-50 via-white to-indigo-50 p-8">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{copy.relatedTitle}</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{copy.relatedDescription}</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Link href="/privacy" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                            {copy.relatedPrivacyLabel}
                        </Link>
                        <Link href="/security" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-200 px-5 py-3 text-sm font-semibold text-blue-700">
                            {copy.relatedSecurityLabel}
                        </Link>
                    </div>
                </div>
            </section>
        </PublicPageShell>
    );
}