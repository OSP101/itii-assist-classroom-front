'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import {
    helpResources,
    supportCategories,
    supportFaqItems,
    supportGuideSections,
    supportResponseLanes,
} from '@/config/support-content';

function normalize(text: string) {
    return text.trim().toLowerCase();
}

const guideHrefById: Record<string, string> = {
    onboarding: '/docs/getting-started',
    assignments: '/docs/assignments',
    attendance: '/docs/attendance',
    queue: '/docs/queue-workflow',
    scores: '/docs/scores-appeals',
    account: '/docs/account-security',
    permissions: '/docs/browser-permissions',
    security: '/docs/security-reporting',
    troubleshooting: '/docs/troubleshooting-guide',
    roles: '/docs/role-permission-matrix',
    instructor: '/docs/instructor-end-to-end',
    ta: '/docs/ta-operations',
    student: '/docs/student-step-by-step',
};

function getGuideHref(id: string) {
    return guideHrefById[id] ?? '/docs';
}

function FaqAccordionItem({
    item,
    isOpen,
    onToggle,
}: {
    item: (typeof supportFaqItems)[number];
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <div className={`transition-colors ${isOpen ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'}`}>
            <button
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                onClick={onToggle}
                aria-expanded={isOpen}
            >
                <span className={`text-sm font-medium leading-6 ${isOpen ? 'text-blue-700' : 'text-slate-800'}`}>
                    {item.question}
                </span>
                <Icon
                    icon="solar:alt-arrow-down-linear"
                    className={`mt-0.5 shrink-0 text-lg transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-500' : 'text-slate-400'
                    }`}
                />
            </button>

            {isOpen ? (
                <div className="px-5 pb-5 pr-10">
                    <p className="text-sm leading-6 text-slate-600">{item.answer}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[11px] text-slate-500"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export function SupportCenterClient() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [openFaqId, setOpenFaqId] = useState<string | null>(null);

    const normalizedQuery = normalize(searchQuery);

    const filteredFAQs = useMemo(() => {
        return supportFaqItems.filter((item) => {
            const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
            const matchesSearch =
                normalizedQuery.length === 0 ||
                item.question.toLowerCase().includes(normalizedQuery) ||
                item.answer.toLowerCase().includes(normalizedQuery) ||
                item.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
            return matchesCategory && matchesSearch;
        });
    }, [normalizedQuery, selectedCategory]);

    const suggestedGuides = useMemo(() => {
        if (!normalizedQuery) return supportGuideSections.slice(0, 3);
        return supportGuideSections
            .filter((guide) => {
                const space = [guide.title, guide.summary, guide.audience, ...guide.bullets]
                    .join(' ')
                    .toLowerCase();
                return space.includes(normalizedQuery);
            })
            .slice(0, 3);
    }, [normalizedQuery]);

    return (
        <div className="space-y-12">
            {/* Quick-access cards */}
            <section>
                <h2 className="mb-4 text-base font-semibold text-slate-900">เข้าถึงด่วน</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {helpResources.map((resource) => (
                        <Link
                            key={resource.id}
                            href={resource.href}
                            target={resource.type === 'external' ? '_blank' : undefined}
                            rel={resource.type === 'external' ? 'noopener noreferrer' : undefined}
                            className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
                        >
                            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
                                <Icon icon={resource.icon} className="text-lg" />
                            </div>
                            <div>
                                <div className="flex items-center gap-1 text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                                    {resource.title}
                                    {resource.type === 'external' ? (
                                        <Icon icon="solar:arrow-right-up-linear" className="shrink-0 text-xs text-slate-400" />
                                    ) : null}
                                </div>
                                <p className="mt-0.5 text-xs leading-5 text-slate-500">{resource.description}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* FAQ with search */}
            <section>
                <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="text-base font-semibold text-slate-900">คำถามที่พบบ่อย</h2>
                    <span className="text-xs text-slate-400">{filteredFAQs.length} รายการ</span>
                </div>

                {/* Search input */}
                <div className="relative">
                    <Icon
                        icon="solar:magnifer-linear"
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400"
                    />
                    <input
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        placeholder="ค้นหา เช่น งาน, เช็คชื่อ, คิว, คะแนน, บัญชี..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery ? (
                        <button
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                            onClick={() => setSearchQuery('')}
                            aria-label="ล้างการค้นหา"
                        >
                            <Icon icon="solar:close-circle-bold" className="text-lg" />
                        </button>
                    ) : null}
                </div>

                {/* Category chips */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {supportCategories.map((cat) => (
                        <button
                            key={cat.key}
                            onClick={() => {
                                setSelectedCategory(cat.key);
                                setOpenFaqId(null);
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                selectedCategory === cat.key
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* FAQ accordion */}
                <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {filteredFAQs.length > 0 ? (
                        filteredFAQs.map((item) => (
                            <FaqAccordionItem
                                key={item.id}
                                item={item}
                                isOpen={openFaqId === item.id}
                                onToggle={() => setOpenFaqId(openFaqId === item.id ? null : item.id)}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center gap-3 py-14 text-center">
                            <Icon icon="solar:magnifer-broken" className="text-4xl text-slate-300" />
                            <div>
                                <p className="text-sm font-medium text-slate-600">ไม่พบคำถามที่ตรงกับคำค้นหา</p>
                                <p className="mt-1 text-xs text-slate-400">
                                    ลองค้นด้วยคำอื่น หรือเลือก “ทั้งหมด” แล้วติดต่อทีมสนับสนุนหากยังไม่พบคำตอบ
                                </p>
                            </div>
                            <Link
                                href="/support/contact"
                                className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                            >
                                <Icon icon="solar:chat-round-dots-linear" className="text-sm" />
                                ติดต่อทีมสนับสนุน
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* Suggested guides */}
            {suggestedGuides.length > 0 ? (
                <section>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-900">
                            {normalizedQuery ? 'คู่มือที่เกี่ยวข้อง' : 'คู่มือยอดนิยม'}
                        </h2>
                        <Link
                            href="/docs"
                            className="flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-700"
                        >
                            ดูทั้งหมด
                            <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
                        </Link>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {suggestedGuides.map((guide) => (
                            <Link
                                key={guide.id}
                                href={getGuideHref(guide.id)}
                                className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm"
                            >
                                <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-blue-50 group-hover:text-blue-600">
                                    <Icon icon={guide.icon} className="text-base" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                                        {guide.title}
                                    </p>
                                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
                                        {guide.summary}
                                    </p>
                                    <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                                        {guide.audience}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}

            {/* Response SLA */}
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">เวลาตอบกลับตามประเภทเคส</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                    {supportResponseLanes.map((lane) => (
                        <div
                            key={lane.title}
                            className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4"
                        >
                            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <Icon icon={lane.icon} className="text-lg" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-900">{lane.title}</p>
                                <p className="mt-0.5 text-xs font-medium text-blue-600">{lane.responseTime}</p>
                                <p className="mt-1.5 text-xs leading-5 text-slate-500">{lane.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="flex flex-col items-start gap-4 rounded-xl border border-blue-100 bg-blue-50 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-slate-900">ต้องการให้ทีมงานช่วยดูข้อมูลจริงในระบบ?</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                        อธิบายรายวิชา บทบาทของคุณในระบบ และสิ่งที่ติดขัด ทีมงานจะตอบกลับตามเวลาที่กำหนดไว้ด้านบน
                    </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Link
                        href="/support/contact"
                        className="inline-flex min-h-9 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                        ส่งคำขอสนับสนุน
                    </Link>
                    <Link
                        href="/security"
                        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                        แจ้งปัญหาความปลอดภัย
                    </Link>
                </div>
            </section>
        </div>
    );
}

export default SupportCenterClient;
