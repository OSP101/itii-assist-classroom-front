'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import {
    helpResources,
    supportCategories,
    supportFaqItems,
    supportResponseLanes,
} from '@/config/support-content';
import { getStatusLinkProps, statusLiveLink } from '@/config/status-provider';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';

/**
 * Slim shape of a docs article passed from the server — enough content
 * to score for search but without the full markdown body.
 */
export interface SupportDocLite {
    slug: string;
    title: string;
    description: string;
    category: string;
    categoryLabel: string;
    audience: string;
    icon: string;
    readingTime: string;
    updatedAt: string;
    sections: Array<{ id: string; title: string; level: number }>;
    excerpt: string;
}

interface SupportCenterClientProps {
    docs: SupportDocLite[];
}

type RoleKey = 'all' | 'student' | 'instructor' | 'ta' | 'admin';

/** Illustrated manual (COCO LABS v1.2.90) — deep links to the static site under /manual. */
const MANUAL_ROOT = '/docs/handbook';

interface ManualChapterLink {
    roleKey: Exclude<RoleKey, 'all'>;
    chapter: string;
    href: string;
    icon: string;
    accent: string;
}

const MANUAL_ROLE_CHAPTERS: ManualChapterLink[] = [
    {
        roleKey: 'student',
        chapter: 'ch19',
        href: `${MANUAL_ROOT}/ch19.html`,
        icon: 'solar:user-id-bold',
        accent: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
    },
    {
        roleKey: 'instructor',
        chapter: 'ch04',
        href: `${MANUAL_ROOT}/ch04.html`,
        icon: 'solar:diploma-bold',
        accent: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
    },
    {
        roleKey: 'ta',
        chapter: 'ch15',
        href: `${MANUAL_ROOT}/ch15.html`,
        icon: 'solar:user-check-bold',
        accent: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100',
    },
    {
        roleKey: 'admin',
        chapter: 'ch03',
        href: `${MANUAL_ROOT}/ch03.html`,
        icon: 'solar:settings-bold',
        accent: 'bg-violet-50 text-violet-600 group-hover:bg-violet-100',
    },
];

/** Root entrypoint — Next.js redirects `/docs/handbook` to the index.html so
 * relative asset paths in the static site resolve correctly. */
const MANUAL_INDEX = `${MANUAL_ROOT}/index.html`;

function getManualHrefForRole(roleKey: RoleKey): string {
    if (roleKey === 'all') return MANUAL_INDEX;
    const found = MANUAL_ROLE_CHAPTERS.find((c) => c.roleKey === roleKey);
    return found ? found.href : MANUAL_INDEX;
}

interface SearchResult {
    kind: 'faq' | 'doc';
    key: string;
    title: string;
    snippet: string;
    href: string;
    badge: string;
    icon: string;
    score: number;
    meta?: string;
}

function normalize(text: string) {
    return text.trim().toLowerCase();
}

function scoreMatch(haystack: string, needles: string[]): number {
    if (needles.length === 0) return 0;
    let score = 0;
    for (const needle of needles) {
        if (!needle) continue;
        const count = haystack.split(needle).length - 1;
        score += count * needle.length;
    }
    return score;
}

/** Assign a role bucket to a docs article using slug + audience text. */
function getDocRole(doc: SupportDocLite): RoleKey {
    const slug = doc.slug.toLowerCase();
    const audience = doc.audience.toLowerCase();

    if (slug.includes('student') || audience.includes('นักศึกษา') || audience.includes('student')) {
        return 'student';
    }
    if (slug.includes('instructor') || audience.includes('ผู้สอน') || audience.includes('instructor') || audience.includes('อาจารย์')) {
        return 'instructor';
    }
    if (slug.includes('ta') || audience.includes('ta') || audience.includes('ผู้ช่วยสอน')) {
        return 'ta';
    }
    if (
        slug.includes('role-permission') ||
        slug.includes('system-capabilities') ||
        slug.includes('admin') ||
        audience.includes('ผู้ดูแล') ||
        audience.includes('admin')
    ) {
        return 'admin';
    }
    return 'all';
}

/** Assign a rough role bucket to an FAQ item by category. */
function getFaqRole(category: string): RoleKey {
    switch (category) {
        case 'assignments':
        case 'attendance':
        case 'queue':
        case 'scores':
            return 'student';
        case 'security':
        case 'permissions':
        case 'account':
        case 'onboarding':
        default:
            return 'all';
    }
}

