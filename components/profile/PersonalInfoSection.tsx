"use client";

import { memo, type RefObject } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Avatar } from "@heroui/avatar";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { User } from "@/services";

interface RoleInfo {
  color: "primary" | "secondary" | "success" | "warning" | "danger";
  label: string;
}

interface PersonalInfoSectionProps {
  user: User;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveAvatar: () => void;
  isUploadingAvatar: boolean;
  username: string;
  fullName: string;
  setFullName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  roleInfo: RoleInfo;
  handleUpdateProfile: () => void;
  isSaving: boolean;
}

function PersonalInfoSection({
  user,
  fileInputRef,
  handleAvatarUpload,
  handleRemoveAvatar,
  isUploadingAvatar,
  username,
  fullName,
  setFullName,
  email,
  setEmail,
  roleInfo,
  handleUpdateProfile,
  isSaving,
}: PersonalInfoSectionProps) {
  const { language } = useGlobalSettings();
  const copy = language === "en"
    ? {
        avatarTitle: "Profile photo",
        uploadNew: "Upload new photo",
        removePhoto: "Remove photo",
        avatarHelp: "Supports JPG, PNG, and GIF up to 5MB",
        personalInfoTitle: "Personal information",
        usernameDescription: "Username cannot be changed",
        fullName: "Full name",
        fullNamePlaceholder: "Enter your full name",
        email: "Email",
        role: "Role",
        status: "Status",
        active: "Active",
        inactive: "Inactive",
        saveChanges: "Save changes",
      }
    : {
        avatarTitle: "รูปโปรไฟล์",
        uploadNew: "อัปโหลดรูปใหม่",
        removePhoto: "ลบรูป",
        avatarHelp: "รองรับไฟล์ JPG, PNG, GIF ขนาดไม่เกิน 5MB",
        personalInfoTitle: "ข้อมูลส่วนตัว",
        usernameDescription: "ไม่สามารถแก้ไข Username ได้",
        fullName: "ชื่อ-นามสกุล",
        fullNamePlaceholder: "กรอกชื่อ-นามสกุล",
        email: "อีเมล",
        role: "บทบาท",
        status: "สถานะ",
        active: "ใช้งานอยู่",
        inactive: "ปิดใช้งาน",
        saveChanges: "บันทึกการเปลี่ยนแปลง",
      };
  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <Card className="border border-default-200 shadow-sm">
        <CardHeader className="px-6 py-4 border-b border-default-100">
          <div className="flex items-center gap-2">
            <Icon icon="solar:camera-bold" className="text-lg text-primary" />
            <h3 className="font-semibold">{copy.avatarTitle}</h3>
          </div>
        </CardHeader>
        <CardBody className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group">
              <Avatar
                name={user.full_name || user.username}
                src={user.avatar || undefined}
                className="w-28 h-28 text-3xl bg-linear-to-br from-blue-400 to-indigo-500 text-white"
              />
              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Spinner size="sm" color="white" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <h4 className="font-medium text-default-900">{user.full_name || user.username}</h4>
                <p className="text-sm text-default-500">@{user.username}</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  startContent={<Icon icon="solar:upload-linear" />}
                  onPress={() => fileInputRef.current?.click()}
                  isLoading={isUploadingAvatar}
                >
                  {copy.uploadNew}
                </Button>
                {user.avatar && (
                  <Button
                    size="sm"
                    color="danger"
                    variant="light"
                    startContent={<Icon icon="solar:trash-bin-trash-linear" />}
                    onPress={handleRemoveAvatar}
                    isLoading={isUploadingAvatar}
                  >
                    {copy.removePhoto}
                  </Button>
                )}
              </div>
              <p className="text-xs text-default-400">
                {copy.avatarHelp}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Personal Information Form */}
      <Card className="border border-default-200 shadow-sm">
        <CardHeader className="px-6 py-4 border-b border-default-100">
          <div className="flex items-center gap-2">
            <Icon icon="solar:pen-new-square-bold" className="text-lg text-primary" />
            <h3 className="font-semibold">{copy.personalInfoTitle}</h3>
          </div>
        </CardHeader>
        <CardBody className="p-6 space-y-4">
          <Input
            label="Username"
            value={username}
            isReadOnly
            isDisabled
            variant="flat"
            labelPlacement="outside"
            description={copy.usernameDescription}
            startContent={<Icon icon="solar:user-id-linear" className="text-default-400" />}
          />
          
          <Input
            label={copy.fullName}
            placeholder={copy.fullNamePlaceholder}
            value={fullName}
            onValueChange={setFullName}
            labelPlacement="outside"
            variant="bordered"
            startContent={<Icon icon="solar:user-linear" className="text-default-400" />}
          />
          
          <Input
            label={copy.email}
            type="email"
            placeholder="example@email.com"
            value={email}
            onValueChange={setEmail}
            labelPlacement="outside"
            variant="bordered"
            startContent={<Icon icon="solar:letter-linear" className="text-default-400" />}
          />

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-3 bg-default-50 rounded-lg">
              <p className="text-xs text-default-500 mb-1">{copy.role}</p>
              <Chip color={roleInfo.color} variant="flat" size="sm">
                {roleInfo.label}
              </Chip>
            </div>
            <div className="p-3 bg-default-50 rounded-lg">
              <p className="text-xs text-default-500 mb-1">{copy.status}</p>
              <Chip color={user.is_active ? "success" : "danger"} variant="flat" size="sm">
                {user.is_active ? copy.active : copy.inactive}
              </Chip>
            </div>
          </div>

          <Divider className="my-2" />

          <div className="flex justify-end">
            <Button
              color="primary"
              onPress={handleUpdateProfile}
              isLoading={isSaving}
              className="bg-linear-to-br from-blue-400 to-indigo-500"
              startContent={!isSaving && <Icon icon="solar:check-circle-linear" />}
            >
              {copy.saveChanges}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default memo(PersonalInfoSection);
