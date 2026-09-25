"use client";

// ปุ่มเข้าสู่ระบบด้วย KKU SSO (SSONext) ใช้ร่วมกันทั้งหน้าล็อกอินผู้สอน
// หน้าล็อกอินนักศึกษา และการ์ดผูกบัญชีในหน้าโปรไฟล์
// ตราสัญลักษณ์มหาวิทยาลัยเป็นสีแดงอิฐบนพื้นโปร่งใส จึงคุมพื้นปุ่มให้เป็นสีขาว
// ทั้งโหมดสว่างและโหมดมืด เพื่อให้ตราอ่านออกเสมอ

import Image from "next/image";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";

interface KKUSSOButtonProps {
  onPress: () => void;
  /** "md" สำหรับหน้าล็อกอิน (เต็มความกว้าง), "sm" สำหรับแถวผูกบัญชีในหน้าโปรไฟล์ */
  size?: "sm" | "md";
  fullWidth?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  className?: string;
}

/** ตราสัญลักษณ์มหาวิทยาลัยขอนแก่น ใช้เป็นไอคอนของช่องทาง KKU SSO */
export function KKULogoMark({ className = "h-6" }: { className?: string }) {
  return (
    <Image
      src="/images/official-logo-kku.png"
      alt=""
      width={3185}
      height={2963}
      // ตราถูกย่อเหลือ 20-32px เสมอ ถ้าไม่บอก sizes ตัว optimizer จะไปดึงไฟล์กว้าง 3840px มาให้
      sizes="32px"
      className={`w-auto object-contain ${className}`}
    />
  );
}

export function KKUSSOButton({
  onPress,
  size = "md",
  fullWidth = true,
  isLoading = false,
  isDisabled = false,
  className = "",
}: KKUSSOButtonProps) {
  const isCompact = size === "sm";

  return (
    <Button
      type="button"
      variant="bordered"
      radius="sm"
      size={isCompact ? "sm" : "md"}
      isLoading={isLoading}
      isDisabled={isDisabled}
      className={[
        isCompact ? "h-9 px-3 text-[13px]" : "h-10.5 text-[15px]",
        fullWidth ? "w-full" : "",
        "shrink-0 whitespace-nowrap border-blue-200 bg-white font-medium text-slate-700 data-[hover=true]:border-blue-300 data-[hover=true]:bg-blue-50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onPress={onPress}
      startContent={isLoading ? null : <KKULogoMark className={isCompact ? "h-5" : "h-6"} />}
    >
      Login with KKU Account
    </Button>
  );
}

interface KKUSSOHeroButtonProps {
  onPress: () => void;
  label: string;
  description: string;
}

/**
 * ปุ่ม KKU SSO ตัวใหญ่สำหรับหน้าเข้าสู่ระบบหลัก แบบเดียวกับระบบ COCO TAS
 * มีตรามหาวิทยาลัย ชื่อปุ่ม และคำอธิบายบรรทัดล่าง ใช้ <button> ธรรมดา
 * เพราะเป็นการสั่งเปลี่ยนหน้า (onPress ตั้ง window.location เอง)
 */
export function KKUSSOHeroButton({ onPress, label, description }: KKUSSOHeroButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="group flex h-14 w-full items-center gap-3 rounded-xl border border-divider bg-content1 pl-2 pr-4 text-foreground shadow-sm transition hover:border-[#A63A22]/50 hover:bg-[#A63A22]/[0.03] hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {/* ตราเป็นสีแดงอิฐบนพื้นโปร่งใส จึงล็อกพื้นเป็นสีขาวแม้อยู่ในโหมดมืด */}
      <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: "#fff" }}>
        <KKULogoMark className="h-8" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] font-medium leading-tight">{label}</span>
        <span className="mt-0.5 block text-xs leading-tight text-default-500">{description}</span>
      </span>
      <Icon
        icon="solar:arrow-right-linear"
        className="size-4 shrink-0 text-default-400 transition group-hover:translate-x-0.5 group-hover:text-foreground"
      />
    </button>
  );
}

export default KKUSSOButton;
