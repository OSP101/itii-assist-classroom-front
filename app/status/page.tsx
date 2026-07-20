import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import {
    getStatusLinkProps,
    statusProvider,
    statusSubscriptionLink,
} from '@/config/status-provider';
import {
    platformReferenceLinks,
    publicStatusHistory,
    publicStatusServices,
    statusCommitments,
} from '@/config/support-content';
import { getRequestLanguage } from '@/lib/server-i18n';

const statusToneStyles = {
    operational: {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        panel: 'border-emerald-200 bg-emerald-50/60',
        icon: 'text-emerald-600 bg-white',
    },
    degraded: {
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        panel: 'border-amber-200 bg-amber-50/60',
        icon: 'text-amber-600 bg-white',
    },
    maintenance: {
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        panel: 'border-blue-200 bg-blue-50/60',
        icon: 'text-blue-600 bg-white',
    },
} as const;

function getStatusPageCopy(language: 'th' | 'en') {
    if (language === 'en') {
        return {
            metadataTitle: 'System Status',
            metadataDescription: statusProvider
                ? `Use this page as the branded public overview of core services, then continue to ${statusProvider.name} for live incident communication.`
                : 'Track the availability of the web app, API, authentication, uploads, and notifications, including maintenance and incident communication.',
            eyebrow: 'System Status',
            title: 'Public status for the services that keep classroom workflows running',
            description: statusProvider
                ? `This page summarizes the user-facing status of LabTAS and links to ${statusProvider.name} for live incident communication.`
                : 'Use this page to track the availability of the web app, API, authentication, uploads, and notifications that support LabTAS.',
            backLabel: 'Back to Help Center',
            primaryActionLabel: statusProvider ? `Open ${statusProvider.name}` : 'View live status',
            incidentActionLabel: 'Report an incident',
            securityActionLabel: 'Report a security issue',
            overviewLabel: 'Overall status',
            overviewValue: 'Operational',
            overviewDescription: 'No active incident is currently affecting the public services listed on this page.',
            feedLabel: statusProvider ? 'Live incident feed' : 'Last published update',
            feedValue: statusProvider ? statusProvider.name : 'May 10, 2026, 09:30 ICT',
            feedDescription: statusProvider
                ? `This branded page summarizes end-user impact, while live incidents, maintenance windows, and subscription updates are published through ${statusProvider.name}.`
                : 'The operations team uses a deeper internal dashboard for metrics, logs, and root-cause analysis beyond this public summary.',
            subscribeLabel: statusProvider ? `Subscribe via ${statusProvider.name}` : 'Open live status',
            servicesTitle: 'Services tracked on the public page',
            servicesDescription: 'This view is designed so end users can understand impact quickly without exposing unnecessary internal detail, while still linking to live status updates when needed.',
            historyTitle: 'Incident and maintenance history',
            commitmentsTitle: 'How status updates are communicated',
            referencesTitle: statusProvider ? 'Live status provider and references' : 'External provider status',
            referencesDescription: statusProvider
                ? `${statusProvider.name} is the primary live incident feed. The links below help you cross-check supporting providers that could affect the platform.`
                : 'The links below provide additional context for supporting providers that may influence the user experience.',
            ctaTitle: 'Not sure whether the issue is a system incident or an access problem?',
            ctaDescription: 'Open a case and include the course, time, and affected page. The team will help determine whether it is a platform incident or an account-specific issue.',
            contactTeamLabel: 'Contact support',
            secondaryActionLabel: statusSubscriptionLink ? `Open ${statusProvider?.name}` : 'Back to Help Center',
            toneLabels: {
                operational: 'Operational',
                degraded: 'Degraded',
                maintenance: 'Maintenance',
            },
            services: [
                {
                    name: 'Web App',
                    summary: 'The sign-in flow, support pages, dashboards, and core classroom workflows are available.',
                    detail: 'The service is monitored across desktop and mobile usage with emphasis on classroom-facing stability.',
                    metricLabel: 'Availability',
                },
                {
                    name: 'API and Realtime',
                    summary: 'API services, queue updates, and event-driven classroom data are operating normally.',
                    detail: 'The operations team monitors latency, error rate, and throughput through internal dashboards.',
                    metricLabel: 'p95 latency',
                },
                {
                    name: 'Authentication',
                    summary: 'Primary sign-in and approved OAuth account linking are available.',
                    detail: 'Login anomalies, password resets, and security events are continuously monitored.',
                    metricLabel: 'Login success',
                },
                {
                    name: 'File Uploads',
                    summary: 'Assignment files and supporting evidence can be uploaded normally at this time.',
                    detail: 'Failed uploads are reviewed so deadlines and grading workflows are not disrupted.',
                    metricLabel: 'Transfer success',
                },
                {
                    name: 'Notifications',
                    summary: 'In-product notifications and workflow updates are being delivered normally.',
                    detail: 'High-impact events such as queue movement and score updates receive additional monitoring.',
                    metricLabel: 'Delivery rate',
                },
            ],
            history: [
                {
                    date: 'May 10, 2026',
                    title: 'New public status page launched',
                    state: 'Completed',
                    summary: 'Added a public communication layer for incidents, maintenance, and external reference links.',
                },
                {
                    date: 'May 8, 2026',
                    title: 'Planned maintenance: background job workers',
                    state: 'Resolved',
                    summary: 'Background processing was updated without affecting the main classroom workflows for end users.',
                },
                {
                    date: 'April 26, 2026',
                    title: 'Elevated latency for queue updates',
                    state: 'Resolved',
                    summary: 'Temporary slow responses affected some courses before load balancing was adjusted.',
                },
            ],
            commitments: [
                'Incidents that affect many users are announced on this page before other channels whenever practical.',
                'Security or abuse incidents are triaged separately from general support cases and coordinated with the relevant teams immediately.',
                'The operations team maintains an internal dashboard with deeper metrics, logs, and root-cause analysis than this public page.',
            ],
            referenceDescriptions: {
                'https://www.githubstatus.com/': 'Public status dashboard for GitHub services and related integrations.',
            } as Record<string, string>,
        };
    }

    return {
        metadataTitle: 'สถานะระบบ',
        metadataDescription: statusProvider
            ? `ใช้หน้านี้เป็นภาพรวมสถานะสาธารณะของบริการหลัก แล้วกดต่อไปยัง ${statusProvider.name} เมื่อต้องการติดตาม incident แบบสด`
            : 'ใช้หน้านี้เพื่อติดตามความพร้อมใช้งานของเว็บแอป API การยืนยันตัวตน การอัปโหลดไฟล์ และการแจ้งเตือน รวมถึงประกาศ maintenance และ incident',
        eyebrow: 'สถานะระบบ',
        title: 'สถานะสาธารณะของบริการหลักที่ขับเคลื่อนการใช้งานในห้องเรียน',
        description: statusProvider
            ? `หน้านี้สรุปสถานะสาธารณะของ LabTAS และเชื่อมต่อไปยัง ${statusProvider.name} เมื่อต้องติดตาม incident แบบสด`
            : 'ใช้หน้านี้เพื่อติดตามความพร้อมใช้งานของเว็บแอป API การยืนยันตัวตน การอัปโหลดไฟล์ และการแจ้งเตือนที่สนับสนุน LabTAS',
        backLabel: 'กลับศูนย์ช่วยเหลือ',
        primaryActionLabel: statusProvider ? `เปิด ${statusProvider.name}` : 'ดูสถานะระบบสด',
        incidentActionLabel: 'รายงานเหตุขัดข้อง',
        securityActionLabel: 'แจ้งเหตุด้านความปลอดภัย',
        overviewLabel: 'ภาพรวมสถานะ',
        overviewValue: 'พร้อมใช้งาน',
        overviewDescription: 'บริการสาธารณะทั้งหมดที่แสดงในหน้านี้ยังไม่มี incident active ณ เวลาที่อัปเดตล่าสุด',
        feedLabel: statusProvider ? 'ฟีดเหตุขัดข้องแบบสด' : 'อัปเดตล่าสุดที่เผยแพร่',
        feedValue: statusProvider ? statusProvider.name : '10 พ.ค. 2026, 09:30 ICT',
        feedDescription: statusProvider
            ? `หน้านี้ใช้สรุปผลกระทบในระดับผู้ใช้ทั่วไป ส่วน incident สด maintenance windows และการ subscribe updates จะเผยแพร่ผ่าน ${statusProvider.name}`
            : 'ทีมดูแลระบบใช้ dashboard ภายในที่ละเอียดกว่าหน้านี้สำหรับ metrics logs และการวิเคราะห์สาเหตุเชิงลึก',
        subscribeLabel: statusProvider ? `รับประกาศผ่าน ${statusProvider.name}` : 'เปิดหน้าสถานะสด',
        servicesTitle: 'บริการที่ติดตามในหน้าสาธารณะ',
        servicesDescription: 'ข้อมูลชุดนี้ออกแบบให้ผู้ใช้ทั่วไปเข้าใจผลกระทบได้เร็ว โดยไม่เปิดเผยรายละเอียดภายในที่เกินความจำเป็น และใช้ร่วมกับลิงก์ live status เมื่อต้องติดตามเหตุแบบนาทีต่อนาที',
        historyTitle: 'ประวัติเหตุขัดข้องและการบำรุงรักษา',
        commitmentsTitle: 'แนวทางการสื่อสารสถานะ',
        referencesTitle: statusProvider ? 'ผู้ให้บริการสถานะสดและลิงก์อ้างอิง' : 'สถานะผู้ให้บริการภายนอก',
        referencesDescription: statusProvider
            ? `${statusProvider.name} เป็นช่องทางหลักสำหรับ incident สด ส่วนลิงก์ด้านล่างใช้ตรวจสอบผู้ให้บริการประกอบที่อาจกระทบแพลตฟอร์ม`
            : 'ลิงก์ด้านล่างใช้ประกอบการตรวจสอบผู้ให้บริการที่อาจส่งผลต่อประสบการณ์ใช้งานของผู้ใช้',
        ctaTitle: 'ถ้ายังไม่แน่ใจว่าเหตุที่พบเป็นเรื่องระบบหรือปัญหาสิทธิ์การใช้งาน',
        ctaDescription: 'เปิดเคสพร้อมระบุรายวิชา เวลา และหน้าที่พบปัญหา ทีมงานจะช่วยแยกว่าเป็น incident ระดับระบบหรือปัญหาเฉพาะบัญชีของคุณ',
        contactTeamLabel: 'ติดต่อทีมงาน',
        secondaryActionLabel: statusSubscriptionLink ? `เปิด ${statusProvider?.name}` : 'กลับไป Help Center',
        toneLabels: {
            operational: 'พร้อมใช้งาน',
            degraded: 'ประสิทธิภาพลดลง',
            maintenance: 'บำรุงรักษา',
        },
        services: [
            {
                name: 'เว็บแอป',
                summary: 'หน้าเข้าสู่ระบบ ศูนย์ช่วยเหลือ แดชบอร์ด และ workflow หลักของห้องเรียนยังพร้อมใช้งาน',
                detail: 'รองรับการใช้งานบน desktop และ mobile โดยเน้นเสถียรภาพของหน้าที่ผู้ใช้ห้องเรียนใช้งานจริง',
                metricLabel: 'ความพร้อมใช้งาน',
            },
            {
                name: 'API และ Realtime',
                summary: 'บริการ API การอัปเดตคิว และข้อมูลห้องเรียนแบบ event-driven อยู่ในสถานะปกติ',
                detail: 'ทีมดูแลระบบติดตาม latency error rate และ throughput ผ่าน dashboard ภายใน',
                metricLabel: 'p95 latency',
            },
            {
                name: 'การยืนยันตัวตน',
                summary: 'การเข้าสู่ระบบด้วยบัญชีหลักและการเชื่อม OAuth ที่อนุญาตยังทำงานตามปกติ',
                detail: 'มีการเฝ้าระวัง login anomalies การรีเซ็ตรหัสผ่าน และเหตุการณ์ด้านความปลอดภัยอย่างต่อเนื่อง',
                metricLabel: 'อัตราสำเร็จการล็อกอิน',
            },
            {
                name: 'การอัปโหลดไฟล์',
                summary: 'การแนบไฟล์งานและหลักฐานประกอบยังทำได้ตามปกติในช่วงเวลานี้',
                detail: 'ระบบติดตามการอัปโหลดที่ล้มเหลวเพื่อป้องกันผลกระทบต่อ deadline และ workflow การให้คะแนน',
                metricLabel: 'อัตราสำเร็จการส่งไฟล์',
            },
            {
                name: 'การแจ้งเตือน',
                summary: 'การแจ้งเตือนภายในระบบและ workflow updates ยังคงถูกส่งตามปกติ',
                detail: 'เหตุการณ์สำคัญ เช่น การขยับคิวหรือการอัปเดตคะแนน จะถูกเฝ้าระวังเป็นพิเศษ',
                metricLabel: 'อัตราการส่งถึง',
            },
        ],
        history: [
            {
                date: '10 พ.ค. 2026',
                title: 'เปิดใช้งานหน้าสถานะสาธารณะเวอร์ชันใหม่',
                state: 'เสร็จสิ้น',
                summary: 'เพิ่มชั้นการสื่อสารสาธารณะสำหรับ incident การบำรุงรักษา และลิงก์อ้างอิงภายนอก',
            },
            {
                date: '8 พ.ค. 2026',
                title: 'Planned maintenance: background job workers',
                state: 'เรียบร้อยแล้ว',
                summary: 'มีการปรับปรุงส่วนประมวลผลงานเบื้องหลังโดยไม่กระทบ workflow หลักของผู้ใช้งานทั่วไป',
            },
            {
                date: '26 เม.ย. 2026',
                title: 'ช่วง latency สูงสำหรับ queue updates',
                state: 'เรียบร้อยแล้ว',
                summary: 'ตรวจพบการตอบสนองช้าชั่วคราวในบางรายวิชาและได้ปรับสมดุลโหลดเรียบร้อยแล้ว',
            },
        ],
        commitments: [
            'เหตุขัดข้องที่กระทบผู้ใช้จำนวนมากจะถูกประกาศในหน้านี้ก่อนช่องทางอื่นเมื่อทำได้',
            'เหตุด้านความปลอดภัยหรือ abuse จะถูก triage แยกจากเคสทั่วไปและประสานกับทีมที่เกี่ยวข้องทันที',
            'ทีมดูแลระบบมี dashboard ภายในที่ละเอียดกว่าหน้านี้สำหรับ metrics logs และ root cause analysis',
        ],
        referenceDescriptions: {} as Record<string, string>,
    };
}

