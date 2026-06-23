'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AppFooter } from '@/components/Footer';
import { publicFooterGroups } from '@/config/public-links';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';
import { useI18n } from '@/hooks/useI18n';

interface PublicPageShellProps {
    /** 'landing' = dark hero + full-width content (docs homepage style).
     *  'article'  = sidebar + content column (default). */
    variant?: 'landing' | 'article';
    eyebrow: string;
    title: string;
    description: string;
    icon: string;
    backHref?: string;
    backLabel?: string;
    actions?: React.ReactNode;
    /** Only rendered in article variant (right column). */
    heroPanel?: React.ReactNode;
    children: React.ReactNode;
}

const PUBLIC_GROUP_LABELS = {
    th: {
        'ช่วยเหลือและคู่มือ': 'ช่วยเหลือและคู่มือ',
        'นโยบายและความปลอดภัย': 'นโยบายและความปลอดภัย',
    },
    en: {
        'ช่วยเหลือและคู่มือ': 'Help and guides',
        'นโยบายและความปลอดภัย': 'Policies and security',
    },
} as const;

const PUBLIC_LINK_LABELS = {
    th: {
        support: 'ศูนย์ช่วยเหลือ',
        docs: 'คู่มือการใช้งาน',
        contact: 'ติดต่อทีมสนับสนุน',
        status: 'สถานะระบบ',
        terms: 'ข้อกำหนดการใช้งาน',
        privacy: 'นโยบายความเป็นส่วนตัว',
        cookies: 'นโยบายคุกกี้',
        security: 'แจ้งปัญหาความปลอดภัย',
    },
    en: {
        support: 'Help Center',
        docs: 'Documentation',
        contact: 'Contact Support',
        status: 'System Status',
        terms: 'Terms of Use',
        privacy: 'Privacy Policy',
        cookies: 'Cookie Policy',
        security: 'Security Reporting',
    },
} as const;

function getPublicGroupLabel(title: string, language: 'th' | 'en') {
    return PUBLIC_GROUP_LABELS[language][title as keyof typeof PUBLIC_GROUP_LABELS.th] ?? title;
}

function getPublicLinkLabel(link: { href: string; label: string; icon?: string }, language: 'th' | 'en') {
    const labels = PUBLIC_LINK_LABELS[language];

    if (link.href === '/support') return labels.support;
    if (link.href === '/docs') return labels.docs;
    if (link.href === '/support/contact') return labels.contact;
    if (link.href === '/terms') return labels.terms;
    if (link.href === '/privacy') return labels.privacy;
    if (link.href === '/cookies') return labels.cookies;
    if (link.href === '/security') return labels.security;
    if (link.icon === 'solar:server-path-bold') return labels.status;

    return link.label;
}

