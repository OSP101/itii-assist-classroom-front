import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { DocsSearchClient } from '@/components/support/DocsSearchClient';
import { PublicPageShell } from '@/components/support/PublicPageShell';
import { docsCategoryGroups } from '@/config/docs-categories';
import { getAllDocs, getDocsByCategory } from '@/lib/docs.server';
import { getRequestLanguage } from '@/lib/server-i18n';
import type { DocsArticle } from '@/types/docs';
import { getStatusLinkProps } from '@/config/status-provider';

function getDocsPageCopy(language: 'th' | 'en') {
    if (language === 'en') {
        return {
            metadataTitle: 'Documentation',
            metadataDescription: 'COCO LABS guides for students, teaching assistants, instructors, and administrators.',
            eyebrow: 'Documentation',
            title: 'COCO LABS documentation',
            description: 'Task-based guides for the workflows users actually do, covering assignments, attendance, queues, scores, accounts, security, and policies.',
            searchGuides: 'Search guides',
            contactSupport: 'Contact support',
            systemStatus: 'System status',
            exploreByCategory: 'Explore by category',
            exploreDescription: 'Read by the real task you need to complete so you can reach the relevant steps faster.',
            suggestTopic: 'Suggest a new topic',
            recommendedStart: 'Recommended start',
            importantTopics: 'Important topics',
            allArticles: 'All articles',
            categories: {
                start: {
                    title: 'Getting started',
                    description: 'Set up your account, confirm permissions, and get ready before real usage.',
                },
                student: {
                    title: 'For students',
                    description: 'Submit work, check attendance, join queues, and follow your scores.',
                },
                teaching: {
                    title: 'For instructors and TAs',
                    description: 'Manage courses, assignments, grades, attendance, queues, and activity logs.',
                },
                admin: {
                    title: 'For administrators',
                    description: 'Configure courses, users, access permissions, status monitoring, and incident review.',
                },
                policy: {
                    title: 'Policy and security',
                    description: 'Terms, privacy, cookies, browser permissions, and security reporting.',
                },
            },
        };
    }

    return {
        metadataTitle: 'คู่มือการใช้งาน',
        metadataDescription: 'คู่มือการใช้งาน COCO LABS สำหรับนักศึกษา ผู้ช่วยสอน ผู้สอน และผู้ดูแลระบบ',
        eyebrow: 'คู่มือการใช้งาน',
        title: 'คู่มือการใช้งาน COCO LABS',
        description: 'รวมคู่มือแบบเป็นขั้นตอนสำหรับงานที่ผู้ใช้ทำจริง ครอบคลุมงาน เช็กชื่อ คิว คะแนน บัญชี ความปลอดภัย และนโยบายที่ควรทราบ',
        searchGuides: 'ค้นหาคู่มือ',
        contactSupport: 'ติดต่อทีมสนับสนุน',
        systemStatus: 'สถานะระบบ',
        exploreByCategory: 'สำรวจตามหมวดหมู่',
        exploreDescription: 'เลือกอ่านตามงานที่ต้องทำจริง เพื่อให้เจอขั้นตอนที่เกี่ยวข้องเร็วขึ้น',
        suggestTopic: 'เสนอหัวข้อใหม่',
        recommendedStart: 'เริ่มต้นแนะนำ',
        importantTopics: 'หัวข้อสำคัญ',
        allArticles: 'บทความทั้งหมด',
        categories: {
            start: {
                title: 'เริ่มต้นใช้งาน',
                description: 'ตั้งค่าบัญชี ตรวจสอบสิทธิ์ และเตรียมความพร้อมก่อนใช้งานจริง',
            },
            student: {
                title: 'สำหรับนักศึกษา',
                description: 'ส่งงาน เช็กชื่อ เข้าคิว และติดตามคะแนนของตนเอง',
            },
            teaching: {
                title: 'สำหรับผู้สอนและ TA',
                description: 'จัดการรายวิชา งาน คะแนน เช็กชื่อ คิว และบันทึกกิจกรรม',
            },
            admin: {
                title: 'สำหรับผู้ดูแลระบบ',
                description: 'ตั้งค่ารายวิชา ผู้ใช้ สิทธิ์การเข้าถึง การติดตามสถานะ และการตรวจสอบเหตุการณ์',
            },
            policy: {
                title: 'นโยบายและความปลอดภัย',
                description: 'ข้อกำหนด ความเป็นส่วนตัว คุกกี้ สิทธิ์ browser และการรายงานเหตุ',
            },
        },
    };
}

