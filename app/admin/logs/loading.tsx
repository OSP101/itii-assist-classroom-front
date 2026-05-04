import { Skeleton } from "@heroui/skeleton";
import { Card, CardBody } from "@heroui/card";

export default function LogsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Skeleton className="w-40 h-8 rounded-lg mb-2" />
          <Skeleton className="w-80 h-4 rounded-lg" />
        </div>
        <Skeleton className="w-28 h-10 rounded-lg" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="border border-default-200 shadow-sm">
            <CardBody className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="w-16 h-4 rounded-lg" />
                  <Skeleton className="w-12 h-7 rounded-lg" />
                </div>
                <Skeleton className="w-8 h-8 rounded-lg" />
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
            <Skeleton className="w-full sm:w-32 h-10 rounded-lg" />
            <Skeleton className="w-full sm:w-32 h-10 rounded-lg" />
          </div>
        </CardBody>
      </Card>

      {/* Table */}
      <Card className="border border-default-200 shadow-sm">
        <CardBody className="p-0">
          {/* Table Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-default-100 bg-default-50">
            <Skeleton className="w-32 h-4 rounded-lg" />
            <Skeleton className="w-20 h-4 rounded-lg" />
            <Skeleton className="w-16 h-4 rounded-lg" />
            <Skeleton className="w-24 h-4 rounded-lg" />
            <Skeleton className="w-16 h-4 rounded-lg" />
            <Skeleton className="w-28 h-4 rounded-lg" />
            <Skeleton className="w-24 h-4 rounded-lg" />
            <Skeleton className="w-20 h-4 rounded-lg" />
            <Skeleton className="w-8 h-4 rounded-lg" />
          </div>
          
          {/* Table Rows */}
          {[...Array(15)].map((_, rowIndex) => (
            <div key={rowIndex} className="flex items-center gap-3 px-4 py-2.5 border-b border-default-50">
              <Skeleton className="w-32 h-4 rounded-lg" />
              <Skeleton className="w-20 h-5 rounded-full" />
              <Skeleton className="w-16 h-5 rounded-full" />
              <Skeleton className="w-24 h-4 rounded-lg" />
              <Skeleton className="w-12 h-5 rounded-full" />
              <Skeleton className="w-28 h-4 rounded-lg" />
              <div className="flex items-center gap-2 w-24">
                <Skeleton className="w-5 h-5 rounded-full" />
                <Skeleton className="w-16 h-4 rounded-lg" />
              </div>
              <Skeleton className="w-16 h-4 rounded-lg" />
              <Skeleton className="w-6 h-6 rounded-lg" />
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <Skeleton className="w-52 h-4 rounded-lg" />
        <div className="flex gap-2">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="w-8 h-8 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
