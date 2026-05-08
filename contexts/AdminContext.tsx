"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authService, User } from "@/services";
import { addToast } from "@heroui/toast";

interface AdminContextType {
  user: User | null;
  isLoading: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  expandedMenus: string[];
  toggleMenu: (key: string) => void;
  handleLogout: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = authService.getStoredUser();
    return storedUser?.role === "admin" ? storedUser : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  // Auto-expand menu based on current path
  useEffect(() => {
    const pathToMenuMap: Record<string, string> = {
      '/admin/users': 'users',
      '/admin/users/add': 'users',
      '/admin/students': 'students',
      '/admin/students/import': 'students',
      '/admin/courses': 'courses',
      '/admin/courses/add': 'courses',
      '/admin/sections': 'courses',
      '/admin/logs': 'analytics',
      '/admin/analytics': 'analytics',
    };

    const menuKey = pathToMenuMap[pathname];
    if (menuKey && !expandedMenus.includes(menuKey)) {
      setExpandedMenus(prev => [...prev, menuKey]);
    }
  }, [pathname]);

  // Auth check
  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }

    const storedUser = authService.getStoredUser();
    if (!storedUser || storedUser.role !== 'admin') {
      addToast({
        title: "ไม่มีสิทธิ์เข้าถึง",
        description: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้",
        color: "danger",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
      router.push('/login');
      return;
    }

    setUser(storedUser);
    setIsLoading(false);
  }, [router]);

  const toggleMenu = (key: string) => {
    setExpandedMenus(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const handleLogout = async () => {
    await authService.logout();
    addToast({
      title: "ออกจากระบบสำเร็จ",
      description: "กำลังนำท่านไปยังหน้าเข้าสู่ระบบ",
      color: "success",
      timeout: 3000,
                shouldShowTimeoutProgress: true,
    });
    router.push('/login');
  };

  return (
    <AdminContext.Provider
      value={{
        user,
        isLoading,
        sidebarCollapsed,
        setSidebarCollapsed,
        expandedMenus,
        toggleMenu,
        handleLogout,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
