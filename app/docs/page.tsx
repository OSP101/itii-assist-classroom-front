import type { Metadata } from 'next';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { DocsSearchClient } from '@/components/support/DocsSearchClient';
import { PublicPageShell } from '@/components/support/PublicPageShell';
import { docsCategoryGroups } from '@/config/docs-categories';
import { getAllDocs, getDocsByCategory } from '@/lib/docs.server';
import type { DocsArticle } from '@/types/docs';
import { getStatusLinkProps } from '@/config/status-provider';

export const metadata: Metadata = {
    title: 'คู่มือการใช้งาน',
    description:
        'คู่มือการใช้งาน ITII Assist Classroom สำหรับนักศึกษา ผู้ช่วยสอน ผู้สอน และผู้ดูแลระบบ',
};

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
    const docsArticles = getAllDocs();
    const featuredDocs = docsArticles.slice(0, 4);
    const popularDocs = docsArticles.slice(-4).reverse();

    return (
        <PublicPageShell
            variant="landing"
            eyebrow="Documentation"
            title="คู่มือการใช้งาน ITII Assist Classroom"
            description="รวมคู่มือแบบเป็นขั้นตอนสำหรับงานที่ผู้ใช้ทำจริง ครอบคลุมงาน เช็คชื่อ คิว คะแนน บัญชี ความปลอดภัย และนโยบายที่ควรทราบ"
            icon="solar:book-bookmark-bold"
            actions={
                <>
                    <Link
                        href="#docs-search"
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                    >
                        <Icon icon="solar:magnifer-linear" className="mr-2 text-base" />
                        ค้นหาคู่มือ
                    </Link>
                    <Link
                        href="/support/contact"
                        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400"
                    >
                        ติดต่อทีมสนับสนุน
                    </Link>
                    <Link
                        {...getStatusLinkProps()}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:text-white"
                    >
                        สถานะระบบ
                    </Link>
                </>
            }
        >
            <div id="docs-search">
                <DocsSearchClient articles={docsArticles} categories={[...docsCategoryGroups]} />
            </div>

            <section className="border-b border-slate-200 py-10">
                <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">สำรวจตามหมวดหมู่</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                            เลือกอ่านตามงานที่ต้องทำจริง เพื่อให้เจอขั้นตอนที่เกี่ยวข้องเร็วขึ้น
                        </p>
                    </div>
                    <Link href="/support/contact" className="text-sm font-semibold text-blue-600 hover:underline">
                        เสนอหัวข้อใหม่
                    </Link>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {docsCategoryGroups.map((cat) => (
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
                                {getDocsByCategory(cat.key).slice(0, 4).map((article) => (
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
                <ArticleList title="เริ่มต้นแนะนำ" articles={featuredDocs} />
                <ArticleList title="หัวข้อสำคัญ" articles={popularDocs} />
            </section>

            <section className="py-10">
                <h2 className="mb-5 text-lg font-semibold text-slate-900">บทความทั้งหมด</h2>
                <div className="grid gap-5 lg:grid-cols-2">
                    {docsCategoryGroups.map((cat) => (
                        <section key={cat.key} className="rounded-xl border border-slate-200 bg-white p-5">
                            <div className="mb-4 flex items-center gap-2">
                                <Icon icon={cat.icon} className="text-lg text-blue-600" />
                                <h3 className="text-sm font-semibold text-slate-900">{cat.title}</h3>
                            </div>
                            <ul className="space-y-2">
                                {getDocsByCategory(cat.key).map((article) => (
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