export function SupportCenterClient({ docs }: SupportCenterClientProps) {
    const { language } = useGlobalSettings();
    const [query, setQuery] = useState('');
    const [role, setRole] = useState<RoleKey>('all');
    const [category, setCategory] = useState('all');
    const [openFaqId, setOpenFaqId] = useState<string | null>(null);
    const deferredQuery = useDeferredValue(query);

    const copy = language === 'en' ? EN_COPY : TH_COPY;

    const localizedFaqs = useMemo(
        () =>
            language === 'en'
                ? supportFaqItems.map((item) => ({
                      ...item,
                      ...(FAQ_EN[item.id] ?? {}),
                  }))
                : supportFaqItems,
        [language],
    );

    /** Chip-style suggestion list — clicking sets the query. */
    const suggestions = copy.suggestions;

    /** Search over FAQs + docs top-level + docs sections. */
    const results = useMemo<SearchResult[]>(() => {
        const q = normalize(deferredQuery);
        if (!q) return [];
        const needles = q.split(/\s+/).filter(Boolean);

        const faqHits: SearchResult[] = localizedFaqs
            .filter((item) => role === 'all' || getFaqRole(item.category) === role || getFaqRole(item.category) === 'all')
            .map((item) => {
                const hay = `${item.question} ${item.answer} ${item.tags.join(' ')}`.toLowerCase();
                const score = scoreMatch(hay, needles);
                return {
                    kind: 'faq' as const,
                    key: `faq-${item.id}`,
                    title: item.question,
                    snippet: item.answer,
                    href: `#faq-${item.id}`,
                    badge: copy.badges.faq,
                    icon: 'solar:question-circle-bold',
                    score,
                    meta: item.tags.slice(0, 3).map((tag) => `#${tag}`).join(' '),
                };
            })
            .filter((hit) => hit.score > 0);

        const docHits: SearchResult[] = docs
            .filter((doc) => role === 'all' || getDocRole(doc) === role || getDocRole(doc) === 'all')
            .flatMap((doc) => {
                const hay = `${doc.title} ${doc.description} ${doc.categoryLabel} ${doc.audience} ${doc.excerpt}`.toLowerCase();
                const baseScore = scoreMatch(hay, needles);
                const topLevel: SearchResult | null =
                    baseScore > 0
                        ? {
                              kind: 'doc',
                              key: `doc-${doc.slug}`,
                              title: doc.title,
                              snippet: doc.description || doc.excerpt.slice(0, 160),
                              href: `/docs/${doc.slug}`,
                              badge: copy.badges.guide,
                              icon: doc.icon,
                              score: baseScore + 3,
                              meta: `${doc.audience} · ${doc.readingTime}`,
                          }
                        : null;

                const sectionHits = doc.sections
                    .map<SearchResult | null>((section) => {
                        const sectionHay = `${section.title} ${doc.title}`.toLowerCase();
                        const score = scoreMatch(sectionHay, needles);
                        if (score === 0) return null;
                        return {
                            kind: 'doc',
                            key: `doc-${doc.slug}-${section.id}`,
                            title: section.title,
                            snippet: `${copy.inGuide} ${doc.title}`,
                            href: `/docs/${doc.slug}#${section.id}`,
                            badge: copy.badges.section,
                            icon: 'solar:document-text-bold',
                            score,
                            meta: doc.categoryLabel,
                        };
                    })
                    .filter((x): x is SearchResult => x !== null);

                const combined: Array<SearchResult | null> = [topLevel, ...sectionHits];
                return combined.filter((x): x is SearchResult => x !== null);
            });

        return [...faqHits, ...docHits].sort((a, b) => b.score - a.score).slice(0, 12);
    }, [copy.badges, copy.inGuide, deferredQuery, docs, localizedFaqs, role]);

    /** Guides curated per role for the quick-access grid. */
    const rolePaths = useMemo(() => {
        return copy.roles.map((roleDef) => {
            const guides = docs
                .filter((doc) => (roleDef.key === 'all' ? true : getDocRole(doc) === roleDef.key))
                .slice(0, 3);
            return { ...roleDef, guides };
        });
    }, [copy.roles, docs]);

    const filteredFaqs = useMemo(() => {
        return localizedFaqs.filter((item) => {
            if (category !== 'all' && item.category !== category) return false;
            if (role !== 'all') {
                const bucket = getFaqRole(item.category);
                if (bucket !== role && bucket !== 'all') return false;
            }
            return true;
        });
    }, [category, localizedFaqs, role]);

    const featuredDocs = useMemo(() => {
        const filtered = role === 'all' ? docs : docs.filter((doc) => getDocRole(doc) === role || getDocRole(doc) === 'all');
        return filtered.slice(0, 6);
    }, [docs, role]);

    const handleSuggestionClick = useCallback((value: string) => {
        setQuery(value);
    }, []);

    return (
        <div className="-mt-14 space-y-14 sm:-mt-16">
            {/* ── Command bar (floats over the dark hero) ── */}
            <section aria-label={copy.searchAria} className="mx-auto max-w-4xl">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10 sm:p-6">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                        <Icon icon="solar:magic-stick-3-bold" className="text-sm text-blue-500" />
                        {copy.searchEyebrow}
                    </div>

                    <div className="relative mt-3">
                        <Icon
                            icon="solar:magnifer-linear"
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400"
                        />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                            placeholder={copy.searchPlaceholder}
                            autoComplete="off"
                            spellCheck={false}
                        />
                        {query ? (
                            <button
                                onClick={() => setQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                aria-label={copy.clearSearch}
                            >
                                <Icon icon="solar:close-circle-bold" className="text-lg" />
                            </button>
                        ) : null}
                    </div>

                    {/* Role tabs */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">{copy.roleLabel}</span>
                        {copy.roles.map((r) => {
                            const active = role === r.key;
                            return (
                                <button
                                    key={r.key}
                                    onClick={() => setRole(r.key)}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                        active
                                            ? 'bg-slate-900 text-white shadow'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    <Icon icon={r.icon} className="text-sm" />
                                    {r.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Suggestion chips */}
                    {!query ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-slate-400">{copy.tryLabel}</span>
                            {suggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    ) : null}

                    {/* Search results dropdown */}
                    {query ? (
                        <div className="mt-4 max-h-105 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                            {results.length > 0 ? (
                                <ul className="divide-y divide-slate-100">
                                    {results.map((result) => (
                                        <li key={result.key}>
                                            <Link
                                                href={result.href}
                                                className="group flex items-start gap-3 px-4 py-3 transition hover:bg-blue-50/60"
                                                onClick={() => {
                                                    if (result.kind === 'faq') {
                                                        const faqId = result.key.replace('faq-', '');
                                                        setOpenFaqId(faqId);
                                                    }
                                                }}
                                            >
                                                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600">
                                                    <Icon icon={result.icon} className="text-lg" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex flex-wrap items-center gap-2">
                                                        <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                                                            {result.title}
                                                        </span>
                                                        <span
                                                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                                                result.kind === 'faq'
                                                                    ? 'bg-amber-100 text-amber-700'
                                                                    : 'bg-blue-100 text-blue-700'
                                                            }`}
                                                        >
                                                            {result.badge}
                                                        </span>
                                                    </span>
                                                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
                                                        {result.snippet}
                                                    </span>
                                                    {result.meta ? (
                                                        <span className="mt-1 block text-[11px] text-slate-400">{result.meta}</span>
                                                    ) : null}
                                                </span>
                                                <Icon
                                                    icon="solar:alt-arrow-right-linear"
                                                    className="mt-2 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500"
                                                />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                                    <Icon icon="solar:magnifer-broken" className="text-4xl text-slate-300" />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700">{copy.noResultsTitle}</p>
                                        <p className="mt-1 text-xs text-slate-500">{copy.noResultsDescription}</p>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        <Link
                                            href="/docs"
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                                        >
                                            <Icon icon="solar:book-bookmark-linear" className="text-sm" />
                                            {copy.browseAll}
                                        </Link>
                                        <Link
                                            href="/support/contact"
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                                        >
                                            <Icon icon="solar:chat-round-dots-bold" className="text-sm" />
                                            {copy.askTeam}
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}

                    <p className="mt-3 text-[11px] text-slate-400">{copy.searchNote}</p>
                </div>
            </section>

            {/* ── Quick-access resource strip ── */}
            <section aria-label={copy.quickAccess}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {helpResources.map((resource) => {
                        const resourceCopy = copy.resources[resource.id as keyof typeof copy.resources];
                        return (
                            <Link
                                key={resource.id}
                                href={resource.href}
                                target={resource.type === 'external' ? '_blank' : undefined}
                                rel={resource.type === 'external' ? 'noopener noreferrer' : undefined}
                                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10"
                            >
                                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                                    <Icon icon={resource.icon} className="text-xl" />
                                </div>
                                <div className="mt-3 flex items-center gap-1 text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                                    {resourceCopy?.title ?? resource.title}
                                    {resource.type === 'external' ? (
                                        <Icon icon="solar:arrow-right-up-linear" className="text-xs text-slate-400" />
                                    ) : null}
                                </div>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {resourceCopy?.description ?? resource.description}
                                </p>
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* ── Manual highlight banner ── */}
            <section aria-label={copy.manual.aria}>
                <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50 via-white to-white p-6 sm:p-8">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-200/40 blur-3xl"
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-indigo-200/30 blur-3xl"
                    />

                    <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
                        <div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-sm shadow-blue-900/20">
                                <Icon icon="solar:star-bold" className="text-xs" />
                                {copy.manual.badge}
                            </span>
                            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
                                {copy.manual.title}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{copy.manual.description}</p>

                            <ul className="mt-4 flex flex-wrap gap-2">
                                {copy.manual.stats.map((stat) => (
                                    <li
                                        key={stat.label}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200"
                                    >
                                        <Icon icon={stat.icon} className="text-sm text-blue-500" />
                                        {stat.label}
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-5 flex flex-wrap gap-2">
                                <Link
                                    href={MANUAL_INDEX}
                                    target="_blank"
                                    rel="noopener"
                                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                                >
                                    <Icon icon="solar:book-2-bold" className="text-base" />
                                    {copy.manual.openIndex}
                                    <Icon icon="solar:arrow-right-up-linear" className="text-sm opacity-80" />
                                </Link>
                                <Link
                                    href={`${MANUAL_ROOT}/app-a.html`}
                                    target="_blank"
                                    rel="noopener"
                                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                                >
                                    <Icon icon="solar:key-square-2-linear" className="text-base" />
                                    {copy.manual.openPermissions}
                                </Link>
                                <Link
                                    href={`${MANUAL_ROOT}/app-d.html`}
                                    target="_blank"
                                    rel="noopener"
                                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                                >
                                    <Icon icon="solar:menu-dots-square-linear" className="text-base" />
                                    {copy.manual.openMenuMap}
                                </Link>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {MANUAL_ROLE_CHAPTERS.map((chapter) => {
                                const roleDef = copy.roles.find((r) => r.key === chapter.roleKey);
                                const label = copy.manual.byRole[chapter.roleKey];
                                return (
                                    <Link
                                        key={chapter.roleKey}
                                        href={chapter.href}
                                        target="_blank"
                                        rel="noopener"
                                        className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                                    >
                                        <span
                                            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${chapter.accent}`}
                                        >
                                            <Icon icon={chapter.icon} className="text-lg" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                                                    {roleDef?.label ?? chapter.roleKey}
                                                </p>
                                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                    {chapter.chapter}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
                                                {label}
                                            </p>
                                            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                                                {copy.manual.openChapter}
                                                <Icon icon="solar:arrow-right-up-linear" className="text-xs" />
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Role paths (jumps to the new manual) ── */}
            <section aria-label={copy.rolePathsTitle}>
                <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">{copy.rolePathsTitle}</h2>
                        <p className="mt-1 text-sm text-slate-500">{copy.rolePathsDescription}</p>
                    </div>
                    <Link
                        href="/docs"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                    >
                        {copy.openAllManuals}
                        <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
                    </Link>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {rolePaths
                        .filter((path) => path.key !== 'all')
                        .map((path) => (
                            <div
                                key={path.key}
                                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-md"
                            >
                                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${path.accent}`}>
                                    <Icon icon={path.icon} className="text-xl" />
                                </div>
                                <h3 className="mt-4 text-base font-semibold text-slate-900">{path.title}</h3>
                                <p className="mt-1 text-sm leading-6 text-slate-500">{path.description}</p>

                                <ul className="mt-4 space-y-1.5">
                                    {path.guides.length > 0 ? (
                                        path.guides.map((guide) => (
                                            <li key={guide.slug}>
                                                <Link
                                                    href={`/docs/${guide.slug}`}
                                                    className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                                                >
                                                    <span className="line-clamp-1">{guide.title}</span>
                                                    <Icon
                                                        icon="solar:alt-arrow-right-linear"
                                                        className="shrink-0 text-xs text-slate-300 transition group-hover:text-blue-500"
                                                    />
                                                </Link>
                                            </li>
                                        ))
                                    ) : (
                                        <li className="text-xs italic text-slate-400">{copy.noGuidesYet}</li>
                                    )}
                                </ul>

                                <div className="mt-auto space-y-2 pt-4">
                                    <Link
                                        href={getManualHrefForRole(path.key as RoleKey)}
                                        target="_blank"
                                        rel="noopener"
                                        className="group/manual inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                                    >
                                        <Icon icon="solar:book-2-linear" className="text-sm" />
                                        {copy.openInFullManual}
                                        <Icon
                                            icon="solar:arrow-right-up-linear"
                                            className="text-xs transition group-hover/manual:translate-x-0.5"
                                        />
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => setRole(path.key as RoleKey)}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-blue-600"
                                    >
                                        <Icon icon="solar:filter-linear" className="text-sm" />
                                        {copy.filterByRole.replace('{role}', path.label)}
                                    </button>
                                </div>
                            </div>
                        ))}
                </div>
            </section>

            {/* ── FAQ browse ── */}
            <section aria-label={copy.faqTitle}>
                <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">{copy.faqTitle}</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {copy.faqSubtitle.replace('{count}', String(filteredFaqs.length))}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {supportCategories.map((cat) => {
                        const active = category === cat.key;
                        return (
                            <button
                                key={cat.key}
                                onClick={() => {
                                    setCategory(cat.key);
                                    setOpenFaqId(null);
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                    active
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {copy.categories[cat.key as keyof typeof copy.categories] ?? cat.label}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {filteredFaqs.length > 0 ? (
                        filteredFaqs.map((item) => {
                            const isOpen = openFaqId === item.id;
                            return (
                                <div
                                    key={item.id}
                                    id={`faq-${item.id}`}
                                    className={`transition-colors ${isOpen ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}
                                >
                                    <button
                                        onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                                        aria-expanded={isOpen}
                                        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                                    >
                                        <span className={`text-sm font-semibold leading-6 ${isOpen ? 'text-blue-700' : 'text-slate-800'}`}>
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
                                        <div className="px-5 pb-5">
                                            <p className="text-sm leading-7 text-slate-600">{item.answer}</p>
                                            {item.tags.length > 0 ? (
                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {item.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-500"
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center gap-3 py-12 text-center">
                            <Icon icon="solar:inbox-linear" className="text-4xl text-slate-300" />
                            <p className="text-sm font-medium text-slate-600">{copy.faqEmpty}</p>
                            <Link
                                href="/support/contact"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                            >
                                <Icon icon="solar:chat-round-dots-linear" className="text-sm" />
                                {copy.askTeam}
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* ── Featured manual guides ── */}
            {featuredDocs.length > 0 ? (
                <section aria-label={copy.manualsTitle}>
                    <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">{copy.manualsTitle}</h2>
                            <p className="mt-1 text-sm text-slate-500">{copy.manualsSubtitle}</p>
                        </div>
                        <Link
                            href="/docs"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                        >
                            {copy.openAllManuals}
                            <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
                        </Link>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {featuredDocs.map((doc) => (
                            <Link
                                key={doc.slug}
                                href={`/docs/${doc.slug}`}
                                className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-md"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <Icon icon={doc.icon} className="text-lg" />
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                                        {doc.categoryLabel}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <p className="line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                                        {doc.title}
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{doc.description}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                                    <span className="inline-flex items-center gap-1">
                                        <Icon icon="solar:user-rounded-linear" className="text-sm" />
                                        {doc.audience}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <Icon icon="solar:clock-circle-linear" className="text-sm" />
                                        {doc.readingTime}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}

            {/* ── Response times ── */}
            <section aria-label={copy.responseTitle}>
                <div className="rounded-2xl border border-slate-200 bg-linear-to-br from-slate-50 to-white p-6">
                    <div className="mb-4 flex items-center gap-2">
                        <Icon icon="solar:clock-square-bold" className="text-lg text-blue-500" />
                        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">{copy.responseTitle}</h2>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                        {supportResponseLanes.map((lane) => {
                            const laneCopy = copy.lanes[lane.title as keyof typeof copy.lanes];
                            return (
                                <div key={lane.title} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                        <Icon icon={lane.icon} className="text-lg" />
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">{laneCopy?.title ?? lane.title}</p>
                                        <p className="mt-0.5 text-xs font-semibold text-blue-600">{laneCopy?.responseTime ?? lane.responseTime}</p>
                                        <p className="mt-1.5 text-xs leading-5 text-slate-500">{laneCopy?.description ?? lane.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="overflow-hidden rounded-2xl bg-linear-to-br from-blue-600 via-indigo-600 to-blue-700 text-white shadow-xl shadow-blue-900/20">
                <div className="grid gap-5 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-8">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-blue-100">{copy.ctaEyebrow}</p>
                        <h2 className="mt-1 text-xl font-bold sm:text-2xl">{copy.ctaTitle}</h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">{copy.ctaDescription}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Link
                            href="/support/contact"
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                        >
                            <Icon icon="solar:chat-round-dots-bold" className="text-base" />
                            {copy.submitCase}
                        </Link>
                        <Link
                            {...getStatusLinkProps()}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                        >
                            <Icon icon="solar:server-path-bold" className="text-base" />
                            {statusLiveLink.type === 'external' ? copy.viewStatusExternal : copy.viewStatusInternal}
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════
   Localized copy
   ══════════════════════════════════════════════════════════════════ */

const TH_COPY = {
    searchEyebrow: 'ค้นหาอัจฉริยะ',
    searchAria: 'ค้นหาคำตอบและคู่มือ',
    searchPlaceholder: 'พิมพ์ปัญหาที่พบ เช่น ส่งงานไม่ได้, ลืมรหัสผ่าน, เปิดกล้อง, คะแนนไม่ขึ้น',
    searchNote: 'ค้นครอบคลุมทั้งคำถามที่พบบ่อยและคู่มือฉบับเต็มของ COCO LABS โดยจัดอันดับตามความเกี่ยวข้องอัตโนมัติ',
    clearSearch: 'ล้างคำค้นหา',
    roleLabel: 'บทบาท:',
    tryLabel: 'ลอง:',
    suggestions: [
        'ส่งงานไม่ทัน',
        'เช็กชื่อไม่ได้',
        'ลืมรหัสผ่าน',
        'เปิดกล้องไม่ได้',
        'คะแนนไม่ขึ้น',
        'เข้าคิวยังไง',
    ],
    badges: {
        faq: 'คำถาม',
        guide: 'คู่มือ',
        section: 'หัวข้อ',
    },
    inGuide: 'อยู่ในคู่มือ:',
    noResultsTitle: 'ยังไม่พบผลลัพธ์',
    noResultsDescription: 'ลองใช้คำอื่นที่สั้นและตรงกับปัญหา หรือเปิดคู่มือทั้งหมด หากยังไม่พบให้ส่งเรื่องถึงทีมงานได้เลย',
    browseAll: 'เปิดคู่มือทั้งหมด',
    askTeam: 'ถามทีมงาน',
    quickAccess: 'เข้าถึงด่วน',
    rolePathsTitle: 'เริ่มต้นจากบทบาทของคุณ',
    rolePathsDescription: 'เลือกคู่มือที่ตรงกับหน้าที่ของคุณเพื่อเริ่มใช้งานได้ทันที ไม่ต้องอ่านทั้งหมด',
    openAllManuals: 'ดูคู่มือทั้งหมด',
    openInFullManual: 'อ่านในคู่มือฉบับเต็ม',
    noGuidesYet: 'ยังไม่มีคู่มือในกลุ่มนี้',
    filterByRole: 'กรองผลค้นหาสำหรับ{role}',
    manual: {
        aria: 'คู่มือฉบับสมบูรณ์ของ COCO LABS',
        badge: 'ใหม่',
        title: 'คู่มือฉบับสมบูรณ์ COCO LABS',
        description:
            'เอกสารฉบับใหม่ 19 บท + 4 ภาคผนวก มีภาพหน้าจอจริงประกอบทุกขั้นตอน ตรงกับระบบเวอร์ชัน 1.2.90 เปิดในแท็บใหม่ ค้นหาข้ามบทได้ในตัว',
        stats: [
            { label: '19 บท', icon: 'solar:book-2-linear' },
            { label: '4 ภาคผนวก', icon: 'solar:bookmark-linear' },
            { label: 'มีภาพหน้าจอทุกขั้นตอน', icon: 'solar:gallery-linear' },
            { label: 'ค้นหาในเอกสาร', icon: 'solar:magnifer-linear' },
        ],
        openIndex: 'เปิดสารบัญเต็ม',
        openPermissions: 'สิทธิ์รายวิชา 39 รายการ',
        openMenuMap: 'สรุปเมนูตามบทบาท',
        openChapter: 'เปิดบทนี้',
        byRole: {
            admin: 'ครอบคลุมแดชบอร์ด จัดการผู้ใช้ รายวิชา ห้องเรียน มอนิเตอร์ ประกาศ Feature Flags และการสำรองข้อมูล',
            instructor: 'เริ่มจากบทนำสำหรับอาจารย์ ครอบคลุมหมู่เรียน กลุ่ม สิทธิ์ TA งาน คะแนน คิว และจอแสดงผลหน้าห้อง',
            ta: 'เริ่มจากบทบาทและสิทธิ์ ต่อด้วยหน้ารับงาน Worker การให้คะแนน และคำขอแก้ไขคะแนน',
            student: 'ครอบคลุมเข้าสู่ระบบด้วย KKU Mail เช็กชื่อ QR/PIN จองคิวตรวจงาน ดูคะแนนและการแจ้งเตือน',
        },
    },
    faqTitle: 'คำถามที่พบบ่อย',
    faqSubtitle: 'ตรงเข้าคำตอบสั้น ๆ ที่ตอบผู้ใช้จริงในระบบ ({count} รายการ)',
    faqEmpty: 'ยังไม่มีคำถามในหมวดนี้ ลองเลือกหมวดอื่นหรือส่งเรื่องถึงทีมงาน',
    manualsTitle: 'คู่มือฉบับเต็มที่แนะนำ',
    manualsSubtitle: 'คัดจากคู่มือ COCO LABS ฉบับใหม่ ครอบคลุมงานจริงตั้งแต่เริ่มต้นถึงปิดเทอม',
    responseTitle: 'เวลาตอบกลับตามประเภทคำขอ',
    ctaEyebrow: 'ต้องการคำตอบจากทีมงาน',
    ctaTitle: 'อยากให้ทีมงานช่วยดูข้อมูลจริงในระบบ?',
    ctaDescription: 'แจ้งรายวิชา บทบาทของคุณ และสิ่งที่ติดขัด ทีมงานจะตอบกลับตามระยะเวลาที่กำหนดไว้ด้านบน พร้อมเก็บบันทึกทุกเรื่องอย่างเป็นระบบ',
    submitCase: 'ส่งคำขอสนับสนุน',
    viewStatusExternal: 'ดูสถานะระบบสด',
    viewStatusInternal: 'ดูสถานะระบบ',
    roles: [
        { key: 'all' as const, label: 'ทั้งหมด', icon: 'solar:widget-4-linear', description: '', accent: 'bg-slate-100 text-slate-600' },
        {
            key: 'student' as const,
            label: 'นักศึกษา',
            icon: 'solar:user-id-bold',
            title: 'สำหรับนักศึกษา',
            description: 'ส่งงาน เช็กชื่อ เข้าคิว ดูคะแนน และแก้ปัญหาเบื้องต้นด้วยตัวเอง',
            accent: 'bg-emerald-50 text-emerald-600',
        },
        {
            key: 'instructor' as const,
            label: 'อาจารย์',
            icon: 'solar:diploma-bold',
            title: 'สำหรับอาจารย์',
            description: 'ตั้งรายวิชา สร้างงาน คุมคิว และตรวจคะแนนอย่างเป็นระบบตั้งแต่ต้นเทอมถึงปิดเกรด',
            accent: 'bg-blue-50 text-blue-600',
        },
        {
            key: 'ta' as const,
            label: 'ผู้ช่วยสอน',
            icon: 'solar:user-check-bold',
            title: 'สำหรับผู้ช่วยสอน',
            description: 'ตรวจงาน จัดคิว ให้คะแนนตาม rubric และรายงานความคืบหน้าให้อาจารย์รายสัปดาห์',
            accent: 'bg-amber-50 text-amber-600',
        },
        {
            key: 'admin' as const,
            label: 'ผู้ดูแลระบบ',
            icon: 'solar:settings-bold',
            title: 'สำหรับผู้ดูแลระบบ',
            description: 'ตั้งค่าผู้ใช้ กำหนดสิทธิ์ ดูภาพรวมทั้งแพลตฟอร์ม และรับมือเหตุขัดข้อง',
            accent: 'bg-violet-50 text-violet-600',
        },
    ],
    resources: {
        docs: {
            title: 'คู่มือการใช้งาน',
            description: 'คู่มือฉบับใหม่แยกตามบทบาท เปิดอ่านเป็นขั้นตอนได้ทันที',
        },
        status: {
            title: 'สถานะระบบ',
            description: 'ตรวจสอบว่าระบบพร้อมใช้งาน มี maintenance หรือ incident หรือไม่',
        },
        contact: {
            title: 'ส่งเรื่องถึงทีมงาน',
            description: 'อธิบายปัญหาและบริบทของห้องเรียน ทีมงานจะตอบกลับภายในเวลาที่กำหนด',
        },
        security: {
            title: 'แจ้งปัญหาความปลอดภัย',
            description: 'ช่องทางแยกสำหรับช่องโหว่ บัญชีถูกยึด หรือพฤติกรรมผิดปกติ',
        },
    },
    categories: {
        all: 'ทั้งหมด',
        onboarding: 'เริ่มต้นใช้งาน',
        assignments: 'ส่งงาน',
        attendance: 'เช็กชื่อ',
        queue: 'คิว',
        scores: 'คะแนน',
        account: 'บัญชี',
        permissions: 'สิทธิ์เบราว์เซอร์',
        security: 'ความปลอดภัย',
        privacy: 'ข้อมูลส่วนบุคคล',
    } as Record<string, string>,
    lanes: {
        'General Support': {
            title: 'สนับสนุนทั่วไป',
            responseTime: 'ตอบกลับใน 24-48 ชม.',
            description: 'ปัญหาเข้าใช้งานทั่วไป รายวิชาไม่ขึ้น หรือคำถามเชิงขั้นตอนการใช้งาน',
        },
        'Learning Workflow': {
            title: 'งานการเรียนการสอน',
            responseTime: 'ภายในวันทำการถัดไป',
            description: 'ส่งงาน เช็กชื่อ คิว คะแนน และเรื่องที่ต้องประสานกับอาจารย์ผู้สอน',
        },
        'Security & Abuse': {
            title: 'ความปลอดภัยและการใช้ผิดปกติ',
            responseTime: 'รับเรื่องเร่งด่วนทันที',
            description: 'บัญชีถูกยึด ข้อมูลรั่วไหล หรือพฤติกรรมผิดปกติที่ต้อง triage โดยเร็ว',
        },
    } as Record<string, { title: string; responseTime: string; description: string }>,
};

const EN_COPY: typeof TH_COPY = {
    searchEyebrow: 'Smart search',
    searchAria: 'Search answers and manuals',
    searchPlaceholder: 'Describe the issue, e.g. can’t submit, forgot password, enable camera, score missing',
    searchNote: 'Searches both the FAQ and the full COCO LABS manuals, ranked by relevance automatically.',
    clearSearch: 'Clear search',
    roleLabel: 'Role:',
    tryLabel: 'Try:',
    suggestions: [
        'can’t submit',
        'attendance failed',
        'forgot password',
        'enable camera',
        'score missing',
        'join queue',
    ],
    badges: {
        faq: 'FAQ',
        guide: 'Manual',
        section: 'Section',
    },
    inGuide: 'In manual:',
    noResultsTitle: 'No matches yet',
    noResultsDescription: 'Try shorter, more specific keywords, browse the full manuals, or send the case to the team.',
    browseAll: 'Browse manuals',
    askTeam: 'Ask the team',
    quickAccess: 'Quick access',
    rolePathsTitle: 'Start from your role',
    rolePathsDescription: 'Pick a manual that matches your role so you can jump straight to the workflow you need.',
    openAllManuals: 'All manuals',
    openInFullManual: 'Open in full manual',
    noGuidesYet: 'No manuals published for this role yet.',
    filterByRole: 'Filter search for {role}',
    manual: {
        aria: 'Full COCO LABS manual',
        badge: 'New',
        title: 'The full illustrated COCO LABS manual',
        description:
            '19 chapters + 4 appendices with real screenshots for every step, matched to system v1.2.90. Opens in a new tab with built-in cross-chapter search.',
        stats: [
            { label: '19 chapters', icon: 'solar:book-2-linear' },
            { label: '4 appendices', icon: 'solar:bookmark-linear' },
            { label: 'Screenshots included', icon: 'solar:gallery-linear' },
            { label: 'In-doc search', icon: 'solar:magnifer-linear' },
        ],
        openIndex: 'Open full table of contents',
        openPermissions: '39 course permissions',
        openMenuMap: 'Menu map by role',
        openChapter: 'Open this chapter',
        byRole: {
            admin: 'Dashboard, user management, courses, classrooms, monitoring, announcements, feature flags, and backups.',
            instructor: 'Starts with the instructor introduction — sections, groups, TA permissions, assignments, scores, queues, and room displays.',
            ta: 'Starts with the TA role & permissions, then the Worker inbox, grading, and score-edit requests.',
            student: 'KKU Mail sign-in, QR/PIN attendance, queue booking, scores, groups, and notifications.',
        },
    },
    faqTitle: 'Frequently asked questions',
    faqSubtitle: 'Straight-to-the-point answers to real user questions ({count} items).',
    faqEmpty: 'Nothing in this category yet — pick another or open a support case.',
    manualsTitle: 'Recommended manuals',
    manualsSubtitle: 'Highlights from the new COCO LABS manuals — end-to-end coverage of real classroom workflows.',
    responseTitle: 'Response times by case type',
    ctaEyebrow: 'Need a human',
    ctaTitle: 'Need the team to look at live data?',
    ctaDescription: 'Tell us the course, your role, and what’s blocking you. The team responds within the targets above and tracks every case.',
    submitCase: 'Open a support case',
    viewStatusExternal: 'View live status',
    viewStatusInternal: 'View system status',
    roles: [
        { key: 'all' as const, label: 'All', icon: 'solar:widget-4-linear', description: '', accent: 'bg-slate-100 text-slate-600' },
        {
            key: 'student' as const,
            label: 'Students',
            icon: 'solar:user-id-bold',
            title: 'For students',
            description: 'Submit work, check in, join queues, follow scores, and troubleshoot on your own.',
            accent: 'bg-emerald-50 text-emerald-600',
        },
        {
            key: 'instructor' as const,
            label: 'Instructors',
            icon: 'solar:diploma-bold',
            title: 'For instructors',
            description: 'Run courses, publish work, manage queues, and process scores from launch to close.',
            accent: 'bg-blue-50 text-blue-600',
        },
        {
            key: 'ta' as const,
            label: 'TAs',
            icon: 'solar:user-check-bold',
            title: 'For teaching assistants',
            description: 'Grade with rubrics, keep queues moving, and give instructors weekly signals.',
            accent: 'bg-amber-50 text-amber-600',
        },
        {
            key: 'admin' as const,
            label: 'Admins',
            icon: 'solar:settings-bold',
            title: 'For administrators',
            description: 'Manage users, permissions, platform health, and incident response.',
            accent: 'bg-violet-50 text-violet-600',
        },
    ],
    resources: {
        docs: {
            title: 'Documentation',
            description: 'Role-based manuals you can open and follow step by step.',
        },
        status: {
            title: 'System status',
            description: 'Check availability, maintenance windows, and live incidents.',
        },
        contact: {
            title: 'Contact the team',
            description: 'Describe the issue with course context and get a response within SLA.',
        },
        security: {
            title: 'Report a security issue',
            description: 'Dedicated lane for vulnerabilities, account takeover, and abuse.',
        },
    },
    categories: {
        all: 'All',
        onboarding: 'Getting started',
        assignments: 'Assignments',
        attendance: 'Attendance',
        queue: 'Queues',
        scores: 'Scores',
        account: 'Account',
        permissions: 'Browser permissions',
        security: 'Security',
        privacy: 'Privacy',
    },
    lanes: {
        'General Support': {
            title: 'General support',
            responseTime: 'Reply in 24-48 hours',
            description: 'General access issues, missing courses, and questions about how to use the platform.',
        },
        'Learning Workflow': {
            title: 'Learning workflow',
            responseTime: 'Next business day',
            description: 'Assignments, attendance, queues, scores, and coordination with instructors.',
        },
        'Security & Abuse': {
            title: 'Security & abuse',
            responseTime: 'Urgent intake',
            description: 'Account takeover, data exposure, or abnormal usage that needs immediate triage.',
        },
    },
};

/* ══════════════════════════════════════════════════════════════════
   English overrides for the FAQ items (kept local to this component).
   ══════════════════════════════════════════════════════════════════ */

const FAQ_EN: Record<string, { question: string; answer: string; tags: string[] }> = {
    'onboarding-1': {
        question: 'What should I do the first time I sign in?',
        answer:
            'Sign in with the account authorized for you, confirm your course list is complete, and reset your password if prompted before using the role-specific menus.',
        tags: ['login', 'password', 'first-time', 'account'],
    },
    'assignments-1': {
        question: 'How do I confirm every file was received after submission?',
        answer:
            'Open the assignment detail page and verify the submission time, attached file names, and current status. Resubmit before the deadline if anything is missing.',
        tags: ['assignment', 'files', 'deadline', 'submit'],
    },
    'assignments-2': {
        question: 'Which file types and sizes are supported?',
        answer:
            'Documents, slides, images, and compressed files are generally supported, matching the instructor’s settings. Compress or split unusually large files before uploading.',
        tags: ['upload', 'pdf', 'zip', 'documents'],
    },
    'attendance-1': {
        question: 'What if I miss the attendance window?',
        answer:
            'Contact the instructor or submit an attendance correction request with the reason and the time of the incident so it can be reviewed case by case.',
        tags: ['attendance', 'late', 'session'],
    },
    'attendance-2': {
        question: 'What do the attendance statuses mean?',
        answer:
            'Statuses include present, absent, late, leave, and sick, plus any additional states the instructor configured for the course.',
        tags: ['status', 'present', 'late', 'leave'],
    },
    'queue-1': {
        question: 'Can I rejoin a queue after leaving?',
        answer:
            'Yes, but your new position uses your rejoin time. Decide before your turn is called so other people are not affected.',
        tags: ['queue', 'order', 'cancel'],
    },
    'queue-2': {
        question: 'What can instructors see in the queue?',
        answer:
            'Instructors and TAs see your order, name, and the context you entered so they can prepare their review or guidance quickly.',
        tags: ['ta', 'teacher', 'queue-info'],
    },
    'scores-1': {
        question: 'What should a score appeal include so it moves faster?',
        answer:
            'Include the course, the related assignment, the score you saw, why you believe it is off, and supporting evidence such as screenshots or reference files.',
        tags: ['score', 'appeal', 'evidence'],
    },
    'scores-2': {
        question: 'Where do I check the final score?',
        answer:
            'The course scores tab is the source of truth — it reflects the latest score and the outcome of any score appeals.',
        tags: ['final-score', 'grade', 'overall'],
    },
    'account-1': {
        question: 'What if I forgot my password?',
        answer:
            'Use the forgot-password flow on the sign-in page and check the email address linked to your account. Contact support if the email does not arrive within a reasonable time.',
        tags: ['forgot-password', 'reset', 'email'],
    },
    'account-2': {
        question: 'Why doesn’t my course appear on the home page even though I enrolled?',
        answer:
            'First confirm you signed in with the right account. If the course is still missing, send the course code, section, and your email to support or to the instructor.',
        tags: ['course-access', 'permissions', 'enrollment'],
    },
    'account-3': {
        question: 'Can I change my profile photo or personal details?',
        answer:
            'Yes, from the profile and settings pages. Keep your email and contact details current so the team can reach you correctly.',
        tags: ['profile', 'avatar', 'settings'],
    },
    'permissions-1': {
        question: 'Why does the platform ask for location, camera, or notifications?',
        answer:
            'Location is used only for attendance scenarios that require area verification, the camera is used for QR scanning, and notifications cover important queue, score, and system events.',
        tags: ['location', 'camera', 'notifications', 'permissions'],
    },
    'security-0': {
        question: 'When should I enable 2FA?',
        answer:
            '2FA is strongly recommended for instructor, TA, and admin accounts, plus any student account that handles sensitive data or is used on multiple devices.',
        tags: ['2fa', 'totp', 'backup-codes'],
    },
    'security-1': {
        question: 'What should I do immediately if my account or session looks suspicious?',
        answer:
            'Change your password, sign out of devices you do not recognize, and report the incident through the Security page with the time and symptoms you observed.',
        tags: ['security', 'session', 'account-takeover'],
    },
    'security-2': {
        question: 'Where should I report a vulnerability?',
        answer:
            'Use the security reporting page or email support with the subject prefix [SECURITY]. Avoid public disclosure before the issue has been fixed.',
        tags: ['vulnerability', 'report', 'responsible-disclosure'],
    },
    'support-1': {
        question: 'What should I prepare before opening a support case?',
        answer:
            'At minimum include the course name, the time of the issue, the browser or device you used, the steps that led to the problem, and screenshots when available.',
        tags: ['support', 'checklist', 'bug-report'],
    },
};

export default SupportCenterClient;
