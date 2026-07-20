import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import { platformReferenceLinks, privacySections } from '@/config/support-content';
import { getRequestLanguage } from '@/lib/server-i18n';

function getPrivacyPageCopy(language: 'th' | 'en') {
    if (language === 'en') {
        return {
            metadataTitle: 'Privacy Policy',
            metadataDescription: 'The LabTAS privacy policy explains what data is used, why it is processed, and what rights users have.',
            eyebrow: 'Privacy Policy',
            title: 'We explain what data is used so people understand what the platform stores and why',
            description: 'This document applies to LabTAS services and focuses on the data needed for teaching operations, user support, and platform security.',
            backLabel: 'Back to Help Center',
            termsActionLabel: 'View Terms of Use',
            securityActionLabel: 'Report a security issue',
            scopeLabel: 'Scope',
            scopeValue: 'Teaching operations, support, and security',
            scopeDescription: 'This policy covers the data that is necessary for the workflows delivered directly by this platform.',
            publishedLabel: 'Published',
            publishedValue: 'May 10, 2026',
            publishedDescription: 'If we make a material change, we will communicate it through support channels or another appropriate notice path.',
            relatedDocsTitle: 'Related documents',
            relatedDocsCards: {
                terms: {
                    title: 'Terms of Use',
                    description: 'Explains the responsibilities, permitted use, and key restrictions that apply to the service.',
                },
                cookies: {
                    title: 'Cookie Policy',
                    description: 'Explains the use of sessions, security challenges, and the minimum settings needed for the platform to work.',
                },
                security: {
                    title: 'Security Reporting',
                    description: 'Where to report incidents and how responsible disclosure is handled.',
                },
            },
            referencesTitle: 'External policy references',
            sections: [
                {
                    title: 'Scope and people covered by the policy',
                    items: [
                        'This policy covers personal data related to the use of LabTAS for teaching, user support, and platform security.',
                        'The data may involve students, teaching assistants, instructors, administrators, and people who contact the team through support or feedback channels.',
                        'Actual data handling should follow the requirements of the system owner, the educational institution, and the applicable personal data protection laws.',
                    ],
                },
                {
                    title: 'Categories of data processed',
                    items: [
                        'Account data such as name, email, student identifier, role, avatar, OAuth accounts, 2FA status, and the session data required for authentication.',
                        'Teaching and learning data such as courses, sections, groups, assignments, scores, score appeals, attendance, queues, and classroom activity logs.',
                        'Device and system data such as coarse IP information, user agent, sign-in time, security event logs, notification tokens, and location data when a user intentionally performs location-based attendance.',
                        'Information provided to the team such as issue descriptions, supporting files or screenshots, feedback, and support contact history.',
                    ],
                },
                {
                    title: 'Purposes and bases for using the data',
                    items: [
                        'Data is used to provide role-based classroom services such as member management, grading, attendance, queueing, and the display of relevant scores or status.',
                        'Data is used to authenticate users, enforce permissions, prevent unauthorized access, investigate abnormal activity, and preserve security evidence where required.',
                        'Data is used to support users, troubleshoot issues, analyze incidents, improve service quality, and communicate important notices related to the platform.',
                        'When processing depends on consent, such as location access or browser notifications, the platform should request that consent clearly before use.',
                    ],
                },
                {
                    title: 'Disclosure and access to data',
                    items: [
                        'Course data may be visible to instructors, TAs, administrators, or other authorized roles only as necessary for teaching operations and support.',
                        'The platform may rely on infrastructure, email, notification, mapping, or security providers when necessary to operate the service and reduce abuse risk.',
                        'The platform should not sell personal data and should not disclose information beyond what is necessary for the service, academic duties, security, or legal obligations.',
                    ],
                },
                {
                    title: 'Retention, user rights, and data requests',
                    items: [
                        'Retention periods should reflect academic operations, score review, security requirements, and the rules of the organization that owns the system.',
                        'Users may ask questions, request corrections to inaccurate data, or exercise relevant data rights through the support process defined by the institution.',
                        'Requests to delete or restrict data use will be evaluated together with academic responsibilities, course continuity, log retention needs, and applicable legal requirements.',
                    ],
                },
                {
                    title: 'Data security',
                    items: [
                        'We use role-based access control, authentication, event logging, and monitoring to reduce risk to user data and accounts.',
                        'No system is perfectly secure, so the team should review security measures continuously based on risk, technology changes, and institutional requirements.',
                        'If you suspect a security issue, please report it through the Security page as soon as possible.',
                    ],
                },
            ],
            referenceTitles: {
                'https://www.etda.or.th/th/Useful-Resource/law/computer-crimes.aspx': 'Computer crime law resources',
            } as Record<string, string>,
            referenceDescriptions: {
                'https://docs.github.com/en/site-policy/github-terms/github-terms-of-service': 'Example language covering user rights, prohibited behavior, and responsibility boundaries.',
                'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement': 'Example language for account data and platform-level data processing.',
                'https://gppc.pdpc.or.th/': 'Government reference for Thai personal data protection compliance.',
                'https://www.etda.or.th/th/Useful-Resource/law/computer-crimes.aspx': 'Reference material on Thai computer-related offense law and related notices.',
                'https://nextjs.org/support-policy': 'Framework support window and version maintenance guidance.',
                'https://vercel.com/legal/privacy-policy': 'Reference language describing the role of a hosting or platform partner.',
            } as Record<string, string>,
        };
    }

    return {
        metadataTitle: 'นโยบายความเป็นส่วนตัว',
        metadataDescription: 'นโยบายความเป็นส่วนตัวของ LabTAS อธิบายข้อมูลที่เก็บ วิธีใช้ข้อมูล และสิทธิของผู้ใช้งาน',
        eyebrow: 'นโยบายความเป็นส่วนตัว',
        title: 'เราอธิบายข้อมูลที่ใช้ให้ชัด เพื่อให้ผู้ใช้รู้ว่าระบบเก็บอะไรและเพราะอะไร',
        description: 'เอกสารนี้ใช้กับการให้บริการของ LabTAS โดยเน้นข้อมูลที่จำเป็นต่อการจัดการเรียนการสอน การสนับสนุนผู้ใช้ และความปลอดภัยของระบบ',
        backLabel: 'กลับศูนย์ช่วยเหลือ',
        termsActionLabel: 'ดูข้อกำหนดการใช้งาน',
        securityActionLabel: 'แจ้งเหตุด้านความปลอดภัย',
        scopeLabel: 'ขอบเขต',
        scopeValue: 'การเรียนการสอน + support + security',
        scopeDescription: 'นโยบายนี้ครอบคลุมข้อมูลที่จำเป็นต่อ workflow ของระบบนี้โดยตรง',
        publishedLabel: 'เผยแพร่',
        publishedValue: '10 พ.ค. 2026',
        publishedDescription: 'หากมีการเปลี่ยนแปลงสาระสำคัญ เราจะสื่อสารผ่านหน้า support หรือช่องทางที่เหมาะสม',
        relatedDocsTitle: 'เอกสารที่เกี่ยวข้อง',
        relatedDocsCards: {
            terms: {
                title: 'ข้อกำหนดการใช้งาน',
                description: 'อธิบายสิทธิ ความรับผิดชอบ และข้อห้ามที่เกี่ยวข้องกับการใช้บริการ',
            },
            cookies: {
                title: 'นโยบายคุกกี้',
                description: 'อธิบายการใช้ session security challenge และการตั้งค่าที่จำเป็นต่อการใช้งาน',
            },
            security: {
                title: 'การแจ้งปัญหาความปลอดภัย',
                description: 'ช่องทางรายงานเหตุและแนวทาง responsible disclosure',
            },
        },
        referencesTitle: 'แหล่งอ้างอิงนโยบายภายนอก',
        sections: privacySections.map((section) => ({
            title: section.title,
            items: section.items,
        })),
        referenceTitles: {} as Record<string, string>,
        referenceDescriptions: {} as Record<string, string>,
    };
}

