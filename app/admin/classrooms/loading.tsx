import { Skeleton } from "@heroui/skeleton";
import { Card, CardBody, CardHeader } from "@heroui/card";

export default function ClassroomsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-default-900">จัดการห้องเรียน</h1>
          <p className="text-sm text-default-500">จัดการผังห้องเรียนและโต๊ะเรียน</p>
        </div>
        <div className="h-10 rounded-lg bg-blue-500/10 px-6 py-2.5 text-sm font-medium text-blue-600">
          สร้างห้อง
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border border-default-200 shadow-sm">
            <CardBody className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="w-24 h-4 rounded-lg" />
                  <Skeleton className="w-16 h-8 rounded-lg" />
                </div>
                <Skeleton className="w-10 h-10 rounded-lg" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border border-default-200 shadow-sm">
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Skeleton className="flex-1 h-10 rounded-lg" />
            <Skeleton className="w-full sm:w-36 h-10 rounded-lg" />
            <Skeleton className="w-full sm:w-36 h-10 rounded-lg" />
            <Skeleton className="w-full sm:w-40 h-10 rounded-lg" />
          </div>
        </CardBody>
      </Card>

      {/* Two Column Layout - List and Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classroom List */}
        <Card className="border border-default-200 shadow-sm">
          <CardHeader className="px-4 py-3 border-b border-default-100">
            <div className="flex items-center justify-between w-full">
              <Skeleton className="w-32 h-5 rounded-lg" />
              <Skeleton className="w-20 h-5 rounded-lg" />
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {/* Table Header */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-default-100 bg-default-50">
              <Skeleton className="w-32 h-4 rounded-lg" />
              <Skeleton className="w-24 h-4 rounded-lg" />
              <Skeleton className="w-20 h-4 rounded-lg" />
              <Skeleton className="w-16 h-4 rounded-lg" />
            </div>
            
            {/* Table Rows */}
            {[...Array(8)].map((_, rowIndex) => (
              <div key={rowIndex} className="flex items-center gap-4 px-4 py-3 border-b border-default-50 cursor-pointer hover:bg-default-50">
                <Skeleton className="w-32 h-4 rounded-lg" />
                <Skeleton className="w-24 h-4 rounded-lg" />
                <Skeleton className="w-20 h-6 rounded-full" />
                <div className="flex gap-1">
                  <Skeleton className="w-6 h-6 rounded-lg" />
                  <Skeleton className="w-6 h-6 rounded-lg" />
                  <Skeleton className="w-6 h-6 rounded-lg" />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Canvas Preview */}
        <Card className="border border-default-200 shadow-sm">
          <CardHeader className="px-4 py-3 border-b border-default-100">
            <div className="flex items-center justify-between w-full">
              <Skeleton className="w-40 h-5 rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="w-24 h-8 rounded-lg" />
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-4">
            {/* Canvas Area */}
            <Skeleton className="w-full h-80 rounded-xl" />
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="w-20 h-3 rounded-lg" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="w-16 h-3 rounded-lg" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="w-24 h-3 rounded-lg" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
