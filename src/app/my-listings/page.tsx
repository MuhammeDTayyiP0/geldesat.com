
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PlusCircle, Edit, Trash2, Eye, EyeOff } from "lucide-react"
import { MyListingsActions } from "@/components/listing/MyListingsActions"

export default async function MyListingsPage() {
    const session = await auth()
    if (!session?.user) {
        redirect("/auth/login?callbackUrl=/my-listings")
    }

    const listings = await db.listing.findMany({
        where: {
            userId: session.user.id
        },
        orderBy: {
            updatedAt: 'desc'
        },
        include: {
            category: true
        }
    })

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">İlanlarım</h1>
                <Button asChild>
                    <Link href="/ilan-ver">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Yeni İlan Ver
                    </Link>
                </Button>
            </div>

            {listings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-lg border-2 border-dashed">
                    <p className="text-lg text-muted-foreground mb-4">Henüz hiç ilanınız yok.</p>
                    <Button variant="outline" asChild>
                        <Link href="/ilan-ver">
                            İlk İlanını Ver
                        </Link>
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {listings.map((listing) => (
                        <Card key={listing.id} className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                            {/* Image Placeholder */}
                            <div className="w-full md:w-32 h-24 bg-muted rounded-md flex items-center justify-center shrink-0">
                                {listing.images && listing.images.length > 0 ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={listing.images[0]}
                                        alt={listing.title}
                                        className="w-full h-full object-cover rounded-md"
                                    />
                                ) : (
                                    <span className="text-xs text-muted-foreground">Görsel Yok</span>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-lg truncate">
                                        <Link href={`/ilan/${listing.id}`} className="hover:underline">
                                            {listing.title}
                                        </Link>
                                    </h3>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium 
                                        ${listing.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {listing.status === 'ACTIVE' ? 'Yayında' : 'Pasif'}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-1">
                                    {listing.category.name} &bull; {parseFloat(listing.price.toString()).toLocaleString('tr-TR')} {listing.currency}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Son Güncelleme: {new Date(listing.updatedAt).toLocaleDateString('tr-TR')}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                                <MyListingsActions listingId={listing.id} status={listing.status as "ACTIVE" | "INACTIVE"} />
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
