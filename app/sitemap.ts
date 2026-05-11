import type { MetadataRoute } from 'next';

import { getAllDocs } from '@/lib/docs.server';

const baseUrl = (process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');

const publicRoutes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
}> = [
    { path: '/support',         priority: 0.9, changeFrequency: 'weekly' },
    { path: '/support/contact', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/docs',            priority: 0.9, changeFrequency: 'weekly' },
    { path: '/status',          priority: 0.8, changeFrequency: 'daily' },
    { path: '/privacy',         priority: 0.6, changeFrequency: 'monthly' },
    { path: '/terms',           priority: 0.6, changeFrequency: 'monthly' },
    { path: '/cookies',         priority: 0.5, changeFrequency: 'monthly' },
    { path: '/security',        priority: 0.7, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    const baseRoutes = publicRoutes.map(({ path, priority, changeFrequency }) => ({
        url: `${baseUrl}${path}`,
        lastModified: now,
        changeFrequency,
        priority,
    }));

    const docsArticles = getAllDocs();
    const docArticleRoutes = docsArticles.map((article) => ({
        url: `${baseUrl}/docs/${article.slug}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.65,
    }));

    return [...baseRoutes, ...docArticleRoutes];
}
