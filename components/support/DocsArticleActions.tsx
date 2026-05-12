'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';

import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';

export function DocsArticleActions() {
    const [copied, setCopied] = useState(false);
    const { language } = useGlobalSettings();

    const copy = language === 'en'
        ? {
            copied: 'Copied',
            copyLink: 'Copy link',
            print: 'Print',
        }
        : {
            copied: 'คัดลอกแล้ว',
            copyLink: 'คัดลอกลิงก์',
            print: 'พิมพ์',
        };

    async function copyLink() {
        const href = window.location.href;

        try {
            await navigator.clipboard.writeText(href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    }

    function printArticle() {
        window.print();
    }

    return (
        <div className="flex flex-wrap gap-2">
            <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
                <Icon icon={copied ? 'solar:check-circle-bold-duotone' : 'solar:link-round-linear'} className="h-4 w-4" />
                {copied ? copy.copied : copy.copyLink}
            </button>
            <button
                type="button"
                onClick={printArticle}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
                <Icon icon="solar:printer-2-linear" className="h-4 w-4" />
                {copy.print}
            </button>
        </div>
    );
}
