"use client";

// โครงหน้าเข้าสู่ระบบที่ใช้ร่วมกันระหว่าง /login (ผู้สอน) และ /student/login
// ทำแบบเดียวกับระบบ COCO TAS ของวิทยาลัย: จอใหญ่แบ่งซ้ายเป็นรูปอาคาร ขวาเป็นฟอร์ม
// มือถือไม่แสดงรูป มีแถบโลโก้ด้านบนแล้วเข้าฟอร์มทันที

import { useEffect, useState } from "react";
import Image from "next/image";
import { Link } from "@heroui/link";
import { Icon } from "@iconify/react";
import NextLink from "next/link";
import { loginPolicyLinks } from "@/config/public-links";
import { useI18n } from "@/hooks/useI18n";
import { MAIN_ORIGIN, isOnBackupDomain } from "@/lib/auth-providers";

export function AppMark({ className = "h-8" }: { className?: string }) {
    return (
        <>
            <Image
                src="/images/logo-cp-full.png"
                alt="ITII Assist Classroom"
                width={692}
                height={200}
                priority
                className={`w-auto object-contain dark:hidden ${className}`}
            />
            <Image
                src="/images/logo-cp-full-black.png"
                alt="ITII Assist Classroom"
                width={305}
                height={89}
                priority
                className={`hidden w-auto object-contain dark:block ${className}`}
            />
        </>
    );
}

