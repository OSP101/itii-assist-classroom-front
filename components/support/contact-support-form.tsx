'use client';

import { useState } from 'react';
import { Card, CardBody } from '@heroui/card';
import { Button } from '@heroui/button';
import { Icon } from '@iconify/react';
import { Input, Textarea } from '@heroui/input';
import { addToast } from '@heroui/toast';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';
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

const SUPPORT_CATEGORY_LABELS = {
    technical: { th: 'ปัญหาทางเทคนิค', en: 'Technical issue' },
    account: { th: 'บัญชีผู้ใช้และสิทธิ์', en: 'Account and access' },
    learning: { th: 'งาน, เช็คชื่อ, คิว, คะแนน', en: 'Assignments, attendance, queues, scores' },
    feature: { th: 'ขอฟีเจอร์หรือปรับปรุง UX', en: 'Feature or UX request' },
    security: { th: 'ความปลอดภัยหรือ abuse', en: 'Security or abuse' },
    other: { th: 'อื่นๆ', en: 'Other' },
} as const;

const SUPPORT_PRIORITY_LABELS = {
    normal: { th: 'ปกติ', en: 'Normal' },
    high: { th: 'สูง', en: 'High' },
    urgent: { th: 'เร่งด่วน', en: 'Urgent' },
} as const;

function getSupportCategoryLabel(value: string, language: 'th' | 'en') {
    return SUPPORT_CATEGORY_LABELS[value as keyof typeof SUPPORT_CATEGORY_LABELS]?.[language] ?? value;
}

function getSupportPriorityLabel(value: string, language: 'th' | 'en') {
    return SUPPORT_PRIORITY_LABELS[value as keyof typeof SUPPORT_PRIORITY_LABELS]?.[language] ?? value;
}

