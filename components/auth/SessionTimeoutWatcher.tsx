"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { authService } from "@/services/auth.service";
import { buildPreferredLoginHref } from "@/lib/auth-resume";
import {
  SESSION_EXPIRY_EVENT,
  consumeSessionExpiredFlag,
  getSessionExpiresAt,
  markSessionExpiredByTimeout,
} from "@/lib/session-timeout";

// How long before the absolute 12h cap to show the warning modal.
const WARNING_LEAD_MS = 10 * 60 * 1000;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Enforces the backend's absolute 12h session cap on the client: shows a
 * warning modal 10 minutes before the deadline (with a choice to keep
 * working until it runs out, or leave now), and force-logs-out exactly at
 * the deadline either way. Mount once near the app root — it no-ops
 * whenever there's no active session (nothing scheduled).
 */
export function SessionTimeoutWatcher() {
  const router = useRouter();
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const deadlineRef = useRef<number | null>(null);

  const forceLogout = useCallback(
    async (reason: "timeout" | "manual") => {
      setIsWarningOpen(false);
      if (reason === "timeout") {
        markSessionExpiredByTimeout();
      }
      try {
        await authService.logout();
      } catch {
        // authService.logout() already fails soft (clears local state either way).
      }
      const nextPath =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : undefined;
      router.push(buildPreferredLoginHref(nextPath));
    },
    [router]
  );

  // One-shot: a hard 401 from an API call elsewhere (not this component's own
  // timers — e.g. the tab was idle past the deadline) redirects via a full
  // page reload, which remounts everything including this component. Catch
  // the flag left behind by that path so the user still sees an explanation.
  useEffect(() => {
    if (consumeSessionExpiredFlag()) {
      addToast({
        title: "เซสชันหมดอายุ",
        description: "คุณเข้าใช้งานนานเกินไปแล้ว ระบบออกจากระบบเพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่",
        color: "warning",
        timeout: 6000,
        shouldShowTimeoutProgress: true,
      });
    }
  }, []);

  useEffect(() => {
    let warningTimer: ReturnType<typeof setTimeout> | null = null;
    let cutoffTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (warningTimer) clearTimeout(warningTimer);
      if (cutoffTimer) clearTimeout(cutoffTimer);
      warningTimer = null;
      cutoffTimer = null;
    };

    const schedule = () => {
      clearTimers();
      const expiresAt = getSessionExpiresAt();
      if (!expiresAt) {
        deadlineRef.current = null;
        setIsWarningOpen(false);
        return;
      }

      deadlineRef.current = expiresAt.getTime();
      const msUntilExpiry = expiresAt.getTime() - Date.now();

      if (msUntilExpiry <= 0) {
        void forceLogout("timeout");
        return;
      }

      if (msUntilExpiry <= WARNING_LEAD_MS) {
        setIsWarningOpen(true);
      } else {
        warningTimer = setTimeout(() => setIsWarningOpen(true), msUntilExpiry - WARNING_LEAD_MS);
      }
      cutoffTimer = setTimeout(() => void forceLogout("timeout"), msUntilExpiry);
    };

    schedule();
    // SESSION_EXPIRY_EVENT covers this tab (login/refresh/logout); the
    // storage event covers the deadline changing in another tab.
    window.addEventListener(SESSION_EXPIRY_EVENT, schedule);
    window.addEventListener("storage", schedule);
    return () => {
      clearTimers();
      window.removeEventListener(SESSION_EXPIRY_EVENT, schedule);
      window.removeEventListener("storage", schedule);
    };
  }, [forceLogout]);

  // Live countdown while the warning is showing.
  useEffect(() => {
    if (!isWarningOpen) {
      setRemainingMs(null);
      return;
    }
    const tick = () => {
      if (deadlineRef.current == null) return;
      setRemainingMs(Math.max(0, deadlineRef.current - Date.now()));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isWarningOpen]);

  return (
    <Modal isOpen={isWarningOpen} onClose={() => setIsWarningOpen(false)} isDismissable={false} hideCloseButton>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon icon="solar:shield-warning-bold" className="text-xl text-warning" />
          <span>เข้าใช้งานนานเกินไปแล้ว</span>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-600">
            เพื่อความปลอดภัย ระบบจะออกจากระบบให้อัตโนมัติใน{" "}
            <span className="font-semibold text-warning-600">
              {remainingMs != null ? formatCountdown(remainingMs) : "--:--"}
            </span>{" "}
            นาที กรุณาบันทึกงานที่ทำค้างไว้ให้เรียบร้อย
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => setIsWarningOpen(false)}>
            ใช้งานต่อจนหมดเวลา
          </Button>
          <Button color="warning" onPress={() => void forceLogout("manual")}>
            ออกทันที
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
