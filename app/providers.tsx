"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { ToastProvider } from "@heroui/toast";
import { useRouter, usePathname } from "next/navigation";
import { SocketProvider } from "@/contexts/SocketContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { GlobalSettingsProvider, type InitialGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { authService } from "@/services/auth.service";
import { SessionTimeoutWatcher } from "@/components/auth/SessionTimeoutWatcher";
import { IconifyPreload } from "@/components/IconifyPreload";
import { PwaBootstrap } from "@/components/system/PwaBootstrap";
import { VisualViewportBootstrap } from "@/components/system/VisualViewportBootstrap";
import { SWRProvider, clearAllCaches } from "@/lib/swr";
import { clearClassroomCache } from "@/app/(instructor)/classroom/[id]/hooks/useClassroomData";

export interface ProvidersProps {
  children: React.ReactNode;
  initialSettings: InitialGlobalSettings;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

function useAuthSync() {
  const pathname = usePathname();

  React.useEffect(() => {
    // Subscribe to auth changes from other tabs
    const unsubscribe = authService.onAuthChange((event) => {
      if (event.type === 'logout') {
        // Drop every cached response before leaving. Without this the next
        // person to sign in on a shared lab machine would briefly see the
        // previous user's courses rendered from cache while their own data
        // loads.
        void clearAllCaches();
        clearClassroomCache();
        // Don't redirect if already on login page
        if (!pathname?.startsWith('/login')) {
          // Force redirect to login
          window.location.href = '/login';
        }
      }
    });

    return unsubscribe;
  }, [pathname]);
}

// Wrapper component to use the auth sync hook
function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  useAuthSync();
  return <>{children}</>;
}

export function Providers({ children, initialSettings }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <PwaBootstrap />
      <VisualViewportBootstrap />
      <IconifyPreload />
      <GlobalSettingsProvider initialSettings={initialSettings}>
        <SWRProvider>
          <SocketProvider>
            <NotificationProvider>
              <AuthSyncProvider>
                <SessionTimeoutWatcher />
                {children}
              </AuthSyncProvider>
            </NotificationProvider>
          </SocketProvider>
        </SWRProvider>
        <ToastProvider placement="top-right" toastProps={{ timeout: 3000, shouldShowTimeoutProgress: true }} />
      </GlobalSettingsProvider>
    </HeroUIProvider>
  );
}
