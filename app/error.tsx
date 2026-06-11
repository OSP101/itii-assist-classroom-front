"use client";

import { useEffect } from "react";
import { PageErrorState } from "@/components/ui/error-states";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application Error:", error);
  }, [error]);

  return <PageErrorState error={error} reset={reset} />;
}
