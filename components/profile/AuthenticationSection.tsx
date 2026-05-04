"use client";

import { memo, useState, useEffect, useCallback, useRef } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { twoFactorService, TwoFactorStatus } from "@/services/twoFactor.service";
import { oauthService, OAuthAccount } from "@/services/oauth.service";
import TwoFactorSetupModal from "./TwoFactorSetupModal";
import TwoFactorDisableModal from "./TwoFactorDisableModal";
import RegenerateBackupCodesModal from "./RegenerateBackupCodesModal";

interface AuthenticationSectionProps {
  onOpenPasswordModal: () => void;
  userEmail?: string | null;
}

// Provider definitions with management URLs
const PROVIDERS = [
  { 
    key: 'google', 
    name: 'Google', 
    icon: 'logos:google-icon', 
    description: 'เข้าสู่ระบบด้วย Google Account',
    manageUrl: 'https://myaccount.google.com/connections',
    enabled: true,
  },
  { 
    key: 'github', 
    name: 'GitHub', 
    icon: 'mingcute:github-fill', 
    description: 'เข้าสู่ระบบด้วย GitHub Account',
    manageUrl: 'https://github.com/settings/applications',
    enabled: true,
  },
  { 
    key: 'apple', 
    name: 'Apple', 
    icon: 'ic:baseline-apple', 
    description: 'เข้าสู่ระบบด้วย Apple ID',
    manageUrl: 'https://appleid.apple.com/account/manage',
    enabled: false,
    comingSoon: true,
  },
] as const;


