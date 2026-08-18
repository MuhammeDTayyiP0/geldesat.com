import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Filter, LayoutGrid, List } from "lucide-react"
import { getCategoryAttributesWithInheritance } from "@/actions/category"
import { getListings } from "@/actions/listing"
import { ListingFilters } from "@/components/listing/ListingFilters"
import { ListingResults } from "@/components/listing/ListingResults"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const category = await db.category.findUnique({ where: { slug } })
    if (!category) return { title: "Kategori Bulunamadı" }
    return { title: `${category.name} İlanları | GeldeSat` }
}

export default async function CategoryPage({
    params,
    searchParams
}: {
    params: Promise<{ slug: string }>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const { slug } = await params
    const resolvedSearchParams = await searchParams

    const category = await db.category.findUnique({
        where: { slug },
        include: {
            children: {
                orderBy: { name: "asc" }
            },
            parent: true
        }
    })

    if (!category) notFound()

    // Kategorinin özelliklerini (filtreler için) çek
    const attributes = await getCategoryAttributesWithInheritance(category.id)

    // İlanları getirmek için parametreleri hazırla
    const listingFilters: any = {
        categorySlug: slug,
        minPrice: resolvedSearchParams.minPrice ? Number(resolvedSearchParams.minPrice) : undefined,
        maxPrice: resolvedSearchParams.maxPrice ? Number(resolvedSearchParams.maxPrice) : undefined,
        sort: resolvedSearchParams.sort as any || "date_desc",
        attributes: {}
    }

    // URL'deki f_ ile başlayan parametreleri attribute filtresine çevir
    Object.keys(resolvedSearchParams).forEach(key => {
        if (key.startsWith("f_")) {
            const attrName = key.substring(2)
            const val = resolvedSearchParams[key]
            if (val) {
                listingFilters.attributes[attrName] = Array.isArray(val) ? val : val.split(",")
            }
        }
    })

    const { listings, totalCount } = await getListings(listingFilters)

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Breadcrumb */}
            <nav className="flex items-center text-sm text-muted-foreground mb-6 overflow-x-auto whitespace-nowrap pb-2">
                <Link href="/" className="hover:text-primary transition-colors">Anasayfa</Link>
                <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
                <Link href="/categories" className="hover:text-primary transition-colors">Kategoriler</Link>

                {category.parent && (
                    <>
                        <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
                        <Link href={`/category/${category.parent.slug}`} className="hover:text-primary transition-colors">
                            {category.parent.name}
                        </Link>
                    </>
                )}

                <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
                <span className="font-semibold text-foreground">{category.name}</span>
            </nav>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar (Filtreler & Kategoriler) */}
                <aside className="w-full lg:w-64 flex-shrink-0 space-y-6">
                    {/* Alt Kategoriler Paneli */}
                    <div className="border rounded-lg p-5 bg-card shadow-sm">
                        <h3 className="font-semibold mb-3 text-base">
                            {category.children.length > 0 ? "Alt Kategoriler" : "Kategoriler"}
                        </h3>
                        {category.children.length > 0 ? (
                            <ul className="space-y-1 text-sm">
                                {category.children.map(child => (
                                    <li key={child.id}>
                                        <Link href={`/category/${child.slug}`} className="block text-slate-600 hover:text-blue-600 hover:bg-slate-50 px-2 py-1.5 rounded transition-all">
                                            {child.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : category.parent ? (
                            <div className="text-sm">
                                <p className="text-muted-foreground mb-3 text-xs">Bu kategorinin alt kategorisi yok.</p>
                                <Link href={`/category/${category.parent.slug}`} className="text-blue-600 hover:underline font-medium flex items-center bg-blue-50 p-2 rounded justify-center">
                                    &larr; {category.parent.name}'e Dön
                                </Link>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Alt kategori yok.</p>
                        )}
                    </div>

                    {/* Filtreler */}
                    <ListingFilters availableAttributes={attributes} />
                </aside>

                {/* Main Content (İlanlar) */}
                <main className="flex-1">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b pb-4">
                        <div>
                            <h1 className="text-2xl font-bold">{category.name} <span className="text-slate-400 font-light">İlanları</span></h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                Toplam <span className="font-medium text-foreground">{totalCount || 0}</span> ilan bulundu.
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Sıralama eklenebilir */}
                        </div>
                    </div>

                    {/* İlan Listesi */}
                    {!listings || listings.length === 0 ? (
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-16 text-center text-muted-foreground">
                            {/* Empty state same as before */}
                            <Filter className="w-8 h-8 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-900 mb-2">İlan Bulunamadı</h3>
                            <p className="max-w-md mx-auto mb-6">Aradığınız kriterlere uygun ilan bulunmamaktadır.</p>
                            <Link href="/ilan-ver" className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                                Ücretsiz İlan Ver
                            </Link>
                        </div>
                    ) : (
                        <ListingResults listings={listings} />
                    )}
                </main>
            </div>
        </div>
    )
}
