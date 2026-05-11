import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { docsCategoryGroups } from '@/config/docs-categories';
import type { DocsArticle, DocsArticleSection } from '@/types/docs';

const docsDirectory = path.join(process.cwd(), '../MANUAL_GUIDE_TH');

function calculateReadingTime(text: string): string {
  const wordsPerMinute = 200;
  const noOfWords = text.split(/\s/g).length;
  const minutes = Math.ceil(noOfWords / wordsPerMinute);
  return `${minutes} นาที`;
}

function extractSections(content: string): DocsArticleSection[] {
  const lines = content.split('\n');
  const sections: DocsArticleSection[] = [];
  
  lines.forEach(line => {
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

function extractTitle(content: string): string {
    const match = content.match(/^#\s+(.*)/m);
    return match ? match[1].trim() : 'ไม่มีชื่อหัวข้อ';
}

function extractDescription(content: string): string {
    // Find the first paragraph under the title
    const paragraphs = content.split('\n\n').filter(p => !p.startsWith('#') && p.trim().length > 0);
    return paragraphs.length > 0 ? paragraphs[0].substring(0, 150) + '...' : '';
}

export function getAllDocs(): DocsArticle[] {
    if (!fs.existsSync(docsDirectory)) return [];
    
    const fileNames = fs.readdirSync(docsDirectory);
    const docsFiles = fileNames.filter(name => name.endsWith('.md') && name !== 'README.md');
    
    return docsFiles.map(fileName => {
        const slug = fileName.replace(/\.md$/, '');
        const fullPath = path.join(docsDirectory, fileName);
        const fileContents = fs.readFileSync(fullPath, 'utf8');
        
        // Parse frontmatter if any (though currently missing, might add later)
        const { data, content } = matter(fileContents);
        
        let title = data.title || extractTitle(content);
        let description = data.description || extractDescription(content);
        
        // Determine category by filename heuristics
        let category = 'start';
        let audience = 'ทุกบทบาท';
        let icon = 'solar:document-text-bold';
        
        if (slug.includes('INSTRUCTOR') || slug.includes('TA')) {
            category = 'teaching';
            audience = 'ผู้สอน, TA';
            icon = 'solar:diploma-bold';
        } else if (slug.includes('STUDENT')) {
            category = 'student';
            audience = 'นักศึกษา';
            icon = 'solar:book-open-bold';
        } else if (slug.includes('SYSTEM') || slug.includes('ROLE')) {
            category = 'admin';
            audience = 'ผู้ดูแลระบบ';
            icon = 'solar:settings-bold';
        } else if (slug.includes('AI_ASSISTANT')) {
            category = 'policy';
            icon = 'solar:cpu-bolt-bold';
        }
        
        const categoryLabel = docsCategoryGroups.find(g => g.key === category)?.title || 'ทั่วไป';
        
        const stats = fs.statSync(fullPath);
        const updatedAt = stats.mtime.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
        
        return {
            slug,
            title,
            description,
            category,
            categoryLabel,
            audience,
            icon,
            updatedAt,
            readingTime: calculateReadingTime(content),
            content: content.replace(/^#\s+(.*)\n/, ''), // Strip the main title so we don't duplicate it
            sections: extractSections(content),
            related: []
        };
    }).sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getDocBySlug(slug: string): DocsArticle | undefined {
    return getAllDocs().find(doc => doc.slug === slug);
}

export function getDocsByCategory(category: string): DocsArticle[] {
    return getAllDocs().filter(doc => doc.category === category);
}

export function getDocsNeighbors(slug: string) {
    const allDocs = getAllDocs();
    const index = allDocs.findIndex(d => d.slug === slug);
    if (index === -1) return { previous: null, next: null };
    
    return {
        previous: index > 0 ? allDocs[index - 1] : null,
        next: index < allDocs.length - 1 ? allDocs[index + 1] : null
    };
}
