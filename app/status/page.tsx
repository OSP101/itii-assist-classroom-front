import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import {
    getStatusLinkProps,
    statusGatewayDescription,
    statusLiveLink,
    statusProvider,
    statusSubscriptionLink,
} from '@/config/status-provider';
import {
    platformReferenceLinks,
    publicStatusHistory,
    publicStatusServices,
    statusCommitments,
} from '@/config/support-content';

export const metadata: Metadata = {
    title: 'System Status',
    description: statusGatewayDescription,
};

const statusTone = {
    operational: {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        panel: 'border-emerald-200 bg-emerald-50/60',
        icon: 'text-emerald-600 bg-white',
        label: 'Operational',
    },
    degraded: {
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        panel: 'border-amber-200 bg-amber-50/60',
        icon: 'text-amber-600 bg-white',
        label: 'Degraded',
    },
    maintenance: {
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        panel: 'border-blue-200 bg-blue-50/60',
        icon: 'text-blue-600 bg-white',
        label: 'Maintenance',
    },
} as const;

const providerStatusLinks = platformReferenceLinks.filter((link) => link.category === 'status');

export default function StatusPage() {
    return (
        <PublicPageShell
            eyebrow="System Status"
            title="สถานะสาธารณะของบริการหลักที่ขับเคลื่อนการใช้งานในห้องเรียน"
            description={statusGatewayDescription}
            icon="solar:server-path-bold"
            backHref="/support"
            backLabel="กลับศูนย์ช่วยเหลือ"
            actions={
                <>
                    <Link {...getStatusLinkProps()} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                        {statusProvider ? `เปิด ${statusProvider.name}` : 'ดู live status'}
                    </Link>
                    <Link href="/support/contact" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                        รายงานเหตุขัดข้อง
                    </Link>
                    <Link href="/security" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600">
                        แจ้งเหตุด้านความปลอดภัย
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-3">
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">Overall status</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">Operational</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">บริการสาธารณะทั้งหมดในหน้านี้ยังไม่มี incident active ณ เวลาที่เผยแพร่สถานะล่าสุด</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            {statusProvider ? 'Live incident feed' : 'Last published update'}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                            {statusProvider ? statusProvider.name : '10 พ.ค. 2026, 09:30 ICT'}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                            {statusProvider
                                ? `หน้า branded นี้ใช้สรุปผลกระทบระดับผู้ใช้ทั่วไป ส่วน incident สด, maintenance windows, และการ subscribe updates จะเผยแพร่ผ่าน ${statusProvider.name}`
                                : 'ทีมดูแลระบบใช้ dashboard ภายในที่ละเอียดกว่าหน้านี้สำหรับ metrics, logs, และ root cause analysis'}
                        </p>
                        {statusSubscriptionLink ? (
                            <Link
                                {...getStatusLinkProps(statusSubscriptionLink)}
                                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
                            >
                                รับประกาศผ่าน {statusProvider?.name}
                            </Link>
                        ) : null}
                    </div>
                </div>
            }
        >
            <section>
                <h2 className="text-2xl font-bold text-slate-900">บริการที่ติดตามในหน้าสาธารณะ</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">ข้อมูลชุดนี้ออกแบบให้ผู้ใช้ทั่วไปเข้าใจผลกระทบได้เร็ว โดยไม่เปิดเผยรายละเอียดภายในที่เกินความจำเป็น และใช้ร่วมกับลิงก์ live status เมื่อต้องติดตามเหตุแบบนาทีต่อนาที</p>
                <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {publicStatusServices.map((service) => {
                        const tone = statusTone[service.status];
                        return (
                            <div key={service.name} className={`rounded-4xl border p-6 shadow-sm shadow-slate-200/50 ${tone.panel}`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tone.icon}`}>
                                        <Icon icon={service.icon} className="text-2xl" />
                                    </div>
                                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                                        {tone.label}
                                    </span>
                                </div>
                                <h3 className="mt-5 text-lg font-semibold text-slate-900">{service.name}</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{service.summary}</p>
                                <p className="mt-3 text-sm leading-6 text-slate-500">{service.detail}</p>
                                <div className="mt-5 rounded-3xl border border-white/80 bg-white/80 px-4 py-4">
                                    <div className="text-xs uppercase tracking-wide text-slate-400">{service.metricLabel}</div>
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
                        Incident & maintenance history
                    </h2>
                    <div className="mt-6 space-y-4">
                        {publicStatusHistory.map((item) => (
                            <div key={`${item.date}-${item.title}`} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                                        <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{item.date}</div>
                                    </div>
                                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                        {item.state}
                                    </span>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:checklist-minimalistic-bold" className="text-2xl text-blue-500" />
                            การสื่อสารสถานะ
                        </h2>
                        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                            {statusCommitments.map((item) => (
                                <li key={item} className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-4xl border border-slate-200 bg-linear-to-br from-slate-50 to-white p-6 shadow-sm shadow-slate-200/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:widget-3-bold" className="text-2xl text-blue-500" />
                            {statusProvider ? 'Live status provider & references' : 'External provider status'}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            {statusProvider
                                ? `${statusProvider.name} เป็นช่องทางหลักสำหรับ incident live feed ส่วนลิงก์อื่นด้านล่างใช้ตรวจสอบผู้ให้บริการประกอบที่อาจกระทบระบบ`
                                : 'ลิงก์ด้านล่างช่วยอ้างอิงสถานะของผู้ให้บริการประกอบที่อาจมีผลต่อประสบการณ์ใช้งาน'}
                        </p>
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
                        <h2 className="text-2xl font-bold text-slate-900">ถ้าสงสัยว่าเหตุที่พบเป็นเรื่องระบบหรือสิทธิ์การใช้งาน</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">เปิดเคสพร้อมระบุรายวิชา เวลา และหน้าที่พบปัญหา ทีมงานจะช่วยแยกว่าเป็น incident ระดับระบบหรือปัญหาเฉพาะบริบทของบัญชีคุณ</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Link href="/support/contact" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                            ติดต่อทีมงาน
                        </Link>
                        <Link
                            {...(statusSubscriptionLink ? getStatusLinkProps(statusSubscriptionLink) : { href: '/support' })}
                            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-200 px-5 py-3 text-sm font-semibold text-blue-700"
                        >
                            {statusSubscriptionLink ? `เปิด ${statusProvider?.name}` : 'กลับไป Help Center'}
                        </Link>
                    </div>
                </div>
            </section>
        </PublicPageShell>
    );
}