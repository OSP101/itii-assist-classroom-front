'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import Link from 'next/link';

import {
    helpResources,
    supportCategories,
    supportFaqItems,
    supportGuideSections,
    supportResponseLanes,
} from '@/config/support-content';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';

function normalize(text: string) {
    return text.trim().toLowerCase();
}

const guideHrefById: Record<string, string> = {
    onboarding: '/docs/getting-started',
    assignments: '/docs/assignments',
    attendance: '/docs/attendance',
    queue: '/docs/queue-workflow',
    scores: '/docs/scores-appeals',
    account: '/docs/account-security',
    permissions: '/docs/browser-permissions',
    security: '/docs/security-reporting',
    troubleshooting: '/docs/troubleshooting-guide',
    roles: '/docs/role-permission-matrix',
    instructor: '/docs/instructor-end-to-end',
    ta: '/docs/ta-operations',
    student: '/docs/student-step-by-step',
};

const SUPPORT_GUIDE_TRANSLATIONS_EN: Record<string, {
    title: string;
    audience: string;
    summary: string;
    bullets: string[];
}> = {
    student: {
        title: 'Student step-by-step guide',
        audience: 'Students',
        summary: 'Covers first-time access, attendance, queues, scores, and the first troubleshooting steps students actually need.',
        bullets: [
            'Check that your courses and sections appear correctly right after you sign in.',
            'Enable the browser permissions you need before attendance or QR scanning.',
            'Collect evidence before reporting attendance or score issues.',
        ],
    },
    instructor: {
        title: 'Instructor guide from course launch to term wrap-up',
        audience: 'Instructors',
        summary: 'Plan the course, create work, track attendance, grade work, process score appeals, manage queues, and close the course in a structured flow.',
        bullets: [
            'Create sections and add TAs and students before the course goes live.',
            'Configure assignments, attendance, scores, and queues to match the course policy.',
            'Review scores and the activity log before closing the course.',
        ],
    },
    ta: {
        title: 'Teaching assistant weekly operations guide',
        audience: 'Teaching assistants',
        summary: 'Review permissions, attendance, grading, queues, score appeals, and weekly reporting back to instructors.',
        bullets: [
            'Start by checking your course permissions.',
            'Grade using the rubric and use score appeals when needed.',
            'Summarize assignments, attendance, queues, and requests for the instructor.',
        ],
    },
    roles: {
        title: 'Role and permission matrix',
        audience: 'Instructors and administrators',
        summary: 'Reference what each role can do and apply least-privilege principles when assigning TA access.',
        bullets: [
            'Treat role, course access, and course permission as separate controls.',
            'Give TAs only the permissions they need for their real duties.',
            'Review permissions at the start, midpoint, and close of the term.',
        ],
    },
    troubleshooting: {
        title: 'Troubleshooting and the information support needs',
        audience: 'All roles',
        summary: 'Resolve sign-in, permission, attendance, queue, and score issues faster by preparing the right context for support.',
        bullets: [
            'Separate the symptom from the likely cause before opening a case.',
            'Attach the time of the issue, the error message, and screenshots.',
            'Use the response lane that matches the urgency of the case.',
        ],
    },
    onboarding: {
        title: 'Getting started',
        audience: 'All roles',
        summary: 'Begin with sign-in, permission checks, and the basic account setup needed before real work starts.',
        bullets: [
            'Sign in with an account that the institution or instructor has authorized for the course.',
            'Verify that the courses shown on the home page match your term and section.',
            'Reset your password when prompted and use a strong password policy.',
            'If you want to link OAuth such as Google or GitHub, do it from the profile area after signing in.',
        ],
    },
    assignments: {
        title: 'Creating and submitting assignments',
        audience: 'Students and instructors',
        summary: 'Manage submissions, attachments, deadlines, and post-submission checks in a consistent workflow.',
        bullets: [
            'Instructors can set the title, description, deadline, and submission rules from the assignments tab.',
            'Students should confirm supported file types and size limits before each upload.',
            'After submission, verify the timestamp and current status on the assignment detail page.',
            'Late submissions may still be recorded, but lateness can be considered in grading.',
        ],
    },
    attendance: {
        title: 'Attendance and participation tracking',
        audience: 'Students',
        summary: 'Use self-check-in or QR attendance and follow the recovery path when an attendance record is wrong.',
        bullets: [
            'Check in only while the instructor keeps the attendance session open.',
            'If you missed the window or checked in incorrectly, submit a correction request with a reason.',
            'Review weekly attendance trends from the course overview.',
            'Prepare your device and network before scanning a QR code to reduce timeouts.',
        ],
    },
    queue: {
        title: 'Joining a queue for review or consultation',
        audience: 'Students and TAs',
        summary: 'Queue order is based on entry time and exposes clear status for both learners and teaching staff.',
        bullets: [
            'Join the queue from the course queue tab and prepare the work details before your turn.',
            'If you need to leave the queue, cancel before you are called so the order is not disrupted.',
            'Instructors and TAs should update queue status as soon as review begins or ends.',
            'Use short, precise queue notes that explain the blocker clearly.',
        ],
    },
    scores: {
        title: 'Scores and score appeals',
        audience: 'Students',
        summary: 'Track scores by activity and submit review requests with clear supporting evidence.',
        bullets: [
            'Review scores from the course scores tab together with the rubric or instructor notes.',
            'If a score appears wrong, submit a request with the reason and the supporting evidence.',
            'A strong request should mention the assignment, section, and the specific mismatch you observed.',
            'Track approval or rejection updates through the history view or notifications.',
        ],
    },
    account: {
        title: 'Accounts and access rights',
        audience: 'All roles',
        summary: 'Manage profile details, passwords, account recovery, and role correctness inside a course.',
        bullets: [
            'Use the forgot-password flow instead of creating duplicate accounts when you cannot access the original one.',
            'Keep your avatar and contact details current so instructors and staff can identify you correctly.',
            'If the course or role is wrong, contact the instructor or support with the course code.',
            'For suspicious sign-in or session activity, change your password and alert the team immediately.',
        ],
    },
    permissions: {
        title: 'Browser and device permissions',
        audience: 'Students and all users',
        summary: 'Explains why the platform asks for location, camera, and notification access so users can decide with confidence.',
        bullets: [
            'Location is requested only when a course requires location-based attendance verification.',
            'The camera is used when the user chooses QR scanning and should not stay active beyond that action.',
            'Notifications are used for important events such as queue updates, score updates, and system notices.',
            'If a permission was denied earlier, it can be re-enabled through the browser site settings or the permission center.',
        ],
    },
    security: {
        title: 'Security, activity review, and responsible use',
        audience: 'All roles',
        summary: 'Summarizes account protection, 2FA, vulnerability reporting, and responsible handling of classroom data.',
        bullets: [
            'Enable 2FA when available and store backup codes in a safe place.',
            'Instructors and administrators should review suspicious logs or activity before changing sensitive data or approving score requests.',
            'Never share accounts, tokens, QR codes, PINs, or session links with people who are not authorized.',
            'If you discover a vulnerability or data leak, use the Security page and avoid public disclosure before risk assessment.',
        ],
    },
};

