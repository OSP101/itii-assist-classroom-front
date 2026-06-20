import type { Metadata } from "next";
import DevicePermissionCheckClient from "@/components/device/DevicePermissionCheckClient";

export const metadata: Metadata = {
  title: "Permissions Check",
  description: "ตรวจสิทธิ์กล้อง ตำแหน่ง และการแจ้งเตือนก่อนใช้งานจริง",
};

export default function PermissionsPage() {
  return <DevicePermissionCheckClient />;
}
