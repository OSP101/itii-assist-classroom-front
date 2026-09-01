"use client";

// ปุ่มเข้าสู่ระบบด้วย KKU SSO (SSONext) ใช้ร่วมกันทั้งหน้าล็อกอินผู้สอน
// หน้าล็อกอินนักศึกษา และการ์ดผูกบัญชีในหน้าโปรไฟล์
// ตราสัญลักษณ์มหาวิทยาลัยเป็นสีแดงอิฐบนพื้นโปร่งใส จึงคุมพื้นปุ่มให้เป็นสีขาว
// ทั้งโหมดสว่างและโหมดมืด เพื่อให้ตราอ่านออกเสมอ

import Image from "next/image";
import { Button } from "@heroui/button";

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

export default KKUSSOButton;
