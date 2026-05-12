"use client";

import { useState } from "react";
import { FeedbackModal } from "@/components/feedback";
import Link from "next/link";
import { useI18n } from "@/hooks/useI18n";

interface AppFooterProps {
    userEmail?: string;
}

export function AppFooter({ userEmail }: AppFooterProps) {
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const t = useI18n();

    return (
        <>
            <footer className="flex min-h-12 flex-col items-center justify-center gap-2 border-t border-divider bg-content1 px-4 py-3 text-[13px] text-default-500 lg:flex-row">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                    <Link href="/support" target="_blank" className="text-[13px] text-default-500 transition-colors hover:text-primary-500">{t("helpCenter")}</Link>
                    <span className="h-3 w-px bg-divider" />
                    <Link href="/status" target="_blank" className="text-[13px] text-default-500 transition-colors hover:text-primary-500">{t("systemStatus")}</Link>
                    <span className="h-3 w-px bg-divider" />
                    <Link href="/terms" target="_blank" className="text-[13px] text-default-500 transition-colors hover:text-primary-500">{t("termsOfUse")}</Link>
                    <span className="h-3 w-px bg-divider" />
                    <Link href="/security" target="_blank" className="text-[13px] text-default-500 transition-colors hover:text-primary-500">{t("securityReporting")}</Link>
                    <span className="h-3 w-px bg-divider" />
                    <Link href="/privacy" target="_blank" className="text-[13px] text-default-500 transition-colors hover:text-primary-500">{t("privacyPolicy")}</Link>
                </div>
                <span className="text-default-400">© 2026 ITII Assist Classroom. {t("allRightsReserved")}</span>
            </footer>
            <FeedbackModal
                isOpen={isFeedbackOpen}
                onClose={() => setIsFeedbackOpen(false)}
                userEmail={userEmail}
            />
        </>
    );
}

export default AppFooter;
