import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "หน้าจอเช็กชื่อ",
    description: "แสดงผลการเช็กชื่อแบบ Realtime สำหรับหน้าจอในห้องเรียน",
};

export default function DisplayLiveLayout({ children }: { children: React.ReactNode }) {
    return children;
}
