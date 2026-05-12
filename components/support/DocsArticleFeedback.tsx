'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';

type FeedbackState = 'helpful' | 'missing' | null;

export function DocsArticleFeedback({ articleTitle }: { articleTitle: string }) {
    const [feedback, setFeedback] = useState<FeedbackState>(null);
    const { language } = useGlobalSettings();

    const copy = language === 'en'
        ? {
            helpfulTitle: 'Thanks for the feedback',
            missingTitle: 'Noted',
            helpfulDescription: 'This helps the team know that the article is still solving real user problems.',
            missingDescription: 'If this article is still not enough, you can send the team a case with more context right away.',
            sendQuestion: 'Send a follow-up question',
            promptTitle: 'Did this article answer your question?',
            promptDescription: 'This feedback is used to improve the guide and the article ordering based on real user problems.',
            helpful: 'Helpful',
            missing: 'Still not enough',
        }
        : {
            helpfulTitle: 'ขอบคุณสำหรับ feedback',
            missingTitle: 'รับทราบแล้วครับ',
            helpfulDescription: 'ข้อมูลนี้ช่วยให้ทีมงานรู้ว่าบทความยังตอบโจทย์ผู้ใช้อยู่',
            missingDescription: 'หากบทความนี้ยังไม่พอ สามารถส่งเคสให้ทีมงานพร้อมรายละเอียดเพิ่มเติมได้ทันที',
            sendQuestion: 'ส่งคำถามเพิ่มเติม',
            promptTitle: 'บทความนี้ช่วยตอบคำถามได้หรือไม่?',
            promptDescription: 'Feedback นี้ใช้เพื่อปรับปรุงคู่มือและลำดับบทความให้ตรงกับปัญหาที่ผู้ใช้พบจริง',
            helpful: 'ช่วยได้',
            missing: 'ยังไม่พอ',
        };

    if (feedback) {
        return (
            <section className="mt-10 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
                <div className="flex items-start gap-3">
                    <Icon icon="solar:check-circle-bold-duotone" className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                        <h2 className="text-base font-semibold">
                            {feedback === 'helpful' ? copy.helpfulTitle : copy.missingTitle}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-emerald-800">
                            {feedback === 'helpful'
                                ? copy.helpfulDescription
                                : copy.missingDescription}
                        </p>
                        {feedback === 'missing' ? (
                            <Link
                                href={`/support/contact?topic=${encodeURIComponent(articleTitle)}`}
                                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                            >
                                <Icon icon="solar:chat-round-dots-bold-duotone" className="h-4 w-4" />
                                {copy.sendQuestion}
                            </Link>
                        ) : null}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-base font-semibold text-slate-950">{copy.promptTitle}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                        {copy.promptDescription}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setFeedback('helpful')}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
                    >
                        <Icon icon="solar:like-bold-duotone" className="h-4 w-4" />
                        {copy.helpful}
                    </button>
                    <button
                        type="button"
                        onClick={() => setFeedback('missing')}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-200 hover:text-amber-700"
                    >
                        <Icon icon="solar:dislike-bold-duotone" className="h-4 w-4" />
                        {copy.missing}
                    </button>
                </div>
            </div>
        </section>
    );
}
