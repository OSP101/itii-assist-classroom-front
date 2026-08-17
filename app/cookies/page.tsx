import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import { cookieSections } from '@/config/support-content';
import { getRequestLanguage } from '@/lib/server-i18n';

function getCookiesPageCopy(language: 'th' | 'en') {
    if (language === 'en') {
        return {
            metadataTitle: 'Cookie Policy',
            metadataDescription: 'The COCO LABS cookie policy explains the browser-side data used for sessions, preferences, and essential security mechanisms.',
            eyebrow: 'Cookie Policy',
            title: 'Cookies and browser storage are used only where needed for sessions, security, and user experience',
            description: 'This document explains the browser-side data used for authentication, abuse prevention, and the settings that are necessary to use COCO LABS.',
            backLabel: 'Back to Help Center',
            privacyActionLabel: 'View Privacy Policy',
            supportActionLabel: 'Get help',
            corePurposeLabel: 'Core purpose',
            corePurposeValue: 'Session, security, and preferences',
            corePurposeDescription: 'Browser storage is used only as much as necessary to keep the platform stable and secure.',
            browserManagementTitle: 'Browser management tips',
            browserManagementTips: [
                'Allow the essential cookies and storage used by this platform so sign-in and session handling can work correctly.',
                'If you clear browser storage frequently, expect to sign in again and complete additional verification more often.',
                'If the login page or a public form repeats a challenge, review privacy extensions or browser settings that may be blocking required storage for this domain.',
            ],
            loginIssueTitle: 'Login or verification problems',
            loginIssueDescription: 'If the browser blocks required storage, the login flow may not complete or security challenges may repeat. In that case, temporarily relax privacy extensions for this domain or contact the support team.',
            contactSupportLabel: 'Contact support',
            readMoreLabel: 'Read more about privacy',
            sections: [
                {
                    title: 'Essential cookies and storage',
                    items: [
                        'The platform uses cookies or browser storage that are required for authentication, session continuity, CSRF protection, and other security-critical states.',
                        'These essential mechanisms are not used for advertising. If they are blocked, users may be unable to sign in, complete 2FA, or use some platform features normally.',
                    ],
                },
                {
                    title: 'Security and abuse-prevention mechanisms',
                    items: [
                        'We may use anti-bot or abuse-prevention controls such as challenges, verification tokens, rate-limit markers, or session state on login and public forms.',
                        'Security-related data is used only as needed to reduce attack risk, investigate abnormal behavior, and preserve trust in the platform.',
                    ],
                },
                {
                    title: 'Preferences and user experience',
                    items: [
                        'The platform may store a limited set of user preferences on the device, such as theme, workflow state, or other settings that help the user continue their work smoothly.',
                        'This category should stay limited, should not identify the user beyond the service context, and can usually be cleared through browser settings.',
                        'Clearing cookies or storage may require the user to sign in again, reapply settings, or complete additional verification.',
                    ],
                },
            ],
        };
    }

    return {
        metadataTitle: 'นโยบายคุกกี้',
        metadataDescription: 'นโยบายคุกกี้ของ COCO LABS สำหรับ session การตั้งค่า และกลไกด้านความปลอดภัยที่จำเป็นต่อการให้บริการ',
        eyebrow: 'นโยบายคุกกี้',
        title: 'คุกกี้และ storage ถูกใช้เท่าที่จำเป็นต่อ session ความปลอดภัย และประสบการณ์ใช้งาน',
        description: 'เอกสารนี้อธิบายการใช้ข้อมูลฝั่ง browser สำหรับการยืนยันตัวตน การป้องกัน abuse และการตั้งค่าที่จำเป็นต่อการใช้งาน COCO LABS',
        backLabel: 'กลับศูนย์ช่วยเหลือ',
        privacyActionLabel: 'ดูนโยบายความเป็นส่วนตัว',
        supportActionLabel: 'ขอความช่วยเหลือ',
        corePurposeLabel: 'วัตถุประสงค์หลัก',
        corePurposeValue: 'Session + Security + Preferences',
        corePurposeDescription: 'เราออกแบบให้ใช้ storage ฝั่ง browser เท่าที่จำเป็นต่อความเสถียรและความปลอดภัยของระบบ',
        browserManagementTitle: 'คำแนะนำในการจัดการ browser',
        browserManagementTips: [
            'เปิดใช้งานคุกกี้ที่จำเป็นสำหรับโดเมนของระบบนี้เพื่อให้การเข้าสู่ระบบและ session ทำงานได้ถูกต้อง',
            'หากล้าง browser storage บ่อย ควรเตรียมพร้อมสำหรับการเข้าสู่ระบบใหม่และการยืนยันตัวตนเพิ่มเติม',
            'หากหน้า login หรือแบบฟอร์มสาธารณะติด challenge ซ้ำ ให้ตรวจสอบส่วนขยายหรือการตั้งค่าความเป็นส่วนตัวของ browser ที่อาจบล็อก storage สำคัญ',
        ],
        loginIssueTitle: 'ปัญหา login หรือ verification',
        loginIssueDescription: 'หาก browser บล็อก storage ที่จำเป็น หน้า login อาจทำงานไม่ครบหรือ challenge อาจแสดงซ้ำได้ ในกรณีดังกล่าวให้ลองปิดส่วนขยายที่เกี่ยวกับ privacy ชั่วคราวสำหรับโดเมนนี้หรือเปิดเคสกับทีม support',
        contactSupportLabel: 'ติดต่อทีมสนับสนุน',
        readMoreLabel: 'อ่าน Privacy เพิ่มเติม',
        sections: cookieSections.map((section) => ({
            title: section.title,
            items: section.items,
        })),
    };
}

export async function generateMetadata(): Promise<Metadata> {
    const language = await getRequestLanguage();
    const copy = getCookiesPageCopy(language);

    return {
        title: copy.metadataTitle,
        description: copy.metadataDescription,
    };
}

export default async function CookiesPage() {
    const language = await getRequestLanguage();
    const copy = getCookiesPageCopy(language);

    return (
        <PublicPageShell
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            icon="solar:cookie-bold"
            backHref="/support"
            backLabel={copy.backLabel}
            actions={
                <>
                    <Link href="/privacy" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                        {copy.privacyActionLabel}
                    </Link>
                    <Link href="/support/contact" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600">
                        {copy.supportActionLabel}
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-3">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{copy.corePurposeLabel}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{copy.corePurposeValue}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{copy.corePurposeDescription}</p>
                    </div>
                </div>
            }
        >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-5">
                    {cookieSections.map((section, index) => {
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
                    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:settings-bold" className="text-2xl text-blue-500" />
                            {copy.browserManagementTitle}
                        </h2>
                        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                            {copy.browserManagementTips.map((tip) => (
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
                            {copy.loginIssueTitle}
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{copy.loginIssueDescription}</p>
                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                            <Link href="/support/contact" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                                {copy.contactSupportLabel}
                            </Link>
                            <Link href="/privacy" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-200 px-5 py-3 text-sm font-semibold text-blue-700">
                                {copy.readMoreLabel}
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </PublicPageShell>
    );
}