"use client";

import { useEffect, useState } from "react";

import { resolveLoginProviderMode, type LoginProviderMode } from "@/lib/auth-providers";

/**
 * อ่านช่องทางล็อกอินหลักของโดเมนปัจจุบัน (KKU SSO หรือ Google)
 *
 * คืน null ในรอบเรนเดอร์ฝั่งเซิร์ฟเวอร์และรอบ hydrate แรก เพราะ hostname รู้ได้
 * เฉพาะบนเบราว์เซอร์ ผู้เรียกต้องเผื่อสถานะกำลังโหลดไว้ด้วย
 */
export function useLoginProviderMode(): LoginProviderMode | null {
  const [mode, setMode] = useState<LoginProviderMode | null>(null);

  useEffect(() => {
    setMode(resolveLoginProviderMode(window.location.hostname));
  }, []);

  return mode;
}

export default useLoginProviderMode;
