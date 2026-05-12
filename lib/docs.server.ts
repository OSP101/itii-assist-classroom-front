import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { DocsArticle, DocsArticleSection } from '@/types/docs';

const docsDirectoryTh = path.join(process.cwd(), '../MANUAL_GUIDE_TH');
const docsDirectoryEn = path.join(process.cwd(), '../MANUAL_GUIDE_EN');

type DocsLanguage = 'th' | 'en';

const categoryLabels = {
    th: {
        start: 'เริ่มต้นใช้งาน',
        student: 'สำหรับนักศึกษา',
        teaching: 'สำหรับผู้สอนและ TA',
        admin: 'สำหรับผู้ดูแลระบบ',
        policy: 'นโยบายและความปลอดภัย',
    },
    en: {
        start: 'Getting started',
        student: 'For students',
        teaching: 'For instructors and TAs',
        admin: 'For administrators',
        policy: 'Policy and security',
    },
} as const;

const audienceLabels = {
    th: {
        all: 'ทุกบทบาท',
        student: 'นักศึกษา',
        teaching: 'ผู้สอน, TA',
        admin: 'ผู้ดูแลระบบ',
    },
    en: {
        all: 'All roles',
        student: 'Students',
        teaching: 'Instructors / TAs',
        admin: 'Administrators',
    },
} as const;

function getCanonicalDocFiles() {
    if (!fs.existsSync(docsDirectoryTh)) return [];

    return fs
        .readdirSync(docsDirectoryTh)
        .filter((name) => name.endsWith('.md') && name !== 'README.md');
}

function getDocSourcePath(fileName: string, language: DocsLanguage) {
    if (language === 'en') {
        const englishPath = path.join(docsDirectoryEn, fileName);
        if (fs.existsSync(englishPath)) {
            return englishPath;
        }
    }

    return path.join(docsDirectoryTh, fileName);
}

function inferCategory(slug: string) {
    if (slug.includes('INSTRUCTOR') || slug.includes('TA')) {
        return 'teaching';
    }

    if (slug.includes('STUDENT')) {
        return 'student';
    }

    if (slug.includes('SYSTEM') || slug.includes('ROLE')) {
        return 'admin';
    }

    if (slug.includes('AI_ASSISTANT')) {
        return 'policy';
    }

    return 'start';
}

function inferAudience(slug: string, language: DocsLanguage) {
    if (slug.includes('INSTRUCTOR') || slug.includes('TA') || slug.includes('AI_ASSISTANT')) {
        return audienceLabels[language].teaching;
    }

    if (slug.includes('STUDENT')) {
        return audienceLabels[language].student;
    }

    if (slug.includes('SYSTEM') || slug.includes('ROLE')) {
        return audienceLabels[language].admin;
    }

    return audienceLabels[language].all;
}

function inferIcon(slug: string, category: string) {
    if (slug.includes('AI_ASSISTANT')) {
        return 'solar:cpu-bolt-bold';
    }

    switch (category) {
        case 'teaching':
            return 'solar:diploma-bold';
        case 'student':
            return 'solar:book-open-bold';
        case 'admin':
            return 'solar:settings-bold';
        case 'policy':
            return 'solar:shield-check-bold';
        default:
            return 'solar:document-text-bold';
    }
}

function getCategoryLabel(category: string, language: DocsLanguage) {
    return categoryLabels[language][category as keyof typeof categoryLabels.en] ?? (language === 'en' ? 'General' : 'ทั่วไป');
};

function calculateReadingTime(text: string, language: DocsLanguage): string {
    const wordsPerMinute = 200;
    const noOfWords = text.split(/\s/g).length;
    const minutes = Math.ceil(noOfWords / wordsPerMinute);
    return language === 'en' ? `${minutes} min` : `${minutes} นาที`;
}

function extractSections(content: string): DocsArticleSection[] {
        const lines = content.split('\n');
        const sections: DocsArticleSection[] = [];

        lines.forEach((line) => {
                const match = line.match(/^(#{2,3})\s+(.*)/);
                if (match) {
                        const level = match[1].length;
                        const title = match[2].trim();
                        const id = title.toLowerCase().replace(/[^\w\s\u0E00-\u0E7F-]/g, '').replace(/[\s_]+/g, '-');
                        sections.push({ id, title, level });
                }
        });

        return sections;
}

function extractTitle(content: string, language: DocsLanguage): string {
    const match = content.match(/^#\s+(.*)/m);
        return match ? match[1].trim() : language === 'en' ? 'Untitled article' : 'ไม่มีชื่อหัวข้อ';
}

function extractDescription(content: string): string {
        const paragraphs = content.split('\n\n').filter((paragraph) => !paragraph.startsWith('#') && paragraph.trim().length > 0);
        if (paragraphs.length === 0) return '';

        const firstParagraph = paragraphs[0].trim();
        return firstParagraph.length > 150 ? `${firstParagraph.substring(0, 150).trim()}...` : firstParagraph;
}

function formatUpdatedAt(date: Date, language: DocsLanguage): string {
    return date.toLocaleDateString(language === 'en' ? 'en-US' : 'th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function getAllDocs(language: DocsLanguage = 'th'): DocsArticle[] {
    const docsFiles = getCanonicalDocFiles();

    return docsFiles.map((fileName) => {
        const slug = fileName.replace(/\.md$/, '');
        const fullPath = getDocSourcePath(fileName, language);
        const fileContents = fs.readFileSync(fullPath, 'utf8');
        const { data, content } = matter(fileContents);
        const category = inferCategory(slug);
        const title = data.title || extractTitle(content, language);
        const description = data.description || extractDescription(content);
        const audience = inferAudience(slug, language);
        const icon = inferIcon(slug, category);
        const categoryLabel = getCategoryLabel(category, language);
        const stats = fs.statSync(path.join(docsDirectoryTh, fileName));
        const updatedAt = formatUpdatedAt(stats.mtime, language);

        return {
            slug,
            title,
            description,
            category,
            categoryLabel,
            audience,
            icon,
            updatedAt,
            readingTime: calculateReadingTime(content, language),
            content: content.replace(/^#\s+(.*)\n/, ''), // Strip the main title so we don't duplicate it
            sections: extractSections(content),
            related: []
        };
    }).sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getDocBySlug(slug: string, language: DocsLanguage = 'th'): DocsArticle | undefined {
    return getAllDocs(language).find(doc => doc.slug === slug);
}

export function getDocsByCategory(category: string, language: DocsLanguage = 'th'): DocsArticle[] {
    return getAllDocs(language).filter(doc => doc.category === category);
}

export function getDocsNeighbors(slug: string, language: DocsLanguage = 'th') {
    const allDocs = getAllDocs(language);
    const index = allDocs.findIndex(d => d.slug === slug);
    if (index === -1) return { previous: null, next: null };
    
    return {
        previous: index > 0 ? allDocs[index - 1] : null,
        next: index < allDocs.length - 1 ? allDocs[index + 1] : null
    };
}
