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

export const OverviewSkeleton = () => (
    <div className="space-y-6">
        {/* Course Detail Card Skeleton */}
        <Card className="shadow-sm border border-slate-200 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 overflow-hidden">
            <CardBody className="p-5">
                <div className="flex flex-col md:flex-row gap-5">
                    <Skeleton className="w-full md:w-32 h-32 rounded-xl" />
                    <div className="flex-1 space-y-3">
                        <div className="flex gap-2">
                            <Skeleton className="w-20 h-6 rounded-full" />
                            <Skeleton className="w-24 h-6 rounded-full" />
                        </div>
                        <Skeleton className="w-3/4 h-8 rounded-lg" />
                        <Skeleton className="w-1/2 h-4 rounded-lg" />
                        <Skeleton className="w-40 h-4 rounded-lg" />
                    </div>
                    <div className="flex md:flex-col gap-4 justify-around md:border-l md:border-white/20 md:pl-5">
                        <div className="text-center space-y-1">
                            <Skeleton className="w-12 h-8 rounded-lg mx-auto" />
                            <Skeleton className="w-16 h-3 rounded-lg" />
                        </div>
                        <div className="text-center space-y-1">
                            <Skeleton className="w-12 h-8 rounded-lg mx-auto" />
                            <Skeleton className="w-16 h-3 rounded-lg" />
                        </div>
                    </div>
                </div>
            </CardBody>
        </Card>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map(i => (
                <Card key={i} className="shadow-sm border border-slate-200">
                    <CardHeader className="px-5 py-4 border-b border-slate-100">
                        <Skeleton className="w-32 h-5 rounded-lg" />
                    </CardHeader>
                    <CardBody className="px-5 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map(j => (
                                <div key={j} className="text-center p-3 rounded-xl bg-slate-50">
                                    <Skeleton className="w-10 h-10 rounded-full mx-auto mb-2" />
                                    <Skeleton className="w-8 h-6 rounded-lg mx-auto mb-1" />
                                    <Skeleton className="w-16 h-3 rounded-lg mx-auto" />
                                </div>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            ))}
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
