"use client";

import { Icon } from "@iconify/react";
import type { ExamLifecycleStage } from "@/services/examScore.service";

interface ExamLifecycleStepperProps {
    stage: ExamLifecycleStage;
    isEnglish: boolean;
    compact?: boolean;
}

/**
 * ร่าง → ตรวจทาน → ประกาศแล้ว
 * draft: step 1 current. scheduled: steps 1-2 done, step 3 waiting.
 * published: all three done.
 */
export default function ExamLifecycleStepper({ stage, isEnglish, compact = false }: ExamLifecycleStepperProps) {
    const steps = [
        isEnglish ? "Draft" : "ร่าง",
        isEnglish ? "Review" : "ตรวจทาน",
        isEnglish ? "Published" : "ประกาศแล้ว",
    ];
    const currentIndex = stage === "published" ? 2 : stage === "scheduled" ? 1 : 0;
    const done = stage === "published";

    return (
        <ol aria-label={isEnglish ? "Publish steps" : "ขั้นตอนการประกาศ"} className="flex items-center">
            {steps.map((label, index) => {
                const reached = index <= currentIndex;
                const isCurrent = index === currentIndex && !done;
                const completed = done || index < currentIndex;
                const circleClass = completed
                    ? "bg-success text-white"
                    : isCurrent
                        ? "bg-primary text-white"
                        : "border-2 border-default-300 text-default-400";
                const textClass = completed
                    ? "text-success-700 dark:text-success-400"
                    : isCurrent
                        ? "text-primary font-semibold"
                        : "text-default-400";
                return (
                    <li key={label} className="flex items-center">
                        {index > 0 && (
                            <span aria-hidden="true" className={`mx-2 h-0.5 w-6 sm:w-8 ${reached ? "bg-success" : "bg-default-200"}`} />
                        )}
                        <span className={`flex items-center gap-1.5 text-xs sm:text-[13px] font-medium ${textClass}`}>
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${circleClass}`}>
                                {completed ? <Icon icon="solar:check-read-linear" width={13} /> : index + 1}
                            </span>
                            {!compact && <span>{label}</span>}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
