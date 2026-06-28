"use client";

import { useEffect } from "react";
import { registerPwaServiceWorker } from "@/lib/pwa-notifications";

export function PwaBootstrap() {
  useEffect(() => {
    void registerPwaServiceWorker();
  }, []);

  return null;
}
