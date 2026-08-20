import { db } from "@/lib/db"
import { auth } from "@/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MapPin, User, ShieldCheck, ChevronRight, ShieldAlert } from "lucide-react"
import { FavoriteButton } from "@/components/listing/FavoriteButton"
import { SendMessageDialog } from "@/components/message/SendMessageDialog"
import { ListingGallery } from "@/components/listing/ListingGallery"
import { ShareButton } from "@/components/listing/ShareButton"
import { Separator } from "@/components/ui/separator"

interface ListingPageProps {
    params: Promise<{
        id: string
    }>
}

export async function generateMetadata({ params }: ListingPageProps) {
    const { id } = await params
    const listing = await db.listing.findUnique({
        where: { id },
        select: { 
            title: true,
            description: true,
            status: true,
            userId: true,
            category: {
                select: { name: true }
            }
        }
    })
    
    if (!listing) return { title: "İlan Bulunamadı" }

    if (listing.status !== "ACTIVE") {
        const session = await auth()
        let isAuthorized = false

        if (session?.user?.id) {
            if (session.user.id === listing.userId) {
                isAuthorized = true
            } else {
                const user = await db.user.findUnique({
                    where: { id: session.user.id },
                    select: { role: true }
                })
                if (user?.role === "ADMIN") {
                    isAuthorized = true
                }
            }
        }

        if (!isAuthorized) {
            return {
                title: "İlan Bulunamadı",
                robots: {
                    index: false,
                    follow: false,
                }
            }
        }
    }

    let displayTitle = listing.title;
    if (listing.category?.name && !displayTitle.toLowerCase().includes(listing.category.name.toLowerCase())) {
        displayTitle = `${listing.category.name} ${listing.title}`;
    }

    // Kısa bir SEO açıklaması oluştur
    const metaDescription = listing.description 
        ? (listing.description.length > 150 ? listing.description.substring(0, 147) + '...' : listing.description)
        : `${displayTitle} ilanı GeldeSat'ta. İlan detayları, fiyatı ve özellikleri için hemen tıklayın.`;

    return { 
        title: `${displayTitle} | GeldeSat`,
        description: metaDescription
    }
}

