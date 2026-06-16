import type { Metadata } from 'next';
import { ContactSupportForm } from '@/components/support/contact-support-form';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { PublicPageShell } from '@/components/support/PublicPageShell';
import { getRequestLanguage } from '@/lib/server-i18n';

import {
    supportChecklist,
    supportGuideSections,
    supportResponseLanes,
} from '@/config/support-content';

function getContactPageCopy(language: 'th' | 'en') {
    if (language === 'en') {
        return {
            metadataTitle: 'Contact Support',
            metadataDescription: 'Send a support request with the context the team needs to diagnose the issue immediately, including the category, course, role, and relevant details.',
            eyebrow: 'Contact Support',
            title: 'Send a support request with the context the team needs right away',
            description: 'Include the issue category, course, role, and relevant details so the support team can triage and respond more accurately.',
            openGuides: 'Open guides before submitting',
            reportSecurity: 'Report a security issue',
            checklistTitle: 'Checklist before you submit',
            guidesTitle: 'Topics that often help immediately',
            additionalChannelsTitle: 'Additional channels',
            securityNote: 'Use the subject prefix [SECURITY] when reporting incidents with security impact.',
            lanes: {
                'General Support': { title: 'General Support', responseTime: '24-48 hours' },
                'Learning Workflow': { title: 'Learning Workflow', responseTime: 'Next business day' },
                'Security & Abuse': { title: 'Security & Abuse', responseTime: 'Urgent intake' },
            },
            checklist: [
                'State the course, section, or course code clearly.',
                'Describe when the issue happened and what you expected versus what actually happened.',
                'Attach screenshots or the steps you took before the issue occurred.',
                'If the issue is permission-related, mention your role such as student, TA, or instructor.',
            ],
            guideCards: {
                student: {
                    title: 'Student step-by-step guide',
                    summary: 'Covers first-time access, attendance, queues, scores, and the first troubleshooting steps that students actually need.',
                },
                instructor: {
                    title: 'Instructor guide from course launch to term wrap-up',
                    summary: 'Plan the course, create work, track attendance, grade work, process score appeals, manage queues, and close the course in a structured flow.',
                },
                ta: {
                    title: 'Teaching assistant weekly operations guide',
                    summary: 'Review permissions, attendance, grading, queues, score appeals, and weekly reporting back to instructors.',
                },
                roles: {
                    title: 'Role and permission matrix',
                    summary: 'Reference what each role can do and apply least-privilege principles when assigning TA access.',
                },
            },
        };
    }

    return {
        metadataTitle: 'ติดต่อทีมสนับสนุน',
        metadataDescription: 'ส่งคำขอช่วยเหลือพร้อมบริบทที่ทีมงานใช้แก้ปัญหาได้ทันที ระบุหมวดปัญหา รายวิชา บทบาท และรายละเอียดที่เกี่ยวข้อง',
        eyebrow: 'ติดต่อทีมสนับสนุน',
        title: 'ส่งคำขอช่วยเหลือพร้อมบริบทที่ทีมงานใช้แก้ปัญหาได้ทันที',
        description: 'ระบุหมวดปัญหา รายวิชา บทบาท และรายละเอียดที่เกี่ยวข้องให้ครบ เพื่อให้ทีม support triage และตอบกลับได้แม่นยำขึ้น',
        openGuides: 'เปิดคู่มือก่อนส่งเคส',
        reportSecurity: 'แจ้งเหตุด้านความปลอดภัย',
        checklistTitle: 'Checklist ก่อนส่งคำขอ',
        guidesTitle: 'ลองดูหัวข้อที่มักช่วยได้ทันที',
        additionalChannelsTitle: 'ช่องทางเพิ่มเติม',
        securityNote: 'ใช้หัวข้อ [SECURITY] เมื่อต้องการแจ้งเหตุที่มีผลกระทบด้านความปลอดภัย',
        lanes: {
            'General Support': { title: 'General Support', responseTime: '24-48 ชั่วโมง' },
            'Learning Workflow': { title: 'Learning Workflow', responseTime: 'ภายในวันทำการถัดไป' },
            'Security & Abuse': { title: 'Security & Abuse', responseTime: 'รับเรื่องเร่งด่วน' },
        },
        checklist: supportChecklist,
        guideCards: {
            student: {
                title: 'คู่มือนักศึกษาแบบ Step-by-step',
                summary: 'เริ่มใช้งานครั้งแรก เช็คชื่อ เข้าคิว ดูคะแนน และแก้ปัญหาเบื้องต้นตามขั้นตอนที่ควรทำจริง',
            },
            instructor: {
                title: 'คู่มือผู้สอนตั้งแต่เปิดรายวิชาถึงปิดเทอม',
                summary: 'เตรียมรายวิชา ตั้งงาน เช็คชื่อ ให้คะแนน อนุมัติคำขอแก้คะแนน จัดคิว และปิดรายวิชาอย่างเป็นระบบ',
            },
            ta: {
                title: 'คู่มือผู้ช่วยสอนและงานประจำสัปดาห์',
                summary: 'ตรวจสิทธิ์ งานเช็คชื่อ ตรวจงาน ให้คะแนน คิว คำขอแก้คะแนน และรายงานผู้สอนรายสัปดาห์',
            },
            roles: {
                title: 'ตารางสิทธิ์และ Permission Matrix',
                summary: 'อ้างอิงว่าใครทำอะไรได้บ้าง พร้อมแนวทาง least privilege สำหรับกำหนดสิทธิ์ TA อย่างปลอดภัย',
            },
        },
    };
}

