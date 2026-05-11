'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { publicPortalRoutes } from '@/config/public-links';

export function PublicPortalNav() {
    const pathname = usePathname();

    return (
        <div className="rounded-4xl border border-slate-200 bg-white/90 p-3 shadow-sm shadow-slate-200/60 backdrop-blur-sm">
            <div className="flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                <Icon icon="solar:widget-4-bold" className="text-sm" />
                Portal navigation
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {publicPortalRoutes.map((link) => {
                    const isActive = pathname === link.href;

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={`group min-w-fit rounded-3xl border px-4 py-3 transition ${
                                isActive
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/70'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-100 hover:bg-blue-50/50 hover:text-blue-600'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${isActive ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-blue-600'}`}>
                                    <Icon icon={link.icon ?? 'solar:link-bold'} className="text-lg" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold leading-5">{link.label}</span>
                                    <span className="block text-xs leading-5 text-slate-400 group-hover:text-slate-500">{link.groupTitle}</span>
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

export default PublicPortalNav;