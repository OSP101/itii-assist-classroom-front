"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { twoFactorService } from "@/services/twoFactor.service";

interface RegenerateBackupCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function RegenerateBackupCodesModal({
  isOpen,
  onClose,
}: RegenerateBackupCodesModalProps) {
  const { language } = useGlobalSettings();
  const locale = language === "en" ? "en-US" : "th-TH";
  const copy = language === "en"
    ? {
        requirePassword: "Please enter your password",
        successTitle: "Backup codes regenerated",
        successDescription: "Your new backup codes are ready.",
        regenerateError: "Could not generate new backup codes",
        genericError: "Something went wrong. Please try again.",
        copiedTitle: "Copied",
        copiedDescription: "All backup codes were copied.",
        fileTitle: "ITII Assist Classroom - Backup Codes",
        fileCreatedAt: "Created at",
        fileCodesLabel: "Backup codes for sign-in (each code can be used once):",
        fileWarningTitle: "Warning:",
        fileWarningLine1: "Store these codes somewhere safe.",
        fileWarningLine2: "Each code can only be used once.",
        warningTitle: "Warning",
        warningDescription: "Generating new backup codes will immediately invalidate all existing backup codes.",
        currentPassword: "Current password",
        currentPasswordPlaceholder: "Enter your password to confirm",
        cancel: "Cancel",
        regenerate: "Generate new codes",
        newCodesTitle: "Your new backup codes",
        newCodesDescription: "Store these codes somewhere safe. Use them when you cannot access another two-factor method.",
        copyAll: "Copy all",
        download: "Download .txt",
        singleUseWarning: "Each code can only be used once. After you close this dialog, these codes will not be shown again.",
        finish: "Done",
        modalConfirmTitle: "Regenerate backup codes",
        modalCodesTitle: "Your backup codes",
        modalSubtitle: "Recovery codes",
      }
    : {
        requirePassword: "กรุณากรอกรหัสผ่าน",
        successTitle: "สำเร็จ",
        successDescription: "สร้างรหัสสำรองใหม่สำเร็จ",
        regenerateError: "ไม่สามารถสร้างรหัสสำรองใหม่ได้",
        genericError: "เกิดข้อผิดพลาด กรุณาลองใหม่",
        copiedTitle: "คัดลอกแล้ว",
        copiedDescription: "คัดลอกรหัสสำรองทั้งหมดแล้ว",
        fileTitle: "ITII Assist Classroom - รหัสสำรอง",
        fileCreatedAt: "สร้างเมื่อ",
        fileCodesLabel: "รหัสสำรองสำหรับเข้าสู่ระบบ (ใช้ได้ครั้งเดียว):",
        fileWarningTitle: "คำเตือน:",
        fileWarningLine1: "เก็บรหัสเหล่านี้ไว้ในที่ปลอดภัย",
        fileWarningLine2: "รหัสแต่ละรหัสใช้ได้เพียงครั้งเดียวเท่านั้น",
        warningTitle: "คำเตือน",
        warningDescription: "การสร้างรหัสสำรองใหม่จะทำให้รหัสสำรองเดิมทั้งหมดใช้ไม่ได้อีกต่อไป",
        currentPassword: "รหัสผ่านปัจจุบัน",
        currentPasswordPlaceholder: "กรอกรหัสผ่านเพื่อยืนยัน",
        cancel: "ยกเลิก",
        regenerate: "สร้างรหัสใหม่",
        newCodesTitle: "รหัสสำรองใหม่",
        newCodesDescription: "เก็บรหัสเหล่านี้ไว้ในที่ปลอดภัย ใช้เข้าสู่ระบบเมื่อไม่สามารถใช้วิธีอื่นได้",
        copyAll: "คัดลอกทั้งหมด",
        download: "ดาวน์โหลด .txt",
        singleUseWarning: "รหัสแต่ละรหัสใช้ได้เพียงครั้งเดียว เมื่อปิดหน้านี้ คุณจะไม่สามารถดูรหัสเหล่านี้ได้อีก",
        finish: "เสร็จสิ้น",
        modalConfirmTitle: "สร้างรหัสสำรองใหม่",
        modalCodesTitle: "รหัสสำรองของคุณ",
        modalSubtitle: "Recovery Codes",
      };
  const [step, setStep] = useState<"confirm" | "codes">("confirm");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep("confirm");
      setPassword("");
      setShowPassword(false);
      setError("");
      setBackupCodes([]);
      setCopiedCode(null);
    }
  }, [isOpen]);

  const handleRegenerate = useCallback(async () => {
    if (!password.trim()) {
      setError(copy.requirePassword);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await twoFactorService.regenerateBackupCodes(password);
      if (result.success && result.backupCodes) {
        setBackupCodes(result.backupCodes);
        setStep("codes");
        addToast({
          title: copy.successTitle,
          description: copy.successDescription,
          color: "success",
          timeout: 3000,
                shouldShowTimeoutProgress: true,
        });
      } else {
        setError(result.error || copy.regenerateError);
      }
    } catch (err) {
      setError(copy.genericError);
    } finally {
      setIsLoading(false);
    }
  }, [copy.genericError, copy.regenerateError, copy.requirePassword, copy.successDescription, copy.successTitle, password]);

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const handleCopyAll = useCallback(() => {
    const allCodes = backupCodes.join("\n");
    navigator.clipboard.writeText(allCodes);
    addToast({
      title: copy.copiedTitle,
      description: copy.copiedDescription,
      color: "success",
      timeout: 3000,
                shouldShowTimeoutProgress: true,
    });
  }, [backupCodes, copy.copiedDescription, copy.copiedTitle]);

  const handleDownloadCodes = useCallback(() => {
    const content = `${copy.fileTitle}
==========================================
${copy.fileCreatedAt}: ${new Date().toLocaleString(locale)}

${copy.fileCodesLabel}

${backupCodes.map((code, i) => `${i + 1}. ${code}`).join("\n")}

==========================================
${copy.fileWarningTitle} ${copy.fileWarningLine1}
${copy.fileWarningLine2}
`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recovery-codes-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [backupCodes, copy.fileCodesLabel, copy.fileCreatedAt, copy.fileTitle, copy.fileWarningLine1, copy.fileWarningLine2, copy.fileWarningTitle, locale]);

  const renderConfirmStep = () => (
    <>
      <ModalBody className="py-6">
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 mb-4">
          <div className="flex gap-3">
            <Icon icon="solar:danger-triangle-bold" className="text-xl text-danger shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-danger-800 font-medium">{copy.warningTitle}</p>
              <p className="text-sm text-danger-700 mt-1">
                {copy.warningDescription}
              </p>
            </div>
          </div>
        </div>

        <Input
          type={showPassword ? "text" : "password"}
          label={copy.currentPassword}
          labelPlacement="outside"
          placeholder={copy.currentPasswordPlaceholder}
          value={password}
          onValueChange={(v) => {
            setPassword(v);
            setError("");
          }}
          endContent={
            <Button 
              isIconOnly 
              variant="light" 
              size="sm"
              onPress={() => setShowPassword(!showPassword)}
            >
              <Icon icon={showPassword ? "solar:eye-closed-linear" : "solar:eye-linear"} />
            </Button>
          }
          isInvalid={!!error}
          errorMessage={error}
          onKeyDown={(e) => {
            if (e.key === "Enter" && password.trim()) {
              handleRegenerate();
            }
          }}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="light" onPress={onClose}>
          {copy.cancel}
        </Button>
        <Button 
          color="primary" 
          onPress={handleRegenerate} 
          isLoading={isLoading}
          isDisabled={!password.trim()}
          className="bg-linear-to-r from-blue-400 to-indigo-500 text-white"
        >
          {copy.regenerate}
        </Button>
      </ModalFooter>
    </>
  );

  const renderCodesStep = () => (
    <>
      <ModalBody className="py-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-linear-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Icon icon="solar:shield-keyhole-bold" className="text-3xl text-white" />
          </div>
          <h3 className="text-lg font-semibold text-default-900">{copy.newCodesTitle}</h3>
          <p className="text-sm text-default-500 mt-1">
            {copy.newCodesDescription}
          </p>
        </div>

        <div className="bg-default-50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, index) => (
              <div 
                key={index}
                className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-default-200 cursor-pointer hover:bg-default-100 transition-colors"
                onClick={() => handleCopyCode(code)}
              >
                <code className="text-sm font-mono">{code}</code>
                <Icon 
                  icon={copiedCode === code ? "solar:check-read-linear" : "solar:copy-linear"} 
                  className={`text-sm ${copiedCode === code ? "text-success" : "text-default-400"}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-center">
          <Button
            variant="flat"
            size="sm"
            startContent={<Icon icon="solar:copy-linear" />}
            onPress={handleCopyAll}
          >
            {copy.copyAll}
          </Button>
          <Button
            variant="flat"
            size="sm"
            startContent={<Icon icon="solar:download-linear" />}
            onPress={handleDownloadCodes}
          >
            {copy.download}
          </Button>
        </div>

        <div className="mt-4 p-3 bg-warning-50 border border-warning-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Icon icon="solar:danger-triangle-bold" className="text-warning-600 mt-0.5" />
            <p className="text-xs text-warning-800">
              {copy.singleUseWarning}
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="primary" onPress={onClose}>
          {copy.finish}
        </Button>
      </ModalFooter>
    </>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={step === "codes" ? onClose : undefined}
      isDismissable={step !== "codes"}
      hideCloseButton={step === "codes"}
      placement="center"
      size="md"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3 border-b border-default-200">
          <div className="p-2 bg-linear-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
            <Icon icon="solar:refresh-bold" className="text-xl text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {step === "confirm" ? copy.modalConfirmTitle : copy.modalCodesTitle}
            </h2>
            <p className="text-xs text-default-500 font-normal">
              {copy.modalSubtitle}
            </p>
          </div>
        </ModalHeader>
        {step === "confirm" ? renderConfirmStep() : renderCodesStep()}
      </ModalContent>
    </Modal>
  );
}

export default memo(RegenerateBackupCodesModal);