/** ข้อความเดียวกับ AppFooter ย้ายมาอยู่บนแผงรูป (จอใหญ่) หรือท้ายหน้า (มือถือ) แทนแถบ footer */
function LoginCredits({ className, linkClassName }: { className: string; linkClassName: string }) {
    const link = `underline-offset-2 transition-colors hover:underline ${linkClassName}`;
    return (
        <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-relaxed ${className}`}>
            <span>© {new Date().getFullYear()} COCO LABS -</span>
            <NextLink href="https://computing.kku.ac.th" target="_blank" rel="noopener noreferrer" className={link}>
                College of Computing
            </NextLink>
            <span className="hidden sm:inline">|</span>
            <span className="w-full text-center sm:w-auto lg:text-left">
                Developed by{" "}
                <NextLink href="https://osp101.com" target="_blank" rel="noopener noreferrer" className={link}>
                    ITII Development Team
                </NextLink>
            </span>
        </p>
    );
}

interface LoginShellProps {
    title: string;
    subtitle: string;
    /** ปุ่มมุมขวาบนสำหรับสลับไปหน้าเข้าสู่ระบบอีกฝั่ง (ผู้สอน/นักศึกษา) */
    switchHref: string;
    switchLabel: string;
    /** เนื้อหาใต้หัวข้อ (ปุ่มเข้าสู่ระบบ ฟอร์ม) modal ของหน้าวางรวมไว้ตรงนี้ได้เพราะเรนเดอร์ผ่าน portal */
    children: React.ReactNode;
}

export function LoginShell({ title, subtitle, switchHref, switchLabel, children }: LoginShellProps) {
    const t = useI18n();
    const [isOnBackup, setIsOnBackup] = useState(false);
    const [mainOriginUrl, setMainOriginUrl] = useState(MAIN_ORIGIN);

    useEffect(() => {
        setIsOnBackup(isOnBackupDomain(window.location.hostname));
        setMainOriginUrl(`${MAIN_ORIGIN}${window.location.pathname}${window.location.search}`);
    }, []);

    return (
        <div data-auth-shell="true" className="grid min-h-dvh bg-background text-foreground lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            {/* แผงรูปอาคารวิทยาลัย แสดงเฉพาะจอใหญ่
                รูปเป็นแนวนอนแต่แผงเป็นแนวตั้ง จึงตั้งจุดโฟกัสไว้ที่ป้ายวิทยาลัยฝั่งขวา
                เพื่อให้ป้ายยังอยู่ในกรอบเมื่อถูกครอปด้านข้าง */}
            <aside className="relative hidden flex-col justify-between overflow-hidden bg-neutral-900 px-10 py-8 text-white lg:flex">
                <Image
                    src="/images/cp-login-building.jpg"
                    alt={t("collegeOfComputingBuilding")}
                    fill
                    sizes="46vw"
                    priority
                    className="object-cover object-[85%_50%]"
                />
                {/* แถบมืดด้านบนและล่าง ให้ตัวอักษรสีขาวอ่านออกบนท้องฟ้าและถนน */}
                <div aria-hidden className="absolute inset-x-0 top-0 h-48 bg-linear-to-b from-black/70 to-transparent" />
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-black/70 to-transparent" />

                <Link href="/" aria-label={t("itiiAssistClassroomHome")} className="relative flex items-center gap-3 text-white">
                    <span className="grid size-10 place-items-center rounded-xl shadow-sm" style={{ backgroundColor: "#fff" }}>
                        <Image src="/images/logo-cp.png" alt="" width={28} height={28} sizes="28px" priority className="size-7 object-contain" />
                    </span>
                    <span className="text-lg font-semibold tracking-wide">COCO LABS</span>
                </Link>

                <LoginCredits className="relative justify-start text-white/80" linkClassName="hover:text-white" />
            </aside>

            <main className="flex min-h-dvh flex-col">
                <header className="flex h-16 items-center justify-between gap-3 border-b border-divider bg-content1 px-4 sm:px-8 lg:justify-end lg:border-0 lg:bg-transparent">
                    {/* แถบแบรนด์เฉพาะมือถือ จอใหญ่มีบนแผงรูปแล้ว */}
                    <Link href="/" aria-label={t("itiiAssistClassroomHome")} className="inline-flex items-center lg:hidden">
                        <AppMark className="h-7" />
                    </Link>
                    <Link
                        href={switchHref}
                        className="inline-flex items-center gap-1.5 rounded-full border border-divider px-3 py-1.5 text-sm font-medium text-default-600 transition-colors hover:border-primary-300 hover:text-primary"
                    >
                        <span>{switchLabel}</span>
                        <Icon icon="solar:arrow-right-linear" className="text-base" />
                    </Link>
                </header>

                <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
                    <div className="w-full max-w-[400px]">
                        <div className="mb-7">
                            <h1 className="text-[26px] font-semibold leading-tight text-foreground">{title}</h1>
                            <p className="mt-1.5 text-sm text-default-500">{subtitle}</p>
                        </div>

                        {isOnBackup ? (
                            <div className="mb-5 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
                                <p>
                                    ตอนนี้คุณกำลังเข้าใช้งานผ่าน<span className="font-medium">ลิงก์สำรอง</span> เพื่อความเสถียรของการใช้งาน กรุณาเปลี่ยนไปใช้ลิงก์หลักของคณะ
                                </p>
                                <a
                                    href={mainOriginUrl}
                                    className="mt-3 flex w-full animate-pulse items-center justify-center gap-1.5 rounded-full bg-amber-600 px-3 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-amber-600/40 transition-colors hover:bg-amber-700"
                                >
                                    ไปใช้ลิงก์หลัก
                                    <Icon icon="solar:arrow-right-linear" className="text-base" />
                                </a>
                            </div>
                        ) : null}

                        {children}

                        <p className="mt-7 text-center text-xs leading-5 text-default-500">
                            {t("continuingMeansAccept")}{" "}
                            <Link href={loginPolicyLinks.terms} className="text-xs text-default-600 underline hover:text-primary">
                                {t("termsOfUse")}
                            </Link>
                            ,{" "}
                            <Link href={loginPolicyLinks.privacy} className="text-xs text-default-600 underline hover:text-primary">
                                {t("privacyPolicy")}
                            </Link>
                            , และ{" "}
                            <Link href={loginPolicyLinks.cookies} className="text-xs text-default-600 underline hover:text-primary">
                                {t("cookiePolicy")}
                            </Link>
                            {" "}{t("ofITIIAssistClassroom")}
                        </p>
                    </div>
                </div>

                {/* จอใหญ่แสดงข้อความนี้บนแผงรูปแล้ว มือถือจึงแสดงท้ายหน้าแทน */}
                <LoginCredits className="justify-center px-4 pb-6 text-default-500 lg:hidden" linkClassName="hover:text-primary" />
            </main>
        </div>
    );
}

export default LoginShell;
