"use client";

// หน้าเป้าหมายของ Redirect Logout URL ที่ลงทะเบียนไว้กับ KKU SSO (SSONext)
// ผู้ใช้จะมาถึงที่นี่หลังปิดเซสชันกลางของมหาวิทยาลัยเรียบร้อยแล้ว
// หน้านี้ทำหน้าที่ล้างเซสชันฝั่งเราให้แน่ใจอีกชั้น แล้วพากลับไปหน้าเข้าสู่ระบบ

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Icon } from "@iconify/react";
import { authService } from "@/services";
import { consumePostLogoutLoginPath } from "@/lib/auth-providers";

const REDIRECT_DELAY_MS = 4000;

export default function LogoutPage() {
    const router = useRouter();
    const [loginPath, setLoginPath] = useState("/login");
    const hasRunRef = useRef(false);

    const goToLogin = useCallback(
        (path: string) => {
            router.replace(path);
        },
        [router],
    );

    useEffect(() => {
        if (hasRunRef.current) return;
        hasRunRef.current = true;

        const target = consumePostLogoutLoginPath();
        setLoginPath(target);

        let timer: ReturnType<typeof setTimeout> | undefined;

        // ล้างเซสชันฝั่งเราอีกครั้ง เผื่อผู้ใช้เข้าหน้านี้ตรง ๆ หรือกดล็อกเอาต์
        // จากแอปอื่นที่ใช้ KKU SSO ร่วมกัน ไม่ต้องตาม ssoLogoutUrl ต่อ เพราะ
        // ตอนนี้เพิ่งกลับมาจากหน้า logout ของ SSO แล้ว
        void authService
            .logout()
            .catch(() => undefined)
            .finally(() => {
                timer = setTimeout(() => goToLogin(target), REDIRECT_DELAY_MS);
            });

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [goToLogin]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
            <Card className="w-full max-w-md border border-default-200 bg-content1 shadow-2xl shadow-slate-200/40 dark:shadow-zinc-950/50">
                <CardBody className="flex flex-col items-center gap-4 px-6 py-10 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-500/10">
                        <Icon icon="solar:logout-3-linear" className="text-3xl" />
                    </div>
                    <h1 className="text-xl font-semibold text-foreground">ออกจากระบบเรียบร้อยแล้ว</h1>
                    <p className="text-sm text-default-500">
                        ปิดเซสชัน KKU SSO ของคุณเรียบร้อย ระบบกำลังพากลับไปหน้าเข้าสู่ระบบ
                    </p>
                    <Button
                        color="primary"
                        radius="sm"
                        className="mt-2 w-full"
                        onPress={() => goToLogin(loginPath)}
                    >
                        กลับไปหน้าเข้าสู่ระบบ
                    </Button>
                </CardBody>
            </Card>
        </div>
    );
}
