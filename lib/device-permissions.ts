export type PermStatus = "unknown" | "granted" | "denied" | "prompt" | "unsupported";

export interface PermInfo {
  id: "location" | "camera" | "notifications";
  label: string;
  description: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  usedFor: string;
}

export const PERMS: PermInfo[] = [
  {
    id: "location",
    label: "ตำแหน่งที่ตั้ง",
    description: "อนุญาตให้แอปเข้าถึง GPS ของเครื่อง",
    icon: "solar:map-point-bold-duotone",
    iconColor: "text-sky-600",
    bgColor: "bg-sky-50 border-sky-100",
    usedFor: "เช็กชื่อเข้าเรียน",
  },
  {
    id: "camera",
    label: "กล้องถ่ายภาพ",
    description: "อนุญาตให้แอปเปิดกล้องหน้า/หลัง",
    icon: "solar:camera-bold-duotone",
    iconColor: "text-violet-600",
    bgColor: "bg-violet-50 border-violet-100",
    usedFor: "สแกน QR Code",
  },
  {
    id: "notifications",
    label: "การแจ้งเตือน",
    description: "รับ push notification จากระบบ",
    icon: "solar:bell-bold-duotone",
    iconColor: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-100",
    usedFor: "แจ้งเตือนจากอาจารย์",
  },
];

export async function queryPermStatus(id: PermInfo["id"]): Promise<PermStatus> {
  if (typeof window === "undefined") return "unknown";

  if (id === "notifications") {
    if (!("Notification" in window)) return "unsupported";
    const p = Notification.permission;
    if (p === "granted") return "granted";
    if (p === "denied") return "denied";
    return "prompt";
  }

  if (id === "camera") {
    if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
    try {
      const result = await navigator.permissions.query({ name: "camera" as PermissionName });
      return result.state as PermStatus;
    } catch {
      return "prompt";
    }
  }

  if (id === "location") {
    if (!("geolocation" in navigator)) return "unsupported";
    try {
      const result = await navigator.permissions.query({ name: "geolocation" });
      return result.state as PermStatus;
    } catch {
      return "prompt";
    }
  }

  return "unknown";
}

export async function queryAllPerms(): Promise<Record<string, PermStatus>> {
  const entries = await Promise.all(
    PERMS.map(async (p) => {
      const s = await queryPermStatus(p.id);
      return [p.id, s] as const;
    }),
  );
  return Object.fromEntries(entries);
}