export function ContactSupportForm() {
    const { language } = useGlobalSettings();
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

    const copy = language === 'en'
        ? {
            fillRequired: 'Please complete all required fields.',
            invalidEmail: 'Please enter a valid email address.',
            supportIntakeDetails: 'Support intake details',
            contactName: 'Contact name',
            contactEmail: 'Contact email',
            role: 'Role',
            course: 'Course / classroom',
            category: 'Category',
            priority: 'Priority',
            issueDetails: 'Issue details',
            unableToSubmit: 'Could not submit the request right now.',
            requestSubmitted: 'Your request has been submitted. The ticket is now in the queue and the team will contact you through the email you provided.',
            requestSubmittedToast: 'Support request sent successfully',
            requestReceivedToast: 'The team has received your support ticket.',
            nameLabel: 'Contact name *',
            namePlaceholder: 'Full name',
            emailLabel: 'Email *',
            emailPlaceholder: 'Reachable email address',
            roleLabel: 'Role in the platform',
            rolePlaceholder: 'For example Student, TA, Instructor',
            courseLabel: 'Course code / classroom',
            coursePlaceholder: 'For example OSP101-A or classroom name',
            categoryLabel: 'Category *',
            categoryPlaceholder: 'Select a category',
            priorityLabel: 'Priority',
            subjectLabel: 'Subject *',
            subjectPlaceholder: 'Summarize the issue clearly, for example File upload did not appear after submission',
            detailsLabel: 'Details *',
            detailsPlaceholder: 'Explain what happened, what you did before the issue, the impact you saw, and when it happened.',
            formTip: 'To help the team respond faster, include the course, your role, when the issue happened, and any supporting evidence if available.',
            responseTarget: 'The first response target for general cases is 24-48 hours.',
            submitting: 'Submitting...',
            submit: 'Submit request',
        }
        : {
            fillRequired: 'กรุณากรอกข้อมูลทั้งหมด',
            invalidEmail: 'อีเมลไม่ถูกต้อง',
            supportIntakeDetails: 'Support intake details',
            contactName: 'ชื่อผู้ติดต่อ',
            contactEmail: 'อีเมลติดต่อ',
            role: 'บทบาท',
            course: 'รหัสวิชา / ห้องเรียน',
            category: 'หมวดหมู่',
            priority: 'ระดับความเร่งด่วน',
            issueDetails: 'รายละเอียดปัญหา',
            unableToSubmit: 'ไม่สามารถส่งคำขอได้ในขณะนี้',
            requestSubmitted: 'ส่งคำขอเรียบร้อยแล้ว Ticket ถูกส่งเข้าคิวตรวจสอบ และทีมงานจะติดต่อกลับผ่านอีเมลที่คุณระบุ',
            requestSubmittedToast: 'ส่งคำขอสำเร็จ',
            requestReceivedToast: 'ทีมงานได้รับ support ticket ของคุณแล้ว',
            nameLabel: 'ชื่อผู้ติดต่อ *',
            namePlaceholder: 'ชื่อ-นามสกุล',
            emailLabel: 'อีเมล *',
            emailPlaceholder: 'อีเมลที่ติดต่อได้',
            roleLabel: 'บทบาทในระบบ',
            rolePlaceholder: 'เช่น นักศึกษา, TA, ผู้สอน',
            courseLabel: 'รหัสวิชา / ห้องเรียน',
            coursePlaceholder: 'เช่น OSP101-A หรือชื่อห้องเรียน',
            categoryLabel: 'หมวดหมู่ *',
            categoryPlaceholder: 'เลือกหมวดหมู่',
            priorityLabel: 'ระดับความเร่งด่วน',
            subjectLabel: 'หัวข้อ *',
            subjectPlaceholder: 'สรุปปัญหาให้สั้นและชัด เช่น ส่งงานแล้วไฟล์ไม่ขึ้น',
            detailsLabel: 'รายละเอียด *',
            detailsPlaceholder: 'อธิบายสิ่งที่เกิดขึ้น ขั้นตอนที่ทำก่อนเกิดปัญหา ผลกระทบที่พบ และเวลาที่เกิดเหตุ',
            formTip: 'เพื่อให้ทีมงานตอบกลับได้เร็วขึ้น โปรดใส่ข้อมูลที่ระบุถึงรายวิชา, บทบาทของคุณ, เวลาที่เกิดปัญหา, และหลักฐานประกอบถ้ามี',
            responseTarget: 'เป้าหมายการตอบกลับครั้งแรกสำหรับเคสทั่วไปคือ 24-48 ชั่วโมง',
            submitting: 'กำลังส่ง...',
            submit: 'ส่งคำขอ',
        };

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
                    message: copy.fillRequired,
                });
                setIsSubmitting(false);
                return;
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                setSubmitStatus({
                    type: 'error',
                    message: copy.invalidEmail,
                });
                setIsSubmitting(false);
                return;
            }

            const selectedCategory = supportRequestCategories.find((category) => category.value === formData.category);
            const selectedPriority = supportPriorityOptions.find((priority) => priority.value === formData.priority);

            const descriptionLines = [
                copy.supportIntakeDetails,
                `${copy.contactName}: ${formData.name.trim()}`,
                `${copy.contactEmail}: ${formData.email.trim()}`,
                `${copy.role}: ${formData.role.trim() || '-'}`,
                `${copy.course}: ${formData.courseCode.trim() || '-'}`,
                `${copy.category}: ${getSupportCategoryLabel(selectedCategory?.value || formData.category, language)}`,
                `${copy.priority}: ${getSupportPriorityLabel(selectedPriority?.value || formData.priority, language)}`,
                '',
                copy.issueDetails,
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
                    message: response.message || response.error || copy.unableToSubmit,
                });
                setIsSubmitting(false);
                return;
            }

            setSubmitStatus({
                type: 'success',
                message: copy.requestSubmitted,
            });
            resetForm();
            addToast({
                title: copy.requestSubmittedToast,
                description: copy.requestReceivedToast,
                color: 'success',
            });
            setIsSubmitting(false);
        } catch (error) {
            setSubmitStatus({
                type: 'error',
                message: error instanceof Error ? error.message : copy.unableToSubmit,
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
                            <label htmlFor="name" className="text-sm font-medium text-slate-700">{copy.nameLabel}</label>
                            <Input
                                id="name"
                                placeholder={copy.namePlaceholder}
                                value={formData.name}
                                onValueChange={(value) => updateField('name', value)}
                                isDisabled={isSubmitting}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-slate-700">{copy.emailLabel}</label>
                            <Input
                                id="email"
                                placeholder={copy.emailPlaceholder}
                                value={formData.email}
                                onValueChange={(value) => updateField('email', value)}
                                isDisabled={isSubmitting}
                                required
                                type="email"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="role" className="text-sm font-medium text-slate-700">{copy.roleLabel}</label>
                            <Input
                                id="role"
                                placeholder={copy.rolePlaceholder}
                                value={formData.role}
                                onValueChange={(value) => updateField('role', value)}
                                isDisabled={isSubmitting}
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="courseCode" className="text-sm font-medium text-slate-700">{copy.courseLabel}</label>
                            <Input
                                id="courseCode"
                                placeholder={copy.coursePlaceholder}
                                value={formData.courseCode}
                                onValueChange={(value) => updateField('courseCode', value)}
                                isDisabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label htmlFor="category" className="text-sm font-medium text-slate-700">{copy.categoryLabel}</label>
                            <select
                                id="category"
                                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                                value={formData.category}
                                onChange={(event) => updateField('category', event.target.value)}
                                disabled={isSubmitting}
                                required
                            >
                                <option value="">{copy.categoryPlaceholder}</option>
                                {supportRequestCategories.map((category) => (
                                    <option key={category.value} value={category.value}>{getSupportCategoryLabel(category.value, language)}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="priority" className="text-sm font-medium text-slate-700">{copy.priorityLabel}</label>
                            <select
                                id="priority"
                                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                                value={formData.priority}
                                onChange={(event) => updateField('priority', event.target.value)}
                                disabled={isSubmitting}
                            >
                                {supportPriorityOptions.map((priority) => (
                                    <option key={priority.value} value={priority.value}>{getSupportPriorityLabel(priority.value, language)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="subject" className="text-sm font-medium text-slate-700">{copy.subjectLabel}</label>
                        <Input
                            id="subject"
                            placeholder={copy.subjectPlaceholder}
                            value={formData.subject}
                            onValueChange={(value) => updateField('subject', value)}
                            isDisabled={isSubmitting}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="message" className="text-sm font-medium text-slate-700">{copy.detailsLabel}</label>
                        <Textarea
                            id="message"
                            placeholder={copy.detailsPlaceholder}
                            value={formData.message}
                            onValueChange={(value) => updateField('message', value)}
                            isDisabled={isSubmitting}
                            required
                            minRows={6}
                        />
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                        {copy.formTip}
                    </div>

                    <div className="border-t border-slate-200" />

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500">{copy.responseTarget}</p>
                        <Button
                            type="submit"
                            className="h-11 min-w-40 bg-linear-to-r from-blue-500 to-indigo-500 text-sm font-semibold text-white"
                            isDisabled={isSubmitting}
                        >
                            {isSubmitting ? copy.submitting : copy.submit}
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
