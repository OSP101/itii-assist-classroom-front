import { ProSkeleton } from "@/components/ui/pro-skeleton";

export default function Loading() {
    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_38%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-8">
            <div className="mx-auto max-w-5xl space-y-6">
                <ProSkeleton variant="hero" className="h-40 rounded-[28px]" />
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <ProSkeleton variant="card" className="h-105 rounded-[28px]" />
                    <div className="space-y-4">
                        <ProSkeleton variant="card" className="h-48 rounded-[24px]" />
                        <ProSkeleton variant="card" className="h-48 rounded-[24px]" />
                    </div>
                </div>
            </div>
        </div>
    );
}