const SUPPORT_FAQ_TRANSLATIONS_EN: Record<string, {
    question: string;
    answer: string;
    tags: string[];
}> = {
    'onboarding-1': {
        question: 'What should I do the first time I sign in?',
        answer: 'Sign in with the account that has been authorized for you, verify your course list, and reset your password if the system prompts you before using course tools by role.',
        tags: ['login', 'password', 'first-time', 'account'],
    },
    'assignments-1': {
        question: 'How do I know the platform received all files after submission?',
        answer: 'After submission, check the submission time, attached file names, and the latest status on the assignment detail page. Resubmit before the deadline if anything is missing.',
        tags: ['assignment', 'files', 'deadline', 'submit'],
    },
    'assignments-2': {
        question: 'What file types and size limits are supported?',
        answer: 'The platform generally supports documents, slides, images, and compressed files according to the instructor settings. Compress or split unusually large files before uploading.',
        tags: ['upload', 'pdf', 'zip', 'documents'],
    },
    'attendance-1': {
        question: 'What should I do if I miss the attendance window?',
        answer: 'Contact the instructor or submit an attendance correction request with the reason and the time of the incident so it can be reviewed case by case.',
        tags: ['attendance', 'late', 'session'],
    },
    'attendance-2': {
        question: 'What do the attendance statuses mean?',
        answer: 'The system can record statuses such as present, absent, late, leave, or sick, plus any additional states configured by the instructor for that course.',
        tags: ['status', 'present', 'late', 'leave'],
    },
    'queue-1': {
        question: 'Can I rejoin the queue after leaving it?',
        answer: 'Yes, but your new position is based on the time you rejoin. Decide before your turn is called so other people are not affected.',
        tags: ['queue', 'order', 'cancel'],
    },
    'queue-2': {
        question: 'What can instructors see in the queue?',
        answer: 'Instructors and TAs can see your order, name, and the context you entered so they can prepare the review or guidance faster.',
        tags: ['ta', 'teacher', 'queue-info'],
    },
    'scores-1': {
        question: 'What should I include in a score appeal to speed up review?',
        answer: 'Include the course, the related assignment, the score you saw, why you believe it is incorrect, and supporting evidence such as screenshots or reference files.',
        tags: ['score', 'appeal', 'evidence'],
    },
    'scores-2': {
        question: 'Where should I check the final score?',
        answer: 'Use the course scores tab as the source of truth because it reflects the latest score state and the outcome of score appeal reviews.',
        tags: ['final-score', 'grade', 'overall'],
    },
    'account-1': {
        question: 'What should I do if I forgot my password?',
        answer: 'Use the forgot-password flow on the sign-in page and check the email address linked to your account. If no message arrives within a reasonable time, contact support.',
        tags: ['forgot-password', 'reset', 'email'],
    },
    'account-2': {
        question: 'Why does my course not appear on the home page even though I enrolled?',
        answer: 'First confirm you signed in with the correct account. If the course is still missing, send the course code, section, and your email to support or the instructor.',
        tags: ['course-access', 'permissions', 'enrollment'],
    },
    'account-3': {
        question: 'Can I change my profile photo or personal details?',
        answer: 'Yes. Use the profile and settings pages, and keep your email and contact details current so the team can reach you correctly.',
        tags: ['profile', 'avatar', 'settings'],
    },
    'permissions-1': {
        question: 'Why does the platform ask for location, camera, or notification access?',
        answer: 'Location is used only for attendance scenarios that require area verification, the camera is used for QR scanning, and notifications are used for important queue, score, or system events.',
        tags: ['location', 'camera', 'notifications', 'permissions'],
    },
    'security-0': {
        question: 'When should I enable 2FA?',
        answer: '2FA is strongly recommended for instructors, TAs, administrators, and any student account that handles sensitive data or is used across multiple devices.',
        tags: ['2fa', 'totp', 'backup-codes'],
    },
    'security-1': {
        question: 'What should I do immediately if my account or session looks suspicious?',
        answer: 'Change your password, sign out of devices you do not recognize, and report the incident through the Security page together with the time and symptoms you observed.',
        tags: ['security', 'session', 'account-takeover'],
    },
    'security-2': {
        question: 'Where should I report a vulnerability?',
        answer: 'Use the security reporting page or email support with the subject prefix [SECURITY], and avoid public disclosure before the issue has been fixed.',
        tags: ['vulnerability', 'report', 'responsible-disclosure'],
    },
    'support-1': {
        question: 'What information should I prepare before opening a support request?',
        answer: 'At minimum include the course name, the time of the issue, the browser or device you used, the steps before the problem occurred, and screenshots when available.',
        tags: ['support', 'checklist', 'bug-report'],
    },
};

