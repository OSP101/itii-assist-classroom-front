import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import { platformReferenceLinks, privacySections } from '@/config/support-content';

export const metadata: Metadata = {
    title: 'Privacy Policy',
    description: 'นโยบายความเป็นส่วนตัวของ ITII Assist Classroom อธิบายข้อมูลที่เก็บ วิธีใช้ข้อมูล และสิทธิของผู้ใช้งาน',
};

const policyReferences = platformReferenceLinks.filter((link) => link.category === 'policy');

export default function PrivacyPage() {
    return (
        <PublicPageShell
            eyebrow="Privacy Policy"
            title="เราอธิบายข้อมูลที่ใช้ให้ชัด เพื่อให้ผู้ใช้รู้ว่าระบบเก็บอะไรและเพราะอะไร"
            description="เอกสารนี้ใช้กับการให้บริการของ ITII Assist Classroom โดยเน้นข้อมูลที่จำเป็นต่อการจัดการเรียนการสอน การสนับสนุนผู้ใช้ และความปลอดภัยของระบบ"
            icon="solar:shield-user-bold"
            backHref="/support"
            backLabel="กลับศูนย์ช่วยเหลือ"
            actions={
                <>
                    <Link href="/terms" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">
                        ดูข้อกำหนดการใช้งาน
                    </Link>
                    <Link href="/security" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600">
                        แจ้งเหตุด้านความปลอดภัย
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-3">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Scope</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">การเรียนการสอน + support + security</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">นโยบายนี้ครอบคลุมข้อมูลที่จำเป็นต่อ workflow ของระบบนี้โดยตรง</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Published</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">10 พ.ค. 2026</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">หากมีการเปลี่ยนแปลงสาระสำคัญ เราจะสื่อสารผ่านหน้า support หรือช่องทางที่เหมาะสม</p>
                    </div>
                </div>
            }
        >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-5">
                    {privacySections.map((section) => (
                        <section key={section.title} className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                            <div className="flex items-center gap-3">
                                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                                    <Icon icon={section.icon} className="text-xl" />
                                </div>
                                <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
                            </div>
                            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                                {section.items.map((item) => (
                                    <li key={item} className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>

                <div className="space-y-6">
                    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:documents-bold" className="text-2xl text-blue-500" />
                            เอกสารที่เกี่ยวข้อง
                        </h2>
                        <div className="mt-5 space-y-3">
                            <Link href="/terms" className="block rounded-3xl border border-slate-200 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/40">
                                <div className="text-sm font-semibold text-slate-900">ข้อกำหนดการใช้งาน</div>
                                <p className="mt-1 text-sm leading-6 text-slate-600">อธิบายสิทธิและข้อห้ามที่เกี่ยวข้องกับการใช้บริการ</p>
                            </Link>
                            <Link href="/cookies" className="block rounded-3xl border border-slate-200 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/40">
                                <div className="text-sm font-semibold text-slate-900">นโยบายคุกกี้</div>
                                <p className="mt-1 text-sm leading-6 text-slate-600">อธิบายการใช้ session, security challenge, และการตั้งค่าที่จำเป็น</p>
                            </Link>
                            <Link href="/security" className="block rounded-3xl border border-slate-200 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/40">
                                <div className="text-sm font-semibold text-slate-900">การแจ้งปัญหาความปลอดภัย</div>
                                <p className="mt-1 text-sm leading-6 text-slate-600">ช่องทางรายงานเหตุและแนวทาง responsible disclosure</p>
                            </Link>
                        </div>
                    </div>

                    <div className="rounded-4xl border border-slate-200 bg-linear-to-br from-slate-50 to-white p-6 shadow-sm shadow-slate-200/50">
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <Icon icon="solar:link-round-angle-bold" className="text-2xl text-blue-500" />
                            External policy references
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