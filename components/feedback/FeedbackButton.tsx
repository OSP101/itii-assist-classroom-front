"use client";

import { useState, useRef } from "react";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { feedbackService } from "@/services/feedback.service";
import type { CreateFeedbackDto } from "@/services/feedback.service";

const typeOptions = [
    { key: "bug", label: "รายงานข้อผิดพลาด", icon: "solar:bug-bold", color: "text-red-500" },
    { key: "feature", label: "ขอฟีเจอร์ใหม่", icon: "solar:star-bold", color: "text-blue-500" },
    { key: "improvement", label: "ข้อเสนอแนะ", icon: "solar:lightbulb-bold", color: "text-amber-500" },
    { key: "other", label: "อื่นๆ", icon: "solar:chat-round-dots-bold", color: "text-default-500" },
];

interface FeedbackFormProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string;
}

export function FeedbackModal({ isOpen, onClose, userEmail }: FeedbackFormProps) {
    const [type, setType] = useState<string>("bug");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [contactEmail, setContactEmail] = useState(userEmail || "");
    const [attachments, setAttachments] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetForm = () => {
        setType("bug");
        setTitle("");
        setDescription("");
        setContactEmail(userEmail || "");
        setAttachments([]);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        if (attachments.length + files.length > 5) {
            addToast({
                title: "จำนวนไฟล์เกินกำหนด",
                description: "อัปโหลดได้สูงสุด 5 ไฟล์",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setUploadingFiles(true);

        try {
            const newAttachments: string[] = [];

            for (const file of Array.from(files)) {
                // Check file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    addToast({
                        title: "ไฟล์ใหญ่เกินไป",
                        description: `${file.name} มีขนาดเกิน 5MB`,
                        color: "warning",
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });
                    continue;
                }

                // Convert to base64 for now (in production, upload to cloud storage)
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });

                newAttachments.push(base64);
            }

            setAttachments((prev) => [...prev, ...newAttachments]);
        } catch (error) {
            addToast({
                title: "อัปโหลดไม่สำเร็จ",
                description: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setUploadingFiles(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            addToast({
                title: "กรุณากรอกหัวข้อ",
                description: "หัวข้อจำเป็นต้องกรอก",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (!description.trim()) {
            addToast({
                title: "กรุณากรอกรายละเอียด",
                description: "รายละเอียดจำเป็นต้องกรอก",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const data: CreateFeedbackDto = {
                type: type as any,
                title: title.trim(),
                description: description.trim(),
                attachments: attachments.length > 0 ? attachments : undefined,
                contact_email: contactEmail || undefined,
            };

            const response = await feedbackService.createFeedback(data);

            if (response.success) {
                addToast({
                    title: "ส่ง Feedback สำเร็จ",
                    description: "ขอบคุณสำหรับ Feedback ของคุณ",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                resetForm();
                onClose();
            } else {
                addToast({
                    title: "เกิดข้อผิดพลาด",
                    description: response.message || "ไม่สามารถส่ง Feedback ได้",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถส่ง Feedback ได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                resetForm();
                onClose();
            }}
            size="2xl"
            scrollBehavior="inside"
        >
            <ModalContent>
                {(onCloseModal) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-primary-100 rounded-lg">
                                    <Icon icon="solar:chat-round-like-bold" className="text-xl text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">ส่ง Feedback</h3>
                                    <p className="text-xs text-default-500 font-normal">
                                        แจ้งปัญหาหรือข้อเสนอแนะเพื่อปรับปรุงระบบ
                                    </p>
                                </div>
                            </div>
                        </ModalHeader>
                        <ModalBody>
                            <div className="space-y-4">
                                {/* Type Selection */}
                                <div>
                                    <p className="text-sm font-medium mb-2">ประเภท</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {typeOptions.map((option) => (
                                            <button
                                                key={option.key}
                                                type="button"
                                                onClick={() => setType(option.key)}
                                                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                                    type === option.key
                                                        ? "border-primary bg-primary-50"
                                                        : "border-default-200 hover:border-default-300"
                                                }`}
                                            >
                                                <Icon icon={option.icon} className={`text-xl ${option.color}`} />
                                                <span className="text-sm font-medium">{option.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Title */}
                                <Input
                                    label="หัวข้อ"
                                    placeholder="สรุปปัญหาหรือข้อเสนอแนะสั้นๆ"
                                    value={title}
                                    onValueChange={setTitle}
                                    isRequired
                                    maxLength={255}
                                />

                                {/* Description */}
                                <Textarea
                                    label="รายละเอียด"
                                    placeholder="อธิบายรายละเอียดให้ครบถ้วน เช่น ขั้นตอนที่ทำให้เกิดปัญหา, สิ่งที่คาดหวัง, สิ่งที่เกิดขึ้นจริง"
                                    value={description}
                                    onValueChange={setDescription}
                                    isRequired
                                    minRows={4}
                                    maxRows={8}
                                />

                                {/* Attachments */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium">
                                            ไฟล์แนบ <span className="text-default-400 font-normal">(ไม่บังคับ)</span>
                                        </p>
                                        <span className="text-xs text-default-500">
                                            {attachments.length}/5 ไฟล์
                                        </span>
                                    </div>

                                    {/* File Preview */}
                                    {attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {attachments.map((url, index) => (
                                                <div key={index} className="relative group">
                                                    <img
                                                        src={url}
                                                        alt={`Attachment ${index + 1}`}
                                                        className="w-20 h-20 object-cover rounded-lg border border-default-200"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeAttachment(index)}
                                                        className="absolute -top-2 -right-2 p-1 bg-danger rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Icon icon="solar:close-circle-bold" className="text-sm" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Upload Button */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,video/*"
                                        multiple
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <Button
                                        variant="bordered"
                                        size="sm"
                                        startContent={
                                            uploadingFiles ? (
                                                <Spinner size="sm" />
                                            ) : (
                                                <Icon icon="solar:upload-linear" />
                                            )
                                        }
                                        onPress={() => fileInputRef.current?.click()}
                                        isDisabled={uploadingFiles || attachments.length >= 5}
                                    >
                                        อัปโหลดรูปภาพ/วิดีโอ
                                    </Button>
                                    <p className="text-xs text-default-400 mt-1">
                                        รองรับไฟล์ภาพและวิดีโอ ขนาดไม่เกิน 5MB ต่อไฟล์
                                    </p>
                                </div>

                                {/* Contact Email */}
                                <Input
                                    label="อีเมลติดต่อกลับ"
                                    type="email"
                                    placeholder="your@email.com"
                                    value={contactEmail}
                                    onValueChange={setContactEmail}
                                    description="กรอกอีเมลหากต้องการให้ติดต่อกลับ (ไม่บังคับ)"
                                />
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onCloseModal}>
                                ยกเลิก
                            </Button>
                            <Button
                                color="primary"
                                onPress={handleSubmit}
                                isLoading={isSubmitting}
                                isDisabled={!title.trim() || !description.trim()}
                                className="bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                            >
                                ส่ง Feedback
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}

// Floating Feedback Button Component
interface FeedbackButtonProps {
    userEmail?: string;
    position?: "bottom-right" | "bottom-left";
}

export function FeedbackButton({ userEmail, position = "bottom-right" }: FeedbackButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    const positionClasses = {
        "bottom-right": "right-4 sm:right-6",
        "bottom-left": "left-4 sm:left-6",
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-4 sm:bottom-6 ${positionClasses[position]} z-50 p-3 sm:p-4 bg-linear-to-r from-blue-400 to-indigo-500 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 group`}
                title="ส่ง Feedback"
            >
                <Icon icon="solar:chat-round-like-bold" className="text-xl sm:text-2xl" />
                <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-default-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                    ส่ง Feedback
                </span>
            </button>

            <FeedbackModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                userEmail={userEmail}
            />
        </>
    );
}

export default FeedbackButton;
