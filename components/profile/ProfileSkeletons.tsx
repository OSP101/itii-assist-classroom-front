"use client";

import { memo } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";

// Personal Info Section Skeleton
export const PersonalInfoSkeleton = memo(function PersonalInfoSkeleton() {
  return (
    <div className="space-y-6">
      {/* Avatar Section Skeleton */}
      <Card className="border border-default-200 shadow-sm">
        <CardHeader className="px-6 py-4 border-b border-default-100">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        </CardHeader>
        <CardBody className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Skeleton className="w-28 h-28 rounded-full" />
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <Skeleton className="h-8 w-28 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
              <Skeleton className="h-3 w-48 rounded" />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Personal Information Form Skeleton */}
      <Card className="border border-default-200 shadow-sm">
        <CardHeader className="px-6 py-4 border-b border-default-100">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-5 w-28 rounded" />
          </div>
        </CardHeader>
        <CardBody className="p-6 space-y-4">
          {/* Username field */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
          
          {/* Full name field */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          
          {/* Email field */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          {/* Role and Status */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-3 bg-default-50 rounded-lg space-y-2">
              <Skeleton className="h-3 w-12 rounded" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="p-3 bg-default-50 rounded-lg space-y-2">
              <Skeleton className="h-3 w-12 rounded" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Skeleton className="h-10 w-40 rounded-lg" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
});

// Authentication Section Skeleton
export const AuthenticationSkeleton = memo(function AuthenticationSkeleton() {
  return (
    <div className="space-y-6">
      {/* Password Card Skeleton */}
      <Card className="border border-default-200 shadow-sm">
        <CardBody className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Skeleton className="w-11 h-11 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-20 rounded" />
                <Skeleton className="h-4 w-full max-w-md rounded" />
              </div>
            </div>
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </CardBody>
      </Card>

      {/* Two-Factor Authentication Skeleton */}
      <Card className="border border-default-200 shadow-sm">
        <CardBody className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Skeleton className="w-11 h-11 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-48 rounded" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full max-w-md rounded" />
              </div>
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </CardBody>
      </Card>

      {/* Login Providers Skeleton */}
      <Card className="border border-default-200 shadow-sm">
        <CardHeader className="px-6 py-4 border-b border-default-100">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-default-100 last:border-b-0">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-16 rounded" />
                  <Skeleton className="h-3 w-36 rounded" />
                </div>
              </div>
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
});

// Active Sessions Section Skeleton
export const ActiveSessionsSkeleton = memo(function ActiveSessionsSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border border-default-200 shadow-sm">
        <CardHeader className="px-6 py-4 border-b border-default-100">
          <div className="flex items-center justify-between w-full">
            <div className="space-y-1">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-4 w-48 rounded" />
            </div>
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="divide-y divide-default-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-4 px-6 py-4">
                <Skeleton className="w-11 h-11 rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-28 rounded" />
                    {i === 1 && <Skeleton className="h-5 w-24 rounded-full" />}
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-48 rounded" />
                    <Skeleton className="h-4 w-64 rounded" />
                  </div>
                </div>
                {i !== 1 && <Skeleton className="w-8 h-8 rounded-lg" />}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Security Warning Skeleton */}
      <div className="p-4 bg-warning-50 border border-warning-200 rounded-xl">
        <div className="flex items-start gap-3">
          <Skeleton className="w-5 h-5 rounded mt-0.5" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-full max-w-lg rounded" />
          </div>
        </div>
      </div>
    </div>
  );
});