function getLocalizedStatusReferences(language: 'th' | 'en') {
    const copy = getStatusPageCopy(language);

    return platformReferenceLinks
        .filter((link) => link.category === 'status')
        .map((link) => {
            if (language !== 'en') {
                return link;
            }

            if (statusProvider && link.href === statusProvider.href) {
                return {
                    ...link,
                    description: `External status page for live incidents, maintenance notices, and subscription updates from ${statusProvider.name}.`,
                };
            }

            return {
                ...link,
                description: copy.referenceDescriptions[link.href] ?? link.description,
            };
        });
}

export async function generateMetadata(): Promise<Metadata> {
    const language = await getRequestLanguage();
    const copy = getStatusPageCopy(language);

    return {
        title: copy.metadataTitle,
        description: copy.metadataDescription,
    };
}

export default async function StatusPage() {
    const language = await getRequestLanguage();
    const copy = getStatusPageCopy(language);
    const providerStatusLinks = getLocalizedStatusReferences(language);

    return (
        <PublicPageShell
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            icon="solar:server-path-bold"
            backHref="/support"
            backLabel={copy.backLabel}
            actions={
                <>
                    <Link {...getStatusLinkProps()} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                        {copy.primaryActionLabel}
                    </Link>
                    <Link href="/support/contact" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                        {copy.incidentActionLabel}
                    </Link>
                    <Link href="/security" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600">
                        {copy.securityActionLabel}
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-3">
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">{copy.overviewLabel}</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">{copy.overviewValue}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{copy.overviewDescription}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{copy.feedLabel}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{copy.feedValue}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{copy.feedDescription}</p>
                        {statusSubscriptionLink ? (
                            <Link
                                {...getStatusLinkProps(statusSubscriptionLink)}
                                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
                            >
                                {copy.subscribeLabel}
                            </Link>
                        ) : null}
                    </div>
                </div>
            }
        >
            <section>
                <h2 className="text-2xl font-bold text-slate-900">{copy.servicesTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy.servicesDescription}</p>
                <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {publicStatusServices.map((service, index) => {
                        const tone = statusToneStyles[service.status];
                        const localizedService = copy.services[index];

                        return (
                            <div key={service.name} className={`rounded-4xl border p-6 shadow-sm shadow-slate-200/50 ${tone.panel}`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tone.icon}`}>
                                        <Icon icon={service.icon} className="text-2xl" />
                                    </div>
                                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                                        {copy.toneLabels[service.status]}
                                    </span>
                                </div>
                                <h3 className="mt-5 text-lg font-semibold text-slate-900">{localizedService?.name ?? service.name}</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{localizedService?.summary ?? service.summary}</p>
                                <p className="mt-3 text-sm leading-6 text-slate-500">{localizedService?.detail ?? service.detail}</p>
                                <div className="mt-5 rounded-3xl border border-white/80 bg-white/80 px-4 py-4">
                                    <div className="text-xs uppercase tracking-wide text-slate-400">{localizedService?.metricLabel ?? service.metricLabel}</div>
                                    <div className="mt-1 text-lg font-semibold text-slate-900">{service.metricValue}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                    <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                        <Icon icon="solar:history-2-bold" className="text-2xl text-blue-500" />
                        {copy.historyTitle}
                    </h2>
                    <div className="mt-6 space-y-4">
                        {publicStatusHistory.map((item, index) => {
                            const localizedHistoryItem = copy.history[index];

                            return (
                            <div key={`${item.date}-${item.title}`} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">{localizedHistoryItem?.title ?? item.title}</div>
                                        <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{localizedHistoryItem?.date ?? item.date}</div>
                                    </div>
                                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                        {localizedHistoryItem?.state ?? item.state}
                                    </span>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-600">{localizedHistoryItem?.summary ?? item.summary}</p>
                            </div>
                        );})}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:checklist-minimalistic-bold" className="text-2xl text-blue-500" />
                            {copy.commitmentsTitle}
                        </h2>
                        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                            {statusCommitments.map((item, index) => (
                                <li key={item} className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <span>{copy.commitments[index] ?? item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-4xl border border-slate-200 bg-linear-to-br from-slate-50 to-white p-6 shadow-sm shadow-slate-200/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:widget-3-bold" className="text-2xl text-blue-500" />
                            {copy.referencesTitle}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{copy.referencesDescription}</p>
                        <div className="mt-5 space-y-3">
                            {providerStatusLinks.map((reference) => (
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
            </section>

            <section className="mt-10 rounded-4xl border border-blue-200 bg-linear-to-r from-blue-50 via-white to-indigo-50 p-8">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{copy.ctaTitle}</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{copy.ctaDescription}</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Link href="/support/contact" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                            {copy.contactTeamLabel}
                        </Link>
                        <Link
                            {...(statusSubscriptionLink ? getStatusLinkProps(statusSubscriptionLink) : { href: '/support' })}
                            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-200 px-5 py-3 text-sm font-semibold text-blue-700"
                        >
                            {copy.secondaryActionLabel}
                        </Link>
                    </div>
                </div>
            </section>
        </PublicPageShell>
    );
}