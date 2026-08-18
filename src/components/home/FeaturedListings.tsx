import { ListingCard } from "@/components/listing/ListingCard"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { db } from "@/lib/db"

export async function FeaturedListings() {
    const featuredListings = await db.listing.findMany({
        where: {
            status: "ACTIVE"
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: 8,
        include: {
            category: true
        }
    })

    const serializedListings = featuredListings.map(listing => ({
        ...listing,
        price: Number(listing.price)
    }))

    return (
        <section className="bg-slate-50/50 dark:bg-transparent py-16">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                                Vitrindekiler
                            </span>
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                        </h2>
                        <p className="text-base text-muted-foreground">Sizin için seçtiğimiz en güncel ve avantajlı fırsatlar.</p>
                    </div>
                    <Button variant="outline" size="lg" asChild className="hidden md:flex group rounded-full border-primary/20 hover:border-primary/50 hover:bg-primary/5">
                        <Link href="/search">
                            Tüm İlanları Keşfet <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </Button>
                </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {serializedListings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} />
                ))}
            </div>

            <div className="mt-10 md:hidden text-center">
                <Button variant="outline" size="lg" asChild className="w-full rounded-xl">
                    <Link href="/search">
                        Tüm İlanları Keşfet
                    </Link>
                </Button>
            </div>
            </div>
        </section>
    )
}
