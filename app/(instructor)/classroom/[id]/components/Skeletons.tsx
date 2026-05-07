import { Card, CardBody, CardHeader } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";

const MENU_SKELETON_WIDTHS = [112, 144, 128, 96, 120, 80];

export const SidebarMenuSkeleton = () => (
    <div className="space-y-1 p-3">
        {/* ภาพรวม is always visible, render it as active */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-blue-50">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-4 rounded-lg" style={{ width: 64 }} />
        </div>
        {/* Placeholder rows for permission-gated items */}
        {MENU_SKELETON_WIDTHS.map((w, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="h-4 rounded-lg" style={{ width: w }} />
            </div>
        ))}
    </div>
);

// ─── shared token ──────────────────────────────────────────────────────────
const SK_CARD = "bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm overflow-hidden";
const SK_HDR  = "flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-zinc-800";

function SkRow({ w, h = 4 }: { w: string; h?: number }) {
    return <Skeleton className={`h-${h} rounded-lg ${w}`} />;
}

export const OverviewSkeleton = () => (
    <div className="space-y-3 sm:space-y-4">

        {/* ── 1. Hero Course Header ── */}
        <div className={SK_CARD + " relative"}>
            <div className="p-4 sm:p-6">
                <div className="flex items-start gap-4">
                    <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex gap-2">
                            <Skeleton className="w-16 h-5 rounded-md" />
                            <Skeleton className="w-20 h-5 rounded-md" />
                            <Skeleton className="w-14 h-5 rounded-md" />
                        </div>
                        <Skeleton className="w-2/3 h-6 rounded-lg" />
                        <Skeleton className="w-1/3 h-4 rounded-lg" />
                    </div>
                    <div className="hidden lg:flex gap-2 shrink-0">
                        {[56, 64, 40].map(w => (
                            <Skeleton key={w} className={`h-7 rounded-lg`} style={{ width: w }} />
                        ))}
                    </div>
                </div>
                {/* mobile nav pills */}
                <div className="mt-3 flex lg:hidden gap-2">
                    {[48, 60, 40, 64].map(w => (
                        <Skeleton key={w} className="h-7 rounded-lg" style={{ width: w }} />
                    ))}
                </div>
            </div>
        </div>

        {/* ── 2. Metric Tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className={SK_CARD + " p-3 sm:p-4"}>
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <Skeleton className="w-8 h-8 rounded-lg" />
                        <Skeleton className="w-14 h-3.5 rounded" />
                    </div>
                    <Skeleton className="w-16 h-7 rounded-lg mb-1.5" />
                    <Skeleton className="w-24 h-3 rounded" />
                </div>
            ))}
        </div>

        {/* ── 3. Health + Action Center ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Health */}
            <div className={SK_CARD + " md:col-span-4"}>
                <div className={SK_HDR}>
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="w-28 h-4 rounded-lg" />
                </div>
                <div className="p-3 sm:p-4 flex flex-col items-center gap-4">
                    <Skeleton className="w-28 h-28 rounded-full" />
                    <Skeleton className="w-24 h-6 rounded-full" />
                    <div className="w-full space-y-2.5">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className="flex items-center gap-2">
                                <Skeleton className="w-14 h-3 rounded" />
                                <Skeleton className="flex-1 h-2 rounded-full" />
                                <Skeleton className="w-7 h-3 rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Action Center */}
            <div className={SK_CARD + " md:col-span-8 flex flex-col"}>
                <div className={SK_HDR}>
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="w-36 h-4 rounded-lg" />
                    <Skeleton className="w-5 h-5 rounded-full ml-1" />
                </div>
                <div className="flex-1 px-4 py-3 sm:px-5 sm:py-4 space-y-3">
                    {[80, 60, 72].map((w, i) => (
                        <div key={i} className="flex items-center gap-3 py-1 border-l-[3px] border-slate-200 pl-3">
                            <Skeleton className="w-2 h-2 rounded-full shrink-0" />
                            <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="flex gap-2">
                                    <Skeleton className={`h-4 rounded-lg`} style={{ width: w }} />
                                    <Skeleton className="w-10 h-4 rounded-md" />
                                </div>
                                <Skeleton className="w-40 h-3 rounded" />
                            </div>
                            <Skeleton className="w-14 h-7 rounded-lg shrink-0" />
                        </div>
                    ))}
                </div>
                <div className="px-4 pb-3 pt-2.5 sm:px-5 sm:pb-4 border-t border-slate-100 dark:border-zinc-800">
                    <Skeleton className="w-24 h-3 rounded mb-2" />
                    <div className="flex gap-2 flex-wrap">
                        {[64, 56, 52, 72, 80].map(w => (
                            <Skeleton key={w} className="h-8 rounded-xl" style={{ width: w }} />
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* ── 4. Smart Insights ── */}
        <div className={SK_CARD}>
            <div className={SK_HDR}>
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="w-28 h-4 rounded-lg" />
            </div>
            <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="min-h-[80px] sm:min-h-[96px] bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-l-4 border-slate-200/80 dark:border-zinc-700/50 border-l-slate-300 dark:border-l-zinc-600 p-3 sm:p-4 flex items-start gap-2.5">
                            <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="w-3/4 h-4 rounded-lg" />
                                <Skeleton className="w-full h-3 rounded" />
                                <Skeleton className="w-2/3 h-3 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* ── 5. Assignment Table + Activity ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Assignment Table */}
            <div className={SK_CARD + " lg:col-span-2 flex flex-col"}>
                <div className={SK_HDR}>
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="w-28 h-4 rounded-lg" />
                    <div className="ml-auto flex gap-1.5">
                        {[48, 36, 40].map(w => (
                            <Skeleton key={w} className="h-7 rounded-lg" style={{ width: w }} />
                        ))}
                    </div>
                </div>
                <div className="flex-1 p-4 space-y-2.5">
                    {/* header row */}
                    <div className="hidden md:flex gap-4 pb-2 border-b border-slate-100 dark:border-zinc-800">
                        {[200, 80, 70, 90].map(w => (
                            <Skeleton key={w} className="h-3 rounded" style={{ width: w }} />
                        ))}
                    </div>
                    {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="flex items-center gap-3 py-1">
                            <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton className="w-40 h-4 rounded-lg" />
                                <Skeleton className="w-20 h-3 rounded" />
                            </div>
                            <Skeleton className="w-10 h-4 rounded hidden md:block" />
                            <Skeleton className="w-8 h-4 rounded hidden md:block" />
                            <Skeleton className="w-20 h-2 rounded-full hidden md:block" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Activity Timeline */}
            <div className={SK_CARD + " flex flex-col"}>
                <div className={SK_HDR}>
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="w-24 h-4 rounded-lg" />
                </div>
                <div className="flex-1 p-4 space-y-3.5">
                    {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="flex items-start gap-3">
                            <Skeleton className="w-5 h-5 rounded-full shrink-0 mt-1" />
                            <div className="flex-1 bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 space-y-2">
                                <div className="flex gap-2">
                                    <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="w-full h-3 rounded" />
                                        <Skeleton className="w-3/4 h-3 rounded" />
                                    </div>
                                </div>
                                <Skeleton className="w-16 h-3 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* ── 6. Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {[0, 1].map(i => (
                <div key={i} className={SK_CARD}>
                    <div className={SK_HDR}>
                        <Skeleton className="w-4 h-4 rounded" />
                        <Skeleton className="w-32 h-4 rounded-lg" />
                    </div>
                    <div className="p-4">
                        <Skeleton className="w-full h-48 rounded-xl" />
                        <div className="flex gap-4 mt-3 justify-center">
                            {[40, 48, 36, 44].map(w => (
                                <div key={w} className="flex items-center gap-1.5">
                                    <Skeleton className="w-2.5 h-2.5 rounded-sm" />
                                    <Skeleton className="h-3 rounded" style={{ width: w }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* ── 7. Risk Students ── */}
        <div className={SK_CARD}>
            <div className={SK_HDR}>
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="w-32 h-4 rounded-lg" />
                <Skeleton className="w-16 h-5 rounded-full ml-1" />
            </div>
            <div className="p-4 space-y-2.5">
                <div className="hidden sm:flex gap-4 pb-2 border-b border-slate-100 dark:border-zinc-800">
                    {[160, 100, 70, 80, 120].map(w => (
                        <Skeleton key={w} className="h-3 rounded" style={{ width: w }} />
                    ))}
                </div>
                {[0, 1, 2].map(i => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <Skeleton className="w-32 h-4 rounded-lg" />
                            <Skeleton className="w-20 h-3 rounded" />
                        </div>
                        <Skeleton className="w-16 h-6 rounded-full shrink-0" />
                        <Skeleton className="w-8 h-4 rounded hidden sm:block" />
                        <Skeleton className="w-20 h-2 rounded-full hidden md:block" />
                        <Skeleton className="w-28 h-3 rounded hidden lg:block" />
                    </div>
                ))}
            </div>
        </div>

    </div>
);

export const PeopleTableSkeleton = () => (
    <Card className="shadow-sm border border-slate-200">
        <CardBody className="p-0">
            <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="w-32 h-4 rounded-lg" />
                            <Skeleton className="w-48 h-3 rounded-lg" />
                        </div>
                        <Skeleton className="w-20 h-6 rounded-full" />
                        <Skeleton className="w-8 h-8 rounded-lg" />
                    </div>
                ))}
            </div>
        </CardBody>
    </Card>
);

export const TeamsGridSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="shadow-sm border border-slate-200">
                <CardHeader className="px-4 py-3 bg-slate-100">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-8 h-8 rounded-lg" />
                            <Skeleton className="w-24 h-5 rounded-lg" />
                        </div>
                        <Skeleton className="w-8 h-8 rounded-lg" />
                    </div>
                </CardHeader>
                <CardBody className="px-4 py-3">
                    <div className="space-y-2">
                        {[1, 2, 3].map(j => (
                            <div key={j} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                                <Skeleton className="w-6 h-6 rounded-full" />
                                <Skeleton className="w-28 h-4 rounded-lg" />
                            </div>
                        ))}
                    </div>
                </CardBody>
            </Card>
        ))}
    </div>
);

