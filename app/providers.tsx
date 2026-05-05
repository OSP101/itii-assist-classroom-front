"use client";

import type { ThemeProviderProps } from "next-themes";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { ToastProvider } from "@heroui/toast";
import { useRouter, usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { SocketProvider } from "@/contexts/SocketContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { authService } from "@/services/auth.service";
import { IconifyPreload } from "@/components/IconifyPreload";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

function useAuthSync() {
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    // Subscribe to auth changes from other tabs
    const unsubscribe = authService.onAuthChange((event) => {
      if (event.type === 'logout') {
        console.log('📢 Logout detected from another tab');
        // Don't redirect if already on login page
        if (!pathname?.startsWith('/login')) {
          // Force redirect to login
          window.location.href = '/login';
        }
      }
    });

    return unsubscribe;
  }, [pathname, router]);
}

// Wrapper component to use the auth sync hook
function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  useAuthSync();
  return <>{children}</>;
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <IconifyPreload />
      <NextThemesProvider {...themeProps}>
        <SocketProvider>
          <NotificationProvider>
            <AuthSyncProvider>
              {children}
            </AuthSyncProvider>
          </NotificationProvider>
        </SocketProvider>
        <ToastProvider placement="top-right" toastProps={{timeout: 3000, shouldShowTimeoutProgress: true}} />
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
