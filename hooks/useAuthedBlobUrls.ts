"use client";

import { useEffect, useRef, useState } from "react";
import { apiService } from "@/services/api.service";

/**
 * ดึงไฟล์ที่ต้อง auth (เช่น หลักฐานการลา) มาเป็น blob URL ให้ใช้กับ <img src>/<a href> ได้ตรง ๆ
 * ทำไมต้องทำแบบนี้: endpoint พวกนี้อยู่หลัง cookie auth ที่หมดอายุใน 15 นาที ลิงก์/รูปที่ชี้ตรง
 * ไปที่ endpoint จะพังเงียบ ๆ (รูปแตก, กดเปิดไม่ขึ้น) ถ้าเปิดหน้าไว้นานเกินนั้น เพราะเบราว์เซอร์ไม่มี
 * ทาง refresh token เองระหว่าง navigate/โหลดรูป — ต้องผ่าน apiService.getBlob ที่มี retry-after-refresh
 *
 * คืนค่า map: path -> blob URL (ยังโหลดอยู่ = undefined, โหลดไม่สำเร็จ = null)
 */
export function useAuthedBlobUrls(paths: string[]): Record<string, string | null | undefined> {
  const [urls, setUrls] = useState<Record<string, string | null | undefined>>({});
  const urlsRef = useRef<Record<string, string>>({});
  const pathsKey = paths.join("|");

  useEffect(() => {
    let cancelled = false;
    const toFetch = paths.filter((p) => !(p in urlsRef.current));
    if (toFetch.length === 0) return;

    (async () => {
      for (const path of toFetch) {
        const blob = await apiService.getBlob(path);
        if (cancelled) return;
        if (blob) {
          const url = URL.createObjectURL(blob);
          urlsRef.current[path] = url;
          setUrls((prev) => ({ ...prev, [path]: url }));
        } else {
          setUrls((prev) => ({ ...prev, [path]: null }));
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathsKey]);

  // ล้าง blob URL ทั้งหมดตอน unmount กันหน่วยความจำรั่ว
  useEffect(() => {
    return () => {
      Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  return urls;
}
