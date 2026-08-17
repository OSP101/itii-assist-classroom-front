import type { Metadata } from "next";
import DevicePermissionCheckClient from "@/components/device/DevicePermissionCheckClient";

export const metadata: Metadata = {
  title: "เช็กสิทธิ์อุปกรณ์",
  description: "ตรวจกล้อง ตำแหน่ง และความพร้อมของอุปกรณ์ก่อนใช้งาน COCO LABS จริง",
};

export default function DeviceCheckPage() {
  return <DevicePermissionCheckClient />;
}
