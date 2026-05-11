"use client";

import { memo, useState, useCallback } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";

interface ConfirmPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  title?: string;
  description?: string;
  isLoading?: boolean;
}

function ConfirmPasswordModal({
  isOpen,
  onClose,
  onConfirm,
  title = "ยืนยันรหัสผ่าน",
  description = "กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันการเปลี่ยนแปลง",
  isLoading = false,
}: ConfirmPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleClose = useCallback(() => {
    setPassword("");
    setShowPassword(false);
    setError("");
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(async () => {
    if (!password.trim()) {
      setError("กรุณากรอกรหัสผ่าน");
      return;
    }

    setError("");
    try {
      await onConfirm(password);
      // Reset on success
      setPassword("");
      setShowPassword(false);
    } catch (err) {
      // Error will be handled by parent, but we can show it here too
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      }
    }
  }, [password, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading && password.trim()) {
      handleConfirm();
    }
  }, [handleConfirm, isLoading, password]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      placement="center"
      classNames={{
        backdrop: "bg-black/50 backdrop-blur-sm",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-linear-to-br from-blue-400 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30">
              <Icon icon="solar:lock-password-bold" className="text-xl text-white" />
            </div>
            <span>{title}</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-500 mb-4">
            {description}
          </p>
          
          <Input
            type={showPassword ? "text" : "password"}
            label="รหัสผ่านปัจจุบัน"
            labelPlacement="outside"
            value={password}
            onValueChange={(value) => {
              setPassword(value);
              if (error) setError("");
            }}
            onKeyDown={handleKeyDown}
            isInvalid={!!error}
            errorMessage={error}
            variant="bordered"
            autoFocus
            startContent={
              <Icon icon="solar:lock-keyhole-linear" className="text-default-400" />
            }
            endContent={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="focus:outline-none"
              >
                <Icon
                  icon={showPassword ? "solar:eye-closed-linear" : "solar:eye-linear"}
                  className="text-xl text-default-400 hover:text-default-600 transition-colors"
                />
              </button>
            }
          />
        </ModalBody>
        <ModalFooter>
          <Button 
            variant="light" 
            onPress={handleClose}
            isDisabled={isLoading}
          >
            ยกเลิก
          </Button>
          <Button 
            color="primary" 
            onPress={handleConfirm}
            isLoading={isLoading}
            isDisabled={!password.trim()}
            className="bg-linear-to-br from-blue-400 to-indigo-500"
            startContent={!isLoading && <Icon icon="solar:check-circle-linear" />}
          >
            ยืนยัน
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default memo(ConfirmPasswordModal);
