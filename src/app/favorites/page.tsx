
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/card"
import { ListingCard } from "@/components/listing/ListingCard"
import { Heart } from "lucide-react"

export default async function FavoritesPage() {
    const session = await auth()
    if (!session?.user) {
        redirect("/auth/login?callbackUrl=/favorites")
    }

    const rawFavorites = await db.favorite.findMany({
        where: {
            userId: session.user.id,
            listing: {
                status: "ACTIVE"
            }
        },
        include: {
            listing: {
                include: {
                    category: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    })

    const favorites = rawFavorites.map(fav => ({
        ...fav,
        listing: {
            ...fav.listing,
            price: Number(fav.listing.price)
        }
    }))

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
                <Heart className="w-8 h-8 text-red-500 fill-current" />
                Favori İlanlarım
            </h1>

            {favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-lg border-2 border-dashed">
                    <p className="text-lg text-muted-foreground mb-4">Henüz favori ilanınız yok.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {favorites.map((fav) => (
                        <ListingCard
                            key={fav.listingId}
                            listing={fav.listing}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
