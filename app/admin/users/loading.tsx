import { Skeleton } from "@heroui/skeleton";
import { Card, CardBody } from "@heroui/card";

export default function UsersLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-default-900">จัดการผู้ใช้งาน</h1>
          <p className="text-sm text-default-500">จัดการผู้ใช้งานในระบบ</p>
        </div>
        <div className="h-10 rounded-lg bg-blue-500/10 px-6 py-2.5 text-sm font-medium text-blue-600">
          เพิ่มผู้ใช้
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border border-default-200 shadow-sm">
            <CardBody className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="w-20 h-4 rounded-lg" />
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
            <Skeleton className="w-full sm:w-40 h-10 rounded-lg" />
            <Skeleton className="w-full sm:w-40 h-10 rounded-lg" />
          </div>
        </CardBody>
      </Card>

      {/* Table */}
      <Card className="border border-default-200 shadow-sm">
        <CardBody className="p-0">
          {/* Table Header */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-default-100 bg-default-50">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className={`h-4 rounded-lg ${i === 0 ? "w-24" : i === 1 ? "w-32" : i === 2 ? "w-40" : "w-20"}`} />
            ))}
          </div>
          
          {/* Table Rows */}
          {[...Array(7)].map((_, rowIndex) => (
            <div key={rowIndex} className="flex items-center gap-4 px-4 py-3 border-b border-default-50">
              <div className="flex items-center gap-3 w-24">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-16 h-4 rounded-lg" />
              </div>
              <Skeleton className="w-32 h-4 rounded-lg" />
              <Skeleton className="w-40 h-4 rounded-lg" />
              <Skeleton className="w-16 h-6 rounded-full" />
              <Skeleton className="w-16 h-6 rounded-full" />
              <Skeleton className="w-16 h-6 rounded-full" />
              <div className="flex gap-2">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <Skeleton className="w-40 h-4 rounded-lg" />
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="w-8 h-8 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
