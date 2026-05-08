"use client";

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@heroui/card";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { authService, User, Session } from "@/services";
import ChangePasswordModal from "./ChangePasswordModal";
import ConfirmPasswordModal from "./ConfirmPasswordModal";
import ProfileSidebar, { MenuKey, MENU_ITEMS } from "./ProfileSidebar";
import { 
  PersonalInfoSkeleton, 
  AuthenticationSkeleton, 
  ActiveSessionsSkeleton 
} from "./ProfileSkeletons";

// Lazy load section components
const PersonalInfoSection = lazy(() => import("./PersonalInfoSection"));
const AuthenticationSection = lazy(() => import("./AuthenticationSection"));
const ActiveSessionsSection = lazy(() => import("./ActiveSessionsSection"));

interface ProfilePageProps {
  variant?: "admin" | "user";
  onBack?: () => void;
}

export default function ProfilePage({ variant = "admin", onBack }: ProfilePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get initial tab from URL or default to "personal"
  const tabFromUrl = searchParams.get("tab") as MenuKey | null;
  const validTabs: MenuKey[] = ["personal", "authentication", "sessions"];
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "personal";
  
  // User state — seed from localStorage for instant render, then verify via API
  const [user, setUser] = useState<User | null>(() => authService.getStoredUser());
  
  // Navigation state
  const [activeMenu, setActiveMenu] = useState<MenuKey>(initialTab);
  // Track visited tabs for caching (keep mounted once visited)
  const [visitedTabs, setVisitedTabs] = useState<MenuKey[]>([initialTab]);
  
  // Profile form
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showConfirmPasswordModal, setShowConfirmPasswordModal] = useState(false);
  
  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);
  const [showRevokeSessionModal, setShowRevokeSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  
  // Load user data — stored user shown immediately; API call updates in background
  useEffect(() => {
    const stored = authService.getStoredUser();
    if (stored) {
      setFullName(stored.full_name || "");
      setUsername(stored.username || "");
      setEmail(stored.email || "");
    }

    const loadUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setFullName(currentUser.full_name || "");
          setUsername(currentUser.username || "");
          setEmail(currentUser.email || "");
        } else {
          router.push("/login");
        }
      } catch (error) {
        console.error("Failed to load user:", error);
        router.push("/login");
      }
    };
    
    loadUser();
  }, [router]);
  
  // Load sessions when sessions tab is active
  useEffect(() => {
    if (activeMenu === "sessions") {
      loadSessions();
    }
    // Track visited tabs for caching
    setVisitedTabs(prev => prev.includes(activeMenu) ? prev : [...prev, activeMenu]);
  }, [activeMenu]);
  
  // Handle tab change with URL update
  const handleTabChange = useCallback((tab: MenuKey) => {
    setActiveMenu(tab);
    // Update URL without page reload
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }, []);
  
  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const result = await authService.getSessions();
      if (result.success && result.sessions) {
        setSessions(result.sessions);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Handle profile update - show confirm password modal first
  const handleUpdateProfile = useCallback(() => {
    setShowConfirmPasswordModal(true);
  }, []);

  // Handle confirmed profile update with password
  const handleConfirmUpdateProfile = useCallback(async (password: string) => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const result = await authService.updateProfile({
        full_name: fullName,
        email: email || undefined,
        current_password: password,
      });
      
      if (result.success && result.user) {
        setUser(result.user);
        setShowConfirmPasswordModal(false);
        addToast({
          title: "สำเร็จ",
          description: "อัปเดตโปรไฟล์เรียบร้อยแล้ว",
          color: "success",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      } else {
        // Throw error to show in modal
        throw new Error(result.error || "ไม่สามารถอัปเดตโปรไฟล์ได้");
      }
    } catch (error) {
      console.error("Update profile error:", error);
      // Re-throw to show error in modal
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("ไม่สามารถอัปเดตโปรไฟล์ได้");
    } finally {
      setIsSaving(false);
    }
  }, [user, fullName, email]);

  // Handle avatar upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      addToast({
        title: "ไฟล์ไม่ถูกต้อง",
        description: "กรุณาเลือกไฟล์รูปภาพ",
        color: "danger",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      addToast({
        title: "ไฟล์ใหญ่เกินไป",
        description: "ขนาดไฟล์ต้องไม่เกิน 5MB",
        color: "danger",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
      return;
    }
    
    setIsUploadingAvatar(true);
    try {
      const result = await authService.uploadAvatar(file);
      if (result.success && result.avatar) {
        setUser(prev => prev ? { ...prev, avatar: result.avatar! } : null);
        addToast({
          title: "สำเร็จ",
          description: "อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว",
          color: "success",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      } else {
        addToast({
          title: "เกิดข้อผิดพลาด",
          description: result.error || "ไม่สามารถอัปโหลดรูปภาพได้",
          color: "danger",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      }
    } catch (error) {
      console.error("Avatar upload error:", error);
      addToast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถอัปโหลดรูปภาพได้",
        color: "danger",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle avatar remove
  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true);
    try {
      const result = await authService.removeAvatar();
      if (result.success) {
        setUser(prev => prev ? { ...prev, avatar: null } : null);
        addToast({
          title: "สำเร็จ",
          description: "ลบรูปโปรไฟล์เรียบร้อยแล้ว",
          color: "success",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      } else {
        addToast({
          title: "เกิดข้อผิดพลาด",
          description: result.error || "ไม่สามารถลบรูปภาพได้",
          color: "danger",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      }
    } catch (error) {
      console.error("Remove avatar error:", error);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle session revoke confirmation
  const confirmRevokeSession = (session: Session) => {
    setSelectedSession(session);
    setShowRevokeSessionModal(true);
  };

  // Handle session revoke
  const handleRevokeSession = async () => {
    if (!selectedSession) return;

    const sessionId = selectedSession.id;
    setRevokingSessionId(sessionId);
    try {
      const result = await authService.revokeSession(sessionId);
      if (result.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        setShowRevokeSessionModal(false);
        setSelectedSession(null);
        addToast({
          title: "สำเร็จ",
          description: "ยกเลิกการเข้าสู่ระบบเรียบร้อยแล้ว",
          color: "success",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      } else {
        addToast({
          title: "เกิดข้อผิดพลาด",
          description: result.error || "ไม่สามารถยกเลิกได้",
          color: "danger",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      }
    } catch (error) {
      console.error("Revoke session error:", error);
    } finally {
      setRevokingSessionId(null);
    }
  };

  // Handle revoke all sessions
  const handleRevokeAllSessions = async () => {
    setIsRevokingAll(true);
    try {
      const result = await authService.revokeAllSessions();
      if (result.success) {
        await loadSessions();
        setShowRevokeAllModal(false);
        addToast({
          title: "สำเร็จ",
          description: `ยกเลิกการเข้าสู่ระบบ ${result.revokedCount} เซสชันเรียบร้อยแล้ว`,
          color: "success",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      } else {
        addToast({
          title: "เกิดข้อผิดพลาด",
          description: result.error || "ไม่สามารถยกเลิกได้",
          color: "danger",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      }
    } catch (error) {
      console.error("Revoke all sessions error:", error);
    } finally {
      setIsRevokingAll(false);
    }
  };

  const getRoleBadge = useCallback((role: string) => {
    const config: Record<string, { color: "primary" | "secondary" | "success" | "warning" | "danger"; label: string }> = {
      admin: { color: "danger", label: "ผู้ดูแลระบบ" },
      instructor: { color: "primary", label: "อาจารย์" },
      ta: { color: "success", label: "ผู้ช่วยสอน (TA)" },
    };
    return config[role] || { color: "secondary" as const, label: role };
  }, []);

  if (!user) {
    return null;
  }

  const roleInfo = getRoleBadge(user.role);

  // Render all visited tabs (hidden when not active) for caching
  const renderCachedContent = () => (
    <>
      {/* Personal Info Tab */}
      {visitedTabs.includes("personal") && (
        <div className={activeMenu === "personal" ? "block" : "hidden"}>
          <Suspense fallback={<PersonalInfoSkeleton />}>
            <PersonalInfoSection
              user={user}
              fileInputRef={fileInputRef}
              handleAvatarUpload={handleAvatarUpload}
              handleRemoveAvatar={handleRemoveAvatar}
              isUploadingAvatar={isUploadingAvatar}
              username={username}
              fullName={fullName}
              setFullName={setFullName}
              email={email}
              setEmail={setEmail}
              roleInfo={roleInfo}
              handleUpdateProfile={handleUpdateProfile}
              isSaving={isSaving}
            />
          </Suspense>
        </div>
      )}

      {/* Authentication Tab */}
      {visitedTabs.includes("authentication") && (
        <div className={activeMenu === "authentication" ? "block" : "hidden"}>
          <Suspense fallback={<AuthenticationSkeleton />}>
            <AuthenticationSection
              onOpenPasswordModal={() => setShowPasswordModal(true)}
              userEmail={user?.email}
            />
          </Suspense>
        </div>
      )}

      {/* Sessions Tab */}
      {visitedTabs.includes("sessions") && (
        <div className={activeMenu === "sessions" ? "block" : "hidden"}>
          <Suspense fallback={<ActiveSessionsSkeleton />}>
            <ActiveSessionsSection
              sessions={sessions}
              isLoadingSessions={isLoadingSessions}
              revokingSessionId={revokingSessionId}
              onRevokeSession={confirmRevokeSession}
              onShowRevokeAllModal={() => setShowRevokeAllModal(true)}
            />
          </Suspense>
        </div>
      )}
    </>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button isIconOnly variant="light" onPress={onBack} size="sm">
              <Icon icon="solar:arrow-left-linear" className="text-xl" />
            </Button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-default-900">ตั้งค่าบัญชี</h1>
            <p className="text-xs sm:text-sm text-default-500">จัดการข้อมูลส่วนตัวและความปลอดภัย</p>
          </div>
        </div>
        
        {/* Mobile Tabs */}
        <div className="lg:hidden overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex gap-2 min-w-max pb-1">
            {MENU_ITEMS.map((item) => (
              <Button
                key={item.key}
                size="sm"
                variant={activeMenu === item.key ? "solid" : "flat"}
                color={activeMenu === item.key ? (item.key === "authentication" ? "warning" : "primary") : "default"}
                className={`flex-shrink-0 ${
                  activeMenu === item.key 
                    ? item.key === "authentication" 
                      ? "bg-warning-500 text-white shadow-md" 
                      : "shadow-md"
                    : "bg-default-100"
                }`}
                startContent={<Icon icon={item.icon} className="text-base" />}
                onPress={() => handleTabChange(item.key as MenuKey)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex gap-6">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <Card className="border border-default-200 shadow-sm p-4">
            <ProfileSidebar
              activeMenu={activeMenu}
              setActiveMenu={handleTabChange}
            />
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {renderCachedContent()}
        </div>
      </div>

      {/* Revoke All Sessions Modal */}
      <Modal isOpen={showRevokeAllModal} onClose={() => setShowRevokeAllModal(false)}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
              <Icon icon="solar:logout-3-bold" className="text-xl text-white" />
            </div>
            <span>ยืนยันการออกจากระบบ</span>
          </ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              คุณต้องการออกจากระบบทุกอุปกรณ์ยกเว้นอุปกรณ์นี้หรือไม่? การกระทำนี้จะทำให้อุปกรณ์อื่นๆ ต้องเข้าสู่ระบบใหม่
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setShowRevokeAllModal(false)}>
              ยกเลิก
            </Button>
            <Button color="primary" onPress={handleRevokeAllSessions} isLoading={isRevokingAll} className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white">
              ออกจากระบบทั้งหมด
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Revoke Single Session Modal */}
      <Modal
        isOpen={showRevokeSessionModal}
        onClose={() => {
          if (!revokingSessionId) {
            setShowRevokeSessionModal(false);
            setSelectedSession(null);
          }
        }}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-red-500 to-red-500 rounded-lg shadow-lg shadow-rose-500/30">
              <Icon icon="solar:logout-2-bold" className="text-xl text-white" />
            </div>
            <span>ยืนยันการออกจากระบบอุปกรณ์นี้</span>
          </ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              คุณต้องการบังคับให้อุปกรณ์ที่เลือกออกจากระบบใช่หรือไม่?
            </p>
            {selectedSession && (
              <div className="mt-2 rounded-lg border border-default-200 bg-default-50 p-3 text-sm text-default-600 space-y-1">
                <p><span className="font-medium text-default-800">ระบบปฏิบัติการ:</span> {selectedSession.os}</p>
                <p><span className="font-medium text-default-800">เบราว์เซอร์:</span> {selectedSession.browser}</p>
                <p><span className="font-medium text-default-800">IP:</span> {selectedSession.ip}</p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => {
                setShowRevokeSessionModal(false);
                setSelectedSession(null);
              }}
              isDisabled={!!revokingSessionId}
            >
              ยกเลิก
            </Button>
            <Button
              color="danger"
              onPress={handleRevokeSession}
              isLoading={!!revokingSessionId}
            >
              ออกจากระบบเครื่องนี้
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Change Password Modal */}
      <ChangePasswordModal 
        isOpen={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)} 
      />

      {/* Confirm Password Modal for Profile Update */}
      <ConfirmPasswordModal
        isOpen={showConfirmPasswordModal}
        onClose={() => setShowConfirmPasswordModal(false)}
        onConfirm={handleConfirmUpdateProfile}
        title="ยืนยันการบันทึก"
        description="กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันการบันทึกข้อมูลส่วนตัว"
        isLoading={isSaving}
      />
    </div>
  );
}
