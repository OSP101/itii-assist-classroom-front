"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody } from "@heroui/card";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { authService } from "@/services";
import { getDefaultRouteForRole } from "@/lib/auth-routing";
import { consumeOAuthReturnPath, storePendingAuthReturnPath } from "@/lib/auth-resume";
import { getOAuthCallbackParam } from "@/lib/oauth-callback-params";

const AUTH_PAGE_SHELL = "flex min-h-screen items-center justify-center bg-background p-4 text-foreground";
const AUTH_PAGE_CARD = "w-full max-w-md border border-default-200 bg-content1 shadow-2xl shadow-slate-200/40 dark:shadow-zinc-950/50";

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<"loading" | "success" | "error" | "link-success" | "link-error">("loading");
    const [message, setMessage] = useState("กำลังเข้าสู่ระบบ...");

    useEffect(() => {
        const handleCallback = async () => {
            // The backend already set the httpOnly auth cookies (plus the
            // readable csrf_token) directly on its redirect response — no
            // tokens ever reach this page. `login=success` / `linked=...`
            // are just non-sensitive UI signals.
            const loginSuccess = getOAuthCallbackParam(searchParams, "login") === "success";
            const error = getOAuthCallbackParam(searchParams, "error");
            const twoFactor = getOAuthCallbackParam(searchParams, "twoFactor");
            const linked = getOAuthCallbackParam(searchParams, "linked"); // OAuth linking action

            // Check if this callback is from a link action initiated via new tab.
            // We use localStorage (shared across same-origin tabs) because backend cookies
            // can be silently dropped during cross-domain OAuth redirects.
            // NOTE: Do NOT check window.opener here — it becomes null after cross-origin
            // OAuth navigation (GitHub/Google), so localStorage is the only reliable signal.
            const pendingLinkProvider =
                typeof window !== "undefined"
                    ? localStorage.getItem("pending_oauth_link_provider")
                    : null;
            const isLinkTab = !!pendingLinkProvider;
            
            if (error) {
                if (isLinkTab) {
                    localStorage.removeItem("pending_oauth_link_provider");
                    // Broadcast error to main tab
                    try {
                        const channel = new BroadcastChannel("oauth_link_channel");
                        channel.postMessage({ type: "oauth_link_result", success: false, error: decodeURIComponent(error) });
                        setTimeout(() => channel.close(), 500);
                    } catch { /* BroadcastChannel not supported */ }
                    // Delay close to let BroadcastChannel deliver the message first
                    setTimeout(() => window.close(), 500);
                    // If tab didn't close, show error page (main tab will detect via DB poll)
                    setStatus("link-error");
                    setMessage(decodeURIComponent(error));
                    return;
                }

                setStatus("error");
                setMessage(decodeURIComponent(error));
                addToast({
                    title: "เข้าสู่ระบบไม่สำเร็จ",
                    description: decodeURIComponent(error),
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                // If it was a link action, go back to profile
                const returnPath = consumeOAuthReturnPath();
                setTimeout(() => router.replace(returnPath || "/login"), 3000);
                return;
            }


            // Handle 2FA required
            if (twoFactor) {
                try {
                    const twoFactorData = JSON.parse(decodeURIComponent(twoFactor));
                    sessionStorage.setItem("twoFactorData", JSON.stringify(twoFactorData));
                    storePendingAuthReturnPath(consumeOAuthReturnPath());
                    router.replace("/auth/verify-2fa");
                    return;
                } catch {
                    setStatus("error");
                    setMessage("ข้อมูลการยืนยันตัวตนไม่ถูกต้อง");
                    setTimeout(() => router.replace("/login"), 3000);
                    return;
                }
            }

            // Neither a successful login nor a link action nor a 2FA
            // challenge — nothing this page recognizes.
            if (!loginSuccess && !linked) {
                setStatus("error");
                setMessage("ไม่พบข้อมูลการเข้าสู่ระบบ");
                addToast({
                    title: "เกิดข้อผิดพลาด",
                    description: "ไม่พบข้อมูลการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setTimeout(() => router.replace("/login"), 3000);
                return;
            }

            try {
                // ---------- LINK-TAB INTERCEPT ----------
                // If the backend treated the link flow as a normal login (cookie was dropped
                // during cross-origin OAuth redirects), we still detect it here via localStorage.
                if (isLinkTab) {
                    localStorage.removeItem("pending_oauth_link_provider");
                    const resolvedLinked = linked || pendingLinkProvider!;
                    const providerName =
                        resolvedLinked === "github"
                            ? "GitHub"
                            : resolvedLinked === "google"
                              ? "Google"
                              : resolvedLinked;
                    // Broadcast success to main tab
                    try {
                        const channel = new BroadcastChannel("oauth_link_channel");
                        channel.postMessage({ type: "oauth_link_result", success: true, provider: resolvedLinked, providerName });
                        setTimeout(() => channel.close(), 500);
                    } catch { /* BroadcastChannel not supported */ }
                    // Delay close to let BroadcastChannel deliver the message first
                    setTimeout(() => window.close(), 500);
                    // If tab didn't close, show success page (main tab will detect via DB poll)
                    setStatus("link-success");
                    setMessage(`เชื่อมต่อ ${providerName} สำเร็จแล้ว`);
                    return;
                }
                // ----------------------------------------

                // Fetch user info
                const userResult = await authService.getMe();

                if (userResult.success && userResult.user) {
                    // Check if this was a link action (backend correctly set linked param)
                    if (linked) {
                        const providerName = linked === 'github' ? 'GitHub' : linked === 'google' ? 'Google' : linked;

                        // If opened as a link tab, broadcast result and close
                        if (typeof window !== "undefined" && pendingLinkProvider) {
                            localStorage.removeItem("pending_oauth_link_provider");
                            try {
                                const channel = new BroadcastChannel("oauth_link_channel");
                                channel.postMessage({ type: "oauth_link_result", success: true, provider: linked, providerName });
                                setTimeout(() => channel.close(), 500);
                            } catch { /* BroadcastChannel not supported */ }
                            // Delay close to let BroadcastChannel deliver
                            setTimeout(() => window.close(), 500);
                            // If tab didn't close, show success page
                            setStatus("link-success");
                            setMessage(`เชื่อมต่อ ${providerName} สำเร็จแล้ว`);
                            return;
                        }

                        // Fallback: normal redirect flow
                        setStatus("success");
                        setMessage(`เชื่อมต่อ ${providerName} สำเร็จ`);

                        addToast({
                            title: "เชื่อมต่อสำเร็จ",
                            description: `เชื่อมต่อบัญชี ${providerName} เรียบร้อยแล้ว`,
                            color: "success",
                            timeout: 3000,
                shouldShowTimeoutProgress: true,
                        });

                        // Get return URL from sessionStorage or default to profile page
                        const returnPath = consumeOAuthReturnPath();
                        
                        setTimeout(() => {
                            if (returnPath) {
                                router.replace(returnPath);
                            } else {
                                router.replace("/permissions?tab=authentication");
                            }
                        }, 1500);
                        return;
                    }
                    
                    setStatus("success");
                    setMessage(`ยินดีต้อนรับ ${userResult.user.full_name}`);

                    addToast({
                        title: "เข้าสู่ระบบสำเร็จ",
                        description: `ยินดีต้อนรับ ${userResult.user.full_name}`,
                        color: "success",
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });

                    // Redirect based on role
                    setTimeout(() => {
                        router.replace(consumeOAuthReturnPath() || getDefaultRouteForRole(userResult.user?.role));
                    }, 1500);
                } else {
                    throw new Error("ไม่สามารถดึงข้อมูลผู้ใช้ได้");
                }
            } catch (error) {
                setStatus("error");
                setMessage("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
                addToast({
                    title: "เกิดข้อผิดพลาด",
                    description: "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                // Clear any stored tokens
                authService.clearTokens();
                setTimeout(() => router.replace("/login"), 3000);
            }
        };

        handleCallback();
    }, [searchParams, router]);

    return (
        <div className="flex flex-col items-center gap-6">
            {status === "loading" && (
                <>
                    <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                        <Spinner size="lg" color="primary" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">
                            กำลังเข้าสู่ระบบ
                        </h2>
                        <p className="text-slate-500">
                            กรุณารอสักครู่...
                        </p>
                    </div>
                </>
            )}

            {status === "success" && (
                <>
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                        <Icon
                            icon="solar:check-circle-bold"
                            className="text-5xl text-green-500"
                        />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">
                            เข้าสู่ระบบสำเร็จ
                        </h2>
                        <p className="text-slate-500">{message}</p>
                        <p className="text-sm text-slate-400 mt-2">
                            กำลังนำคุณไปยังหน้าหลัก...
                        </p>
                    </div>
                </>
            )}

            {status === "error" && (
                <>
                    <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                        <Icon
                            icon="solar:close-circle-bold"
                            className="text-5xl text-red-500"
                        />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">
                            เข้าสู่ระบบไม่สำเร็จ
                        </h2>
                        <p className="text-slate-500">{message}</p>
                        <p className="text-sm text-slate-400 mt-2">
                            กำลังนำคุณกลับไปหน้าเข้าสู่ระบบ...
                        </p>
                    </div>
                </>
            )}

            {status === "link-success" && (
                <>
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                        <Icon
                            icon="solar:check-circle-bold"
                            className="text-5xl text-green-500"
                        />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">
                            {message}
                        </h2>
                        <p className="text-slate-500">
                            คุณสามารถปิดแท็บนี้ได้เลย
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                            หน้าโปรไฟล์จะอัปเดตโดยอัตโนมัติ
                        </p>
                    </div>
                </>
            )}

            {status === "link-error" && (
                <>
                    <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                        <Icon
                            icon="solar:close-circle-bold"
                            className="text-5xl text-red-500"
                        />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">
                            เชื่อมต่อไม่สำเร็จ
                        </h2>
                        <p className="text-slate-500">{message}</p>
                        <p className="text-sm text-slate-400 mt-2">
                            คุณสามารถปิดแท็บนี้และลองใหม่อีกครั้ง
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <div data-auth-shell="true" className={AUTH_PAGE_SHELL}>
            <Card className={AUTH_PAGE_CARD}>
                <CardBody className="p-8">
                    <Suspense
                        fallback={
                            <div className="flex flex-col items-center gap-6">
                                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                                    <Spinner size="lg" color="primary" />
                                </div>
                                <div className="text-center">
                                    <h2 className="text-xl font-bold text-slate-800 mb-2">
                                        กำลังโหลด...
                                    </h2>
                                </div>
                            </div>
                        }
                    >
                        <AuthCallbackContent />
                    </Suspense>
                </CardBody>
            </Card>
        </div>
    );
}
