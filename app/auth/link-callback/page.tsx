"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { Icon } from "@iconify/react";
import { authService } from "@/services";
import { getOAuthCallbackParam } from "@/lib/oauth-callback-params";

const AUTH_PAGE_SHELL = "flex min-h-screen items-center justify-center bg-background p-4 text-foreground";
const AUTH_PAGE_CARD = "w-full max-w-md border border-default-200 bg-content1 shadow-2xl shadow-slate-200/40 dark:shadow-zinc-950/50";

function LinkCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const accessToken = getOAuthCallbackParam(searchParams, "accessToken");
    const refreshToken = getOAuthCallbackParam(searchParams, "refreshToken");
    const linked = getOAuthCallbackParam(searchParams, "linked");
    const error = getOAuthCallbackParam(searchParams, "error");

    // Always clean up the localStorage flag when link-callback is reached
    if (typeof window !== "undefined") {
      localStorage.removeItem("pending_oauth_link_provider");
    }

    const broadcastAndClose = (data: Record<string, unknown>) => {
      // Broadcast result to main tab via BroadcastChannel
      try {
        const channel = new BroadcastChannel("oauth_link_channel");
        channel.postMessage({ type: "oauth_link_result", ...data });
        setTimeout(() => channel.close(), 500);
      } catch { /* BroadcastChannel not supported */ }

      // Delay close to let BroadcastChannel deliver the message to Tab 1 first
      setTimeout(() => window.close(), 500);

      // If tab didn't close, show appropriate page (main tab will detect via DB poll)
      if (data.success) {
        setStatus("success");
        setMessage(String(data.providerName || ""));
      } else {
        setStatus("error");
        setMessage(String(data.error || "เกิดข้อผิดพลาด"));
      }
    };

    if (error) {
      broadcastAndClose({ success: false, error: decodeURIComponent(error) });
      return;
    }

    if (!accessToken || !refreshToken || !linked) {
      broadcastAndClose({ success: false, error: "ข้อมูลการเชื่อมต่อไม่ครบถ้วน" });
      return;
    }

    // Save updated tokens so the main tab has fresh ones
    authService.setTokens(accessToken, refreshToken);

    const providerName =
      linked === "google" ? "Google" : linked === "github" ? "GitHub" : linked;

    broadcastAndClose({ success: true, provider: linked, providerName });
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-sm">
      {status === "loading" && (
        <>
          <Spinner size="lg" color="primary" />
          <p className="text-sm text-slate-500">กำลังดำเนินการ...</p>
          <p className="text-xs text-slate-400">หน้าต่างนี้จะปิดโดยอัตโนมัติ</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Icon icon="solar:check-circle-bold" className="text-4xl text-green-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">
            เชื่อมต่อ {message} สำเร็จแล้ว
          </h2>
          <p className="text-sm text-slate-500">
            คุณสามารถปิดแท็บนี้ได้เลย
          </p>
          <p className="text-xs text-slate-400">
            หน้าโปรไฟล์จะอัปเดตโดยอัตโนมัติ
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <Icon icon="solar:close-circle-bold" className="text-4xl text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">
            เชื่อมต่อไม่สำเร็จ
          </h2>
          <p className="text-sm text-slate-500">{message}</p>
          <p className="text-xs text-slate-400">
            คุณสามารถปิดแท็บนี้และลองใหม่อีกครั้ง
          </p>
        </>
      )}
    </div>
  );
}

export default function AuthLinkCallbackPage() {
  return (
    <div data-auth-shell="true" className={AUTH_PAGE_SHELL}>
      <Card className={AUTH_PAGE_CARD}>
        <CardBody className="p-8">
          <Suspense fallback={<Spinner size="lg" color="primary" />}>
            <LinkCallbackContent />
          </Suspense>
        </CardBody>
      </Card>
    </div>
  );
}