function getLocalizedPolicyReferences(language: 'th' | 'en') {
    const copy = getPrivacyPageCopy(language);

    return platformReferenceLinks
        .filter((link) => link.category === 'policy')
        .map((link) => ({
            ...link,
            title: copy.referenceTitles[link.href] ?? link.title,
            description: copy.referenceDescriptions[link.href] ?? link.description,
        }));
}

export async function generateMetadata(): Promise<Metadata> {
    const language = await getRequestLanguage();
    const copy = getPrivacyPageCopy(language);

    return {
        title: copy.metadataTitle,
        description: copy.metadataDescription,
    };
}

export default async function PrivacyPage() {
    const language = await getRequestLanguage();
    const copy = getPrivacyPageCopy(language);
    const policyReferences = getLocalizedPolicyReferences(language);

    return (
        <PublicPageShell
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            icon="solar:shield-user-bold"
            backHref="/support"
            backLabel={copy.backLabel}
            actions={
                <>
                    <Link href="/terms" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                        {copy.termsActionLabel}
                    </Link>
                    <Link href="/security" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600">
                        {copy.securityActionLabel}
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-3">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{copy.scopeLabel}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{copy.scopeValue}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{copy.scopeDescription}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{copy.publishedLabel}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{copy.publishedValue}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{copy.publishedDescription}</p>
                    </div>
                </div>
            }
        >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-5">
                    {privacySections.map((section, index) => {
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

                <div className="space-y-6">
                    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:documents-bold" className="text-2xl text-blue-500" />
                            {copy.relatedDocsTitle}
                        </h2>
                        <div className="mt-5 space-y-3">
                            <Link href="/terms" className="block rounded-3xl border border-slate-200 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/40">
                                <div className="text-sm font-semibold text-slate-900">{copy.relatedDocsCards.terms.title}</div>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{copy.relatedDocsCards.terms.description}</p>
                            </Link>
                            <Link href="/cookies" className="block rounded-3xl border border-slate-200 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/40">
                                <div className="text-sm font-semibold text-slate-900">{copy.relatedDocsCards.cookies.title}</div>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{copy.relatedDocsCards.cookies.description}</p>
                            </Link>
                            <Link href="/security" className="block rounded-3xl border border-slate-200 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/40">
                                <div className="text-sm font-semibold text-slate-900">{copy.relatedDocsCards.security.title}</div>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{copy.relatedDocsCards.security.description}</p>
                            </Link>
                        </div>
                    </div>

                    <div className="rounded-4xl border border-slate-200 bg-linear-to-br from-slate-50 to-white p-6 shadow-sm shadow-slate-200/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:link-round-angle-bold" className="text-2xl text-blue-500" />
                            {copy.referencesTitle}
                        </h2>
                        <div className="mt-5 space-y-3">
                            {policyReferences.map((reference) => (
                                <Link
                                    key={reference.href}
                                    href={reference.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-3xl border border-slate-200 bg-white px-4 py-4 transition hover:border-blue-200"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900">{reference.title}</div>
                                            <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{reference.provider}</div>
                                        </div>
                                        <Icon icon="solar:arrow-right-up-linear" className="text-lg text-slate-400" />
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{reference.description}</p>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </PublicPageShell>
    );
}