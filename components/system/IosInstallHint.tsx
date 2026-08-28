"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { requiresHomeScreenInstallForPush } from "@/lib/pwa-notifications";

const DISMISS_STORAGE_KEY = "ios-install-hint-dismissed-at";
const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function isRecentlyDismissed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
  const dismissedAt = raw ? Number(raw) : 0;
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
}

/**
 * Inline banner shown on iOS/iPadOS Safari when the site is not yet
 * installed to the home screen. Web Push only works there in standalone
 * (installed) mode — there's no `beforeinstallprompt` on iOS, so this guides
 * users through the manual Share → "Add to Home Screen" flow before they
 * try to enable notifications.
 */
export function IosInstallHint({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(requiresHomeScreenInstallForPush() && !isRecentlyDismissed());
  }, []);

  if (!visible) {
    return null;
  }

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // no-op
    }
    setVisible(false);
  };

  return (
    <div
      className={`flex items-start gap-3 rounded-3xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm ${className ?? ""}`}
    >
      <Icon icon="solar:iphone-bold" className="mt-0.5 shrink-0 text-lg text-violet-500" />
      <div className="flex-1">
        <p className="font-semibold text-violet-700">เพิ่มลงหน้าจอโฮมก่อนเปิดการแจ้งเตือน</p>
        <p className="text-xs text-violet-600">
          iPhone/iPad ต้องติดตั้งเป็นแอปก่อนจึงจะรับการแจ้งเตือนได้ โดยแตะปุ่มแชร์{" "}
          <Icon icon="solar:square-share-line-bold" className="inline text-sm" /> ด้านล่างจอ แล้วเลือก
          &quot;เพิ่มไปยังหน้าจอโฮม&quot;
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="ปิด"
        className="shrink-0 rounded-full p-1 text-violet-400 transition hover:bg-violet-100 hover:text-violet-600"
      >
        <Icon icon="solar:close-circle-linear" className="text-lg" />
      </button>
    </div>
  );
}
