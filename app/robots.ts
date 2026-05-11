import type { MetadataRoute } from 'next';

const baseUrl = (process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: [
                    '/support',
                    '/support/contact',
                    '/docs',
                    '/status',
                    '/privacy',
                    '/terms',
                    '/cookies',
                    '/security',
                ],
                disallow: [
                    '/api/',
                    '/admin/',
                    '/login',
                    '/(instructor)/',
                    '/attendance/',
                    '/check-in/',
                    '/display/',
                    '/myscore/',
                    '/score/',
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