export async function generateMetadata(): Promise<Metadata> {
    const language = await getRequestLanguage();
    const copy = getContactPageCopy(language);

    return {
        title: copy.metadataTitle,
        description: copy.metadataDescription,
    };
}

const guideHrefById: Record<string, string> = {
    onboarding: '/docs/getting-started',
    assignments: '/docs/student-step-by-step',
    attendance: '/docs/student-step-by-step',
    queue: '/docs/student-step-by-step',
    scores: '/docs/student-step-by-step',
    account: '/docs/getting-started',
    permissions: '/docs/student-step-by-step',
    security: '/security',
    troubleshooting: '/docs/troubleshooting-guide',
    roles: '/docs/role-permission-matrix',
    instructor: '/docs/instructor-end-to-end',
    ta: '/docs/ta-operations',
    student: '/docs/student-step-by-step',
};

function getGuideHref(id: string) {
    return guideHrefById[id] ?? '/docs';
}

export default async function ContactSupportPage() {
    const language = await getRequestLanguage();
    const copy = getContactPageCopy(language);

    return (
        <PublicPageShell
            variant="landing"
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            icon="solar:chat-round-dots-bold"
            actions={
                <>
                    <Link href="/docs" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400">
                        {copy.openGuides}
                    </Link>
                    <Link href="/security" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20">
                        {copy.reportSecurity}
                    </Link>
                </>
            }
            heroPanel={
                <div className="space-y-3">
                    {supportResponseLanes.map((lane) => (
                        <div key={lane.title} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                            <div className="flex items-center gap-3">
                                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600">
                                    <Icon icon={lane.icon} className="text-xl" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">{copy.lanes[lane.title as keyof typeof copy.lanes]?.title ?? lane.title}</div>
                                    <div className="text-xs text-slate-500">{copy.lanes[lane.title as keyof typeof copy.lanes]?.responseTime ?? lane.responseTime}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            }
        >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
                <div>
                    <ContactSupportForm />
                </div>

                <div className="space-y-6">
                    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                            <Icon icon="solar:checklist-bold" className="text-xl text-blue-500" />
                            {copy.checklistTitle}
                        </h3>
                        <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                            {copy.checklist.map((item) => (
                                <li key={item} className="flex items-start gap-3">
                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                            <Icon icon="solar:book-bookmark-bold" className="text-xl text-blue-500" />
                            {copy.guidesTitle}
                        </h3>
                        <div className="mt-4 space-y-3">
                            {supportGuideSections.slice(0, 4).map((guide) => (
                                <Link key={guide.id} href={getGuideHref(guide.id)} className="block rounded-3xl border border-slate-200 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50/40">
                                    <div className="text-sm font-semibold text-slate-900">{copy.guideCards[guide.id as keyof typeof copy.guideCards]?.title ?? guide.title}</div>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">{copy.guideCards[guide.id as keyof typeof copy.guideCards]?.summary ?? guide.summary}</p>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-4xl border border-blue-200 bg-linear-to-br from-blue-50 to-indigo-50 p-6 shadow-sm shadow-blue-100/50">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                            <Icon icon="solar:mailbox-bold" className="text-xl text-blue-500" />
                            {copy.additionalChannelsTitle}
                        </h3>
                        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                            <p><span className="font-medium text-slate-900">Email:</span> support@itii.ac.th</p>
                            <p><span className="font-medium text-slate-900">LINE:</span> @itii-classroom</p>
                            <p><span className="font-medium text-slate-900">Security:</span> {copy.securityNote}</p>
                        </div>
                    </div>
                </div>
            </div>
        </PublicPageShell>
    );
}
