import { ProSkeleton } from "@/components/ui/pro-skeleton";

export default function Loading() {
    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_38%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-8">
            <div className="mx-auto max-w-4xl space-y-6">
                <ProSkeleton variant="hero" className="h-36 rounded-[28px]" />
                <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                    <ProSkeleton variant="card" className="h-[260px] rounded-[28px]" />
                    <ProSkeleton variant="card" className="h-[420px] rounded-[28px]" />
                </div>
            </div>
        </div>
    );
}