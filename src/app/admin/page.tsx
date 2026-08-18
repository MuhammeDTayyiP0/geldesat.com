
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, ShoppingBag, DollarSign } from "lucide-react"

export default async function AdminDashboardPage() {
    const stats = {
        totalListings: await db.listing.count(),
        activeListings: await db.listing.count({ where: { status: "ACTIVE" } }),
        totalUsers: await db.user.count(),
        totalCategories: await db.category.count(),
    }

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam İlan</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalListings}</div>
                        <p className="text-xs text-muted-foreground">Sistemdeki tüm ilanlar</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aktif İlan</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeListings}</div>
                        <p className="text-xs text-muted-foreground">Şu an yayında olanlar</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Kullanıcı</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalUsers}</div>
                        <p className="text-xs text-muted-foreground">Kayıtlı kullanıcı sayısı</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Kategoriler</CardTitle>
                        <div className="h-4 w-4 text-muted-foreground font-bold text-xs flex items-center justify-center border rounded">K</div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalCategories}</div>
                        <p className="text-xs text-muted-foreground">Alt kategoriler dahil</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
