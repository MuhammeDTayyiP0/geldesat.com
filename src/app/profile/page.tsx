import { auth } from "@/auth"
import { Metadata } from "next"
import { BadgeCheck, AlertCircle } from "lucide-react"

export const metadata: Metadata = {
    title: "Profilim",
}
import { VerificationButton } from "@/components/profile/verification-button"
import { redirect } from "next/navigation"
import { ProfileForm } from "@/components/profile/ProfileForm"
import { PasswordSettings } from "@/components/profile/PasswordSettings"
import { PhoneSettings } from "@/components/profile/PhoneSettings"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, List, MessageSquare, Heart, Settings, LogOut, LayoutDashboard, MapPin, Phone } from "lucide-react" // Added more icons
import Link from "next/link"
import { signOut } from "@/auth"

export default async function ProfilePage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/auth/login?callbackUrl=/profile")
    }

    // Fetch User Stats
    const listingCount = await db.listing.count({
        where: { userId: session.user.id }
    })

    const favoriteCount = await db.favorite.count({
        where: { userId: session.user.id }
    })

    // Additional user info fetch (if needed, e.g. phone, join date)
    const fullUser = await db.user.findUnique({
        where: { id: session.user.id }
    })

    return (
        <div className="bg-gray-50/50 min-h-screen pb-12">
            {/* Header Section */}
            <div className="bg-white border-b border-gray-200">
                <div className="container mx-auto px-4 py-8 max-w-6xl">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary border-4 border-white shadow-lg overflow-hidden">
                            {session.user.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={session.user.image} alt={session.user.name || "User"} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-10 h-10" />
                            )}
                        </div>
                        <div className="text-center md:text-left flex-1">
                            <h1 className="text-3xl font-bold text-gray-900">{session.user.name || "Kullanıcı"}</h1>
                            <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-6 mt-2 text-gray-500 text-sm flex-wrap">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Çevrimiçi</span>
                                {session.user.email && (
                                    <div className="flex flex-col sm:flex-row items-center gap-2">
                                        <span>{session.user.email}</span>
                                        {fullUser?.emailVerified ? (
                                            <div className="flex items-center text-green-600 text-xs bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                                <BadgeCheck className="w-3 h-3 mr-1" /> Doğrulanmış
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center text-orange-600 text-xs bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                                                    <AlertCircle className="w-3 h-3 mr-1" /> Doğrulanmamış
                                                </div>
                                                <VerificationButton />
                                            </div>
                                        )}
                                    </div>
                                )}
                                {fullUser?.createdAt && <span>Üyelik: {new Date(fullUser.createdAt).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })}</span>}
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4 md:mt-0 w-full md:w-auto">
                            <Link href="/ilan-ver" className="w-full md:w-auto">
                                <Button className="w-full bg-primary hover:bg-primary/90 shadow-md">Ücretsiz İlan Ver</Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 max-w-6xl">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar Navigation */}
                    <div className="lg:col-span-1">
                        <Card className="shadow-md border-0 bg-white overflow-hidden sticky top-8">
                            <div className="p-4 bg-gray-50 border-b border-gray-100 font-medium text-gray-700 flex items-center gap-2">
                                <LayoutDashboard className="w-4 h-4" /> Yönetim Paneli
                            </div>
                            <nav className="flex flex-col p-2">
                                <Link href="/profile" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5 text-primary font-medium transition-colors">
                                    <Settings className="w-4 h-4" /> Hesap Ayarları
                                </Link>
                                <Link href="/my-listings" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                                    <List className="w-4 h-4" /> İlanlarım <span className="ml-auto text-xs bg-gray-100 py-0.5 px-2 rounded-full font-semibold">{listingCount}</span>
                                </Link>
                                <Link href="/messages" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                                    <MessageSquare className="w-4 h-4" /> Mesajlarım
                                </Link>
                                <Link href="/favorites" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                                    <Heart className="w-4 h-4" /> Favorilerim <span className="ml-auto text-xs bg-gray-100 py-0.5 px-2 rounded-full font-semibold">{favoriteCount}</span>
                                </Link>
                                <div className="h-px bg-gray-100 my-2"></div>
                                <form action={async () => {
                                    "use server"
                                    await signOut()
                                }}>
                                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-left" type="submit">
                                        <LogOut className="w-4 h-4" /> Çıkış Yap
                                    </button>
                                </form>
                            </nav>
                        </Card>
                    </div>

                    {/* Main Content Area */}
                    <div className="lg:col-span-3 space-y-6">

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="border-0 shadow-sm bg-blue-500 text-white">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-blue-100 text-sm font-medium">Aktif İlanlar</p>
                                        <p className="text-3xl font-bold mt-1">{listingCount}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                        <List className="w-6 h-6 text-white" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-sm bg-purple-500 text-white">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-purple-100 text-sm font-medium">Favoriler</p>
                                        <p className="text-3xl font-bold mt-1">{favoriteCount}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                        <Heart className="w-6 h-6 text-white" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-sm bg-orange-500 text-white">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-orange-100 text-sm font-medium">Mesajlar</p>
                                        <p className="text-3xl font-bold mt-1">0</p>
                                    </div>
                                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                        <MessageSquare className="w-6 h-6 text-white" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Profile Settings Form */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 border-b border-gray-100">
                                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <Settings className="w-5 h-5 text-gray-500" /> Profil Bilgilerini Düzenle
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">Kişisel bilgilerinizi ve hesap ayarlarınızı buradan güncelleyebilirsiniz.</p>
                                </div>
                                <div className="p-6">
                                    <ProfileForm user={session.user as any} />
                                </div>
                            </div>

                            <PhoneSettings currentPhone={fullUser?.phoneNumber} />

                            {fullUser?.password && (
                                <PasswordSettings />
                            )}
                        </div>

                        {/* Additional Info Cards (Future Use) */}

                    </div>
                </div>
            </div>
        </div>
    )
}
