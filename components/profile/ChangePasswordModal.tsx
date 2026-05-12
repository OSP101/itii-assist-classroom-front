"use client";

import { useState, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { authService } from "@/services";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const router = useRouter();
  const { language } = useGlobalSettings();
  const copy = language === "en"
    ? {
        incompleteTitle: "Missing information",
        incompleteDescription: "Please complete all required fields.",
        mismatchTitle: "Passwords do not match",
        mismatchDescription: "The new password and confirmation do not match.",
        invalidTitle: "Password requirements not met",
        invalidDescription: "Please review the password rules below.",
        successTitle: "Password changed",
        successDescription: "Your password was updated. Please sign in again.",
        errorTitle: "Something went wrong",
        errorDescription: "Could not change the password.",
        modalTitle: "Change password",
        modalDescription: "Enter your current password and a new password.",
        currentPassword: "Current password",
        currentPasswordPlaceholder: "Enter your current password",
        newPassword: "New password",
        newPasswordPlaceholder: "Enter your new password",
        confirmPassword: "Confirm new password",
        confirmPasswordPlaceholder: "Enter the new password again",
        passwordMismatchInline: "Passwords do not match",
        passwordRequirements: "Password requirements:",
        minLength: "At least 8 characters",
        lowercase: "Contains a lowercase letter (a-z)",
        uppercase: "Contains an uppercase letter (A-Z)",
        specialChar: "Contains a special character (!@#$%^&* etc.)",
        cancel: "Cancel",
        submit: "Change password",
      }
    : {
        incompleteTitle: "ข้อมูลไม่ครบ",
        incompleteDescription: "กรุณากรอกข้อมูลให้ครบถ้วน",
        mismatchTitle: "รหัสผ่านไม่ตรงกัน",
        mismatchDescription: "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน",
        invalidTitle: "รหัสผ่านไม่ผ่านเงื่อนไข",
        invalidDescription: "กรุณาตรวจสอบเงื่อนไขรหัสผ่าน",
        successTitle: "สำเร็จ",
        successDescription: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบใหม่",
        errorTitle: "เกิดข้อผิดพลาด",
        errorDescription: "ไม่สามารถเปลี่ยนรหัสผ่านได้",
        modalTitle: "เปลี่ยนรหัสผ่าน",
        modalDescription: "กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่",
        currentPassword: "รหัสผ่านปัจจุบัน",
        currentPasswordPlaceholder: "กรอกรหัสผ่านปัจจุบัน",
        newPassword: "รหัสผ่านใหม่",
        newPasswordPlaceholder: "กรอกรหัสผ่านใหม่",
        confirmPassword: "ยืนยันรหัสผ่านใหม่",
        confirmPasswordPlaceholder: "กรอกรหัสผ่านใหม่อีกครั้ง",
        passwordMismatchInline: "รหัสผ่านไม่ตรงกัน",
        passwordRequirements: "ข้อกำหนดรหัสผ่าน:",
        minLength: "อย่างน้อย 8 ตัวอักษร",
        lowercase: "มีตัวอักษรพิมพ์เล็ก (a-z)",
        uppercase: "มีตัวอักษรพิมพ์ใหญ่ (A-Z)",
        specialChar: "มีอักขระพิเศษ (!@#$%^&* ฯลฯ)",
        cancel: "ยกเลิก",
        submit: "เปลี่ยนรหัสผ่าน",
      };
  
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
        title: copy.incompleteTitle,
        description: copy.incompleteDescription,
        color: "warning",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      addToast({
        title: copy.mismatchTitle,
        description: copy.mismatchDescription,
        color: "danger",
        timeout: 3000,
                shouldShowTimeoutProgress: true,
      });
      return;
    }
    
    if (!isPasswordValid) {
      addToast({
        title: copy.invalidTitle,
        description: copy.invalidDescription,
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
          title: copy.successTitle,
          description: copy.successDescription,
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
          title: copy.errorTitle,
          description: result.error || copy.errorDescription,
          color: "danger",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      }
    } catch (error) {
      console.error("Change password error:", error);
      addToast({
        title: copy.errorTitle,
        description: copy.errorDescription,
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
            <div className="p-2 bg-linear-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
              <Icon icon="solar:key-bold" className="text-xl text-white" />
            </div>
            <span>{copy.modalTitle}</span>
          </div>
          <p className="text-sm text-default-500 font-normal ml-12">{copy.modalDescription}</p>
        </ModalHeader>
        <ModalBody className="gap-4">
          <Input
            label={copy.currentPassword}
            placeholder={copy.currentPasswordPlaceholder}
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
            label={copy.newPassword}
            placeholder={copy.newPasswordPlaceholder}
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
            label={copy.confirmPassword}
            placeholder={copy.confirmPasswordPlaceholder}
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onValueChange={setConfirmPassword}
            variant="bordered"
            labelPlacement="outside"
            isInvalid={confirmPassword !== "" && confirmPassword !== newPassword}
            errorMessage={confirmPassword !== "" && confirmPassword !== newPassword ? copy.passwordMismatchInline : ""}
            startContent={<Icon icon="solar:lock-password-linear" className="text-default-400" />}
            endContent={
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Icon icon={showConfirmPassword ? "solar:eye-closed-linear" : "solar:eye-linear"} className="text-default-400" />
              </button>
            }
          />

          {/* Password Requirements */}
          <div className="bg-default-100 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-default-600 mb-2">{copy.passwordRequirements}</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Icon 
                  icon={passwordValidation.minLength ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                  className={passwordValidation.minLength ? "text-success" : "text-default-400"} 
                />
                <span className={`text-xs ${passwordValidation.minLength ? "text-success" : "text-default-500"}`}>
                  {copy.minLength}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icon 
                  icon={passwordValidation.hasLowercase ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                  className={passwordValidation.hasLowercase ? "text-success" : "text-default-400"} 
                />
                <span className={`text-xs ${passwordValidation.hasLowercase ? "text-success" : "text-default-500"}`}>
                  {copy.lowercase}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icon 
                  icon={passwordValidation.hasUppercase ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                  className={passwordValidation.hasUppercase ? "text-success" : "text-default-400"} 
                />
                <span className={`text-xs ${passwordValidation.hasUppercase ? "text-success" : "text-default-500"}`}>
                  {copy.uppercase}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icon 
                  icon={passwordValidation.hasSpecialChar ? "solar:check-circle-bold" : "solar:close-circle-linear"} 
                  className={passwordValidation.hasSpecialChar ? "text-success" : "text-default-400"} 
                />
                <span className={`text-xs ${passwordValidation.hasSpecialChar ? "text-success" : "text-default-500"}`}>
                  {copy.specialChar}
                </span>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose}>
            {copy.cancel}
          </Button>
          <Button 
            color="primary"
            className="bg-linear-to-br from-blue-400 to-indigo-500"
            onPress={handleChangePassword}
            isLoading={isChangingPassword}
            isDisabled={!currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || !isPasswordValid}
            startContent={!isChangingPassword && <Icon icon="solar:key-linear" />}
          >
            {copy.submit}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default memo(ChangePasswordModal);
