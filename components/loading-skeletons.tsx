import { Card, CardBody, CardFooter } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";

type CourseListSkeletonProps = {
  viewMode?: "grid" | "list";
  tone?: "active" | "closed";
  count?: number;
};

const iconSkeletonClass = "bg-blue-100/70";

export function PageBootSkeleton({ variant = "home" }: { variant?: "home" | "classroom" }) {
  if (variant === "classroom") {
    // Minimal header-only skeleton for classroom pages (sidebar + content handled by classroom page itself)
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between h-12 px-4">
            <div className="flex items-center gap-2">
              <Skeleton className="w-6 h-6 rounded bg-blue-100" />
              <Skeleton className="w-4 h-4 rounded bg-slate-100" />
              <Skeleton className="w-36 h-7 rounded-md" />
              <Skeleton className="w-4 h-4 rounded bg-slate-100" />
              <Skeleton className="hidden sm:block w-48 h-7 rounded-md" />
            </div>
            <Skeleton className="w-7 h-7 rounded-full bg-blue-100" />
          </div>
        </header>
        {/* Sidebar + content skeleton matching classroom layout */}
        <div className="flex">
          <aside className="hidden lg:block w-64 h-[calc(100vh-3rem)] bg-white border-r border-slate-200 fixed top-12 left-0">
            <div className="space-y-1 p-3">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-blue-50">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="h-4 rounded-lg" style={{ width: 64 }} />
              </div>
              {[112, 144, 128, 96, 120, 80].map((w, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                  <Skeleton className="w-5 h-5 rounded" />
                  <Skeleton className="h-4 rounded-lg" style={{ width: w }} />
                </div>
              ))}
            </div>
          </aside>
          <main className="flex-1 lg:ml-64 p-4 lg:p-6">
            {/* Overview skeleton placeholder */}
            <div className="space-y-6">
              <Skeleton className="w-full h-48 rounded-xl bg-blue-100" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[0,1].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-2">
            <Skeleton className="w-6 h-6 rounded bg-blue-100" />
            <Skeleton className="w-4 h-4 rounded bg-slate-100" />
            <Skeleton className="w-36 h-7 rounded-md" />
            <Skeleton className="w-4 h-4 rounded bg-slate-100" />
            <Skeleton className="hidden sm:block w-48 h-7 rounded-md" />
          </div>
          <Skeleton className="w-7 h-7 rounded-full bg-blue-100" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="w-44 h-8 rounded-lg" />
            <Skeleton className="w-64 h-4 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-32 h-10 rounded-lg" />
            <Skeleton className="w-40 h-10 rounded-lg bg-blue-100" />
          </div>
        </div>
        <Skeleton className="w-full h-18 rounded-xl" />
        <CourseListSkeleton viewMode="grid" />
      </main>
    </div>
  );
}

export function CourseListSkeleton({ viewMode = "grid", tone = "active", count }: CourseListSkeletonProps) {
  if (viewMode === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: count ?? 6 }).map((_, index) => (
          <Card key={index} className="border border-slate-200 shadow-sm w-full">
            <CardBody className="p-3 sm:p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <Skeleton className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg shrink-0 ${tone === "active" ? "bg-blue-100" : "bg-slate-200"}`} />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-2 flex-1 min-w-0">
                      <Skeleton className="w-56 max-w-full h-5 rounded-lg" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-16 h-6 rounded-full bg-blue-50" />
                        <Skeleton className="w-20 h-4 rounded-lg" />
                      </div>
                    </div>
                    <Skeleton className="w-8 h-8 rounded-lg" />
                  </div>
                  <div className="hidden sm:flex items-center gap-4 pt-1">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="flex items-center gap-1.5">
                        <Skeleton className={`w-5 h-5 rounded ${iconSkeletonClass}`} />
                        <Skeleton className="w-20 h-4 rounded-lg" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count ?? 6 }).map((_, index) => (
        <Card key={index} className="border border-slate-200 shadow-sm">
          <Skeleton className={`h-32 w-full rounded-none ${tone === "active" ? "bg-blue-100" : "bg-slate-200"}`} />
          <CardBody className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="w-24 h-5 rounded-lg" />
                  <Skeleton className="w-full h-4 rounded-lg" />
                </div>
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="w-16 h-6 rounded-full bg-blue-50" />
                <Skeleton className="w-20 h-6 rounded-full" />
              </div>
            </div>
          </CardBody>
          <CardFooter className="border-t border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between w-full">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <Skeleton className={`w-5 h-5 rounded ${iconSkeletonClass}`} />
                  <Skeleton className="w-12 h-4 rounded-lg" />
                </div>
              ))}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}