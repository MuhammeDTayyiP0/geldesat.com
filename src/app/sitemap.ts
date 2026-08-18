import { MetadataRoute } from 'next'
import { db } from '@/lib/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://geldesat.com'

    // Statik sayfalar
    const routes = [
        '',
        '/ilan-ver',
        '/search',
        '/categories',
        '/auth/login',
        '/auth/register',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: route === '' ? 1 : 0.8,
    }))

    // Kategoriler
    const categories = await db.category.findMany({
        select: { slug: true, updatedAt: true },
    })

    const categoryRoutes = categories.map((category) => ({
        url: `${baseUrl}/category/${category.slug}`,
        lastModified: category.updatedAt || new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
    }))

    // Son eklenen ilanlar (Sitemap'i çok şişirmemek için limit koyabiliriz, şimdilik hepsi)
    // SEO için tüm aktif ilanların olması iyidir.
    const listings = await db.listing.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, updatedAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50000 // Google sitemap limiti
    })

    const listingRoutes = listings.map((listing) => ({
        url: `${baseUrl}/ilan/${listing.id}`,
        lastModified: listing.updatedAt || new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.6,
    }))

    return [...routes, ...categoryRoutes, ...listingRoutes]
}
