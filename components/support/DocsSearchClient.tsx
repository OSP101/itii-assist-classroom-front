'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import type { DocsArticle } from '@/types/docs';

type DocsCategory = {
    key: string;
    title: string;
    icon: string;
    description: string;
};

interface DocsSearchClientProps {
    articles: DocsArticle[];
    categories: DocsCategory[];
}

const audienceFilters = [
    { key: 'all', label: 'ทุกบทบาท', icon: 'solar:users-group-rounded-bold' },
    { key: 'นักศึกษา', label: 'นักศึกษา', icon: 'solar:user-id-bold' },
    { key: 'ผู้สอน', label: 'ผู้สอน / TA', icon: 'solar:diploma-bold' },
    { key: 'นโยบาย', label: 'นโยบาย', icon: 'solar:shield-check-bold' },
] as const;

const learningPaths = [
    {
        key: 'student',
        title: 'เส้นทางสำหรับนักศึกษา',
        description: 'เริ่มจากบัญชีและสิทธิ์ Browser แล้วต่อด้วยส่งงาน เช็คชื่อ เข้าคิว และติดตามคะแนน',
        icon: 'solar:user-id-bold-duotone',
        articles: ['student-step-by-step', 'getting-started', 'browser-permissions', 'attendance', 'queue-workflow', 'scores-appeals'],
    },
    {
        key: 'teacher',
        title: 'เส้นทางสำหรับผู้สอนและ TA',
        description: 'ใช้เป็น checklist ก่อนเปิดรายวิชา ดูงานหลักที่ต้องสื่อสารกับผู้เรียน และแนวทางรับมือเคส support',
        icon: 'solar:diploma-bold-duotone',
        articles: ['instructor-end-to-end', 'course-setup', 'role-permission-matrix', 'ta-operations', 'attendance', 'scores-appeals'],
    },
    {
        key: 'admin',
        title: 'เส้นทางสำหรับผู้ดูแลระบบ',
        description: 'ตรวจสิทธิ์ผู้ใช้ ตั้งค่ารายวิชา ติดตามสถานะ และรับมือเหตุขัดข้องอย่างเป็นระบบ',
        icon: 'solar:settings-bold-duotone',
        articles: ['system-capabilities', 'role-permission-matrix', 'course-setup', 'people-and-permissions', 'system-monitoring', 'ai-assistant-rules'],
    },
    {
        key: 'policy',
        title: 'เส้นทางด้านนโยบายและความปลอดภัย',
        description: 'รวมข้อกำหนด สิทธิ์การเข้าถึง ข้อมูลส่วนบุคคล และช่องทางแจ้งเหตุด้านความปลอดภัย',
        icon: 'solar:shield-keyhole-bold-duotone',
        articles: ['troubleshooting-guide', 'account-security', 'privacy-overview', 'browser-permissions', 'security-reporting', 'support-flow'],
    },
] as const;

function normalize(text: string) {
    return text.trim().toLowerCase();
}

function articleSearchText(article: DocsArticle) {
    return [
        article.title,
        article.description,
        article.categoryLabel,
        article.audience,
        article.readingTime,
        article.content,
        ...article.sections.map((section) => section.title),
    ]
        .join(' ')
        .toLowerCase();
}

export function DocsSearchClient({ articles, categories }: DocsSearchClientProps) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('all');
    const [audience, setAudience] = useState('all');

    const articleBySlug = useMemo(() => new Map(articles.map((article) => [article.slug, article])), [articles]);
    const normalizedQuery = normalize(query);

    const results = useMemo(() => {
        return articles.filter((article) => {
            const matchesQuery = !normalizedQuery || articleSearchText(article).includes(normalizedQuery);
            const matchesCategory = category === 'all' || article.category === category;
            const matchesAudience =
                audience === 'all' ||
                article.audience.includes(audience) ||
                article.categoryLabel.includes(audience);

            return matchesQuery && matchesCategory && matchesAudience;
        });
    }, [articles, audience, category, normalizedQuery]);

    return (
        <section className="border-b border-slate-200 pb-10">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-950">ค้นหาคู่มือและคำตอบ</h2>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                                ค้นด้วยคำที่ผู้ใช้พูดจริง เช่น ส่งงานไม่ได้, เปิดกล้อง, คะแนนไม่ขึ้น, ลืมรหัสผ่าน
                            </p>
                        </div>
                        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                            {results.length} จาก {articles.length} บทความ
                        </span>
                    </div>

                    <div className="relative mt-5">
                        <Icon
                            icon="solar:magnifer-linear"
                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400"
                        />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            placeholder="ค้นหาคู่มือ นโยบาย หรือปัญหาที่พบ..."
                        />
                        {query ? (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                aria-label="ล้างคำค้นหา"
                            >
                                <Icon icon="solar:close-circle-bold" className="text-lg" />
                            </button>
                        ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setCategory('all')}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                category === 'all'
                                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                        >
                            ทั้งหมด
                        </button>
                        {categories.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setCategory(item.key)}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                    category === item.key
                                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                <Icon icon={item.icon} className="text-sm" />
                                {item.title}
                            </button>
                        ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {audienceFilters.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setAudience(item.key)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    audience === item.key
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                <Icon icon={item.icon} className="text-sm" />
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="mt-5 divide-y divide-slate-200 rounded-lg border border-slate-200">
                        {results.length > 0 ? (
                            results.slice(0, 8).map((article) => (
                                <Link
                                    key={article.slug}
                                    href={`/docs/${article.slug}`}
                                    className="group block p-4 transition hover:bg-slate-50"
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600">
                                            <Icon icon={article.icon} className="text-lg" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-slate-950 group-hover:text-blue-700">
                                                    {article.title}
                                                </span>
                                                <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                                    {article.categoryLabel}
                                                </span>
                                            </span>
                                            <span className="mt-1 block text-sm leading-6 text-slate-600">
                                                {article.description}
                                            </span>
                                            <span className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                                <span>{article.audience}</span>
                                                <span>อ่าน {article.readingTime}</span>
                                                <span>อัปเดต {article.updatedAt}</span>
                                            </span>
                                        </span>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                                <Icon icon="solar:document-add-broken" className="text-4xl text-slate-300" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">ยังไม่พบบทความที่ตรงกับคำค้นหา</p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        ลองค้นด้วยคำอื่น หรือส่งคำถามให้ทีมสนับสนุนเพื่อเพิ่มบทความใหม่
                                    </p>
                                </div>
                                <Link
                                    href="/support/contact"
                                    className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                >
                                    <Icon icon="solar:chat-round-dots-bold-duotone" className="text-base" />
                                    ติดต่อทีมสนับสนุน
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {learningPaths.map((path) => (
                        <div key={path.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
                            <div className="flex items-start gap-3">
                                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                    <Icon icon={path.icon} className="text-xl" />
                                </span>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-950">{path.title}</h3>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">{path.description}</p>
                                </div>
                            </div>
                            <ol className="mt-4 space-y-2">
                                {path.articles.map((slug, index) => {
                                    const article = articleBySlug.get(slug);
                                    if (!article) return null;

                                    return (
                                        <li key={slug}>
                                            <Link
                                                href={`/docs/${article.slug}`}
                                                className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:text-blue-700"
                                            >
                                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-500">
                                                    {index + 1}
                                                </span>
                                                <span className="line-clamp-1">{article.title}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