export const SectionStudentsSkeleton = () => (
    <div className="space-y-4">
        {[1, 2].map(i => (
            <Card key={i} className="shadow-sm border border-slate-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-xl" />
                        <div className="space-y-1">
                            <Skeleton className="w-24 h-5 rounded-lg" />
                            <Skeleton className="w-32 h-3 rounded-lg" />
                        </div>
                    </div>
                    <Skeleton className="w-20 h-8 rounded-lg" />
                </div>
            </Card>
        ))}
    </div>
);

export const AssignmentsSkeleton = () => (
    <div className="space-y-4">
        <div className="flex justify-between items-center">
            <Skeleton className="w-32 h-8 rounded-lg" />
            <Skeleton className="w-24 h-10 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
                <Card key={i} className="shadow-sm border border-slate-200">
                    <CardBody className="p-4">
                        <Skeleton className="w-10 h-10 rounded-full mx-auto mb-2" />
                        <Skeleton className="w-8 h-6 rounded-lg mx-auto" />
                        <Skeleton className="w-16 h-3 rounded-lg mx-auto mt-1" />
                    </CardBody>
                </Card>
            ))}
        </div>
        <Card className="shadow-sm border border-slate-200">
            <CardBody className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50">
                        <Skeleton className="w-12 h-12 rounded-xl" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="w-48 h-5 rounded-lg" />
                            <Skeleton className="w-32 h-3 rounded-lg" />
                        </div>
                        <Skeleton className="w-16 h-6 rounded-full" />
                    </div>
                ))}
            </CardBody>
        </Card>
    </div>
);