function SidebarNav({ pathname, onLinkClick }: { pathname: string; onLinkClick?: () => void }) {
    const t = useI18n();
    const { language } = useGlobalSettings();

    return (
        <nav aria-label={t('helpCenterNavigation')} className="space-y-7">
            {publicFooterGroups.map((group) => (
                <div key={group.title}>
                    <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        {getPublicGroupLabel(group.title, language)}
                    </p>
                    <ul className="space-y-0.5">
                        {group.links.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        onClick={onLinkClick}
                                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                                            isActive
                                                ? 'bg-blue-50 font-semibold text-blue-700'
                                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`}
                                    >
                                        {link.icon ? (
                                            <Icon
                                                icon={link.icon}
                                                className={`shrink-0 text-base ${isActive ? 'text-blue-500' : 'text-slate-400'}`}
                                            />
                                        ) : null}
                                        <span className="leading-5">{getPublicLinkLabel(link, language)}</span>
                                        {isActive ? (
                                            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                                        ) : null}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );
}

export function PublicPageShell({
    variant = 'article',
    eyebrow,
    title,
    description,
    icon,
    backHref = '/',
    backLabel,
    actions,
    heroPanel,
    children,
}: PublicPageShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();
    const t = useI18n();
    const { language } = useGlobalSettings();

    const isLanding = variant === 'landing';
    const resolvedBackLabel = backLabel ?? t('goHome');

    return (
        <div data-theme-scope="adaptive public" className="min-h-screen bg-white">

            {/* ── Sticky header ── */}
            <header className={`sticky top-0 z-40 border-b ${isLanding ? 'border-white/10 bg-[#0d1117]' : 'border-slate-200 bg-white/95 backdrop-blur-sm'}`}>
                <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
                    {/* Hamburger — article mode only */}
                    {!isLanding ? (
                        <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 lg:hidden"
                            onClick={() => setSidebarOpen(true)}
                            aria-label={t('openNavigationMenu')}
                        >
                            <Icon icon="solar:hamburger-menu-bold" className="text-xl" />
                        </button>
                    ) : null}

                    {/* Logo / wordmark */}
                    <Link href="/support" className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
                            <Icon icon="solar:question-circle-bold" className="text-sm" />
                        </span>
                        <span className={`text-sm font-semibold ${isLanding ? 'text-white' : 'text-slate-900'}`}>
                            {t('helpCenter')}
                        </span>
                    </Link>

                    {/* Breadcrumb — article mode */}
                    {!isLanding ? (
                        <>
                            <Icon icon="solar:alt-arrow-right-linear" className="hidden text-slate-300 sm:block" />
                            <span className="hidden truncate text-sm text-slate-500 sm:block">{eyebrow}</span>
                        </>
                    ) : null}

                    {/* Nav links — landing mode */}
                    {isLanding ? (
                        <nav className="ml-auto hidden items-center gap-5 md:flex">
                            {publicFooterGroups.flatMap((g) => g.links).slice(0, 4).map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`text-sm transition ${
                                        pathname === link.href
                                            ? 'font-semibold text-white'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {getPublicLinkLabel(link, language)}
                                </Link>
                            ))}
                        </nav>
                    ) : null}
                </div>
            </header>

            {/* ══════════════════════════════════════════
                LANDING VARIANT
            ══════════════════════════════════════════ */}
            {isLanding ? (
                <>
                    {/* Hero */}
                    <section className="border-b border-slate-800 bg-[#0d1117] pb-14 pt-14 sm:pb-16 sm:pt-16">
                        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                                <Icon icon={icon} className="text-sm" />
                                {eyebrow}
                            </span>
                            <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                                {title}
                            </h1>
                            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-400">
                                {description}
                            </p>
                            {actions ? (
                                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                                    {actions}
                                </div>
                            ) : null}
                        </div>
                    </section>

                    {/* Page body */}
                    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
                        {children}
                    </div>
                </>
            ) : null}

            {/* ══════════════════════════════════════════
                ARTICLE VARIANT
            ══════════════════════════════════════════ */}
            {!isLanding ? (
                <>
                    {/* Mobile sidebar overlay */}
                    {sidebarOpen ? (
                        <div className="fixed inset-0 z-50 lg:hidden">
                            <div
                                className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                                onClick={() => setSidebarOpen(false)}
                            />
                            <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white px-6 py-6 shadow-2xl">
                                <div className="mb-6 flex items-center justify-between">
                                    <Link
                                        href="/support"
                                        className="flex items-center gap-2 text-slate-900"
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
                                            <Icon icon="solar:question-circle-bold" className="text-sm" />
                                        </span>
                                        <span className="text-sm font-semibold">{t('helpCenter')}</span>
                                    </Link>
                                    <button
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100"
                                        onClick={() => setSidebarOpen(false)}
                                        aria-label={t('closeMenu')}
                                    >
                                        <Icon icon="solar:close-circle-bold" className="text-xl" />
                                    </button>
                                </div>
                                <SidebarNav pathname={pathname} onLinkClick={() => setSidebarOpen(false)} />
                            </aside>
                        </div>
                    ) : null}

                    {/* Sidebar + content */}
                    <div className="mx-auto max-w-7xl px-4 sm:px-6">
                        <div className="lg:flex lg:gap-10 xl:gap-14">

                            {/* Desktop sidebar */}
                            <aside className="hidden shrink-0 lg:block lg:w-52 xl:w-60">
                                <div className="sticky top-14 max-h-[calc(100vh-56px)] overflow-y-auto py-8 pr-2">
                                    <SidebarNav pathname={pathname} />
                                </div>
                            </aside>

                            {/* Content column */}
                            <div className="min-w-0 flex-1 py-8">
                                {/* Back link */}
                                <Link
                                    href={backHref}
                                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900"
                                >
                                    <Icon icon="solar:alt-arrow-left-linear" className="text-base" />
                                    {resolvedBackLabel}
                                </Link>

                                {/* Page header */}
                                <div className="mt-5 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
                                    <div className="min-w-0 flex-1">
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                            <Icon icon={icon} className="text-sm" />
                                            {eyebrow}
                                        </span>
                                        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                                            {title}
                                        </h1>
                                        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                                            {description}
                                        </p>
                                        {actions ? (
                                            <div className="mt-5 flex flex-wrap gap-3">{actions}</div>
                                        ) : null}
                                    </div>

                                    {heroPanel ? (
                                        <div className="shrink-0 lg:w-72 xl:w-80">{heroPanel}</div>
                                    ) : null}
                                </div>

                                <div className="my-8 border-t border-slate-200" />

                                {children}
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            <AppFooter />
        </div>
    );
}

export default PublicPageShell;

