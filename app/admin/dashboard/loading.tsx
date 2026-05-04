import { Skeleton } from "@heroui/skeleton";
import { Card, CardBody, CardHeader } from "@heroui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Welcome Banner Skeleton */}
      <div className="bg-gradient-to-r from-blue-400 to-indigo-500 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="w-64 h-8 rounded-lg bg-white/20" />
            <Skeleton className="w-80 h-5 rounded-lg bg-white/20" />
          </div>
          <div className="hidden md:block">
            <Skeleton className="w-32 h-8 rounded-lg bg-white/20" />
          </div>
        </div>
      </div>

      {/* Main Stats Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border border-default-200 shadow-sm">
            <CardBody className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="w-20 h-4 rounded-lg" />
                  <Skeleton className="w-16 h-8 rounded-lg" />
                  <Skeleton className="w-24 h-3 rounded-lg" />
                </div>
                <Skeleton className="w-10 h-10 rounded-lg" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Two Column Layout Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Roles Skeleton */}
          <Card className="border border-default-200 shadow-sm">
            <CardHeader className="px-4 py-3 border-b border-default-100">
              <Skeleton className="w-40 h-5 rounded-lg" />
            </CardHeader>
            <CardBody className="p-4">
              <div className="grid grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="text-center p-4 bg-default-50 rounded-xl">
                    <Skeleton className="w-10 h-10 rounded-full mx-auto mb-2" />
                    <Skeleton className="w-12 h-7 rounded-lg mx-auto mb-1" />
                    <Skeleton className="w-16 h-4 rounded-lg mx-auto" />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Classroom Details Skeleton */}
          <Card className="border border-default-200 shadow-sm">
            <CardHeader className="px-4 py-3 border-b border-default-100">
              <Skeleton className="w-36 h-5 rounded-lg" />
            </CardHeader>
            <CardBody className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="p-3 bg-default-50 rounded-lg text-center">
                    <Skeleton className="w-12 h-6 rounded-lg mx-auto mb-1" />
                    <Skeleton className="w-16 h-3 rounded-lg mx-auto" />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Quick Actions Skeleton */}
          <Card className="border border-default-200 shadow-sm">
            <CardHeader className="px-4 py-3 border-b border-default-100">
              <Skeleton className="w-24 h-5 rounded-lg" />
            </CardHeader>
            <CardBody className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-default-50">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <Skeleton className="w-16 h-3 rounded-lg" />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Server Status Skeleton */}
          <Card className="border border-default-200 shadow-sm">
            <CardHeader className="px-4 py-3 border-b border-default-100">
              <div className="flex items-center justify-between w-full">
                <Skeleton className="w-32 h-5 rounded-lg" />
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
            </CardHeader>
            <CardBody className="p-4 space-y-4">
              <Skeleton className="w-full h-10 rounded-lg" />
              <div>
                <div className="flex justify-between mb-1.5">
                  <Skeleton className="w-8 h-4 rounded-lg" />
                  <Skeleton className="w-12 h-4 rounded-lg" />
                </div>
                <Skeleton className="w-full h-2 rounded-full" />
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <Skeleton className="w-14 h-4 rounded-lg" />
                  <Skeleton className="w-12 h-4 rounded-lg" />
                </div>
                <Skeleton className="w-full h-2 rounded-full" />
                <Skeleton className="w-24 h-3 rounded-lg mt-1" />
              </div>
              <div className="pt-3 border-t border-default-100 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="w-14 h-3 rounded-lg" />
                  <Skeleton className="w-20 h-3 rounded-lg" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="w-16 h-3 rounded-lg" />
                  <Skeleton className="w-14 h-3 rounded-lg" />
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Log Summary Skeleton */}
          <Card className="border border-default-200 shadow-sm">
            <CardHeader className="px-4 py-3 border-b border-default-100">
              <div className="flex items-center justify-between w-full">
                <Skeleton className="w-36 h-5 rounded-lg" />
                <Skeleton className="w-16 h-7 rounded-lg" />
              </div>
            </CardHeader>
            <CardBody className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2">
                  <Skeleton className="w-20 h-4 rounded-lg" />
                  <Skeleton className="w-12 h-5 rounded-full" />
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
