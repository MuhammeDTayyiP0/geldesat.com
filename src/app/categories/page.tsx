import { db } from "@/lib/db"
import Link from "next/link"
import { Home, Car, ShoppingBag, Wrench, Briefcase, GraduationCap, Dog, Monitor, LayoutGrid, Smartphone, Sofa, ChevronRight, Search } from "lucide-react"

export const metadata = {
    title: "Tüm Kategoriler",
    description: "GeldeSat üzerindeki tüm kategorileri inceleyin."
}

const CATEGORY_CONFIG: Record<string, { icon: any, color: string, border: string }> = {
    "emlak": { icon: Home, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
    "vasita": { icon: Car, color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
    "alisveris": { icon: ShoppingBag, color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400", border: "border-green-200 dark:border-green-800" },
    "is-makineleri": { icon: Wrench, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800" },
    "hizmetler": { icon: Briefcase, color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
    "ozel-ders": { icon: GraduationCap, color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400", border: "border-yellow-200 dark:border-yellow-800" },
    "hayvanlar-alemi": { icon: Dog, color: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400", border: "border-pink-200 dark:border-pink-800" },
    "elektronik": { icon: Monitor, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-800" },
    "giyim": { icon: ShoppingBag, color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800" },
    "yedek-parca": { icon: Wrench, color: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400", border: "border-slate-200 dark:border-slate-800" },
    "mobilya": { icon: Sofa, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
    "teknoloji": { icon: Smartphone, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400", border: "border-cyan-200 dark:border-cyan-800" }
}

export default async function AllCategoriesPage() {
    // 1. Tüm kategorileri çek
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
        },
        orderBy: { name: "asc" }
    })

    // 2. Map oluştur ve alt kategorileri hiyerarşik olarak topla
    const categoryMap = new Map<string, typeof allCategories[0]>()
    const childrenMap = new Map<string, string[]>()

    allCategories.forEach(cat => {
        categoryMap.set(cat.id, cat)
        if (cat.parentId) {
            const existing = childrenMap.get(cat.parentId) || []
            childrenMap.set(cat.parentId, [...existing, cat.id])
        }
    })

    // 3. İlan sayısını alt kategorileri dahil ederek recursive hesapla
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

    // 4. Sadece ana kategorileri al ve verileri hazırla
    const mainCategories = allCategories
        .filter(cat => cat.parentId === null)
        .map(cat => {
            const childrenIds = childrenMap.get(cat.id) || []
            const children = childrenIds.map(id => categoryMap.get(id)!).slice(0, 5) // İlk 5 alt kategori
            return {
                ...cat,
                totalListings: calculateTotal(cat.id),
                children
            }
        })

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            {/* Hero Section */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pt-16 pb-20">
                <div className="container mx-auto px-4 text-center max-w-3xl">
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
                        Ne arıyorsunuz?
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                        Milyonlarca ilan arasında kaybolmayın. İstediğiniz kategoriye hemen göz atın veya arama yapın.
                    </p>
                    <form action="/search" className="relative max-w-xl mx-auto shadow-sm rounded-2xl overflow-hidden group border border-slate-200 dark:border-slate-700">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        </div>
                        <input
                            name="q"
                            type="text"
                            placeholder="Kategori veya ilan ara... (Örn: Emlak, Otomobil)"
                            className="block w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border-none text-slate-900 dark:text-slate-100 focus:ring-0 transition-all outline-none"
                        />
                        <button type="submit" className="hidden"></button>
                    </form>
                </div>
            </div>

            {/* Categories Grid */}
            <div className="container mx-auto px-4 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {mainCategories.map(cat => {
                        const config = CATEGORY_CONFIG[cat.slug] || {
                            icon: LayoutGrid,
                            color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                            border: "border-slate-200 dark:border-slate-800"
                        }
                        const Icon = config.icon

                        return (
                            <div key={cat.id} className={`bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] border ${config.border} transition-all duration-300 hover:-translate-y-1 flex flex-col h-full group`}>
                                <div className="flex items-start gap-4 mb-6">
                                    <div className={`p-4 rounded-2xl ${config.color} group-hover:scale-110 transition-transform duration-300 shrink-0`}>
                                        <Icon className="w-8 h-8" />
                                    </div>
                                    <div className="pt-1">
                                        <Link href={`/category/${cat.slug}`}>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2">
                                                {cat.name}
                                            </h2>
                                        </Link>
                                        <span className="inline-block mt-1.5 text-[11px] font-semibold tracking-wide uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                            {cat.totalListings.toLocaleString('tr-TR')} İlan
                                        </span>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <ul className="space-y-2">
                                        {cat.children.map(child => (
                                            <li key={child.id}>
                                                <Link href={`/category/${child.slug}`} className="flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors hover:translate-x-1 duration-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mr-2.5"></span>
                                                    {child.name}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <Link href={`/category/${cat.slug}`} className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50 flex items-center text-sm font-semibold text-primary hover:text-primary/80 transition-colors group/link">
                                    Tüm {cat.name} İlanları <ChevronRight className="w-4 h-4 ml-1 group-hover/link:translate-x-1 transition-transform" />
                                </Link>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
