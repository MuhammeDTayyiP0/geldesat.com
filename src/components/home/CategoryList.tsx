import { db } from "@/lib/db"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Home, Car, ShoppingBag, Wrench, Briefcase, GraduationCap, Dog, Monitor, LayoutGrid, Smartphone, Sofa } from "lucide-react"

const CATEGORY_CONFIG: Record<string, { icon: any, color: string }> = {
    "emlak": { icon: Home, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" },
    "vasita": { icon: Car, color: "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400" },
    "alisveris": { icon: ShoppingBag, color: "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400" },
    "is-makineleri": { icon: Wrench, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" },
    "hizmetler": { icon: Briefcase, color: "bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" },
    "ozel-ders": { icon: GraduationCap, color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400" },
    "hayvanlar-alemi": { icon: Dog, color: "bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400" },
    "elektronik": { icon: Monitor, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400" },
    "giyim": { icon: ShoppingBag, color: "bg-rose-100 text-rose-600" },
    "yedek-parca": { icon: Wrench, color: "bg-slate-100 text-slate-600" },
    "mobilya": { icon: Sofa, color: "bg-amber-100 text-amber-600" },
    "teknoloji": { icon: Smartphone, color: "bg-cyan-100 text-cyan-600" }
}

export async function CategoryList() {
    // 1. Tüm kategorileri ve aktif ilan sayılarını çek
    const allCategories = await db.category.findMany({
        select: {
            id: true,
            name: true,
            slug: true,
            parentId: true,
            _count: {
                select: {
                    listings: {
                        where: { status: "ACTIVE" }
                    }
                }
            }
        }
    })

    // 2. Map oluştur
    const categoryMap = new Map<string, typeof allCategories[0]>()
    const childrenMap = new Map<string, string[]>()

    allCategories.forEach(cat => {
        categoryMap.set(cat.id, cat)
        if (cat.parentId) {
            const existing = childrenMap.get(cat.parentId) || []
            childrenMap.set(cat.parentId, [...existing, cat.id])
        }
    })

    // 3. Recursive toplam hesaplama
    const calculateTotal = (categoryId: string): number => {
        const category = categoryMap.get(categoryId)
        if (!category) return 0

        let total = category._count.listings

        const childrenIds = childrenMap.get(categoryId)
        if (childrenIds) {
            childrenIds.forEach(childId => {
                total += calculateTotal(childId)
            })
        }

        return total
    }

    // 4. Ana kategorileri hazırla
    const mainCategories = allCategories
        .filter(cat => cat.parentId === null)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(cat => ({
            ...cat,
            totalListings: calculateTotal(cat.id)
        }))
        // Eğer tümünü değil popülerleri göstereceksek:
        // .sort((a, b) => b.totalListings - a.totalListings) // İlan sayısına göre sırala
        .slice(0, 12)

    return (
        <section className="container mx-auto px-4 py-12 lg:py-16">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Kategoriler</h2>
                    <p className="text-sm text-muted-foreground mt-1 hidden sm:block">En popüler kategorilere göz atın</p>
                </div>
                <Link href="/categories" className="text-primary hover:underline font-medium flex items-center group">
                    Tümünü Gör
                    <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
                </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                {mainCategories.map((cat) => {
                    const config = CATEGORY_CONFIG[cat.slug] || {
                        icon: LayoutGrid,
                        color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }
                    const Icon = config.icon

                    return (
                        <Link href={`/category/${cat.slug}`} key={cat.id} className="group">
                            <Card className="h-full hover:shadow-xl transition-all duration-300 border-border/40 shadow-sm bg-card hover:-translate-y-1 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center text-center gap-3 sm:gap-4 h-full relative z-10">
                                    <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${config.color} group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                                        <Icon className="h-6 w-6 sm:h-8 sm:w-8" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">{cat.name}</h3>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2 font-medium">
                                            {cat.totalListings > 0 ? `${cat.totalListings.toLocaleString('tr-TR')} İlan` : 'İlan Yok'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}