function AuthenticationSection({ onOpenPasswordModal, userEmail }: AuthenticationSectionProps) {
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [isLoading2FA, setIsLoading2FA] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [isReconfiguring, setIsReconfiguring] = useState(false);
  
  // OAuth accounts state
  const [linkedAccounts, setLinkedAccounts] = useState<OAuthAccount[]>([]);
  const [isLoadingOAuth, setIsLoadingOAuth] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [providerToUnlink, setProviderToUnlink] = useState<string | null>(null);

  // Snapshot of linked provider keys before initiating a link — used to detect new links
  const linkedBeforeLinkRef = useRef<Set<string>>(new Set());
  // Timer ref for DB polling cleanup
  const dbPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Safety timeout ref — auto-clears loading after 2 minutes
  const linkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load 2FA status
  const load2FAStatus = useCallback(async () => {
    setIsLoading2FA(true);
    try {
      const result = await twoFactorService.getStatus();
      if (result.success && result.data) {
        setTwoFactorStatus(result.data);
      }
    } catch (error) {
      console.error("Failed to load 2FA status:", error);
    } finally {
      setIsLoading2FA(false);
    }
  }, []);

  // Load OAuth accounts
  const loadOAuthAccounts = useCallback(async () => {
    setIsLoadingOAuth(true);
    try {
      const result = await oauthService.getLinkedAccounts();
      if (result.success && result.data) {
        setLinkedAccounts(result.data);
      }
    } catch (error) {
      console.error("Failed to load OAuth accounts:", error);
    } finally {
      setIsLoadingOAuth(false);
    }
  }, []);

  useEffect(() => {
    load2FAStatus();
    loadOAuthAccounts();
  }, [load2FAStatus, loadOAuthAccounts]);

  // Listen for OAuth link result via BroadcastChannel (fast path — instant if tab can broadcast).
  // Also poll DB as fallback (reliable even if BroadcastChannel or tab.close fails).
  useEffect(() => {
    const channel = new BroadcastChannel("oauth_link_channel");

    channel.onmessage = (event) => {
      const data = event.data;
      if (data?.type !== "oauth_link_result") return;

      // Stop DB polling — we already know the result
      if (dbPollRef.current) {
        clearInterval(dbPollRef.current);
        dbPollRef.current = null;
      }

      if (data.success) {
        addToast({
          title: "เชื่อมต่อสำเร็จ",
          description: `เชื่อมต่อบัญชี ${data.providerName} เรียบร้อยแล้ว`,
          color: "success",
          timeout: 3000,
          shouldShowTimeoutProgress: true,
        });
        loadOAuthAccounts();
      } else {
        addToast({
          title: "เชื่อมต่อไม่สำเร็จ",
          description: data.error || "ไม่สามารถเชื่อมต่อบัญชีได้",
          color: "danger",
          timeout: 3000,
          shouldShowTimeoutProgress: true,
        });
      }
      localStorage.removeItem("pending_oauth_link_provider");
      setLinkingProvider(null);
    };

    return () => channel.close();
  }, [loadOAuthAccounts]);

  // Cleanup DB poll & safety timeout on unmount
  useEffect(() => {
    return () => {
      if (dbPollRef.current) {
        clearInterval(dbPollRef.current);
        dbPollRef.current = null;
      }
      if (linkingTimeoutRef.current) {
        clearTimeout(linkingTimeoutRef.current);
        linkingTimeoutRef.current = null;
      }
    };
  }, []);

  // When user switches back to this tab while linking, check immediately
  useEffect(() => {
    if (!linkingProvider) return;

    const provider = linkingProvider;
    const providerName = provider === "github" ? "GitHub" : provider === "google" ? "Google" : provider;
    let checking = false;

    const handleTabFocus = async () => {
      if (document.visibilityState === "hidden" || checking) return;
      checking = true;
      try {
        const result = await oauthService.getLinkedAccounts();
        if (!result.success || !result.data) return;

        const nowLinked = result.data.some(acc => acc.provider === provider);
        const wasLinked = linkedBeforeLinkRef.current.has(provider);

        if (nowLinked && !wasLinked) {
          // Stop DB poll & safety timeout
          if (dbPollRef.current) { clearInterval(dbPollRef.current); dbPollRef.current = null; }
          if (linkingTimeoutRef.current) { clearTimeout(linkingTimeoutRef.current); linkingTimeoutRef.current = null; }
          localStorage.removeItem("pending_oauth_link_provider");

          setLinkingProvider(prev => {
            if (prev === provider) {
              addToast({
                title: "เชื่อมต่อสำเร็จ",
                description: `เชื่อมต่อบัญชี ${providerName} เรียบร้อยแล้ว`,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
              });
              loadOAuthAccounts();
              return null;
            }
            return prev;
          });
        }
      } catch { /* ignore */ } finally {
        checking = false;
      }
    };

    document.addEventListener("visibilitychange", handleTabFocus);
    window.addEventListener("focus", handleTabFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleTabFocus);
      window.removeEventListener("focus", handleTabFocus);
    };
  }, [linkingProvider, loadOAuthAccounts]);

  const getMethodLabel = (method: string | null) => {
    switch (method) {
      case "totp":
        return "Authenticator App";
      case "email":
        return "Email";
      default:
        return "ไม่ระบุ";
    }
  };

  // Check if a provider is linked
  const isProviderLinked = (provider: string) => {
    return linkedAccounts.some(acc => acc.provider === provider);
  };

  // Get linked account for a provider
  const getLinkedAccount = (provider: string) => {
    return linkedAccounts.find(acc => acc.provider === provider);
  };

  // Show unlink confirmation modal
  const openUnlinkModal = (provider: string) => {
    setProviderToUnlink(provider);
    setShowUnlinkModal(true);
  };

  // Handle confirmed unlink
  const handleConfirmUnlink = async () => {
    if (!providerToUnlink) return;
    
    setShowUnlinkModal(false);
    setUnlinkingProvider(providerToUnlink);
    try {
      const result = await oauthService.unlinkAccount(providerToUnlink);
      if (result.success) {
        addToast({
          title: "สำเร็จ",
          description: `ยกเลิกการเชื่อมต่อ ${oauthService.getProviderDisplayName(providerToUnlink)} แล้ว`,
          color: "success",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
        await loadOAuthAccounts();
      } else {
        addToast({
          title: "เกิดข้อผิดพลาด",
          description: result.error || "ไม่สามารถยกเลิกการเชื่อมต่อได้",
          color: "danger",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      }
    } catch (error) {
      console.error("Unlink error:", error);
      addToast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถยกเลิกการเชื่อมต่อได้",
        color: "danger",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
    } finally {
      setUnlinkingProvider(null);
      setProviderToUnlink(null);
    }
  };


  // Start polling DB to detect when the provider appears in linked accounts.
  // This is the reliable fallback — works even if BroadcastChannel fails.
  // Checks immediately, then every 3s.
  const startDbPoll = useCallback((provider: string) => {
    // Stop any existing poll
    if (dbPollRef.current) {
      clearInterval(dbPollRef.current);
    }

    const providerName = provider === "github" ? "GitHub" : provider === "google" ? "Google" : provider;

    const checkOnce = async () => {
      try {
        const result = await oauthService.getLinkedAccounts();
        if (!result.success || !result.data) return;

        const nowLinked = result.data.some(acc => acc.provider === provider);
        const wasLinked = linkedBeforeLinkRef.current.has(provider);

        if (nowLinked && !wasLinked) {
          // New link detected in DB!
          if (dbPollRef.current) {
            clearInterval(dbPollRef.current);
            dbPollRef.current = null;
          }
          localStorage.removeItem("pending_oauth_link_provider");

          // Only show toast if BroadcastChannel hasn't already handled it
          setLinkingProvider(prev => {
            if (prev === provider) {
              addToast({
                title: "เชื่อมต่อสำเร็จ",
                description: `เชื่อมต่อบัญชี ${providerName} เรียบร้อยแล้ว`,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
              });
              loadOAuthAccounts();
              return null;
            }
            return prev; // Already handled by BroadcastChannel
          });
        }
      } catch {
        // Network error — skip this cycle
      }
    };

    // Check immediately after a short delay (give the backend time to persist)
    setTimeout(checkOnce, 1500);
    // Then keep polling every 3s
    dbPollRef.current = setInterval(checkOnce, 3000);
  }, [loadOAuthAccounts]);

  // Open OAuth tab and start DB polling
  const initiateOAuthLink = useCallback((provider: string) => {
    // Snapshot current linked providers before starting
    linkedBeforeLinkRef.current = new Set(linkedAccounts.map(a => a.provider));
    setLinkingProvider(provider);

    const tab = oauthService.initiateLink(provider);
    if (!tab) {
      setLinkingProvider(null);
      addToast({
        title: "ไม่สามารถเปิดหน้าต่างได้",
        description: "กรุณาอนุญาต Popup ในเบราว์เซอร์แล้วลองใหม่อีกครั้ง",
        color: "warning",
        timeout: 5000,
        shouldShowTimeoutProgress: true,
      });
      return;
    }

    // Start DB polling — will detect the link even if tab can't broadcast
    startDbPoll(provider);

    // Safety timeout: auto-clear loading after 2 minutes
    if (linkingTimeoutRef.current) clearTimeout(linkingTimeoutRef.current);
    linkingTimeoutRef.current = setTimeout(() => {
      setLinkingProvider(prev => {
        if (prev === provider) {
          if (dbPollRef.current) { clearInterval(dbPollRef.current); dbPollRef.current = null; }
          localStorage.removeItem("pending_oauth_link_provider");
          return null;
        }
        return prev;
      });
      linkingTimeoutRef.current = null;
    }, 120_000);
  }, [linkedAccounts, startDbPoll]);

  const handleLink = useCallback((provider: string) => {
    initiateOAuthLink(provider);
  }, [initiateOAuthLink]);

  const handleReAuthenticate = useCallback((provider: string) => {
    initiateOAuthLink(provider);
  }, [initiateOAuthLink]);

  // Get provider management URL
  const getProviderManageUrl = (providerKey: string) => {
    const provider = PROVIDERS.find(p => p.key === providerKey);
    return provider?.manageUrl || '#';
  };

  
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Security Warning Header */}
      <div className="flex items-center gap-3 p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-warning-900/20 dark:to-orange-900/20 border border-warning-200 dark:border-warning-800 rounded-xl">
        <div className="p-2 bg-warning-100 dark:bg-warning-900/50 rounded-full animate-pulse">
          <Icon icon="solar:shield-warning-bold" className="text-xl sm:text-2xl text-warning-600 dark:text-warning-400" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-warning-800 dark:text-warning-300">ความปลอดภัยบัญชี</h2>
          <p className="text-xs sm:text-sm text-warning-700 dark:text-warning-400">จัดการรหัสผ่านและการยืนยันตัวตนเพื่อปกป้องบัญชีของคุณ</p>
        </div>
      </div>

      {/* Password Card */}
      <Card className="border border-default-200 shadow-sm">
        <CardBody className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 sm:p-2.5 bg-primary-100 rounded-lg flex-shrink-0">
                <Icon icon="solar:lock-password-bold" className="text-lg sm:text-xl text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-default-900 text-sm sm:text-base">รหัสผ่าน</h3>
                <p className="text-xs sm:text-sm text-default-500 mt-0.5 sm:mt-1">
                  คุณสามารถเปลี่ยนรหัสผ่านได้ตลอดเวลา
                </p>
              </div>
            </div>
            <Button 
              color="primary" 
              className="bg-gradient-to-br from-blue-400 to-indigo-500 w-full sm:w-auto"
              size="sm"
              onPress={onOpenPasswordModal}
              startContent={<Icon icon="solar:key-linear" />}
            >
              เปลี่ยนรหัสผ่าน
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Two-Factor Authentication */}
      <Card className="border border-default-200 shadow-sm">
        <CardBody className="p-4 sm:p-6">
          {isLoading2FA ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : twoFactorStatus?.enabled ? (
            // 2FA Enabled State
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 sm:p-2.5 bg-success-100 rounded-lg flex-shrink-0">
                    <Icon icon="solar:shield-check-bold" className="text-lg sm:text-xl text-success-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-default-900 text-sm sm:text-base">Two-Factor Authentication</h3>
                      <Chip size="sm" color="success" variant="flat">เปิดใช้งาน</Chip>
                    </div>
                    <p className="text-xs sm:text-sm text-default-500 mt-0.5 sm:mt-1">
                      บัญชีของคุณได้รับการปกป้องด้วยการยืนยันตัวตนสองขั้นตอน
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-default-50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon 
                      icon={twoFactorStatus.method === "totp" ? "solar:smartphone-bold" : "solar:letter-bold"} 
                      className="text-lg sm:text-xl text-default-600" 
                    />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-default-700">วิธีการยืนยัน</p>
                      <p className="text-xs sm:text-sm text-default-500">{getMethodLabel(twoFactorStatus.method)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {twoFactorStatus.method === "totp" && (
                      <Button 
                        color="primary" 
                        variant="flat" 
                        size="sm"
                        startContent={<Icon icon="solar:pen-linear" />}
                        onPress={() => {
                          setIsReconfiguring(true);
                          setShowSetupModal(true);
                        }}
                      >
                        แก้ไข
                      </Button>
                    )}
                    <Button 
                      color="danger" 
                      variant="flat" 
                      size="sm"
                      onPress={() => setShowDisableModal(true)}
                    >
                      ปิดการใช้งาน
                    </Button>
                  </div>
                </div>
              </div>



              {/* Recovery Codes Section */}
              <div className="bg-default-50 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon icon="solar:key-bold" className="text-lg sm:text-xl text-default-600" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-default-700">Recovery Codes</p>
                      <p className="text-xs sm:text-sm text-default-500">รหัสสำรองสำหรับเข้าสู่ระบบ</p>
                    </div>
                  </div>
                  <Button 
                    color="warning" 
                    variant="flat" 
                    size="sm"
                    startContent={<Icon icon="solar:refresh-linear" />}
                    onPress={() => setShowRegenerateModal(true)}
                  >
                    สร้างใหม่
                  </Button>
                </div>
              </div>

              {/* Info about backup codes */}
              <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-warning-50 border border-warning-200 rounded-lg">
                <Icon icon="solar:info-circle-bold" className="text-base sm:text-lg text-warning-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm text-warning-800">
                    หากสูญเสียการเข้าถึงอุปกรณ์ยืนยันตัวตน คุณสามารถใช้รหัสสำรองเข้าสู่ระบบได้
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // 2FA Disabled State
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 sm:p-2.5 bg-warning-100 rounded-lg flex-shrink-0">
                  <Icon icon="solar:shield-warning-bold" className="text-lg sm:text-xl text-warning-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-default-900 text-sm sm:text-base">Two-Factor Authentication</h3>
                    <Chip size="sm" color="warning" variant="flat">ปิดอยู่</Chip>
                  </div>
                  <p className="text-xs sm:text-sm text-default-500 mt-0.5 sm:mt-1">
                    เพิ่มความปลอดภัยให้บัญชีของคุณด้วยการยืนยันตัวตนสองขั้นตอน
                  </p>
                </div>
              </div>
              <Button 
                color="primary" 
                size="sm" 
                className="bg-gradient-to-br from-blue-400 to-indigo-500 w-full sm:w-auto"
                startContent={<Icon icon="solar:shield-plus-linear" />}
                onPress={() => setShowSetupModal(true)}
              >
                ตั้งค่า 2FA
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Login Providers */}
      <Card className="border border-default-200 shadow-sm">
        <CardHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-default-100">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Icon icon="solar:link-bold" className="text-base sm:text-lg text-primary" />
              <h3 className="font-semibold text-sm sm:text-base">เชื่อมต่อบัญชี</h3>
            </div>
            {linkedAccounts.length > 0 && (
              <Chip size="sm" color="success" variant="flat">
                {linkedAccounts.length} เชื่อมต่อแล้ว
              </Chip>
            )}
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {isLoadingOAuth ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : (
            PROVIDERS.map((provider, index) => {
              const linked = isProviderLinked(provider.key);
              const account = getLinkedAccount(provider.key);
              const isUnlinking = unlinkingProvider === provider.key;
              
              return (
                <div key={provider.key}>
                  {index > 0 && <Divider />}
                  <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 hover:bg-default-50 transition-colors">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 bg-default-100`}>
                        <Icon icon={provider.icon} className="text-lg sm:text-xl" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-default-900 text-sm sm:text-base">{provider.name}</p>
                          {linked && (
                            <Chip size="sm" color="success" variant="dot" className="hidden sm:flex">
                              เชื่อมต่อแล้ว
                            </Chip>
                          )}
                        </div>
                        {linked && account?.provider_email ? (
                          <p className="text-xs text-default-500 truncate">{account.provider_email}</p>
                        ) : (
                          <p className="text-xs text-default-500 hidden sm:block">{provider.description}</p>
                        )}
                      </div>
                    </div>
                    {linked ? (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-default-400 hidden sm:block">
                          {account?.linked_at ? `เชื่อมต่อเมื่อ ${new Date(account.linked_at).toLocaleDateString('th-TH')}` : ''}
                        </p>
                        <Dropdown>
                          <DropdownTrigger>
                            <Button 
                              isIconOnly
                              size="sm" 
                              variant="light"
                              isLoading={isUnlinking}
                            >
                              <Icon icon="solar:menu-dots-bold" className="text-lg" />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="OAuth account actions">
                            <DropdownItem
                              key="manage"
                              startContent={<Icon icon="solar:settings-linear" className="text-lg" />}
                              endContent={<Icon icon="solar:square-arrow-right-up-linear" className="text-sm text-default-400" />}
                              href={getProviderManageUrl(provider.key)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              จัดการบน {provider.name}
                            </DropdownItem>
                            <DropdownItem
                              key="reauth"
                              startContent={<Icon icon="solar:refresh-linear" className="text-lg" />}
                              onPress={() => handleReAuthenticate(provider.key)}
                              isDisabled={linkingProvider !== null && linkingProvider !== provider.key}
                            >
                              {linkingProvider === provider.key ? "กำลังดำเนินการ..." : "ยืนยันตัวตนใหม่"}
                            </DropdownItem>
                            <DropdownItem
                              key="disconnect"
                              color="danger"
                              className="text-danger"
                              startContent={<Icon icon="solar:link-broken-linear" className="text-lg" />}
                              onPress={() => openUnlinkModal(provider.key)}
                            >
                              ยกเลิกการเชื่อมต่อ
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </div>
                    ) : provider.enabled ? (
                      <Button 
                        size="sm" 
                        color="primary" 
                        variant="flat" 
                        className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white text-xs"
                        onPress={() => handleLink(provider.key)}
                        isLoading={linkingProvider === provider.key}
                        isDisabled={linkingProvider !== null && linkingProvider !== provider.key}
                      >
                        {linkingProvider === provider.key ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อ"}
                      </Button>
                    ) : (
                      <Chip 
                        size="sm" 
                        variant="flat"
                        color="default"
                        startContent={<Icon icon="solar:clock-circle-linear" className="text-sm" />}
                        className="text-xs"
                      >
                        กำลังพัฒนา
                      </Chip>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardBody>
      </Card>

      {/* Info about OAuth */}
      {linkedAccounts.length > 0 && (
        <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-primary-50 border border-primary-200 rounded-lg">
          <Icon icon="solar:info-circle-bold" className="text-base sm:text-lg text-primary-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs sm:text-sm text-primary-800">
              บัญชีที่เชื่อมต่อสามารถใช้เข้าสู่ระบบได้โดยไม่ต้องกรอกรหัสผ่าน
            </p>
          </div>
        </div>
      )}

      {/* 2FA Setup Modal */}
      <TwoFactorSetupModal
        isOpen={showSetupModal}
        onClose={() => {
          setShowSetupModal(false);
          setIsReconfiguring(false);
        }}
        onSuccess={load2FAStatus}
        hasEmail={!!userEmail}
        isReconfiguring={isReconfiguring}
      />

      {/* 2FA Disable Modal */}
      <TwoFactorDisableModal
        isOpen={showDisableModal}
        onClose={() => setShowDisableModal(false)}
        onSuccess={load2FAStatus}
        method={twoFactorStatus?.method || null}
      />

      {/* Regenerate Backup Codes Modal */}
      <RegenerateBackupCodesModal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
      />

      {/* Unlink OAuth Confirmation Modal */}
      <Modal 
        isOpen={showUnlinkModal} 
        onClose={() => {
          setShowUnlinkModal(false);
          setProviderToUnlink(null);
        }}
        placement="center"
      >
        <ModalContent>
          {(onClose) => {
            const providerName = providerToUnlink 
              ? oauthService.getProviderDisplayName(providerToUnlink) 
              : '';
            const account = providerToUnlink ? getLinkedAccount(providerToUnlink) : null;
            
            return (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
                      <Icon icon="solar:danger-triangle-bold" className="text-white text-xl" />
                    </div>
                    <span>ยกเลิกการเชื่อมต่อ {providerName}</span>
                  </div>
                </ModalHeader>
                <ModalBody>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-default-100 rounded-lg">
                      <Icon 
                        icon={PROVIDERS.find(p => p.key === providerToUnlink)?.icon || 'solar:user-circle-bold'} 
                        className="text-2xl" 
                      />
                      <div>
                        <p className="font-medium">{account?.provider_email || providerName}</p>
                        <p className="text-xs text-default-500">{account?.provider_name}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-default-700 font-medium">
                        หลังจากยกเลิกการเชื่อมต่อ:
                      </p>
                      <ul className="text-sm text-default-600 space-y-1.5 ml-4">
                        <li className="flex items-start gap-2">
                          <Icon icon="solar:close-circle-bold" className="text-danger mt-0.5 flex-shrink-0" />
                          <span>ไม่สามารถใช้ {providerName} เพื่อเข้าสู่ระบบได้</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Icon icon="solar:close-circle-bold" className="text-danger mt-0.5 flex-shrink-0" />
                          <span>ต้องใช้รหัสผ่านหรือบัญชีอื่นที่เชื่อมต่อในการเข้าสู่ระบบ</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Icon icon="solar:info-circle-bold" className="text-primary mt-0.5 flex-shrink-0" />
                          <span>สามารถเชื่อมต่อใหม่ได้ภายหลัง</span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-3 bg-warning-50 border border-warning-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Icon icon="solar:shield-warning-bold" className="text-warning-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-warning-700">
                          คุณแน่ใจหรือไม่ที่จะยกเลิกการเชื่อมต่อนี้? การดำเนินการนี้จะทำให้คุณไม่สามารถใช้บัญชี {providerName} เพื่อเข้าสู่ระบบได้อีก
                        </p>
                      </div>
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button 
                    variant="flat" 
                    onPress={onClose}
                  >
                    ยกเลิก
                  </Button>
                  <Button 
                    color="primary" 
                    onPress={handleConfirmUnlink}
                    startContent={<Icon icon="solar:link-broken-linear" />}
                    className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                  >
                    ยกเลิกการเชื่อมต่อ
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}

export default memo(AuthenticationSection);
