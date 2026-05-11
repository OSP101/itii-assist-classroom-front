"use client";

import { memo } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";

export type MenuKey = "personal" | "authentication" | "sessions" | "preferences";

export interface MenuItem {
  key: MenuKey;
  labelKey: string;
  icon: string;
  descriptionKey: string;
}

export const MENU_ITEMS: MenuItem[] = [
  {
    key: "personal",
    labelKey: "personalInfo",
    icon: "solar:user-bold",
    descriptionKey: "managePersonalInfoAndAvatar",
  },
  {
    key: "authentication",
    labelKey: "authentication",
    icon: "solar:shield-keyhole-bold",
    descriptionKey: "passwordAndSecuritySettings",
  },
  {
    key: "sessions",
    labelKey: "signedInDevices",
    icon: "solar:devices-bold",
    descriptionKey: "manageConnectedDevices",
  },
  {
    key: "preferences",
    labelKey: "appearanceAndLanguage",
    icon: "solar:settings-bold",
    descriptionKey: "themeLanguageFontForThisAccount",
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
  const t = useI18n();

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
          <Icon icon={item.icon} className="text-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={`font-medium truncate ${activeMenu === item.key ? 'text-white' : ''}`}>
              {t(item.labelKey)}
            </p>
            {!isMobile && (
              <p className={`text-xs truncate ${activeMenu === item.key ? 'text-white/70' : 'text-default-400'}`}>
                {t(item.descriptionKey)}
              </p>
            )}
          </div>
          {activeMenu === item.key && (
            <Icon icon="solar:alt-arrow-right-bold" className="text-lg shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}

export default memo(ProfileSidebar);
