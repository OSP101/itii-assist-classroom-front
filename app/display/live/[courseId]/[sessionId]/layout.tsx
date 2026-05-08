import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "หน้าจอเช็คชื่อ",
    description: "แสดงผลการเช็คชื่อแบบ Realtime สำหรับหน้าจอในห้องเรียน",
};

export default function DisplayLiveLayout({ children }: { children: React.ReactNode }) {
    return children;
}