export const ScoresSkeleton = () => (
    <div className="space-y-4">
        <Card className="shadow-sm border border-slate-200">
            <CardBody className="p-4">
                <Skeleton className="w-full h-14 rounded-xl" />
            </CardBody>
        </Card>
        <Card className="shadow-sm border border-slate-200">
            <CardHeader className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-4 w-full">
                    <Skeleton className="w-64 h-10 rounded-xl" />
                    <Skeleton className="w-32 h-10 rounded-xl" />
                </div>
            </CardHeader>
            <CardBody className="p-0">
                <div className="overflow-x-auto">
                    <div className="p-4 space-y-2">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50">
                                <Skeleton className="w-24 h-4 rounded-lg" />
                                <Skeleton className="w-32 h-4 rounded-lg" />
                                <Skeleton className="w-20 h-8 rounded-lg" />
                                <Skeleton className="w-16 h-4 rounded-lg" />
                            </div>
                        ))}
                    </div>
                </div>
            </CardBody>
        </Card>
    </div>
);

/** Generic skeleton for tabs that have a toolbar + list layout (Sections, Attendance, Queue, etc.) */
export const TabListSkeleton = () => (
    <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-9 rounded-xl flex-1 max-w-xs" />
            <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        {/* List rows */}
        <Card className="shadow-sm border border-slate-200">
            <CardBody className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50">
                        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 rounded-lg" style={{ width: `${55 + (i % 3) * 15}%` }} />
                            <Skeleton className="h-3 rounded-lg" style={{ width: `${35 + (i % 4) * 10}%` }} />
                        </div>
                        <Skeleton className="h-7 w-20 rounded-full" />
                    </div>
                ))}
            </CardBody>
        </Card>
    </div>
);