export default async function ListingDetailPage({ params }: ListingPageProps) {
    const { id } = await params
    const listing = await db.listing.findUnique({
        where: { id },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    createdAt: true
                }
            },
            category: {
                include: { parent: true }
            },
            attributeValues: {
                include: {
                    attribute: true
                }
            }
        }
    })

    if (!listing) {
        notFound()
    }

    const session = await auth()
    let isOwner = false
    let isAdmin = false

    if (session?.user?.id) {
        isOwner = session.user.id === listing.userId
        const currentUser = await db.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        })
        isAdmin = currentUser?.role === "ADMIN"
    }

    // İlan aktif değilse ve kullanıcı ne admin ne de ilanın sahibi ise 404 sayfasına yönlendir
    if (listing.status !== "ACTIVE" && !isAdmin && !isOwner) {
        notFound()
    }

    let isFavorited = false

    if (session?.user?.id) {
        const favorite = await db.favorite.findUnique({
            where: {
                userId_listingId: {
                    userId: session.user.id,
                    listingId: listing.id
                }
            }
        })
        isFavorited = !!favorite
    }

    // Format price
    const formattedPrice = new Intl.NumberFormat("tr-TR", { style: "currency", currency: listing.currency }).format(parseFloat(listing.price.toString()))

    return (
        <div className="container mx-auto px-4 py-6 max-w-7xl">
            {listing.status !== "ACTIVE" && (
                <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
                        <div>
                            <p className="font-semibold text-sm">
                                Bu ilan şu anda yayında değildir (Durum: {listing.status === 'INACTIVE' ? 'Pasif / İnaktif' : listing.status}).
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Bu ilanı yalnızca siz ({isAdmin ? 'Yönetici' : 'İlan Sahibi'}) önizleme modunda görebilirsiniz. Diğer ziyaretçilere &quot;404 Sayfa Bulunamadı&quot; gösterilmektedir.
                            </p>
                        </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-200/80 text-amber-900 shrink-0">
                        {listing.status}
                    </span>
                </div>
            )}

            {/* Breadcrumb */}
            <nav className="flex items-center text-sm text-muted-foreground mb-6 overflow-x-auto whitespace-nowrap pb-2">
                <Link href="/" className="hover:text-primary transition-colors">Anasayfa</Link>
                <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
                <Link href="/categories" className="hover:text-primary transition-colors">Kategoriler</Link>

                {listing.category.parent && (
                    <>
                        <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
                        <Link href={`/category/${listing.category.parent.slug}`} className="hover:text-primary transition-colors">
                            {listing.category.parent.name}
                        </Link>
                    </>
                )}

                <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
                <Link href={`/category/${listing.category.slug}`} className="hover:text-primary transition-colors">
                    {listing.category.name}
                </Link>

                <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
                <span className="font-semibold text-foreground truncate max-w-[200px]">{listing.title}</span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sol Kolon: Galeri ve Detaylar */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Galeri */}
                    <div className="rounded-xl overflow-hidden">
                        <ListingGallery images={listing.images} title={listing.title} />
                    </div>

                    {/* Açıklama */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold border-b pb-2">İlan Açıklaması</h2>
                        <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed bg-card p-6 rounded-lg border shadow-sm">
                            {listing.description}
                        </div>
                    </div>

                    {/* Özellikler */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold border-b pb-2">Özellikler</h2>
                        <div className="bg-card rounded-lg border shadow-sm divide-y text-sm">
                            {/* Sabit Özellikler */}
                            <div className="grid grid-cols-2 p-4 gap-4 bg-muted/20">
                                <div>
                                    <span className="text-muted-foreground block text-xs">İlan No</span>
                                    <span className="font-medium">#{listing.id.substring(0, 8)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs">İlan Tarihi</span>
                                    <span className="font-medium">{new Date(listing.createdAt).toLocaleDateString('tr-TR')}</span>
                                </div>
                            </div>

                            {/* Dinamik Özellikler */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4 p-6">
                                {listing.attributeValues.map((attr) => (
                                    <div key={attr.id} className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1 last:border-0 sm:border-0">
                                        <span className="text-muted-foreground">{attr.attribute.name}</span>
                                        <span className="font-medium text-right">{attr.value}</span>
                                    </div>
                                ))}
                                {listing.attributeValues.length === 0 && (
                                    <p className="text-muted-foreground col-span-full">Belirtilen özellik yok.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sağ Kolon: Fiyat / Satıcı / Aksiyon */}
                <div className="space-y-6">
                    {/* Fiyat & Başlık Kartı */}
                    <Card className="p-6 border-l-4 border-l-primary shadow-md sticky top-24">
                        <div className="mb-4">
                            <h1 className="text-xl font-bold leading-tight mb-3 text-slate-800 dark:text-slate-100">
                                {listing.title}
                            </h1>
                            <div className="flex items-center text-muted-foreground text-sm mb-4">
                                <MapPin className="w-4 h-4 mr-1 text-primary shrink-0" />
                                <span className="truncate">{listing.city} / {listing.district}</span>
                            </div>

                            <div className="text-3xl font-bold text-blue-600 mb-1">
                                {formattedPrice}
                            </div>
                            <p className="text-xs text-muted-foreground">Son güncelleme: {new Date(listing.updatedAt).toLocaleDateString()}</p>
                        </div>

                        <Separator className="my-4" />

                        {/* Satıcı Bilgisi */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden shrink-0">
                                {listing.user.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={listing.user.image} alt={listing.user.name || "User"} className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-6 h-6 text-slate-400" />
                                )}
                            </div>
                            <div>
                                <div className="font-semibold text-sm">{listing.user.name || "Kullanıcı"}</div>
                                <div className="text-xs text-muted-foreground">
                                    Üyelik: {new Date(listing.user.createdAt).getFullYear()}
                                </div>
                            </div>
                        </div>

                        {/* Aksiyon Butonları */}
                        <div className="space-y-3">
                            <SendMessageDialog
                                listingId={listing.id}
                                receiverId={listing.user.id}
                                listingTitle={listing.title}
                            />

                            <div className="flex gap-2">
                                <FavoriteButton
                                    listingId={listing.id}
                                    isFavorited={isFavorited}
                                    showText
                                    className="flex-1"
                                />
                                <ShareButton title={listing.title} />
                            </div>
                        </div>

                        {/* Güvenlik Uyarısı */}
                        <div className="mt-6 bg-amber-50 border border-amber-100 p-3 rounded text-xs text-amber-800 flex gap-2">
                            <ShieldCheck className="w-5 h-5 shrink-0 text-amber-600" />
                            <p>Güvenli alışveriş ipuçları: Kapora göndermeyin, ürünü görmeden satın almayın.</p>
                        </div>
                    </Card>

                    {/* Reklam Alanı vs */}
                    <div className="bg-muted/30 rounded-lg p-4 text-center border border-dashed">
                        <p className="text-xs text-muted-foreground">GeldeSat Güvencesiyle</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