export async function generateMetadata(): Promise<Metadata> {
    const language = await getRequestLanguage();
    const copy = getDocsPageCopy(language);

    return {
        title: copy.metadataTitle,
        description: copy.metadataDescription,
    };
}

function ArticleList({ title, articles }: { title: string; articles: DocsArticle[] }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <ul className="mt-3 divide-y divide-slate-100">
                {articles.map((article) => (
                    <li key={article.slug} className="py-3">
                        <Link href={`/docs/${article.slug}`} className="group block">
                            <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                                {article.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                                {article.description}
                            </p>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default async function DocsPage() {
    const language = await getRequestLanguage();
    const copy = getDocsPageCopy(language);
    const docsArticles = getAllDocs(language);
    const featuredDocs = docsArticles.slice(0, 4);
    const popularDocs = docsArticles.slice(-4).reverse();
    const translatedCategories = docsCategoryGroups.map((cat) => ({
        ...cat,
        title: copy.categories[cat.key as keyof typeof copy.categories]?.title ?? cat.title,
        description: copy.categories[cat.key as keyof typeof copy.categories]?.description ?? cat.description,
    }));

    return (
        <PublicPageShell
            variant="landing"
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            icon="solar:book-bookmark-bold"
            actions={
                <>
                    <Link
                        href="#docs-search"
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                    >
                        <Icon icon="solar:magnifer-linear" className="mr-2 text-base" />
                        {copy.searchGuides}
                    </Link>
                    <Link
                        href="/support/contact"
                        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400"
                    >
                        {copy.contactSupport}
                    </Link>
                    <Link
                        {...getStatusLinkProps()}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:text-white"
                    >
                        {copy.systemStatus}
                    </Link>
                </>
            }
        >
            <div id="docs-search">
                <DocsSearchClient articles={docsArticles} categories={translatedCategories} />
            </div>

            <section className="border-b border-slate-200 py-10">
                <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">{copy.exploreByCategory}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                            {copy.exploreDescription}
                        </p>
                    </div>
                    <Link href="/support/contact" className="text-sm font-semibold text-blue-600 hover:underline">
                        {copy.suggestTopic}
                    </Link>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {translatedCategories.map((cat) => (
                        <section key={cat.key} className="rounded-xl border border-slate-200 bg-white p-5">
                            <div className="flex items-start gap-3">
                                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                    <Icon icon={cat.icon} className="text-xl" />
                                </span>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">{cat.title}</h3>
                                    <p className="mt-1 text-sm leading-6 text-slate-500">{cat.description}</p>
                                </div>
                            </div>
                            <ul className="mt-4 space-y-2">
                                {getDocsByCategory(cat.key, language).slice(0, 4).map((article) => (
                                    <li key={article.slug}>
                                        <Link
                                            href={`/docs/${article.slug}`}
                                            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                                        >
                                            <span className="line-clamp-1">{article.title}</span>
                                            <Icon icon="solar:alt-arrow-right-linear" className="shrink-0 text-sm text-slate-400" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </section>

            <section className="grid gap-5 border-b border-slate-200 py-10 lg:grid-cols-2">
                <ArticleList title={copy.recommendedStart} articles={featuredDocs} />
                <ArticleList title={copy.importantTopics} articles={popularDocs} />
            </section>

            <section className="py-10">
                <h2 className="mb-5 text-lg font-semibold text-slate-900">{copy.allArticles}</h2>
                <div className="grid gap-5 lg:grid-cols-2">
                    {translatedCategories.map((cat) => (
                        <section key={cat.key} className="rounded-xl border border-slate-200 bg-white p-5">
                            <div className="mb-4 flex items-center gap-2">
                                <Icon icon={cat.icon} className="text-lg text-blue-600" />
                                <h3 className="text-sm font-semibold text-slate-900">{cat.title}</h3>
                            </div>
                            <ul className="space-y-2">
                                {getDocsByCategory(cat.key, language).map((article) => (
                                    <li key={article.slug}>
                                        <Link
                                            href={`/docs/${article.slug}`}
                                            className="group block rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/50"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                                                    {article.title}
                                                </span>
                                                <Icon icon="solar:alt-arrow-right-linear" className="shrink-0 text-base text-slate-400 group-hover:text-blue-500" />
                                            </div>
                                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                                {article.description}
                                            </p>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </section>
        </PublicPageShell>
    );
}
