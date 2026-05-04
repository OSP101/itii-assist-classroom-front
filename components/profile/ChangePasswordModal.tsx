"use client";

import { useState, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { authService } from "@/services";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const router = useRouter();
  
  // Password form state - local to this component
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Password validation helpers - memoized
  const passwordValidation = useMemo(() => ({
    minLength: newPassword.length >= 8,
    hasLowercase: /[a-z]/.test(newPassword),
    hasUppercase: /[A-Z]/.test(newPassword),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
  }), [newPassword]);
  
  const isPasswordValid = useMemo(() => 
    passwordValidation.minLength && 
    passwordValidation.hasLowercase && 
    passwordValidation.hasUppercase && 
    passwordValidation.hasSpecialChar
  , [passwordValidation]);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast({
        title: "ข้อมูลไม่ครบ",
        description: "กรุณากรอกข้อมูลให้ครบถ้วน",
        color: "warning",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      addToast({
        title: "รหัสผ่านไม่ตรงกัน",
        description: "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน",
        color: "danger",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
      return;
    }
    
    if (!isPasswordValid) {
      addToast({
        title: "รหัสผ่านไม่ผ่านเงื่อนไข",
        description: "กรุณาตรวจสอบเงื่อนไขรหัสผ่าน",
        color: "warning",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
      return;
    }
    
    setIsChangingPassword(true);
    try {
      const result = await authService.changePassword(currentPassword, newPassword, confirmPassword);
      
      if (result.success) {
        addToast({
          title: "สำเร็จ",
          description: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบใหม่",
          color: "success",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
        resetForm();
        onClose();
        setTimeout(() => {
          authService.logout();
          router.push("/login");
        }, 2000);
      } else {
        addToast({
          title: "เกิดข้อผิดพลาด",
          description: result.error || "ไม่สามารถเปลี่ยนรหัสผ่านได้",
          color: "danger",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      }
    } catch (error) {
      console.error("Change password error:", error);
      addToast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถเปลี่ยนรหัสผ่านได้",
        color: "danger",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
              <Icon icon="solar:key-bold" className="text-xl text-white" />
            </div>
            <span>เปลี่ยนรหัสผ่าน</span>
          </div>
          <p className="text-sm text-default-500 font-normal ml-12">กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่</p>
        </ModalHeader>
        <ModalBody className="gap-4">
          <Input
            label="รหัสผ่านปัจจุบัน"
            placeholder="กรอกรหัสผ่านปัจจุบัน"
            type={showCurrentPassword ? "text" : "password"}
            value={currentPassword}
            onValueChange={setCurrentPassword}
            variant="bordered"
            labelPlacement="outside"
            startContent={<Icon icon="solar:lock-linear" className="text-default-400" />}
            endContent={
              <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                <Icon icon={showCurrentPassword ? "solar:eye-closed-linear" : "solar:eye-linear"} className="text-default-400" />
              </button>
            }
          />
          
          <Input
            label="รหัสผ่านใหม่"
            placeholder="กรอกรหัสผ่านใหม่"
            type={showNewPassword ? "text" : "password"}
            value={newPassword}
            onValueChange={setNewPassword}
            variant="bordered"
            labelPlacement="outside"
            startContent={<Icon icon="solar:lock-password-linear" className="text-default-400" />}
            endContent={
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}>
                <Icon icon={showNewPassword ? "solar:eye-closed-linear" : "solar:eye-linear"} className="text-default-400" />
              </button>
            }
          />

          
          
          <Input
            label="ยืนยันรหัสผ่านใหม่"
            placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onValueChange={setConfirmPassword}
            variant="bordered"
            labelPlacement="outside"
            isInvalid={confirmPassword !== "" && confirmPassword !== newPassword}
            errorMessage={confirmPassword !== "" && confirmPassword !== newPassword ? "รหัสผ่านไม่ตรงกัน" : ""}
            startContent={<Icon icon="solar:lock-password-linear" className="text-default-400" />}
            endContent={
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Icon icon={showConfirmPassword ? "solar:eye-closed-linear" : "solar:eye-linear"} className="text-default-400" />
              </button>
            }
          />

          {/* Password Requirements */}
          <div className="bg-default-100 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-default-600 mb-2">ข้อกำหนดรหัสผ่าน:</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Icon 
                  icon={passwordValidation.minLength ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                  className={passwordValidation.minLength ? "text-success" : "text-default-400"} 
                />
                <span className={`text-xs ${passwordValidation.minLength ? "text-success" : "text-default-500"}`}>
                  อย่างน้อย 8 ตัวอักษร
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icon 
                  icon={passwordValidation.hasLowercase ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                  className={passwordValidation.hasLowercase ? "text-success" : "text-default-400"} 
                />
                <span className={`text-xs ${passwordValidation.hasLowercase ? "text-success" : "text-default-500"}`}>
                  มีตัวอักษรพิมพ์เล็ก (a-z)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icon 
                  icon={passwordValidation.hasUppercase ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                  className={passwordValidation.hasUppercase ? "text-success" : "text-default-400"} 
                />
                <span className={`text-xs ${passwordValidation.hasUppercase ? "text-success" : "text-default-500"}`}>
                  มีตัวอักษรพิมพ์ใหญ่ (A-Z)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icon 
                  icon={passwordValidation.hasSpecialChar ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                  className={passwordValidation.hasSpecialChar ? "text-success" : "text-default-400"} 
                />
                <span className={`text-xs ${passwordValidation.hasSpecialChar ? "text-success" : "text-default-500"}`}>
                  มีอักขระพิเศษ (!@#$%^&* ฯลฯ)
                </span>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose}>
            ยกเลิก
          </Button>
          <Button 
            color="primary"
            className="bg-gradient-to-br from-blue-400 to-indigo-500"
            onPress={handleChangePassword}
            isLoading={isChangingPassword}
            isDisabled={!currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || !isPasswordValid}
            startContent={!isChangingPassword && <Icon icon="solar:key-linear" />}
          >
            เปลี่ยนรหัสผ่าน
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default memo(ChangePasswordModal);
