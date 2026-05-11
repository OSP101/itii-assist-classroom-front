'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import Link from 'next/link';

type FeedbackState = 'helpful' | 'missing' | null;

export function DocsArticleFeedback({ articleTitle }: { articleTitle: string }) {
    const [feedback, setFeedback] = useState<FeedbackState>(null);

    if (feedback) {
        return (
            <section className="mt-10 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
                <div className="flex items-start gap-3">
                    <Icon icon="solar:check-circle-bold-duotone" className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                        <h2 className="text-base font-semibold">
                            {feedback === 'helpful' ? 'ขอบคุณสำหรับ feedback' : 'รับทราบแล้วครับ'}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-emerald-800">
                            {feedback === 'helpful'
                                ? 'ข้อมูลนี้ช่วยให้ทีมงานรู้ว่าบทความยังตอบโจทย์ผู้ใช้อยู่'
                                : 'หากบทความนี้ยังไม่พอ สามารถส่งเคสให้ทีมงานพร้อมรายละเอียดเพิ่มเติมได้ทันที'}
                        </p>
                        {feedback === 'missing' ? (
                            <Link
                                href={`/support/contact?topic=${encodeURIComponent(articleTitle)}`}
                                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                            >
                                <Icon icon="solar:chat-round-dots-bold-duotone" className="h-4 w-4" />
                                ส่งคำถามเพิ่มเติม
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
                    <h2 className="text-base font-semibold text-slate-950">บทความนี้ช่วยตอบคำถามได้หรือไม่?</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                        Feedback นี้ใช้เพื่อปรับปรุงคู่มือและลำดับบทความให้ตรงกับปัญหาที่ผู้ใช้พบจริง
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setFeedback('helpful')}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
                    >
                        <Icon icon="solar:like-bold-duotone" className="h-4 w-4" />
                        ช่วยได้
                    </button>
                    <button
                        type="button"
                        onClick={() => setFeedback('missing')}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-200 hover:text-amber-700"
                    >
                        <Icon icon="solar:dislike-bold-duotone" className="h-4 w-4" />
                        ยังไม่พอ
                    </button>
                </div>
            </div>
        </section>
    );
}