function getGuideHref(id: string) {
    return guideHrefById[id] ?? '/docs';
}

function FaqAccordionItem({
    item,
    isOpen,
    onToggle,
}: {
    item: (typeof supportFaqItems)[number];
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <div className={`transition-colors ${isOpen ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'}`}>
            <button
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                onClick={onToggle}
                aria-expanded={isOpen}
            >
                <span className={`text-sm font-medium leading-6 ${isOpen ? 'text-blue-700' : 'text-slate-800'}`}>
                    {item.question}
                </span>
                <Icon
                    icon="solar:alt-arrow-down-linear"
                    className={`mt-0.5 shrink-0 text-lg transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-500' : 'text-slate-400'
                    }`}
                />
            </button>

            {isOpen ? (
                <div className="px-5 pb-5 pr-10">
                    <p className="text-sm leading-6 text-slate-600">{item.answer}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[11px] text-slate-500"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export function SupportCenterClient() {
    const { language } = useGlobalSettings();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [openFaqId, setOpenFaqId] = useState<string | null>(null);

    const copy = language === 'en'
        ? {
            quickAccess: 'Quick access',
            faqTitle: 'Frequently asked questions',
            itemsCount: '{count} items',
            searchPlaceholder: 'Search for assignments, attendance, queues, scores, accounts...',
            clearSearch: 'Clear search',
            noFaqTitle: 'No matching questions found',
            noFaqDescription: 'Try another search term, or switch back to “All” and contact support if you still need help.',
            contactSupport: 'Contact support',
            relatedGuides: 'Related guides',
            popularGuides: 'Popular guides',
            viewAll: 'View all',
            responseTargets: 'Response targets by case type',
            ctaTitle: 'Need the team to inspect live data in the system?',
            ctaDescription: 'Share the course, your role in the platform, and what is blocked. The team will respond within the targets above.',
            submitSupportRequest: 'Submit a support request',
            reportSecurityIssue: 'Report a security issue',
            categories: {
                all: 'All',
                onboarding: 'Getting started',
                assignments: 'Assignments',
                attendance: 'Attendance',
                queue: 'Queues',
                scores: 'Scores',
                account: 'Account',
                permissions: 'Browser permissions',
                security: 'Security',
                privacy: 'Privacy',
            },
            resources: {
                docs: {
                    title: 'Documentation',
                    description: 'Step-by-step guides for each role in the platform.',
                },
                status: {
                    title: 'System Status',
                    description: 'Track platform status, maintenance, and live incident updates.',
                },
                contact: {
                    title: 'Contact Support',
                    description: 'Send a request with course context and the issue you need help with.',
                },
                security: {
                    title: 'Security Reporting',
                    description: 'Report vulnerabilities or suspicious behavior responsibly.',
                },
            },
            lanes: {
                'General Support': {
                    title: 'General Support',
                    responseTime: '24-48 hours',
                    description: 'Best for general access issues, missing courses, and workflow questions.',
                },
                'Learning Workflow': {
                    title: 'Learning Workflow',
                    responseTime: 'Next business day',
                    description: 'Issues related to assignments, attendance, queues, scores, and coordination with instructors.',
                },
                'Security & Abuse': {
                    title: 'Security & Abuse',
                    responseTime: 'Urgent intake',
                    description: 'For account compromise, data exposure, or suspicious behavior that needs immediate triage.',
                },
            },
        }
        : {
            quickAccess: 'เข้าถึงด่วน',
            faqTitle: 'คำถามที่พบบ่อย',
            itemsCount: '{count} รายการ',
            searchPlaceholder: 'ค้นหา เช่น งาน, เช็คชื่อ, คิว, คะแนน, บัญชี...',
            clearSearch: 'ล้างการค้นหา',
            noFaqTitle: 'ไม่พบคำถามที่ตรงกับคำค้นหา',
            noFaqDescription: 'ลองค้นด้วยคำอื่น หรือเลือก “ทั้งหมด” แล้วติดต่อทีมสนับสนุนหากยังไม่พบคำตอบ',
            contactSupport: 'ติดต่อทีมสนับสนุน',
            relatedGuides: 'คู่มือที่เกี่ยวข้อง',
            popularGuides: 'คู่มือยอดนิยม',
            viewAll: 'ดูทั้งหมด',
            responseTargets: 'เวลาตอบกลับตามประเภทเคส',
            ctaTitle: 'ต้องการให้ทีมงานช่วยดูข้อมูลจริงในระบบ?',
            ctaDescription: 'อธิบายรายวิชา บทบาทของคุณในระบบ และสิ่งที่ติดขัด ทีมงานจะตอบกลับตามเวลาที่กำหนดไว้ด้านบน',
            submitSupportRequest: 'ส่งคำขอสนับสนุน',
            reportSecurityIssue: 'แจ้งปัญหาความปลอดภัย',
            categories: {
                all: 'ทั้งหมด',
                onboarding: 'เริ่มต้นใช้งาน',
                assignments: 'งาน',
                attendance: 'เช็คชื่อ',
                queue: 'คิว',
                scores: 'คะแนน',
                account: 'บัญชี',
                permissions: 'สิทธิ์เบราว์เซอร์',
                security: 'ความปลอดภัย',
                privacy: 'ข้อมูลส่วนบุคคล',
            },
            resources: {
                docs: {
                    title: 'คู่มือการใช้งาน',
                    description: 'คู่มือใช้งานแบบ step-by-step สำหรับทุกบทบาทในระบบ',
                },
                status: {
                    title: 'สถานะระบบ',
                    description: 'ติดตามสถานะแพลตฟอร์ม การบำรุงรักษา และ incident แบบสด',
                },
                contact: {
                    title: 'ติดต่อทีมสนับสนุน',
                    description: 'ส่งคำขอช่วยเหลือโดยระบุหมวดปัญหาและบริบทของห้องเรียน',
                },
                security: {
                    title: 'แจ้งปัญหาความปลอดภัย',
                    description: 'แจ้งช่องโหว่หรือพฤติกรรมที่อาจกระทบความปลอดภัยอย่างรับผิดชอบ',
                },
            },
            lanes: {
                'General Support': {
                    title: 'ซัพพอร์ตทั่วไป',
                    responseTime: '24-48 ชั่วโมง',
                    description: 'เหมาะกับปัญหาทั่วไป เช่น การเข้าใช้งาน, รายวิชาไม่ขึ้น, และคำถามเชิง workflow',
                },
                'Learning Workflow': {
                    title: 'เวิร์กโฟลว์การเรียนการสอน',
                    responseTime: 'ภายในวันทำการถัดไป',
                    description: 'ปัญหาเกี่ยวกับงาน, เช็คชื่อ, คิว, คะแนน และการประสานงานกับผู้สอน',
                },
                'Security & Abuse': {
                    title: 'ความปลอดภัยและการใช้งานผิดปกติ',
                    responseTime: 'รับเรื่องเร่งด่วน',
                    description: 'สำหรับการยึดบัญชี, การรั่วไหลของข้อมูล, หรือการใช้งานที่ผิดปกติซึ่งต้อง triage ทันที',
                },
            },
        };

    const formatTemplate = (template: string, values: Record<string, string | number>) =>
        template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));

    const getCategoryLabel = (key: string) => copy.categories[key as keyof typeof copy.categories] ?? key;
    const getResourceCopy = (id: string) => copy.resources[id as keyof typeof copy.resources];
    const getLaneCopy = (title: string) => copy.lanes[title as keyof typeof copy.lanes];

    const localizedFaqItems = useMemo(
        () => language === 'en'
            ? supportFaqItems.map((item) => ({
                ...item,
                ...(SUPPORT_FAQ_TRANSLATIONS_EN[item.id] ?? {}),
            }))
            : supportFaqItems,
        [language],
    );

    const localizedGuideSections = useMemo(
        () => language === 'en'
            ? supportGuideSections.map((guide) => ({
                ...guide,
                ...(SUPPORT_GUIDE_TRANSLATIONS_EN[guide.id] ?? {}),
            }))
            : supportGuideSections,
        [language],
    );

    const normalizedQuery = normalize(searchQuery);

    const filteredFAQs = useMemo(() => {
        return localizedFaqItems.filter((item) => {
            const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
            const matchesSearch =
                normalizedQuery.length === 0 ||
                item.question.toLowerCase().includes(normalizedQuery) ||
                item.answer.toLowerCase().includes(normalizedQuery) ||
                item.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
            return matchesCategory && matchesSearch;
        });
    }, [localizedFaqItems, normalizedQuery, selectedCategory]);

    const suggestedGuides = useMemo(() => {
        if (!normalizedQuery) return localizedGuideSections.slice(0, 3);
        return localizedGuideSections
            .filter((guide) => {
                const space = [guide.title, guide.summary, guide.audience, ...guide.bullets]
                    .join(' ')
                    .toLowerCase();
                return space.includes(normalizedQuery);
            })
            .slice(0, 3);
    }, [localizedGuideSections, normalizedQuery]);

    return (
        <div className="space-y-12">
            {/* Quick-access cards */}
            <section>
                <h2 className="mb-4 text-base font-semibold text-slate-900">{copy.quickAccess}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {helpResources.map((resource) => {
                        const resourceCopy = getResourceCopy(resource.id);

                        return (
                            <Link
                                key={resource.id}
                                href={resource.href}
                                target={resource.type === 'external' ? '_blank' : undefined}
                                rel={resource.type === 'external' ? 'noopener noreferrer' : undefined}
                                className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
                            >
                                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
                                    <Icon icon={resource.icon} className="text-lg" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                                        {resourceCopy?.title ?? resource.title}
                                        {resource.type === 'external' ? (
                                            <Icon icon="solar:arrow-right-up-linear" className="shrink-0 text-xs text-slate-400" />
                                        ) : null}
                                    </div>
                                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{resourceCopy?.description ?? resource.description}</p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* FAQ with search */}
            <section>
                <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="text-base font-semibold text-slate-900">{copy.faqTitle}</h2>
                    <span className="text-xs text-slate-400">{formatTemplate(copy.itemsCount, { count: filteredFAQs.length })}</span>
                </div>

                {/* Search input */}
                <div className="relative">
                    <Icon
                        icon="solar:magnifer-linear"
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400"
                    />
                    <input
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        placeholder={copy.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery ? (
                        <button
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                            onClick={() => setSearchQuery('')}
                            aria-label={copy.clearSearch}
                        >
                            <Icon icon="solar:close-circle-bold" className="text-lg" />
                        </button>
                    ) : null}
                </div>

                {/* Category chips */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {supportCategories.map((cat) => (
                        <button
                            key={cat.key}
                            onClick={() => {
                                setSelectedCategory(cat.key);
                                setOpenFaqId(null);
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                selectedCategory === cat.key
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {getCategoryLabel(cat.key)}
                        </button>
                    ))}
                </div>

                {/* FAQ accordion */}
                <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {filteredFAQs.length > 0 ? (
                        filteredFAQs.map((item) => (
                            <FaqAccordionItem
                                key={item.id}
                                item={item}
                                isOpen={openFaqId === item.id}
                                onToggle={() => setOpenFaqId(openFaqId === item.id ? null : item.id)}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center gap-3 py-14 text-center">
                            <Icon icon="solar:magnifer-broken" className="text-4xl text-slate-300" />
                            <div>
                                <p className="text-sm font-medium text-slate-600">{copy.noFaqTitle}</p>
                                <p className="mt-1 text-xs text-slate-400">
                                    {copy.noFaqDescription}
                                </p>
                            </div>
                            <Link
                                href="/support/contact"
                                className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                            >
                                <Icon icon="solar:chat-round-dots-linear" className="text-sm" />
                                {copy.contactSupport}
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* Suggested guides */}
            {suggestedGuides.length > 0 ? (
                <section>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-900">
                            {normalizedQuery ? copy.relatedGuides : copy.popularGuides}
                        </h2>
                        <Link
                            href="/docs"
                            className="flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-700"
                        >
                            {copy.viewAll}
                            <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
                        </Link>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {suggestedGuides.map((guide) => (
                            <Link
                                key={guide.id}
                                href={getGuideHref(guide.id)}
                                className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm"
                            >
                                <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-blue-50 group-hover:text-blue-600">
                                    <Icon icon={guide.icon} className="text-base" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                                        {guide.title}
                                    </p>
                                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
                                        {guide.summary}
                                    </p>
                                    <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                                        {guide.audience}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}

            {/* Response SLA */}
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">{copy.responseTargets}</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                    {supportResponseLanes.map((lane) => {
                        const laneCopy = getLaneCopy(lane.title);

                        return (
                            <div
                                key={lane.title}
                                className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4"
                            >
                                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                    <Icon icon={lane.icon} className="text-lg" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">{laneCopy?.title ?? lane.title}</p>
                                    <p className="mt-0.5 text-xs font-medium text-blue-600">{laneCopy?.responseTime ?? lane.responseTime}</p>
                                    <p className="mt-1.5 text-xs leading-5 text-slate-500">{laneCopy?.description ?? lane.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* CTA */}
            <section className="flex flex-col items-start gap-4 rounded-xl border border-blue-100 bg-blue-50 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-slate-900">{copy.ctaTitle}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                        {copy.ctaDescription}
                    </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Link
                        href="/support/contact"
                        className="inline-flex min-h-9 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                        {copy.submitSupportRequest}
                    </Link>
                    <Link
                        href="/security"
                        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                        {copy.reportSecurityIssue}
                    </Link>
                </div>
            </section>
        </div>
    );
}

export default SupportCenterClient;
