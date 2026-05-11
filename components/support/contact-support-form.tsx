'use client';

import { useState } from 'react';
import { Card, CardBody } from '@heroui/card';
import { Button } from '@heroui/button';
import { Icon } from '@iconify/react';
import { Input, Textarea } from '@heroui/input';
import { addToast } from '@heroui/toast';
import { feedbackService } from '@/services/feedback.service';
import type { CreateFeedbackDto } from '@/services/feedback.service';

import {
    supportPriorityOptions,
    supportRequestCategories,
} from '@/config/support-content';

const supportPriorityToFeedbackPriority: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
    normal: 'medium',
    high: 'high',
    urgent: 'critical',
};

export function ContactSupportForm() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: '',
        courseCode: '',
        category: '',
        priority: 'normal',
        subject: '',
        message: '',
        website: '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error' | null; message: string; }>({ type: null, message: '' });

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            role: '',
            courseCode: '',
            category: '',
            priority: 'normal',
            subject: '',
            message: '',
            website: '',
        });
    };

    const updateField = (field: keyof typeof formData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus({ type: null, message: '' });

        try {
            // Validate form
            if (!formData.name || !formData.email || !formData.category || !formData.subject || !formData.message) {
                setSubmitStatus({
                    type: 'error',
                    message: 'กรุณากรอกข้อมูลทั้งหมด'
                });
                setIsSubmitting(false);
                return;
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                setSubmitStatus({
                    type: 'error',
                    message: 'อีเมลไม่ถูกต้อง'
                });
                setIsSubmitting(false);
                return;
            }

            const selectedCategory = supportRequestCategories.find((category) => category.value === formData.category);
            const selectedPriority = supportPriorityOptions.find((priority) => priority.value === formData.priority);

            const descriptionLines = [
                'Support intake details',
                `ชื่อผู้ติดต่อ: ${formData.name.trim()}`,
                `อีเมลติดต่อ: ${formData.email.trim()}`,
                `บทบาท: ${formData.role.trim() || '-'}`,
                `รหัสวิชา / ห้องเรียน: ${formData.courseCode.trim() || '-'}`,
                `หมวดหมู่: ${selectedCategory?.label || formData.category}`,
                `ระดับความเร่งด่วน: ${selectedPriority?.label || formData.priority}`,
                '',
                'รายละเอียดปัญหา',
                formData.message.trim(),
            ];

            const payload: CreateFeedbackDto = {
                type: 'support',
                title: formData.subject.trim(),
                description: descriptionLines.join('\n'),
                contact_email: formData.email.trim(),
                priority: supportPriorityToFeedbackPriority[formData.priority] || 'medium',
                website: formData.website.trim() || undefined,
            };

            const response = await feedbackService.createSupportTicket(payload);

            if (!response.success) {
                setSubmitStatus({
                    type: 'error',
                    message: response.message || response.error || 'ไม่สามารถส่งคำขอได้ในขณะนี้'
                });
                setIsSubmitting(false);
                return;
            }

            setSubmitStatus({
                type: 'success',
                message: 'ส่งคำขอเรียบร้อยแล้ว Ticket ถูกส่งเข้าคิวตรวจสอบ และทีมงานจะติดต่อกลับผ่านอีเมลที่คุณระบุ'
            });
            resetForm();
            addToast({
                title: 'ส่งคำขอสำเร็จ',
                description: 'ทีมงานได้รับ support ticket ของคุณแล้ว',
                color: 'success',
            });
            setIsSubmitting(false);
        } catch (error) {
            setSubmitStatus({
                type: 'error',
                message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่'
            });
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="rounded-4xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
            <CardBody className="p-6 sm:p-7">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div
                        aria-hidden="true"
                        style={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
                    >
                        <label htmlFor="website">Website</label>
                        <input
                            id="website"
                            name="website"
                            type="text"
                            tabIndex={-1}
                            autoComplete="off"
                            value={formData.website}
                            onChange={(event) => updateField('website', event.target.value)}
                        />
                    </div>

                    {submitStatus.type ? (
                        <div className={`flex items-start gap-3 rounded-3xl border p-4 ${
                            submitStatus.type === 'success'
                                ? 'border-green-200 bg-green-50'
                                : 'border-red-200 bg-red-50'
                        }`}>
                            <Icon
                                icon={submitStatus.type === 'success' ? 'solar:check-circle-linear' : 'solar:close-circle-linear'}
                                className={`mt-0.5 text-xl shrink-0 ${
                                    submitStatus.type === 'success' ? 'text-green-600' : 'text-red-600'
                                }`}
                            />
                            <span className={submitStatus.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                                {submitStatus.message}
                            </span>
                        </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium text-slate-700">ชื่อผู้ติดต่อ *</label>
                            <Input
                                id="name"
                                placeholder="ชื่อ-นามสกุล"
                                value={formData.name}
                                onValueChange={(value) => updateField('name', value)}
                                isDisabled={isSubmitting}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-slate-700">อีเมล *</label>
                            <Input
                                id="email"
                                placeholder="อีเมลที่ติดต่อได้"
                                value={formData.email}
                                onValueChange={(value) => updateField('email', value)}
                                isDisabled={isSubmitting}
                                required
                                type="email"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="role" className="text-sm font-medium text-slate-700">บทบาทในระบบ</label>
                            <Input
                                id="role"
                                placeholder="เช่น นักศึกษา, TA, ผู้สอน"
                                value={formData.role}
                                onValueChange={(value) => updateField('role', value)}
                                isDisabled={isSubmitting}
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="courseCode" className="text-sm font-medium text-slate-700">รหัสวิชา / ห้องเรียน</label>
                            <Input
                                id="courseCode"
                                placeholder="เช่น OSP101-A หรือชื่อห้องเรียน"
                                value={formData.courseCode}
                                onValueChange={(value) => updateField('courseCode', value)}
                                isDisabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label htmlFor="category" className="text-sm font-medium text-slate-700">หมวดหมู่ *</label>
                            <select
                                id="category"
                                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                                value={formData.category}
                                onChange={(event) => updateField('category', event.target.value)}
                                disabled={isSubmitting}
                                required
                            >
                                <option value="">เลือกหมวดหมู่</option>
                                {supportRequestCategories.map((category) => (
                                    <option key={category.value} value={category.value}>{category.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="priority" className="text-sm font-medium text-slate-700">ระดับความเร่งด่วน</label>
                            <select
                                id="priority"
                                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                                value={formData.priority}
                                onChange={(event) => updateField('priority', event.target.value)}
                                disabled={isSubmitting}
                            >
                                {supportPriorityOptions.map((priority) => (
                                    <option key={priority.value} value={priority.value}>{priority.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="subject" className="text-sm font-medium text-slate-700">หัวข้อ *</label>
                        <Input
                            id="subject"
                            placeholder="สรุปปัญหาให้สั้นและชัด เช่น ส่งงานแล้วไฟล์ไม่ขึ้น"
                            value={formData.subject}
                            onValueChange={(value) => updateField('subject', value)}
                            isDisabled={isSubmitting}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="message" className="text-sm font-medium text-slate-700">รายละเอียด *</label>
                        <Textarea
                            id="message"
                            placeholder="อธิบายสิ่งที่เกิดขึ้น ขั้นตอนที่ทำก่อนเกิดปัญหา ผลกระทบที่พบ และเวลาที่เกิดเหตุ"
                            value={formData.message}
                            onValueChange={(value) => updateField('message', value)}
                            isDisabled={isSubmitting}
                            required
                            minRows={6}
                        />
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                        เพื่อให้ทีมงานตอบกลับได้เร็วขึ้น โปรดใส่ข้อมูลที่ระบุถึงรายวิชา, บทบาทของคุณ, เวลาที่เกิดปัญหา, และหลักฐานประกอบถ้ามี
                    </div>

                    <div className="border-t border-slate-200" />

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500">เป้าหมายการตอบกลับครั้งแรกสำหรับเคสทั่วไปคือ 24-48 ชั่วโมง</p>
                        <Button
                            type="submit"
                            className="h-11 min-w-40 bg-linear-to-r from-blue-500 to-indigo-500 text-sm font-semibold text-white"
                            isDisabled={isSubmitting}
                        >
                            {isSubmitting ? 'กำลังส่ง...' : 'ส่งคำขอ'}
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
