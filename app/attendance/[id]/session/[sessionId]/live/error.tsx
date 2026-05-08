"use client";

import { PageErrorState } from "@/components/ui/error-states";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageErrorState
      error={error}
      reset={reset}
      title="เกิดข้อผิดพลาดในหน้าเช็คชื่อ Live"
    />
  );
}
