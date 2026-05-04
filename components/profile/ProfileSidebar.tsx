"use client";

import { memo } from "react";
import { Icon } from "@iconify/react";

export type MenuKey = "personal" | "authentication" | "sessions";

export interface MenuItem {
  key: MenuKey;
  label: string;
  icon: string;
  description: string;
}

export const MENU_ITEMS: MenuItem[] = [
  {
    key: "personal",
    label: "ข้อมูลส่วนตัว",
    icon: "solar:user-bold",
    description: "จัดการข้อมูลส่วนตัวและรูปโปรไฟล์",
  },
  {
    key: "authentication",
    label: "การยืนยันตัวตน",
    icon: "solar:shield-keyhole-bold",
    description: "รหัสผ่านและการตั้งค่าความปลอดภัย",
  },
  {
    key: "sessions",
    label: "อุปกรณ์ที่เข้าสู่ระบบ",
    icon: "solar:devices-bold",
    description: "จัดการอุปกรณ์ที่เชื่อมต่อ",
  },
];

interface ProfileSidebarProps {
  activeMenu: MenuKey;
  setActiveMenu: (key: MenuKey) => void;
  setIsMobileMenuOpen?: (open: boolean) => void;
  isMobile?: boolean;
}

function ProfileSidebar({ 
  activeMenu, 
  setActiveMenu, 
  setIsMobileMenuOpen, 
  isMobile = false 
}: ProfileSidebarProps) {
  return (
    <div className={`space-y-1 ${isMobile ? '' : 'sticky top-4'}`}>
      {MENU_ITEMS.map((item) => (
        <button
          key={item.key}
          onClick={() => {
            setActiveMenu(item.key);
            if (isMobile && setIsMobileMenuOpen) setIsMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
            activeMenu === item.key
              ? 'bg-primary text-white shadow-lg shadow-primary/25'
              : 'hover:bg-default-100 text-default-700'
          }`}
        >
          <Icon icon={item.icon} className="text-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={`font-medium truncate ${activeMenu === item.key ? 'text-white' : ''}`}>
              {item.label}
            </p>
            {!isMobile && (
              <p className={`text-xs truncate ${activeMenu === item.key ? 'text-white/70' : 'text-default-400'}`}>
                {item.description}
              </p>
            )}
          </div>
          {activeMenu === item.key && (
            <Icon icon="solar:alt-arrow-right-bold" className="text-lg flex-shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}

export default memo(ProfileSidebar);
