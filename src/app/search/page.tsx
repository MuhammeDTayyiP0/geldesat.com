
import { db } from "@/lib/db"
import { ListingResults } from "@/components/listing/ListingResults"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Card } from "@/components/ui/card"
import { SearchFilters } from "@/components/search/SearchFilters"
import { Search } from "lucide-react"

interface SearchPageProps {
    searchParams: {
        q?: string
        category?: string
        minPrice?: string
        maxPrice?: string
        sort?: string
        city?: string
        district?: string
    }
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
    const { q, category } = await searchParams

    if (q) {
        return {
            title: `"${q}" için Arama Sonuçları`
        }
    }

    if (category) {
        // ideally fetch category name but for now:
        return {
            title: "Kategori Sonuçları"
        }
    }

    return {
        title: "Tüm İlanlar"
    }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
    const { q, category, minPrice, maxPrice, sort } = await searchParams

    const where: any = {
        status: "ACTIVE"
    }

    if (q) {
        where.OR = [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } }
        ]
    }

    if (category) {
        // Find category and its children to include subcategory listings
        // For simplicity now, just exact match. Real implementation needs recursive ID check.
        where.categoryId = category
    }

    if (minPrice || maxPrice) {
        where.price = {}
        if (minPrice) where.price.gte = parseFloat(minPrice)
        if (maxPrice) where.price.lte = parseFloat(maxPrice)
    }

    if (searchParams.city) {
        where.city = searchParams.city
    }

    if (searchParams.district) {
        where.district = searchParams.district
    }

    const orderBy: any = {}
    if (sort === 'price_asc') orderBy.price = 'asc'
    else if (sort === 'price_desc') orderBy.price = 'desc'
    else orderBy.createdAt = 'desc'

    const rawListings = await db.listing.findMany({
        where,
        orderBy,
        include: {
            category: true
        }
    })

    const listings = rawListings.map(listing => ({
        ...listing,
        price: Number(listing.price)
    }))

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">
                {q ? `"${q}" için arama sonuçları` : "Tüm İlanlar"}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Filters Sidebar */}
                <div className="hidden md:block">
                    <SearchFilters />
                </div>

                {/* Listing Grid */}
                <div className="md:col-span-3">
                    <div className="mb-4 flex items-center justify-between">
                        <span className="text-muted-foreground">{listings.length} ilan bulundu</span>
                        {/* Sort Dropdown could go here */}
                    </div>

                    {listings.length === 0 ? (
                        <div className="text-center py-20 bg-muted/30 rounded-lg">
                            <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">Sonuç bulunamadı</h3>
                            <p className="text-muted-foreground">Arama kriterlerinizi değiştirerek tekrar deneyin.</p>
                        </div>
                    ) : (
                        <ListingResults listings={listings} />
                    )}
                </div>
            </div>
        </div>
    )
}
